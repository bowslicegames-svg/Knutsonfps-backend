const kv = await Deno.openKv();

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Safe JSON parse
  let body = {};
  try { body = await req.json(); } catch {}

  // --- UPDATE PLAYER ---
  if (url.pathname === "/update" && req.method === "POST") {
    const { id, x, y, z, name, hp } = body;
    if (!id) return Response.json({ ok: false, error: "missing id" });

    await kv.set(["players", id], {
      id,
      x: Number(x) || 0,
      y: Number(y) || 0,
      z: Number(z) || 0,
      name: name || "Player",
      hp: Number(hp) || 100,
      lastUpdate: Date.now()
    });

    return Response.json({ ok: true });
  }

  // --- GET STATE ---
  if (url.pathname === "/get_state") {
    const players = [];
    for await (const entry of kv.list({ prefix: ["players"] })) {
      players.push(entry.value);
    }
    return Response.json(players);
  }

  // --- DAMAGE ---
  if (url.pathname === "/damage" && req.method === "POST") {
    const { attacker, target, amount } = body;
    if (!target) return Response.json({ ok: false });

    const p = await kv.get(["players", target]);
    if (!p.value) return Response.json({ ok: false });

    p.value.hp = Math.max(0, p.value.hp - Number(amount || 0));
    await kv.set(["players", target], p.value);

    if (p.value.hp <= 0) {
      await kv.set(["killfeed", Date.now(), Math.random()], {
        attacker,
        target: p.value.name,
        time: Date.now()
      });
    }

    return Response.json({ ok: true });
  }

  // --- FEED ---
  if (url.pathname === "/feed") {
    const feed = [];
    for await (const entry of kv.list({ prefix: ["killfeed"] })) {
      feed.push(entry.value);
    }
    return Response.json(feed.slice(-10));
  }

  // --- DEBUG ---
  if (url.pathname === "/debug/state") {
    const players = [];
    for await (const entry of kv.list({ prefix: ["players"] })) {
      players.push(entry.value);
    }
    const feed = [];
    for await (const entry of kv.list({ prefix: ["killfeed"] })) {
      feed.push(entry.value);
    }
    return Response.json({ players, feed });
  }

  return new Response("Not found", { status: 404 });
});
