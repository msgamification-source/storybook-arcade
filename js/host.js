// The teacher's side. This browser tab is the game server: it keeps score and tells every
// player's device what to show. Players only ever send back "I picked answer X".

import {
  html, raw, setScreen, byId, actions, nav, shuffle, toast, sfx, confetti, shapeIcon, mascot,
  AVATARS, avatarHtml, avatarName, icon, pose, medalImg, uid, mmss, downloadFile, csvCell, isMuted, setSoundRole, countUp,
} from './util.js';
import { openHost, friendlyError, errorKind } from './transport.js';
import { buildStory, storyHtml, plainText, speak, canSpeak, stopSpeaking } from './story.js';
import { newStats, recordAnswer, recordNone, buildReport, reportCsv, BAND_LABEL, CHECK_IN_BELOW, CHECK_IN_MIN_ANSWERS } from './report.js';
import { registerTemp } from './quizzes.js';
import { BOSSES, bossById, STRENGTH, AVG_HIT } from './bosses.js';
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
  steal: true,           // Treasure Gates: allow stealing coins from classmates
  boss: 'random',        // Class vs. the Boss: which boss ('random' picks one)
  strength: 'medium',    // Class vs. the Boss: easy, medium or hard
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
  let qs = quiz.questions.map((q, i) => ({ ...q, _i: i, options: [...q.options] }));
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
const MODE_LABEL = { live: 'Live Quiz', race: 'Race', gates: 'Treasure Gates', boss: 'Class vs. the Boss' };

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
        <div class="row" style="justify-content:center">
          <button class="btn btn-sky" data-action="to-library">Back</button>
          ${errorKind(e) !== 'notfound' ? html`<button class="btn" data-action="to-check">Run a connection check</button>` : ''}
        </div>
      </div>`);
  }
  const o = { ...DEFAULT_OPTS, ...(opts || {}) };
  G = {
    quiz: prepareQuiz(quiz, o), opts: o, mode, local, minutes: minutes || 5, transport, pin: transport.pin,
    autoTimer: 0, autoTick: 0, autoPaused: false,
    players: new Map(), conns: new Map(), phase: 'lobby',
    qi: -1, answers: new Map(), qStart: 0, limit: 20, counts: [], ticker: 0, allTimer: 0,
    finishCount: 0, raceEnd: 0, feed: [], feedId: 0, gatesTimer: 0, bigSteal: null,
    story: null, storyPage: 0, storyOn: false, stats: newStats(), report: null,
    baseQuiz: quiz, boss: null, bossTimer: 0,
  };
  if (mode === 'boss') {
    const def = o.boss === 'random' ? BOSSES[Math.floor(Math.random() * BOSSES.length)] : bossById(o.boss);
    G.boss = { ...def, hp: 0, max: 0, energy: 0, slams: 0, hits: 0, won: false, lastHit: null, strength: STRENGTH[o.strength] ? o.strength : 'medium', perPlayer: 0, heal: 0, phase: '', sent: 0, sentHp: -1 };
  }
  transport.onMessage = onMessage;
  transport.onClose = onClose;
  transport.onTrouble = () => toast('Connection hiccup. If a player is stuck, ask them to refresh the page.');
  window.addEventListener('beforeunload', warnUnload);
  renderLobby();
}

export function stopHosting() {
  if (!G) return;
  clearInterval(G.ticker); clearTimeout(G.allTimer); clearTimeout(G.gatesTimer); clearTimeout(G.bossTimer); clearAuto();
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
  else if (m.t === 'gp') onGatePick(p, m);
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
      bestStreak: 0, steals: 0, stoleCoins: 0, double: false, shield: false, attempts: 0, right: 0,
    };
    G.players.set(p.pid, p);
  }
  G.conns.set(conn, p.pid);
  if (G.mode === 'boss' && G.phase === 'race' && !G.boss.won && p.attempts === 0 && !p.race) { G.boss.max += G.boss.perPlayer; G.boss.hp += G.boss.perPlayer; }
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
    case 'end': send(p, endMsg(p)); if (G.storyOn) send(p, storyMsg()); break;
    default: break;
  }
}

function rosterChanged() {
  if (!G) return;
  if (G.phase === 'lobby') updateLobby();
  else if (G.phase === 'question') { updateAnswered(); checkAllAnswered(); }
  else if (G.phase === 'race') { list().forEach(updateLane); scheduleGates(); scheduleBoss(); checkRaceOver(); }
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
        <p class="route hint" title="How devices connect to this game">${G.transport.kind === 'relay' ? 'Connection: reliable (works on school networks)' : G.transport.kind === 'online' ? 'Connection: direct' : ''}</p>
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
    if (G.mode === 'live') startQuestion(0); else startRace();
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
    if (a) {
      counts[a.c]++;
      recordAnswer(G.stats, q, q.options[a.c], a.c === q.correct);
      p.attempts++; if (a.c === q.correct) p.right++;
    } else if (p.connected) recordNone(G.stats, q);
    if (a && a.c === q.correct) {
      p.streak++; p.correct++; p.bestStreak = Math.max(p.bestStreak, p.streak);
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
      <h1 class="qtext ${q.text.length > 110 ? 'long' : ''}">${q.text}</h1>
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
      <div class="row">${autoButton()}<button class="btn btn-ghost" data-action="h-end">End game</button><button class="btn btn-pink" data-action="h-next">${last ? 'See results' : 'Next'} &rarr;</button></div>
    </header>
    <main class="qmain"><div class="timer ghost" aria-hidden="true"></div><h1 class="qtext ${q.text.length > 110 ? 'long' : ''}">${q.text}</h1></main>
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
      <div class="row">${autoButton()}<button class="btn btn-ghost" data-action="h-end">End game</button><button class="btn btn-pink" data-action="h-next">Next question &rarr;</button></div>
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
  if (G.mode === 'boss') initBoss();
  list().forEach(initRace);
  connected().forEach(startRaceFor);
  if (G.mode === 'gates') renderGates(); else if (G.mode === 'boss') renderBoss(); else renderRace();
  G.ticker = setInterval(raceTick, 250);
  sfx.start();
}

function startRaceFor(p) {
  initRace(p);
  send(p, { t: 'rs', mode: G.mode, total: nQ(), secs: Math.max(0, Math.round((G.raceEnd - Date.now()) / 1000)), boss: G.mode === 'boss' ? bossMsg() : undefined });
  const cur = p.race.cur;
  if (G.mode === 'gates' && cur && cur.gateOpen && !cur.gatePicked) send(p, { t: 'gate', s: cur.s, coins: p.score }); // they still owe a gate pick
  else if (p.race.done) send(p, finishMsg(p));
  else sendRaceQ(p);
}

function sendRaceQ(p) {
  const r = p.race;
  if (!G || G.phase !== 'race' || !r || !p.connected) return;
  if (!r.queue.length) r.queue = shuffle(G.quiz.questions.map((_, i) => i));
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
  recordAnswer(G.stats, q, q.options[cur.order[m.c]], ok);
  p.attempts++; if (ok) p.right++;
  let gain = 0; let bonus = 0;
  if (ok) {
    r.queue.shift(); r.correct++; p.correct++; p.streak++; p.bestStreak = Math.max(p.bestStreak, p.streak);
    if (G.mode === 'gates') {
      gain = 50 + Math.min(p.streak - 1, 5) * 10;
      cur.doubled = p.double;
      if (p.double) { gain *= 2; p.double = false; }
      cur.gateOpen = true; // they now get to pick a gate
    } else if (G.mode === 'boss') {
      gain = G.boss.won ? 0 : 10 + Math.min(p.streak - 1, 4) * 2;   // damage to the boss
      if (gain) hitBoss(p, gain);
    } else {
      gain = 100 + Math.min(p.streak - 1, 5) * 20;
      if (!r.queue.length) { r.done = true; r.place = ++G.finishCount; bonus = [0, 300, 200, 100][r.place] || 0; }
    }
    p.score += gain + bonus;
  } else {
    p.streak = 0;
    r.queue.push(r.queue.shift()); // missed questions come back around later
    if (G.mode === 'boss' && G.boss.heal) healBoss(G.boss.heal);
  }
  r.nextAt = Date.now() + (ok ? 600 : 1800);
  send(p, {
    t: 'rr', s: cur.s, ok, correct: cur.order.indexOf(q.correct), gain, bonus,
    score: p.score, streak: p.streak, done: r.correct, total: nQ(), finished: r.done, place: r.place,
    gate: G.mode === 'gates' && ok, doubled: !!cur.doubled, dmg: G.mode === 'boss' && ok ? gain : 0,
  });
  updateLane(p); scheduleGates();
  if (r.done) { sfx.correct(); checkRaceOver(); }
}

function onRaceNext(p) {
  const r = p.race;
  if (!r || G.phase !== 'race') return;
  if (r.done) return send(p, finishMsg(p));
  if (r.cur && !r.cur.answered) return;
  if (r.cur && r.cur.gateOpen && !r.cur.gatePicked) return; // pick a gate first
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

// ---------- Treasure Gates ----------
// After every right answer a player picks one of three hidden gates. Everything about what is
// behind the gates is decided here, so a student device can never peek or cheat.
const GATE_TABLE = [
  { kind: 'coins', amount: 100, w: 22 },
  { kind: 'coins', amount: 200, w: 14 },
  { kind: 'coins', amount: 400, w: 6 },
  { kind: 'jackpot', amount: 1000, w: 2 },
  { kind: 'double', w: 10 },
  { kind: 'shield', w: 10 },
  { kind: 'steal', w: 24 },
];

function drawGate() {
  const table = G.opts.steal ? GATE_TABLE : GATE_TABLE.filter((g) => g.kind !== 'steal');
  const forced = window.__forceGateKind; // only the automatic tests set this
  if (forced) return table.find((g) => g.kind === forced) || table[0];
  let x = Math.random() * table.reduce((n, g) => n + g.w, 0);
  for (const g of table) { x -= g.w; if (x < 0) return g; }
  return table[0];
}

// A steal takes about a fifth of the victim's coins (50 to 300) and always leaves them some.
const stealAmount = (v) => Math.max(1, Math.min(300, Math.max(50, Math.round(v.score * 0.2 / 10) * 10), v.score - 25));
// You can only steal from someone who is ahead of you and has at least 100 coins.
function pickVictim(thief) {
  const c = connected().filter((x) => x !== thief && x.race && x.score >= 100 && x.score > thief.score);
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}

function feedAdd(kind, text) {
  G.feed.unshift({ id: ++G.feedId, kind, text });
  if (G.feed.length > 7) G.feed.length = 7;
}

function onGatePick(p, m) {
  const r = p.race;
  const cur = r && r.cur;
  if (G.mode !== 'gates' || G.phase !== 'race' || !cur || m.s !== cur.s || !cur.gateOpen || cur.gatePicked) return;
  if (!Number.isInteger(m.g) || m.g < 0 || m.g > 2) return;
  cur.gatePicked = true;
  const out = drawGate();
  const mult = cur.doubled ? 2 : 1;
  let res = { kind: out.kind };
  if (out.kind === 'coins' || out.kind === 'jackpot') {
    const n = out.amount * mult;
    p.score += n; res.amount = n;
    if (out.kind === 'jackpot') { feedAdd('jackpot', `${p.name} found the JACKPOT! +${n} coins`); sfx.jackpot(); } else sfx.coin();
  } else if (out.kind === 'double') {
    p.double = true;
  } else if (out.kind === 'shield') {
    p.shield = true;
  } else if (out.kind === 'steal') {
    const v = pickVictim(p);
    if (!v) {                      // nobody ahead of you to steal from
      p.score += 150; res = { kind: 'coins', amount: 150, nobody: true };
    } else if (v.shield) {         // their shield soaks it up
      v.shield = false; p.score += 50;
      res = { kind: 'blocked', amount: 50, victim: v.name };
      send(v, { t: 'ev', kind: 'blocked', who: p.name, coins: v.score });
      feedAdd('block', `${v.name}'s shield blocked ${p.name}!`);
    } else {
      const n = stealAmount(v);
      v.score -= n; p.score += n; p.steals++; p.stoleCoins += n;
      res = { kind: 'steal', amount: n, victim: v.name };
      send(v, { t: 'ev', kind: 'stolen', who: p.name, n, coins: v.score });
      feedAdd('steal', `${p.name} stole ${n} coins from ${v.name}!`);
      if (!G.bigSteal || n > G.bigSteal.n) G.bigSteal = { thief: p.name, victim: v.name, n };
      sfx.steal();
    }
  }
  r.nextAt = Date.now() + 1200;
  send(p, { t: 'gr', s: cur.s, g: m.g, ...res, coins: p.score, shield: p.shield, double: p.double });
  scheduleGates(true);
}

function renderGates() {
  setScreen('screen host v-gates', html`
    <header class="topbar">
      <div class="chip">${G.quiz.emoji} ${G.quiz.title} <span class="chip-sub">Treasure Gates</span></div>
      <div class="clock" id="clock">${mmss(G.minutes * 60)}</div>
      <button class="btn btn-ghost" data-action="h-end">End now</button>
    </header>
    <main class="gates-main">
      <section class="gboard-wrap">
        <div class="gboard" id="gboard" aria-label="Coins so far"></div>
        <p class="hint" id="gmore"></p>
      </section>
      <section class="feed card">
        <h2>${icon(G.opts.steal ? 'mask' : 'coin')} What just happened</h2>
        <ol id="feed-list"></ol>
      </section>
    </main>`);
  updateGates();
}

// Redraw the coin board (at most every 350 ms so a busy class does not make it jitter).
function scheduleGates(feedChanged) {
  if (!G || G.mode !== 'gates' || G.phase !== 'race' || G.gatesTimer) return;
  G.gatesTimer = setTimeout(() => { if (!G) return; G.gatesTimer = 0; updateGates(); }, feedChanged ? 120 : 350);
}

function updateGates() {
  const board = byId('gboard');
  if (!board || !G || G.mode !== 'gates') return;
  const all = ranked();
  const top = all.slice(0, 10);
  const have = new Map([...board.children].map((e) => [e.dataset.pid, e]));
  top.forEach((p, i) => {
    let el = have.get(p.pid);
    if (!el) {
      el = document.createElement('div');
      el.className = 'coinrow'; el.dataset.pid = p.pid;
      el.innerHTML = html`<span class="rank"></span><span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span>
        <span class="badges"></span><b class="coins">${icon('coin')}<span class="cn">0</span></b>`.__raw;
      board.appendChild(el);
    }
    have.delete(p.pid);
    el.style.setProperty('--i', i);
    el.querySelector('.rank').textContent = i + 1;
    el.classList.toggle('off', !p.connected);
    const cn = el.querySelector('.cn');
    const prev = Number(cn.dataset.v || 0);
    if (prev !== p.score) {
      countUp(cn, p.score, { from: prev, ms: 500 });
      cn.dataset.v = p.score;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    el.querySelector('.badges').innerHTML = html`${p.shield ? icon('shield') : ''}${p.double ? html`<span class="x2">x2</span>` : ''}${p.streak >= 3 ? html`<span class="sk">${icon('flame')}${p.streak}</span>` : ''}`.__raw;
  });
  have.forEach((e) => e.remove()); // anyone who dropped out of the top 10
  board.style.setProperty('--n', Math.max(1, top.length));
  byId('gmore').textContent = all.length > 10 ? `and ${all.length - 10} more playing` : '';
  const kindIcon = { steal: 'mask', block: 'shield', jackpot: 'trophy' };
  const shown = Number(board.dataset.feed || 0);
  byId('feed-list').innerHTML = (G.feed.length ? G.feed : [{ id: 0, kind: 'info', text: 'The gates are open! Answer questions to find treasure.' }]).map((f) => html`
    <li class="fi ${f.kind} ${f.id > shown ? 'new' : ''}">${icon(kindIcon[f.kind] || 'coin')}<span>${f.text}</span></li>`.__raw).join('');
  board.dataset.feed = G.feedId;
}

// ---------- Class vs. the Boss ----------
// One big boss, one shared health bar. Every right answer hits it. Team power builds with every hit
// and unleashes a Mega Slam. If the clock runs out first, the boss gets away.
function initBoss() {
  const b = G.boss;
  const st = STRENGTH[b.strength] || STRENGTH.medium;
  b.perPlayer = Math.max(10, Math.round((st.hits * (G.minutes / 5) * AVG_HIT) / 10) * 10); // health each student adds
  const n = Math.max(1, connected().length);
  b.max = b.perPlayer * n; b.hp = b.max; b.energy = 0; b.heal = st.heal; b.phase = '';
}

const bossPct = () => (G.boss.max ? Math.max(0, Math.round((G.boss.hp / G.boss.max) * 100)) : 0);
const bossMsg = () => ({ id: G.boss.id, name: G.boss.name, short: G.boss.short, hp: G.boss.hp, max: G.boss.max });
const slamAt = () => Math.max(10, Math.round(connected().length * 1.5)); // how many hits fill the team power bar

function hitBoss(p, dmg) {
  const b = G.boss;
  if (b.won) return;
  b.hp = Math.max(0, b.hp - dmg); b.hits++; b.energy++;
  arenaHit(p, dmg);
  if (b.energy >= slamAt() && b.hp > 0) {
    b.energy = 0; b.slams++;
    const slam = Math.max(10, Math.round((b.max * 0.04) / 10) * 10);
    b.hp = Math.max(0, b.hp - slam);
    arenaSlam(slam);
    connected().forEach((q) => send(q, { t: 'bm', dmg: slam, hp: b.hp, max: b.max }));
  }
  if (b.hp <= 0) {
    b.won = true; b.lastHit = p.name;
    arenaDefeat();
    setTimeout(() => { if (G && G.phase === 'race') finishGame(); }, 2400);
  }
  scheduleBoss();
}
function healBoss(n) {
  const b = G.boss;
  if (b.won) return;
  b.hp = Math.min(b.max, b.hp + n);
  scheduleBoss();
}

function renderBoss() {
  const b = G.boss;
  setScreen('screen host v-boss', html`
    <header class="topbar">
      <div class="chip">${G.quiz.emoji} ${G.quiz.title} <span class="chip-sub">Class vs. the Boss</span></div>
      <div class="clock" id="clock">${mmss(G.minutes * 60)}</div>
      <button class="btn btn-ghost" data-action="h-end">End now</button>
    </header>
    <main class="arena">
      <section class="boss-stage">
        <div class="bubble" id="taunt" role="status"></div>
        <div class="boss-wrap" id="bosswrap">
          <img class="boss-img" id="bossimg" src="assets/bosses/${b.id}.png" alt="${b.name}" draggable="false">
          <div class="dmg-layer" id="dmglayer"></div>
          <div class="slam-text" id="slamtext" hidden>MEGA SLAM!</div>
        </div>
        <div class="boss-name">${b.name}</div>
        <div class="hpbar" role="progressbar" aria-label="Boss health"><i id="hpfill"></i><span id="hptext"></span></div>
        <div class="energy"><span>${icon('pencil')} Team power</span><div class="energybar"><i id="enfill"></i></div></div>
      </section>
      <section class="team" id="team" aria-label="The class"></section>
    </main>`);
  updateBoss();
}

// Redraw the health bar and team (at most every 150 ms), and tell student devices about the health twice a second.
function scheduleBoss() {
  if (!G || G.mode !== 'boss' || G.phase !== 'race' || G.bossTimer) return;
  G.bossTimer = setTimeout(() => { if (!G) return; G.bossTimer = 0; updateBoss(); }, 150);
}

function updateBoss() {
  const b = G && G.boss;
  if (!b || !byId('hpfill')) return;
  const pct = bossPct();
  const fill = byId('hpfill');
  fill.style.width = pct + '%';
  fill.dataset.hp = b.hp; fill.dataset.max = b.max;
  fill.className = pct > 50 ? 'ok' : pct > 25 ? 'mid' : 'low';
  byId('hptext').textContent = `${Math.max(0, b.hp)} / ${b.max}`;
  byId('enfill').style.width = Math.min(100, (b.energy / slamAt()) * 100) + '%';
  // the boss talks as it gets hurt
  const phase = b.won ? 'dead' : pct > 85 ? 'start' : pct > 35 ? 'hurt' : 'low';
  if (phase !== b.phase) { b.phase = phase; byId('taunt').textContent = b.taunts[phase]; }
  // the team
  const team = byId('team');
  const have = new Map([...team.children].map((e) => [e.dataset.pid, e]));
  list().forEach((p) => {
    let el = have.get(p.pid);
    if (!el) {
      el = document.createElement('div');
      el.className = 'mate'; el.dataset.pid = p.pid;
      el.innerHTML = html`<span class="av">${avatarHtml(p.avatar)}</span><small class="nm">${p.name}</small>`.__raw;
      team.appendChild(el);
    }
    have.delete(p.pid);
    el.classList.toggle('off', !p.connected);
  });
  have.forEach((e) => e.remove());
  team.classList.toggle('many', list().length > 10);
  team.classList.toggle('crowd', list().length > 18);
  team.classList.toggle('huge', list().length > 36);
  team.parentElement.classList.toggle('packed', list().length > 36);
  // student devices
  if (Date.now() - b.sent > 700 && b.sentHp !== b.hp) {
    b.sent = Date.now(); b.sentHp = b.hp;
    connected().forEach((p) => send(p, { t: 'bh', hp: b.hp, max: b.max }));
  } else if (b.sentHp !== b.hp) {
    G.bossTimer = setTimeout(() => { if (!G) return; G.bossTimer = 0; updateBoss(); }, 400);
  }
}

let lastHitSound = 0;
function arenaHit(p, dmg) {
  const layer = byId('dmglayer');
  if (!layer) return;
  const img = byId('bossimg');
  if (img) { img.classList.remove('hit'); void img.offsetWidth; img.classList.add('hit'); }
  if (layer.children.length < 9) {
    const d = document.createElement('div');
    d.className = 'dmg'; d.textContent = '-' + dmg; d.style.left = 15 + Math.random() * 65 + '%';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  const m = byId('team') && byId('team').querySelector(`[data-pid="${CSS.escape(p.pid)}"]`);
  if (m) { m.classList.remove('swing'); void m.offsetWidth; m.classList.add('swing'); }
  if (Date.now() - lastHitSound > 140) { lastHitSound = Date.now(); sfx.hit(); }
}
function arenaSlam(n) {
  const t = byId('slamtext'); const img = byId('bossimg'); const layer = byId('dmglayer');
  if (t) { t.textContent = 'MEGA SLAM!'; t.hidden = false; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); setTimeout(() => { if (t) t.hidden = true; }, 1500); }
  if (img) { img.classList.remove('slam'); void img.offsetWidth; img.classList.add('slam'); }
  if (layer) { const d = document.createElement('div'); d.className = 'dmg big'; d.textContent = '-' + n; d.style.left = '40%'; layer.appendChild(d); setTimeout(() => d.remove(), 1200); }
  sfx.jackpot();
}
function arenaDefeat() {
  const w = byId('bosswrap');
  if (w) w.classList.add('defeated');
  updateBoss();
  confetti(3500); sfx.win();
}

actions['h-rematch'] = () => {
  if (!G) return;
  const quiz = G.baseQuiz;
  stopHosting();
  nav.setup(quiz);
};

// ---------- The end ----------
function endMsg(p) {
  const b = G.boss;
  return {
    t: 'end', rank: p.rank, of: G.players.size, score: p.score, correct: p.correct, total: nQ(), mode: G.mode,
    boss: b ? { id: b.id, name: b.name, short: b.short, won: b.won, pct: b.max ? Math.round((b.hp / b.max) * 100) : 0 } : undefined,
  };
}

function finishGame() {
  clearInterval(G.ticker); clearTimeout(G.allTimer); clearAuto();
  G.phase = 'end';
  const l = ranked();
  connected().forEach((p) => send(p, endMsg(p)));
  renderPodium(l);
}

function awardsFor(l) {
  const out = [];
  const streak = l.slice().sort((a, b) => b.bestStreak - a.bestStreak)[0];
  if (streak && streak.bestStreak >= 3) out.push({ icon: 'flame', text: `Best streak: ${streak.name} (${streak.bestStreak} right in a row)` });
  const thief = l.slice().sort((a, b) => b.stoleCoins - a.stoleCoins)[0];
  if (G.mode === 'gates' && thief && thief.stoleCoins > 0) out.push({ icon: 'mask', text: `Master thief: ${thief.name} (${thief.stoleCoins} coins stolen)` });
  if (G.boss && G.boss.won && G.boss.lastHit) out.push({ icon: 'trophy', text: `Final blow: ${G.boss.lastHit}` });
  if (G.boss && G.boss.slams) out.push({ icon: 'pencil', text: `${G.boss.slams} Mega ${G.boss.slams === 1 ? 'Slam' : 'Slams'} from team power` });
  return out;
}

function renderPodium(l, quiet = false) {
  const [a, b, c] = l;
  const spot = (p, place) => (p ? html`
    <div class="spot spot-${place}">
      <div class="spot-av">${avatarHtml(p.avatar)}</div><div class="spot-nm">${p.name}</div><div class="spot-sc">${p.score}${G.mode === 'boss' ? ' damage' : ''}</div>
      <div class="step">${medalImg(place)}<span>${place}</span></div>
    </div>` : html`<div class="spot spot-${place} empty"></div>`);
  setScreen('screen host v-podium', html`
    <header class="topbar">
      <div class="chip">${G.quiz.emoji} ${G.quiz.title}</div>
      <div class="row">
        ${l.length ? html`<button class="btn btn-pink" data-action="h-story">${icon('book')} Story time!</button>` : ''}
        ${G.stats.q.size ? html`<button class="btn btn-mint" data-action="h-report">${icon('trophy')} Skills report</button>` : ''}
        <button class="btn btn-sky" data-action="h-csv">Download results</button>
        <button class="btn btn-sun" data-action="h-rematch">${G.boss ? 'Rematch' : 'Play again'}</button>
        <button class="btn" data-action="h-exit">Finish</button>
      </div>
    </header>
    <main class="podium-main">
      <h1>${G.boss ? (G.boss.won ? 'Victory!' : 'So close!') : l.length ? 'Great game!' : 'Game over'}</h1>
      ${G.boss ? html`<p class="boss-banner ${G.boss.won ? 'win' : 'lose'}"><img src="assets/bosses/${G.boss.id}.png" alt="">
        <span>${G.boss.won ? `The class defeated ${G.boss.name}!` : `${G.boss.name} got away with ${bossPct()}% health left. Try again!`}</span></p>` : ''}
      <div class="podium">${spot(b, 2)}${spot(a, 1)}${spot(c, 3)}</div>
      ${awardsFor(l).length ? html`<ul class="awards">${awardsFor(l).map((w) => html`<li>${icon(w.icon)}<span>${w.text}</span></li>`)}</ul>` : ''}
      ${l.length > 3 ? html`
        <ol class="rest" start="4">${l.slice(3).map((p) => html`
          <li><span class="av">${avatarHtml(p.avatar)}</span><span class="nm">${p.name}</span><b>${p.score}</b></li>`)}
        </ol>` : ''}
    </main>`);
  if (l.length && !quiet) { confetti(); sfx.win(); }
}

// ---------- Story Time Finale ----------
function storyMsg() {
  const st = G.story; const i = G.storyPage; const n = st.pages.length;
  if (i >= n) return { t: 'sp', i, n: n + 1, title: st.title, detective: st.detective, text: '', cast: [] };
  return { t: 'sp', i, n: n + 1, title: st.title, text: st.pages[i].text, cast: st.pages[i].cast.map((p) => p.avatar) };
}

function storyOptions() {
  return { mode: G.mode, bigSteal: G.bigSteal, avoid: G.story ? G.story.plot : undefined, prefer: G.boss && G.boss.id === 'gobbler' && !G.story ? 0 : undefined };
}

actions['h-story'] = () => {
  if (!G || G.phase !== 'end' || !list().length) return;
  if (!G.story) G.story = buildStory(ranked(), storyOptions());
  G.storyPage = 0; G.storyOn = true;
  renderStory();
};
actions['h-story-again'] = () => {
  if (!G || !G.story) return;
  stopSpeaking();
  G.story = buildStory(ranked(), storyOptions());
  G.storyPage = 0;
  renderStory();
};
actions['h-story-go'] = ({ d }) => {
  if (!G || !G.storyOn) return;
  stopSpeaking();
  G.storyPage = Math.max(0, Math.min(G.story.pages.length, G.storyPage + Number(d)));
  renderStory();
};
actions['h-story-read'] = () => {
  if (!G || !G.story) return;
  const m = storyMsg();
  speak(m.detective ? 'Story Detective. ' + m.detective.join(' ') : m.text);
};
actions['h-story-done'] = () => {
  if (!G) return;
  stopSpeaking();
  G.storyOn = false;
  connected().forEach((p) => send(p, { t: 'sx' }));
  renderPodium(ranked(), true);
};

function renderStory() {
  const st = G.story; const i = G.storyPage; const n = st.pages.length;
  const onDetective = i >= n;
  const page = onDetective ? null : st.pages[i];
  setScreen('screen host v-story', html`
    <header class="topbar">
      <button class="btn btn-ghost" data-action="h-story-done">&larr; Back to podium</button>
      <div class="chip">${icon('book')} Story time</div>
      <div class="row">
        <button class="btn btn-ghost" data-action="h-story-again">Another story</button>
        ${canSpeak() ? html`<button class="btn btn-sky" data-action="h-story-read">Read to us</button>` : ''}
      </div>
    </header>
    <main class="story-main">
      <h1 class="story-title">${st.title}</h1>
      ${onDetective
        ? html`<section class="story-text detective"><h2>${icon('book')} Story Detective</h2><ol>${st.detective.map((q) => html`<li>${q}</li>`)}</ol></section>`
        : html`<div class="cast">${page.cast.map((p) => html`<div class="cm">${avatarHtml(p.avatar)}<span>${p.name}</span></div>`)}</div>
               <p class="story-text">${storyHtml(page.text)}</p>`}
      <div class="story-nav">
        <button class="btn" data-action="h-story-go" data-d="-1" ${i === 0 ? 'disabled' : ''}>&larr; Back</button>
        <span class="story-count">${i + 1} of ${n + 1}</span>
        ${i < n ? html`<button class="btn btn-pink" data-action="h-story-go" data-d="1">${i === n - 1 ? 'Story Detective' : 'Next'} &rarr;</button>`
                : html`<button class="btn btn-pink" data-action="h-story-done">Back to podium</button>`}
      </div>
    </main>`);
  connected().forEach((p) => send(p, storyMsg()));
}

document.addEventListener('keydown', (e) => {
  if (!G || !G.storyOn || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
  if (e.target.closest && e.target.closest('input, select, textarea')) return;
  actions['h-story-go']({ d: e.key === 'ArrowRight' ? 1 : -1 });
});

// ---------- Skills report ----------
const safeName = () => G.quiz.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'quiz';

function currentReport() {
  return buildReport(G.stats, list().map((p) => ({ name: p.name, attempts: p.attempts, right: p.right })));
}

actions['h-report'] = () => { if (G && G.phase === 'end') renderReport(); };
actions['h-report-back'] = () => { if (G) renderPodium(ranked(), true); };
actions['h-print'] = () => window.print();
actions['h-report-csv'] = () => {
  if (!G || !G.report) return;
  downloadFile(`${safeName()}-skills-report.csv`, reportCsv(G.report), 'text/csv');
};
// Turn the questions the class missed into a brand new quiz and open its setup screen.
actions['h-review'] = () => {
  if (!G || !G.report) return;
  const qs = G.report.review.slice(0, 12)
    .map((rq) => G.quiz.questions.find((q) => q.text === rq.text)).filter(Boolean)
    .map(({ _i, ...q }) => q);
  if (!qs.length) return;
  const quiz = { id: 'review-' + uid(), title: `${G.quiz.title}: Review`, emoji: G.quiz.emoji, grade: G.quiz.grade || '',
    desc: 'The questions your class missed.', questions: qs };
  registerTemp(quiz);
  stopHosting();
  nav.setup(quiz);
};

function renderReport() {
  const r = currentReport();
  G.report = r;
  const students = list().filter((p) => p.attempts > 0).length;
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  setScreen('screen host v-report', html`
    <header class="topbar no-print">
      <button class="btn btn-ghost" data-action="h-report-back">&larr; Back to podium</button>
      <div class="chip">${icon('trophy')} Skills report</div>
      <div class="row">
        ${r.review.length ? html`<button class="btn btn-pink" data-action="h-review">Play the missed questions</button>` : ''}
        <button class="btn btn-sky" data-action="h-print">Print</button>
        <button class="btn" data-action="h-report-csv">Download CSV</button>
      </div>
    </header>
    <main class="report">
      <h1>${icon('trophy')} Skills report</h1>
      <p class="report-meta">${G.quiz.title}, ${date}. ${students} ${students === 1 ? 'student' : 'students'} gave ${r.attempts} answers.
        <b>${r.overall}% right overall.</b></p>

      <section class="card rsec">
        <h2>Skills, weakest first</h2>
        ${r.skills.length ? html`<ul class="sklist">${r.skills.map((s) => html`
          <li class="skrow">
            <span class="skname">${s.skill}</span>
            <span class="skbar" aria-hidden="true"><i class="b-${s.band}" style="width:${Math.max(3, s.pct)}%"></i></span>
            <b class="skpct">${s.pct}%</b>
            <span class="tag tag-${s.band}">${BAND_LABEL[s.band]}</span>
            <small>${s.right} of ${s.attempts} right</small>
          </li>`)}</ul>`
          : html`<p class="hint">These questions do not have skills yet. In the quiz maker, add a skill to each question (like "Main idea" or "Similes") and this list will group your class's results by skill.</p>`}
      </section>

      <section class="card rsec">
        <h2>Questions to review</h2>
        ${r.review.length ? html`<div class="qrevs">${r.review.slice(0, 8).map((q) => html`
          <article class="qrev">
            <div class="qrev-head"><b class="qpct tag-${q.band}">${q.pct}%</b><p>${q.text}</p></div>
            <p>Right answer: <b>${q.correctText}</b></p>
            ${q.topWrong ? html`<p>Most picked wrong answer: <b>${q.topWrong.text}</b> (${q.topWrong.n} ${q.topWrong.n === 1 ? 'answer' : 'answers'})</p>` : ''}
            ${q.none ? html`<p class="hint">${q.none} did not answer in time.</p>` : ''}
            ${q.skill ? html`<span class="skchip">${q.skill}</span>` : ''}
          </article>`)}</div>`
          : html`<div class="allgood">${pose('cheer')}<p>${r.attempts ? 'Everyone did great! No question needs a second look.' : 'No answers were recorded in this game.'}</p></div>`}
      </section>

      ${r.checkIn.length ? html`
      <section class="card rsec">
        <h2>Students to check in with</h2>
        <ul class="chips">${r.checkIn.map((c) => html`<li>${c.name} <small>${c.pct}% of ${c.attempts}</small></li>`)}</ul>
        <p class="hint">Under ${CHECK_IN_BELOW}% right after ${CHECK_IN_MIN_ANSWERS} or more answers. ${G.opts.names === 'random' ? 'Random names are on, so these are not real student names.' : ''}</p>
      </section>` : ''}

      <p class="hint no-print">This report is not saved anywhere. Print it or download the CSV before you close this page.</p>
    </main>`);
}

actions['h-csv'] = () => {
  if (!G) return;
  const rows = [['Rank', 'Name', 'Score', 'Questions correct', 'Total questions']];
  ranked().forEach((p) => rows.push([p.rank, p.name, p.score, p.correct, nQ()]));
  downloadFile(`${safeName()}-results.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv');
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
