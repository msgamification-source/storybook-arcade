// Small shared helpers: safe HTML templates, screens, sounds, confetti.

// ---------- Safe HTML templates ----------
// html`...` escapes every interpolated value unless it came from another html`` call.
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const raw = (s) => ({ __raw: String(s) });
function part(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && '__raw' in v) return v.__raw;
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return raw(out);
}

// ---------- Screens and actions ----------
export const app = document.getElementById('app');
export const actions = Object.create(null); // data-action name -> handler(dataset, element, event)
export const nav = { home: () => {} };      // filled in by app.js

export function setScreen(cls, tpl) {
  app.className = cls || '';
  app.innerHTML = tpl.__raw;
  window.scrollTo(0, 0);
}
export const byId = (id) => document.getElementById(id);

let toastTimer = 0;
export function toast(msg) {
  const el = byId('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- Random helpers ----------
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 20);
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------- Safe localStorage ----------
const memory = {};
export const store = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return key in memory ? memory[key] : fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { memory[key] = value; }
  },
};
export const session = {
  get(key, fallback = null) {
    try { const v = sessionStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
  del(key) { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
};

// ---------- Avatars and shapes ----------
export const AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🐧',
  '🐥', '🦄', '🐙', '🦉', '🐢', '🐳', '🦋', '🐝', '🐞', '🦖', '🐷', '🐮'];

const SHAPE_SVG = [
  // heart
  '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3 4.5 6.6 4.5c2 0 3.5 1.1 5.4 3.1 1.9-2 3.4-3.1 5.4-3.1 3.6 0 5.7 3.8 4.2 7.3C19.5 16.4 12 21 12 21z"/>',
  // star
  '<path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z" stroke-linejoin="round"/>',
  // moon
  '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7z"/>',
  // flower
  '<g><circle cx="12" cy="6" r="3.7"/><circle cx="17.7" cy="10.1" r="3.7"/><circle cx="15.5" cy="16.8" r="3.7"/><circle cx="8.5" cy="16.8" r="3.7"/><circle cx="6.3" cy="10.1" r="3.7"/><circle cx="12" cy="12" r="2.6" fill="#fff"/></g>',
];
export const SHAPE_NAMES = ['Heart', 'Star', 'Moon', 'Flower'];
export const shapeIcon = (i) =>
  raw(`<svg class="shape" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SHAPE_SVG[i % 4]}</svg>`);

// The Quiz Party star mascot.
export const mascot = (cls = '') => raw(`
<svg class="mascot ${cls}" viewBox="0 0 100 100" role="img" aria-label="Smiling star mascot">
  <polygon points="50,10 64.1,34.6 91.9,40.4 72.8,61.4 75.9,89.6 50,78 24.1,89.6 27.2,61.4 8.2,40.4 35.9,34.6"
    fill="#FFF07C" stroke="#14181F" stroke-width="5" stroke-linejoin="round"/>
  <ellipse cx="42" cy="52" rx="3.4" ry="4.4" fill="#14181F"/><ellipse cx="58" cy="52" rx="3.4" ry="4.4" fill="#14181F"/>
  <circle cx="43.1" cy="50.4" r="1.2" fill="#fff"/><circle cx="59.1" cy="50.4" r="1.2" fill="#fff"/>
  <ellipse cx="35.5" cy="61" rx="4.6" ry="3" fill="#FF7EB6" opacity=".85"/><ellipse cx="64.5" cy="61" rx="4.6" ry="3" fill="#FF7EB6" opacity=".85"/>
  <path d="M44 60.5 Q50 67.5 56 60.5" fill="none" stroke="#14181F" stroke-width="3.2" stroke-linecap="round"/>
</svg>`);

// ---------- Sounds (tiny WebAudio blips, no files needed) ----------
let actx = null;
let muteKey = 'quizparty.muted.host';
let muted = !!store.get(muteKey, false);
// Host screens default to sound on. Student devices default to quiet so 25 phones do not all beep.
export function setSoundRole(role) {
  muteKey = 'quizparty.muted.' + role;
  muted = !!store.get(muteKey, role === 'player');
}
function audio() {
  if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (C) actx = new C(); }
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
function tone(freq, at, dur, type = 'sine', vol = 0.13) {
  if (muted) return;
  const c = audio();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const t = c.currentTime + at;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
export const sfx = {
  join() { tone(660, 0, 0.1); tone(990, 0.09, 0.14); },
  start() { tone(392, 0, 0.1); tone(523, 0.1, 0.1); tone(784, 0.2, 0.22); },
  correct() { tone(523, 0, 0.1); tone(659, 0.09, 0.1); tone(784, 0.18, 0.22); },
  wrong() { tone(300, 0, 0.18, 'triangle'); tone(210, 0.16, 0.26, 'triangle'); },
  tick() { tone(900, 0, 0.05, 'square', 0.03); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25)); },
  click() { tone(720, 0, 0.05, 'sine', 0.08); },
};
export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  store.set(muteKey, muted);
  return muted;
}

// ---------- Confetti ----------
export function confetti(ms = 3800) {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  const w = (cv.width = window.innerWidth);
  const h = (cv.height = window.innerHeight);
  const cols = ['#7EEBFA', '#7FEED8', '#FFF07C', '#FF7EB6', '#ffffff'];
  const ps = Array.from({ length: 150 }, () => ({
    x: Math.random() * w, y: -20 - Math.random() * h * 0.6,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    s: 7 + Math.random() * 9, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    c: cols[Math.floor(Math.random() * cols.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    c.clearRect(0, 0, w, h);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.r);
      c.fillStyle = p.c; c.strokeStyle = '#14181F'; c.lineWidth = 1.6;
      c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
      c.strokeRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
      c.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

// ---------- Misc ----------
export function mmss(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function downloadFile(name, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula tricks from player names
  return '"' + s.replace(/"/g, '""') + '"';
}
