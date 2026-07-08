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

// ---- RuneLite WikiSync (opt-in quest / diary completion sync) ----
// Players who run the WikiSync plugin publish their quest & diary state to
// sync.runescape.wiki. Direct fetch first (the API serves CORS); fall back to
// our /api/wikisync serverless proxy. Returns normalized maps ready for the
// almanac's questOv / diaryOv:
//   quests:  { "<quest name>": true }        (only COMPLETED, state === 2)
//   diaries: { "<Region>|<Tier>": true }     (only complete tiers)
export async function fetchWikiSync(rsn) {
  const name = (rsn || "").trim();
  if (!name) return { ok: false, error: "Load a RuneScape name first — WikiSync looks the player up by RSN." };
  const urls = [
    "https://sync.runescape.wiki/runelite/player/" + encodeURIComponent(name) + "/STANDARD",
    "/api/wikisync?player=" + encodeURIComponent(name),
  ];
  let lastErr = "WikiSync unreachable from this browser.";
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { Accept: "application/json" } });
      if (r.status === 404) return { ok: false, error: `WikiSync has no data for "${name}". They need the free WikiSync plugin enabled in RuneLite, then to log in once — it syncs automatically after that.` };
      if (!r.ok) { lastErr = "WikiSync answered " + r.status + "."; continue; }
      const d = await r.json();
      const quests = {};
      Object.entries(d.quests || {}).forEach(([n, st]) => { if (st === 2) quests[n] = true; });
      const diaries = {};
      Object.entries(d.achievement_diaries || {}).forEach(([region, tiers]) =>
        Object.entries(tiers || {}).forEach(([tier, v]) => { if (v && v.complete) diaries[region + "|" + tier] = true; }));
      return { ok: true, rsn: d.username || name, at: d.timestamp || null, quests, diaries };
    } catch (e) { /* try the next route */ }
  }
  return { ok: false, error: lastErr };
}

// ----------------------------------------------------------------------------
// Grand Exchange prices (OSRS Wiki real-time prices API)
// ----------------------------------------------------------------------------
let _priceCache = null; // { at, byId, byName, mapping }

/**
 * Fetch and index live GE prices. Returns { byId, byName, mapping, at }.
 * `byName` keys are lowercased item names -> { id, name, limit, highalch,
 * members, low, high, lowTime, highTime, volume, avgHigh1h, avgLow1h,
 * hvol1h, lvol1h }. Cached for `maxAgeMs`.
 *
 * `volume` is the Wiki's 24h total (yesterday-ish). The /1h fields are the
 * LAST HOUR's average prices and per-side volumes (highPriceVolume = units
 * insta-bought, lowPriceVolume = units insta-sold) — the honest measure of
 * what's actually trading right now.
 */
export async function fetchPrices({ maxAgeMs = 60_000 } = {}) {
  if (_priceCache && Date.now() - _priceCache.at < maxAgeMs) return _priceCache;
  const H = { Accept: "application/json" };
  const [mapping, latest, volumes, hour] = await Promise.all([
    fetch(`${PRICES}/mapping`, { headers: H }).then(J),
    fetch(`${PRICES}/latest`, { headers: H }).then(J).then((d) => d.data || {}),
    fetch(`${PRICES}/volumes`, { headers: H }).then(J).then((d) => d.data || {}).catch(() => ({})),
    fetch(`${PRICES}/1h`, { headers: H }).then(J).then((d) => d.data || {}).catch(() => null),
  ]);
  const byId = {};
  const byName = {};
  mapping.forEach((m) => {
    const live = latest[m.id] || {};
    const h = hour ? hour[m.id] || {} : null;
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
      avgHigh1h: h ? h.avgHighPrice || 0 : null,
      avgLow1h: h ? h.avgLowPrice || 0 : null,
      hvol1h: h ? h.highPriceVolume || 0 : null,
      lvol1h: h ? h.lowPriceVolume || 0 : null,
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

// Every tradeable item name (from the GE mapping), sorted — used to populate
// the Flip Ledger autocomplete. Cached via fetchPrices.
let _itemNames = null;
export async function fetchItemNames() {
  if (_itemNames) return _itemNames;
  const { mapping } = await fetchPrices({ maxAgeMs: 24 * 60 * 60 * 1000 });
  _itemNames = (mapping || []).map((m) => m.name).filter(Boolean).sort((a, b) => a.localeCompare(b));
  return _itemNames;
}

// Live nature-rune price (id 561). Returns gp (high, then low) or null.
export async function natureRunePrice() {
  try {
    const p = await priceById(561);
    return p ? p.high || p.low || null : null;
  } catch (e) {
    return null;
  }
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

// Top-level section map of a wiki page — powers "jump straight to X" deep
// links on the boss guide pages. Returns [{ line, anchor }].
export async function wikiSections(title) {
  const params = new URLSearchParams({ action: "parse", page: title, prop: "sections", redirects: "1", format: "json", origin: "*" });
  const d = await fetch(`${WIKI}?${params}`, { headers: { Accept: "application/json" } }).then(J);
  const secs = (d.parse && d.parse.sections) || [];
  return secs.filter((s) => +s.toclevel <= 2).map((s) => ({ line: (s.line || "").replace(/<[^>]+>/g, ""), anchor: s.anchor }));
}
