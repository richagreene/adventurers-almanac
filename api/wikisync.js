// Serverless proxy for RuneLite WikiSync (sync.runescape.wiki).
//
// WikiSync is an opt-in RuneLite plugin that publishes a player's quest,
// achievement-diary and level state so tools like this one can read it. The
// browser tries the API directly first (it serves CORS headers); this proxy
// is the fallback for networks/browsers where that fails.
//
// Returns the WikiSync payload untouched:
//   { username, timestamp, levels, quests: { "<name>": 0|1|2 },
//     achievement_diaries: { "<region>": { "Easy": { complete, ... }, ... } }, ... }
//
// Runs on Vercel (Node), same shape as api/hiscores.js.

const UA = { "User-Agent": "AdventurersAlmanac/1.0 (OSRS planner)" };

export default async function handler(req, res) {
  const player = (req.query.player || "").toString().trim();
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!player) return res.status(400).json({ error: "Missing ?player=" });
  try {
    const r = await fetch(
      "https://sync.runescape.wiki/runelite/player/" + encodeURIComponent(player) + "/STANDARD",
      { headers: UA }
    );
    if (r.status === 404) return res.status(404).json({ error: "no-wikisync-data" });
    if (!r.ok) return res.status(502).json({ error: "wikisync-upstream-" + r.status });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "wikisync-unreachable" });
  }
}
