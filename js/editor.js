// The quiz maker: write your own questions, save them on this device, share them as a file.

import { html, setScreen, actions, byId, toast, shapeIcon, downloadFile, nav, app } from './util.js';
import { normalizeQuiz, upsertMine } from './quizzes.js';

let E = null; // { quiz, dirty }
const TIMES = [10, 15, 20, 30, 45, 60, 90, 120];

export function openEditor(quiz) {
  E = { quiz: JSON.parse(JSON.stringify(quiz)), dirty: false };
  render();
}

app.addEventListener('input', () => { if (E) E.dirty = true; });

function qcard(qq, i, n) {
  const times = [...new Set([...TIMES, qq.time])].sort((a, b) => a - b);
  return html`
  <section class="card qcard" data-qi="${i}">
    <div class="qcard-head">
      <b>Question ${i + 1}</b>
      <span class="row">
        <button class="btn btn-ghost sm" data-action="e-up" data-i="${i}" aria-label="Move question up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
        <button class="btn btn-ghost sm" data-action="e-down" data-i="${i}" aria-label="Move question down" ${i === n - 1 ? 'disabled' : ''}>&darr;</button>
        <button class="btn btn-ghost sm" data-action="e-del" data-i="${i}" ${n <= 1 ? 'disabled' : ''}>Delete</button>
      </span>
    </div>
    <textarea class="q-text" rows="2" maxlength="300" placeholder="Type your question here" aria-label="Question ${i + 1} text">${qq.text}</textarea>
    <p class="hint">Fill in 2 to 4 answers. Tap the circle next to the right one.</p>
    <div class="e-opts">
      ${[0, 1, 2, 3].map((k) => html`
      <label class="e-opt opt-${k}">
        <input type="radio" name="correct-${i}" value="${k}" aria-label="Answer ${'ABCD'[k]} is correct" ${qq.correct === k ? 'checked' : ''}>
        <span class="badge">${shapeIcon(k)}</span>
        <input type="text" class="o-text" maxlength="120" value="${qq.options[k] || ''}" placeholder="Answer ${'ABCD'[k]}" aria-label="Answer ${'ABCD'[k]}">
      </label>`)}
    </div>
    <label class="field inline"><span>Time to answer</span>
      <select class="q-time">${times.map((t) => html`<option value="${t}" ${t === qq.time ? 'selected' : ''}>${t} seconds</option>`)}</select>
    </label>
  </section>`;
}

function render(focusIndex) {
  const q = E.quiz;
  setScreen('screen v-editor', html`
    <header class="topbar">
      <button class="btn btn-ghost" data-action="e-cancel">&larr; Back</button>
      <h1 class="h-small">Quiz maker</h1>
      <div class="row">
        <button class="btn btn-sky" data-action="e-export">Export</button>
        <button class="btn btn-pink" data-action="e-save">Save quiz</button>
      </div>
    </header>
    <main class="editor">
      <div class="card">
        <label class="field"><span>Quiz title</span>
          <input id="e-title" maxlength="60" value="${q.title}" placeholder="Example: Main Idea Mission"></label>
        <div class="row2">
          <label class="field small"><span>Emoji</span><input id="e-emoji" maxlength="4" value="${q.emoji}"></label>
          <label class="field grow"><span>Short description (optional)</span>
            <input id="e-desc" maxlength="140" value="${q.desc}" placeholder="What is this quiz about?"></label>
        </div>
      </div>
      ${q.questions.map((qq, i) => qcard(qq, i, q.questions.length))}
      <button class="btn btn-mint btn-lg" data-action="e-add">+ Add a question</button>
      <p class="error" id="e-err" role="alert"></p>
    </main>`);
  if (focusIndex != null) {
    const card = document.querySelector(`.qcard[data-qi="${focusIndex}"]`);
    if (card) { card.scrollIntoView({ block: 'center' }); const t = card.querySelector('.q-text'); if (t && !t.value) t.focus(); }
  }
}

function readForm() {
  const q = E.quiz;
  q.title = byId('e-title').value;
  q.emoji = byId('e-emoji').value;
  q.desc = byId('e-desc').value;
  q.questions = [...document.querySelectorAll('.qcard')].map((card) => {
    const checked = card.querySelector('input[type=radio]:checked');
    return {
      text: card.querySelector('.q-text').value,
      options: [...card.querySelectorAll('.o-text')].map((i) => i.value),
      correct: checked ? Number(checked.value) : 0,
      time: Number(card.querySelector('.q-time').value),
    };
  });
}

function showError(r) {
  const el = byId('e-err');
  if (el) el.textContent = r.error;
  if (r.at != null) {
    const card = document.querySelector(`.qcard[data-qi="${r.at}"]`);
    if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else { const t = byId('e-title'); if (t) t.focus(); }
}

actions['e-add'] = () => {
  readForm();
  E.quiz.questions.push({ text: '', options: ['', '', '', ''], correct: 0, time: 20 });
  E.dirty = true;
  render(E.quiz.questions.length - 1);
};
actions['e-del'] = ({ i }) => {
  readForm();
  if (E.quiz.questions.length > 1) E.quiz.questions.splice(Number(i), 1);
  E.dirty = true;
  render();
};
const move = (i, d) => {
  readForm();
  const qs = E.quiz.questions; const j = i + d;
  if (j < 0 || j >= qs.length) return;
  [qs[i], qs[j]] = [qs[j], qs[i]];
  E.dirty = true;
  render(j);
};
actions['e-up'] = ({ i }) => move(Number(i), -1);
actions['e-down'] = ({ i }) => move(Number(i), 1);

actions['e-save'] = () => {
  readForm();
  const r = normalizeQuiz(E.quiz);
  if (r.error) return showError(r);
  upsertMine(r.quiz);
  E = null;
  toast('Saved! Your quiz is ready to play.');
  nav.library();
};

actions['e-export'] = () => {
  readForm();
  const r = normalizeQuiz(E.quiz);
  if (r.error) return showError(r);
  const name = r.quiz.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'quiz';
  downloadFile(`${name}.quizparty.json`, JSON.stringify({ format: 'quizparty', version: 1, ...r.quiz }, null, 2), 'application/json');
};

actions['e-cancel'] = () => {
  if (E && E.dirty && !confirm('Leave without saving your changes?')) return;
  E = null;
  nav.library();
};
