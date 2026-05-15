import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import crypto from "crypto";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const players = {};

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/debug/state", (req, res) => {
  res.json({ players });
});

setInterval(() => {
  const now = Date.now();
  for (const id in players) {
    if (now - players[id].lastSeen > 30000) {
      delete players[id];
    }
  }
}, 5000);

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();

  players[id] = {
    x: 0,
    y: 0.5,
    z: 0,
    rot: 0,
    lastSeen: Date.now()
  };

  ws.send(JSON.stringify({ type: "welcome", id }));

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "update" && players[id]) {
      players[id].x = msg.x;
      players[id].y = msg.y;
      players[id].z = msg.z;
      players[id].rot = msg.rot;
      players[id].lastSeen = Date.now();
    }
  });

  ws.on("close", () => {
    delete players[id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
