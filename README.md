# Storybook Arcade

A live classroom quiz game in the style of Kahoot, Gimkit and Blooket. Kids join with a PIN on any
device, answer on their own screen, and watch the leaderboard on the big screen.

![Storybook Arcade screens: teacher lobby, question, results, race, and student phones](docs/preview.png)

It is a plain static website. No accounts, no database, no server to run, and nothing is stored
about students. It can live for free on GitHub Pages.

## Two ways to play

| Mode | How it works |
| --- | --- |
| **Live Quiz** | Everyone answers the same question at the same time while the teacher's screen leads. Faster correct answers earn more points, and streaks add bonus points. Leaderboard after each question, podium at the end. |
| **Race** | Everyone plays at their own speed and races to the finish line. Wrong answers come back around later, so kids get a second try. Coins for correct answers, streak bonuses, and bonuses for the first three to finish. |
| **Class vs. the Boss** | The whole class teams up against one boss with a shared health bar. Every right answer is a hit, and team power builds up to a **Mega Slam**. Beat the boss before time runs out, and nobody competes against each other. |
| **Treasure Gates** | Everyone plays at their own speed against the clock. Every right answer opens three hidden gates. Behind them: coins, a jackpot, a double-up, a shield, or a **steal** from a classmate. Most coins when time is up wins. |

Also included: five starter ELA quizzes (grades 3 to 5), a quiz maker, import and export of quizzes,
QR code joining, kick button, results download (CSV), and rejoin if a student refreshes the page.

## Put it on GitHub Pages

1. Create a new repository on GitHub and upload everything in this folder to it.
2. In the repository, go to **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick **main** and **/ (root)**, then Save.
4. After a minute your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

## Running a game

1. Open your site on the computer connected to the projector and tap **Teachers: host a game**.
2. Pick a quiz, pick a mode, tap **Open game room**.
3. Students open the site (or scan the QR code), type the PIN and a nickname, and they appear on screen.
4. Tap **Start game**. In Live Quiz, Space or Enter moves to the next screen.

**Keep the teacher's tab open.** The teacher's browser is the game server. If it is closed or
refreshed, the game ends. A warning pops up if you try to leave mid game.

## Class vs. the Boss

A team mode where nobody loses to a classmate. Pick it on the setup screen, then choose a boss, how strong
it is, and how long the battle lasts.

- **The bosses:** the Page Gobbler, the Typo Troll and the Grammar Gremlin, or "Surprise me." The boss
  talks in a speech bubble as it gets hurt.
- **How it works:** the boss's health grows with the class (more students, bigger boss). Each right answer
  hits it for 10 damage, plus a small streak bonus. Missed questions come back around, as in Race.
- **Team power:** every hit fills a shared meter. When it is full, the class lands a **Mega Slam** for extra
  damage, with a big banner on every device.
- **Strength:** Easy, Medium or Hard. On Hard the boss is bigger and **heals a little every time someone
  misses**.
- **Win or lose:** if the class brings the health to zero before time runs out, it is a victory with confetti
  and a "Final blow" award. If time runs out, the boss "got away" and students see an encouraging message.
  **Rematch** goes straight back to the setup screen.
- The Skills report, Story Time and awards all work after a boss battle. Beating the Page Gobbler picks its
  own story.

To add a boss, put a square PNG in `assets/bosses/` and add it to `js/bosses.js` with its taunts (see
`tools/make-buddy.py`).

## Treasure Gates

Pick **Treasure Gates** on the setup screen and choose how long the game lasts. Questions keep coming
(missed ones return), and each right answer earns 50 coins (plus a small streak bonus) and a pick of
three gates:

| Behind the gate | What happens |
| --- | --- |
| Coin pile | +100, +200 or +400 coins |
| Jackpot | +1000 coins (rare) |
| Double up | your next right answer earns double |
| Shield | blocks the next steal against you |
| Steal | take about a fifth of the coins (50 to 300) from a classmate who is ahead of you |

Stealing stays fair: you can only steal from someone who is ahead of you and has at least 100 coins,
they always keep some coins, and a shield blocks it (the thief gets 50 coins for trying). If nobody is
ahead of you, a "steal" turns into a coin pile. The teacher can switch stealing off for a class. All the
prizes are decided on the teacher's computer, so students can not peek or cheat. The big screen shows a
live coin board and a "What just happened" feed.

## Skills report

After any game, tap **Skills report** on the podium to see what to reteach:

- **Skills, weakest first.** Every question can have a skill (like "Similes" or "Main idea"). The report
  groups the class's answers by skill and marks each one **Reteach** (under 60%), **Almost there**
  (60 to 79%) or **Strong** (80% and up).
- **Questions to review.** Every question under 80%, with the right answer and the **most picked wrong
  answer**, which often shows the exact mix-up.
- **Students to check in with.** Anyone under 50% right after 3 or more answers. (With random names turned
  on, these are not real student names.)
- **Print** a clean one-page copy, or **Download CSV** for a spreadsheet.
- **Play the missed questions** turns everything under 80% into a new "Review" quiz and opens its setup
  screen, so you can reteach with another round right away.

It works in all three game modes. The starter quizzes already have skills. For your own quizzes, fill in the
**Skill** box on each question in the quiz maker. The report is built on the teacher's computer, is not saved
anywhere, and nothing about it is sent to any server, so print it or download the CSV before closing the page.

## Story Time Finale

After the podium, tap **Story time!**. The game writes a short, silly story starring the class: the
winner is the hero, and the other players and their buddies show up as characters. Names are
highlighted, the big screen shows the story one page at a time, and every student device reads along.
There is a **Read to us** button (the browser's built-in voice), and a last page of **Story Detective**
questions about similes, metaphors, hyperbole and more. **Another story** picks a different plot. The
stories come from templates in `js/story.js` (no AI and nothing is sent anywhere). Streaks and, in
Treasure Gates, the biggest steal get a mention too. The podium also shows awards for the best streak
and the master thief.

## Choices before you start

On the setup screen the teacher picks how the game runs. Your choices are remembered for next time.

- **Student names:** students type their own nickname, or the game gives everyone a fun random name
  that matches their buddy (like "Brave Fox"). Random names can not repeat, and a typed name is ignored.
- **Questions on student screens:** on by default. Turn it off and student screens show only the four
  colored shapes with "Look at the big screen!", so everyone looks up at the board.
- **Leaderboard between questions:** the top 10 or the top 5. It shows who moved up or down since the
  last question, and who is on a streak (2 or more right in a row).
- **Auto-play:** moves on by itself after each answer reveal and leaderboard, staying on each screen for
  3, 5, 8 or 12 seconds. A button on the board pauses it. Space or Enter still moves on right away.
- **Mix up the question order / the answer order.**

Every game starts with a 3, 2, 1 countdown on the big screen and on every student device.

## Custom sounds

The game uses simple built-in beeps. To use your own sounds, put the files in `assets/sounds/` and list
them in `js/config.js` (see the instructions in `assets/sounds/README.txt`). Any sound you do not
replace keeps its beep.

## Make your own quizzes

Tap **+ New quiz** in the teacher menu. Write a question, fill in 2 to 4 answers, tap the circle
next to the right one. Quizzes are saved in that browser only, so use **Export** to keep a copy
or to move a quiz to another computer, and **Import** to bring it back.

A quiz file looks like this:

```json
{
  "title": "My Quiz",
  "emoji": "⭐",
  "questions": [
    { "text": "Which word is a noun?", "options": ["run", "puppy", "quickly"], "correct": 1, "time": 20, "skill": "Nouns" }
  ]
}
```

`correct` counts from 0 (the first answer is 0). `time` is seconds, from 5 to 120. `skill` is optional and
is what the Skills report groups by.

## How the live connection works (and one thing to know)

Players connect straight to the teacher's browser using WebRTC through [PeerJS](https://peerjs.com).
A small "broker" server only helps them find each other at the start. By default this site uses
the **free public PeerJS broker**. That keeps setup at zero, but it is a community service with no
uptime promise, and it may limit how many people can connect at once.

If you ever see "could not connect" for everyone, or you want rock solid reliability for a big
class, run your own broker. The `server/` folder is a ready to deploy one (about ten lines).

1. Deploy `server/` to any Node host (Render, Fly.io, Railway and similar all have free tiers).
2. Add this to `index.html` above the other `<script>` tags, using your server's address:

```html
<script>
  window.STORYBOOK_ARCADE_PEER_OPTIONS = { host: 'your-broker.onrender.com', port: 443, secure: true, path: '/' };
</script>
```

Strict school networks sometimes block WebRTC. PeerJS includes free relay servers by default
(which helps a lot), but if you set your own `config` in the options above, include relay (TURN)
servers in it too.

## Reading Buddies (the characters)

Kids pick a buddy when they join, and it shows up on the lobby, race track, leaderboard and podium.
The pictures live in `assets/buddies/`, and the list is in `js/buddies.js`.

To add a new buddy:

1. Make a picture of the character on a plain white background with a closed dark outline.
2. Run `python3 tools/make-buddy.py my-picture.png owl`. It cuts out the background, sizes the
   picture and saves `assets/buddies/owl.png`. (It needs `pip install pillow numpy`.)
3. Add one line to `js/buddies.js`: `{ id: 'owl', name: 'Owl' },`

The picker grows to fit however many buddies you add.

## The rest of the art

| What | Where | Used for |
| --- | --- | --- |
| Star mascot (4 poses) | `assets/mascot/` | home screen, and the result screens kids see (cheer, oops, waiting) |
| Icons | `assets/icons/` | coins, streak flame, finish flag, trophy, shield, bandit mask and more |
| Medals | `assets/medals/` | the podium and the end screen |
| Background pattern | `assets/pattern.png` | the faint doodles behind every screen |
| Bosses | `assets/bosses/` | the pictures for Class vs. the Boss |
| Arcade scene | `assets/hero.png` | the picture at the top of the home screen (three random buddies stand in it) |

To swap in new art, draw a sheet of separate pictures on a plain white background, then cut it up:

```
python3 tools/split-sheet.py my-icons.png assets/icons coin flame flag --cols 3 --size 128
```

Names go in reading order (left to right, then top to bottom). Use `--same-scale --align bottom`
for a set of poses of one character. To rebuild the background pattern from the icons, run
`python3 tools/make-pattern.py`. All the tools need `pip install pillow numpy`.

## Test without students

On the setup screen, tick **Test on this device only**. Open the site in a second tab to play as a
student. This works without the internet connection to the broker.

## Files

```
index.html          the page
css/style.css       all styling (Ms. Gamification brand colors, Poppins font)
js/app.js           home, join, quiz library, game setup
js/host.js          the teacher's game screens, scoring and Treasure Gates
js/story.js         the Story Time Finale story maker
js/bosses.js        the bosses and their strength settings
js/report.js        the Skills report (counting answers and building the report)
js/player.js        the student's screens
js/editor.js        the quiz maker
js/quizzes.js       starter quizzes and quiz checking
js/transport.js     PeerJS connection (and the same-device test mode)
js/config.js        name, byline, player limit, custom sound files
js/buddies.js       the list of character pictures
assets/buddies/     the character pictures
tools/              make-buddy.py, split-sheet.py, make-pattern.py (turn pictures into game art)
vendor/ fonts/      PeerJS, QR code library and Poppins, bundled so nothing loads from outside
server/             optional broker
```

To change the name shown on the home screen, edit `js/config.js`.

## Scoring

- **Live Quiz:** a correct answer earns up to 1000 points. The faster the answer, the more points
  (an answer at the last second still earns 500). Each answer in a row adds a streak bonus of 100,
  up to 500.
- **Race:** 100 coins per correct answer, plus 20 extra for each correct answer in a row after the
  first (up to 100 extra). The first three to finish earn 300, 200 and 100 bonus coins.

## Privacy

Students type a nickname only. Nothing is sent to or stored on any server other than the
temporary connection through the broker. Quizzes you make stay in your own browser.
Fonts, the QR code library and PeerJS are bundled in this repository, so no student device loads
anything from a third party website.

## Credits

[PeerJS](https://peerjs.com) (MIT), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT),
[Poppins](https://github.com/itfoundry/poppins) font (SIL Open Font License). License details are in `vendor/` and `fonts/`.
