const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// In-memory stores
const players = new Map();   // id -> { id,x,y,z,hp,name,last }
const feed = [];             // killfeed events

// Cleanup idle players
function cleanupIdle() {
  const now = Date.now();
  const timeout = 20000; // 20s
  for (const [id, p] of players.entries()) {
    if (now - p.last > timeout) {
      players.delete(id);
    }
  }
}

// POST /update
app.post("/update", (req, res) => {
  const { id, x, y, z, name, hp } = req.body;

  if (!id) return res.json({ error: "missing id" });

  const now = Date.now();
  let p = players.get(id);

  if (!p) {
    p = {
      id,
      x: x ?? 0,
      y: y ?? 0.5,
      z: z ?? 0,
      hp: hp !== undefined ? Number(hp) : 100,
      name: name || id,
      last: now
    };
  } else {
    if (x !== undefined) p.x = x;
    if (y !== undefined) p.y = y;
    if (z !== undefined) p.z = z;
    if (hp !== undefined) p.hp = Number(hp);
    if (name) p.name = name;
    p.last = now;
  }

  players.set(id, p);
  cleanupIdle();
  res.json({ ok: true });
});

// GET /get_state
app.get("/get_state", (req, res) => {
  cleanupIdle();
  res.json(Array.from(players.values()));
});

// POST /damage
app.post("/damage", (req, res) => {
  const { attacker, target, amount } = req.body;

  if (!attacker || !target || amount === undefined)
    return res.json({ error: "missing fields" });

  const dmg = Number(amount);
  const targetPlayer = players.get(target);
  const attackerPlayer = players.get(attacker);

  if (!targetPlayer) return res.json({ error: "target not found" });

  const oldHp = targetPlayer.hp ?? 100;
  let newHp = oldHp - dmg;
  if (newHp < 0) newHp = 0;

  targetPlayer.hp = newHp;

  let event = null;

  if (newHp <= 0 && oldHp > 0) {
    const attName = attackerPlayer?.name || attacker;
    const tarName = targetPlayer.name || target;

    event = {
      time: Date.now(),
      attacker: attName,
      target: tarName,
      type: "kill"
    };

    feed.push(event);

    // Respawn
    targetPlayer.hp = 100;
    targetPlayer.x = 0;
    targetPlayer.y = 0.5;
    targetPlayer.z = 0;
  }

  players.set(target, targetPlayer);
  res.json({ ok: true, hp: targetPlayer.hp, kill: event });
});

// GET /feed
app.get("/feed", (req, res) => {
  res.json(feed.slice(-10));
});

app.listen(PORT, () => {
  console.log("KnutsonFPS backend running on port", PORT);
});
