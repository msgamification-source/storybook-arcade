// The teacher's side. This browser tab is the game server: it keeps score and tells every
// player's device what to show. Players only ever send back "I picked answer X".

import {
  html, raw, setScreen, byId, actions, nav, shuffle, toast, sfx, confetti, shapeIcon, mascot,
  AVATARS, avatarHtml, avatarName, icon, pose, medalImg, uid, mmss, downloadFile, csvCell, isMuted, setSoundRole, countUp,
} from './util.js';
import { openHost, friendlyError } from './transport.js';
import { MAX_PLAYERS } from './config.js';

let G = null; // the current game, or null

// ---------- Small helpers ----------
const list = () => (G ? [...G.players.values()] : []);
const connected = () => list().filter((p) => p.connected);
const curQ = () => G.quiz.questions[G.qi];
const nQ = () => G.quiz.questions.length;
const send = (p, msg) => { if (G && p && p.conn) G.transport.send(p.conn, msg); };
const cleanName = (s, max = 14) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// What the teacher can choose before a game starts (the setup screen fills these in).
export const DEFAULT_OPTS = {
  names: 'own',          // 'own' = students type a nickname, 'random' = the game gives everyone a fun name
  showOnDevices: true,   // show questions and answers on student screens
  boardSize: 10,         // how many players the leaderboard shows between questions
  auto: false,           // move on by itself after the answer reveal and the leaderboard
  delay: 5,              // seconds to stay on each screen when auto-play is on
  shuffleQ: false,       // mix up the question order
  shuffleA: false,       // mix up the answer order
};

const ADJECTIVES = ['Happy', 'Brave', 'Sparkly', 'Zippy', 'Cosmic', 'Jolly', 'Cozy', 'Mighty', 'Clever', 'Bouncy',
  'Sunny', 'Giddy', 'Lucky', 'Swift', 'Witty', 'Daring', 'Speedy', 'Snazzy', 'Chirpy', 'Fuzzy', 'Sleepy', 'Cheery',
  'Plucky', 'Peppy', 'Zesty', 'Perky', 'Merry', 'Wild'];
// A friendly name that matches the player's buddy, like "Brave Fox". Never repeats in one game.
function randomName(avatar) {
  const noun = avatarName(avatar);
  const taken = new Set(list().map((p) => p.name.toLowerCase()));
  for (let i = 0; i < 60; i++) {
    const n = `${ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]} ${noun}`;
    if (!taken.has(n.toLowerCase())) return n;
  }
  let k = 2;
  while (taken.has(`${noun} ${k}`.toLowerCase())) k++;
  return `${noun} ${k}`;
}

// A copy of the quiz for this game, with the order mixed up if the teacher asked for that.
function prepareQuiz(quiz, o) {
  let qs = quiz.questions.map((q) => ({ ...q, options: [...q.options] }));
  if (o.shuffleA) {
    qs = qs.map((q) => {
      const idx = shuffle(q.options.map((_, i) => i));
      return { ...q, options: idx.map((i) => q.options[i]), correct: idx.indexOf(q.correct) };
    });
  }
  if (o.shuffleQ) qs = shuffle(qs);
  return { ...quiz, questions: qs };
}
const prettyPin = (pin) => pin.slice(0, 3) + ' ' + pin.slice(3);
const MODE_LABEL = { live: 'Live Quiz', race: 'Race' };

function ranked() {
  const l = list().sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
  l.forEach((p, i) => { p.rank = i + 1; });
  return l;
}

function joinUrl() {
  const u = new URL(location.href);
  u.search = ''; u.hash = '';
  u.searchParams.set('pin', G.pin);
  return u.toString();
}
function shortUrl() {
  return (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
}
function qrSvg(text) {
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true, alt: 'QR code to join the game' });
  } catch { return ''; }
}
function warnUnload(e) { if (G && G.phase !== 'end') { e.preventDefault(); e.returnValue = ''; } }

// ---------- Start / stop ----------
export async function hostGame({ quiz, mode, local, minutes, opts }) {
  setSoundRole('host');
  setScreen('screen center', html`<div class="loading">${mascot('bob')}<p>Opening your game room...</p></div>`);
  let transport;
  try {
    transport = await openHost({ local });
  } catch (e) {
    return setScreen('screen center', html`
      <div class="card narrow center-text">
        <h1>Hmm, that did not work</h1>
        <p>${friendlyError(e)}</p>
        <p class="hint">Tip: the "Test on this device" option works without the internet.</p>
        <button class="btn btn-sky" data-action="to-library">Back</button>
      </div>`);
  }
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  G = {
    quiz: prepareQuiz(quiz, o), opts: o, mode, local, minutes: minutes || 5, transport, pin: transport.pin,
    autoTimer: 0, autoTick: 0, autoPaused: false,
    players: new Map(), conns: new Map(), phase: 'lobby',
    qi: -1, answers: new Map(), qStart: 0, limit: 20, counts: [], ticker: 0, allTimer: 0,
    finishCount: 0, raceEnd: 0,
  };
  transport.onMessage = onMessage;
  transport.onClose = onClose;
  transport.onTrouble = () => toast('Connection hiccup. If a player is stuck, ask them to refresh the page.');
  window.addEventListener('beforeunload', warnUnload);
  renderLobby();
}

export function stopHosting() {
  if (!G) return;
  clearInterval(G.ticker); clearTimeout(G.allTimer); clearAuto();
  list().forEach((p) => p.race && clearTimeout(p.race.timer));
  try { G.transport.broadcast({ t: 'bye' }); } catch { /* ignore */ }
  const t = G.transport;
  G = null;
  window.removeEventListener('beforeunload', warnUnload);
  setTimeout(() => t.destroy(), 400); // give the goodbye a moment to be delivered
}

// ---------- Incoming messages ----------
function onMessage(conn, m) {
  if (!G || !m || typeof m !== 'object' || typeof m.t !== 'string') return;
  if (m.t === 'join') return onJoin(conn, m);
  const pid = G.conns.get(conn);
  const p = pid && G.players.get(pid);
  if (!p) return;
  if (m.t === 'a') onAnswer(p, m);
  else if (m.t === 'ra') onRaceAnswer(p, m);
  else if (m.t === 'rn') onRaceNext(p);
}

function onClose(conn) {
  if (!G) return;
  const pid = G.conns.get(conn);
  if (!pid) return;
  G.conns.delete(conn);
  const p = G.players.get(pid);
  if (!p || p.conn !== conn) return;
  p.conn = null; p.connected = false;
  if (G.phase === 'lobby') G.players.delete(pid);
  rosterChanged();
}

function onJoin(conn, m) {
  const reject = (reason) => {
    G.transport.send(conn, { t: 'rej', reason });
    setTimeout(() => { if (G) G.transport.drop(conn); }, 400);
  };
  const random = G.opts.names === 'random';
  const typed = cleanName(m.name);
  const avatar = AVATARS.includes(m.avatar) ? m.avatar : AVATARS[0];
  const pidIn = typeof m.pid === 'string' ? m.pid.slice(0, 40) : '';
  let p = pidIn ? G.players.get(pidIn) : null;
  if (!p && !random) {
    if (!typed) return reject('name');
    const same = list().find((x) => x.name.toLowerCase() === typed.toLowerCase());
    if (same) { if (!same.connected) p = same; else return reject('taken'); }
  }
  if (p) { // coming back after a refresh or Wi-Fi blip
    if (p.conn && p.conn !== conn) { G.conns.delete(p.conn); G.transport.drop(p.conn); }
    p.conn = conn; p.connected = true;
  } else {
    if (G.players.size >= MAX_PLAYERS) return reject('full');
    p = {
      pid: uid(), name: random ? randomName(avatar) : typed, avatar,
      conn, connected: true, score: 0, streak: 0, correct: 0, last: null, rank: 0, prevRank: 0, delta: 0, race: null,
    };
    G.players.set(p.pid, p);
  }
  G.conns.set(conn, p.pid);
  send(p, { t: 'welcome', pid: p.pid, name: p.name, avatar: p.avatar, mode: G.mode, title: G.quiz.title });
  snapshot(p);
  sfx.join();
  rosterChanged();
}

// Bring a (re)joining player up to speed with whatever is on screen right now.
function snapshot(p) {
  switch (G.phase) {
    case 'question':
      send(p, qMsg(remaining()));
      if (G.answers.has(p.pid)) send(p, { t: 'ack', i: G.qi, c: G.answers.get(p.pid).c });
      break;
    case 'reveal':
    case 'board':
      if (p.last && p.last.i === G.qi) send(p, resultMsg(p));
      else send(p, { t: 'wait', text: 'Hang tight! The next question is coming up.' });
      break;
    case 'countdown': send(p, { t: 'cd' }); break;
    case 'race': startRaceFor(p); break;
    case 'end': send(p, endMsg(p)); break;
    default: break;
  }
}

function rosterChanged() {
  if (!G) return;
  if (G.phase === 'lobby') updateLobby();
  else if (G.phase === 'question') { updateAnswered(); checkAllAnswered(); }
  else if (G.phase === 'race') { list().forEach(updateLane); checkRaceOver(); }
}

// ---------- Lobby ----------
function renderLobby() {
  const url = joinUrl();
  setScreen('screen host v-lobby', html`
    <header class="topbar">
      <button class="btn btn-ghost" data-action="h-exit">&larr; Leave</button>
      <div class="chip">${G.quiz.emoji} ${G.quiz.title} <span class="chip-sub">${MODE_LABEL[G.mode]}</span></div>
      <button class="btn btn-ghost" data-action="mute" aria-label="Toggle sound">${isMuted() ? '🔇' : '🔊'}</button>
    </header>
    <main class="lobby-main">
      <section class="card join-card">
        <p class="eyebrow">Go to <b>${shortUrl()}</b></p>
        <p class="eyebrow">and enter the game PIN</p>
        <div class="pin" aria-label="Game PIN ${G.pin}">${prettyPin(G.pin)}</div>
        <div class="qr">${raw(qrSvg(url))}</div>
        <p class="hint">${G.local ? 'Test mode: open this site in another tab on this device to join.' : 'Or scan the code with a tablet or phone camera.'}</p>
      </section>
      <section class="players-panel">
        <div class="players-head">
          <h2><span id="count">0</span> <span id="count-label">players</span> in the room</h2>
          <button class="btn btn-pink btn-lg" id="start-btn" data-action="h-start" disabled>Start game</button>
        </div>
        <div id="grid" class="player-grid"></div>
        <p id="empty" class="hint empty">Waiting for players to join...</p>
      </section>
    </main>`);
  updateLobby();
}

function updateLobby() {
  const grid = byId('grid');
  if (!grid) return;
  const ps = list();
  // Add and remove chips one at a time so only new players pop in.
  const stale = new Map([...grid.children].map((el) => [el.dataset.pid, el]));
  ps.forEach((p) => {
    if (stale.has(p.pid)) { stale.delete(p.pid); return; }
    const el = document.createElement('div');
    el.className = 'pchip'; el.dataset.pid = p.pid;
    el.innerHTML = html`
      <span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span>
      <button class="x" data-action="h-kick" data-pid="${p.pid}" aria-label="Remove ${p.name}" title="Remove ${p.name}">&times;</button>`.__raw;
    grid.appendChild(el);
  });
  stale.forEach((el) => el.remove());
  grid.classList.toggle('many', ps.length > 14);
  byId('count').textContent = ps.length;
  byId('count-label').textContent = ps.length === 1 ? 'player' : 'players';
  byId('empty').hidden = ps.length > 0;
  byId('start-btn').disabled = ps.length === 0;
}

actions['h-kick'] = ({ pid }) => {
  if (!G) return;
  const p = G.players.get(pid);
  if (!p) return;
  send(p, { t: 'kick' });
  if (p.conn) { G.conns.delete(p.conn); const c = p.conn; setTimeout(() => G && G.transport.drop(c), 400); }
  G.players.delete(pid);
  rosterChanged();
};

actions['h-start'] = () => {
  if (!G || G.phase !== 'lobby' || connected().length === 0) return;
  beginCountdown();
};

// 3, 2, 1 on every screen, then the game begins.
function beginCountdown() {
  G.phase = 'countdown';
  connected().forEach((p) => send(p, { t: 'cd' }));
  let n = 3;
  const show = () => {
    if (!byId('cd')) {
      setScreen('screen host v-count', html`<main class="cd-wrap">${pose('stand', 'cd-star')}<p class="cd-label">Get ready!</p><div id="cd" class="cd-num" aria-live="assertive"></div></main>`);
    }
    const el = byId('cd');
    el.textContent = n; el.classList.remove('cd-pop'); void el.offsetWidth; el.classList.add('cd-pop');
    sfx.countdown();
  };
  show();
  clearInterval(G.ticker);
  G.ticker = setInterval(() => {
    n--;
    if (!G || G.phase !== 'countdown') { clearInterval(G && G.ticker); return; }
    if (n > 0) { show(); return; }
    clearInterval(G.ticker);
    if (G.mode === 'race') startRace(); else startQuestion(0);
  }, 1000);
}

// ---------- Live quiz ----------
function remaining() { return Math.max(0, G.limit - (Date.now() - G.qStart) / 1000); }
function qMsg(left) {
  const q = curQ();
  const hide = !G.opts.showOnDevices;
  return {
    t: 'q', i: G.qi, n: nQ(), hide, text: hide ? '' : q.text, options: hide ? q.options.map(() => '') : q.options,
    limit: q.time, left: Math.round(left * 10) / 10,
  };
}

function startQuestion(i) {
  clearInterval(G.ticker); clearTimeout(G.allTimer); clearAuto();
  G.qi = i; G.phase = 'question'; G.answers = new Map();
  G.limit = curQ().time; G.qStart = Date.now();
  connected().forEach((p) => send(p, qMsg(G.limit)));
  renderQuestion();
  G.ticker = setInterval(tick, 200);
  sfx.start();
}

function tick() {
  if (!G || G.phase !== 'question') return;
  const left = remaining();
  updateTimer(left);
  if (left <= 0) endQuestion();
}

function onAnswer(p, m) {
  if (G.phase !== 'question' || m.i !== G.qi || G.answers.has(p.pid)) return;
  const c = m.c;
  if (!Number.isInteger(c) || c < 0 || c >= curQ().options.length) return;
  const t = (Date.now() - G.qStart) / 1000;
  if (t > G.limit + 1.5) return; // too late
  G.answers.set(p.pid, { c, t: Math.min(t, G.limit) });
  send(p, { t: 'ack', i: G.qi, c });
  updateAnswered();
  checkAllAnswered();
}

function checkAllAnswered() {
  const active = connected();
  if (active.length && active.every((p) => G.answers.has(p.pid))) {
    clearTimeout(G.allTimer);
    G.allTimer = setTimeout(() => { if (G && G.phase === 'question') endQuestion(); }, 700);
  }
}

function endQuestion() {
  if (!G || G.phase !== 'question') return;
  clearInterval(G.ticker); clearTimeout(G.allTimer);
  G.phase = 'reveal';
  list().forEach((p) => { p.prevRank = p.rank || 0; });
  const q = curQ();
  const counts = q.options.map(() => 0);
  list().forEach((p) => {
    const a = G.answers.get(p.pid);
    if (a) counts[a.c]++;
    if (a && a.c === q.correct) {
      p.streak++; p.correct++;
      const base = Math.round(1000 * (1 - (a.t / q.time) / 2));
      const bonus = Math.min(p.streak - 1, 5) * 100;
      p.score += base + bonus;
      p.last = { i: G.qi, ok: true, none: false, gain: base + bonus };
    } else {
      p.streak = 0;
      p.last = { i: G.qi, ok: false, none: !a, gain: 0 };
    }
  });
  G.counts = counts;
  ranked();
  list().forEach((p) => { p.delta = p.prevRank ? p.prevRank - p.rank : 0; });
  connected().forEach((p) => send(p, resultMsg(p)));
  renderReveal();
}

function resultMsg(p) {
  const q = curQ();
  return {
    t: 'r', i: G.qi, correct: q.correct, correctText: q.options[q.correct],
    ok: p.last.ok, none: p.last.none, gain: p.last.gain,
    score: p.score, streak: p.streak, rank: p.rank, delta: p.delta || 0, of: G.players.size,
  };
}

actions['h-next'] = () => {
  if (!G) return;
  clearAuto();
  if (G.phase === 'reveal') { if (G.qi >= nQ() - 1) finishGame(); else renderBoard(); }
  else if (G.phase === 'board') startQuestion(G.qi + 1);
};
actions['h-skip'] = () => { if (G && G.phase === 'question') endQuestion(); };
actions['h-end'] = () => {
  if (!G || !confirm('End the game now and show the podium?')) return;
  if (G.phase === 'race') endRace(); else finishGame();
};

// ---------- Auto-play ----------
function clearAuto() {
  if (!G) return;
  clearTimeout(G.autoTimer); clearInterval(G.autoTick);
  G.autoAt = 0;
}
function scheduleAuto() {
  clearAuto();
  if (!G.opts.auto) return;
  if (!G.autoPaused) {
    G.autoAt = Date.now() + G.opts.delay * 1000;
    G.autoTimer = setTimeout(() => { if (G) actions['h-next'](); }, G.opts.delay * 1000);
    G.autoTick = setInterval(updateAutoLabel, 250);
  }
  updateAutoLabel();
}
function updateAutoLabel() {
  const b = byId('auto');
  if (!b || !G) return;
  b.textContent = G.autoPaused ? 'Resume auto-play' : `Auto-play: next in ${Math.max(0, Math.ceil((G.autoAt - Date.now()) / 1000))}`;
}
actions['h-auto'] = () => {
  if (!G) return;
  G.autoPaused = !G.autoPaused;
  scheduleAuto();
};
const autoButton = () => (G.opts.auto ? html`<button class="btn btn-ghost" id="auto" data-action="h-auto"></button>` : '');

function optsHtml(q, counts) {
  const max = counts ? Math.max(1, ...counts) : 1;
  return html`<div class="opts n${q.options.length}">${q.options.map((o, i) => html`
    <div class="opt opt-${i} ${counts ? (i === q.correct ? 'right' : 'wrong') : 'enter'}" style="--i:${i}">
      <span class="badge">${shapeIcon(i)}</span>
      <span class="otext">${o}</span>
      ${counts ? html`<span class="count">${counts[i]}</span><i class="bar" style="width:${Math.round((counts[i] / max) * 100)}%"></i>` : ''}
      ${counts && i === q.correct ? html`<span class="tick" aria-label="Correct answer">✓</span>` : ''}
    </div>`)}</div>`;
}

function renderQuestion() {
  const q = curQ();
  setScreen('screen host qscreen', html`
    <header class="qbar">
      <div class="chip">Question ${G.qi + 1} of ${nQ()}</div>
      <div class="answered"><b id="ans-count">0</b> of <span id="ans-total">0</span> answered</div>
      <button class="btn btn-ghost" data-action="h-skip">Skip &rarr;</button>
    </header>
    <main class="qmain">
      <div class="timer" id="timer" aria-hidden="true"><span id="t-num">${q.time}</span></div>
      <h1 class="qtext">${q.text}</h1>
    </main>
    ${optsHtml(q, null)}
    <div class="timebar" aria-hidden="true"><i id="tbar"></i></div>`);
  updateAnswered();
  updateTimer(G.limit);
}

let lastTick = -1;
function updateTimer(left) {
  const n = byId('t-num'); const bar = byId('tbar');
  if (!n || !bar) return;
  const secs = Math.ceil(left);
  n.textContent = secs;
  bar.style.width = (left / G.limit) * 100 + '%';
  byId('timer').classList.toggle('low', secs <= 5);
  if (secs <= 5 && secs !== lastTick && secs > 0) { sfx.tick(); }
  lastTick = secs;
}
function updateAnswered() {
  const a = byId('ans-count');
  if (!a || !G) return;
  a.textContent = G.answers.size;
  byId('ans-total').textContent = connected().length;
}

function renderReveal() {
  const q = curQ();
  const last = G.qi >= nQ() - 1;
  setScreen('screen host qscreen reveal', html`
    <header class="qbar">
      <div class="chip">Question ${G.qi + 1} of ${nQ()}</div>
      <div class="answered"><b>${G.answers.size}</b> of ${connected().length} answered</div>
      <div class="row">${autoButton()}<button class="btn btn-pink" data-action="h-next">${last ? 'See results' : 'Next'} &rarr;</button></div>
    </header>
    <main class="qmain"><div class="timer ghost" aria-hidden="true"></div><h1 class="qtext">${q.text}</h1></main>
    ${optsHtml(q, G.counts)}`);
  scheduleAuto();
}

function renderBoard() {
  G.phase = 'board';
  const top = ranked().slice(0, G.opts.boardSize);
  const best = Math.max(1, top[0] ? top[0].score : 1);
  const tight = top.length > 6;
  setScreen('screen host v-board', html`
    <header class="topbar">
      <div class="chip">After question ${G.qi + 1} of ${nQ()}</div>
      <div class="row">${autoButton()}<button class="btn btn-pink" data-action="h-next">Next question &rarr;</button></div>
    </header>
    <main class="board-main">
      <h1>${icon('trophy')} Leaderboard</h1>
      <ol class="board ${tight ? 'tight' : ''}">${top.map((p, i) => html`
        <li class="brow" style="--d:${i * 70}ms;--shift:${Math.max(-10, Math.min(10, p.prevRank ? p.prevRank - p.rank : 0))}">
          <span class="rank">${p.rank}</span><span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span>
          <span class="barwrap"><i style="width:${Math.max(3, Math.round((p.score / best) * 100))}%"></i></span>
          <b class="sc" data-from="${p.score - (p.last && p.last.i === G.qi ? p.last.gain : 0)}" data-to="${p.score}">${p.score}</b>
          ${p.prevRank && p.delta > 0 ? html`<span class="delta up" title="Moved up ${p.delta}">&#9650;${p.delta}</span>`
            : p.prevRank && p.delta < 0 ? html`<span class="delta down" title="Moved down ${-p.delta}">&#9660;${-p.delta}</span>`
            : html`<span class="delta"></span>`}
          ${p.streak >= 2 ? html`<span class="streak" title="${p.streak} in a row">${icon('flame')}${p.streak}</span>` : html`<span class="streak"></span>`}
        </li>`)}
      </ol>
    </main>`);
  document.querySelectorAll('.board .sc[data-to]').forEach((el, i) => {
    countUp(el, Number(el.dataset.to), { from: Number(el.dataset.from), ms: 900, delay: 400 + i * 70 });
  });
  scheduleAuto();
}

// ---------- Race ----------
function initRace(p) {
  if (!p.race) {
    p.race = { queue: shuffle(G.quiz.questions.map((_, i) => i)), cur: null, correct: 0, done: false, place: 0, nextAt: 0, serial: 0, timer: 0 };
  }
}

function startRace() {
  G.phase = 'race';
  G.raceEnd = Date.now() + G.minutes * 60000;
  G.finishCount = 0;
  list().forEach(initRace);
  connected().forEach(startRaceFor);
  renderRace();
  G.ticker = setInterval(raceTick, 250);
  sfx.start();
}

function startRaceFor(p) {
  initRace(p);
  send(p, { t: 'rs', total: nQ(), secs: Math.max(0, Math.round((G.raceEnd - Date.now()) / 1000)) });
  if (p.race.done) send(p, finishMsg(p)); else sendRaceQ(p);
}

function sendRaceQ(p) {
  const r = p.race;
  if (!G || G.phase !== 'race' || !r || !p.connected) return;
  const qi = r.queue[0];
  const q = G.quiz.questions[qi];
  const order = shuffle(q.options.map((_, i) => i));
  r.cur = { qi, order, s: ++r.serial, answered: false };
  send(p, {
    t: 'rq', s: r.cur.s, text: q.text, options: order.map((i) => q.options[i]),
    done: r.correct, total: nQ(), score: p.score, streak: p.streak,
  });
}

function finishMsg(p) {
  return { t: 'rf', place: p.race.place, score: p.score, total: nQ() };
}

function onRaceAnswer(p, m) {
  const r = p.race;
  const cur = r && r.cur;
  if (G.phase !== 'race' || !cur || cur.answered || m.s !== cur.s) return;
  if (!Number.isInteger(m.c) || m.c < 0 || m.c >= cur.order.length) return;
  cur.answered = true;
  const q = G.quiz.questions[cur.qi];
  const ok = cur.order[m.c] === q.correct;
  let gain = 0; let bonus = 0;
  if (ok) {
    r.queue.shift(); r.correct++; p.correct++; p.streak++;
    gain = 100 + Math.min(p.streak - 1, 5) * 20;
    if (!r.queue.length) { r.done = true; r.place = ++G.finishCount; bonus = [0, 300, 200, 100][r.place] || 0; }
    p.score += gain + bonus;
  } else {
    p.streak = 0;
    r.queue.push(r.queue.shift()); // missed questions come back around later
  }
  r.nextAt = Date.now() + (ok ? 600 : 1800);
  send(p, {
    t: 'rr', s: cur.s, ok, correct: cur.order.indexOf(q.correct), gain, bonus,
    score: p.score, streak: p.streak, done: r.correct, total: nQ(), finished: r.done, place: r.place,
  });
  updateLane(p);
  if (r.done) { sfx.correct(); checkRaceOver(); }
}

function onRaceNext(p) {
  const r = p.race;
  if (!r || G.phase !== 'race') return;
  if (r.done) return send(p, finishMsg(p));
  if (r.cur && !r.cur.answered) return;
  clearTimeout(r.timer);
  r.timer = setTimeout(() => sendRaceQ(p), Math.max(0, r.nextAt - Date.now()));
}

function raceTick() {
  if (!G || G.phase !== 'race') return;
  const left = (G.raceEnd - Date.now()) / 1000;
  const c = byId('clock');
  if (c) { c.textContent = mmss(left); c.classList.toggle('low', left <= 30); }
  if (left <= 0) endRace();
}

function checkRaceOver() {
  const act = connected();
  if (act.length && act.every((p) => p.race && p.race.done)) setTimeout(() => { if (G && G.phase === 'race') endRace(); }, 1500);
}
function endRace() { if (G && G.phase === 'race') finishGame(); }

function renderRace() {
  setScreen('screen host v-race', html`
    <header class="topbar">
      <div class="chip">${G.quiz.emoji} ${G.quiz.title} <span class="chip-sub">Race</span></div>
      <div class="clock" id="clock">${mmss(G.minutes * 60)}</div>
      <button class="btn btn-ghost" data-action="h-end">End now</button>
    </header>
    <main class="race-main">
      <p class="hint">Answer every question correctly to reach the finish. Missed ones come back around!</p>
      <div class="lanes" id="lanes"></div>
    </main>`);
  list().forEach(updateLane);
}

function updateLane(p) {
  const wrap = byId('lanes');
  if (!wrap || !G || G.phase !== 'race') return;
  let el = wrap.querySelector(`[data-pid="${CSS.escape(p.pid)}"]`);
  if (!el) {
    el = document.createElement('div');
    el.className = 'lane'; el.dataset.pid = p.pid;
    el.innerHTML = html`
      <span class="lane-name"><span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span></span>
      <span class="track"><span class="runner" aria-hidden="true">${avatarHtml(p.avatar)}</span><span class="flag">${icon('flag')}</span></span>
      <span class="lane-score"><b class="coins">${icon('coin')}<span class="cn">0</span></b><span class="fire"></span></span>`.__raw;
    wrap.appendChild(el);
    wrap.classList.toggle('dense', wrap.children.length > 10);
    wrap.classList.toggle('crowded', wrap.children.length > 22);
  }
  const frac = p.race ? Math.min(1, p.race.correct / nQ()) : 0;
  const runner = el.querySelector('.runner');
  if (frac > Number(el.dataset.p || 0) && runner) { runner.classList.remove('hop'); void runner.offsetWidth; runner.classList.add('hop'); }
  el.dataset.p = frac;
  el.style.setProperty('--p', frac);
  el.classList.toggle('off', !p.connected);
  el.classList.toggle('done', !!(p.race && p.race.done));
  el.querySelector('.cn').textContent = p.score;
  const r = p.race;
  el.querySelector('.fire').innerHTML = (r && r.done ? html`${icon('flag')} #${r.place}` : p.streak >= 3 ? html`${icon('flame')}${p.streak}` : html``).__raw;
}

// ---------- The end ----------
function endMsg(p) {
  return { t: 'end', rank: p.rank, of: G.players.size, score: p.score, correct: p.correct, total: nQ(), mode: G.mode };
}

function finishGame() {
  clearInterval(G.ticker); clearTimeout(G.allTimer); clearAuto();
  G.phase = 'end';
  const l = ranked();
  connected().forEach((p) => send(p, endMsg(p)));
  renderPodium(l);
}

function renderPodium(l) {
  const [a, b, c] = l;
  const spot = (p, place) => (p ? html`
    <div class="spot spot-${place}">
      <div class="spot-av">${avatarHtml(p.avatar)}</div><div class="spot-nm">${p.name}</div><div class="spot-sc">${p.score}</div>
      <div class="step">${medalImg(place)}<span>${place}</span></div>
    </div>` : html`<div class="spot spot-${place} empty"></div>`);
  setScreen('screen host v-podium', html`
    <header class="topbar">
      <div class="chip">${G.quiz.emoji} ${G.quiz.title}</div>
      <div class="row">
        <button class="btn btn-sky" data-action="h-csv">Download results</button>
        <button class="btn btn-pink" data-action="h-exit">Finish</button>
      </div>
    </header>
    <main class="podium-main">
      <h1>${l.length ? 'Great game!' : 'Game over'}</h1>
      <div class="podium">${spot(b, 2)}${spot(a, 1)}${spot(c, 3)}</div>
      ${l.length > 3 ? html`
        <ol class="rest" start="4">${l.slice(3).map((p) => html`
          <li><span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span><b>${p.score}</b></li>`)}
        </ol>` : ''}
    </main>`);
  if (l.length) { confetti(); sfx.win(); }
}

actions['h-csv'] = () => {
  if (!G) return;
  const rows = [['Rank', 'Name', 'Score', 'Questions correct', 'Total questions']];
  ranked().forEach((p) => rows.push([p.rank, p.name, p.score, p.correct, nQ()]));
  const safe = G.quiz.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'quiz';
  downloadFile(`${safe}-results.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
};

actions['h-exit'] = () => {
  if (G && G.phase !== 'end' && list().length && !confirm('Leave this game? Players will be disconnected.')) return;
  stopHosting();
  nav.home();
};

// Keyboard shortcut for the teacher: Space or Enter moves to the next screen.
document.addEventListener('keydown', (e) => {
  if (!G || (e.key !== ' ' && e.key !== 'Enter')) return;
  if (e.target.closest && e.target.closest('button, input, select, textarea, a')) return;
  if (G.phase === 'reveal' || G.phase === 'board') { e.preventDefault(); actions['h-next'](); }
  else if (G.phase === 'question') { e.preventDefault(); actions['h-skip'](); }
});

export const isHosting = () => !!G;
