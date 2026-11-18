// Story Time Finale: a short, silly story starring the class, written from templates (no AI).
//
// buildStory(players) gives back a title, three story pages and a few "Story Detective"
// questions about figurative language. Names are wrapped in marker characters so the screen
// can highlight them. To add a plot, copy one of the objects in PLOTS and change the words.
//
// Placeholders you can use in a page:
//   {W} the winner   {S} second place   {T} third place   {X} and {Y} two other players
// If the class is small, friendly storybook characters fill the missing roles.

import { raw, esc, avatarName } from './util.js';

const OPEN = '\u0001';
const CLOSE = '\u0002';
const FILLERS = ['Professor Page the owl', 'Biscuit the bookworm', 'Captain Crumb the cookie', 'Sir Reads-a-Lot the snail'];

const PLOTS = [
  {
    title: 'The Night the Page Gobbler Came to Storybook Arcade',
    pages: [
      'It was a quiet night at Storybook Arcade. Suddenly, the lights flickered and the biggest machine began to glow. {W} peeked inside and gasped. "Someone gobbled up the last page of our story!"',
      'Out stomped the Page Gobbler. He was as big as a school bus, and his burps smelled like old books. {S} and {T} tiptoed closer. "We need a hero with a brain as sharp as a pencil," whispered {S}. Everyone looked at {W}.',
      '{W} answered every riddle the Gobbler asked. {X} cheered so loudly that the ceiling shook. {Y} did a happy wiggle dance. The Gobbler blushed, hiccuped, and gave back the missing page. It said: "And they all read happily ever after."',
    ],
    detective: [
      'Find the simile on page 2 that tells how big the Page Gobbler was. (Hint: it uses the word "as.")',
      'Find the hyperbole on page 3. Why is it an exaggeration?',
      'Who saved the day? What clues in the story tell you?',
    ],
  },
  {
    title: 'The Day Stella the Star Ran Away',
    pages: [
      'High above Storybook Arcade, a little yellow star named Stella had a big problem. She had the hiccups, and every hiccup made her bounce another mile across the sky. "Help!" she squeaked. "I cannot stop!" {W} looked up. "Do not worry, Stella! We will catch you!"',
      '{S} grabbed a giant butterfly net. {T} stacked up a mountain of cushions. The wind whistled and whooshed, and the clouds gossiped about the whole thing. Up, up, up went {X}, riding a bouncy beanbag like a rocket.',
      'At last, {W} said the perfect tongue twister: "Silly star, stay still, stay steady." Stella gasped, hiccuped one last time, and landed softly in the hands of {Y}. "Thank you, readers!" she sparkled. "You are my favorite constellation."',
    ],
    detective: [
      'Find the personification on page 2. What is a cloud doing that only a person can do?',
      'Find the alliteration (words that start with the same sound) on page 3.',
      'On page 3, Stella says "You are my favorite constellation." Is that a simile or a metaphor? How do you know?',
    ],
  },
  {
    title: 'The Great Cookie Mix-Up',
    pages: [
      'Every Friday, Storybook Arcade held a Word Cookie Bake-Off. This week, {W} was the head baker, and the recipe was written in the tiniest handwriting ever seen. "It says to add two cups of... zucchini?" {W} blinked.',
      '{S} read the recipe again. "No, no! That says sugar! You are holding the page upside down!" {T} snorted with laughter. Meanwhile, {X} stirred the batter, and {Y} licked the spoon when nobody was looking.',
      'Out of the oven came cookies shaped like letters. Every cookie that spelled a real word glowed gold. {W} ate the first one: C-A-T. It tasted like a warm hug. "Reading," announced {W}, "is the sweetest thing in the world."',
    ],
    detective: [
      'Find the hyperbole on page 1 about the handwriting.',
      'Find the simile on page 3. What two things are being compared?',
      'What was the funny mix-up with the recipe? How did the characters fix it?',
    ],
  },
  {
    title: 'The Mystery of the Missing Bookmark',
    pages: [
      'Someone had taken the golden bookmark from Storybook Arcade! "Who would do such a thing?" gasped {S}. {W} pulled out a magnifying glass. "Time to be a text detective," said {W}. "Every clue is hiding in plain sight."',
      'First clue: tiny footprints led across the carpet. Second clue: a trail of glitter sparkled like a river of stars. {T} and {X} followed the trail past the bookshelves, where the books whispered, "Not us! Not us!"',
      'The trail stopped at a sleepy dragon named Ember, who was snoring on the bookmark like it was a tiny pillow. "I just needed a nap," Ember yawned. {W} grinned. "Case closed!" {Y} fetched Ember a blanket, and everyone shared a snack.',
    ],
    detective: [
      'The idiom "hiding in plain sight" is on page 1. What does it mean?',
      'Find the personification on page 2. Which sentence gives human feelings or actions to books?',
      'Find the simile on page 2 that describes the glitter. What does it help you picture?',
    ],
  },
];

const GENERIC_DETECTIVE = 'Can you find one more simile, metaphor or hyperbole in this story? Read the sentence out loud and tell which kind it is.';

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const shuffled = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const mark = (s) => OPEN + s + CLOSE;

// "Brave Fox" stays "Brave Fox". "Ava" with a fox buddy becomes "Ava the Fox" the first time.
function describe(p) {
  const noun = avatarName(p.avatar);
  return p.name.toLowerCase().includes(noun.toLowerCase()) ? p.name : `${p.name} the ${noun}`;
}

/**
 * players: [{ name, avatar, bestStreak, stoleCoins }] in rank order (1st place first)
 * opts: { mode, bigSteal: {thief, victim, n}, avoid: index of a plot to skip }
 */
export function buildStory(players, opts = {}) {
  const real = players.filter(Boolean);
  const choices = PLOTS.map((_, i) => i).filter((i) => i !== opts.avoid);
  const plotIndex = pickOne(choices.length ? choices : [0]);
  const plot = PLOTS[plotIndex];

  const others = real.slice(3);
  const extra = shuffled(others);
  const cast = { W: real[0], S: real[1], T: real[2], X: others.length > 1 ? extra[0] : real[3], Y: others.length > 1 ? extra[1] : undefined };
  const fillers = FILLERS.slice();
  const seen = new Set();
  const used = {}; // placeholder -> player or filler, so a role is always the same character
  const refFor = (key) => {
    if (!used[key]) used[key] = cast[key] || { filler: fillers.shift() || 'a friendly stranger' };
    const c = used[key];
    if (c.filler) {
      const first = !seen.has(c.filler); seen.add(c.filler);
      return mark(first ? c.filler : c.filler.split(' the ')[0]);
    }
    const first = !seen.has(c);
    seen.add(c);
    return mark(first ? describe(c) : c.name);
  };

  const pages = plot.pages.map((text, idx) => {
    const inPage = [];
    let out = text.replace(/\{([WSTXY])\}/g, (_, key) => {
      const s = refFor(key);
      if (used[key] && !used[key].filler && !inPage.includes(used[key])) inPage.push(used[key]);
      return s;
    });
    // Bonus lines from what really happened in the game
    if (idx === plot.pages.length - 1) {
      const streaker = real.slice().sort((a, b) => (b.bestStreak || 0) - (a.bestStreak || 0))[0];
      if (streaker && streaker.bestStreak >= 3) {
        out += ` By the way, ${mark(streaker.name)} answered ${streaker.bestStreak} questions in a row without a single mistake. Amazing!`;
        if (!inPage.includes(streaker)) inPage.push(streaker);
      }
      if (opts.mode === 'gates' && opts.bigSteal && opts.bigSteal.n > 0) {
        out += ` And if some coins went missing, ask ${mark(opts.bigSteal.thief)}, who tiptoed away with ${opts.bigSteal.n} of them and left a note that said, "Thanks for the coins!"`;
        const thief = real.find((p) => p.name === opts.bigSteal.thief);
        if (thief && !inPage.includes(thief)) inPage.push(thief);
      }
    }
    return { text: out, cast: inPage };
  });

  return {
    plot: plotIndex,
    title: plot.title,
    pages,
    detective: [...plot.detective, GENERIC_DETECTIVE],
  };
}

export const plainText = (text) => String(text).replace(/[\u0001\u0002]/g, '');

// Turn a story page into safe HTML with the names highlighted.
export function storyHtml(text) {
  return raw(String(text).split(/(\u0001[^\u0002]*\u0002)/).map((part) => {
    if (part.startsWith(OPEN)) return `<b class="sname">${esc(part.slice(1, -1))}</b>`;
    return esc(part);
  }).join(''));
}

// Read a page out loud with the browser's built-in voice (nothing is sent anywhere).
export function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plainText(text));
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}
export const canSpeak = () => 'speechSynthesis' in window;
export function stopSpeaking() { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
