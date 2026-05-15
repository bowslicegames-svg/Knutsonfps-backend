const kv = await Deno.openKv();

// UPDATE PLAYER
async function updatePlayer(data: any) {
  const id = data.id;
  if (!id) return;

  const player = {
    id,
    x: Number(data.x) || 0,
    y: Number(data.y) || 0,
    z: Number(data.z) || 0,
    name: data.name || "Player",
    hp: Number(data.hp) || 100,
    lastUpdate: Date.now()
  };

  await kv.set(["players", id], player);
}

// GET ALL PLAYERS
async function getPlayers() {
  const list = [];
  for await (const entry of kv.list({ prefix: ["players"] })) {
    list.push(entry.value);
  }
  return list;
}

// APPLY DAMAGE
async function applyDamage(attacker: string, target: string, amount: number) {
  const key = ["players", target];
  const entry = await kv.get(key);
  if (!entry.value) return;

  const p = entry.value;
  p.hp = Math.max(0, p.hp - amount);

  await kv.set(key, p);

  if (p.hp <= 0) {
    await kv.set(["killfeed", Date.now()], {
      attacker,
      target: p.name,
      time: Date.now()
    });
  }
}

// GET KILLFEED
async function getKillfeed() {
  const events = [];
  for await (const entry of kv.list({ prefix: ["killfeed"] })) {
    events.push(entry.value);
  }
  return events.slice(-10);
}

// SERVER
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/update" && req.method === "POST") {
    const data = await req.json();
    await updatePlayer(data);
    return Response.json({ ok: true });
  }

  if (path === "/get_state") {
    const players = await getPlayers();
    return Response.json(players);
  }

  if (path === "/damage" && req.method === "POST") {
    const { attacker, target, amount } = await req.json();
    await applyDamage(attacker, target, Number(amount));
    return Response.json({ ok: true });
  }

  if (path === "/feed") {
    const feed = await getKillfeed();
    return Response.json(feed);
  }

  if (path === "/debug/state") {
    const players = await getPlayers();
    const feed = await getKillfeed();
    return Response.json({ players, feed });
  }

  return new Response("Not found", { status: 404 });
});
