// Live-data layer for The Adventurer's Almanac.
//
// Replaces the two static ingestion sheets from the original workbook:
//   * Hiscores  -> official OSRS Hiscores (via the /api/hiscores proxy)
//   * GEPrices  -> OSRS Wiki real-time prices API (latest / mapping / volumes)
// The OSRS Wiki MediaWiki API is used only to fill gaps the baked-in data
// modules don't cover.
//
// Everything degrades gracefully: if a fetch fails (offline, CORS, rate
// limit) the app keeps working on its last cached values / manual entry.

const PRICES = "https://prices.runescape.wiki/api/v1/osrs";
const WIKI = "https://oldschool.runescape.wiki/api.php";

// Canonical skill order used throughout the app (matches the workbook's
// Stats sheet). Index 0 of each tuple is the display name.
export const SKILL_ORDER = [
  "Attack", "Strength", "Defence", "Hitpoints", "Ranged", "Prayer", "Magic",
  "Runecraft", "Construction", "Agility", "Herblore", "Thieving", "Crafting",
  "Fletching", "Slayer", "Hunter", "Mining", "Smithing", "Fishing", "Cooking",
  "Firemaking", "Woodcutting", "Farming",
];

// Map the various source spellings -> our canonical name.
const ALIAS = {
  runecrafting: "Runecraft", runecraft: "Runecraft",
  attack: "Attack", strength: "Strength", defence: "Defence", defense: "Defence",
  hitpoints: "Hitpoints", ranged: "Ranged", prayer: "Prayer", magic: "Magic",
  construction: "Construction", agility: "Agility", herblore: "Herblore",
  thieving: "Thieving", crafting: "Crafting", fletching: "Fletching",
  slayer: "Slayer", hunter: "Hunter", mining: "Mining", smithing: "Smithing",
  fishing: "Fishing", cooking: "Cooking", firemaking: "Firemaking",
  woodcutting: "Woodcutting", farming: "Farming",
};

const J = (r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };

// Build the canonical 23-tuple [name, level, xp] array from a name->{level,xp} map.
function toSkillsRaw(map) {
  return SKILL_ORDER.map((name) => {
    const v = map[name] || {};
    const level = Math.max(1, v.level || 1);
    const xp = Math.max(0, v.xp || 0);
    return [name, level, xp];
  });
}

// OSRS combat level from the canonical skill map.
export function combatLevel(map) {
  const L = (n) => (map[n] || { level: 1 }).level || 1;
  const base = 0.25 * (L("Defence") + L("Hitpoints") + Math.floor(L("Prayer") / 2));
  const melee = 0.325 * (L("Attack") + L("Strength"));
  const range = 0.325 * Math.floor(1.5 * L("Ranged"));
  const mage = 0.325 * Math.floor(1.5 * L("Magic"));
  return Math.floor(base + Math.max(melee, range, mage));
}

// ---- Official OSRS Hiscores (via our serverless proxy to dodge CORS) ----
// The proxy reports `mode` ("main"/"iron") by checking the official Ironman
// hiscores board, and `qp` from the Quest Points activity when it's present.
async function fromHiscores(rsn) {
  const r = await fetch(`/api/hiscores?player=${encodeURIComponent(rsn)}`, {
    headers: { Accept: "application/json" },
  });
  if (r.status === 404) throw new Error("not-found");
  const d = await J(r);
  const map = {};
  let qp = 0;
  (d.skills || []).forEach((s) => {
    const name = ALIAS[(s.name || "").toLowerCase()];
    if (!name) return;
    map[name] = { level: Math.max(1, s.level), xp: Math.max(0, s.xp) };
  });
  (d.activities || []).forEach((a) => {
    if (/quest point/i.test(a.name || "") && a.score > 0) qp = a.score;
  });
  return { source: "OSRS Hiscores", mode: d.mode === "iron" ? "iron" : "main", map, qp };
}

/**
 * Fetch a player's live stats from the official OSRS Hiscores (via the
 * /api/hiscores proxy, which dodges CORS and detects account type). Quest
 * points aren't exposed by the hiscores for mains, so `qp` is usually null and
 * the Quests tab supplies it interactively.
 */
export async function fetchPlayer(rsn) {
  const name = (rsn || "").trim();
  if (!name) return { ok: false, error: "Enter a RuneScape name." };
  let data;
  try {
    data = await fromHiscores(name);
  } catch (e) {
    return { ok: false, error: `Couldn't find "${name}" on the OSRS Hiscores. Check spelling, or enter stats manually.` };
  }
  return {
    ok: true,
    rsn: name,
    source: data.source,
    mode: data.mode,
    skills: toSkillsRaw(data.map),
    combat: combatLevel(data.map),
    qp: data.qp || null,
  };
}

// ----------------------------------------------------------------------------
// Grand Exchange prices (OSRS Wiki real-time prices API)
// ----------------------------------------------------------------------------
let _priceCache = null; // { at, byId, byName, mapping }

/**
 * Fetch and index live GE prices. Returns { byId, byName, mapping, at }.
 * `byName` keys are lowercased item names -> { id, name, limit, highalch,
 * members, low, high, lowTime, highTime, volume }. Cached for `maxAgeMs`.
 */
export async function fetchPrices({ maxAgeMs = 60_000 } = {}) {
  if (_priceCache && Date.now() - _priceCache.at < maxAgeMs) return _priceCache;
  const H = { Accept: "application/json" };
  const [mapping, latest, volumes] = await Promise.all([
    fetch(`${PRICES}/mapping`, { headers: H }).then(J),
    fetch(`${PRICES}/latest`, { headers: H }).then(J).then((d) => d.data || {}),
    fetch(`${PRICES}/volumes`, { headers: H }).then(J).then((d) => d.data || {}).catch(() => ({})),
  ]);
  const byId = {};
  const byName = {};
  mapping.forEach((m) => {
    const live = latest[m.id] || {};
    const row = {
      id: m.id,
      name: m.name,
      limit: m.limit || 0,
      highalch: m.highalch || 0,
      members: !!m.members,
      low: live.low || 0,
      high: live.high || 0,
      lowTime: live.lowTime || 0,
      highTime: live.highTime || 0,
      volume: volumes[m.id] || 0,
    };
    byId[m.id] = row;
    byName[m.name.toLowerCase()] = row;
  });
  _priceCache = { at: Date.now(), byId, byName, mapping };
  return _priceCache;
}

// Convenience: latest low/high for a single item id (e.g. nature rune = 561).
export async function priceById(id) {
  const r = await fetch(`${PRICES}/latest?id=${id}`, { headers: { Accept: "application/json" } }).then(J);
  return (r.data && r.data[id]) || null;
}

// ----------------------------------------------------------------------------
// MediaWiki API — used to fill gaps the baked-in data doesn't cover.
// ----------------------------------------------------------------------------
export async function wikiExtract(title) {
  const params = new URLSearchParams({
    action: "query", prop: "extracts", exintro: "1", explaintext: "1",
    redirects: "1", format: "json", origin: "*", titles: title,
  });
  const d = await fetch(`${WIKI}?${params}`, { headers: { Accept: "application/json" } }).then(J);
  const pages = (d.query && d.query.pages) || {};
  const first = Object.values(pages)[0];
  return first ? first.extract || "" : "";
}
