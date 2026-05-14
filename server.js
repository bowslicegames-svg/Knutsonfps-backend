import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let players = {};
let killfeed = [];

// Update player state
app.post("/update", (req, res) => {
    const { id, x, y, z, name, hp } = req.body;
    players[id] = { id, x, y, z, name, hp };
    res.json({ ok: true });
});

// Get all players
app.get("/get_state", (req, res) => {
    res.json(Object.values(players));
});

// Damage system
app.post("/damage", (req, res) => {
    const { attacker, target, amount } = req.body;

    if (!players[target]) return res.json({ ok: false });

    players[target].hp -= amount;

    if (players[target].hp <= 0) {
        killfeed.unshift({
            attacker: players[attacker]?.name || "Unknown",
            target: players[target]?.name || "Unknown"
        });

        // Limit killfeed to last 10 events
        killfeed = killfeed.slice(0, 10);

        // Respawn
        players[target].hp = 100;
        players[target].x = 0;
        players[target].y = 0.5;
        players[target].z = 0;
    }

    res.json({ ok: true });
});

// Killfeed
app.get("/feed", (req, res) => {
    res.json(killfeed);
});

// Railway port binding
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend running on port", PORT));
