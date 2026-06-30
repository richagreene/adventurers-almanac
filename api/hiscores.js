// Serverless proxy for the official OSRS Hiscores.
//
// The hiscores endpoint sends no CORS headers, so the browser can't call it
// directly. This function fetches it server-side and returns clean JSON:
//   { rsn, skills: [{ id, name, rank, level, xp }], activities: [{ id, name, rank, score }] }
//
// Runs on Vercel (Node). Locally, Vite proxies /api to this during `vercel dev`,
// or the app falls back to Wise Old Man if the proxy isn't available.

const SKILLS = [
  "Overall", "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer",
  "Farming", "Runecrafting", "Hunter", "Construction",
];

export default async function handler(req, res) {
  const player = (req.query.player || "").toString().trim();
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!player) return res.status(400).json({ error: "Missing ?player=" });

  const url =
    "https://secure.runescape.com/m=hiscore_oldschool/index_lite.json?player=" +
    encodeURIComponent(player);

  try {
    const r = await fetch(url, { headers: { "User-Agent": "AdventurersAlmanac/1.0 (OSRS planner)" } });
    if (r.status === 404) return res.status(404).json({ error: "Player not found" });
    if (!r.ok) return res.status(502).json({ error: "Hiscores upstream " + r.status });

    // The JSON endpoint returns { skills:[{id,name,rank,level,xp}], activities:[...] }
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    return res.status(200).json({ rsn: player, skills: data.skills || [], activities: data.activities || [] });
  } catch (err) {
    // Fall back to the legacy CSV endpoint if the JSON one is unavailable.
    try {
      const csvUrl =
        "https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=" +
        encodeURIComponent(player);
      const r2 = await fetch(csvUrl, { headers: { "User-Agent": "AdventurersAlmanac/1.0" } });
      if (r2.status === 404) return res.status(404).json({ error: "Player not found" });
      const text = await r2.text();
      const lines = text.trim().split("\n");
      const skills = lines.slice(0, SKILLS.length).map((line, i) => {
        const [rank, level, xp] = line.split(",").map(Number);
        return { id: i, name: SKILLS[i], rank, level, xp };
      });
      return res.status(200).json({ rsn: player, skills, activities: [] });
    } catch (e2) {
      return res.status(502).json({ error: "Hiscores unreachable" });
    }
  }
}
