=== MEME LUDO ===

A 2–4 player Ludo game for LAN/WiFi networks with Kannada/Tulu meme moments.

=== HOW TO START ===

1. Double-click "start-server.bat" (or run "node server.js" in terminal)
2. Open http://localhost:3000 in your browser — do not open public/index.html directly
3. For other players, share the server URL shown in the terminal (e.g., http://192.168.x.x:3000)
4. Player 1 creates a room, gets a room code
5. Other players join by entering the room code
6. With 4 players the game starts automatically; with 2–3 players the host clicks Start Game

=== FEATURES ===

- Crypto-random dice (Node.js crypto.randomInt)
- 4-player room system with join codes
- Classic four-color Ludo board with a Kannada/Tulu party-game theme
- A short meme moment appears when a pawn is sent home
- Players can post any catalogued Kannada/Tulu Tenor reaction to the room feed
- Shared live reaction feed is visible to every player in the room
- Optional local audio/video media can be added to the meme catalog later
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

=== PUBLIC HOSTING (NO LAN REQUIRED) ===

This project includes a render.yaml for a free Render Web Service.

1. Push the project to a GitHub repository
2. In Render, choose New > Blueprint and select the repository
3. Deploy the `meme-ludo` service using the Free plan
4. Share the generated https://meme-ludo-....onrender.com URL

The public service runs the frontend and Socket.IO server together, so no
separate Netlify frontend or LAN address is needed. Free services can sleep
after inactivity, so open the URL a few minutes before the event.

=== CONTROLS ===

- Click "ROLL" to roll the dice
- Click a highlighted (glowing) token to move it
- Rolling a 6 gives an extra turn
- Three 6s in a row = turn lost
- First to get all 4 tokens to the center wins!
