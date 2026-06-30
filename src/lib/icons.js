// Item & skill icon helpers. Images come from RuneLite's icon CDN keyed by item
// id (looked up from the osrsreboxed name→id index), with an OSRS Wiki
// Special:FilePath fallback, and finally a 2-letter badge if both fail (handled
// by the <Icon> component). Equipment stats for the gear modal also come from
// osrsreboxed. Everything degrades silently when the network is unavailable.

const SUMMARY = "https://raw.githubusercontent.com/0xNeffarion/osrsreboxed-db/master/docs/items-summary.json";
const ITEM_JSON = "https://raw.githubusercontent.com/0xNeffarion/osrsreboxed-db/master/docs/items-json/";

// Names where the GE/our spelling differs from osrsreboxed's canonical item name.
const ALIAS = {
  "Trident of the seas (full)": "Trident of the seas",
  "Archers ring": "Archer ring",
  "Pet snakeling": "Pet snakeling",
};

let _itemIds = null, _loading = null;
const _stats = {}, _statsPending = {};

function itemKey(name) { if (!name) return ""; return (ALIAS[name] || name).replace(/’/g, "'"); }

// Load (once) the full name → item-id index. Returns the map.
export async function loadItemIndex() {
  if (_itemIds) return _itemIds;
  if (_loading) return _loading;
  _loading = fetch(SUMMARY)
    .then((r) => r.json())
    .then((j) => { const m = {}; Object.values(j).forEach((o) => { if (o && o.name && !(o.name in m)) m[o.name] = o.id; }); _itemIds = m; return m; })
    .catch(() => { _itemIds = {}; return _itemIds; });
  return _loading;
}

export function itemId(name) { return _itemIds ? _itemIds[itemKey(name)] : undefined; }

export function itemIconUrl(name) {
  if (!name) return "";
  const id = itemId(name);
  if (id != null) return "https://static.runelite.net/cache/item/icon/" + id + ".png";
  const f = itemKey(name).replace(/ /g, "_") + ".png";
  return "https://oldschool.runescape.wiki/w/Special:FilePath/" + encodeURIComponent(f);
}

export function skillIconUrl(name) {
  if (!name) return "";
  return "https://oldschool.runescape.wiki/w/Special:FilePath/" + encodeURIComponent(("" + name).replace(/ /g, "_") + "_icon.png");
}

// Synchronous read of cached equipment stats (undefined = not yet loaded).
export function getItemStats(name) { return _stats[name]; }

// Fetch and cache an item's equipment/weapon stats. `onReady` fires when loaded
// (for a re-render). Returns immediately from cache when available.
export async function ensureItemStats(name, onReady) {
  if (!name) return null;
  if (_stats[name] !== undefined) return _stats[name];
  if (_statsPending[name]) return null;
  _statsPending[name] = true;
  await loadItemIndex();
  const id = itemId(name);
  if (id == null) { _stats[name] = null; _statsPending[name] = false; if (onReady) onReady(); return null; }
  try {
    const j = await fetch(ITEM_JSON + id + ".json").then((r) => (r.ok ? r.json() : null));
    _stats[name] = j && j.equipment ? { eq: j.equipment, wp: j.weapon || null } : null;
  } catch (e) { _stats[name] = null; }
  _statsPending[name] = false;
  if (onReady) onReady();
  return _stats[name];
}
