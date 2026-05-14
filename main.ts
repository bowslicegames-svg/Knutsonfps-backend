// main.ts
// KnutsonFPS backend — single global lobby, old behaviour

interface Player {
  id: string;
  x: number;
  y: number;
  z: number;
  name: string;
  hp: number;
  lastUpdate: number;
}

const players: Record<string, Player> = {};
const killfeed: Array<{ attacker: string; target: string; time: number }> = [];

function now() {
  return Date.now();
}

// AFK cleanup (60s)
const AFK_TIMEOUT_MS = 60_000;
setInterval(() => {
  const cutoff = now() - AFK_TIMEOUT_MS;
  for (const id in players) {
    if (players[id].lastUpdate < cutoff) {
      delete players[id];
    }
  }
}, 10_000);

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

  // Health
  if (path === "/" && req.method === "GET") {
    return new Response("KnutsonFPS Deno backend running", { status: 200 });
  }

  // ---- UPDATE ----
  // Body: { id, x, y, z, name, hp }
  if (path === "/update" && req.method === "POST") {
    const { id, x, y, z, name, hp } = await readJson(req);

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400 });
    }

    const prev = players[id];
    const finalName = (name && String(name).slice(0, 16)) || prev?.name || "Player";

    players[id] = {
      id,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      name: finalName,
      hp: typeof hp === "number" ? hp : prev?.hp ?? 100,
      lastUpdate: now()
    };

    return Response.json({ ok: true, name: finalName });
  }

  // ---- GET_STATE ----
  // Body: {}  (no lobby, returns all players)
  if (path === "/get_state" && req.method === "POST") {
    const list = Object.values(players);
    return Response.json(list);
  }

  // ---- DAMAGE ----
  // Body: { attacker, target, amount }
  if (path === "/damage" && req.method === "POST") {
    const { attacker, target, amount } = await readJson(req);

    if (!attacker || !target) {
      return Response.json({ error: "attacker and target required" }, { status: 400 });
    }

    const a = players[attacker];
    const t = players[target];

    if (!a || !t) {
      return Response.json({ ok: false, reason: "attacker or target missing" });
    }

    const dmg = Number(amount) || 0;
    t.hp = Math.max(0, t.hp - dmg);

    if (t.hp <= 0) {
      killfeed.push({
        attacker: a.name,
        target: t.name,
        time: now()
      });
      // optional: delete players[target];
    }

    return Response.json({ ok: true, hp: t.hp });
  }

  // ---- FEED ----
  // Body: {}
  if (path === "/feed" && req.method === "POST") {
    const events = killfeed.slice(-10);
    return Response.json(events);
  }

  // ---- DEBUG ----
  if (path === "/debug/state" && req.method === "GET") {
    return Response.json({ players, killfeed });
  }

  return new Response("Not found", { status: 404 });
}

Deno.serve(handler);
