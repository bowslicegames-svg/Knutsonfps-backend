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

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/update" && req.method === "POST") {
    const { id, x, y, z, name, hp } = await readJson(req);

    if (!id) return Response.json({ error: "id required" });

    players[id] = {
      id,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      name: name || "Player",
      hp: Number(hp) || 100,
      lastUpdate: now()
    };

    return Response.json({ ok: true });
  }

  if (path === "/get_state" && req.method === "POST") {
    return Response.json(Object.values(players));
  }

  if (path === "/damage" && req.method === "POST") {
    const { attacker, target, amount } = await readJson(req);
    if (!players[target]) return Response.json({ ok: false });

    players[target].hp = Math.max(0, players[target].hp - Number(amount));

    if (players[target].hp <= 0) {
      killfeed.push({
        attacker: players[attacker]?.name || "Unknown",
        target: players[target].name,
        time: now()
      });
    }

    return Response.json({ ok: true });
  }

  if (path === "/feed" && req.method === "POST") {
    return Response.json(killfeed.slice(-10));
  }

  if (path === "/debug/state") {
    return Response.json({ players, killfeed });
  }

  return new Response("Not found", { status: 404 });
});
