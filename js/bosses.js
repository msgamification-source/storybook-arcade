// The bosses for "Class vs. the Boss", and how tough each strength setting is.
//
// To add a boss: put a picture in assets/bosses/ (a square PNG with a transparent background, see
// tools/make-buddy.py) and add an entry below. The "taunts" are what the boss says in the speech
// bubble as its health drops.

export const BOSSES = [
  {
    id: 'gobbler', name: 'The Page Gobbler', short: 'Page Gobbler',
    taunts: {
      start: 'Nom nom nom! Your pages are MINE!',
      hurt: 'Hey! Those answers hurt!',
      low: 'Ow! My pages! Stop it, you clever readers!',
      dead: 'I give up! Here are your pages back!',
    },
  },
  {
    id: 'troll', name: 'The Typo Troll', short: 'Typo Troll',
    taunts: {
      start: 'Heh heh! I will hide TYPOS in everything you write!',
      hurt: 'Grr! You spotted my mistakes!',
      low: 'No! Not my pencil! Not the eraser!',
      dead: 'Fine, fine! I will learn to spell!',
    },
  },
  {
    id: 'gremlin', name: 'The Grammar Gremlin', short: 'Grammar Gremlin',
    taunts: {
      start: 'Commas? Where I come from, we do not need commas!',
      hurt: 'Ouch! Somebody knows their grammar!',
      low: 'Stop! Do not put a period on me!',
      dead: 'Okay, okay! I will use my commas the right way!',
    },
  },
];

export const bossById = (id) => BOSSES.find((b) => b.id === id) || BOSSES[0];

// hits: how many right answers each student needs to supply (per 5 minutes) to bring the boss down.
// heal: how much health the boss gets back every time someone misses.
export const STRENGTH = {
  easy: { label: 'Easy', hits: 8, heal: 0 },
  medium: { label: 'Medium', hits: 12, heal: 0 },
  hard: { label: 'Hard', hits: 16, heal: 3 },
};

export const AVG_HIT = 11; // a typical right answer hits for 10 to 18
