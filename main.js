// server.js
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// in‑memory player store
const players = {}; // { id: { x,y,z,rot, lastSeen } }

// simple health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// state debug endpoint used by your client
app.get("/debug/state", (req, res) => {
  res.json({ players });
});

// clean up stale players every 30s (optional but nice)
setInterval(() => {
  const now = Date.now();
  const timeoutMs = 30_000;
  for (const id in players) {
    if (now - players[id].lastSeen > timeoutMs) {
      delete players[id];
    }
  }
}, 30_000);

// websocket handling
wss.on("connection", (ws) => {
  const id = crypto.randomUUID();

  // create initial entry
  players[id] = {
    x: 0,
    y: 0.5,
    z: 0,
    rot: 0,
    lastSeen: Date.now()
  };

  // tell client its id
  ws.send(JSON.stringify({ type: "welcome", id }));

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.type === "update" && players[id]) {
      players[id].x = msg.x ?? players[id].x;
      players[id].y = msg.y ?? players[id].y;
      players[id].z = msg.z ?? players[id].z;
      players[id].rot = msg.rot ?? players[id].rot;
      players[id].lastSeen = Date.now();
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

// Render uses PORT env
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on", PORT);
});
