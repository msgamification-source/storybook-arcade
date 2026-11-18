// Optional: your own PeerJS broker, for when you do not want to rely on the free public one.
// Run it anywhere that runs Node (Render, Fly.io, Railway, a spare computer).
//   npm install
//   npm start
const { PeerServer } = require('peer');

const port = Number(process.env.PORT) || 9000;
PeerServer({ port, host: '0.0.0.0', path: '/', allow_discovery: false, proxied: true }, () => {
  console.log(`Quiz Party broker listening on port ${port}`);
});
