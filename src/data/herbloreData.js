// ---------------------------------------------------------------------------
// HERBLORE DATASET — the Apothecary's recipe book.
//
// Contract (same as the rest of the almanac): gp is LIVE, xp is STABLE.
//   * Every string here is an EXACT GE item name so the live price mapping
//     resolves it (dose parens carry no space: "Prayer potion(3)").
//   * xp / level values are game constants and are never price-refreshed.
//   * MIX_SNAPSHOT holds fallback prices so the tab paints before the first
//     "⟳ Live prices" fetch; the live feed overwrites them (and adds buy
//     limits + price ages, which snapshots don't have).
//
// Recipe kinds the engine derives from this file:
//   * potion  — unf + secondary → finished (3)-dose  (from POTIONS)
//   * combine — items in → potion out, dose follows inputs (POTIONS w/ combine)
//   * unf     — clean herb + vial → sell the (unf)    (HERBS with rows:true)
//   * clean   — buy grimy, clean, sell clean          (HERBS with rows:true)
// ---------------------------------------------------------------------------

// The herb table: grimy/clean/unf GE names + cleaning level & xp.
// rows:true herbs also generate standalone unf-profit and cleaning rows.
export const HERBS = [
  { key: "guam",        grimy: "Grimy guam leaf",    clean: "Guam leaf",    unf: "Guam potion (unf)",        cleanLvl: 3,  cleanXp: 2.5,  rows: false },
  { key: "marrentill",  grimy: "Grimy marrentill",   clean: "Marrentill",   unf: "Marrentill potion (unf)",  cleanLvl: 5,  cleanXp: 3.8,  rows: false },
  { key: "tarromin",    grimy: "Grimy tarromin",     clean: "Tarromin",     unf: "Tarromin potion (unf)",    cleanLvl: 11, cleanXp: 5,    rows: false },
  { key: "harralander", grimy: "Grimy harralander",  clean: "Harralander",  unf: "Harralander potion (unf)", cleanLvl: 20, cleanXp: 6.3,  rows: false },
  { key: "ranarr",      grimy: "Grimy ranarr weed",  clean: "Ranarr weed",  unf: "Ranarr potion (unf)",      cleanLvl: 25, cleanXp: 7.5,  rows: true },
  { key: "toadflax",    grimy: "Grimy toadflax",     clean: "Toadflax",     unf: "Toadflax potion (unf)",    cleanLvl: 30, cleanXp: 8,    rows: true },
  { key: "irit",        grimy: "Grimy irit leaf",    clean: "Irit leaf",    unf: "Irit potion (unf)",        cleanLvl: 40, cleanXp: 8.8,  rows: true },
  { key: "avantoe",     grimy: "Grimy avantoe",      clean: "Avantoe",      unf: "Avantoe potion (unf)",     cleanLvl: 48, cleanXp: 10,   rows: true },
  { key: "kwuarm",      grimy: "Grimy kwuarm",       clean: "Kwuarm",       unf: "Kwuarm potion (unf)",      cleanLvl: 54, cleanXp: 11.3, rows: true },
  { key: "snapdragon",  grimy: "Grimy snapdragon",   clean: "Snapdragon",   unf: "Snapdragon potion (unf)",  cleanLvl: 59, cleanXp: 11.8, rows: true },
  { key: "cadantine",   grimy: "Grimy cadantine",    clean: "Cadantine",    unf: "Cadantine potion (unf)",   cleanLvl: 65, cleanXp: 12.5, rows: true },
  { key: "lantadyme",   grimy: "Grimy lantadyme",    clean: "Lantadyme",    unf: "Lantadyme potion (unf)",   cleanLvl: 67, cleanXp: 13.1, rows: true },
  { key: "dwarfweed",   grimy: "Grimy dwarf weed",   clean: "Dwarf weed",   unf: "Dwarf weed potion (unf)",  cleanLvl: 70, cleanXp: 13.8, rows: true },
  { key: "torstol",     grimy: "Grimy torstol",      clean: "Torstol",      unf: "Torstol potion (unf)",     cleanLvl: 75, cleanXp: 15,   rows: true },
];

// The mixing ladder, level order. Standard rows: herb key + secondaries →
// (3)-dose product (prod4 powers the amulet-of-chemistry EV). `vial` overrides
// the base liquid (bastion/battlemage brew on Vial of blood — Zahur won't make
// those unf, the engine knows). `combine` rows take finished items in.
export const POTIONS = [
  { id: "attack",        name: "Attack potion",    lvl: 3,  xp: 25,    herb: "guam",        sec: [{ item: "Eye of newt", qty: 1 }],          prod: "Attack potion(3)",    prod4: "Attack potion(4)" },
  { id: "antipoison",    name: "Antipoison",       lvl: 5,  xp: 37.5,  herb: "marrentill",  sec: [{ item: "Unicorn horn dust", qty: 1 }],    prod: "Antipoison(3)",       prod4: "Antipoison(4)" },
  { id: "strength",      name: "Strength potion",  lvl: 12, xp: 50,    herb: "tarromin",    sec: [{ item: "Limpwurt root", qty: 1 }],        prod: "Strength potion(3)",  prod4: "Strength potion(4)" },
  { id: "restore",       name: "Restore potion",   lvl: 22, xp: 62.5,  herb: "harralander", sec: [{ item: "Red spiders' eggs", qty: 1 }],    prod: "Restore potion(3)",   prod4: "Restore potion(4)" },
  { id: "energy",        name: "Energy potion",    lvl: 26, xp: 67.5,  herb: "harralander", sec: [{ item: "Chocolate dust", qty: 1 }],       prod: "Energy potion(3)",    prod4: "Energy potion(4)" },
  { id: "defence",       name: "Defence potion",   lvl: 30, xp: 75,    herb: "ranarr",      sec: [{ item: "White berries", qty: 1 }],        prod: "Defence potion(3)",   prod4: "Defence potion(4)" },
  { id: "agility",       name: "Agility potion",   lvl: 34, xp: 80,    herb: "toadflax",    sec: [{ item: "Toad's legs", qty: 1 }],          prod: "Agility potion(3)",   prod4: "Agility potion(4)" },
  { id: "combatpot",     name: "Combat potion",    lvl: 36, xp: 84,    herb: "harralander", sec: [{ item: "Goat horn dust", qty: 1 }],       prod: "Combat potion(3)",    prod4: "Combat potion(4)" },
  { id: "prayer",        name: "Prayer potion",    lvl: 38, xp: 87.5,  herb: "ranarr",      sec: [{ item: "Snape grass", qty: 1 }],          prod: "Prayer potion(3)",    prod4: "Prayer potion(4)" },
  { id: "superattack",   name: "Super attack",     lvl: 45, xp: 100,   herb: "irit",        sec: [{ item: "Eye of newt", qty: 1 }],          prod: "Super attack(3)",     prod4: "Super attack(4)" },
  { id: "superantipoison", name: "Superantipoison", lvl: 48, xp: 106.3, herb: "irit",       sec: [{ item: "Unicorn horn dust", qty: 1 }],    prod: "Superantipoison(3)",  prod4: "Superantipoison(4)" },
  { id: "superenergy",   name: "Super energy",     lvl: 52, xp: 117.5, herb: "avantoe",     sec: [{ item: "Mort myre fungus", qty: 1 }],     prod: "Super energy(3)",     prod4: "Super energy(4)" },
  { id: "superstrength", name: "Super strength",   lvl: 55, xp: 125,   herb: "kwuarm",      sec: [{ item: "Limpwurt root", qty: 1 }],        prod: "Super strength(3)",   prod4: "Super strength(4)" },
  { id: "weaponpoison",  name: "Weapon poison",    lvl: 60, xp: 137.5, herb: "kwuarm",      sec: [{ item: "Dragon scale dust", qty: 1 }],    prod: "Weapon poison",       prod4: null },
  { id: "superrestore",  name: "Super restore",    lvl: 63, xp: 142.5, herb: "snapdragon",  sec: [{ item: "Red spiders' eggs", qty: 1 }],    prod: "Super restore(3)",    prod4: "Super restore(4)" },
  { id: "superdefence",  name: "Super defence",    lvl: 66, xp: 150,   herb: "cadantine",   sec: [{ item: "White berries", qty: 1 }],        prod: "Super defence(3)",    prod4: "Super defence(4)" },
  { id: "antifire",      name: "Antifire potion",  lvl: 69, xp: 157.5, herb: "lantadyme",   sec: [{ item: "Dragon scale dust", qty: 1 }],    prod: "Antifire potion(3)",  prod4: "Antifire potion(4)" },
  { id: "ranging",       name: "Ranging potion",   lvl: 72, xp: 162.5, herb: "dwarfweed",   sec: [{ item: "Wine of zamorak", qty: 1 }],      prod: "Ranging potion(3)",   prod4: "Ranging potion(4)" },
  { id: "magicpot",      name: "Magic potion",     lvl: 76, xp: 172.5, herb: "lantadyme",   sec: [{ item: "Potato cactus", qty: 1 }],        prod: "Magic potion(3)",     prod4: "Magic potion(4)" },
  { id: "stamina",       name: "Stamina potion",   lvl: 77, xp: 102.5, combine: [{ item: "Super energy(4)", qty: 1 }, { item: "Amylase crystal", qty: 4 }], prod: "Stamina potion(4)" },
  { id: "zambrew",       name: "Zamorak brew",     lvl: 78, xp: 175,   herb: "torstol",     sec: [{ item: "Jangerberries", qty: 1 }],        prod: "Zamorak brew(3)",     prod4: "Zamorak brew(4)" },
  { id: "bastion",       name: "Bastion potion",   lvl: 80, xp: 155,   herb: "cadantine",   vial: "Vial of blood", unf: "Cadantine blood potion (unf)", sec: [{ item: "Wine of zamorak", qty: 1 }], prod: "Bastion potion(3)", prod4: "Bastion potion(4)" },
  { id: "battlemage",    name: "Battlemage potion", lvl: 80, xp: 155,  herb: "cadantine",   vial: "Vial of blood", unf: "Cadantine blood potion (unf)", sec: [{ item: "Potato cactus", qty: 1 }],   prod: "Battlemage potion(3)", prod4: "Battlemage potion(4)" },
  { id: "sarabrew",      name: "Saradomin brew",   lvl: 81, xp: 180,   herb: "toadflax",    sec: [{ item: "Crushed nest", qty: 1 }],         prod: "Saradomin brew(3)",   prod4: "Saradomin brew(4)" },
  { id: "extantifire",   name: "Extended antifire", lvl: 84, xp: 110,  combine: [{ item: "Antifire potion(4)", qty: 1 }, { item: "Lava scale shard", qty: 4 }], prod: "Extended antifire(4)" },
  { id: "antivenom",     name: "Anti-venom",       lvl: 87, xp: 120,   combine: [{ item: "Antidote++(4)", qty: 1 }, { item: "Zulrah's scales", qty: 20 }], prod: "Anti-venom(4)" },
  { id: "remedy",        name: "Menaphite remedy", lvl: 88, xp: 200,   herb: "dwarfweed",   sec: [{ item: "Lily of the sands", qty: 1 }],    prod: "Menaphite remedy(3)", prod4: "Menaphite remedy(4)" },
  { id: "supercombat",   name: "Super combat",     lvl: 90, xp: 150,   combine: [{ item: "Super attack(4)", qty: 1 }, { item: "Super strength(4)", qty: 1 }, { item: "Super defence(4)", qty: 1 }, { herb: "torstol" }], prod: "Super combat potion(4)" },
  { id: "antivenomplus", name: "Anti-venom+",      lvl: 94, xp: 125,   combine: [{ item: "Anti-venom(4)", qty: 1 }, { herb: "torstol" }], prod: "Anti-venom+(4)" },
];

// Zahur (Nardah) — flat per-item fees, instant + noted, no xp, no bench time.
export const ZAHUR_CLEAN_FEE = 200; // cleans a grimy herb
export const ZAHUR_UNF_FEE = 200;   // makes an unf from clean herb + vial of water (water only)

// Amulet of chemistry: 5% chance a mixed potion comes out 4-dose; the charge
// (amulet price ÷ 5) is only consumed when it procs.
export const CHEM_AMULET = { item: "Amulet of chemistry", charges: 5, chance: 0.05 };

// Snapshot prices (gp) — placeholders until the live feed overwrites them.
// Kept deliberately conservative; every name used above must appear here.
export const MIX_SNAPSHOT = {
  "Vial of water": 4, "Vial of blood": 480, "Amulet of chemistry": 1400,
  // herbs — grimy / clean
  "Grimy guam leaf": 15, "Guam leaf": 25, "Grimy marrentill": 12, "Marrentill": 18,
  "Grimy tarromin": 90, "Tarromin": 110, "Grimy harralander": 520, "Harralander": 560,
  "Grimy ranarr weed": 5900, "Ranarr weed": 6100, "Grimy toadflax": 2100, "Toadflax": 2200,
  "Grimy irit leaf": 700, "Irit leaf": 760, "Grimy avantoe": 1500, "Avantoe": 1600,
  "Grimy kwuarm": 1200, "Kwuarm": 1300, "Grimy snapdragon": 6800, "Snapdragon": 7100,
  "Grimy cadantine": 1100, "Cadantine": 1200, "Grimy lantadyme": 1250, "Lantadyme": 1350,
  "Grimy dwarf weed": 850, "Dwarf weed": 940, "Grimy torstol": 3100, "Torstol": 3300,
  // unfinished potions
  "Guam potion (unf)": 40, "Marrentill potion (unf)": 60, "Tarromin potion (unf)": 180, "Harralander potion (unf)": 640,
  "Ranarr potion (unf)": 7200, "Toadflax potion (unf)": 2700, "Irit potion (unf)": 880, "Avantoe potion (unf)": 1800,
  "Kwuarm potion (unf)": 1450, "Snapdragon potion (unf)": 7600, "Cadantine potion (unf)": 1380, "Lantadyme potion (unf)": 1500,
  "Dwarf weed potion (unf)": 1080, "Torstol potion (unf)": 3600, "Cadantine blood potion (unf)": 2300,
  // secondaries
  "Eye of newt": 3, "Unicorn horn dust": 160, "Limpwurt root": 720, "Red spiders' eggs": 480,
  "Chocolate dust": 110, "White berries": 30, "Toad's legs": 480, "Goat horn dust": 90,
  "Snape grass": 720, "Mort myre fungus": 260, "Dragon scale dust": 210, "Wine of zamorak": 620,
  "Potato cactus": 310, "Crushed nest": 2500, "Jangerberries": 60, "Amylase crystal": 1300,
  "Lava scale shard": 210, "Zulrah's scales": 150, "Antidote++(4)": 520, "Lily of the sands": 520,
  // finished products (sell side)
  "Attack potion(3)": 8, "Attack potion(4)": 20, "Antipoison(3)": 220, "Antipoison(4)": 350,
  "Strength potion(3)": 120, "Strength potion(4)": 250, "Restore potion(3)": 70, "Restore potion(4)": 150,
  "Energy potion(3)": 320, "Energy potion(4)": 480, "Defence potion(3)": 120, "Defence potion(4)": 260,
  "Agility potion(3)": 380, "Agility potion(4)": 600, "Combat potion(3)": 720, "Combat potion(4)": 1000,
  "Prayer potion(3)": 8200, "Prayer potion(4)": 11000, "Super attack(3)": 320, "Super attack(4)": 480,
  "Superantipoison(3)": 950, "Superantipoison(4)": 1400, "Super energy(3)": 1800, "Super energy(4)": 2400,
  "Super strength(3)": 2200, "Super strength(4)": 3000, "Weapon poison": 520,
  "Super restore(3)": 8600, "Super restore(4)": 11400, "Super defence(3)": 950, "Super defence(4)": 1300,
  "Antifire potion(3)": 1200, "Antifire potion(4)": 1600, "Ranging potion(3)": 4300, "Ranging potion(4)": 5800,
  "Magic potion(3)": 420, "Magic potion(4)": 640, "Stamina potion(4)": 8600,
  "Zamorak brew(3)": 220, "Zamorak brew(4)": 380, "Bastion potion(3)": 4100, "Bastion potion(4)": 5600,
  "Battlemage potion(3)": 1600, "Battlemage potion(4)": 2300, "Saradomin brew(3)": 3100, "Saradomin brew(4)": 4300,
  "Extended antifire(4)": 2600, "Anti-venom(4)": 2100, "Menaphite remedy(3)": 6100, "Menaphite remedy(4)": 8600,
  "Super combat potion(4)": 13600, "Anti-venom+(4)": 10600,
};

// Every GE name the engine ever prices (for the live re-price pass + the
// build-time name-resolution check).
export function mixItemNames() {
  const set = new Set(Object.keys(MIX_SNAPSHOT));
  HERBS.forEach((h) => { set.add(h.grimy); set.add(h.clean); set.add(h.unf); });
  POTIONS.forEach((p) => {
    if (p.prod) set.add(p.prod); if (p.prod4) set.add(p.prod4);
    (p.sec || []).forEach((s) => set.add(s.item));
    (p.combine || []).forEach((c) => { if (c.item) set.add(c.item); });
    if (p.vial) set.add(p.vial); if (p.unf) set.add(p.unf);
  });
  return Array.from(set);
}
