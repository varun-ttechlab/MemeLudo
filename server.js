const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const os = require('os');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const COLORS = ['red', 'blue', 'yellow', 'green'];
const PLAYER_START = { red: 0, blue: 13, yellow: 26, green: 39 };

const rooms = {};
const sessions = {};

function generateSessionToken() {
  return crypto.randomUUID();
}

function getConnectedCount(room) {
  return Object.values(room.players).filter(p => p.connected !== false).length;
}

function startTurnTimer(roomId) {
  const room = rooms[roomId];
  if (!room || !room.started || room.phase === 'finished') return;
  if (room.turnTimer) clearTimeout(room.turnTimer);
  room.turnTimer = setTimeout(() => {
    if (!rooms[roomId] || rooms[roomId].phase === 'finished') return;
    const player = rooms[roomId].players[rooms[roomId].turnOrder[rooms[roomId].currentTurnIndex]];
    if (player) {
      io.to(roomId).emit('turn_timeout', {
        playerId: room.turnOrder[room.currentTurnIndex],
        playerName: player.name
      });
    }
    advanceTurn(roomId);
  }, 60000);
}

function clearTurnTimer(room) {
  if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
}

function currentRoomOf(socketId) {
  for (const [roomId, room] of Object.entries(rooms)) {
    if (room.players[socketId]) return roomId;
  }
  return null;
}

// Turn order follows COLORS, but only for colors actually in play — players can
// leave the lobby, so the used colors are not necessarily a contiguous prefix.
function buildTurnOrder(room) {
  return COLORS
    .map(c => Object.keys(room.players).find(sid => room.players[sid].color === c))
    .filter(Boolean);
}

function removeFromRoom(socket, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  const player = room.players[socket.id];
  if (!player) return;

  if (player.sessionToken) delete sessions[player.sessionToken];
  if (player.disconnectTimeout) clearTimeout(player.disconnectTimeout);

  delete room.players[socket.id];
  room.turnOrder = room.turnOrder.filter(id => id !== socket.id);
  socket.leave(roomId);

  if (Object.keys(room.players).length === 0) {
    clearTurnTimer(room);
    delete rooms[roomId];
    console.log(`Room ${roomId} deleted (players left)`);
    return;
  }

  if (room.hostId === socket.id) room.hostId = room.turnOrder[0];
  io.to(roomId).emit('player_left', {
    players: Object.entries(room.players).map(([id, p]) => ({
      id, name: p.name, color: p.color, connected: p.connected !== false
    })),
    hostId: room.hostId
  });
  console.log(`${player.name} left room ${roomId}`);
}

function advanceTurn(roomId) {
  const room = rooms[roomId];
  if (!room || !room.started) return;
  const startIdx = room.currentTurnIndex;
  let safety = 0;
  do {
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
    safety++;
  } while (
    safety < 8 &&
    (room.players[room.turnOrder[room.currentTurnIndex]].finished === 4 ||
     room.players[room.turnOrder[room.currentTurnIndex]].connected === false)
  );
  room.phase = 'rolling';
  io.to(roomId).emit('turn_change', {
    playerId: room.turnOrder[room.currentTurnIndex],
    playerName: room.players[room.turnOrder[room.currentTurnIndex]].name
  });
  startTurnTimer(roomId);
}

function sendFullState(socket, room, player) {
  const playerList = Object.entries(room.players).map(([id, p]) => ({
    id, name: p.name, color: p.color, connected: p.connected !== false
  }));
  const state = {
    type: 'full_state',
    roomId: room.id,
    networkUrl: getNetworkUrl(),
    playerColor: player.color,
    players: playerList,
    hostId: room.hostId,
    started: room.started,
    phase: room.phase
  };
  if (room.started) {
    state.turnOrder = room.turnOrder.map(sid => room.players[sid].name);
    state.currentTurnName = room.players[room.turnOrder[room.currentTurnIndex]].name;
    state.diceValue = room.diceValue;
    state.tokens = {};
    state.finished = {};
    for (const c of COLORS) {
      const p = Object.values(room.players).find(pl => pl.color === c);
      state.tokens[c] = p ? [...p.tokens] : [-1, -1, -1, -1];
      state.finished[c] = p ? p.finished : 0;
    }
    if (room.phase === 'moving' && room.turnOrder[room.currentTurnIndex] === player.id) {
      const p = room.players[player.id];
      state.movableTokens = [];
      p.tokens.forEach((tk, i) => {
        if (canMoveToken(p, i, room.diceValue)) state.movableTokens.push(i);
      });
    } else {
      state.movableTokens = [];
    }
    if (room.winner) {
      state.winner = {
        id: room.winner,
        name: room.players[room.winner].name,
        color: room.players[room.winner].color
      };
    }
  }
  socket.emit('game_state', state);
}

function cryptoDie() {
  return crypto.randomInt(1, 7);
}

function generateRoomCode() {
  return 'ML' + crypto.randomInt(1000, 9999);
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) candidates.push({ name, address: net.address });
    }
  }
  const physical = candidates.find(({ name }) =>
    /wi-?fi|wireless|ethernet/i.test(name) &&
    !/vpn|virtual|openvpn|tap|tun|docker|wsl|hyper-v|vethernet/i.test(name)
  );
  return (physical || candidates.find(({ address }) =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(address)
  ) || candidates[0] || { address: '127.0.0.1' }).address;
}

function getNetworkUrl() {
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
  if (publicUrl) return publicUrl.replace(/\/$/, '');
  const port = process.env.PORT || 3000;
  return `http://${getLocalIP()}:${port}`;
}

function createInitialState() {
  return { tokens: [-1, -1, -1, -1], finished: 0, consecutiveSixes: 0 };
}

function getPlayerAtPosition(room, boardPos, excludePlayerId) {
  const result = [];
  for (const [sid, p] of Object.entries(room.players)) {
    if (sid === excludePlayerId) continue;
    p.tokens.forEach((tk, idx) => {
      if (tk >= 0 && tk <= 51) {
        const globalPos = (PLAYER_START[p.color] + tk) % 52;
        if (globalPos === boardPos) {
          result.push({ playerId: sid, tokenIndex: idx });
        }
      }
    });
  }
  return result;
}

function checkWin(room, playerId) {
  return room.players[playerId].tokens.every(t => t === 57);
}

function canMoveToken(player, tokenIdx, diceValue) {
  const pos = player.tokens[tokenIdx];
  if (pos === 57) return false;
  if (pos === -1) return diceValue === 6;
  const target = pos + diceValue;
  if (target > 57) return false;
  return true;
}

function applyMove(room, playerId, tokenIdx, diceValue) {
  const player = room.players[playerId];

  if (player.tokens[tokenIdx] === -1) {
    player.tokens[tokenIdx] = 0;
    const startGlobal = PLAYER_START[player.color];
    const captured = getPlayerAtPosition(room, startGlobal, playerId);
    for (const cap of captured) {
      room.players[cap.playerId].tokens[cap.tokenIndex] = -1;
    }
    return {
      captured: captured.length > 0,
      capturedPlayers: captured.map(cap => ({
        playerId: cap.playerId,
        playerName: room.players[cap.playerId]?.name || 'A player',
        playerColor: room.players[cap.playerId]?.color || null
      }))
    };
  }

  const newPos = player.tokens[tokenIdx] + diceValue;
  player.tokens[tokenIdx] = newPos > 57 ? 57 : newPos;

  if (player.tokens[tokenIdx] === 57) {
    player.finished++;
    return { finished: true };
  }

  let captured = false;
  const capturedPlayers = [];
  const tPos = player.tokens[tokenIdx];
  if (tPos >= 0 && tPos <= 51) {
    const globalPos = (PLAYER_START[player.color] + tPos) % 52;
    const atPos = getPlayerAtPosition(room, globalPos, playerId);
    for (const cap of atPos) {
      const capPlayer = room.players[cap.playerId];
      const capTokenCount = capPlayer.tokens.filter(t => {
        if (t < 0 || t > 51) return false;
        return (PLAYER_START[capPlayer.color] + t) % 52 === globalPos;
      }).length;
      if (capTokenCount === 1) {
        capPlayer.tokens[cap.tokenIndex] = -1;
        captured = true;
        capturedPlayers.push({
          playerId: cap.playerId,
          playerName: capPlayer.name,
          playerColor: capPlayer.color
        });
      }
    }
  }

  return { captured, capturedPlayers };
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create_room', ({ playerName }) => {
    // A socket can only be in one room; drop the old one instead of orphaning it.
    const previous = currentRoomOf(socket.id);
    if (previous) removeFromRoom(socket, previous);

    let roomId = generateRoomCode();
    while (rooms[roomId]) roomId = generateRoomCode();
    rooms[roomId] = {
      id: roomId,
      players: {},
      turnOrder: [],
      currentTurnIndex: 0,
      diceValue: 0,
      phase: 'lobby',
      started: false,
      winner: null,
      memeIndex: 0,
      hostId: socket.id
    };
    const room = rooms[roomId];
    const sessionToken = generateSessionToken();
    sessions[sessionToken] = roomId;
    room.players[socket.id] = {
      id: socket.id, name: playerName || 'Player 1',
      color: 'red', ...createInitialState(),
      sessionToken, connected: true, disconnectTimeout: null
    };
    room.turnOrder = [socket.id];
    socket.join(roomId);
    socket.emit('room_created', {
      roomId, networkUrl: getNetworkUrl(), players: [{ id: socket.id, name: playerName || 'Player 1', color: 'red' }],
      playerColor: 'red', hostId: socket.id, sessionToken
    });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    roomId = String(roomId || '').trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) return socket.emit('error', { message: 'Room not found' });
    if (room.started) return socket.emit('error', { message: 'Game already started' });
    if (Object.keys(room.players).length >= 4)
      return socket.emit('error', { message: 'Room is full' });

    const previous = currentRoomOf(socket.id);
    if (previous === roomId)
      return socket.emit('error', { message: 'You are already in this room' });
    if (previous) removeFromRoom(socket, previous);

    // Pick the first free colour rather than indexing by player count — a player
    // leaving the lobby would otherwise hand a duplicate colour to the next joiner.
    const used = new Set(Object.values(room.players).map(p => p.color));
    const color = COLORS.find(c => !used.has(c));
    if (!color) return socket.emit('error', { message: 'Room is full' });

    const sessionToken = generateSessionToken();
    sessions[sessionToken] = roomId;
    room.players[socket.id] = {
      id: socket.id, name: playerName || `Player ${COLORS.indexOf(color) + 1}`,
      color, ...createInitialState(),
      sessionToken, connected: true, disconnectTimeout: null
    };
    room.turnOrder.push(socket.id);
    socket.join(roomId);

    const playerList = Object.entries(room.players).map(([id, p]) => ({
      id, name: p.name, color: p.color
    }));

    io.to(roomId).emit('player_joined', { players: playerList, playerColor: color });
    socket.emit('room_joined', { roomId, networkUrl: getNetworkUrl(), players: playerList, playerColor: color, hostId: room.hostId, sessionToken });

    if (Object.keys(room.players).length === 4) {
      room.started = true;
      room.phase = 'rolling';
      room.turnOrder = buildTurnOrder(room);
      io.to(roomId).emit('game_start', {
        turnOrder: room.turnOrder.map(sid => room.players[sid].name),
        players: Object.entries(room.players).map(([sid, p]) => ({
          id: sid, name: p.name, color: p.color
        }))
      });
    }
  });

  socket.on('roll_dice', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.started) return;
    if (room.phase !== 'rolling') return;
    if (room.turnOrder[room.currentTurnIndex] !== socket.id) return;

    const player = room.players[socket.id];
    const diceValue = cryptoDie();
    room.diceValue = diceValue;
    room.phase = 'moving';
    clearTurnTimer(room);

    if (diceValue === 6) {
      player.consecutiveSixes++;
    } else {
      player.consecutiveSixes = 0;
    }

    const movableTokens = [];
    player.tokens.forEach((tk, i) => {
      if (canMoveToken(player, i, diceValue)) movableTokens.push(i);
    });

    io.to(roomId).emit('dice_rolled', {
      playerId: socket.id, playerName: player.name,
      diceValue, movableTokens
    });

    if (movableTokens.length === 0) {
      setTimeout(() => {
        if (player.consecutiveSixes >= 3) {
          player.consecutiveSixes = 0;
        }
        advanceTurn(roomId);
      }, 600);
    }
  });

  socket.on('move_token', ({ roomId, tokenIndex }) => {
    const room = rooms[roomId];
    if (!room || room.phase !== 'moving') return;
    if (room.turnOrder[room.currentTurnIndex] !== socket.id) return;

    const player = room.players[socket.id];
    const diceValue = room.diceValue;

    if (!canMoveToken(player, tokenIndex, diceValue)) return;

    const result = applyMove(room, socket.id, tokenIndex, diceValue);

    io.to(roomId).emit('token_moved', {
      playerId: socket.id, playerName: player.name,
      tokenIndex, diceValue,
      newPos: player.tokens[tokenIndex],
      tokens: [...player.tokens],
      finished: player.finished,
      captured: result.captured,
      capture: result.captured ? {
        byPlayerId: socket.id,
        byPlayerName: player.name,
        byPlayerColor: player.color,
        victims: result.capturedPlayers,
        memeId: room.memeIndex++
      } : null
    });

    clearTurnTimer(room);

    if (checkWin(room, socket.id)) {
      room.winner = socket.id;
      room.phase = 'finished';
      io.to(roomId).emit('game_over', {
        winnerId: socket.id,
        winnerName: player.name,
        winnerColor: player.color
      });
      return;
    }

    if (diceValue === 6 && player.consecutiveSixes < 3) {
      room.phase = 'rolling';
      io.to(roomId).emit('turn_change', {
        playerId: socket.id, playerName: player.name,
        extraTurn: true
      });
    } else {
      if (player.consecutiveSixes >= 3) {
        player.consecutiveSixes = 0;
      }
      advanceTurn(roomId);
    }
  });

  socket.on('restart_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.hostId !== socket.id) return;
    for (const p of Object.values(room.players)) {
      Object.assign(p, createInitialState());
    }
    clearTurnTimer(room);
    room.currentTurnIndex = 0;
    room.diceValue = 0;
    room.phase = 'rolling';
    room.started = true;
    room.winner = null;
    room.memeIndex = 0;
    room.turnOrder = buildTurnOrder(room);
    io.to(roomId).emit('game_restarted', {
      turnOrder: room.turnOrder.map(sid => room.players[sid].name),
      players: Object.entries(room.players).map(([sid, p]) => ({
        id: sid, name: p.name, color: p.color
      }))
    });
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.started) return;
    if (room.hostId !== socket.id) return;
    const count = Object.keys(room.players).length;
    if (count < 2) {
      return socket.emit('error', { message: 'Invite at least one friend before starting.' });
    }

    room.started = true;
    room.phase = 'rolling';
    room.turnOrder = buildTurnOrder(room);
    io.to(roomId).emit('game_start', {
      turnOrder: room.turnOrder.map(sid => room.players[sid].name),
      players: Object.entries(room.players).map(([sid, p]) => ({
        id: sid, name: p.name, color: p.color
      }))
    });
  });

  socket.on('end_room', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    if (room.hostId !== socket.id) return;

    // Notify all players
    io.to(roomId).emit('room_ended', { roomId });

    // Clean up all sessions for this room
    for (const [token, rid] of Object.entries(sessions)) {
      if (rid === roomId) delete sessions[token];
    }
    for (const sid of Object.keys(room.players)) {
      const p = room.players[sid];
      if (p.disconnectTimeout) clearTimeout(p.disconnectTimeout);
    }
    delete rooms[roomId];
    console.log(`Room ${roomId} ended by host`);
  });

  socket.on('leave_room', ({ roomId }) => {
    removeFromRoom(socket, roomId);
  });

  socket.on('forfeit_game', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.started || room.phase === 'finished') return;
    const player = room.players[socket.id];
    if (!player || player.finished >= 4) return;

    player.tokens = [57, 57, 57, 57];
    player.finished = 4;
    clearTurnTimer(room);

    io.to(roomId).emit('player_forfeited', {
      playerId: socket.id, playerName: player.name, playerColor: player.color
    });

    // Check if only one active player remains
    const active = Object.entries(room.players).filter(([, p]) => p.finished < 4);
    if (active.length <= 1) {
      if (active.length === 1) {
        const wid = active[0][0];
        room.winner = wid;
        room.phase = 'finished';
        io.to(roomId).emit('game_over', {
          winnerId: wid, winnerName: room.players[wid].name, winnerColor: room.players[wid].color
        });
      }
      return;
    }

    // Advance turn if forfeiter was the current player
    if (room.turnOrder[room.currentTurnIndex] === socket.id) {
      advanceTurn(roomId);
    }
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players[socket.id]) {
        const player = room.players[socket.id];
        player.connected = false;
        console.log(`${player.name} disconnected (session: ${player.sessionToken.substring(0,8)}...)`);

        // Notify others
        const playerList = Object.entries(room.players).map(([id, p]) => ({
          id, name: p.name, color: p.color, connected: p.connected !== false
        }));
        if (room.started) {
          io.to(roomId).emit('player_disconnected', {
            playerId: socket.id, playerName: player.name, players: playerList
          });
        } else {
          io.to(roomId).emit('player_left', { players: playerList, hostId: room.hostId });
        }

        // Cleanup timer: remove player after 5 minutes
        player.disconnectTimeout = setTimeout(() => {
          if (sessions[player.sessionToken]) delete sessions[player.sessionToken];
          if (!rooms[roomId]) return;
          delete rooms[roomId].players[socket.id];
          rooms[roomId].turnOrder = rooms[roomId].turnOrder.filter(id => id !== socket.id);
          if (Object.keys(rooms[roomId].players).length === 0) {
            // Clean up all sessions for this room
            for (const [token, rid] of Object.entries(sessions)) {
              if (rid === roomId) delete sessions[token];
            }
            delete rooms[roomId];
            console.log(`Room ${roomId} deleted (all players left)`);
          } else {
            if (rooms[roomId].hostId === socket.id) {
              rooms[roomId].hostId = rooms[roomId].turnOrder[0];
            }
            const updatedList = Object.entries(rooms[roomId].players).map(([id, p]) => ({
              id, name: p.name, color: p.color
            }));
            io.to(roomId).emit('player_left', { players: updatedList, hostId: rooms[roomId].hostId });
          }
        }, 5 * 60 * 1000);

        // If it's this player's turn in an active game, advance
        if (room.started && room.turnOrder[room.currentTurnIndex] === socket.id) {
          clearTurnTimer(room);
          io.to(roomId).emit('dice_log', { message: player.name + ' disconnected — skipping turn' });
          setTimeout(() => {
            if (rooms[roomId] && rooms[roomId].turnOrder[rooms[roomId].currentTurnIndex] === socket.id) {
              advanceTurn(roomId);
            }
          }, 1500);
        }

        break;
      }
    }
  });

  socket.on('session_reconnect', ({ sessionToken }) => {
    const roomId = sessions[sessionToken];
    if (!roomId) {
      return socket.emit('error', { message: 'Session expired — room no longer exists' });
    }
    const room = rooms[roomId];
    if (!room) {
      delete sessions[sessionToken];
      return socket.emit('error', { message: 'Session expired — room no longer exists' });
    }

    // Find player by sessionToken
    let foundPlayer = null;
    let oldSocketId = null;
    for (const [sid, p] of Object.entries(room.players)) {
      if (p.sessionToken === sessionToken) {
        foundPlayer = p;
        oldSocketId = sid;
        break;
      }
    }
    if (!foundPlayer) {
      delete sessions[sessionToken];
      return socket.emit('error', { message: 'Session expired — player not found' });
    }

    // Cancel disconnect cleanup timer
    if (foundPlayer.disconnectTimeout) {
      clearTimeout(foundPlayer.disconnectTimeout);
      foundPlayer.disconnectTimeout = null;
    }

    // Remove old socket entry
    delete room.players[oldSocketId];

    // Update player with new socket id
    foundPlayer.id = socket.id;
    foundPlayer.connected = true;
    room.players[socket.id] = foundPlayer;

    // Update turnOrder
    room.turnOrder = room.turnOrder.map(id => id === oldSocketId ? socket.id : id);

    // Update hostId
    if (room.hostId === oldSocketId) room.hostId = socket.id;

    // Join new socket to room
    socket.join(roomId);

    // Update sessions reference (in case roomId changed, though it shouldn't)
    sessions[sessionToken] = roomId;

    console.log(`${foundPlayer.name} reconnected to room ${roomId}`);

    // Notify others
    const pList = Object.entries(room.players).map(([id, p]) => ({
      id, name: p.name, color: p.color, connected: true
    }));
    io.to(roomId).emit('player_reconnected', {
      playerId: socket.id, playerName: foundPlayer.name, players: pList, hostId: room.hostId
    });

    // Send full game state to reconnecting player
    sendFullState(socket, room, foundPlayer);

    // If game was started and stuck on this player's turn, unstick it
    if (room.started && room.turnOrder[room.currentTurnIndex] === socket.id && room.phase !== 'rolling' && room.phase !== 'moving') {
      room.phase = 'rolling';
      io.to(roomId).emit('turn_change', {
        playerId: socket.id, playerName: foundPlayer.name
      });
    }
  });

  socket.on('list_rooms', () => {
    const available = Object.entries(rooms)
      .filter(([, r]) => !r.started && Object.keys(r.players).length < 4)
      .map(([id, r]) => ({
        roomId: id,
        playerCount: Object.keys(r.players).length,
        hostName: r.players[r.hostId]?.name || 'Unknown'
      }));
    socket.emit('room_list', available);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  Meme Ludo Server');
  console.log('  ' + '='.repeat(30));
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${ip}:${PORT}`);
  console.log(`  Share:   ${getNetworkUrl()}`);
  console.log('  ' + '='.repeat(30));
  console.log('');
});
