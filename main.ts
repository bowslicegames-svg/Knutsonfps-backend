// KnutsonFPS Backend — Deno Deploy Edition
// No dependencies, no Express, no NPM, no Railway issues.

// -------------------- STATE --------------------

interface Player {
  id: string;
  lobby: string;
  x: number;
  y: number;
  z: number;
  name: string;
  hp: number;
  lastUpdate: number;
}

const players: Record<string, Player> = {};
const lobbies: Record<string, { code: string; createdAt: number }> = {};
const killfeed: Record<string, Array<{ attacker: string; target: string; time: number }>> = {};

function now() {
  return Date.now();
}

// -------------------- HELPERS --------------------

function generateLobbyCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function ensureLobbyExists(code: string) {
  if (!lobbies[code]) {
    lobbies[code] = { code, createdAt: now() };
  }
  if (!killfeed[code]) {
    killfeed[code] = [];
  }
}

function getLobbyPlayers(code: string) {
  return Object.values(players).filter((p) => p.lobby === code);
}

function ensureUniqueName(baseName: string, lobby: string) {
  const existing = new Set(getLobbyPlayers(lobby).map((p) => p.name));

  if (!existing.has(baseName)) return baseName;

  let i = 2;
  let candidate = `${baseName}${i}`;
  while (existing.has(candidate)) {
    i++;
    candidate = `${baseName}${i}`;
  }
  return candidate;
}

// -------------------- AFK CLEANUP --------------------

const AFK_TIMEOUT_MS = 60_000;

setInterval(() => {
  const cutoff = now() - AFK_TIMEOUT_MS;
  for (const id in players) {
    if (players[id].lastUpdate < cutoff) {
      delete players[id];
    }
  }
}, 10_000);

// -------------------- HTTP SERVER --------------------

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // -------------------- ROOT --------------------
  if (path === "/") {
    return new Response("KnutsonFPS Deno backend running", { status: 200 });
  }

  // -------------------- FIND LOBBY --------------------
  if (path === "/find_lobby" && req.method === "POST") {
    for (const code in lobbies) {
      if (getLobbyPlayers(code).length < 16) {
        return Response.json({ lobby: code });
      }
    }
    const code = generateLobbyCode();
    ensureLobbyExists(code);
    return Response.json({ lobby: code });
  }

  // -------------------- UPDATE --------------------
  if (path === "/update" && req.method === "POST") {
    const { id, lobby, x, y, z, name, hp } = await readJson(req);

    if (!id || !lobby) {
      return Response.json({ error: "id and lobby required" }, { status: 400 });
    }

    ensureLobbyExists(lobby);

    let finalName = name || "Player";

    if (!players[id] || players[id].lobby !== lobby) {
      finalName = ensureUniqueName(finalName, lobby);
    } else {
      finalName = name || players[id].name;
    }

    players[id] = {
      id,
      lobby,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      name: finalName,
      hp: typeof hp === "number" ? hp : players[id]?.hp ?? 100,
      lastUpdate: now(),
    };

    return Response.json({ ok: true, name: finalName });
  }

  // -------------------- GET STATE --------------------
  if (path === "/get_state" && req.method === "POST") {
    const { lobby } = await readJson(req);
    if (!lobby) {
      return Response.json({ error: "lobby required" }, { status: 400 });
    }
    return Response.json(getLobbyPlayers(lobby));
  }

  // -------------------- DAMAGE --------------------
  if (path === "/damage" && req.method === "POST") {
    const { attacker, target, amount, lobby } = await readJson(req);

    if (!attacker || !target || !lobby) {
      return Response.json({ error: "attacker, target, lobby required" }, { status: 400 });
    }

    const a = players[attacker];
    const t = players[target];

    if (!a || !t) {
      return Response.json({ ok: false, reason: "attacker or target missing" });
    }

    if (a.lobby !== lobby || t.lobby !== lobby) {
      return Response.json({ ok: false, reason: "different lobby" });
    }

    const dmg = Number(amount) || 0;
    t.hp = Math.max(0, t.hp - dmg);

    if (t.hp <= 0) {
      ensureLobbyExists(lobby);
      killfeed[lobby].push({
        attacker: a.name,
        target: t.name,
        time: now(),
      });
    }

    return Response.json({ ok: true, hp: t.hp });
  }

  // -------------------- FEED --------------------
  if (path === "/feed" && req.method === "POST") {
    const { lobby } = await readJson(req);
    if (!lobby) {
      return Response.json({ error: "lobby required" }, { status: 400 });
    }
    ensureLobbyExists(lobby);
    return Response.json(killfeed[lobby].slice(-10));
  }

  // -------------------- DEBUG --------------------
  if (path === "/debug/state") {
    return Response.json({ players, lobbies, killfeed });
  }

  return new Response("Not found", { status: 404 });
}

Deno.serve(handler);
