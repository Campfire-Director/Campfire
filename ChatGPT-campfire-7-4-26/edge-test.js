/* Tests the mid-game host reassignment and lobby kick. */
const { io } = require('socket.io-client');
const URL = 'http://localhost:3000';
const clients = {};
function fail(m){ console.error('EDGE TEST FAILED:', m); process.exit(1); }
function connect(n){ const c = io(URL); clients[n]=c; return c; }

// --- Test 1: kick from lobby ---
function testKick() {
  return new Promise((resolve) => {
    const host = connect('Host1');
    let kicked = false;
    host.on('connect', () => {
      host.emit('create_room', { name: 'Host1' }, (res) => {
        const code = res.code;
        const victim = connect('Victim');
        victim.on('kicked', () => { kicked = true; });
        victim.on('connect', () => {
          victim.emit('join_room', { code, name: 'Victim' }, () => {
            setTimeout(() => host.emit('kick_player', { name: 'Victim' }), 200);
            setTimeout(() => {
              if (!kicked) fail('victim never received kicked event');
              // host should now see only itself
              resolve();
            }, 600);
          });
        });
      });
    });
    host.on('state', (st) => {
      if (st.phase === 'lobby' && st.players.length === 1 && kicked) {
        console.log('KICK OK — victim removed, host sees', st.players.length, 'player');
      }
    });
  });
}

// --- Test 2: host disconnect mid-game reassigns control ---
function testHostReassign() {
  return new Promise((resolve) => {
    const host = connect('HostA');
    let started = false, reassignSeen = false;
    host.on('connect', () => {
      host.emit('create_room', { name: 'HostA' }, (res) => {
        const code = res.code;
        let joined = 0;
        ['Bee', 'Cee'].forEach(n => {
          const c = connect(n);
          c.on('connect', () => c.emit('join_room', { code, name: n }, () => {
            if (++joined === 2) {
              host.emit('update_settings', { seconds: 120 });
              setTimeout(() => host.emit('start_game'), 150);
            }
          }));
          // Bee watches for whether it becomes host/director after HostA drops
          c.on('state', (st) => {
            if (st.phase === 'writing' && !started) {
              started = true;
              // Kill the host connection mid-writing
              setTimeout(() => host.disconnect(), 200);
            }
            if (started && (st.isHost || st.youAreDirector) && n === 'Bee' && !reassignSeen) {
              reassignSeen = true;
              console.log('HOST REASSIGN OK — control passed to a connected player after host dropped');
              resolve();
            }
          });
        });
      });
    });
    setTimeout(() => { if (!reassignSeen) fail('host control never reassigned after disconnect'); }, 8000);
  });
}

(async () => {
  await testKick();
  await testHostReassign();
  console.log('ALL EDGE TESTS PASSED');
  process.exit(0);
})();
setTimeout(() => fail('edge tests timed out'), 20000);
