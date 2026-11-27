const GATES = {
  main: "http://main.imeroleplay.com:30120",
  inter: "http://inter.imeroleplay.com:30120",
};

module.exports = async (req, res) => {
  const base = GATES[req.query.g];
  const f =
    req.query.f === "players" ? "players.json" :
    req.query.f === "dynamic" ? "dynamic.json" : null;

  if (!base || !f) return res.status(400).json({ error: "bad request" });

  try {
    const r = await fetch(`${base}/${f}`, { signal: AbortSignal.timeout(8000) });
    const body = await r.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: e.cause?.code || e.message });
  }
};
