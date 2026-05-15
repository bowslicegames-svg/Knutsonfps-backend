interface Player {
  id: string;
  x: number;
  y: number;
  z: number;
  name: string;
  hp: number;
  lastUpdate: number;
}

interface KillEvent {
  attacker: string;
  target: string;
  time: number;
}

const kv = await Deno.openKv(); // uses the attached KV instance

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// ---- PLAYERS ----

async function savePlayer(p: Player) {
  await kv.set(["players", p.id], p);
}

async function getPlayer(id: string): Promise<Player | null> {
  const res = await kv.get<Player>(["players", id]);
  return res.value ?? null;
}

async function listPlayers(): Promise<Player[]> {
  const out: Player[] = [];
  for await (const entry of kv.list<Player>({ prefix: ["players"] })) {
    out.push(entry.value);
  }
  return out;
}

// ---- KILLFEED ----

async function addKill(attackerName: string, targetName: string) {
  const ev: KillEvent = {
    attacker: attackerName,
    target: targetName,
    time: Date.now()
  };
  await kv.set(["killfeed", ev.time, Math.random()], ev);
}

async function listKillfeed(limit = 10): Promise<KillEvent[]> {
  const out: KillEvent[] = [];
  for await (const entry of kv.list<KillEvent>({ prefix: ["killfeed"] })) {
    out.push(entry.value);
  }
  // newest last; keep last N
  return out.slice(-limit);
}

// ---- HTTP HANDLER ----

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // UPDATE PLAYER
  if (path === "/update" && req.method === "POST") {
    const { id, x, y, z, name, hp } = await readJson(req);
    if (!id) return Response.json({ error: "missing id" }, { status: 400 });

    const player: Player = {
      id,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      name: name || "Player",
      hp: Number(hp) || 100,
      lastUpdate: Date.now()
    };

    await savePlayer(player);
    return Response.json({ ok: true });
  }

  // GET ALL PLAYERS
  if (path === "/get_state") {
    const players = await listPlayers();
    return Response.json(players);
  }

  // APPLY DAMAGE
  if (path === "/damage" && req.method === "POST") {
    const { attacker, target, amount } = await readJson(req);
    if (!target) return Response.json({ ok: false, error: "missing target" });

    const p = await getPlayer(target);
    if (!p) return Response.json({ ok: false, error: "no such player" });

    const dmg = Number(amount) || 0;
    p.hp = Math.max(0, p.hp - dmg);
    await savePlayer(p);

    if (p.hp <= 0) {
      const attackerPlayer = attacker ? await getPlayer(attacker) : null;
      await addKill(attackerPlayer?.name || "Unknown", p.name);
    }

    return Response.json({ ok: true });
  }

  // KILLFEED
  if (path === "/feed") {
    const feed = await listKillfeed(10);
    return Response.json(feed);
  }

  // DEBUG
  if (path === "/debug/state") {
    const players = await listPlayers();
    const feed = await listKillfeed(20);
    return Response.json({ players, feed });
  }

  return new Response("Not found", { status: 404 });
});
