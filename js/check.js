// The connection check: finds out why a device can not join a game.
//
// Live games need three things to work:
//   1. the connection service (the "broker") that helps two devices find each other
//   2. a direct path between the devices (STUN)
//   3. a backup relay (TURN) for devices on different networks, like cell data and school Wi-Fi
// This runs a small test of each one on the device you are holding.

import { PEER_OPTIONS } from './config.js';
import { relayConfigured, testRelay } from './relay.js';

const getPeer = () => window.Peer || (window.peerjs && window.peerjs.Peer);
export const hasWebRTC = () => typeof RTCPeerConnection === 'function';

// The same relay and STUN servers the game itself uses.
export function iceServers() {
  const mine = PEER_OPTIONS.config && PEER_OPTIONS.config.iceServers;
  if (mine && mine.length) return mine;
  return (window.peerjs && window.peerjs.util && window.peerjs.util.defaultConfig && window.peerjs.util.defaultConfig.iceServers) || [];
}

export function testBroker(ms = 9000) {
  return new Promise((resolve) => {
    const P = getPeer();
    if (!P) return resolve(false);
    let peer;
    let finished = false;
    const end = (ok) => { if (finished) return; finished = true; clearTimeout(t); try { peer.destroy(); } catch { /* ignore */ } resolve(ok); };
    const t = setTimeout(() => end(false), ms);
    try { peer = new P({ ...PEER_OPTIONS }); } catch { return end(false); }
    peer.on('open', () => end(true));
    peer.on('error', () => end(false));
  });
}

// Ask the browser to find ways to reach this device and report which kinds it found.
// "srflx" means the direct path works. "relay" means the backup relay works.
export function gather(policy, ms = 8000) {
  return new Promise((resolve) => {
    if (!hasWebRTC()) return resolve({ srflx: false, relay: false, host: false });
    const found = { srflx: false, relay: false, host: false };
    let pc;
    let finished = false;
    const end = () => { if (finished) return; finished = true; clearTimeout(t); try { pc.close(); } catch { /* ignore */ } resolve(found); };
    const t = setTimeout(end, ms);
    try { pc = new RTCPeerConnection({ iceServers: iceServers(), iceTransportPolicy: policy }); } catch { return end(); }
    pc.createDataChannel('check');
    pc.onicecandidate = (e) => {
      if (!e.candidate) return end();
      const m = / typ (host|srflx|relay)/.exec(e.candidate.candidate || '');
      if (m) found[m[1]] = true;
      if (policy === 'relay' && found.relay) end();
    };
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(end);
  });
}

// What the results mean, in words a teacher can act on.
// hub: true or false if the reliable connection is set up, null if it is not.
export function verdict({ broker, direct, relay, hub = null }) {
  if (hub === true) {
    return {
      level: 'good',
      title: 'The reliable connection works on this device.',
      text: 'Games use this connection first. It only needs ordinary web access, so it should work on almost any school network.',
    };
  }
  const tail = hub === false ? ' The reliable connection could not be reached from here either, so check that the database address in the settings is right.' : '';
  if (!broker) {
    return {
      level: 'bad',
      title: 'This device can not reach the connection service.',
      text: 'The game needs a small free service to introduce devices to each other, and this network is blocking it or it is having a bad moment. Try another network (like a phone hotspot) or try again in a few minutes.' + tail,
    };
  }
  if (direct && relay) {
    return { level: 'good', title: 'Direct connections should work here.', text: 'Devices on this network should be able to join. If a student still cannot, run this check on their device too.' + tail };
  }
  if (direct && !relay) {
    return {
      level: 'warn',
      title: 'Direct connections might work, but this network is limiting them.',
      text: 'The backup route is blocked here. Devices on the same network may or may not be able to reach each other, because many school networks stop it. Devices on other networks (like cell data) probably will not. The reliable connection setup avoids this problem.' + tail,
    };
  }
  return {
    level: 'bad',
    title: 'This network blocks the kind of connection live games use.',
    text: 'Direct connections between devices will not work here, and some school networks block even devices on the same Wi-Fi. The reliable connection setup is the fix. You can also try a different network, like a phone hotspot.' + tail,
  };
}

// Runs everything. onStep(name, state) is called with 'run' and then 'ok' or 'bad'.
export async function runCheck(onStep = () => {}) {
  const out = { broker: false, direct: false, relay: false, hub: null, webrtc: hasWebRTC() };
  if (relayConfigured()) {
    onStep('hub', 'run');
    out.hub = (await testRelay()) === 'ok';
    onStep('hub', out.hub ? 'ok' : 'bad');
  }
  onStep('broker', 'run'); out.broker = await testBroker(); onStep('broker', out.broker ? 'ok' : 'bad');
  onStep('direct', 'run'); const d = await gather('all'); out.direct = d.srflx; onStep('direct', out.direct ? 'ok' : 'bad');
  onStep('relay', 'run'); const r = await gather('relay'); out.relay = r.relay; onStep('relay', out.relay ? 'ok' : 'bad');
  out.verdict = verdict(out);
  return out;
}
