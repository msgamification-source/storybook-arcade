// The reliable connection: a free Firebase Realtime Database used as a mailbox.
//
// WebRTC (what PeerJS uses) is blocked or broken on many school networks. This route only uses
// ordinary HTTPS web traffic to the database, which school networks almost always allow.
//
// How it works (nothing here needs a server of our own):
//   rooms/<pin>/open          the host updates a beat counter every few seconds, so players know the room is alive
//   rooms/<pin>/up/<key>      messages from players to the teacher's computer
//   rooms/<pin>/dn/<id>/<key> messages from the teacher's computer to one player
// Each message is a small JSON string with a counter, so the receiver can put messages back in order.
// Messages are read with a live event stream (EventSource) and, if the network blocks streaming,
// by asking again every second or so (polling). Read messages are deleted, and the whole room is
// deleted when the game ends.
//
// To turn this on, put the database address in RELAY_URL (js/config.js). See the README.

import { RELAY_URL } from './config.js';
import { uid } from './util.js';

// Timings, in milliseconds. (Tests shorten them.)
export const T = Object.assign({
  hostBeat: 8000,       // how often the host says "this room is alive"
  clientBeat: 6000,     // how often a player says "I am still here" when idle
  staleMs: 45000,       // the host forgets a player after this long with no word
  hostCheck: 8000,      // how often a player checks the room is still alive
  hostGoneBeats: 3,     // missed host checks in a row before a player gives up
  gapMs: 2500,          // wait this long for a missing message before skipping it
  sseWaitMs: 4000,      // wait this long for the live stream before polling instead
  pollMs: 900,          // polling interval
  purgeMs: 1500,        // how often read messages are cleaned up
  reqTimeout: 10000,    // give up on one web request after this long
}, (typeof window !== 'undefined' && window.__SA_TUNE) || {});

const err = (type, message) => Object.assign(new Error(message || type), { type });
export const relayConfigured = () => !!RELAY_URL;
const base = () => RELAY_URL.replace(/\/+$/, '');
const roomUrl = (pin, path = '') => `${base()}/rooms/${pin}${path}.json`;
const pad = (n) => String(n).padStart(6, '0');
const validId = (s) => typeof s === 'string' && /^[A-Za-z0-9]{6,24}$/.test(s);

// ---------- Web requests ----------
async function http(url, { method = 'GET', body, timeout = T.reqTimeout, keepalive = false } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    return await fetch(url, { method, body, signal: ctl.signal, cache: 'no-store', keepalive });
  } catch {
    throw err('relay-unreachable');
  } finally { clearTimeout(timer); }
}
async function getJson(url) {
  const r = await http(url);
  if (r.status === 401 || r.status === 403) throw err('relay-denied');
  if (!r.ok) throw err('relay-unreachable');
  try { return await r.json(); } catch { throw err('relay-unreachable'); }
}

// Run at most a few requests at a time, so a busy class does not choke the browser.
let active = 0;
const waiting = [];
function limited(fn) {
  return new Promise((resolve, reject) => { waiting.push({ fn, resolve, reject }); pump(); });
}
function pump() {
  while (active < 6 && waiting.length) {
    const { fn, resolve, reject } = waiting.shift();
    active++;
    fn().then(resolve, reject).finally(() => { active--; pump(); });
  }
}
// Write something, trying a few times if the network hiccups.
async function write(url, bodyText, method = 'PUT') {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await limited(() => http(url, { method, body: bodyText }));
      if (r.ok) return true;
      if (r.status === 401 || r.status === 403 || r.status === 400) return false; // not going to work on retry
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 300 * (i + 1)));
  }
  return false;
}
// A message is stored as a JSON string inside a JSON string, so Firebase sees a plain text value.
const asValue = (payload) => JSON.stringify(JSON.stringify(payload));

// ---------- Putting messages back in order ----------
export class Inbox {
  constructor(deliver) { this.deliver = deliver; this.next = 1; this.buf = new Map(); this.timer = 0; }
  add(n, m) {
    if (!Number.isInteger(n) || n < this.next || this.buf.has(n)) return;
    this.buf.set(n, m);
    this.flush();
  }
  flush() {
    while (this.buf.has(this.next)) {
      const m = this.buf.get(this.next);
      this.buf.delete(this.next); this.next++;
      try { this.deliver(m); } catch (e) { console.error(e); }
    }
    if (this.buf.size && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = 0;
        if (this.buf.size) { this.next = Math.min(...this.buf.keys()); this.flush(); } // skip a message that never came
      }, T.gapMs);
    } else if (!this.buf.size && this.timer) { clearTimeout(this.timer); this.timer = 0; }
  }
  stop() { clearTimeout(this.timer); this.timer = 0; }
}

// ---------- Listening: live stream first, polling if the network does not allow it ----------
// onItem(key, valueString) is called for every message found. Duplicates are fine, the Inbox drops them.
function watch(url, onItem, onLive, onDead) {
  let es = null;
  let poll = 0;
  let stopped = false;
  let live = false;
  let fails = 0;

  const itemAt = (path, data) => {
    const key = String(path || '/').replace(/^\//, '');
    if (!key) {
      if (data && typeof data === 'object') Object.keys(data).sort().forEach((k) => { if (typeof data[k] === 'string') onItem(k, data[k]); });
    } else if (!key.includes('/') && typeof data === 'string') onItem(key, data);
  };
  const markLive = () => { fails = 0; if (!live) { live = true; onLive(); } };

  const startPolling = () => {
    if (stopped || poll) return;
    const tick = async () => {
      if (stopped) return;
      try {
        const data = await getJson(url);
        markLive();
        itemAt('/', data);
      } catch (e) {
        if (++fails >= 5) onDead(e);
      }
      if (!stopped) poll = setTimeout(tick, T.pollMs);
    };
    poll = setTimeout(tick, 0);
  };

  const startStream = () => {
    if (typeof EventSource === 'undefined') return startPolling();
    try { es = new EventSource(url); } catch { return startPolling(); }
    const giveUp = setTimeout(() => { if (!live) { try { es.close(); } catch { /* ignore */ } es = null; startPolling(); } }, T.sseWaitMs);
    const parse = (e) => { try { return JSON.parse(e.data); } catch { return null; } };
    es.addEventListener('put', (e) => { const m = parse(e); if (!m) return; clearTimeout(giveUp); markLive(); itemAt(m.path, m.data); });
    es.addEventListener('patch', (e) => {
      const m = parse(e); if (!m || !m.data || typeof m.data !== 'object') return;
      clearTimeout(giveUp); markLive();
      const root = String(m.path || '/').replace(/\/$/, '');
      Object.keys(m.data).forEach((k) => itemAt(`${root}/${k}`, m.data[k]));
    });
    es.addEventListener('cancel', () => { clearTimeout(giveUp); onDead(err('relay-denied')); });
    es.onerror = () => {
      // The browser reconnects by itself. If it has given up for good, fall back to polling.
      if (es && es.readyState === 2 /* CLOSED */) { clearTimeout(giveUp); es = null; startPolling(); }
    };
  };

  startStream();
  return () => { stopped = true; clearTimeout(poll); if (es) { try { es.close(); } catch { /* ignore */ } } };
}

// Delete messages once they have been read, in batches.
function purger(url) {
  const keys = new Set();
  const timer = setInterval(async () => {
    if (!keys.size) return;
    const batch = [...keys].slice(0, 200);
    batch.forEach((k) => keys.delete(k));
    const o = {};
    batch.forEach((k) => { o[k] = null; });
    await write(url, JSON.stringify(o), 'PATCH');
  }, T.purgeMs);
  return { add: (k) => keys.add(k), stop: () => clearInterval(timer) };
}

const parseMessage = (text) => { try { const o = JSON.parse(text); return o && typeof o === 'object' ? o : null; } catch { return null; } };

// ---------- The teacher's side ----------
export async function relayHost(pin) {
  const existing = await getJson(roomUrl(pin, '/open'));      // throws if the relay can not be reached
  if (existing) throw err('unavailable-id');                    // that PIN is in use, pick another
  const ok = await write(roomUrl(pin), JSON.stringify({ open: { b: 0, v: 1 } }));
  if (!ok) throw err('relay-denied');

  const known = new Map();      // players we are talking to: id -> { lastSeen }
  const gone = new Set();       // players we dropped for being quiet
  const inboxes = new Map();
  const sendSeq = new Map();
  let beat = 0;
  let destroyed = false;

  const api = {
    kind: 'relay', pin,
    onOpen() {}, onClose() {}, onMessage() {}, onTrouble() {},
    send(id, msg) { out(id, msg); },
    broadcast(msg) { known.forEach((_, id) => out(id, msg)); },
    drop(id) { out(id, { t: '__bye' }); known.delete(id); inboxes.delete(id); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(beatTimer); clearInterval(sweepTimer); stopWatch(); purge.stop();
      inboxes.forEach((i) => i.stop());
      const wipe = () => { http(roomUrl(pin), { method: 'DELETE', keepalive: true }).catch(() => {}); };
      setTimeout(wipe, 1200);            // let the goodbye go out first
      setTimeout(wipe, 2 * T.hostCheck + 1500); // and once more, in case a late message from a student re-created a scrap
    },
  };

  function out(id, msg) {
    if (destroyed && msg.t !== 'bye') return;
    const n = (sendSeq.get(id) || 0) + 1;
    sendSeq.set(id, n);
    write(roomUrl(pin, `/dn/${id}/${pad(n)}`), asValue({ n, m: msg }));
  }
  function closePlayer(id) {
    if (!known.delete(id)) return;
    gone.add(id);
    api.onClose(id);
  }
  function deliver(id, m) {
    if (m.t === '__leave') return closePlayer(id);
    let rec = known.get(id);
    if (!rec) {
      if (m.t !== 'join') { out(id, { t: '__rejoin' }); return; } // we do not know this player: ask it to join again
      rec = { lastSeen: 0 };
      known.set(id, rec); gone.delete(id);
      api.onOpen(id);
    }
    rec.lastSeen = Date.now();
    if (m.t === '__hb') return;
    api.onMessage(id, m);
  }

  const purge = purger(roomUrl(pin, '/up'));
  const stopWatch = watch(roomUrl(pin, '/up'), (key, text) => {
    purge.add(key);
    const o = parseMessage(text);
    if (!o || !validId(o.c) || !o.m || typeof o.m.t !== 'string') return;
    let box = inboxes.get(o.c);
    if (!box) { box = new Inbox((m) => deliver(o.c, m)); inboxes.set(o.c, box); }
    box.add(o.n, o.m);
  }, () => {}, (e) => api.onTrouble(e));

  const beatTimer = setInterval(() => { write(roomUrl(pin, '/open'), JSON.stringify({ b: ++beat, v: 1 })); }, T.hostBeat);
  const sweepTimer = setInterval(() => {
    const now = Date.now();
    known.forEach((rec, id) => { if (now - rec.lastSeen > T.staleMs) closePlayer(id); });
  }, Math.max(500, Math.min(5000, T.staleMs / 3)));
  window.addEventListener('pagehide', () => { if (!destroyed) http(roomUrl(pin), { method: 'DELETE', keepalive: true }).catch(() => {}); });
  return api;
}

// ---------- The student's side ----------
export async function relayClient(pin) {
  const open = await getJson(roomUrl(pin, '/open'));
  if (!open) throw err('peer-unavailable');

  const id = uid().replace(/[^A-Za-z0-9]/g, '').slice(0, 16).padEnd(8, 'x');
  let seq = 0;
  let closed = false;
  let lastSent = Date.now();
  let lastBeat = open.b;
  let sameBeats = 0;
  let missed = 0;
  const timers = [];

  const api = {
    kind: 'relay', onMessage() {}, onClose() {},
    send(msg) {
      if (closed) return;
      const n = ++seq;
      lastSent = Date.now();
      write(roomUrl(pin, `/up/${id}_${pad(n)}`), asValue({ c: id, n, m: msg }));
    },
    close() {
      if (closed) return;
      api.send({ t: '__leave' });
      stop();
      // Let the goodbye be sent, then clean up.
    },
  };
  function stop() { closed = true; timers.forEach(clearInterval); stopWatch(); purge.stop(); inbox.stop(); }
  const lost = () => { if (closed) return; stop(); api.onClose(); };

  const inbox = new Inbox((m) => {
    if (m.t === '__rejoin' || m.t === '__bye') return lost();
    api.onMessage(m);
    if (m.t === 'bye') stop();     // the game is over and the room is about to be deleted: go quiet so we do not re-create it
  });
  const purge = purger(roomUrl(pin, `/dn/${id}`));

  let readyResolve; let readyReject;
  const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  const timeout = setTimeout(() => readyReject(err('relay-unreachable')), T.reqTimeout + T.sseWaitMs);
  const stopWatch = watch(roomUrl(pin, `/dn/${id}`), (key, text) => {
    purge.add(key);
    const o = parseMessage(text);
    if (o) inbox.add(o.n, o.m);
  }, () => readyResolve(), (e) => { readyReject(e); lost(); });

  try { await ready; } catch (e) { stop(); throw e; } finally { clearTimeout(timeout); }

  // Say hello now and then so the teacher knows we are here, and check the room is still alive.
  timers.push(setInterval(() => { if (Date.now() - lastSent > T.clientBeat - 500) api.send({ t: '__hb' }); }, T.clientBeat));
  timers.push(setInterval(async () => {
    try {
      const o = await getJson(roomUrl(pin, '/open'));
      if (!o) return lost();
      missed = 0;
      sameBeats = o.b === lastBeat ? sameBeats + 1 : 0;
      lastBeat = o.b;
      if (sameBeats >= T.hostGoneBeats) lost();     // the host's beat stopped
    } catch (e) {
      if (++missed >= T.hostGoneBeats) lost();
    }
  }, T.hostCheck));
  window.addEventListener('pagehide', () => { if (!closed) { try { fetch(roomUrl(pin, `/up/${id}_${pad(++seq)}`), { method: 'PUT', body: asValue({ c: id, n: seq, m: { t: '__leave' } }), keepalive: true }); } catch { /* ignore */ } } });
  return api;
}

// Can this device reach the database, and are the rules set so the game can use it?
export async function testRelay() {
  if (!relayConfigured()) return null;
  try {
    const r = await http(roomUrl('_check', '/open'), { timeout: 8000 });
    if (r.ok) return 'ok';
    return r.status === 401 || r.status === 403 ? 'denied' : 'bad';
  } catch { return 'bad'; }
}
