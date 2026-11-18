// The student's side: join a game, answer questions on their own device.

import {
  html, setScreen, byId, actions, nav, pick, sfx, confetti, shapeIcon, mascot, uid, session, mmss,
  isMuted, setSoundRole,
} from './util.js';
import { connectToGame, friendlyError } from './transport.js';

const KEY = 'quizparty.player';
const PRAISE = ['Nice!', 'You got it!', 'Awesome!', 'Brilliant!', 'Yes!', 'Great job!'];
const OOPS = ['So close!', 'Almost!', 'Good try!', 'Oops!'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let S = null; // current player session

// ---------- Joining ----------
export async function joinGame({ pin, name, avatar, pid, quiet = false }) {
  setSoundRole('player');
  setScreen('screen center', html`<div class="loading">${mascot('bob')}<p>Joining game ${pin}...</p></div>`);
  let transport;
  try {
    transport = await connectToGame(pin);
  } catch (e) {
    session.del(KEY);
    return nav.home({ pin, name, avatar, error: quiet ? '' : friendlyError(e) });
  }
  attach(transport, { pin, name, avatar, pid: pid || uid() });
}

function attach(transport, info) {
  teardown();
  S = { ...info, transport, mode: 'live', title: '', phase: 'joining', timers: [], left: false, ended: false, reconnecting: false };
  transport.onMessage = onMsg;
  transport.onClose = onLost;
  transport.send({ t: 'join', pid: S.pid, name: S.name, avatar: S.avatar });
  const me = S;
  setTimeout(() => { if (S === me && me.phase === 'joining') leaveWith('We could not get into that game. Check the PIN and try again.'); }, 8000);
}

function teardown() {
  if (!S) return;
  S.timers.forEach(clearInterval);
  S.left = true;
  try { S.transport && S.transport.close(); } catch { /* ignore */ }
  S = null;
}

function leaveWith(error) {
  const keep = S && { pin: S.pin, name: S.name, avatar: S.avatar };
  session.del(KEY);
  teardown();
  nav.home({ ...keep, error });
}

export function leaveGame() { session.del(KEY); teardown(); }

// Auto rejoin if the student refreshed the page.
export function resumeSession() {
  const saved = session.get(KEY);
  if (!saved || !saved.pin || !saved.name) return false;
  joinGame({ ...saved, quiet: true });
  return true;
}

// ---------- Connection trouble ----------
function onLost() {
  if (!S || S.left || S.ended || S.reconnecting) return;
  S.reconnecting = true;
  S.timers.forEach(clearInterval); S.timers = [];
  setScreen('screen center', html`<div class="loading">${mascot('bob')}<h1>Oops, we lost the connection</h1><p>Trying to get you back in the game...</p></div>`);
  reconnect(S);
}

async function reconnect(me) {
  for (let i = 0; i < 14; i++) {
    await sleep(2500);
    if (S !== me || me.left) return;
    try {
      const t = await connectToGame(me.pin);
      if (S !== me || me.left) { t.close(); return; }
      me.transport = t; me.reconnecting = false;
      t.onMessage = onMsg; t.onClose = onLost;
      t.send({ t: 'join', pid: me.pid, name: me.name, avatar: me.avatar });
      return;
    } catch { /* keep trying */ }
  }
  if (S === me) leaveWith('We could not find the game again. It may be over.');
}

// ---------- Messages from the host ----------
function onMsg(m) {
  if (!S || !m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'welcome':
      Object.assign(S, { pid: m.pid, name: m.name, avatar: m.avatar, mode: m.mode, title: m.title, phase: 'lobby' });
      session.set(KEY, { pin: S.pin, name: S.name, avatar: S.avatar, pid: S.pid });
      sfx.join();
      renderWaiting();
      break;
    case 'rej':
      leaveWith(m.reason === 'taken' ? 'Someone is already using that name. Try another one!'
        : m.reason === 'full' ? 'That game is full.' : 'Please pick a nickname.');
      break;
    case 'wait': renderWaiting(m.text); break;
    case 'q': S.phase = 'question'; S.q = m; S.chosen = null; S.qEnds = Date.now() + m.left * 1000; renderQuestion(); break;
    case 'ack': S.chosen = m.c; renderLocked(); break;
    case 'r': S.phase = 'result'; renderResult(m); break;
    case 'rs': S.race = { total: m.total, ends: Date.now() + m.secs * 1000 }; S.phase = 'race'; break;
    case 'rq': S.rq = m; S.rpick = null; S.rfb = null; renderRaceQ(); break;
    case 'rr': S.rfb = m; renderRaceQ(); break;
    case 'rf': renderRaceDone(m); break;
    case 'end': S.ended = true; S.phase = 'end'; renderEnd(m); break;
    case 'kick': S.ended = true; session.del(KEY); renderMessage('👋', 'You were removed from the game', 'Ask your teacher if that was a mistake.'); break;
    case 'bye': S.ended = true; session.del(KEY); renderMessage('🎈', 'The game has ended', 'Thanks for playing!'); break;
    default: break;
  }
}

// ---------- Screens ----------
const header = (extra) => html`
  <header class="pbar">
    <span class="who"><span class="av">${S.avatar}</span><span class="nm">${S.name}</span></span>
    ${extra || ''}
    <button class="btn btn-ghost sm" data-action="mute" aria-label="Toggle sound">${isMuted() ? '🔇' : '🔊'}</button>
  </header>`;

function renderMessage(emoji, title, text) {
  setScreen('screen player center', html`
    <div class="card narrow center-text">
      <div class="bigemoji">${emoji}</div><h1>${title}</h1><p>${text}</p>
      <button class="btn btn-sky" data-action="p-home">Back to home</button>
    </div>`);
}

function renderWaiting(text) {
  S.timers.forEach(clearInterval); S.timers = [];
  setScreen('screen player wait', html`
    ${header()}
    <main class="center-col">
      <div class="avatar-big bob">${S.avatar}</div>
      <h1>${S.name}</h1>
      <p class="lead">${text || "You're in! Look at the big screen."}</p>
      <p class="hint">${S.title}</p>
    </main>
    <footer class="pfoot"><button class="btn btn-ghost sm" data-action="p-leave">Leave game</button></footer>`);
}

function optButton(text, i, cls = '', attrs = '') {
  return html`<button class="opt opt-${i} ${cls}" data-action="p-pick" data-c="${i}" ${attrs}>
    <span class="badge">${shapeIcon(i)}</span><span class="otext">${text}</span></button>`;
}

function renderQuestion() {
  S.timers.forEach(clearInterval); S.timers = [];
  const m = S.q;
  setScreen('screen player question', html`
    ${header(html`<span class="chip">${m.i + 1} / ${m.n}</span>`)}
    <h1 class="pq">${m.text}</h1>
    <div class="popts">${m.options.map((o, i) => optButton(o, i))}</div>
    <div class="timebar" aria-hidden="true"><i id="tbar"></i></div>`);
  const total = m.limit * 1000;
  const upd = () => {
    const bar = byId('tbar');
    if (!bar) return;
    bar.style.width = Math.max(0, Math.min(100, ((S.qEnds - Date.now()) / total) * 100)) + '%';
  };
  upd();
  S.timers.push(setInterval(upd, 200));
}

actions['p-pick'] = ({ c }) => {
  if (!S) return;
  const i = Number(c);
  if (S.phase === 'question') {
    if (S.chosen != null) return;
    S.chosen = i;
    S.transport.send({ t: 'a', i: S.q.i, c: i });
    sfx.click();
    renderLocked();
  } else if (S.phase === 'race') {
    if (!S.rq || S.rpick != null || S.rfb) return;
    S.rpick = i;
    S.transport.send({ t: 'ra', s: S.rq.s, c: i });
    sfx.click();
    renderRaceQ();
  }
};

function renderLocked() {
  S.timers.forEach(clearInterval); S.timers = [];
  const m = S.q;
  if (!m || S.chosen == null) return;
  setScreen('screen player locked', html`
    ${header(html`<span class="chip">${m.i + 1} / ${m.n}</span>`)}
    <main class="center-col">
      <div class="locked-tile opt opt-${S.chosen}"><span class="badge">${shapeIcon(S.chosen)}</span><span class="otext">${m.options[S.chosen]}</span></div>
      <h1>Locked in!</h1>
      <p class="lead">Waiting for everyone else...</p>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </main>`);
}

function renderResult(m) {
  S.timers.forEach(clearInterval); S.timers = [];
  if (m.ok) sfx.correct(); else sfx.wrong();
  setScreen(`screen player result ${m.ok ? 'ok' : 'no'}`, html`
    ${header()}
    <main class="center-col">
      <div class="bigemoji pop">${m.ok ? '🎉' : m.none ? '⏰' : '💫'}</div>
      <h1>${m.ok ? pick(PRAISE) : m.none ? "Time's up!" : pick(OOPS)}</h1>
      ${m.ok ? html`<p class="gain">+${m.gain}</p>` : html`<p class="lead">The answer was<br><b>${m.correctText}</b></p>`}
      ${m.streak >= 2 ? html`<p class="streak-note">🔥 ${m.streak} in a row!</p>` : ''}
      <div class="stats">
        <div><span>Rank</span><b>#${m.rank}</b></div>
        <div><span>Score</span><b>${m.score}</b></div>
      </div>
    </main>`);
}

// ----- Race mode -----
function renderRaceQ() {
  S.timers.forEach(clearInterval); S.timers = [];
  const m = S.rq; const fb = S.rfb;
  if (!m) return;
  const done = fb ? fb.done : m.done;
  const score = fb ? fb.score : m.score;
  const streak = fb ? fb.streak : m.streak;
  const pct = Math.round((done / m.total) * 100);
  const state = (i) => {
    if (!fb) return S.rpick === i ? 'picked' : (S.rpick != null ? 'dim' : '');
    if (i === fb.correct) return 'right';
    if (i === S.rpick && !fb.ok) return 'wrong';
    return 'dim';
  };
  setScreen('screen player question race', html`
    ${header(html`<span class="chip">🪙 ${score}</span><span class="clock" id="rclock"></span>`)}
    <div class="progress" aria-label="${done} of ${m.total} done"><i style="width:${pct}%"></i><span>${done} / ${m.total}</span></div>
    <h1 class="pq">${m.text}</h1>
    <div class="popts">${m.options.map((o, i) => optButton(o, i, state(i), S.rpick != null || fb ? 'disabled' : ''))}</div>
    <div class="feedback">
      ${fb ? (fb.ok
        ? html`<b class="good">${fb.finished ? 'You finished the race!' : pick(PRAISE)} +${fb.gain + fb.bonus}</b>${streak >= 3 ? html` <span>🔥 ${streak}</span>` : ''}`
        : html`<b class="bad">Not quite! That one will come back around.</b><button class="btn btn-sky" data-action="p-next">Got it</button>`)
        : (S.rpick != null ? html`<span class="hint">Checking...</span>` : '')}
    </div>`);
  const tick = () => { const c = byId('rclock'); if (c && S.race) c.textContent = mmss((S.race.ends - Date.now()) / 1000); };
  tick();
  S.timers.push(setInterval(tick, 500));
  if (fb) { if (fb.ok) sfx.correct(); else sfx.wrong(); }
  if (fb && fb.ok) {
    const me = S;
    S.timers.push(setTimeout(() => { if (S === me && S.rfb === fb) actions['p-next'](); }, 900));
  }
}

actions['p-next'] = () => {
  if (!S || !S.rfb) return;
  const fb = S.rfb;
  S.rfb = null; S.rq = null; // the next question replaces this screen
  S.transport.send({ t: 'rn' });
  if (!fb.finished) {
    setScreen('screen player center', html`<div class="loading">${mascot('bob')}</div>`);
  }
};

function renderRaceDone(m) {
  S.timers.forEach(clearInterval); S.timers = [];
  setScreen('screen player result ok', html`
    ${header()}
    <main class="center-col">
      <div class="bigemoji pop">🏁</div>
      <h1>You finished!</h1>
      <p class="lead">${m.place ? `You crossed the finish line in place #${m.place}.` : 'You crossed the finish line.'}</p>
      <div class="stats"><div><span>Coins</span><b>${m.score}</b></div></div>
      <p class="hint">Waiting for the race to end...</p>
    </main>`);
  if (m.place && m.place <= 3) confetti(2500);
  sfx.win();
}

function renderEnd(m) {
  S.timers.forEach(clearInterval); S.timers = [];
  const medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : '⭐';
  const title = m.rank === 1 ? 'You won!' : m.rank <= 3 ? 'You made the podium!' : 'Great job!';
  setScreen('screen player result ok', html`
    ${header()}
    <main class="center-col">
      <div class="bigemoji pop">${medal}</div>
      <h1>${title}</h1>
      <p class="lead">You finished <b>#${m.rank}</b> of ${m.of}</p>
      <div class="stats">
        <div><span>Score</span><b>${m.score}</b></div>
        <div><span>Correct</span><b>${m.correct}/${m.total}</b></div>
      </div>
      <button class="btn btn-sky" data-action="p-home">Back to home</button>
    </main>`);
  if (m.rank <= 3) { confetti(); sfx.win(); }
}

actions['p-home'] = () => { leaveGame(); nav.home(); };
actions['p-leave'] = () => { if (confirm('Leave this game?')) { leaveGame(); nav.home(); } };
