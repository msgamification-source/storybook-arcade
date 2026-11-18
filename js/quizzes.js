// Starter quizzes, plus saving, loading and checking teacher-made quizzes.

import { store, uid } from './util.js';

const q = (text, options, correct, time = 20) => ({ text, options, correct, time });

export const BUILTIN = [
  {
    id: 'builtin-warmup', builtin: true, emoji: '🎉', grade: '3-5',
    title: 'Fun Warm-Up',
    desc: 'A quick five question round to try out the game with your class.',
    questions: [
      q('How many days are in one week?', ['5', '7', '10', '12'], 1, 15),
      q('Which of these animals is a mammal?', ['Shark', 'Frog', 'Dolphin', 'Eagle'], 2, 15),
      q('What color do you get when you mix blue and yellow?', ['Green', 'Purple', 'Orange', 'Pink'], 0, 15),
      q('Which character wears a red cap with an M and jumps on Goombas?', ['Luigi', 'Mario', 'Link', 'Kirby'], 1, 15),
      q('Which school does Harry Potter go to?', ['Hogwarts', 'Beauxbatons', 'Durmstrang', 'Ilvermorny'], 0, 15),
    ],
  },
  {
    id: 'builtin-pos', builtin: true, emoji: '🧩', grade: '3-5',
    title: 'Parts of Speech Party',
    desc: 'Nouns, verbs, adjectives, adverbs and pronouns.',
    questions: [
      q('Which word is a noun in this sentence? "The happy puppy ran."', ['happy', 'puppy', 'ran', 'The'], 1),
      q('Which word is a verb in this sentence? "Maya giggled at the funny joke."', ['Maya', 'giggled', 'funny', 'joke'], 1),
      q('Which word is an adjective in this sentence? "She wore a sparkly dress."', ['She', 'wore', 'sparkly', 'dress'], 2),
      q('Which word is an adverb in this sentence? "The turtle crawled slowly."', ['turtle', 'crawled', 'slowly', 'The'], 2),
      q('Which sentence has a proper noun?', ['The city is big.', 'We visited Orlando.', 'My dog is fluffy.', 'The lake is cold.'], 1),
      q('Which word is a pronoun in this sentence? "Jake said he was tired."', ['Jake', 'said', 'he', 'tired'], 2),
      q('Which word is an action verb?', ['happy', 'jump', 'blue', 'table'], 1, 15),
      q('What does an adjective do?', ['Describes a noun', 'Shows action', 'Tells how an action is done', 'Takes the place of a noun'], 0),
      q('Which sentence uses an adverb?', ['The snail moved slowly.', 'The little snail sat.', 'The snail has a hard shell.', 'A snail is on the leaf.'], 0),
      q('What is the correct plural of "box"?', ['boxs', 'boxes', 'boxies', "box's"], 1, 15),
    ],
  },
  {
    id: 'builtin-figurative', builtin: true, emoji: '🌈', grade: '3-5',
    title: 'Figurative Language Frenzy',
    desc: 'Similes, metaphors, idioms, hyperbole and more.',
    questions: [
      q('"Her smile was as bright as the sun." What type of figurative language is this?', ['Simile', 'Metaphor', 'Idiom', 'Alliteration'], 0),
      q('"The classroom was a zoo." What type of figurative language is this?', ['Simile', 'Metaphor', 'Hyperbole', 'Onomatopoeia'], 1),
      q('"It is raining cats and dogs." What type of figurative language is this?', ['Idiom', 'Simile', 'Personification', 'Alliteration'], 0),
      q('"I have told you a million times!" What type of figurative language is this?', ['Metaphor', 'Hyperbole', 'Simile', 'Idiom'], 1),
      q('"The wind whispered through the trees." What type of figurative language is this?', ['Simile', 'Hyperbole', 'Personification', 'Idiom'], 2),
      q('"Peter Piper picked a peck of pickled peppers." What type of figurative language is this?', ['Alliteration', 'Metaphor', 'Idiom', 'Personification'], 0),
      q('Which word is an example of onomatopoeia?', ['sparkle', 'buzz', 'gentle', 'journey'], 1, 15),
      q('What does the idiom "under the weather" mean?', ['Standing in the rain', 'Feeling sick', 'Being very cold', 'Being lost'], 1),
      q('Which sentence is a simile?', ['He is a lion in battle.', 'He fought like a lion.', 'The lion roared loudly.', 'Lions have manes.'], 1),
      q('Which sentence uses personification?', ['The sun smiled down on the park.', 'The sun is very hot.', 'The sun rose at six.', 'The sun is a big yellow circle.'], 0),
    ],
  },
  {
    id: 'builtin-grammar', builtin: true, emoji: '✏️', grade: '3-5',
    title: 'Grammar and Punctuation Fix-It',
    desc: 'Capitals, commas, apostrophes, quotes and complete sentences.',
    questions: [
      q('Which sentence is punctuated correctly?', ['Where is my backpack.', 'Where is my backpack?', 'Where is my backpack,', 'Where is my backpack'], 1, 15),
      q('Which word needs a capital letter? "Last summer, we visited orlando."', ['summer', 'visited', 'orlando', 'we'], 2),
      q('Which sentence uses an apostrophe correctly?', ["The dog's bone is big.", 'The dogs bone is big.', "The dog's are barking.", "Its a nice day."], 0),
      q('What is the contraction for "do not"?', ['dont', "don't", "do'nt", "d'ont"], 1, 15),
      q('Which sentence uses commas correctly?', ['I packed apples, grapes, and crackers.', 'I packed, apples grapes and crackers.', 'I, packed apples grapes, and crackers.', 'I packed apples grapes, and, crackers.'], 0),
      q('Which sentence uses quotation marks correctly?', ['Mia said, "Let\'s play."', 'Mia said, Let\'s play."', '"Mia said, Let\'s play.', 'Mia said "Let\'s play.'], 0, 25),
      q('Which word completes the sentence? "The dog wagged ___ tail."', ["it's", 'its', "its'", 'is'], 1, 15),
      q('Which one is a complete sentence?', ['Running down the hall.', 'The cat sat on the warm windowsill.', 'Because it was raining.', 'After the big game.'], 1),
      q('Which word completes the sentence? "___ going to the park after school."', ['Their', 'There', "They're", 'Thier'], 2, 15),
      q('Which sentence is correct?', ['The boys plays soccer.', 'The boys play soccer.', 'The boy play soccer.', 'The boy are playing soccer.'], 1, 15),
    ],
  },
  {
    id: 'builtin-vocab', builtin: true, emoji: '🪄', grade: '3-5',
    title: 'Word Wizard',
    desc: 'Prefixes, suffixes, synonyms, antonyms and context clues.',
    questions: [
      q('What does the prefix "un-" mean in the word "unhappy"?', ['again', 'not', 'before', 'full of'], 1, 15),
      q('What does the prefix "re-" mean in the word "rewrite"?', ['again', 'not', 'without', 'under'], 0, 15),
      q('What does the suffix "-less" mean in the word "hopeless"?', ['full of', 'again', 'without', 'most'], 2, 15),
      q('What does the suffix "-ful" mean in the word "joyful"?', ['without', 'full of', 'not', 'before'], 1, 15),
      q('What does the prefix "pre-" mean in the word "preview"?', ['after', 'again', 'before', 'not'], 2, 15),
      q('Which word is a synonym for "enormous"?', ['tiny', 'huge', 'quiet', 'speedy'], 1, 15),
      q('Which word is an antonym for "ancient"?', ['old', 'historic', 'dusty', 'modern'], 3, 15),
      q('"The sky grew gloomy, dark and gray, so we stayed inside." What does "gloomy" mean?', ['bright and sunny', 'dark and dreary', 'warm and breezy', 'loud and busy'], 1, 25),
      q('"Mei was ecstatic. She jumped up and down and cheered when she won." What does "ecstatic" mean?', ['very sleepy', 'very worried', 'extremely happy', 'a little bored'], 2, 25),
      q('Which sentence uses the word "bat" to mean an animal?', ['He swung the bat at the ball.', 'A bat flew out of the cave at night.', 'Please hand me the bat.', 'The bat is made of wood.'], 1, 20),
    ],
  },
];

// ---------- Teacher-made quizzes ----------
const KEY = 'quizparty.myquizzes.v1';

function cleanStr(s, max) {
  return String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

// Checks and cleans any quiz object (from the editor or an imported file).
export function normalizeQuiz(o) {
  if (!o || typeof o !== 'object') return { error: 'That file does not look like a quiz.' };
  const title = cleanStr(o.title, 60);
  if (!title) return { error: 'Your quiz needs a title.' };
  if (!Array.isArray(o.questions) || o.questions.length === 0) return { error: 'Add at least one question.' };
  if (o.questions.length > 100) return { error: 'A quiz can have up to 100 questions.' };
  const questions = [];
  for (let n = 0; n < o.questions.length; n++) {
    const r = o.questions[n] || {};
    const text = cleanStr(r.text, 300);
    if (!text) return { error: `Question ${n + 1} needs some text.`, at: n };
    const opts = Array.isArray(r.options) ? r.options : [];
    // Keep blank answers out, but remember which one was correct.
    let correct = -1;
    const options = [];
    opts.slice(0, 4).forEach((raw, i) => {
      const t = cleanStr(raw, 120);
      if (!t) return;
      if (i === Number(r.correct)) correct = options.length;
      options.push(t);
    });
    if (options.length < 2) return { error: `Question ${n + 1} needs at least two answers.`, at: n };
    if (correct < 0) return { error: `Question ${n + 1}: pick which answer is correct (and make sure it is filled in).`, at: n };
    const time = Math.min(120, Math.max(5, Math.round(Number(r.time)) || 20));
    questions.push({ text, options, correct, time });
  }
  return {
    quiz: {
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : 'mine-' + uid(),
      title,
      emoji: cleanStr(o.emoji, 4) || '⭐',
      grade: cleanStr(o.grade, 10) || '',
      desc: cleanStr(o.desc, 140),
      questions,
    },
  };
}

export function loadMine() {
  const list = store.get(KEY, []);
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) { const r = normalizeQuiz(item); if (r.quiz) out.push(r.quiz); }
  return out;
}
export function saveMine(list) { store.set(KEY, list); }

export function allQuizzes() { return [...BUILTIN, ...loadMine()]; }
export function findQuiz(id) { return allQuizzes().find((x) => x.id === id) || null; }

export function upsertMine(quiz) {
  const list = loadMine();
  const i = list.findIndex((x) => x.id === quiz.id);
  if (i >= 0) list[i] = quiz; else list.push(quiz);
  saveMine(list);
}
export function deleteMine(id) { saveMine(loadMine().filter((x) => x.id !== id)); }

export function copyOf(quiz) {
  return {
    ...JSON.parse(JSON.stringify(quiz)),
    id: 'mine-' + uid(), builtin: false,
    title: quiz.builtin ? quiz.title + ' (my copy)' : quiz.title,
  };
}
export function blankQuiz() {
  return {
    id: 'mine-' + uid(), title: '', emoji: '⭐', grade: '', desc: '',
    questions: [{ text: '', options: ['', '', '', ''], correct: 0, time: 20 }],
  };
}
