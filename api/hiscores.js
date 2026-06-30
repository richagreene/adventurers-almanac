// Serverless proxy for the official OSRS Hiscores.
//
// The hiscores endpoint sends no CORS headers, so the browser can't call it
// directly. This function fetches it server-side and returns clean JSON:
//   { rsn, mode, skills: [{ id, name, rank, level, xp }], activities: [{ id, name, rank, score }] }
//
// `mode` is "iron" when the account also appears on the official Ironman
// hiscores board, otherwise "main" — this replaces the account-type lookup we
// previously borrowed from Wise Old Man. Hardcore/ultimate ironmen also appear
// on the Ironman board, so they correctly resolve to "iron".
//
// Runs on Vercel (Node). Locally, Vite proxies /api to this during `vercel dev`.

const SKILLS = [
  "Overall", "Attack", "Defence", "Strength", "Hitpoints", "Ranged", "Prayer",
  "Magic", "Cooking", "Woodcutting", "Fletching", "Fishing", "Firemaking",
  "Crafting", "Smithing", "Mining", "Herblore", "Agility", "Thieving", "Slayer",
  "Farming", "Runecrafting", "Hunter", "Construction",
];

const UA = { "User-Agent": "AdventurersAlmanac/1.0 (OSRS planner)" };

const jsonBoard = (board, player) =>
  `https://secure.runescape.com/m=${board}/index_lite.json?player=` +
  encodeURIComponent(player);

// Fetch one game-mode board as JSON. Returns { status, data }.
async function fetchBoard(board, player) {
  const r = await fetch(jsonBoard(board, player), { headers: UA });
  if (!r.ok) return { status: r.status, data: null };
  return { status: 200, data: await r.json() };
}

export default async function handler(req, res) {
  const player = (req.query.player || "").toString().trim();
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!player) return res.status(400).json({ error: "Missing ?player=" });

  try {
    // The main board carries the stats; the Ironman board (fetched in parallel)
    // tells us the account type. A failed/absent Ironman probe is non-fatal and
    // simply resolves the account to "main".
    const [main, iron] = await Promise.all([
      fetchBoard("hiscore_oldschool", player),
      fetchBoard("hiscore_oldschool_ironman", player).catch(() => ({ status: 0, data: null })),
    ]);

    if (main.status === 404) return res.status(404).json({ error: "Player not found" });

    const mode = iron.status === 200 ? "iron" : "main";

    let skills, activities = [];
    if (main.status === 200 && main.data) {
      // The JSON endpoint returns { skills:[{id,name,rank,level,xp}], activities:[...] }
      skills = main.data.skills || [];
      activities = main.data.activities || [];
    } else {
      // JSON board unavailable — fall back to the legacy CSV endpoint.
      const csvUrl =
        "https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws?player=" +
        encodeURIComponent(player);
      const r2 = await fetch(csvUrl, { headers: UA });
      if (r2.status === 404) return res.status(404).json({ error: "Player not found" });
      if (!r2.ok) return res.status(502).json({ error: "Hiscores upstream " + main.status });
      const text = await r2.text();
      const lines = text.trim().split("\n");
      skills = lines.slice(0, SKILLS.length).map((line, i) => {
        const [rank, level, xp] = line.split(",").map(Number);
        return { id: i, name: SKILLS[i], rank, level, xp };
      });
    }

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    return res.status(200).json({ rsn: player, mode, skills, activities });
  } catch (err) {
    return res.status(502).json({ error: "Hiscores unreachable" });
  }
}
