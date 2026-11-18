// Storybook Arcade: home screen, join form, quiz library and game setup. Everything else lives in
// host.js (teacher), player.js (students) and editor.js (quiz maker).

import {
  html, setScreen, app, actions, nav, byId, toast, mascot, AVATARS, avatarHtml, avatarName, preloadBuddies, preloadArt, icon, pick, store, session, toggleMute, sfx,
} from './util.js';
import { APP_NAME, BYLINE } from './config.js';
import { allQuizzes, findQuiz, copyOf, blankQuiz, deleteMine, normalizeQuiz, upsertMine, loadMine } from './quizzes.js';
import { openEditor } from './editor.js';
import { BOSSES } from './bosses.js';
import { runCheck, hasWebRTC } from './check.js';
import { relayConfigured } from './relay.js';
import { hostGame, DEFAULT_OPTS } from './host.js';
import { joinGame, resumeSession, leaveGame } from './player.js';

// ---------- Home and join ----------
let chosenAvatar = '';

// The Storybook Arcade scene, with three random buddies standing in it.
function heroScene() {
  const spots = [
    { x: 8, b: 17, w: 23 },    // beside the arcade cabinet
    { x: 45, b: 4, w: 19 },    // on the rug
    { x: 90, b: 17, w: 23 },   // beside the bookshelf
  ];
  const picks = [...AVATARS].sort(() => Math.random() - 0.5).slice(0, spots.length);
  return html`
    <div class="hero" aria-hidden="true">
      <img class="hero-scene" src="assets/hero.png" alt="" draggable="false">
      ${spots.map((s, i) => html`<span class="hb" style="--x:${s.x}%;--b:${s.b}%;--w:${s.w}%;--d:${i * 0.4}s">${avatarHtml(picks[i])}</span>`)}
    </div>`;
}

function renderHome(opts = {}) {
  const profile = store.get('quizparty.profile', {}) || {};
  const params = new URLSearchParams(location.search);
  const pin = opts.pin || params.get('pin') || '';
  const name = opts.name ?? profile.name ?? '';
  const remembered = opts.avatar || profile.avatar;
  chosenAvatar = AVATARS.includes(remembered) ? remembered : pick(AVATARS);
  setScreen('screen v-home', html`
    <main class="home">
      <div class="brand">
        ${heroScene()}
        <h1 class="logo">${APP_NAME}</h1>
        <p class="byline">${BYLINE}</p>
      </div>
      <form class="card join-form" id="join-form" novalidate autocomplete="off">
        <h2>Join a game</h2>
        <label class="field"><span>Game PIN</span>
          <input id="pin-in" class="pin-in" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456" value="${pin}" aria-describedby="join-err"></label>
        <label class="field"><span>Your nickname</span>
          <input id="name-in" maxlength="14" placeholder="Star Reader" value="${name}" autocapitalize="words" aria-describedby="name-hint"></label>
        <p class="hint tight" id="name-hint">Your teacher might give you a fun name instead.</p>
        <div class="field"><span id="av-label">Pick your buddy</span>
          <div class="avatars" role="radiogroup" aria-labelledby="av-label">
            ${AVATARS.map((a) => html`<button type="button" class="avbtn ${a === chosenAvatar ? 'on' : ''}" role="radio" aria-checked="${a === chosenAvatar}" data-action="pick-av" data-av="${a}" aria-label="${avatarName(a)}">${avatarHtml(a)}</button>`)}
          </div></div>
        <p class="error" id="join-err" role="alert">${opts.error || ''}</p>
        ${opts.check ? html`<p class="trouble"><button type="button" class="linkbtn" data-action="to-check">Run a connection check</button> to find out what is wrong.</p>` : ''}
        <button class="btn btn-pink btn-lg" type="submit">Let's play!</button>
      </form>
      <button class="btn btn-sky" data-action="to-library">Teachers: host a game</button>
      <footer class="foot">Made with love for reading fun by <a href="https://msgamification.com" target="_blank" rel="noopener">Ms. Gamification</a>
        <br><button type="button" class="linkbtn small" data-action="to-check">Trouble connecting? Run a connection check</button></footer>
    </main>`);
  // Only auto-focus on computers. On phones and tablets it would pop the keyboard over the page.
  if (window.matchMedia && matchMedia('(pointer: fine)').matches) (pin ? byId('name-in') : byId('pin-in')).focus({ preventScroll: true });
}
nav.home = renderHome;

actions['pick-av'] = ({ av }, el) => {
  chosenAvatar = av;
  document.querySelectorAll('.avbtn').forEach((b) => {
    const on = b === el;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on);
  });
};

function submitJoin() {
  const pin = byId('pin-in').value.replace(/\D/g, '');
  const name = byId('name-in').value.replace(/\s+/g, ' ').trim();
  const err = byId('join-err');
  if (pin.length !== 6) { err.textContent = 'The game PIN is 6 numbers.'; byId('pin-in').focus(); return; }
  err.textContent = '';
  store.set('quizparty.profile', { name, avatar: chosenAvatar });
  sfx.click();
  joinGame({ pin, name, avatar: chosenAvatar });
}

// ---------- Quiz library (teacher) ----------
function quizCard(qz) {
  return html`
    <article class="card qlib">
      <div class="qlib-emoji" aria-hidden="true">${qz.emoji}</div>
      <h3>${qz.title}</h3>
      <p class="qlib-desc">${qz.desc || ''}</p>
      <p class="meta">${qz.questions.length} questions${qz.grade ? ', Grades ' + qz.grade : ''}</p>
      <div class="row">
        <button class="btn btn-pink" data-action="lib-play" data-id="${qz.id}">Play</button>
        <button class="btn" data-action="lib-edit" data-id="${qz.id}">${qz.builtin ? 'Copy and edit' : 'Edit'}</button>
        ${qz.builtin ? '' : html`<button class="btn btn-ghost sm" data-action="lib-delete" data-id="${qz.id}">Delete</button>`}
      </div>
    </article>`;
}

function renderLibrary() {
  const mine = loadMine();
  setScreen('screen v-library', html`
    <header class="topbar">
      <button class="btn btn-ghost" data-action="to-home">&larr; Home</button>
      <h1 class="h-small">Pick a quiz</h1>
      <div class="row">
        <button class="btn btn-sky" data-action="lib-import">Import</button>
        <button class="btn btn-pink" data-action="lib-new">+ New quiz</button>
      </div>
    </header>
    <input type="file" id="imp" accept=".json,application/json" hidden>
    <main class="lib">
      <section>
        <h2>Ready to play</h2>
        <div class="lib-grid">${allQuizzes().filter((x) => x.builtin).map(quizCard)}</div>
      </section>
      <section>
        <h2>My quizzes</h2>
        ${mine.length
          ? html`<div class="lib-grid">${mine.map(quizCard)}</div>`
          : html`<p class="hint">Quizzes you make or import show up here. They are saved on this device, so use Export to keep a copy.</p>`}
      </section>
    </main>`);
}
nav.library = renderLibrary;
nav.setup = (quiz) => renderSetup(quiz);

actions['to-home'] = () => renderHome();
actions['to-library'] = () => renderLibrary();
actions['lib-new'] = () => openEditor(blankQuiz());
actions['lib-edit'] = ({ id }) => {
  const qz = findQuiz(id);
  if (qz) openEditor(qz.builtin ? copyOf(qz) : qz);
};
actions['lib-delete'] = ({ id }) => {
  const qz = findQuiz(id);
  if (qz && confirm(`Delete "${qz.title}"? This cannot be undone.`)) { deleteMine(id); renderLibrary(); }
};
actions['lib-import'] = () => byId('imp').click();

async function importFile(file) {
  try {
    if (file.size > 2_000_000) throw new Error('big');
    const r = normalizeQuiz(JSON.parse(await file.text()));
    if (r.error) return toast(r.error);
    const quiz = { ...r.quiz, id: findQuiz(r.quiz.id) ? copyOf(r.quiz).id : r.quiz.id };
    upsertMine(quiz);
    toast(`Imported "${quiz.title}"`);
    renderLibrary();
  } catch {
    toast('That file did not work. Use a quiz file saved with Export.');
  }
}

// ---------- Game setup ----------
const HOSTOPTS_KEY = 'quizparty.hostopts';

function renderSetup(quiz) {
  const o = { ...DEFAULT_OPTS, ...(store.get(HOSTOPTS_KEY, {}) || {}) };
  const sel = (v, cur) => (String(v) === String(cur) ? 'selected' : '');
  setScreen('screen v-setup', html`
    <header class="topbar"><button class="btn btn-ghost" data-action="to-library">&larr; Back</button></header>
    <main class="setup">
      <div class="setup-title"><span class="qlib-emoji">${quiz.emoji}</span><h1>${quiz.title}</h1></div>
      <p class="hint">${quiz.questions.length} questions</p>
      <form id="setup-form" data-id="${quiz.id}">
        <fieldset class="modes">
          <legend>Choose a game mode</legend>
          <label class="modecard"><input type="radio" name="mode" value="live" checked>
            <span class="modebody"><span class="modeicon">${icon('joystick')}</span><b>Live Quiz</b>
            <span>Everyone answers together while your big screen leads the way. Faster answers earn more points.</span></span></label>
          <label class="modecard"><input type="radio" name="mode" value="race">
            <span class="modebody"><span class="modeicon">${icon('flag')}</span><b>Race</b>
            <span>Everyone plays at their own speed and races to the finish. Missed questions come back around.</span></span></label>
          <label class="modecard"><input type="radio" name="mode" value="gates">
            <span class="modebody"><span class="modeicon">${icon('mask')}</span><b>Treasure Gates</b>
            <span>Every right answer opens a gate: coins, a shield, a jackpot, or a sneaky steal from a classmate.</span></span></label>
          <label class="modecard"><input type="radio" name="mode" value="boss">
            <span class="modebody"><span class="modeicon"><img class="boss-ico" src="assets/bosses/gobbler.png" alt=""></span><b>Class vs. the Boss</b>
            <span>The whole class teams up to defeat a boss before time runs out. Every right answer is a hit.</span></span></label>
        </fieldset>
        <label class="field" id="race-opts" hidden><span>How long should it last?</span>
          <select name="minutes">${[3, 5, 8, 10, 15].map((m) => html`<option value="${m}" ${m === 5 ? 'selected' : ''}>${m} minutes</option>`)}</select></label>

        <section class="card optcard">
          <h2>Your choices</h2>
          <div id="boss-opts" hidden>
            <label class="field"><span>Which boss?</span>
              <select name="boss">
                <option value="random" ${sel('random', o.boss)}>Surprise me</option>
                ${BOSSES.map((b) => html`<option value="${b.id}" ${sel(b.id, o.boss)}>${b.name}</option>`)}
              </select></label>
            <label class="field"><span>How strong is the boss?</span>
              <select name="strength">
                <option value="easy" ${sel('easy', o.strength)}>Easy: a smaller boss</option>
                <option value="medium" ${sel('medium', o.strength)}>Medium: a good challenge</option>
                <option value="hard" ${sel('hard', o.strength)}>Hard: a big boss that heals when someone misses</option>
              </select></label>
          </div>
          <div id="gate-opts" hidden>
            <label class="check"><input type="checkbox" name="steal" ${o.steal ? 'checked' : ''}>
              <span>Allow stealing. Players can take some coins from a classmate who is ahead of them. A shield blocks it.</span></label>
          </div>
          <label class="field"><span>Student names</span>
            <select name="names">
              <option value="own" ${sel('own', o.names)}>Students type their own nickname</option>
              <option value="random" ${sel('random', o.names)}>Give everyone a fun random name (like "Brave Fox")</option>
            </select></label>
          <div id="live-opts">
            <label class="check"><input type="checkbox" name="devices" ${o.showOnDevices ? 'checked' : ''}>
              <span>Show the questions and answers on student screens too</span></label>
            <label class="field"><span>Leaderboard between questions</span>
              <select name="board">
                <option value="10" ${sel(10, o.boardSize)}>Top 10</option>
                <option value="5" ${sel(5, o.boardSize)}>Top 5</option>
              </select></label>
            <label class="check"><input type="checkbox" name="auto" ${o.auto ? 'checked' : ''}>
              <span>Auto-play: move on by itself after each answer and leaderboard</span></label>
            <label class="field" id="delay-row" ${o.auto ? '' : 'hidden'}><span>Stay on each screen for</span>
              <select name="delay">${[3, 5, 8, 12].map((d) => html`<option value="${d}" ${sel(d, o.delay)}>${d} seconds</option>`)}</select></label>
            <label class="check"><input type="checkbox" name="shuffleQ" ${o.shuffleQ ? 'checked' : ''}>
              <span>Mix up the question order</span></label>
            <label class="check"><input type="checkbox" name="shuffleA" ${o.shuffleA ? 'checked' : ''}>
              <span>Mix up the answer order</span></label>
          </div>
        </section>

        <label class="check"><input type="checkbox" name="local"> <span>Test on this device only. Open this page in another tab to play as a student.</span></label>
        <button class="btn btn-pink btn-lg" type="submit">Open game room</button>
      </form>
    </main>`);
}

function readHostOptions(f) {
  return {
    names: f.elements.names.value === 'random' ? 'random' : 'own',
    showOnDevices: f.elements.devices.checked,
    boardSize: Number(f.elements.board.value) === 5 ? 5 : 10,
    auto: f.elements.auto.checked,
    delay: Number(f.elements.delay.value) || 5,
    shuffleQ: f.elements.shuffleQ.checked,
    shuffleA: f.elements.shuffleA.checked,
    steal: f.elements.steal.checked,
    boss: f.elements.boss.value,
    strength: f.elements.strength.value,
  };
}

actions['lib-play'] = ({ id }) => { const qz = findQuiz(id); if (qz) renderSetup(qz); };

// ---------- Connection check ----------
const checkSteps = () => [
  ...(relayConfigured() ? [['hub', 'Reach the reliable connection', 'Works on almost any school network. Games use this first.']] : []),
  ['broker', 'Reach the connection service', 'The free service that introduces devices to each other.'],
  ['direct', 'Find a direct path between devices', 'Works on some networks when devices are close together.'],
  ['relay', 'Find the backup route', 'Needed when devices are on different networks, like cell data and school Wi-Fi.'],
];
const STATE_ICON = { wait: '⏳', run: '🔎', ok: '✅', bad: '❌' };
let checking = false;

function renderCheck() {
  setScreen('screen v-check', html`
    <header class="topbar"><button class="btn btn-ghost" data-action="to-home">&larr; Back</button><div></div></header>
    <main class="checkpage">
      <h1>Connection check</h1>
      <p class="lead">Live games need a few things to work. This tests them on <b>this device</b>. Run it on a student's phone and on the classroom computer.</p>
      <ol class="checks card">
        ${checkSteps().map(([id, title, why]) => html`
          <li id="ck-${id}"><span class="ck-i">${STATE_ICON.wait}</span><span><b>${title}</b><small>${why}</small></span></li>`)}
      </ol>
      <div id="ck-result" hidden></div>
      <div class="row"><button class="btn btn-pink" id="ck-run" data-action="run-check">Start the check</button></div>
      <p class="hint">Nothing is saved or sent anywhere except the test itself. It takes about 20 seconds.</p>
    </main>`);
  if (!hasWebRTC()) {
    const r = byId('ck-result');
    r.hidden = false;
    r.className = 'verdict bad';
    r.innerHTML = html`<b>This browser can not run live games.</b><p>Try a newer version of Chrome, Safari or Edge.</p>`.__raw;
  }
}
nav.check = renderCheck;

actions['run-check'] = async () => {
  if (checking) return;
  checking = true;
  const btn = byId('ck-run');
  btn.disabled = true; btn.textContent = 'Checking...';
  byId('ck-result').hidden = true;
  checkSteps().forEach(([id]) => { byId('ck-' + id).querySelector('.ck-i').textContent = STATE_ICON.wait; });
  const res = await runCheck((id, state) => { const el = byId('ck-' + id); if (el) el.querySelector('.ck-i').textContent = STATE_ICON[state]; });
  checking = false;
  const r = byId('ck-result');
  if (!r) return;
  r.hidden = false;
  r.className = 'verdict ' + res.verdict.level;
  r.innerHTML = html`<b>${res.verdict.title}</b><p>${res.verdict.text}</p>
    <p class="hint">Results: ${res.hub === null ? '' : `reliable connection ${res.hub ? 'ok' : 'blocked'}, `}service ${res.broker ? 'ok' : 'blocked'}, direct path ${res.direct ? 'ok' : 'blocked'}, backup route ${res.relay ? 'ok' : 'blocked'}.</p>`.__raw;
  btn.disabled = false; btn.textContent = 'Run it again';
};
actions['to-check'] = () => renderCheck();

// ---------- Event wiring ----------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || !app.contains(el)) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el.dataset, el, e);
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'join-form') submitJoin();
  else if (e.target.id === 'setup-form') {
    const f = e.target; const quiz = findQuiz(f.dataset.id);
    if (!quiz) return;
    const opts = readHostOptions(f);
    store.set(HOSTOPTS_KEY, opts); // remember the teacher's choices for next time
    hostGame({
      quiz, mode: f.elements.mode.value, local: f.elements.local.checked,
      minutes: Number(f.elements.minutes.value) || 5, opts,
    });
  }
});

app.addEventListener('change', (e) => {
  if (e.target.name === 'mode') {
    byId('race-opts').hidden = e.target.value === 'live';
    byId('live-opts').hidden = e.target.value !== 'live';
    byId('gate-opts').hidden = e.target.value !== 'gates';
    byId('boss-opts').hidden = e.target.value !== 'boss';
  } else if (e.target.name === 'auto') byId('delay-row').hidden = !e.target.checked;
  else if (e.target.id === 'imp' && e.target.files[0]) { importFile(e.target.files[0]); e.target.value = ''; }
});

app.addEventListener('input', (e) => {
  if (e.target.id === 'pin-in') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
});

actions.mute = (_d, el) => { el.textContent = toggleMute() ? '🔇' : '🔊'; };

// ---------- Start ----------
function start() {
  preloadBuddies();
  preloadArt();
  const wantsPin = new URLSearchParams(location.search).get('pin');
  const saved = session.get('quizparty.player');
  if (saved && wantsPin && saved.pin !== wantsPin) { leaveGame(); }
  else if (resumeSession()) return;
  renderHome();
}
start();
