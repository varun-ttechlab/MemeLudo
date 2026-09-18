(function () {
  'use strict';

  const openedFromFile = window.location.protocol === 'file:';
  const socket = !openedFromFile && typeof io === 'function' ? io() : null;
  const COLORS = ['red', 'blue', 'yellow', 'green'];
  const COLOR_MAP = {
    red: '#FF3333', blue: '#3366FF', yellow: '#FFD700', green: '#33FF33'
  };
  const COLOR_GLOW = {
    red: 'rgba(255,51,51,0.6)', blue: 'rgba(51,102,255,0.6)',
    yellow: 'rgba(255,215,0,0.6)', green: 'rgba(51,255,51,0.6)'
  };
  const PLAYER_START = { red: 0, blue: 13, yellow: 26, green: 39 };
  // Eight classic Ludo safe squares: four coloured starts plus four star cells.
  const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

  // Tenor embeds are the default meme source. Local media can still override
  // an entry later by changing its media object to image/video/audio.
  const MEMES = [
    { language: 'ಕನ್ನಡ', emoji: '😏', caption: 'ಸರಿ… ನೋಡೋಣ!', detail: 'Pawn sent home.', audio: '/memes/audio/capture-ranganna.mp3', media: { type: 'tenor', postId: '20246542', aspectRatio: '1.53846', href: 'https://tenor.com/view/kannada-rachita-ram-gifs-gif-20246542', label: 'Kannada Rachita GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '🤷', caption: 'ಯಾಕೆ? ಏನಾಯ್ತು?', detail: 'ಒಂದು roll… full damage.', media: { type: 'tenor', postId: '8891559540113239220', aspectRatio: '1.55625', href: 'https://tenor.com/view/yake-why-saikumar-sai-kumar-gif-8891559540113239220', label: 'Yake Why GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '😈', caption: 'ಮನೆಗೆ ಕಳಿಸಿದ್ದು ನಾನೇ!', detail: 'Board mele drama ಜಾಸ್ತಿ.', media: { type: 'tenor', postId: '1495082648885455520', aspectRatio: '1.75352', href: 'https://tenor.com/view/mischievous-mischief-naughty-boy-naughty-thu-gif-1495082648885455520', label: 'Mischievous GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '🙏', caption: 'ನಮಸ್ಕಾರ… ಮತ್ತೆ ಬನ್ನಿ!', detail: 'Pawn has left the board.', media: { type: 'tenor', postId: '1045998005965358311', aspectRatio: '1', href: 'https://tenor.com/view/namaskara-hayavadana-jaggesh-raghavendra-stores-namaste-gif-1045998005965358311', label: 'Namaskara Sticker' } },
    { language: 'ಕನ್ನಡ', emoji: '😂', caption: 'ಇದು comedy ಅಲ್ಲವೇ?', detail: 'Crowd reaction: full volume.', media: { type: 'tenor', postId: '21684182', aspectRatio: '1.78771', href: 'https://tenor.com/view/kannada-comedy-namaskara-vine-store-raghu-gif-21684182', label: 'Kannada Comedy GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '😎', caption: 'Style ಇತ್ತು… ಈಗ ಮನೆ!', detail: 'Jaggesh-level exit.', media: { type: 'tenor', postId: '10991402', aspectRatio: '1.74265', href: 'https://tenor.com/view/jaggesh-gif-10991402', label: 'Jaggesh GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '😶', caption: 'ಮಾತೇ ಇಲ್ಲ…', detail: 'That capture hurt.', media: { type: 'tenor', postId: '6971545912784955005', aspectRatio: '1.26087', href: 'https://tenor.com/view/no-words-duniya-vijay-wwr-namskara-maathe-illa-gif-6971545912784955005', label: 'No Words GIF' } },
    { language: 'ಕನ್ನಡ', emoji: '😭', caption: 'ಇವತ್ತು luck off-duty.', detail: 'Pawn sent home with emotions.', media: { type: 'tenor', postId: '19859659', aspectRatio: '1.53846', href: 'https://tenor.com/view/kannada-darshan-dboss-emotional-gif-19859659', label: 'Kannada Darshan GIF' } },
    { language: 'ತುಳು', emoji: '😂', caption: 'ಅಯ್ಯೋ, ಎಂಚಿನ ಆಟ ಇದು!', detail: 'Tulu reaction unlocked.', media: { type: 'tenor', postId: '18545202', aspectRatio: '1.30612', href: 'https://tenor.com/view/tulu-funny-as-hell-gif-18545202', label: 'Tulu Funny GIF' } }
  ];

  const PATH = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
    [0, 7],
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
    [7, 14],
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
    [14, 7],
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    [7, 0]
  ];

  const HOME_COLUMNS = {
    red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
    blue: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
    green: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
  };

  const PLAYER_HOME = {
    red: { tokens: [[1, 1], [1, 3], [3, 1], [3, 3]] },
    blue: { tokens: [[1, 10], [1, 12], [3, 10], [3, 12]] },
    yellow: { tokens: [[10, 10], [10, 12], [12, 10], [12, 12]] },
    green: { tokens: [[10, 1], [10, 3], [12, 1], [12, 3]] }
  };

  const QUADRANTS = {
    red: { rMin: 0, rMax: 5, cMin: 0, cMax: 5 },
    blue: { rMin: 0, rMax: 5, cMin: 9, cMax: 14 },
    yellow: { rMin: 9, rMax: 14, cMin: 9, cMax: 14 },
    green: { rMin: 9, rMax: 14, cMin: 0, cMax: 5 }
  };

  let canvas, ctx, CELL, BOARD_PX;

  let state = {
    roomId: null, networkUrl: null, playerColor: null, players: [], hostId: null,
    tokens: { red: [-1, -1, -1, -1], blue: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], green: [-1, -1, -1, -1] },
    finished: { red: 0, blue: 0, yellow: 0, green: 0 },
    turnOrder: [], currentTurnName: null,
    diceValue: null, phase: 'idle', movableTokens: [],
    myTurn: false, extraTurn: false, gameOver: false
  };
  let myName = '';
  let originalTitle = document.title;
  let turnFlashInterval = null;
  let countdownInterval = null;
  let reconnecting = false;
  let reconnectTimeout = null;
  let memeAudio = null;
  let audioEnabled = true;

  // Per-tab, not per-browser: localStorage is shared between tabs, so a second tab
  // opened on the same machine would hijack the first tab's player slot.
  const SESSION_KEY = 'ludo_session';

  document.addEventListener('DOMContentLoaded', function() {
    try { init(); } catch (e) { console.error('Init error:', e); }
  });

  function init() {
    canvas = document.getElementById('boardCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    bindUI();
    bindSocket();
    updateServerInfo();
    if (!socket) showServerWarning();
    setInterval(refreshRoomList, 5000);
    var pni = document.getElementById('playerName');
    if (pni) { pni.focus(); }
    tryReconnect();
  }

  function readSession() {
    try {
      var data = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      return (data && data.token && data.roomId) ? data : null;
    } catch (e) {
      clearSession();
      return null;
    }
  }

  function saveSession(token, roomId) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: token, roomId: roomId })); } catch (e) {}
  }

  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  function tryReconnect() {
    // Sessions used to live in localStorage; drop any leftovers so they can't resurface.
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}

    var data = readSession();
    if (!data) { clearSession(); return; }
    if (!socket) { clearSession(); return; }

    console.log('Attempting to reconnect to room ' + data.roomId);
    byId('reconnectStatus').textContent = 'Reconnecting to ' + data.roomId + '...';
    show('screen-reconnect');
    reconnecting = true;
    socket.emit('session_reconnect', { sessionToken: data.token });
    reconnectTimeout = setTimeout(function () {
      if (reconnecting) abandonReconnect('Could not rejoin ' + data.roomId);
    }, 8000);
  }

  function reconnectSucceeded() {
    reconnecting = false;
    if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
  }

  // The reconnect screen has no automatic way out, so a dead session used to strand
  // the player there with the lobby buttons hidden behind it.
  function abandonReconnect(msg) {
    reconnectSucceeded();
    clearSession();
    state.roomId = null;
    state.networkUrl = null;
    state.phase = 'idle';
    if (msg) toast(msg);
    show('screen-lobby');
  }

  function resizeCanvas() {
    const c = canvas.parentElement;
    const s = Math.min(c.clientWidth || 560, c.clientHeight || 560, 560);
    canvas.width = s;
    canvas.height = s;
    BOARD_PX = s;
    CELL = s / 15;
  }

  function updateServerInfo() {
    const el = document.getElementById('serverInfo');
    if (el) {
      const current = openedFromFile ? 'Opened as a local file' : window.location.hostname + ':' + window.location.port;
      el.textContent = state.networkUrl ? 'Friends join at ' + state.networkUrl : current;
    }
    const na = document.getElementById('networkAddress');
    if (na) na.textContent = openedFromFile ? 'start the game server first' : (state.networkUrl || window.location.hostname + ':' + window.location.port);
  }

  function showServerWarning() {
    const warning = byId('serverWarning');
    if (!warning) return;
    warning.hidden = false;
    warning.textContent = 'Rooms need the game server. Start server.js, then open http://localhost:3000 instead of this local file.';
  }

  function bindUI() {
    byId('btnCreateRoom').onclick = createRoom;
    byId('btnJoinRoom').onclick = () => toggle(byId('joinSection'));
    byId('btnSubmitJoin').onclick = joinRoom;
    byId('btnRollDice').onclick = rollDice;
    byId('btnCopyCode').onclick = copyCode;
    byId('btnLeaveGame').onclick = leaveGame;
    byId('btnPlayAgain').onclick = playAgain;
    byId('btnBackToLobby').onclick = backToLobby;
    byId('btnRestartGame').onclick = () => state.hostId === socket.id && socket.emit('restart_game', { roomId: state.roomId });
    byId('btnMuteAudio').onclick = toggleAudio;
    byId('memePreviewBtn').onclick = function() {
      showMemeMoment({ memeId: Math.floor(Math.random() * MEMES.length), victims: [{ playerName: 'Preview player' }] });
    };
    byId('btnOpenMemePicker').onclick = openMemePicker;
    byId('btnCloseMemePicker').onclick = closeMemePicker;
    renderMemePicker();

    byId('roomCodeInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') joinRoom(); });
    byId('playerName').addEventListener('keydown', function(e) { if (e.key === 'Enter') createRoom(); });
    byId('btnCancelReconnect').onclick = function() { clearSession(); leaveGame(); };
    byId('btnLeaveWaiting').onclick = function() {
      if (state.roomId) socket.emit('leave_room', { roomId: state.roomId });
      leaveGame();
    };
    byId('btnEndRoom').onclick = function() {
      if (state.roomId && state.hostId === socket.id && confirm('End this room? All players will be disconnected.')) {
        socket.emit('end_room', { roomId: state.roomId });
      }
    };
    byId('btnStartGame').onclick = function() {
      if (state.roomId && state.hostId === socket.id) {
        socket.emit('start_game', { roomId: state.roomId });
      }
    };
    byId('btnForfeit').onclick = function() {
      if (state.phase === 'finished' || state.phase === 'idle') return;
      if (confirm('Forfeit the game?')) {
        socket.emit('forfeit_game', { roomId: state.roomId });
      }
    };
    // Bound here rather than at module scope: `canvas` is only assigned in init().
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mousemove', onCanvasMove);

    window.onresize = () => { resizeCanvas(); if (state.phase !== 'idle') draw(); };
  }

  function byId(id) { return document.getElementById(id); }
  function toggle(el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = byId(id);
    if (el) el.classList.add('active');
  }

  function toast(msg) {
    const t = byId('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function createRoom() {
    if (!socket) { toast('Start the game server and open http://localhost:3000'); return; }
    const n = byId('playerName').value.trim() || 'Player';
    myName = n;
    socket.emit('create_room', { playerName: n });
  }

  function joinRoom() {
    if (!socket) { toast('Start the game server and open http://localhost:3000'); return; }
    const code = byId('roomCodeInput').value.trim().toUpperCase();
    if (!code) { toast('Enter a room code'); return; }
    myName = byId('playerName').value.trim() || 'Player';
    socket.emit('join_room', { roomId: code, playerName: myName });
  }

  function copyCode() {
    var code = byId('roomCodeDisplay').textContent;
    if (!code) return;
    var doFallback = function() {
      var ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('Room code copied!'); } catch(e) {}
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function() { toast('Room code copied!'); }).catch(doFallback);
    } else {
      doFallback();
    }
  }

  function rollDice() {
    if (!state.myTurn || state.phase !== 'rolling') return;
    byId('diceFace').classList.add('rolling');
    setTimeout(() => byId('diceFace').classList.remove('rolling'), 500);
    socket.emit('roll_dice', { roomId: state.roomId });
  }

  function leaveGame() {
    clearSession();
    if (state.phase !== 'idle' && state.phase !== 'finished' && state.roomId) {
      socket.emit('forfeit_game', { roomId: state.roomId });
    }
    if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
    document.title = originalTitle;
    show('screen-lobby');
    state.phase = 'idle';
    state.roomId = null;
    state.networkUrl = null;
    state.gameOver = false;
    byId('joinSection').style.display = 'none';
    byId('roomList').style.display = 'none';
    byId('timerDisplay').textContent = '';
  }

  function playAgain() {
    if (state.hostId === socket.id) {
      socket.emit('restart_game', { roomId: state.roomId });
    } else {
      toast('Waiting for host to start rematch...');
    }
  }

  function backToLobby() {
    clearSession();
    if (state.roomId) socket.emit('forfeit_game', { roomId: state.roomId });
    if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
    document.title = originalTitle;
    show('screen-lobby');
    state.phase = 'idle';
    state.roomId = null;
    state.networkUrl = null;
    state.gameOver = false;
    byId('joinSection').style.display = 'none';
    byId('roomList').style.display = 'none';
    byId('btnRestartGame').style.display = 'none';
    byId('timerDisplay').textContent = '';
  }

  function refreshRoomList() {
    if (socket && byId('screen-lobby').classList.contains('active') && socket.connected) {
      socket.emit('list_rooms');
    }
  }

  function bindSocket() {
    if (!socket) return;
    socket.on('room_created', d => {
      reconnectSucceeded();
      state.roomId = d.roomId; state.networkUrl = d.networkUrl || null; state.playerColor = d.playerColor;
      state.players = d.players; state.hostId = d.hostId;
      if (d.sessionToken) saveSession(d.sessionToken, d.roomId);
      showWaiting();
    });

    socket.on('room_joined', d => {
      reconnectSucceeded();
      state.roomId = d.roomId; state.networkUrl = d.networkUrl || null; state.playerColor = d.playerColor;
      state.players = d.players; state.hostId = d.hostId;
      if (d.sessionToken) saveSession(d.sessionToken, d.roomId);
      showWaiting();
    });

    socket.on('player_joined', d => { state.players = d.players; updatePlayerList(); });
    socket.on('player_left', d => {
      state.players = d.players; state.hostId = d.hostId;
      if (byId('screen-waiting').classList.contains('active')) updatePlayerList();
      else updatePanels();
    });

    socket.on('player_disconnected', d => {
      state.players = d.players;
      updatePanels();
      updateStatus();
    });

    socket.on('player_reconnected', d => {
      state.players = d.players;
      state.hostId = d.hostId;
      updatePanels();
      updateStatus();
    });

    socket.on('room_ended', function() {
      toast('Room closed by host');
      clearSession();
      if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
      document.title = originalTitle;
      state.phase = 'idle';
      state.roomId = null;
      state.networkUrl = null;
      state.gameOver = false;
      byId('joinSection').style.display = 'none';
      byId('roomList').style.display = 'none';
      byId('btnRestartGame').style.display = 'none';
      byId('btnForfeit').style.display = 'none';
      byId('timerDisplay').textContent = '';
      show('screen-lobby');
    });

    socket.on('dice_log', d => {
      byId('diceLog').textContent = d.message;
    });

    socket.on('disconnect', function() {
      if (state.roomId && state.phase !== 'idle') {
        toast('Connection lost — reconnecting...');
      }
    });

    socket.on('connect', function() {
      var data = readSession();
      if (data && state.roomId) {
        reconnecting = true;
        socket.emit('session_reconnect', { sessionToken: data.token });
      }
    });

    socket.on('turn_timeout', function(d) {
      byId('diceLog').textContent = d.playerName + ' ran out of time!';
      byId('timerDisplay').textContent = '';
    });

    socket.on('game_state', d => {
      if (d.type !== 'full_state') return;
      reconnectSucceeded();
      state.roomId = d.roomId;
      state.networkUrl = d.networkUrl || null;
      state.playerColor = d.playerColor;
      state.players = d.players;
      state.hostId = d.hostId;
      state.phase = d.phase;
      state.gameOver = false;

      if (!d.started) {
        showWaiting();
        return;
      }

      state.turnOrder = d.turnOrder || [];
      state.currentTurnName = d.currentTurnName;
      state.extraTurn = false;
      state.diceValue = d.diceValue || null;
      state.movableTokens = d.movableTokens || [];
      if (d.tokens) {
        for (var c in d.tokens) state.tokens[c] = d.tokens[c];
      }
      if (d.finished) {
        for (var c in d.finished) state.finished[c] = d.finished[c];
      }

      if (d.winner) {
        state.phase = 'finished';
        state.gameOver = true;
        byId('winnerName').textContent = d.winner.name;
        byId('winnerName').style.color = COLOR_MAP[d.winner.color] || '#FFD700';
        byId('winnerCrown').style.color = COLOR_MAP[d.winner.color] || '#FFD700';
        show('screen-result');
        return;
      }

      updateMyTurn();
      show('screen-game');
      byId('gameRoomCode').textContent = state.roomId;
      byId('btnRollDice').style.display = 'none';
      byId('btnRestartGame').style.display = 'none';
      byId('btnForfeit').style.display = 'inline-block';
      byId('diceFace').innerHTML = '';
      byId('diceLog').textContent = '';
      byId('timerDisplay').textContent = '';
      resizeCanvas();
      updatePanels();
      updateStatus();
      draw();
    });

    socket.on('game_start', d => {
      state.turnOrder = d.turnOrder;
      state.players = d.players;
      state.phase = 'rolling';
      state.extraTurn = false;
      state.gameOver = false;
      state.diceValue = null;
      for (const c of COLORS) { state.tokens[c] = [-1, -1, -1, -1]; state.finished[c] = 0; }
      state.currentTurnName = d.turnOrder[0];
      updateMyTurn();
      show('screen-game');
      byId('gameRoomCode').textContent = state.roomId;
      byId('btnRollDice').style.display = 'none';
      byId('diceFace').innerHTML = '';
      byId('diceLog').textContent = '';
      byId('btnRestartGame').style.display = 'none';
      byId('btnForfeit').style.display = 'inline-block';
      resizeCanvas();
      updatePanels();
      updateStatus();
      draw();
    });

    socket.on('game_restarted', d => {
      state.turnOrder = d.turnOrder;
      state.players = d.players;
      state.phase = 'rolling';
      state.extraTurn = false;
      state.gameOver = false;
      state.diceValue = null;
      for (const c of COLORS) { state.tokens[c] = [-1, -1, -1, -1]; state.finished[c] = 0; }
      state.currentTurnName = d.turnOrder[0];
      updateMyTurn();
      byId('btnRollDice').style.display = 'none';
      byId('btnRestartGame').style.display = 'none';
      byId('btnForfeit').style.display = 'inline-block';
      byId('diceFace').innerHTML = '';
      byId('diceLog').textContent = '';
      updatePanels();
      updateStatus();
      draw();
    });

    socket.on('dice_rolled', d => {
      renderDice(d.diceValue);
      state.diceValue = d.diceValue;
      state.phase = 'moving';
      state.movableTokens = d.movableTokens || [];
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      byId('timerDisplay').textContent = '';
      if (d.playerId === socket.id && state.movableTokens.length === 0) {
        byId('diceLog').textContent = 'No moves!';
        byId('btnRollDice').style.display = 'none';
      }
      updateStatus();
      draw();
    });

    socket.on('token_moved', d => {
      const p = state.players.find(x => x.id === d.playerId);
      if (p) {
        state.tokens[p.color] = d.tokens;
        state.finished[p.color] = d.finished;
        if (d.captured) {
          toast('Pawn sent home — meme moment!');
          showMemeMoment(d.capture);
        }
      }
      updatePanels();
      draw();
    });

    socket.on('meme_posted', d => {
      addMemeFeedItem(d);
      showMemeMoment({ memeId: d.memeId, victims: [{ playerName: d.playerName }] }, 'posted');
    });

    socket.on('turn_change', d => {
      state.currentTurnName = d.playerName;
      state.extraTurn = d.extraTurn || false;
      state.phase = 'rolling';
      state.diceValue = null;
      state.movableTokens = [];
      byId('diceFace').innerHTML = '';
      byId('diceLog').textContent = '';
      byId('btnRollDice').style.display = 'none';
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      byId('timerDisplay').textContent = '';
      updateMyTurn();
      updateStatus();
      draw();

      // Audio beep when it's my turn
      if (state.myTurn) {
        try {
          var actx = new (window.AudioContext || window.webkitAudioContext)();
          var osc = actx.createOscillator();
          var gain = actx.createGain();
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.frequency.value = 880;
          osc.type = 'sine';
          gain.gain.setValueAtTime(0.15, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.2);
          osc.start(actx.currentTime);
          osc.stop(actx.currentTime + 0.2);
          // Second beep
          var osc2 = actx.createOscillator();
          var gain2 = actx.createGain();
          osc2.connect(gain2);
          gain2.connect(actx.destination);
          osc2.frequency.value = 1100;
          osc2.type = 'sine';
          gain2.gain.setValueAtTime(0.15, actx.currentTime + 0.2);
          gain2.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
          osc2.start(actx.currentTime + 0.2);
          osc2.stop(actx.currentTime + 0.5);
        } catch(e) {}

        if (document.hidden) {
          var orig = originalTitle;
          if (turnFlashInterval) clearInterval(turnFlashInterval);
          turnFlashInterval = setInterval(function() {
            document.title = document.title === orig ? 'YOUR TURN!' : orig;
          }, 1000);
          var visHandler = function() {
            if (!document.hidden) {
              document.title = orig;
              if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
              document.removeEventListener('visibilitychange', visHandler);
            }
          };
          document.addEventListener('visibilitychange', visHandler);
        }
        // Server-side 60s timer countdown
        var timeLeft = 60;
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(function() {
          timeLeft--;
          byId('timerDisplay').textContent = timeLeft + 's';
          if (timeLeft <= 10) {
            byId('timerDisplay').style.color = '#ff3333';
          } else {
            byId('timerDisplay').style.color = '#FFD700';
          }
          if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
            byId('timerDisplay').textContent = '';
          }
        }, 1000);
      } else {
        if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
        document.title = originalTitle;
      }
    });

    socket.on('game_over', d => {
      state.phase = 'finished';
      state.gameOver = true;
      state.winner = d;
      byId('winnerName').textContent = d.winnerName;
      const c = d.winnerColor;
      byId('winnerName').style.color = COLOR_MAP[c] || '#FFD700';
      byId('winnerCrown').style.color = COLOR_MAP[c] || '#FFD700';
      byId('timerDisplay').textContent = '';
      if (turnFlashInterval) { clearInterval(turnFlashInterval); turnFlashInterval = null; }
      document.title = originalTitle;
      byId('btnForfeit').style.display = 'none';
      byId('timerDisplay').textContent = '';
      playSound('/memes/audio/winning.mp3');
      show('screen-result');
    });

    socket.on('player_forfeited', d => {
      if (d.playerColor && state.tokens) {
        state.tokens[d.playerColor] = [57, 57, 57, 57];
        state.finished[d.playerColor] = 4;
      }
      toast(d.playerName + ' forfeited!');
      if (state.myTurn && state.phase !== 'rolling') {
        state.phase = 'rolling';
        state.diceValue = null;
        state.movableTokens = [];
      }
      updatePanels();
      updateStatus();
      draw();
    });

    socket.on('error', d => {
      if (reconnecting) { abandonReconnect(d.message); return; }
      toast(d.message);
    });

    socket.on('room_list', d => {
      const c = byId('roomListContainer');
      const l = byId('roomList');
      if (!d || !d.length) { l.style.display = 'none'; return; }
      l.style.display = 'block';
      c.innerHTML = d.map(r =>
        `<div class="room-entry" onclick="document.getElementById('roomCodeInput').value='${r.roomId}';document.getElementById('joinSection').style.display='block'">
          <span class="room-name">${r.roomId}</span>
          <span class="room-count">${r.playerCount}/4</span>
        </div>`
      ).join('');
    });
  }

  function updateStartButton() {
    const isHost = state.hostId === socket.id;
    const count = state.players.length;
    byId('btnStartGame').style.display = isHost && count >= 2 && count < 4 ? 'inline-block' : 'none';
  }

  function renderMemePicker() {
    const grid = byId('memePickerGrid');
    if (!grid) return;
    grid.innerHTML = MEMES.map((meme, index) =>
      '<button class="meme-choice" type="button" data-meme-id="' + index + '">' +
        '<span class="meme-choice-pin">📌 ' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="meme-choice-emoji">' + meme.emoji + '</span>' +
        '<span class="meme-choice-caption">' + meme.caption + '</span>' +
        '<small>' + meme.language + (meme.audio ? ' · audio' : ' · Tenor') + '</small>' +
      '</button>'
    ).join('');
    grid.querySelectorAll('.meme-choice').forEach(button => {
      button.onclick = function() {
        const memeId = Number(button.getAttribute('data-meme-id'));
        socket.emit('post_meme', { roomId: state.roomId, memeId });
        closeMemePicker();
      };
    });
  }

  function openMemePicker() {
    const picker = byId('memePicker');
    if (!picker) return;
    picker.hidden = false;
    picker.classList.add('show');
  }

  function closeMemePicker() {
    const picker = byId('memePicker');
    if (!picker) return;
    picker.classList.remove('show');
    picker.hidden = true;
  }

  function addMemeFeedItem(post) {
    const feed = byId('memeFeed');
    if (!feed) return;
    const meme = MEMES[post.memeId] || MEMES[0];
    const empty = feed.querySelector('.meme-feed-empty');
    if (empty) empty.remove();
    const item = document.createElement('div');
    item.className = 'meme-feed-item';
    item.innerHTML = '<span class="meme-feed-emoji">' + meme.emoji + '</span>' +
      '<span><strong>' + post.playerName + '</strong><small>' + meme.caption + '</small></span>';
    feed.prepend(item);
    while (feed.children.length > 3) feed.lastElementChild.remove();
    const count = byId('memePostCount');
    count.textContent = String((Number(count.textContent) || 0) + 1);
  }

  function showMemeMoment(capture, kind) {
    const meme = MEMES[(capture && Number.isInteger(capture.memeId) ? capture.memeId : Date.now()) % MEMES.length];
    const victims = capture && capture.victims ? capture.victims.map(v => v.playerName).join(', ') : 'A pawn';
    const card = byId('memeMoment');
    byId('memeLanguage').textContent = meme.language;
    byId('memeEmoji').textContent = meme.emoji;
    byId('memeCaption').textContent = meme.caption;
    byId('memeAttribution').textContent = kind === 'posted'
      ? victims + ' posted this reaction · ' + meme.detail
      : victims + ' got sent home · ' + meme.detail;

    const media = byId('memeMedia');
    media.innerHTML = '';
    if (meme.media) {
      if (meme.media.type === 'tenor') {
        renderTenorEmbed(media, meme.media);
      } else {
        const mediaTag = meme.media.type === 'video' ? 'video' : (meme.media.type === 'audio' ? 'audio' : 'img');
        const el = document.createElement(mediaTag);
        el.src = meme.media.src;
        if (mediaTag === 'video' || mediaTag === 'audio') el.controls = true;
        if (mediaTag === 'img') el.alt = meme.caption;
        if (meme.media.type === 'video') { el.muted = true; el.playsInline = true; }
        media.appendChild(el);
      }
    }
    if (meme.media && meme.media.type === 'tenor') {
      byId('memeAttribution').textContent += ' · Via Tenor';
    }
    if (meme.audio) playSound(meme.audio);
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => card.classList.add('show'));
    clearTimeout(showMemeMoment.hideTimer);
    showMemeMoment.hideTimer = setTimeout(function() {
      card.classList.remove('show');
      card.setAttribute('aria-hidden', 'true');
    }, 4500);
  }

  function renderTenorEmbed(container, media) {
    const embed = document.createElement('div');
    embed.className = 'tenor-gif-embed';
    embed.dataset.postid = media.postId;
    embed.dataset.shareMethod = 'host';
    embed.dataset.aspectRatio = media.aspectRatio;
    embed.dataset.width = '100%';

    const link = document.createElement('a');
    link.href = media.href;
    link.textContent = media.label;
    embed.appendChild(link);
    container.appendChild(embed);

    // The Tenor snippet expects the script after its embed element. The
    // browser caches this script, so repeated meme moments do not redownload it.
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://tenor.com/embed.js';
    container.appendChild(script);
  }

  function toggleAudio() {
    audioEnabled = !audioEnabled;
    if (!audioEnabled && memeAudio) memeAudio.pause();
    const button = byId('btnMuteAudio');
    button.textContent = audioEnabled ? '🔊 Sound on' : '🔇 Sound off';
    button.setAttribute('aria-pressed', String(!audioEnabled));
  }

  function playSound(src) {
    if (!audioEnabled) return;
    try {
      if (!memeAudio) memeAudio = new Audio();
      memeAudio.src = src;
      memeAudio.currentTime = 0;
      const playAttempt = memeAudio.play();
      if (playAttempt && playAttempt.catch) playAttempt.catch(function() {});
    } catch (e) {}
  }

  function showWaiting() {
    show('screen-waiting');
    byId('roomCodeDisplay').textContent = state.roomId;
    byId('btnEndRoom').style.display = state.hostId === socket.id ? 'inline-block' : 'none';
    updatePlayerList();
    updateServerInfo();
  }

  function updatePlayerList() {
    const c = byId('playerList');
    c.innerHTML = state.players.map(p => {
      const dc = p.connected === false ? ' player-disconnected' : '';
      const status = p.id === state.hostId ? 'HOST' : (p.connected === false ? 'DISCONNECTED' : 'READY');
      const sc = p.connected === false ? '#ff3333' : 'var(--cyan)';
      return '<div class="player-entry' + dc + '">' +
        '<div class="player-color-dot" style="background:' + COLOR_MAP[p.color] + ';box-shadow:0 0 8px ' + COLOR_GLOW[p.color] + '"></div>' +
        '<span class="player-entry-name">' + p.name + '</span>' +
        '<span class="player-entry-status" style="color:' + sc + '">' + status + '</span>' +
      '</div>';
    }).join('');
    const cnt = state.players.length;
    const connected = state.players.filter(p => p.connected !== false).length;
    byId('btnEndRoom').style.display = state.hostId === socket.id ? 'inline-block' : 'none';
    updateStartButton();
    if (cnt >= 4) {
      byId('waitingStatus').textContent = 'All seats filled — starting game...';
    } else if (state.hostId === socket.id && cnt >= 2) {
      byId('waitingStatus').textContent = 'Room ready — start the game for ' + cnt + ' players.';
    } else if (cnt < 2) {
      byId('waitingStatus').textContent = 'Waiting for at least one friend to join...';
    } else {
      byId('waitingStatus').textContent = 'Waiting for the host to start... (' + connected + '/' + cnt + ' connected)';
    }
  }

  function updateMyTurn() {
    const me = state.players.find(p => p.id === socket.id);
    state.myTurn = me && state.currentTurnName === me.name;
  }

  function updateStatus() {
    const st = byId('gameStatus');
    const cp = state.players.find(p => p.name === state.currentTurnName);
    const hex = cp ? COLOR_MAP[cp.color] : '#FFD700';

    if (state.phase === 'finished') { st.textContent = 'Game Over!'; return; }

    if (state.myTurn) {
      if (state.phase === 'rolling') {
        st.innerHTML = '<span style="color:' + hex + '">YOUR TURN</span> - Roll the dice!';
        byId('btnRollDice').style.display = 'inline-block';
      } else if (state.phase === 'moving') {
        st.innerHTML = '<span style="color:' + hex + '">YOUR TURN</span> - Click a token';
        if (!state.movableTokens.length) st.textContent = 'No moves available';
      }
    } else {
      byId('btnRollDice').style.display = 'none';
      st.innerHTML = '<span style="color:' + hex + '">' + state.currentTurnName + '</span>\'s turn';
      if (state.extraTurn) st.innerHTML += ' (extra!)';
    }
  }

  function updatePanels() {
    COLORS.forEach((c, i) => {
      const p = byId('playerPanel' + (i + 1));
      if (!p) return;
      const player = state.players.find(x => x.color === c);
      const nameEl = p.querySelector('.panel-name');
      const cntEl = p.querySelector('.token-count');
      const ind = p.querySelector('.panel-indicator');

      if (player) {
        nameEl.textContent = player.name;
        cntEl.textContent = state.finished[c] || 0;
        const isActive = state.currentTurnName === player.name;
        const isDC = player.connected === false;
        p.classList.toggle('active-panel', isActive);
        p.classList.toggle('player-disconnected', isDC);
        if (isActive && !isDC) {
          ind.style.background = COLOR_MAP[c];
          ind.style.boxShadow = '0 0 10px ' + COLOR_MAP[c];
        } else {
          ind.style.background = '#444';
          ind.style.boxShadow = 'none';
        }
      } else {
        nameEl.textContent = 'Waiting...';
        cntEl.textContent = '0';
        p.classList.remove('active-panel');
        ind.style.background = '#444';
        ind.style.boxShadow = 'none';
      }
    });
  }

  function renderDice(val) {
    const dots = {
      1: [[1, 1]], 2: [[0, 2], [2, 0]], 3: [[0, 2], [1, 1], [2, 0]],
      4: [[0, 0], [0, 2], [2, 0], [2, 2]],
      5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
      6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]]
    };
    const g = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        g.push('<div class="dot' + ((dots[val] || []).some(([rr, cc]) => rr === r && cc === c) ? '' : ' empty') + '"></div>');
    byId('diceFace').innerHTML = g.join('');
    byId('diceLog').textContent = 'Rolled: ' + val;
    byId('btnRollDice').style.display = 'none';
  }

  /* ----- BOARD DRAWING ----- */
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
    drawBackground();
    drawHomeBases();
    drawCenter();
    drawPath();
    drawHomeColumns();
    drawTokens();
    drawLabels();
  }

  function drawBackground() {
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(0, 0, BOARD_PX, BOARD_PX);
    ctx.strokeStyle = '#19354a';
    ctx.lineWidth = 3;
    ctx.strokeRect(1, 1, BOARD_PX - 2, BOARD_PX - 2);
  }

  function drawHomeBases() {
    for (const [color, q] of Object.entries(QUADRANTS)) {
      const baseColor = COLOR_MAP[color];
      ctx.fillStyle = baseColor;
      ctx.fillRect(q.cMin * CELL, q.rMin * CELL, 6 * CELL, 6 * CELL);
      ctx.strokeStyle = '#19354a';
      ctx.lineWidth = 2;
      ctx.strokeRect(q.cMin * CELL + 1, q.rMin * CELL + 1, 6 * CELL - 2, 6 * CELL - 2);

      const homeX = (q.cMin + 1) * CELL, homeY = (q.rMin + 1) * CELL;
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(homeX, homeY, 4 * CELL, 4 * CELL);
      ctx.strokeStyle = 'rgba(25,53,74,0.5)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(homeX, homeY, 4 * CELL, 4 * CELL);

      [[1, 1], [1, 3], [3, 1], [3, 3]].forEach(([dr, dc]) => {
        const cx = (q.cMin + dc + 0.5) * CELL, cy = (q.rMin + dr + 0.5) * CELL;
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(cx, cy, CELL * 0.34, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#19354a';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }

  function drawCenter() {
    const x = 6 * CELL, y = 6 * CELL, size = 3 * CELL;
    const cx = x + size / 2, cy = y + size / 2;
    const triangles = [
      { color: COLOR_MAP.red, points: [[x, y], [x + size, y], [cx, cy]] },
      { color: COLOR_MAP.blue, points: [[x + size, y], [x + size, y + size], [cx, cy]] },
      { color: COLOR_MAP.yellow, points: [[x + size, y + size], [x, y + size], [cx, cy]] },
      { color: COLOR_MAP.green, points: [[x, y + size], [x, y], [cx, cy]] }
    ];
    triangles.forEach(triangle => {
      ctx.fillStyle = triangle.color;
      ctx.beginPath();
      ctx.moveTo(triangle.points[0][0], triangle.points[0][1]);
      ctx.lineTo(triangle.points[1][0], triangle.points[1][1]);
      ctx.lineTo(triangle.points[2][0], triangle.points[2][1]);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#19354a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.23, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPath() {
    PATH.forEach((pos, i) => {
      const [r, c] = pos;
      const isSafe = SAFE_POSITIONS.includes(i);
      const startIdx = [0, 13, 26, 39].indexOf(i);

      ctx.fillStyle = startIdx >= 0 ? COLOR_MAP[COLORS[startIdx]] : '#fffdf6';
      if (isSafe && startIdx < 0) ctx.fillStyle = '#ffe6a5';
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      ctx.strokeStyle = 'rgba(25,53,74,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
      if (isSafe) {
        ctx.fillStyle = '#19354a';
        ctx.font = 'bold ' + CELL * 0.46 + 'px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', c * CELL + CELL / 2, r * CELL + CELL / 2);
      }
    });
  }

  function drawHomeColumns() {
    for (const [color, cols] of Object.entries(HOME_COLUMNS)) {
      cols.forEach(([r, c], i) => {
        ctx.fillStyle = COLOR_MAP[color];
        ctx.globalAlpha = 0.35 + i * 0.08;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(25,53,74,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);

        if (i === cols.length - 1) {
          ctx.fillStyle = '#19354a';
          ctx.font = 'bold ' + CELL * 0.46 + 'px Segoe UI, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★', c * CELL + CELL / 2, r * CELL + CELL / 2);
        }
      });
    }
  }

  function getMovableTokenPositions() {
    if (!state.myTurn || state.phase !== 'moving') return [];
    const me = state.players.find(p => p.id === socket.id);
    if (!me) return [];
    const color = me.color;
    const tokens = state.tokens[color] || [];
    const result = [];
    for (const idx of state.movableTokens) {
      const pos = tokens[idx];
      if (pos >= 0 && pos <= 51) {
        const g = (PLAYER_START[color] + pos) % 52;
        result.push({ r: PATH[g][0], c: PATH[g][1], idx });
      } else if (pos === -1) {
        const t = PLAYER_HOME[color].tokens[idx];
        result.push({ r: t[0], c: t[1], idx });
      }
    }
    return result;
  }

  function drawTokens() {
    const movable = getMovableTokenPositions();
    const grouped = {};

    for (const color of COLORS) {
      const tokens = state.tokens[color] || [];
      tokens.forEach((pos, idx) => {
        const player = state.players.find(p => p.color === color);
        if (!player) return;

        let r, c, key;
        if (pos === -1) {
          const t = PLAYER_HOME[color].tokens[idx];
          key = 'home-' + color + '-' + idx;
          grouped[key] = { color, r: t[0], c: t[1], idx, pos: -1 };
          return;
        } else if (pos >= 0 && pos <= 51) {
          const gIdx = (PLAYER_START[color] + pos) % 52;
          [r, c] = PATH[gIdx];
          key = 'brd-' + gIdx;
        } else if (pos >= 52 && pos <= 56) {
          const homeCol = HOME_COLUMNS[color];
          if (!homeCol) return;
          [r, c] = homeCol[pos - 52];
          key = 'hcl-' + color + '-' + (pos - 52);
          grouped[key] = { color, r, c, idx, pos };
          return;
        } else if (pos === 57) {
          key = 'fin-' + color;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push({ color, r: 7, c: 7, idx, pos: 57 });
          return;
        } else return;

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({ color, r, c, idx, pos });
      });
    }

    for (const [key, data] of Object.entries(grouped)) {
      if (Array.isArray(data)) {
        data.forEach((d, i) => {
          const off = (i - (data.length - 1) / 2) * CELL * 0.22;
          const isMovable = movable.some(m => m.idx === d.idx && m.r === d.r && m.c === d.c);
          drawToken(d.color, d.c * CELL + CELL / 2 + off, d.r * CELL + CELL / 2, d.idx, isMovable);
        });
      } else {
        const isMovable = movable.some(m => m.idx === data.idx && m.r === data.r && m.c === data.c);
        drawToken(data.color, data.c * CELL + CELL / 2, data.r * CELL + CELL / 2, data.idx, isMovable);
      }
    }
  }

  function drawToken(color, x, y, idx, highlight) {
    const r = CELL * 0.31;
    ctx.shadowColor = highlight ? '#19354a' : 'rgba(25,53,74,0.35)';
    ctx.shadowBlur = highlight ? r * 2.6 : r * 1.2;
    ctx.fillStyle = COLOR_MAP[color];
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.75, r * 0.92, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.72, y + r * 0.62);
    ctx.quadraticCurveTo(x - r * 0.58, y - r * 0.05, x - r * 0.32, y - r * 0.35);
    ctx.arc(x, y - r * 0.62, r * 0.34, 0, Math.PI * 2);
    ctx.quadraticCurveTo(x + r * 0.58, y - r * 0.05, x + r * 0.72, y + r * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = highlight ? '#19354a' : 'rgba(25,53,74,0.45)';
    ctx.lineWidth = highlight ? 2 : 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x - r * 0.12, y - r * 0.72, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#19354a';
    ctx.font = 'bold ' + (r * 0.65) + 'px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(idx + 1, x, y + 0.5);
  }

  function drawLabels() {
    const labels = [
      { text: 'RED', r: 2.5, c: 2.5, color: 'red' },
      { text: 'BLUE', r: 2.5, c: 12.5, color: 'blue' },
      { text: 'YELLOW', r: 12.5, c: 12.5, color: 'yellow' },
      { text: 'GREEN', r: 12.5, c: 2.5, color: 'green' }
    ];
    labels.forEach(l => {
      ctx.fillStyle = COLOR_MAP[l.color] + '18';
      ctx.font = 'bold ' + CELL * 0.5 + 'px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, l.c * CELL, l.r * CELL);
    });
  }

  /* ----- CLICK HANDLING ----- */
  function getCell(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx, y = (e.clientY - rect.top) * sy;
    return [Math.floor(y / CELL), Math.floor(x / CELL)];
  }

  function findToken(row, col) {
    if (!state.myTurn || state.phase !== 'moving' || !state.movableTokens.length) return -1;
    const me = state.players.find(p => p.id === socket.id);
    if (!me) return -1;
    const color = me.color;
    const tokens = state.tokens[color] || [];

    for (const idx of state.movableTokens) {
      const pos = tokens[idx];
      let tr, tc;
      if (pos >= 0 && pos <= 51) {
        const g = (PLAYER_START[color] + pos) % 52;
        [tr, tc] = PATH[g];
      } else if (pos === -1) {
        const t = PLAYER_HOME[color].tokens[idx];
        tr = t[0]; tc = t[1];
      } else continue;
      if (tr === row && tc === col) return idx;
    }
    return -1;
  }

  function onCanvasClick(e) {
    if (!state.myTurn || state.phase !== 'moving') return;
    const [r, c] = getCell(e);
    const idx = findToken(r, c);
    if (idx >= 0) socket.emit('move_token', { roomId: state.roomId, tokenIndex: idx });
  }

  function onCanvasMove(e) {
    const [r, c] = getCell(e);
    canvas.style.cursor = findToken(r, c) >= 0 ? 'pointer' : 'default';
  }
})();
