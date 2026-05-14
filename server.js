// server.js
// KnutsonFPS backend with lobbies + unique names

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -------------------- STATE --------------------

// players: id -> { id, lobby, x, y, z, name, hp, lastUpdate }
const players = Object.create(null);

// lobbies: code -> { code, createdAt }
const lobbies = Object.create(null);

// killfeed: code -> [ { attacker, target, time } ]
const killfeed = Object.create(null);

// -------------------- HELPERS --------------------

function now() {
    return Date.now();
}

function generateLobbyCode() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function getLobbyPlayers(code) {
    return Object.values(players).filter(p => p.lobby === code);
}

function ensureLobbyExists(code) {
    if (!lobbies[code]) {
        lobbies[code] = { code, createdAt: now() };
        killfeed[code] = killfeed[code] || [];
    }
}

function ensureUniqueName(baseName, lobbyCode) {
    const existing = new Set(
        getLobbyPlayers(lobbyCode).map(p => p.name)
    );

    if (!existing.has(baseName)) return baseName;

    let i = 2;
    let candidate = `${baseName}${i}`;
    while (existing.has(candidate)) {
        i++;
        candidate = `${baseName}${i}`;
    }
    return candidate;
}

// Clean up AFK players (e.g. 60s no update)
const AFK_TIMEOUT_MS = 60 * 1000;
setInterval(() => {
    const cutoff = now() - AFK_TIMEOUT_MS;
    for (const id in players) {
        if (players[id].lastUpdate < cutoff) {
            delete players[id];
        }
    }
}, 10000);

// -------------------- MATCHMAKING --------------------

// Quick-play: find lobby with <16 players, else create new
app.post("/find_lobby", (req, res) => {
    // find existing lobby with space
    for (const code in lobbies) {
        const count = getLobbyPlayers(code).length;
        if (count < 16) {
            return res.json({ lobby: code });
        }
    }

    // create new lobby
    const code = generateLobbyCode();
    ensureLobbyExists(code);
    return res.json({ lobby: code });
});

// -------------------- CORE ENDPOINTS --------------------

// Update player state
app.post("/update", (req, res) => {
    const { id, lobby, x, y, z, name, hp } = req.body || {};

    if (!id || !lobby) {
        return res.status(400).json({ error: "id and lobby required" });
    }

    ensureLobbyExists(lobby);

    let finalName = name || "Player";

    // If player is new or changed lobby, enforce unique name
    if (!players[id] || players[id].lobby !== lobby) {
        finalName = ensureUniqueName(finalName, lobby);
    } else {
        // keep existing name if not provided
        finalName = name || players[id].name;
    }

    players[id] = {
        id,
        lobby,
        x: Number(x) || 0,
        y: Number(y) || 0,
        z: Number(z) || 0,
        name: finalName,
        hp: typeof hp === "number" ? hp : (players[id]?.hp ?? 100),
        lastUpdate: now()
    };

    res.json({ ok: true, name: finalName });
});

// Get state for a lobby
app.post("/get_state", (req, res) => {
    const { lobby } = req.body || {};
    if (!lobby) {
        return res.status(400).json({ error: "lobby required" });
    }
    const list = getLobbyPlayers(lobby);
    res.json(list);
});

// Apply damage
app.post("/damage", (req, res) => {
    const { attacker, target, amount, lobby } = req.body || {};

    if (!attacker || !target || !lobby) {
        return res.status(400).json({ error: "attacker, target, lobby required" });
    }

    const a = players[attacker];
    const t = players[target];

    if (!a || !t) {
        return res.json({ ok: false, reason: "attacker or target missing" });
    }

    // must be same lobby
    if (a.lobby !== lobby || t.lobby !== lobby) {
        return res.json({ ok: false, reason: "different lobby" });
    }

    const dmg = Number(amount) || 0;
    t.hp = Math.max(0, t.hp - dmg);

    if (t.hp <= 0) {
        // record kill in killfeed
        ensureLobbyExists(lobby);
        killfeed[lobby].push({
            attacker: a.name,
            target: t.name,
            time: now()
        });

        // optional: remove dead player from state
        // delete players[target];
    }

    res.json({ ok: true, hp: t.hp });
});

// Killfeed per lobby
app.post("/feed", (req, res) => {
    const { lobby } = req.body || {};
    if (!lobby) {
        return res.status(400).json({ error: "lobby required" });
    }

    ensureLobbyExists(lobby);

    // return last N events
    const events = killfeed[lobby].slice(-10);
    res.json(events);
});

// -------------------- DEBUG / HEALTH --------------------

app.get("/", (req, res) => {
    res.send("KnutsonFPS backend running");
});

app.get("/debug/state", (req, res) => {
    res.json({ players, lobbies, killfeed });
});

// -------------------- START --------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("KnutsonFPS backend listening on port", PORT);
});
 
