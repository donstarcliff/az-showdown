# A–Z Showdown

A real-time browser party game for 2–8 players. Includes Classic A–Z, Trivia Blitz, and Team Battle.

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
npm start
```

Open http://localhost:3000 on the host device. For other devices on the same Wi-Fi, open `http://YOUR_COMPUTER_LAN_IP:3000`. All players must be able to reach the same server.

## Deploy for friends on different networks

Deploy this folder to a Node.js host that supports long-lived WebSocket connections (for example, a Node-capable app host). Set the start command to `npm start`; the host should provide `PORT`. Use the resulting HTTPS URL on each player's device. Do not deploy to a static-only host.

The server keeps room state in memory. This starter is intended for a single server instance; use a shared database/pub-sub service before scaling to multiple instances or expecting rooms to survive server restarts.

## Included

- Six-character room codes; 2–8 players.
- Host-created lobby, nickname selection, synchronized round timer.
- Classic A–Z: 30 seconds, five categories, randomized A–Z letters.
- Duplicate matching: all players with the same normalized answer receive -10.
- Unique valid first-letter answers: +25, +10, then +5.
- Trivia Blitz: 15-second multiple choice questions, +10 correct and +5 fastest-correct bonus.
- Team Battle: two automatically balanced teams, shared round submissions and team membership.
- 5, 10, or 15 round matches; results and leaderboard.

## Important scoring/validation notes

The server enforces empty-answer and starting-letter checks. It does not yet have a comprehensive dictionary or semantic classifier to verify that (for example) an entry in the Animal category is actually an animal. Players should agree to fair play. A production version should add a category validation/doubt workflow and a richer question bank.

The current Team Battle implementation assigns players to teams and tracks team membership, but submissions are individual answer sheets scored individually; true shared team drafting/chat and team-only score aggregation are the next feature layer. The game is playable as a team-labelled competitive mode, but this part does not yet fully implement the approved collaborative team rules.

The server uses server-side timestamps for scoring and round deadlines. For production, add reconnect tokens, persistent storage, rate limits, moderation, and robust host migration.
