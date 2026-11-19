// Storybook Arcade settings. Change these to rebrand or tune the game.

export const APP_NAME = 'Storybook Arcade';
export const BYLINE = 'by Ms. Gamification';
export const MAX_PLAYERS = 60;

// Live games use PeerJS (WebRTC) so the site can live on free static hosting.
// By default it uses the free public PeerJS broker. To use your own broker or
// add a TURN server for strict school networks, set this BEFORE the app loads,
// for example in index.html:
//   <script>window.STORYBOOK_ARCADE_PEER_OPTIONS = { host: 'your-server.com', port: 443, secure: true,
//     config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };</script>
// (The older name QUIZ_PARTY_PEER_OPTIONS still works too.)
export const PEER_OPTIONS = Object.assign({ debug: 0 }, window.QUIZ_PARTY_PEER_OPTIONS || {}, window.STORYBOOK_ARCADE_PEER_OPTIONS || {});

// Custom sounds. To use your own sound effect, put the file (mp3, ogg or wav) in assets/sounds/
// and list it here. Anything left out keeps the built-in beep. The names you can use are:
//   join       a player joins
//   countdown  each 3, 2, 1 beep
//   start      the game or a question begins
//   correct    a right answer
//   wrong      a wrong answer
//   tick       the last 5 seconds of a question
//   win        the podium
//   click      tapping an answer
//   coin       finding coins behind a gate (Treasure Gates)
//   hit        a student hits the boss (Class vs. the Boss)
//   steal      a steal (Treasure Gates)
//   jackpot    finding the jackpot (Treasure Gates)
export const SOUND_FILES = {
  // correct: 'assets/sounds/correct.mp3',
  // wrong: 'assets/sounds/wrong.mp3',
};

// The reliable connection (recommended for schools). Paste the address of your free Firebase
// Realtime Database here, for example: 'https://storybook-arcade-12345-default-rtdb.firebaseio.com'
// With it set, games connect through ordinary web traffic that school networks almost always allow.
// Leave it empty to use the direct (PeerJS) connection only. Setup steps are in the README.
const MY_DATABASE = 'https://storybook-arcade-default-rtdb.firebaseio.com';
// (Tests and advanced setups can override this before the app loads with window.STORYBOOK_ARCADE_RELAY_URL.
// An empty string turns the reliable connection off.)
export const RELAY_URL = (typeof window !== 'undefined' && typeof window.STORYBOOK_ARCADE_RELAY_URL === 'string')
  ? window.STORYBOOK_ARCADE_RELAY_URL : MY_DATABASE;
