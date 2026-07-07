// ---------------------------------------------------------------------------
// RUNECRAFT DATASET — the Rune Forge's ledger.
//
// Contract (as everywhere in the almanac): gp is LIVE, xp is STABLE.
//   * Every string is an EXACT GE item name so the live mapping resolves it.
//   * Levels, xp-per-essence and the breakpoint (multiple-runes) tables are
//     game constants and never price-refreshed.
//   * RC_SNAPSHOT holds fallback prices until "⟳ Live prices" overwrites them
//     (the live side also brings buy limits + price ages).
//
// Row kinds the engine derives:
//   * craft  — pure essence in → runes out; trip math × breakpoint multiplier
//   * direct — no GE input (Zeah dense-essence bloods/souls); runes/hr straight
//   * xponly — training methods whose output isn't meaningfully sellable
//              (lavas: vendor-trash combo runes; GOTR/ZMI: rewards unpriced)
// ---------------------------------------------------------------------------

export const ESSENCE = "Pure essence";

// Essence pouches: each occupies an inventory slot but carries `holds` extra
// essence per trip. Ownership is config; level gates apply automatically.
export const POUCHES = [
  { key: "small",    name: "Small pouch",    lvl: 1,  holds: 3 },
  { key: "medium",   name: "Medium pouch",   lvl: 25, holds: 6 },
  { key: "large",    name: "Large pouch",    lvl: 50, holds: 9 },
  { key: "giant",    name: "Giant pouch",    lvl: 75, holds: 12 },
  { key: "colossal", name: "Colossal pouch", lvl: 85, holds: 40 },
];

// The craft ladder. mults = the multiple-runes breakpoints [(level, ×runes)].
// trips = default trips/hr for the named route (config/measured overridable).
// quests gate rows through the app's own quest log; abyss rows also require
// the Abyss toggle in SETUP (Enter the Abyss miniquest).
export const RC_RUNES = [
  { id: "air",    rune: "Air rune",    lvl: 1,  xpEss: 5,   mults: [[1, 1], [11, 2], [22, 3], [33, 4], [44, 5], [55, 6], [66, 7], [77, 8], [88, 9], [99, 10]], trips: 50, via: "Air altar runs (Falador)" },
  { id: "mind",   rune: "Mind rune",   lvl: 2,  xpEss: 5.5, mults: [[2, 1], [14, 2], [28, 3], [42, 4], [56, 5], [70, 6], [84, 7], [98, 8]], trips: 50, via: "Mind altar runs (Goblin Village)" },
  { id: "water",  rune: "Water rune",  lvl: 5,  xpEss: 6,   mults: [[5, 1], [19, 2], [38, 3], [57, 4], [76, 5], [95, 6]], trips: 48, via: "Water altar runs (Lumbridge)" },
  { id: "earth",  rune: "Earth rune",  lvl: 9,  xpEss: 6.5, mults: [[9, 1], [26, 2], [52, 3], [78, 4]], trips: 48, via: "Earth altar runs (Varrock)" },
  { id: "fire",   rune: "Fire rune",   lvl: 14, xpEss: 7,   mults: [[14, 1], [35, 2], [70, 3]], trips: 50, via: "Fire altar runs (duel arena ring)" },
  { id: "body",   rune: "Body rune",   lvl: 20, xpEss: 7.5, mults: [[20, 1], [46, 2], [92, 3]], trips: 48, via: "Body altar runs (Edgeville dungeon)" },
  { id: "cosmic", rune: "Cosmic rune", lvl: 27, xpEss: 8,   mults: [[27, 1], [59, 2]], trips: 44, via: "Abyss → Cosmic altar", quests: ["Lost City"], abyss: true },
  { id: "chaos",  rune: "Chaos rune",  lvl: 35, xpEss: 8.5, mults: [[35, 1], [74, 2]], trips: 42, via: "Abyss → Chaos altar", abyss: true },
  { id: "astral", rune: "Astral rune", lvl: 40, xpEss: 8.7, mults: [[40, 1], [82, 2]], trips: 48, via: "Lunar Isle altar runs", quests: ["Lunar Diplomacy"] },
  { id: "nature", rune: "Nature rune", lvl: 44, xpEss: 9,   mults: [[44, 1], [91, 2]], trips: 45, via: "Abyss → Nature altar", abyss: true },
  { id: "law",    rune: "Law rune",    lvl: 54, xpEss: 9.5, mults: [[54, 1], [95, 2]], trips: 42, via: "Abyss → Law altar", abyss: true },
  { id: "death",  rune: "Death rune",  lvl: 65, xpEss: 10,  mults: [[65, 1], [99, 2]], trips: 40, via: "Abyss → Death altar", quests: ["Mourning's End Part II"], abyss: true },
  { id: "wrath",  rune: "Wrath rune",  lvl: 95, xpEss: 8,   mults: [[95, 1]], trips: 35, via: "Myths' Guild altar runs", quests: ["Dragon Slayer II"] },
];

// Zeah dense-essence crafting: you mine the blocks, so there is NO GE input —
// slow xp, pure profit. Rates are book defaults; override in SETUP or adopt
// your measured rate from the run log.
export const RC_DIRECT = [
  { id: "blood-zeah", name: "Blood runes (Arceuus)", rune: "Blood rune", lvl: 77, runesHr: 1500, xpHr: 35000, via: "Dense runestone → Blood altar (near-AFK)" },
  { id: "soul-zeah",  name: "Soul runes (Arceuus)",  rune: "Soul rune",  lvl: 90, runesHr: 1100, xpHr: 30000, via: "Dense runestone → Soul altar (near-AFK)" },
];

// Training methods whose output the engine refuses to pretend is income:
// lavas make vendor-trash combo runes (we price the real COST side — essence,
// earth runes, talismans, binding-necklace charges); GOTR/ZMI rewards are
// honestly labeled unpriced in v1.
export const RC_XPONLY = [
  { id: "lava", name: "Lava runes (fire altar)", lvl: 23, xpEss: 10.5, trips: 50, via: "Ring of dueling → Fire altar, earth runes + binding necklace",
    perEss: [{ item: "Earth rune", qty: 1 }], talisman: "Earth talisman", neck: { item: "Binding necklace", crafts: 16 } },
  { id: "zmi",  name: "ZMI / Ourania altar", lvl: 1, xpHr: 55000, via: "Lunar Isle → Ourania (random runes; output not priced)", quests: ["Lunar Diplomacy"] },
  { id: "gotr", name: "Guardians of the Rift", lvl: 27, xpHr: 40000, via: "The Temple of the Eye minigame (rewards not priced)", quests: ["Temple of the Eye"] },
];

// Snapshot prices until the live feed lands. Every name above must be here.
export const RC_SNAPSHOT = {
  "Pure essence": 2,
  "Air rune": 4, "Mind rune": 3, "Water rune": 4, "Earth rune": 4, "Fire rune": 4, "Body rune": 5,
  "Cosmic rune": 80, "Chaos rune": 70, "Astral rune": 110, "Nature rune": 100, "Law rune": 120,
  "Death rune": 180, "Blood rune": 210, "Soul rune": 140, "Wrath rune": 380,
  "Binding necklace": 2500, "Earth talisman": 250, "Lava rune": 10,
};

// Every GE name the Forge prices (live re-price pass + name validation).
export function rcItemNames() {
  const set = new Set(Object.keys(RC_SNAPSHOT));
  RC_RUNES.forEach((r) => set.add(r.rune));
  RC_DIRECT.forEach((r) => set.add(r.rune));
  RC_XPONLY.forEach((r) => { (r.perEss || []).forEach((x) => set.add(x.item)); if (r.talisman) set.add(r.talisman); if (r.neck) set.add(r.neck.item); });
  return Array.from(set);
}
