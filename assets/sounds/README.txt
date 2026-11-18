Custom sounds go in this folder.

1. Put a short sound file here (mp3, ogg or wav). Keep it small, under about 100 KB.
2. Open js/config.js and list it under SOUND_FILES, for example:
     correct: 'assets/sounds/correct.mp3',
3. Any sound you do not list keeps the built-in beep.

The names you can use:
  join       a player joins the room
  countdown  each 3, 2, 1 beep
  start      the game or a question begins
  correct    a right answer
  wrong      a wrong answer
  tick       the last 5 seconds of a question
  win        the podium
  click      tapping an answer
  coin       finding coins behind a gate (Treasure Gates)
  steal      a steal (Treasure Gates)
  jackpot    finding the jackpot (Treasure Gates)

Only use sounds you made or have the right to use (check the license on any free sound site).
