// Quiz Party settings. Change these to rebrand or tune the game.

export const APP_NAME = 'Quiz Party';
export const BYLINE = 'by Ms. Gamification';
export const MAX_PLAYERS = 60;

// Live games use PeerJS (WebRTC) so the site can live on free static hosting.
// By default it uses the free public PeerJS broker. To use your own broker or
// add a TURN server for strict school networks, set this BEFORE the app loads,
// for example in index.html:
//   <script>window.QUIZ_PARTY_PEER_OPTIONS = { host: 'your-server.com', port: 443, secure: true,
//     config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };</script>
export const PEER_OPTIONS = Object.assign({ debug: 0 }, window.QUIZ_PARTY_PEER_OPTIONS || {});
