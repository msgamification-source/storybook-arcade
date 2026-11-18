// How the host and players talk to each other.
//
//  - "online" mode: PeerJS / WebRTC. The teacher's browser is the game server, so no backend is needed.
//  - "local" mode: BroadcastChannel. Same device, different tabs. Great for testing a quiz alone.
//
// Both modes expose the same tiny API, so the game code does not care which one is used.
//
// Host:   { pin, kind, onOpen(id), onClose(id), onMessage(id, msg), onTrouble(err),
//           send(id, msg), broadcast(msg), drop(id), destroy() }
// Player: { kind, onMessage(msg), onClose(), send(msg), close() }

import { PEER_OPTIONS } from './config.js';
import { uid } from './util.js';

const PREFIX = 'storybookarcade-';
const getPeer = () => window.Peer || (window.peerjs && window.peerjs.Peer);
const randomPin = () => String(Math.floor(100000 + Math.random() * 900000));
const err = (type, message) => Object.assign(new Error(message || type), { type });
const BROKER_WAIT_MS = 10000;   // how long to wait for the connection service
const LINK_WAIT_MS = 15000;     // how long to wait for the two devices to link up once the game is found

// ---------- Host ----------
export async function openHost({ local = false } = {}) {
  let last;
  for (let i = 0; i < 6; i++) {
    const pin = randomPin();
    try { return local ? await localHost(pin) : await peerHost(pin); }
    catch (e) { last = e; if (e.type !== 'unavailable-id') break; } // PIN already taken: try another
  }
  throw last || err('unknown');
}

function peerHost(pin) {
  return new Promise((resolve, reject) => {
    const P = getPeer();
    if (!P) return reject(err('no-library', 'PeerJS did not load'));
    const peer = new P(PREFIX + pin, { ...PEER_OPTIONS });
    const conns = new Map();
    let ready = false;
    const slow = setTimeout(() => {
      if (ready) return;
      try { peer.destroy(); } catch { /* ignore */ }
      reject(err('timeout-broker'));
    }, BROKER_WAIT_MS);
    const api = {
      kind: 'online', pin,
      onOpen() {}, onClose() {}, onMessage() {}, onTrouble() {},
      send(id, msg) { const c = conns.get(id); if (c && c.open) { try { c.send(msg); } catch { /* ignore */ } } },
      broadcast(msg) { conns.forEach((c) => { if (c.open) { try { c.send(msg); } catch { /* ignore */ } } }); },
      drop(id) { const c = conns.get(id); conns.delete(id); if (c) { try { c.close(); } catch { /* ignore */ } } },
      destroy() { conns.clear(); try { peer.destroy(); } catch { /* ignore */ } },
    };
    peer.on('open', () => { ready = true; clearTimeout(slow); resolve(api); });
    peer.on('error', (e) => {
      if (!ready) { clearTimeout(slow); try { peer.destroy(); } catch { /* ignore */ } reject(e); } else api.onTrouble(e);
    });
    // If we lose the broker, existing players stay connected. Reconnect so new players can still join.
    peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch { /* ignore */ } }, 1500); });
    peer.on('connection', (conn) => {
      conn.on('open', () => { conns.set(conn.peer, conn); api.onOpen(conn.peer); });
      conn.on('data', (d) => api.onMessage(conn.peer, d));
      conn.on('close', () => { if (conns.get(conn.peer) === conn) { conns.delete(conn.peer); api.onClose(conn.peer); } });
      conn.on('error', () => {});
    });
  });
}

function localHost(pin) {
  const bc = new BroadcastChannel('storybookarcade-local-' + pin);
  const known = new Set();
  const api = {
    kind: 'local', pin,
    onOpen() {}, onClose() {}, onMessage() {}, onTrouble() {},
    send(id, msg) { bc.postMessage({ to: id, msg }); },
    broadcast(msg) { bc.postMessage({ to: '*', msg }); },
    drop(id) { known.delete(id); bc.postMessage({ to: id, bye: true }); },
    destroy() { try { bc.postMessage({ to: '*', bye: true }); bc.close(); } catch { /* ignore */ } },
  };
  bc.onmessage = (e) => {
    const d = e.data || {};
    if (d.to !== 'host') return;
    if (d.hello) {
      if (!known.has(d.from)) { known.add(d.from); api.onOpen(d.from); }
      bc.postMessage({ to: d.from, welcome: true });
    } else if (d.bye) {
      if (known.delete(d.from)) api.onClose(d.from);
    } else if (known.has(d.from)) {
      api.onMessage(d.from, d.msg);
    }
  };
  return Promise.resolve(api);
}

// ---------- Player ----------
// Tries a same-device host first (instant), then the internet.
export async function connectToGame(pin) {
  if (window.BroadcastChannel) {
    try { return await localClient(pin); } catch { /* not a local game */ }
  }
  try {
    return await peerClient(pin);
  } catch (e) {
    // A link that failed right away is often a one-off hiccup, so try once more.
    if (e.type === 'negotiation-failed') return peerClient(pin);
    throw e;
  }
}

function localClient(pin, timeoutMs = 400) {
  return new Promise((resolve, reject) => {
    const bc = new BroadcastChannel('storybookarcade-local-' + pin);
    const id = uid();
    let done = false;
    const api = {
      kind: 'local', onMessage() {}, onClose() {},
      send(msg) { bc.postMessage({ to: 'host', from: id, msg }); },
      close() { try { bc.postMessage({ to: 'host', from: id, bye: true }); bc.close(); } catch { /* ignore */ } },
    };
    const timer = setTimeout(() => {
      if (!done) { done = true; bc.close(); reject(err('peer-unavailable')); }
    }, timeoutMs);
    bc.onmessage = (e) => {
      const d = e.data || {};
      if (d.to !== id && d.to !== '*') return;
      if (d.welcome) { if (!done) { done = true; clearTimeout(timer); resolve(api); } return; }
      if (d.bye) { api.onClose(); return; }
      if (done && d.msg) api.onMessage(d.msg);
    };
    window.addEventListener('pagehide', () => api.close());
    bc.postMessage({ to: 'host', from: id, hello: true });
  });
}

function peerClient(pin) {
  return new Promise((resolve, reject) => {
    const P = getPeer();
    if (!P) return reject(err('no-library', 'PeerJS did not load'));
    const peer = new P({ ...PEER_OPTIONS });
    let done = false;
    let conn = null;
    let timer = 0;
    const api = {
      kind: 'online', onMessage() {}, onClose() {},
      send(msg) { if (conn && conn.open) { try { conn.send(msg); } catch { /* ignore */ } } },
      close() { try { peer.destroy(); } catch { /* ignore */ } },
    };
    const fail = (e) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { peer.destroy(); } catch { /* ignore */ }
      reject(e);
    };
    // Two stages, so the message can say which one went wrong:
    //   1. reach the connection service  2. link up with the teacher's computer
    timer = setTimeout(() => fail(err('timeout-broker')), BROKER_WAIT_MS);
    peer.on('error', (e) => { if (!done) fail(e); });
    peer.on('open', () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail(err('timeout-link')), LINK_WAIT_MS);
      conn = peer.connect(PREFIX + pin, { reliable: true, serialization: 'json' });
      conn.on('open', () => { if (!done) { done = true; clearTimeout(timer); resolve(api); } });
      conn.on('data', (d) => api.onMessage(d));
      conn.on('close', () => { if (!done) fail(err('negotiation-failed')); else api.onClose(); });
      conn.on('error', (e) => { if (!done) fail(err((e && e.type) || 'negotiation-failed')); });
    });
    window.addEventListener('pagehide', () => api.close());
  });
}

// Plain words for what went wrong. "kind" lets the screen decide whether to offer the connection check.
export const errorKind = (e) => {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'notfound';
  if (t === 'timeout-link' || t === 'negotiation-failed') return 'link';
  return 'service';
};
export const friendlyError = (e) => {
  switch (errorKind(e)) {
    case 'notfound': return 'We could not find that game. Check the PIN. The teacher\'s game room has to be open.';
    case 'link': return 'We found the game, but your device could not connect to it. Try joining on the same Wi-Fi as your teacher\'s computer.';
    default:
      if (e && e.type === 'no-library') return 'Something did not load. Refresh the page and try again.';
      return 'We could not reach the connection service. Check your internet and try again.';
  }
};
