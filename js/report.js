// The Skills report: what the class got right, what to reteach, and who might need a check-in.
//
// While a game runs, the teacher's computer calls recordAnswer() for every answer. When the game
// is over, buildReport() turns those counts into the report. Nothing is saved or sent anywhere.

import { csvCell } from './util.js';

// How the report sorts a percent into a band.
export const STRONG = 80;   // 80% and up: strong
export const ALMOST = 60;   // 60 to 79%: almost there. Below that: reteach.
export const CHECK_IN_BELOW = 50;   // students under this percent (after 3+ answers) go on the check-in list
export const CHECK_IN_MIN_ANSWERS = 3;

export const bandOf = (pct) => (pct >= STRONG ? 'strong' : pct >= ALMOST ? 'almost' : 'reteach');
export const BAND_LABEL = { strong: 'Strong', almost: 'Almost there', reteach: 'Reteach' };

export function newStats() { return { q: new Map() }; }

function slot(stats, q) {
  const key = q._i != null ? q._i : q.text;
  let r = stats.q.get(key);
  if (!r) {
    r = { key, text: q.text, skill: q.skill || '', correctText: q.options[q.correct], attempts: 0, right: 0, none: 0, wrong: new Map() };
    stats.q.set(key, r);
  }
  return r;
}

// One answer: which answer text they picked, and whether it was right.
export function recordAnswer(stats, q, pickedText, ok) {
  const r = slot(stats, q);
  r.attempts++;
  if (ok) r.right++;
  else r.wrong.set(pickedText, (r.wrong.get(pickedText) || 0) + 1);
}
// A student who was in the room but did not answer in time.
export function recordNone(stats, q) { slot(stats, q).none++; }

const pct = (right, n) => (n ? Math.round((right / n) * 100) : 0);

/**
 * stats: from newStats(). players: [{ name, attempts, right }].
 * Returns { overall, attempts, right, skills, questions, review, checkIn }.
 */
export function buildReport(stats, players = []) {
  const recs = [...stats.q.values()];
  const attempts = recs.reduce((n, r) => n + r.attempts, 0);
  const right = recs.reduce((n, r) => n + r.right, 0);

  const questions = recs.filter((r) => r.attempts > 0).map((r) => {
    const top = [...r.wrong.entries()].sort((a, b) => b[1] - a[1])[0];
    const p = pct(r.right, r.attempts);
    return {
      text: r.text, skill: r.skill, correctText: r.correctText, attempts: r.attempts, right: r.right, none: r.none,
      pct: p, band: bandOf(p), topWrong: top ? { text: top[0], n: top[1] } : null,
    };
  }).sort((a, b) => a.pct - b.pct || b.attempts - a.attempts);

  const bySkill = new Map();
  for (const r of recs) {
    if (!r.skill || !r.attempts) continue;
    const s = bySkill.get(r.skill) || { skill: r.skill, attempts: 0, right: 0, questions: 0 };
    s.attempts += r.attempts; s.right += r.right; s.questions++;
    bySkill.set(r.skill, s);
  }
  const skills = [...bySkill.values()].map((s) => ({ ...s, pct: pct(s.right, s.attempts), band: bandOf(pct(s.right, s.attempts)) }))
    .sort((a, b) => a.pct - b.pct || b.attempts - a.attempts);

  const checkIn = players
    .filter((p) => p.attempts >= CHECK_IN_MIN_ANSWERS && pct(p.right, p.attempts) < CHECK_IN_BELOW)
    .map((p) => ({ name: p.name, pct: pct(p.right, p.attempts), attempts: p.attempts }))
    .sort((a, b) => a.pct - b.pct);

  return {
    overall: pct(right, attempts), attempts, right,
    skills, questions,
    review: questions.filter((q) => q.pct < STRONG),   // the questions worth another look
    checkIn,
  };
}

// A spreadsheet version. Question text and names go through csvCell so nothing can act as a formula.
export function reportCsv(report) {
  const rows = [['Skill', 'Question', 'Answers', 'Right', 'Percent right', 'Most picked wrong answer', 'Times picked']];
  for (const q of report.questions) {
    rows.push([q.skill, q.text, q.attempts, q.right, q.pct + '%', q.topWrong ? q.topWrong.text : '', q.topWrong ? q.topWrong.n : '']);
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
