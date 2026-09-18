=== STAR WARS LUDO ===

A 4-player Ludo game for LAN/WiFi networks with a Star Wars theme.

=== HOW TO START ===

1. Double-click "start-server.bat" (or run "node server.js" in terminal)
2. The server shows the IP and port (e.g., http://192.168.x.x:3000)
3. All players connect to that URL in their browser
4. Player 1 creates a room, gets a room code
5. Other players join by entering the room code
6. When 4 players join, the game starts automatically

=== FEATURES ===

- Crypto-random dice (Node.js crypto.randomInt)
- 4-player room system with join codes
- Canvas-based Ludo board with lightsaber glow effects
- Star Wars themed UI with starfield background
- Room discovery - see available rooms
- Reconnect / rematch support
- Works on any device with a browser (phone, tablet, desktop)
- All communication via WebSocket (real-time)
- Token highlighting (movable tokens glow white)

=== REQUIREMENTS ===

- Node.js (included if you see this file)

=== NETWORK SETUP ===

For LAN play:
- All players must be on the same network
- Connect using the Network IP shown in the server console

For Windows Firewall:
- You may need to allow Node.js through the firewall
- Or use the server's IP directly

=== CONTROLS ===

- Click "ROLL" to roll the dice
- Click a highlighted (glowing) token to move it
- Rolling a 6 gives an extra turn
- Three 6s in a row = turn lost
- First to get all 4 tokens to the center wins!
