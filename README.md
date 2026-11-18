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
    { "text": "Which word is a noun?", "options": ["run", "puppy", "quickly"], "correct": 1, "time": 20 }
  ]
}
```

`correct` counts from 0 (the first answer is 0). `time` is seconds, from 5 to 120.

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
| Icons | `assets/icons/` | coins, streak flame, finish flag, trophy and more |
| Medals | `assets/medals/` | the podium and the end screen |
| Background pattern | `assets/pattern.png` | the faint doodles behind every screen |
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
js/host.js          the teacher's game screens and scoring
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
