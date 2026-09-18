const http = require('http');
const { io: Client } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const COLORS = ['red', 'blue', 'yellow', 'green'];
const PLAYER_NAMES = ['Player1', 'Player2', 'Player3', 'Player4'];

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.log('  FAIL: ' + msg);
    failed++;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(SERVER_URL + path, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function testPageLoads() {
  console.log('\n=== Testing Page Loads ===');
  const r = await httpGet('/');
  assert(r.status === 200, 'index.html returns 200');
  assert(r.body.includes('MEME'), 'Page contains Meme Ludo title');
  assert(r.body.includes('playerName'), 'Page has playerName input');
  assert(r.body.includes('roomCodeInput'), 'Page has roomCodeInput input');
  assert(r.body.includes('btnCreateRoom'), 'Page has Create Room button');
  assert(r.body.includes('btnJoinRoom'), 'Page has Join Room button');

  const css = await httpGet('/style.css');
  assert(css.status === 200, 'style.css returns 200');
  assert(!css.body.includes('googleapis'), 'No Google Fonts dependency');

  const js = await httpGet('/js/game.js');
  assert(js.status === 200, 'game.js returns 200');
  assert(!js.body.includes('onkeydown'), 'No onkeydown assignments in JS (should use addEventListener)');
  assert(js.body.includes('addEventListener'), 'JS uses addEventListener');

  const socketIO = await httpGet('/socket.io/socket.io.js');
  assert(socketIO.status === 200, 'socket.io.js served');
}

async function testGameFlow() {
  console.log('\n=== Testing 4-Player Game Flow ===');

  const sockets = [];
  const results = {};

  for (let i = 0; i < 4; i++) {
    const s = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    results[i] = { name: PLAYER_NAMES[i], color: null, roomId: null, events: [] };

    s.on('connect', () => {
      console.log(`  Socket ${i} connected: ${s.id}`);
    });

    s.onAny((event, data) => {
      results[i].events.push({ event, data });
    });
  }

  await sleep(500);

  // Player 0 creates a room
  console.log('\n  -- Player 1 creates room --');
  const roomPromise = new Promise(resolve => {
    sockets[0].once('room_created', data => {
      results[0].roomId = data.roomId;
      results[0].color = data.playerColor;
      console.log(`  Room created: ${data.roomId}, color: ${data.playerColor}`);
      resolve(data);
    });
  });
  sockets[0].emit('create_room', { playerName: 'Player1' });
  const roomData = await roomPromise;
  assert(!!roomData.roomId, 'Room ID generated');
  assert(roomData.roomId.startsWith('ML'), 'Room ID starts with ML');
  assert(results[0].color === 'red', 'Host gets red color');
  assert(roomData.players.length === 1, 'Room has 1 player initially');

  // Player 1, 2, 3 join
  for (let i = 1; i < 4; i++) {
    console.log(`\n  -- Player ${i+1} joins room --`);
    const joinPromise = new Promise(resolve => {
      sockets[i].once('room_joined', data => {
        results[i].roomId = data.roomId;
        results[i].color = data.playerColor;
        console.log(`  Player ${i+1} joined: color=${data.playerColor}`);
        resolve(data);
      });
    });
    sockets[i].emit('join_room', { roomId: results[0].roomId, playerName: PLAYER_NAMES[i] });
    await joinPromise;
    assert(results[i].color === COLORS[i], `Player ${i+1} gets correct color: ${COLORS[i]}`);
  }

  await sleep(500);

  // Check that game started
  const gameStartEvents = results[3].events.filter(e => e.event === 'game_start');
  assert(gameStartEvents.length > 0, 'Game started for all 4 players');

  // Find the first player's turn
  let turnOrder = [];
  let currentTurnName = '';

  for (const r of Object.values(results)) {
    const gs = r.events.find(e => e.event === 'game_start');
    if (gs) {
      turnOrder = gs.data.turnOrder;
      currentTurnName = turnOrder[0];
      break;
    }
  }
  assert(turnOrder.length === 4, 'Turn order has 4 players');
  assert(currentTurnName === 'Player1', 'Player1 starts first');
  console.log(`  Turn order: ${turnOrder.join(' > ')}`);

  // Determine the server's turn order info from game_start
  let playerById = {};
  for (const r of Object.values(results)) {
    const gs = r.events.find(e => e.event === 'game_start');
    if (gs && gs.data.players) {
      for (const p of gs.data.players) {
        playerById[p.name] = p.id;
      }
    }
  }

  // Find which socket goes first
  let firstPlayerSocketIdx = -1;
  for (let i = 0; i < 4; i++) {
    if (PLAYER_NAMES[i] === currentTurnName) {
      firstPlayerSocketIdx = i;
      break;
    }
  }
  assert(firstPlayerSocketIdx >= 0, 'Found first player socket');

  console.log(`\n  -- Player ${firstPlayerSocketIdx+1} rolls dice --`);
  const dicePromise = new Promise(resolve => {
    sockets[firstPlayerSocketIdx].once('dice_rolled', data => {
      console.log(`  Rolled: ${data.diceValue}, movable tokens: ${data.movableTokens.length}`);
      resolve(data);
    });
  });
  sockets[firstPlayerSocketIdx].emit('roll_dice', { roomId: results[0].roomId });
  const diceData = await dicePromise;
  assert(diceData.diceValue >= 1 && diceData.diceValue <= 6, 'Dice value between 1 and 6');

  if (diceData.movableTokens && diceData.movableTokens.length > 0) {
    const tokenIdx = diceData.movableTokens[0];
    console.log(`  Moving token ${tokenIdx}`);
    sockets[firstPlayerSocketIdx].emit('move_token', { roomId: results[0].roomId, tokenIndex: tokenIdx });
    await sleep(300);
  }

  await sleep(1200);

  // Check that turn changed after roll (server delays 600ms for no-move case)
  const turnChanges = [];
  for (const r of Object.values(results)) {
    const tc = r.events.filter(e => e.event === 'turn_change');
    turnChanges.push(...tc);
  }
  const hasTurnChange = turnChanges.some(tc => tc.data && tc.data.playerName);
  assert(hasTurnChange, 'Turn changes after roll/move');

  // Now play a round - keep rolling until someone gets a 6 and can move a token
  console.log('\n  -- Playing a round until a token moves --');
  let tokenMoved = false;
  let playerIdx = firstPlayerSocketIdx;

  // Find who is the current player
  const lastTC = turnChanges[turnChanges.length - 1];
  if (lastTC && lastTC.data && lastTC.data.playerName) {
    for (let i = 0; i < 4; i++) {
      if (PLAYER_NAMES[i] === lastTC.data.playerName) {
        playerIdx = i;
        break;
      }
    }
  }
  console.log(`  Current player: ${PLAYER_NAMES[playerIdx]}`);

  let attempts = 0;
  while (!tokenMoved && attempts < 20) {
    attempts++;
    const rollPromise = new Promise(res => {
      sockets[playerIdx].once('dice_rolled', res);
    });
    sockets[playerIdx].emit('roll_dice', { roomId: results[0].roomId });
    const rd = await rollPromise;
    console.log(`  ${PLAYER_NAMES[playerIdx]} rolled ${rd.diceValue}, movable: ${(rd.movableTokens||[]).length}`);

    if (rd.movableTokens && rd.movableTokens.length > 0) {
      const tokIdx = rd.movableTokens[0];
      const movePromise = new Promise(res => {
        sockets[playerIdx].once('token_moved', res);
      });
      sockets[playerIdx].emit('move_token', { roomId: results[0].roomId, tokenIndex: tokIdx });
      const md = await movePromise;
      tokenMoved = true;
      console.log(`  Token ${tokIdx} moved! New pos: ${md.newPos}, finished: ${md.finished}`);
      assert(md.playerName === PLAYER_NAMES[playerIdx], 'Token move attributed to correct player');
      assert(md.newPos >= 0, 'Token moved to valid position');
      assert(Object.prototype.hasOwnProperty.call(md, 'capture'), 'Token move includes meme capture payload slot');
    } else {
      // Wait for turn change
      await sleep(1000);
      // Find next player
      const newTCs = [];
      for (const r of Object.values(results)) {
        const tcs = r.events.filter(e => e.event === 'turn_change');
        newTCs.push(...tcs);
      }
      if (newTCs.length > turnChanges.length) {
        const nextTC = newTCs[newTCs.length - 1];
        if (nextTC && nextTC.data && nextTC.data.playerName) {
          for (let i = 0; i < 4; i++) {
            if (PLAYER_NAMES[i] === nextTC.data.playerName) {
              playerIdx = i;
              break;
            }
          }
          // Update turnChanges reference
          turnChanges.length = 0;
          turnChanges.push(...newTCs);
        }
      }
    }
  }
  assert(tokenMoved, 'Token was moved within 20 attempts');

  console.log('\n  -- Full game flow test completed --');
}

async function testListRooms() {
  console.log('\n=== Testing Room Listing ===');
  const s = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const listPromise = new Promise(resolve => {
    s.once('room_list', data => {
      resolve(data);
    });
  });
  s.emit('list_rooms');
  const rooms = await listPromise;
  assert(Array.isArray(rooms), 'Room list is an array');
  assert(rooms.length >= 0, 'Room list returned (0 or more rooms)');
  s.close();
}

async function testTwoPlayerManualStart() {
  console.log('\n=== Testing 2-Player Manual Start ===');
  const host = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  const guest = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const room = await new Promise(resolve => {
    host.once('room_created', resolve);
    host.emit('create_room', { playerName: 'Host' });
  });
  await new Promise(resolve => {
    guest.once('room_joined', resolve);
    guest.emit('join_room', { roomId: room.roomId, playerName: 'Guest' });
  });

  const starts = [0, 1].map((_, i) => new Promise(resolve => {
    (i === 0 ? host : guest).once('game_start', resolve);
  }));
  host.emit('start_game', { roomId: room.roomId });
  const startData = await Promise.race([starts[0], sleep(3000).then(() => null)]);
  assert(!!startData, 'Host can manually start a 2-player room');
  assert(startData && startData.turnOrder.length === 2, 'Manual start preserves both players');
  await Promise.race([starts[1], sleep(3000)]);
  host.close();
  guest.close();
}

async function testSessionReconnection() {
  console.log('\n=== Testing Session Reconnection ===');

  const s1 = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const roomCreated = await new Promise(resolve => {
    s1.once('room_created', resolve);
    s1.emit('create_room', { playerName: 'ReconnectTest' });
  });
  assert(!!roomCreated.sessionToken, 'Session token received on room creation');
  assert(roomCreated.roomId.startsWith('ML'), 'Room ID generated');

  console.log(`  Room: ${roomCreated.roomId}, Session: ${roomCreated.sessionToken.substring(0,12)}...`);

  // Simulate page refresh: disconnect old socket, create new one
  s1.close();
  await sleep(200);

  const s2 = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const gameState = await new Promise(resolve => {
    s2.once('game_state', resolve);
    s2.emit('session_reconnect', { sessionToken: roomCreated.sessionToken });
  });

  assert(gameState.type === 'full_state', 'Received full game state');
  assert(gameState.roomId === roomCreated.roomId, 'Room ID matches');
  assert(gameState.playerColor === 'red', 'Player color restored');
  assert(!!gameState.players, 'Players list received');
  assert(gameState.players.length === 1, 'One player in room');
  assert(gameState.started === false, 'Game not started (lobby)');
  console.log(`  Reconnected as ${gameState.playerColor} in ${gameState.roomId}`);

  // Verify error on bad session
  const errorPromise = new Promise(resolve => {
    s2.once('error', resolve);
    s2.emit('session_reconnect', { sessionToken: 'invalid-token' });
  });
  const err = await errorPromise;
  assert(!!err.message, 'Error on invalid session token');

  s2.close();

  // Test reconnection DURING a game (4-player) immediately after game start
  console.log('\n  -- Reconnection during active game --');
  const gsockets = [];
  const gtokens = [];
  for (let i = 0; i < 4; i++) {
    const s = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
    gsockets.push(s);
    gtokens.push(null);
    await sleep(100);
  }

  const grcData = await new Promise(resolve => {
    gsockets[0].once('room_created', resolve);
    gsockets[0].emit('create_room', { playerName: 'G1' });
  });
  gtokens[0] = grcData.sessionToken;

  // Set up game_start listeners BEFORE joining last player
  const gsPromises = [0, 1, 2, 3].map(i => new Promise(resolve => {
    gsockets[i].once('game_start', resolve);
  }));

  for (let i = 1; i < 4; i++) {
    const rj = await new Promise(resolve => {
      gsockets[i].once('room_joined', resolve);
      gsockets[i].emit('join_room', { roomId: grcData.roomId, playerName: 'G' + (i + 1) });
    });
    gtokens[i] = rj.sessionToken;
  }

  // Wait for all to receive game_start
  const gsData = await gsPromises[0];
  assert(gsData.turnOrder.length === 4, 'Game started with 4 players');

  // Reconnect the first player immediately
  const reconnPlayer = 0;
  gsockets[reconnPlayer].close();
  await sleep(300);

  const newSock = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const restored = await new Promise(resolve => {
    newSock.once('game_state', resolve);
    newSock.emit('session_reconnect', { sessionToken: gtokens[reconnPlayer] });
  });

  assert(restored.type === 'full_state', 'Game state restored on reconnect');
  assert(restored.roomId === grcData.roomId, 'Room ID matches in game');
  assert(restored.tokens && restored.tokens[restored.playerColor], 'Tokens state restored');
  assert(restored.turnOrder && restored.turnOrder.length === 4, 'Turn order restored');
  assert(restored.started === true, 'Game is marked as started');
  console.log(`  Reconnected to game as ${restored.playerColor} (started: ${restored.started})`);

  newSock.close();
  for (const s of gsockets) { try { s.close(); } catch(e) {} }
  console.log('  -- Reconnection during game completed --');
}

async function testForfeitAndTimer() {
  console.log('\n=== Testing Forfeit & Turn Timer ===');

  const socks = [];
  for (let i = 0; i < 4; i++) {
    const s = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
    socks.push(s);
    await sleep(100);
  }

  const rcData = await new Promise(res => { socks[0].once('room_created', res); socks[0].emit('create_room', { playerName: 'F1' }); });
  const gsPromises = [0, 1, 2, 3].map(i => new Promise(res => { socks[i].once('game_start', res); }));

  for (let i = 1; i < 4; i++) {
    await new Promise(res => { socks[i].once('room_joined', res); socks[i].emit('join_room', { roomId: rcData.roomId, playerName: 'F' + (i + 1) }); });
  }
  await gsPromises[0];

  const forfeitPromise = new Promise(res => { socks[1].once('player_forfeited', res); });
  socks[0].emit('forfeit_game', { roomId: rcData.roomId });
  const fd = await forfeitPromise;
  assert(fd.playerName === 'F1', 'Forfeit detected by other players');
  assert(fd.playerColor === 'red', 'Forfeit color matches');
  console.log(`  ${fd.playerName} (${fd.playerColor}) forfeited`);

  // Forfeit all remaining players to test auto-win
  console.log('  Forfeiting remaining players...');

  // F2 (blue) forfeits
  const f2Promise = new Promise(res => { socks[2].once('player_forfeited', function onF2() { res('f2'); }); });
  socks[1].emit('forfeit_game', { roomId: rcData.roomId });
  await Promise.race([f2Promise, sleep(3000)]);
  console.log('  F2 forfeited');

  // F4 (green) forfeits — leaves F3 (yellow) as last player standing
  const goOrF4 = new Promise(res => {
    socks[2].once('game_over', d => res({ type: 'game_over', data: d }));
  });
  // Also listen on socks[2] for player_forfeited in case F4 fires before game_over
  socks[3].emit('forfeit_game', { roomId: rcData.roomId });
  const result = await Promise.race([goOrF4, sleep(5000)]);
  if (!result) {
    assert(false, 'Game over not received within 5s after last forfeit');
  } else {
    assert(result.type === 'game_over', 'Received game_over event');
    assert(!!result.data.winnerName, 'Winner declared after all others forfeit');
    assert(result.data.winnerColor === 'yellow', 'Last remaining player wins');
    console.log(`  Winner: ${result.data.winnerName} (${result.data.winnerColor})`);
  }

  for (const s of socks) { try { s.close(); } catch(e) {} }
  console.log('  -- Forfeit & timer test completed --');
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  const s = Client(SERVER_URL, { transports: ['websocket'], forceNew: true });
  await sleep(300);

  const errorPromise = new Promise(resolve => {
    s.once('error', data => {
      resolve(data);
    });
  });
  s.emit('join_room', { roomId: 'ML0000', playerName: 'Test' });
  const err = await errorPromise;
  assert(!!err.message, 'Error message returned for invalid room');
  s.close();
}

async function main() {
  console.log('Meme Ludo - Test Suite');
  console.log('==========================\n');
  console.log(`Server: ${SERVER_URL}`);

  try {
    await testPageLoads();
    await sleep(300);

    // Check server is running first
    const ping = await httpGet('/');
    assert(ping.status === 200, 'Server is running');

    await testErrorHandling();
    await sleep(300);
    await testListRooms();
    await sleep(300);
    await testTwoPlayerManualStart();
    await sleep(300);
    await testGameFlow();
    await sleep(500);
    await testSessionReconnection();
    await sleep(500);
    await testForfeitAndTimer();

  } catch (e) {
    console.log('  ERROR: ' + e.message);
    console.log(e.stack);
    failed++;
  }

  console.log('\n==========================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
