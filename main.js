const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory player state
// { [playerId]: { x, y, z, rot, lastSeen } }
const players = Object.create(null);

// Simple ID generator for demo
function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// Clean up stale players every 30s
setInterval(() => {
  const now = Date.now();
  for (const id of Object.keys(players)) {
    if (now - players[id].lastSeen > 60_000) {
      delete players[id];
    }
  }
}, 30_000);

// HTTP: health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// HTTP: debug state
app.get("/debug/state", (_req, res) => {
  res.json({
    players,
    count: Object.keys(players).length
  });
});

// WebSocket: real-time player updates
wss.on("connection", (ws) => {
  const playerId = makeId();

  // Initialize player
  players[playerId] = {
    x: 0,
    y: 0,
    z: 0,
    rot: 0,
    lastSeen: Date.now()
  };

  // Send initial ID
  ws.send(JSON.stringify({ type: "welcome", id: playerId }));

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "update" && players[playerId]) {
      const p = players[playerId];
      if (typeof msg.x === "number") p.x = msg.x;
      if (typeof msg.y === "number") p.y = msg.y;
      if (typeof msg.z === "number") p.z = msg.z;
      if (typeof msg.rot === "number") p.rot = msg.rot;
      p.lastSeen = Date.now();
    }
  });

  ws.on("close", () => {
    delete players[playerId];
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
