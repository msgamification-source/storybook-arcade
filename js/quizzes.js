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
  {
    id: 'builtin-hyperbole', builtin: true, emoji: '🔍', grade: '3-5',
    title: 'Hyperbole Hunt',
    desc: 'Spot the big exaggerations and tell what they really mean.',
    questions: [
      q('Which sentence is an example of hyperbole?', ['The test was really hard.', 'I studied for a million years for this test.', 'The test had twenty questions.', 'I studied for an hour.'], 1),
      q('Which sentence uses hyperbole?', ['My little brother is a loud drum.', 'My little brother is so loud that the whole planet can hear him.', 'My little brother is loud.', 'My little brother plays the drums.'], 1),
      q('What is the hyperbole in this sentence? "I have told you a billion times to clean your room!"', ['I have told you', 'a billion times', 'to clean', 'your room'], 1),
      q('Which sentence is NOT a hyperbole?', ['I am so tired I could sleep for a year.', 'The line was a mile long.', 'I walked two miles to school today.', 'My backpack weighs a ton.'], 2, 25),
      q('Dad said, "I am so hungry I could eat a horse!" What does he really mean?', ['He plans to eat a horse.', 'He is very hungry.', 'He is allergic to horses.', 'He does not like dinner.'], 1),
      q('"It was so cold that my words froze in the air." What is the author trying to show?', ['It was extremely cold.', 'Words can really freeze.', 'The speaker was quiet.', 'It was a sunny day.'], 0, 25),
      q('Which sentence is a simile, not a hyperbole?', ['I am so excited I could jump to the moon.', 'My room is a disaster zone.', 'She was as quiet as a mouse.', 'I have a million things to do.'], 2, 25),
      q('Which sentence is an idiom, not a hyperbole?', ['I am so hungry I could eat the whole kitchen.', 'She spilled the beans about the surprise party.', 'This suitcase weighs a million pounds.', 'The movie lasted a hundred years.'], 1, 25),
      q('Which sentence is the BEST hyperbole to show how big a dog is?', ['My dog is large.', 'My dog is so big he needs his own zip code.', 'My dog weighs sixty pounds.', 'My dog is bigger than my cat.'], 1, 25),
      q('Why might an author use hyperbole?', ['To make a point stronger or funnier', 'To give exact facts and numbers', 'To confuse the reader', 'To list the steps in a recipe'], 0),
    ],
  },
  {
    id: 'builtin-theme', builtin: true, emoji: '🕵️', grade: '3-5',
    title: 'Theme Detectives',
    desc: 'Read tiny stories and find the lesson hiding in each one.',
    questions: [
      q('Which one is a THEME (a lesson or message), not just a topic?', ['Friendship', 'A dog and a cat', 'True friends help each other when things are hard', 'The park'], 2, 25),
      q('What is the theme of a story?', ['The main character', 'The lesson or message the author wants you to learn', 'Where the story takes place', 'The title of the story'], 1),
      q('Ravi fell off his bike three times and scraped his knee. Each time he climbed back on. By the end of the day, he rode all the way down the street. What is the theme?', ['Bikes are dangerous.', 'Never give up, even when something is hard.', 'Knees heal quickly.', 'Always wear a helmet.'], 1, 30),
      q('Mia said she did not break the vase, but her mom found the pieces behind the couch. Mia felt terrible, so she told the truth and said sorry. Her mom hugged her. What is the theme?', ['Vases are expensive.', 'Telling the truth is the right thing to do.', 'Never play inside.', 'Moms see everything.'], 1, 30),
      q('Two squirrels tugged on one acorn until it broke in half. Then they spotted a tree full of acorns, enough for everyone. What is the theme?', ['Acorns grow on trees.', 'Squirrels are strong.', 'Sharing and working together is better than fighting.', 'Always climb high.'], 2, 30),
      q('A story is about a girl who learns to share. Which detail best SUPPORTS the theme "Sharing makes everyone happy"?', ['The girl has long brown hair.', 'The girl gives half her snack to a lonely classmate, and both of them smile.', 'The story takes place in the fall.', 'The girl\'s backpack is red.'], 1, 30),
      q('Everyone laughed at Omar\'s old, patched backpack. Then he pulled out a notebook full of amazing drawings, and the class gasped. What is the theme?', ['Backpacks should be new.', 'Do not judge someone by how they look on the outside.', 'Drawing is easy.', 'Notebooks are useful.'], 1, 30),
      q('A boy practices piano until he can play a whole song. A girl practices free throws every day until she makes the winning shot. What theme do both stories share?', ['Music and sports are the same.', 'Practice and hard work help you reach your goals.', 'Winning is everything.', 'Always play alone.'], 1, 30),
      q('In the story of the tortoise and the hare, the slow tortoise wins the race. Which one is NOT a good theme for this story?', ['Slow and steady can win the race.', 'Bragging can cause you to lose.', 'Hard work beats showing off.', 'Rabbits are always faster.'], 3, 25),
      q('How do readers figure out a theme?', ['By looking at what the characters learn and how the problem is solved', 'By counting the pages', 'By reading only the first sentence', 'By looking at the pictures only'], 0, 25),
    ],
  },
];

// The skill each starter question practices. The Skills report groups by these.
const SKILLS = {
  'builtin-pos': ['Nouns', 'Verbs', 'Adjectives', 'Adverbs', 'Nouns', 'Pronouns', 'Verbs', 'Adjectives', 'Adverbs', 'Nouns'],
  'builtin-figurative': ['Simile', 'Metaphor', 'Idioms', 'Hyperbole', 'Personification', 'Alliteration', 'Onomatopoeia', 'Idioms', 'Simile', 'Personification'],
  'builtin-grammar': ['End punctuation', 'Capital letters', 'Apostrophes', 'Apostrophes', 'Commas', 'Quotation marks', 'Homophones', 'Complete sentences', 'Homophones', 'Subject-verb agreement'],
  'builtin-hyperbole': ['Spotting hyperbole', 'Spotting hyperbole', 'Spotting hyperbole', 'Spotting hyperbole', 'What hyperbole means', 'What hyperbole means', 'Hyperbole or something else?', 'Hyperbole or something else?', 'Writing and purpose', 'Writing and purpose'],
  'builtin-theme': ['Theme vs. topic', 'Theme vs. topic', 'Finding the theme', 'Finding the theme', 'Finding the theme', 'Using text evidence', 'Finding the theme', 'Finding the theme', 'Finding the theme', 'Using text evidence'],
  'builtin-vocab': ['Prefixes', 'Prefixes', 'Suffixes', 'Suffixes', 'Prefixes', 'Synonyms and antonyms', 'Synonyms and antonyms', 'Context clues', 'Context clues', 'Multiple-meaning words'],
};
BUILTIN.forEach((b) => (SKILLS[b.id] || []).forEach((skill, i) => { if (b.questions[i]) b.questions[i].skill = skill; }));

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
    questions.push({ text, options, correct, time, skill: cleanStr(r.skill, 40) });
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
// Quizzes made on the fly (like "Review: missed questions") live only until the page closes.
const temporary = new Map();
export function registerTemp(quiz) { temporary.set(quiz.id, quiz); }
export function findQuiz(id) { return temporary.get(id) || allQuizzes().find((x) => x.id === id) || null; }
// Every skill name used in any quiz, to suggest in the quiz maker.
export function allSkills() {
  return [...new Set(allQuizzes().flatMap((q) => q.questions.map((x) => x.skill)).filter(Boolean))].sort();
}

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
    questions: [{ text: '', options: ['', '', '', ''], correct: 0, time: 20, skill: '' }],
  };
}
