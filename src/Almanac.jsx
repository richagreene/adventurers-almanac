// The Adventurer's Almanac — a live OSRS planning ledger.
//
// The original was an Excel workbook whose two inputs (a Hiscores paste and a
// GEPrices Power-Query snapshot) fed eleven interlinked planning sheets. This
// app keeps all of that depth but swaps those two static inputs for live data:
//   * stats   -> official OSRS Hiscores (enter a RuneScape name)
//   * prices  -> OSRS Wiki real-time prices API (the "⟳ Live prices" buttons)
// Everything you enter (logs, goals, quest/diary progress, per-boss session
// rates) is saved in your browser, so the ledger is yours and persists.

import React from "react";
import { LEDGER_DATA } from "./data/ledgerData.js";
import { QUEST_ORDER } from "./data/questOrder.js";
import { GEAR_DATA } from "./data/gearData.js";
import { fetchPlayer, fetchPrices, priceById, combatLevel, fetchItemNames, natureRunePrice } from "./lib/api.js";
import { C, mono, serif, cinzel, Card, Kicker, SectionTitle, StatCards, Bar, Seg, Tag, Btn, DataTable, Hero, themeFor } from "./lib/ui.jsx";

const D = LEDGER_DATA;

// Demo account shown before a RuneScape name is entered (so the ledger is
// never empty). The moment you fetch a real RSN this is replaced.
const DEMO_SKILLS = [
  ["Attack", 60, 273751], ["Strength", 63, 394482], ["Defence", 49, 92903], ["Hitpoints", 67, 585325],
  ["Ranged", 75, 1215650], ["Prayer", 46, 68229], ["Magic", 90, 5365808], ["Runecraft", 93, 7254911],
  ["Construction", 99, 13180759], ["Agility", 88, 4484200], ["Herblore", 17, 3448], ["Thieving", 53, 136660],
  ["Crafting", 72, 921076], ["Fletching", 55, 173234], ["Slayer", 1, 0], ["Hunter", 1, 0],
  ["Mining", 68, 644054], ["Smithing", 35, 24062], ["Fishing", 1, 16], ["Cooking", 21, 5297],
  ["Firemaking", 99, 13044691], ["Woodcutting", 66, 525703], ["Farming", 72, 946952],
];

const NAV = [
  { label: "Overview", items: [["dashboard", "Dashboard"], ["skills", "Skills"], ["goals", "Goals"]] },
  { label: "Treasury", items: [["networth", "Net Worth"], ["flipping", "GE Flipping"], ["alchemy", "High Alchemy"]] },
  { label: "Combat", items: [["bossing", "Bossing"], ["slayer", "Slayer"], ["gear", "Gear Path"]] },
  { label: "Skilling", items: [["farming", "Farming"], ["quests", "Quests"], ["diary", "Diary & CA"]] },
];
const TITLES = {
  dashboard: ["The Adventurer's Almanac", "Account Dashboard"], skills: ["Character Progression", "Skills"],
  goals: ["Time to Goal", "Goal Ledger"], networth: ["The Treasury", "Net Worth"],
  flipping: ["Grand Exchange", "Flipping Desk"], alchemy: ["Arcane Profit", "High Alchemy"],
  bossing: ["Command Centre", "Bossing Compendium"], slayer: ["The Slayer", "Task Planner"],
  gear: ["The Armoury", "Gear Progression"], farming: ["The Allotments", "Farming Engine"],
  quests: ["The Adventure Log", "Quest Sequencer"], diary: ["Regional Renown", "Diary & Combat Achievements"],
};

export default class Almanac extends React.Component {
  state = {
    section: "dashboard", openForm: null, fetching: false, fetchMsg: "", priceStatus: "", gearPriceStatus: "",
    flipView: "scanner", fillResult: null, fillMsg: "", bossView: "compendium", bossFocus: "", dropFormBoss: "",
    slayView: "planner", slayMaster: "Duradel", gearStyle: "melee",
    questMethod: "optimal", qsortCol: "", qsortDir: 1, qFilterOpen: "", qfSeries: [], qfType: [], qfStatus: [], qName: "", qGate: "",
    tSort: {}, tFilt: {}, tOpen: "", flipPrefill: null, objType: "bank", objBoss: "", _v: 0,
  };

  // ---- static reference tables (ported from the workbook / design) ----
  alchItems = [
    { item: "Magic longbow", alch: 1536, buy: 1098, limit: 18000 },
    { item: "Camphor repair kit", alch: 2100, buy: 1595, limit: 13000 },
    { item: "Dragon javelin tips", alch: 1170, buy: 650, limit: 10000 },
    { item: "Rune javelin tips", alch: 810, buy: 370, limit: 10000 },
    { item: "Yew longbow", alch: 768, buy: 475, limit: 18000 },
  ];
  farmDefs = [
    { tier: "Ranarr", lvl: 32, unlocked: true, seed: 26678, herb: 5346, net: 56199 },
    { tier: "Snapdragon", lvl: 62, unlocked: true, seed: 53508, herb: 8393, net: 80260 },
    { tier: "Torstol", lvl: 85, unlocked: false, seed: 15900, herb: 3155, net: 143793 },
  ];
  farmRunDefs = [
    { name: "Herb run", crop: "Snapdragon", type: "Herb", req: 62, xpRun: 6981, gpRun: 80260, timeMin: 6, patches: 6, teles: "Ectophial · Explorer ring · Ardy cloak · Catherby · Hosidius", seeds: "6× Snapdragon seed + compost" },
    { name: "Fruit tree run", crop: "Palm", type: "Fruit", req: 68, xpRun: 51303, gpRun: -32000, timeMin: 13, patches: 6, teles: "Gnome Stronghold · Tree Gnome Village · Brimhaven · Catherby · Lletya · Farming Guild", seeds: "6× Palm sapling" },
    { name: "Tree run", crop: "Yew", type: "Tree", req: 60, xpRun: 35755, gpRun: -14000, timeMin: 14, patches: 5, teles: "Lumbridge · Varrock · Falador · Gnome Stronghold · Farming Guild", seeds: "5× Yew sapling" },
    { name: "Hardwood run", crop: "Mahogany", type: "Hardwood", req: 55, xpRun: 31500, gpRun: -9000, timeMin: 6, patches: 2, teles: "Fossil Island · Mushroom forest", seeds: "2× Mahogany sapling" },
    { name: "Tree run", crop: "Magic", type: "Tree", req: 75, xpRun: 69569, gpRun: -58000, timeMin: 14, patches: 5, teles: "unlocks at Farming 75", seeds: "5× Magic sapling" },
  ];
  farmMilestones = [
    { lvl: 72, label: "Snapdragons · Mahogany hardwoods", tag: "CURRENT" },
    { lvl: 75, label: "Magic trees · Celastrus · Anima patch", tag: "" },
    { lvl: 83, label: "Redwood trees — big passive WC later", tag: "" },
    { lvl: 85, label: "Torstol — best herb gp/run", tag: "GOAL" },
    { lvl: 90, label: "Hespori boss · efficient hardwoods", tag: "" },
    { lvl: 99, label: "Skillcape · Master Farmer outfit", tag: "" },
  ];
  treesRaw = [
    { name: "Oak", lvl: 15, xp: 2406, unlocked: true }, { name: "Willow", lvl: 30, xp: 7408, unlocked: true },
    { name: "Maple", lvl: 45, xp: 17242, unlocked: true }, { name: "Yew", lvl: 60, xp: 35755, unlocked: true },
    { name: "Magic", lvl: 75, xp: 69569, unlocked: false }, { name: "Palm", lvl: 68, xp: 51303, unlocked: true },
  ];
  mastersRaw = [
    { name: "Turael / Spria", cb: 3, slay: 1, best: "streak reset / low tasks", avail: true },
    { name: "Mazchna", cb: 20, slay: 1, best: "early XP, banshees", avail: true },
    { name: "Vannaka", cb: 40, slay: 1, best: "mid XP, long tasks", avail: true },
    { name: "Chaeldar", cb: 70, slay: 1, best: "solid mid; bursting", avail: true },
    { name: "Nieve / Steve", cb: 85, slay: 1, best: "near-Duradel pool", avail: false },
    { name: "Duradel", cb: 100, slay: 50, best: "best XP + GP (target)", avail: false },
    { name: "Konar quo Maten", cb: 75, slay: 1, best: "brimstone keys, locations", avail: true },
  ];
  slayUnlocks = [
    { name: "Slayer Helmet (Malevolent Masquerade)", cost: 400, pri: 1, why: "Combine head-slot gear; +16.7% acc/dmg vs task. The single best buy." },
    { name: "Bigger & Badder (Superiors)", cost: 150, pri: 2, why: "Superior monsters spawn — imbue scrolls, eternal gems, big drops." },
    { name: "Unlock Duradel (Smoking Kills)", cost: 0, pri: 1, why: "Best master: highest XP & GP tasks. Quest, not points." },
    { name: "Ring Bling (Slayer rings)", cost: 300, pri: 3, why: "Teleports to task + stat checks; huge QoL." },
    { name: "I Wildy More Slayer", cost: 100, pri: 4, why: "Krystilia / wildy tasks for larran & slayer keys." },
    { name: "Broader Fletching", cost: 300, pri: 5, why: "Broad bolts/arrows — cheap cannon-free AoE for some tasks." },
  ];
  slayInfo = {
    "Abyssal demons": { loc: "Slayer Tower / Catacombs", drops: "Abyssal whip, dagger, head" },
    Nechryael: { loc: "Catacombs / Iorwerth", drops: "Rune/dragon drops, key" },
    Gargoyles: { loc: "Slayer Tower roof", drops: "Granite maul, mystic, alchs" },
    "Cave kraken": { loc: "Kraken Cove", drops: "Trident, tentacle" },
    "Dark beasts": { loc: "Mourner Tunnels / Iorwerth", drops: "Dark bow, dragon stuff" },
    "Smoke devils": { loc: "Smoke Dungeon", drops: "Occult necklace, d chainbody" },
    Hellhounds: { loc: "Catacombs / Taverley", drops: "Hard clues, smouldering stone" },
    Bloodveld: { loc: "Catacombs / Iorwerth / Slayer Tower", drops: "Rune drops, decent XP" },
    "Fire giants": { loc: "Catacombs / Waterfall", drops: "Rune drops, hard clues" },
    "Dust devils": { loc: "Smoke Dungeon / Catacombs", drops: "Dragon chainbody, barrage XP" },
    Kurask: { loc: "Iorwerth / Fremennik", drops: "Leaf-bladed gear, alchs" },
    "Skeletal wyverns": { loc: "Asgarnia Ice Dungeon", drops: "Draconic visage, granite legs" },
    Wyrms: { loc: "Karuulm Dungeon", drops: "Dragon harpoon/sword/pickaxe" },
    Drakes: { loc: "Karuulm Dungeon", drops: "Dragon hunter lance pieces" },
    "Black demons": { loc: "Catacombs / Taverley", drops: "Hard clues, alchs" },
    "Greater demons": { loc: "Catacombs / Wildy", drops: "Hard clues, alchs" },
    "Spiritual creatures": { loc: "God Wars Dungeon", drops: "Dragon boots, GWD shards" },
    Aviansies: { loc: "God Wars Dungeon", drops: "Adamant/rune drops, d boots" },
    Trolls: { loc: "Trollheim / Death Plateau", drops: "Low value — block candidate" },
    Dagannoth: { loc: "Lighthouse / Waterbirth", drops: "Mixed; DKS on Kings only" },
  };
  bossDrops = {
    Vorkath: [{ n: "Skeletal visage", rate: 5000, v: 1700000 }, { n: "Dragonbone necklace", rate: 1000, v: 180000 }, { n: "Jar of decay", rate: 3000, v: 60000 }, { n: "Vorki (pet)", rate: 3000, v: 0 }],
    Zulrah: [{ n: "Tanzanite fang", rate: 512, v: 2700000 }, { n: "Magic fang", rate: 512, v: 2300000 }, { n: "Serpentine visage", rate: 512, v: 1100000 }, { n: "Tanzanite mutagen", rate: 13106, v: 4500000 }, { n: "Pet snakeling", rate: 4000, v: 0 }],
    Cerberus: [{ n: "Primordial crystal", rate: 512, v: 6000000 }, { n: "Pegasian crystal", rate: 512, v: 2900000 }, { n: "Eternal crystal", rate: 512, v: 2800000 }, { n: "Smouldering stone", rate: 512, v: 380000 }, { n: "Hellpuppy (pet)", rate: 3000, v: 0 }],
    "Dagannoth Kings": [{ n: "Berserker ring", rate: 128, v: 2700000 }, { n: "Archer ring", rate: 128, v: 1000000 }, { n: "Warrior ring", rate: 128, v: 55000 }, { n: "Seers ring", rate: 128, v: 50000 }, { n: "Dragon axe", rate: 128, v: 55000 }, { n: "Pet DK", rate: 5000, v: 0 }],
    "Abyssal Sire": [{ n: "Bludgeon piece", rate: 516, v: 9000000 }, { n: "Abyssal dagger", rate: 256, v: 3600000 }, { n: "Unsired→items", rate: 100, v: 1000000 }, { n: "Abyssal orphan (pet)", rate: 2560, v: 0 }],
    Kraken: [{ n: "Trident of the seas", rate: 512, v: 130000 }, { n: "Kraken tentacle", rate: 300, v: 500000 }, { n: "Pet kraken", rate: 3000, v: 0 }],
    "Alchemical Hydra": [{ n: "Hydra's claw", rate: 1000, v: 80000000 }, { n: "Hydra leather", rate: 514, v: 1200000 }, { n: "Hydra's tail", rate: 512, v: 300000 }, { n: "Dragon hunter lance", rate: 2000, v: 30000000 }, { n: "Ikkle hydra (pet)", rate: 3000, v: 0 }],
    "General Graardor": [{ n: "Bandos chestplate", rate: 381, v: 18000000 }, { n: "Bandos tassets", rate: 381, v: 24000000 }, { n: "Bandos hilt", rate: 508, v: 9000000 }, { n: "Pet general", rate: 5000, v: 0 }],
    "Commander Zilyana": [{ n: "Saradomin sword", rate: 127, v: 240000 }, { n: "Armadyl crossbow", rate: 508, v: 25000000 }, { n: "Saradomin hilt", rate: 508, v: 4500000 }, { n: "Pet zilyana", rate: 5000, v: 0 }],
    "Kree'arra (Armadyl)": [{ n: "Armadyl helmet", rate: 381, v: 18000000 }, { n: "Armadyl chestplate", rate: 381, v: 21000000 }, { n: "Armadyl chainskirt", rate: 381, v: 23000000 }, { n: "Armadyl hilt", rate: 508, v: 1300000 }],
    "K'ril Tsutsaroth": [{ n: "Staff of the dead", rate: 508, v: 8000000 }, { n: "Zamorakian spear", rate: 127, v: 160000 }, { n: "Steam staff upgrade", rate: 512, v: 400000 }, { n: "Zamorak hilt", rate: 508, v: 3500000 }],
    "Kalphite Queen": [{ n: "Dragon chainbody", rate: 128, v: 280000 }, { n: "Dragon 2h sword", rate: 256, v: 120000 }, { n: "Kq head", rate: 256, v: 90000 }, { n: "Pet kalphite", rate: 3000, v: 0 }],
    Sarachnis: [{ n: "Sarachnis cudgel", rate: 384, v: 1500000 }, { n: "Jar of eyes", rate: 2000, v: 200000 }, { n: "Sraracha (pet)", rate: 3000, v: 0 }],
    "Giant Mole": [{ n: "Baby mole (pet)", rate: 3000, v: 0 }, { n: "Mole claw", rate: 1, v: 480 }, { n: "Mole skin", rate: 1, v: 540 }],
  };
  bossWhy = {
    Vorkath: "Elite money + great Ranged XP · AFK-ish rotation, dragonbone/visage uniques",
    Zulrah: "Top early-game GP · learnable rotations, fang/visage for big sells",
    Cerberus: "Best-in-slot crystals (primordial/pegasian/eternal) · strong Slayer GP",
    "Dagannoth Kings": "Berserker ring (BiS) + dragon axe · fast kills, good GP/h",
    "Alchemical Hydra": "Hydra claw + DHL · highest Slayer GP/h in the game",
    "Abyssal Sire": "Bludgeon + abyssal dagger · unlocks via Slayer, strong loot",
    Kraken: "AFK Magic XP + trident/tentacle · very low effort",
    "General Graardor": "Bandos tassets/chestplate · best melee tank set",
    "Commander Zilyana": "Armadyl crossbow + sara sword · top ranged GP",
    "Kree'arra (Armadyl)": "Armadyl armour (BiS ranged) · core upgrade",
    "K'ril Tsutsaroth": "Staff of the dead + zammy spear · strong mage/melee gear",
    "Kalphite Queen": "Dragon chainbody + early GWD prep · accessible, no quests",
    Sarachnis: "Early-game GP + cudgel · no quest reqs, great starter boss",
    "Giant Mole": "Easy clue/pet hunting · trivial mechanics, Falador access only",
  };
  flipDefaults = { minMargin: 5, maxMargin: 20, minProfit4h: 150000, minVolume: 10000, minBuy: 250, maxAge: 15, capital: 14828291 };
  scanSeed = [
    { name: "Dagannoth bones", buy: 2400, sell: 2520, vol: 42000, limit: 7500, age: 6 },
    { name: "Cannonball", buy: 185, sell: 196, vol: 9000000, limit: 9600, age: 3 },
    { name: "Magic logs", buy: 1010, sell: 1080, vol: 380000, limit: 25000, age: 8 },
    { name: "Death rune", buy: 181, sell: 189, vol: 5200000, limit: 25000, age: 2 },
    { name: "Yew logs", buy: 268, sell: 286, vol: 1100000, limit: 24000, age: 5 },
    { name: "Raw shark", buy: 610, sell: 648, vol: 520000, limit: 13000, age: 11 },
    { name: "Onyx bolt tips", buy: 8400, sell: 8950, vol: 240000, limit: 11000, age: 9 },
    { name: "Coal", buy: 171, sell: 179, vol: 6800000, limit: 13500, age: 4 },
  ];
  defaultGoals = [
    { skill: "Attack", tgt: 70, method: "Sand crabs + super str pots", xpHr: 45000, gpHr: -10000 },
    { skill: "Strength", tgt: 70, method: "Sand crabs + super str pots", xpHr: 45000, gpHr: -10000 },
    { skill: "Defence", tgt: 70, method: "Sand crabs (slash, on-task)", xpHr: 32000, gpHr: -50000 },
    { skill: "Hitpoints", tgt: 75, method: "Passive from combat training", xpHr: 0, gpHr: 0 },
    { skill: "Ranged", tgt: 75, method: "Cannon / chinning → Ava's", xpHr: 275000, gpHr: -150000 },
    { skill: "Magic", tgt: 94, method: "High Alch to 75 → Ice barrage", xpHr: 65000, gpHr: 375000 },
    { skill: "Prayer", tgt: 70, method: "Gilded altar, dragon bones", xpHr: 320000, gpHr: -3400000 },
    { skill: "Herblore", tgt: 78, method: "Buy potions off the GE", xpHr: 300000, gpHr: -1600000 },
    { skill: "Slayer", tgt: 55, method: "Slayer tasks (Chaeldar)", xpHr: 22000, gpHr: 100000 },
    { skill: "Farming", tgt: 85, method: "Herb + tree runs (daily)", xpHr: 0, gpHr: 0 },
  ];

  // ---------- persistence ----------
  _load(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  _save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  saveLogs() { this._save("almanac.logs.v1", this.logs); }
  bump() { this.setState((s) => ({ _v: s._v + 1 })); }

  componentDidMount() {
    this.stats = this._load("almanac.stats.v1", null) || { rsn: "Lumbridge Local", skills: DEMO_SKILLS, mode: "main", source: "demo", qpApi: null, at: 0, demo: true };
    this.skillsRaw = this.stats.skills;
    this.logs = this._load("almanac.logs.v1", null) || JSON.parse(JSON.stringify(D.seeds || {}));
    ["nw", "flips", "alch", "herb", "boss", "slayerLog", "watch", "scan", "drop"].forEach((k) => { if (!this.logs[k]) this.logs[k] = []; });
    if (!this.logs.scan.length) this.logs.scan = JSON.parse(JSON.stringify(this.scanSeed));
    this.goals = this._load("almanac.goals.v1", null) || this.defaultGoals.map((x) => ({ ...x }));
    this.questOv = this._load("almanac.questdone.v1", null);
    if (!this.questOv) { this.questOv = {}; (D.quests || []).forEach((q) => { if (q.status === "Done") this.questOv[q.n] = true; }); this._save("almanac.questdone.v1", this.questOv); }
    this.flipcfg = this._load("almanac.flipcfg.v1", null) || { ...this.flipDefaults };
    this.alchcfg = this._load("almanac.alchcfg.v1", null) || { castsPerHour: 1200, fireSource: "staff", natRune: 127, fireRune: 5 };
    this.farmcfg = this._load("almanac.farmcfg.v1", null) || { lapsPerDay: 1 };
    this.gcfg = this._load("almanac.gcfg.v1", null) || { hoursPerDay: 2, bankGoal: 10000000000, baseGoal: 70 };
    this.blocks = this._load("almanac.blocks.v1", null);
    if (!this.blocks) { this.blocks = {}; (D.slayer || []).forEach((t) => { if (t.verdict === "Block") this.blocks[t.task] = true; }); }
    this.bossOv = this._load("almanac.bossov.v1", null) || {};
    this.objectives = this._load("almanac.objectives.v1", null) || this.defaultObjectives();
    this.gearPrices = {};
    this.itemNames = [];
    this.bump();
    // Background: pull the full tradeable-item list (for flip autocomplete) and
    // the live nature-rune price. Both degrade silently if the network is blocked.
    fetchItemNames().then((names) => { this.itemNames = names; this.bump(); }).catch(() => {});
    this.refreshNatRune();
  }

  // Pull the live nature-rune price (GE id 561) for the High Alchemy maths.
  refreshNatRune = async () => {
    const p = await natureRunePrice();
    if (p && p > 0 && p !== this.alchcfg.natRune) { this.alchcfg.natRune = p; this._save("almanac.alchcfg.v1", this.alchcfg); this.bump(); }
  };

  // ---------- helpers ----------
  xpFor(level) { let xp = 0; for (let n = 1; n < level; n++) xp += Math.floor(n + 300 * Math.pow(2, n / 7)); return Math.floor(xp / 4); }
  fmt(n) { return Math.round(n).toLocaleString("en-US"); }
  short(n) { const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(2) + "B"; if (a >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (a >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K"; return "" + Math.round(n); }
  signed(n) { return (n >= 0 ? "+" : "−") + this.short(Math.abs(n)); }
  pct(x) { return (x * 100).toFixed(x < 0.1 ? 1 : 0) + "%"; }
  today() { return new Date().toISOString().slice(0, 10); }
  fmtDays(days) { if (days == null) return "—"; if (days <= 0) return "done"; if (days >= 365) return (days / 365).toFixed(days >= 3650 ? 0 : 1) + "y"; if (days >= 14) return Math.round(days / 7) + "w"; return days + "d"; }
  dShort(iso) { if (!iso) return ""; const p = ("" + iso).split("-"); return p.length >= 3 ? p[1] + "/" + p[2] : iso; }
  val(id) { const el = document.getElementById(id); return el ? ("" + el.value).trim() : ""; }
  num(id) { return Math.round(this.parseNum(this.val(id))) || 0; }
  parseNum(str) { if (str == null) return 0; let s = ("" + str).trim().toLowerCase().replace(/[,\s]/g, ""); if (!s || s === "-" || s === "+") return 0; let mult = 1; const last = s[s.length - 1]; if (last === "k") { mult = 1e3; s = s.slice(0, -1); } else if (last === "m") { mult = 1e6; s = s.slice(0, -1); } else if (last === "b") { mult = 1e9; s = s.slice(0, -1); } const v = parseFloat(s); return isNaN(v) ? 0 : v * mult; }
  skillColor(l) { if (l >= 99) return C.gold; if (l >= 90) return C.purple; if (l >= 70) return C.teal; if (l >= 40) return C.green; return "#9a6a3a"; }
  get skillMap() { return Object.fromEntries(this.skillsRaw.map(([n, l, x]) => [n, { l, x }])); }
  get account() { const m = {}; this.skillsRaw.forEach(([n, l]) => (m[n] = { level: l })); return { combat: combatLevel(m) }; }
  get mode() { return (this.stats && this.stats.mode) || "main"; }

  // quest points: derived from quests you've marked Done, topped up by any API value
  get qpDerived() { return (D.quests || []).reduce((a, q) => a + (this.questDone(q) ? q.qp || 0 : 0), 0); }
  get questPoints() { return Math.max(this.qpDerived, (this.stats && this.stats.qpApi) || 0); }
  questDone(q) { return this.questOv[q.n] === true; }
  questReqsMet(q) {
    const lv = {}; this.skillsRaw.forEach(([nm, l]) => { lv[nm.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft;
    let ok = true; const re = /([A-Za-z]+)\s+(\d+)/g; let m;
    while ((m = re.exec(q.gate || ""))) { const sk = m[1].toLowerCase(), need = +m[2]; if (lv[sk] != null && lv[sk] < need) ok = false; }
    return ok;
  }
  qStatus(q) { return this.questDone(q) ? "Done" : this.questReqsMet(q) ? "Stat-ready" : "Blocked"; }
  diaryStatus(d) {
    if (d.status === "Done") return "Done";
    const lv = {}; this.skillsRaw.forEach(([nm, l]) => { lv[nm.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft;
    let ok = true; const re = /([A-Za-z]+)\s+(\d+)/g; let m;
    while ((m = re.exec(d.gate || ""))) { const sk = m[1].toLowerCase(), need = +m[2]; if (lv[sk] != null && lv[sk] < need) ok = false; }
    return ok ? "Stat-ready" : "Blocked";
  }
  stColor(s) { return s === "Done" ? C.green : s === "Stat-ready" ? "#9a7530" : C.red; }
  stBg(s) { return s === "Done" ? "rgba(92,110,53,.16)" : s === "Stat-ready" ? "rgba(201,162,74,.18)" : "rgba(150,58,44,.12)"; }

  // Drop-rate luck verdict. `rate` is the 1/N denominator, `got` the count
  // received over `kc` kills. expected = kc/N. With got>0 we compare against
  // expected (got/expected ratio → spooned vs late); with got==0 we grade how
  // far past the rate you are (expected → dry). Getting a 1/3000 drop at 1 KC
  // gives a huge ratio → "extremely spooned".
  luckVerdict(kc, rate, got) {
    const expected = rate > 0 ? kc / rate : 0;
    if (kc <= 0) return { t: "—", c: C.muted };
    if (got > 0) {
      const ratio = got / Math.max(expected, 1e-9);
      if (ratio >= 4) return { t: "extremely spooned", c: C.green };
      if (ratio >= 2) return { t: "spooned", c: C.green };
      if (ratio >= 1.2) return { t: "ahead of rate", c: C.green };
      if (ratio >= 0.8) return { t: "on rate", c: C.muted };
      return { t: "late but got it", c: C.gold };
    }
    if (expected >= 4) return { t: "extremely dry", c: C.red };
    if (expected >= 2.5) return { t: "very dry", c: C.red };
    if (expected >= 1.5) return { t: "dry", c: C.red };
    if (expected >= 0.5) return { t: "on rate", c: C.muted };
    return { t: "early days", c: C.muted };
  }
  flipTax(sell, qty) { return Math.min(5000000, Math.floor(sell * 0.02)) * qty; }
  computeFlip(f) {
    if (f.avgBuy != null && f.avgSell != null) {
      const qty = f.qty || 1; const tax = this.flipTax(f.avgSell, qty); const net = Math.round((f.avgSell - f.avgBuy) * qty - tax);
      const cost = f.avgBuy * qty; const roi = cost > 0 ? +((net / cost) * 100).toFixed(1) : 0;
      const hold = f.buyDate && f.sellDate ? Math.max(0, Math.round((new Date(f.sellDate) - new Date(f.buyDate)) / 86400000)) : 0;
      return { item: f.item, qty, avgBuy: f.avgBuy, avgSell: f.avgSell, buyDate: f.buyDate, sellDate: f.sellDate, notes: f.notes || "", tax, net, roi, hold, gpday: Math.round(net / Math.max(1, hold)) };
    }
    return { item: f.item, qty: f.qty || 0, avgBuy: 0, avgSell: 0, buyDate: f.date, sellDate: f.date, notes: f.notes || "", tax: 0, net: f.net || 0, roi: f.roi || 0, hold: 0, gpday: 0 };
  }
  alchCost() { const c = this.alchcfg; return c.fireSource === "staff" ? c.natRune : c.natRune + 5 * c.fireRune; }

  // ---------- generic table sort/filter engine ----------
  gSort = (table, col) => this.setState((s) => { const cur = (s.tSort && s.tSort[table]) || {}; let nx; if (cur.c === col) nx = cur.d > 0 ? { c: col, d: -1 } : null; else nx = { c: col, d: 1 }; const tS = { ...s.tSort }; if (nx) tS[table] = nx; else delete tS[table]; return { tSort: tS, tOpen: "" }; });
  gOpenFilter = (table, col) => this.setState((s) => ({ tOpen: s.tOpen === table + ":" + col ? "" : table + ":" + col }));
  gToggle = (table, col, v) => this.setState((s) => { const tF = { ...s.tFilt }; const tt = { ...(tF[table] || {}) }; const cur = tt[col] && tt[col].vals ? tt[col].vals.slice() : []; const i = cur.indexOf(v); if (i >= 0) cur.splice(i, 1); else cur.push(v); tt[col] = { type: "enum", vals: cur }; tF[table] = tt; return { tFilt: tF }; });
  gText = (table, col, v) => this.setState((s) => { const tF = { ...s.tFilt }; const tt = { ...(tF[table] || {}) }; tt[col] = { type: "text", val: v }; tF[table] = tt; return { tFilt: tF }; });
  gClear = (table) => this.setState((s) => { const tF = { ...s.tFilt }; delete tF[table]; return { tFilt: tF, tOpen: "" }; });
  tableHandlers() { return { sort: this.gSort, openFilter: this.gOpenFilter, toggle: this.gToggle, text: this.gText, clear: this.gClear }; }
  buildTable(key, src, cols) {
    const S = this.state.tSort && this.state.tSort[key];
    const F = (this.state.tFilt && this.state.tFilt[key]) || {};
    let rows = src.slice();
    cols.forEach((c) => { const f = F[c.key]; if (!f || !c.filter) return; if (f.type === "enum" && f.vals && f.vals.length) rows = rows.filter((r) => f.vals.indexOf("" + c.fval(r)) >= 0); else if (f.type === "text" && f.val) { const q = ("" + f.val).toLowerCase(); rows = rows.filter((r) => ("" + c.fval(r)).toLowerCase().indexOf(q) >= 0); } });
    if (S && S.c) { const c = cols.find((x) => x.key === S.c); if (c) { const sv = c.sval || c.fval; rows.sort((a, b) => { const av = sv(a), bv = sv(b); let cmp = typeof av === "number" && typeof bv === "number" ? av - bv : ("" + av).localeCompare("" + bv); return cmp * S.d; }); } }
    const isActive = (f) => f && ((f.type === "enum" && f.vals && f.vals.length) || (f.type === "text" && f.val));
    const headers = cols.map((c) => {
      const f = F[c.key], active = isActive(f); const ind = S && S.c === c.key ? (S.d > 0 ? " ▲" : " ▼") : "";
      const isOpen = this.state.tOpen === key + ":" + c.key; let opts = [];
      if (c.filter === "enum") { const vals = (f && f.vals) || []; opts = (c.options || []).map((o) => ({ v: "" + o.v, label: o.label, box: vals.indexOf("" + o.v) >= 0 ? C.gold : "transparent" })); }
      return { key: c.key, label: c.label, ind, justify: c.align === "right" ? "flex-end" : "flex-start", filterable: !!c.filter, fcolor: active ? C.goldBright : "#7d6535", openText: isOpen && c.filter === "text", openEnum: isOpen && c.filter === "enum", textVal: (f && f.val) || "", opts, popPos: c.align === "right" ? "right" : "left" };
    });
    return { rows, headers, shown: rows.length, total: src.length, anyFilter: cols.some((c) => isActive(F[c.key])) };
  }

  // ---------- live data ----------
  fetchStats = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const rsn = this.val("rsn_input");
    if (!rsn) { this.setState({ fetchMsg: "Enter a RuneScape name first." }); return; }
    this.setState({ fetching: true, fetchMsg: "Consulting the hiscores…" });
    const res = await fetchPlayer(rsn);
    if (!res.ok) { this.setState({ fetching: false, fetchMsg: res.error }); return; }
    this.stats = { rsn: res.rsn, skills: res.skills, mode: res.mode || this.mode, source: res.source, qpApi: res.qp, at: Date.now(), demo: false };
    this.skillsRaw = res.skills; this._save("almanac.stats.v1", this.stats);
    this.setState({ fetching: false, fetchMsg: `Loaded ${res.rsn} · combat ${res.combat} · ${res.source}` });
  };
  setMode = (m) => { this.stats.mode = m; this._save("almanac.stats.v1", this.stats); this.bump(); };
  refreshPrices = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.setState({ priceStatus: "Fetching live prices…" });
    try {
      const { byName } = await fetchPrices({ maxAgeMs: 0 }); const now = Date.now() / 1000; let n = 0;
      this.logs.scan.forEach((it) => { const m = byName[(it.name || "").toLowerCase()]; if (m) { if (m.low) it.buy = m.low; if (m.high) it.sell = m.high; if (m.limit) it.limit = m.limit; if (m.volume) it.vol = m.volume; const tt = Math.max(m.highTime, m.lowTime); if (tt) it.age = Math.max(0, Math.round(now - tt) / 60 | 0); n++; } });
      this.alchItems.forEach((a) => { const m = byName[a.item.toLowerCase()]; if (m) { if (m.high) a.buy = m.high; if (m.highalch) a.alch = m.highalch; if (m.limit) a.limit = m.limit; } });
      const nat = byName["nature rune"]; if (nat && (nat.high || nat.low)) { this.alchcfg.natRune = nat.high || nat.low; this._save("almanac.alchcfg.v1", this.alchcfg); }
      this.saveLogs(); this.setState({ priceStatus: `Updated ${n} items · ${new Date().toLocaleTimeString()}` });
    } catch (err) { this.setState({ priceStatus: "Live prices unavailable right now — manual entry still works." }); }
  };
  refreshGearPrices = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.setState({ gearPriceStatus: "Fetching live prices…" });
    try {
      const { byName } = await fetchPrices({ maxAgeMs: 0 }); let n = 0;
      ["melee", "ranged", "magic"].forEach((st) => (GEAR_DATA[st] || []).forEach((s) => s.items.forEach((it) => { const m = byName[(it.n || "").toLowerCase()]; if (m && (m.high || m.low)) { this.gearPrices[it.n] = m.high || m.low; n++; } })));
      this.setState({ gearPriceStatus: `Updated ${n} live prices · ${new Date().toLocaleTimeString()}` });
    } catch (err) { this.setState({ gearPriceStatus: "Live prices unavailable here — static values shown." }); }
  };
  refreshDropPrices = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    this.setState({ priceStatus: "Pricing drop tables…" });
    try {
      const { byName } = await fetchPrices({ maxAgeMs: 0 }); let n = 0;
      Object.values(this.bossDrops).forEach((arr) => arr.forEach((d) => { const m = byName[(d.n || "").toLowerCase().replace(/\s*\(pet\)/, "")]; if (m && (m.high || m.low)) { d.v = m.high || m.low; n++; } }));
      this.setState({ priceStatus: `Re-priced ${n} drops · ${new Date().toLocaleTimeString()}` });
    } catch (err) { this.setState({ priceStatus: "Live prices unavailable here." }); }
  };

  // ---------- handlers: navigation & forms ----------
  go = (s) => this.setState({ section: s, openForm: null });
  toggleForm = (f) => this.setState((s) => ({ openForm: s.openForm === f ? null : f, fillResult: null }));
  setCfg = (cfg, key, raw, opts = {}) => { let v = opts.str ? raw : Math.max(0, Math.round(this.parseNum(raw) || 0)); this[cfg][key] = v; this._save("almanac." + cfg + ".v1", this[cfg]); this.bump(); };

  addNw = () => { const cash = this.num("nw_cash"), bank = this.num("nw_bank"); if (cash + bank <= 0) return; const items = Math.max(0, bank - cash); this.logs.nw.push({ date: this.val("nw_date") || this.today(), cash, items, note: this.val("nw_note") }); this.saveLogs(); this.setState({ openForm: null }); };
  addFlip = () => { const item = this.val("flip_item") || "Item", qty = this.num("flip_qty") || 1, avgBuy = this.num("flip_buy"), avgSell = this.num("flip_sell"); if (avgBuy <= 0 || avgSell <= 0) return; this.logs.flips.unshift({ buyDate: this.val("flip_bdate") || this.today(), sellDate: this.val("flip_sdate") || this.today(), item, qty, avgBuy, avgSell, notes: this.val("flip_notes") }); this.saveLogs(); this.setState({ openForm: null, flipPrefill: null }); };
  // Fill calculator: weighted-average a multi-fill flip whose price moved across partials.
  calcFill = () => {
    let bq = 0, bc = 0, sq = 0, sr = 0;
    for (let i = 1; i <= 5; i++) {
      const q = this.num("fill_bq" + i), p = this.num("fill_bp" + i); if (q > 0 && p > 0) { bq += q; bc += q * p; }
      const q2 = this.num("fill_sq" + i), p2 = this.num("fill_sp" + i); if (q2 > 0 && p2 > 0) { sq += q2; sr += q2 * p2; }
    }
    const avgBuy = bq > 0 ? Math.round(bc / bq) : 0, avgSell = sq > 0 ? Math.round(sr / sq) : 0, qty = bq || sq;
    this.setState({ fillResult: { qty, avgBuy, avgSell, bq, sq }, fillMsg: "" });
  };
  copyFill = () => {
    const r = this.state.fillResult; if (!r) return;
    const text = r.qty + "\t" + r.avgBuy + "\t" + r.avgSell;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => this.setState({ fillMsg: `Copied (tab-separated): ${r.qty}  ${r.avgBuy}  ${r.avgSell}` })).catch(() => this.setState({ fillMsg: `Copy blocked — values: ${r.qty}, ${r.avgBuy}, ${r.avgSell}` }));
    } else {
      this.setState({ fillMsg: `Clipboard unavailable — values: ${r.qty}, ${r.avgBuy}, ${r.avgSell}` });
    }
  };
  fillToLedger = () => { const r = this.state.fillResult; if (!r) return; this.setState({ flipView: "ledger", openForm: "flip", flipPrefill: { qty: r.qty, avgBuy: r.avgBuy, avgSell: r.avgSell } }); };
  addScan = () => { const name = this.val("scan_name"); if (!name) return; this.logs.scan.unshift({ name, buy: this.num("scan_buy"), sell: this.num("scan_sell"), vol: this.num("scan_vol"), limit: this.num("scan_limit") || 1, age: this.num("scan_age") }); this.saveLogs(); this.setState({ openForm: null }); };
  addWatch = () => { const item = this.val("watch_item"); if (!item) return; this.logs.watch.unshift({ item, target: this.num("watch_target"), note: this.val("watch_note") }); this.saveLogs(); this.setState({ openForm: null }); };
  addAlch = () => { const casts = this.num("alch_casts"); if (casts <= 0) return; const item = this.val("alch_item") || "High alch", alchVal = this.num("alch_alch"), buy = this.num("alch_buy"); this.logs.alch.unshift({ date: this.today(), item, casts, alchVal, buy, net: (alchVal - buy - this.alchCost()) * casts, xp: casts * 65 }); this.saveLogs(); this.setState({ openForm: null }); };
  addHerb = () => { const tier = this.val("herb_tier") || "Snapdragon", runs = this.num("herb_runs") || 1, netOv = this.num("herb_net"); const def = this.farmDefs.find((f) => f.tier === tier); this.logs.herb.unshift({ date: this.today(), tier, runs, net: netOv > 0 ? netOv : def ? def.net * runs : 0 }); this.saveLogs(); this.setState({ openForm: null }); };
  addBoss = () => { const boss = this.val("boss_name") || D.bosses[0].n, kills = this.num("boss_kills") || 1; this.logs.boss.unshift({ date: this.today(), boss, kills, note: this.val("boss_note") }); this.saveLogs(); this.setState({ openForm: null }); };
  addSlay = () => { const task = this.val("slay_task") || D.slayer[0].task; this.logs.slayerLog.unshift({ date: this.today(), task, xp: this.num("slay_xp"), gp: this.num("slay_gp") }); this.saveLogs(); this.setState({ openForm: null }); };
  addDrop = () => { const boss = this.val("drop_boss") || this.state.bossFocus, drop = this.val("drop_name"); if (!boss || !drop) return; this.logs.drop.unshift({ date: this.today(), boss, drop, kc: this.num("drop_kc") }); this.saveLogs(); this.setState({ openForm: null }); };
  delLog = (t, i) => { if (this.logs[t]) { this.logs[t].splice(i, 1); this.saveLogs(); this.bump(); } };

  addGoal = () => { const skill = this.val("sg_skill"); if (!skill || this.goals.find((g) => g.skill === skill)) { this.setState({ openForm: null }); return; } this.goals.push({ skill, tgt: Math.max(2, Math.min(99, this.num("sg_tgt") || 99)), method: this.val("sg_method") || "Custom plan", xpHr: this.num("sg_xphr"), gpHr: this.num("sg_gphr") }); this._save("almanac.goals.v1", this.goals); this.setState({ openForm: null }); };
  removeGoal = (sk) => { this.goals = this.goals.filter((g) => g.skill !== sk); this._save("almanac.goals.v1", this.goals); this.bump(); };

  // ---------- comprehensive objectives (bank / quest / diary / loot) ----------
  defaultObjectives() {
    return [
      { id: "seed_bank", type: "bank", target: this.gcfg ? this.gcfg.bankGoal || 1e9 : 1e9 },
      { id: "seed_cape", type: "quest", quest: "__cape__" },
    ];
  }
  addObjective = () => {
    const type = this.state.objType || "bank";
    const o = { id: "o" + Date.now() + "_" + Math.round(this.parseNum(this.val("rsn_input")) || this.objectives.length), type };
    if (type === "bank") { o.target = this.num("obj_bank"); if (o.target <= 0) return; }
    else if (type === "quest") { o.quest = this.val("obj_quest") || "__cape__"; }
    else if (type === "diary") { o.diary = this.val("obj_diary"); if (!o.diary) return; }
    else if (type === "loot") { o.boss = this.state.objBoss || this.val("obj_boss"); o.drop = this.val("obj_drop"); if (!o.boss || !o.drop) return; }
    this.objectives.push(o); this._save("almanac.objectives.v1", this.objectives); this.setState({ openForm: null });
  };
  removeObjective = (id) => { this.objectives = this.objectives.filter((o) => o.id !== id); this._save("almanac.objectives.v1", this.objectives); this.bump(); };

  // Best gp/hr earner open to the player right now — drives funding suggestions.
  bestEarner() {
    const aCost = this.alchCost(), cphr = this.alchcfg.castsPerHour || 1200;
    const alchBest = Math.max(0, ...this.alchItems.map((a) => (a.alch - a.buy - aCost) * cphr));
    const slay = this.slayWeighted();
    const accBoss = Math.max(0, ...D.bosses.filter((b) => this.bossEff(b).acc).map((b) => this.bossEff(b).estGp));
    const cands = [
      { name: "High Alchemy", perHr: alchBest },
      { name: "Slayer (after blocks)", perHr: slay.gp },
      { name: "best boss open now", perHr: accBoss },
    ];
    return cands.reduce((b, m) => (m.perHr > b.perHr ? m : b));
  }
  // Skill requirements in a quest/diary gate the player hasn't met yet.
  missingReqs(gate) {
    const lv = {}; this.skillsRaw.forEach(([nm, l]) => { lv[nm.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft;
    const out = []; const re = /([A-Za-z][A-Za-z ]*?)\s+(\d+)/g; let m;
    while ((m = re.exec(gate || ""))) { const sk = m[1].trim().toLowerCase(), need = +m[2]; if (lv[sk] != null && lv[sk] < need) out.push(m[1].trim() + " " + lv[sk] + "→" + need); }
    return out;
  }
  // Fractional progress (0..1) toward a gate's skill requirements.
  reqProgress(gate) {
    const lv = {}; this.skillsRaw.forEach(([nm, l]) => { lv[nm.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft;
    const reqs = []; const re = /([A-Za-z][A-Za-z ]*?)\s+(\d+)/g; let m;
    while ((m = re.exec(gate || ""))) { const sk = m[1].trim().toLowerCase(), need = +m[2]; if (lv[sk] != null) reqs.push({ cur: lv[sk], need }); }
    if (!reqs.length) return 1;
    return reqs.reduce((a, r) => a + Math.min(1, r.cur / r.need), 0) / reqs.length;
  }
  // Synthesize a goal's progress + a suggested route from live & logged data.
  objectiveView(o) {
    const d = this.derive();
    if (o.type === "bank") {
      const target = o.target || 0, remain = Math.max(0, target - d.netWorth);
      const pct = target > 0 ? Math.min(100, (d.netWorth / target) * 100) : 0;
      const best = this.bestEarner();
      const days = d.gpDay > 0 ? Math.ceil(remain / d.gpDay) : null;
      const eta = remain <= 0 ? "done" : days != null ? this.fmtDays(days) : "—";
      const route = remain <= 0 ? "Target reached — set a higher one." : `Top earner now: ${best.name} (~${this.short(best.perHr)}/hr). ` + (days != null ? `At ${this.short(d.gpDay)}/day that's ~${this.fmtDays(days)} away.` : "Log net-worth snapshots so a date can be projected.");
      return { kind: "Bank value", title: this.short(target) + " bank", sub: `${this.short(d.netWorth)} of ${this.short(target)} · ${this.short(remain)} to go`, pct, route, eta, done: remain <= 0 };
    }
    if (o.type === "quest") {
      if (o.quest === "__cape__") {
        const order = QUEST_ORDER.optimal || [];
        const byName = {}; D.quests.forEach((q) => (byName[q.n] = q));
        const remaining = order.map((n) => byName[n]).filter((q) => q && this.qStatus(q) !== "Done");
        const ready = remaining.filter((q) => this.qStatus(q) === "Stat-ready").map((q) => q.n);
        const route = d.qRemaining === 0 ? "Every quest complete — claim the cape!" : ready.length ? `Do next (stat-ready): ${ready.slice(0, 3).join(", ")}${ready.length > 3 ? "…" : ""}.` : `Next up "${remaining[0] ? remaining[0].n : "?"}" is stat-blocked — train its requirements first.`;
        return { kind: "Quest", title: "Quest Cape", sub: `${d.qDone}/${d.qTotal} done · ${d.qRemaining} to go · ${this.questPoints} QP`, pct: d.qPct, route, eta: d.qRemaining ? d.qRemaining + " left" : "done", done: d.qRemaining === 0 };
      }
      const q = D.quests.find((x) => x.n === o.quest);
      if (!q) return null;
      const st = this.qStatus(q), miss = this.missingReqs(q.gate);
      const pct = st === "Done" ? 100 : this.reqProgress(q.gate) * 100;
      const route = st === "Done" ? "Completed." : st === "Stat-ready" ? "Stat requirements met — start it now." : `Stat-blocked — train ${miss.join(", ") || "earlier quests in the chain"}.`;
      return { kind: "Quest", title: q.n, sub: (q.series ? q.series + " series" : "Quest") + (q.gate ? " · needs " + q.gate : ""), pct, route, eta: st, done: st === "Done" };
    }
    if (o.type === "diary") {
      const dy = D.diaries.find((x) => x.region + " " + x.tier === o.diary);
      if (!dy) return null;
      const st = this.diaryStatus(dy), miss = this.missingReqs(dy.gate);
      const pct = st === "Done" ? 100 : this.reqProgress(dy.gate) * 100;
      const route = st === "Done" ? "Completed." : miss.length ? `Train ${miss.join(", ")} to unlock the tasks.` : "Stats met — knock out the diary tasks.";
      return { kind: "Diary", title: `${dy.region} ${dy.tier}`, sub: "Achievement Diary" + (dy.gate ? " · needs " + dy.gate : ""), pct, route, eta: st, done: st === "Done" };
    }
    if (o.type === "loot") {
      const b = D.bosses.find((x) => x.n === o.boss); const drops = this.bossDrops[o.boss] || []; const dr = drops.find((x) => x.n === o.drop);
      if (!b || !dr) return null;
      const killKc = this.logs.boss.filter((x) => x.boss === o.boss).reduce((a, x) => a + (x.kills || 0), 0);
      const dropKc = Math.max(0, ...this.logs.drop.filter((x) => x.boss === o.boss).map((x) => x.kc || 0));
      const kc = Math.max(killKc, dropKc);
      const got = this.logs.drop.filter((x) => x.boss === o.boss && x.drop === o.drop).length;
      const e = this.bossEff(b), kph = e.kills || 0;
      const pct = got > 0 ? 100 : Math.min(100, (kc / dr.rate) * 100);
      const v = this.luckVerdict(kc, dr.rate, got);
      const hrsToRate = kph > 0 ? Math.round(dr.rate / kph) : 0;
      const route = got > 0 ? `Obtained — ${v.t} (${got}× by ${this.fmt(kc)} KC).` : `1/${this.fmt(dr.rate)} drop. ` + (kph > 0 ? `~${kph} kills/hr → about ${hrsToRate}h to hit rate. ` : "") + `You're ${this.fmt(kc)} KC in.` + (e.acc ? "" : " ⚠ you don't meet this boss's combat/Slayer reqs yet.");
      return { kind: "Loot", title: dr.n, sub: `from ${b.n}` + (dr.v > 0 ? ` · ${this.short(dr.v)}` : ""), pct, route, eta: got > 0 ? "got it" : v.t, done: got > 0 };
    }
    return null;
  }
  setGoalField = (sk, k, v) => { const g = this.goals.find((x) => x.skill === sk); if (!g) return; g[k] = k === "method" ? v : k === "tgt" ? Math.max(2, Math.min(99, parseInt(v) || 0)) : Math.round(this.parseNum(v)); this._save("almanac.goals.v1", this.goals); this.bump(); };

  cycleQuest = (n) => { this.questOv[n] = !this.questOv[n]; this._save("almanac.questdone.v1", this.questOv); this.bump(); };
  toggleBlock = (t) => { this.blocks[t] = !this.blocks[t]; this._save("almanac.blocks.v1", this.blocks); this.bump(); };
  setBossOv = (boss, key, raw) => { const v = Math.max(0, Math.round(this.parseNum(raw) || 0)); if (!this.bossOv[boss]) this.bossOv[boss] = {}; this.bossOv[boss][key] = v; this._save("almanac.bossov.v1", this.bossOv); this.bump(); };
  resetBossOv = (boss) => { delete this.bossOv[boss]; this._save("almanac.bossov.v1", this.bossOv); this.bump(); };

  // ---------- small render helpers ----------
  field(id, ph, opts = {}) {
    return <input className="led" id={id} placeholder={ph} defaultValue={opts.def != null ? opts.def : ""} list={opts.list} type={opts.type || "text"} style={{ width: opts.w || 150, ...opts.style }} />;
  }

  render() {
    if (!this.logs) return <div style={{ padding: 40, color: "#999" }}>Loading…</div>;
    const sec = this.state.section;
    const TH = themeFor(sec);
    const t = TITLES[sec] || TITLES.dashboard;
    const rsn = (this.stats && this.stats.rsn) || "Adventurer";
    const initial = (rsn[0] || "A").toUpperCase();
    const A = this.account;

    return (
      <div style={{ display: "flex", minHeight: "100vh", background: "#1c130c", backgroundImage: "radial-gradient(circle at 30% 20%, rgba(120,86,40,.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(80,55,30,.22), transparent 55%)" }}>
        {/* ---- sidebar ---- */}
        <aside style={{ width: 256, flex: "0 0 256px", minHeight: "100vh", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", overflowY: "auto", background: "#2a1a10", backgroundImage: "linear-gradient(100deg, #321f12, #241509)", borderRight: "3px solid #6b5226", boxShadow: "inset -14px 0 26px rgba(0,0,0,.45)" }}>
          <div style={{ padding: "24px 22px 16px", borderBottom: "1px solid rgba(201,162,74,.22)", textAlign: "center" }}>
            <div style={{ width: 60, height: 60, margin: "0 auto 12px", borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #e3c878, #b98f3e 55%, #7c5a22)", border: "2px solid #e3c878", display: "flex", alignItems: "center", justifyContent: "center", animation: "sealpulse 4.5s ease-in-out infinite", boxShadow: "0 6px 16px rgba(0,0,0,.5)" }}>
              <span style={cinzel({ fontWeight: 800, fontSize: 26, color: "#3a2410" })}>⚔</span>
            </div>
            <div style={cinzel({ fontWeight: 700, fontSize: 17, letterSpacing: ".12em", color: "#e7cf8c", textTransform: "uppercase" })}>Almanac</div>
            <div style={mono({ fontSize: 9, letterSpacing: ".26em", color: "#9c7c44", textTransform: "uppercase", marginTop: 4 })}>Adventurer's Ledger</div>
          </div>
          <nav style={{ padding: "12px 12px 24px" }}>
            {NAV.map((grp) => (
              <div key={grp.label} style={{ margin: "6px 0 14px" }}>
                <div style={mono({ fontSize: 9, letterSpacing: ".3em", color: "#8a6a38", textTransform: "uppercase", padding: "6px 12px" })}>{grp.label}</div>
                {grp.items.map(([id, label]) => {
                  const on = sec === id;
                  return (
                    <a key={id} href="#" onClick={(e) => { e.preventDefault(); this.go(id); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", textDecoration: "none", borderRadius: 6, margin: "1px 4px", background: on ? "linear-gradient(100deg, rgba(201,162,74,.22), rgba(201,162,74,.05))" : "transparent", borderLeft: on ? "2px solid #e3c878" : "2px solid transparent" }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "0 0 7px", background: on ? "#e3c878" : "#6b5226" }} />
                      <span style={{ ...serif({ fontSize: 15, color: on ? "#f0e2bd" : "#c2a877" }), flex: 1 }}>{label}</span>
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        {/* ---- main column ---- */}
        <main style={{ flex: 1, minWidth: 0, minHeight: "100vh", background: "#e9dcbf", backgroundImage: `radial-gradient(circle at 15% 0%, rgba(255,250,235,.55), transparent 45%), radial-gradient(circle at 85% 6%, ${TH.accent}1f, transparent 42%), radial-gradient(circle at 85% 100%, rgba(150,120,70,.16), transparent 50%)`, transition: "background-image .4s ease" }}>
          {/* header + RSN bar */}
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 30px", borderBottom: `2px solid ${TH.accent}`, boxShadow: `inset 0 -4px 0 -2px ${TH.accent}55`, background: "linear-gradient(180deg, rgba(231,217,184,.97), rgba(231,217,184,.85))", position: "sticky", top: 0, zIndex: 25 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, flex: "0 0 34px", background: `linear-gradient(140deg, ${TH.g1}, ${TH.g2})`, border: `1px solid ${TH.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, boxShadow: `0 0 12px ${TH.accent}44` }}>{TH.icon}</div>
              <div>
                <div style={mono({ fontSize: 9, letterSpacing: ".22em", color: TH.accent, textTransform: "uppercase" })}>{t[0]}</div>
                <div style={cinzel({ fontWeight: 700, fontSize: 21, color: "#3a2812" })}>{t[1]}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <input className="led" id="rsn_input" defaultValue={this.stats && !this.stats.demo ? rsn : ""} placeholder="RuneScape name…" onKeyDown={(e) => { if (e.key === "Enter") this.fetchStats(e); }} style={{ width: 168 }} />
              <Btn tone="gold" onClick={this.fetchStats}>{this.state.fetching ? "…" : "Fetch stats"}</Btn>
              <Seg options={[{ key: "main", label: "MAIN" }, { key: "iron", label: "IRONMAN" }]} active={this.mode} onPick={this.setMode} size={9.5} />
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #e3c878, #b98f3e 60%, #7c5a22)", border: "2px solid #6b5226", display: "flex", alignItems: "center", justifyContent: "center", ...cinzel({ fontWeight: 800, color: "#3a2410", fontSize: 16 }) }}>{initial}</div>
            </div>
          </header>
          {this.state.fetchMsg && (
            <div style={{ padding: "7px 30px", background: "rgba(201,162,74,.12)", borderBottom: "1px solid rgba(201,162,74,.25)", ...mono({ fontSize: 11, color: "#6a5436" }) }}>
              {this.state.fetchMsg}
              {this.stats && this.stats.demo && " — showing demo data until you load a name."}
            </div>
          )}

          <div style={{ padding: "24px 30px 60px" }}>
            {sec === "dashboard" && this.renderDashboard(A)}
            {sec === "skills" && this.renderSkills()}
            {sec === "goals" && this.renderGoals()}
            {sec === "networth" && this.renderNetWorth()}
            {sec === "flipping" && this.renderFlipping()}
            {sec === "alchemy" && this.renderAlchemy()}
            {sec === "bossing" && this.renderBossing()}
            {sec === "slayer" && this.renderSlayer()}
            {sec === "gear" && this.renderGear()}
            {sec === "farming" && this.renderFarming()}
            {sec === "quests" && this.renderQuests()}
            {sec === "diary" && this.renderDiary()}
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Shared derived values
  // -------------------------------------------------------------------------
  derive() {
    const logs = this.logs;
    const nwSorted = logs.nw.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const latest = nwSorted[nwSorted.length - 1] || { cash: 0, items: 0, date: this.today() };
    const first = nwSorted[0] || latest;
    const netWorth = latest.cash + latest.items, cash = latest.cash, items = latest.items;
    const nwStart = first.cash + first.items;
    const days = Math.max(1, Math.round((new Date(latest.date) - new Date(first.date)) / 86400000));
    const gpDay = Math.round((netWorth - nwStart) / days);
    const totalLevel = this.skillsRaw.reduce((a, [, l]) => a + l, 0);
    const totalXp = this.skillsRaw.reduce((a, [, , x]) => a + x, 0);
    const count99 = this.skillsRaw.filter(([, l]) => l >= 99).length;
    const quests = D.quests || [];
    const qDone = quests.filter((q) => this.qStatus(q) === "Done").length;
    const qTotal = quests.length || 1;
    const qPct = Math.round((qDone / qTotal) * 100);
    const qRemaining = qTotal - qDone;
    return { logs, nwSorted, netWorth, cash, items, nwStart, gpDay, totalLevel, totalXp, count99, qDone, qTotal, qPct, qRemaining };
  }

  // best boss GP/hr respecting per-boss overrides + accessibility gate
  bossEff(b) {
    const o = this.bossOv[b.n] || {};
    const slayLvl = (this.skillMap.Slayer || { l: 1 }).l;
    const acc = this.account.combat >= (b.minCb || 0) && slayLvl >= (b.slay || 0);
    return {
      kills: o.kills != null ? o.kills : b.kills,
      estGp: o.gpHr != null ? o.gpHr : b.estGp,
      xpHr: o.xpHr != null ? o.xpHr : parseInt(("" + b.cbXp).replace(/[^0-9]/g, "")) * 1000 || 0,
      acc,
    };
  }
  // weighted slayer xp/gp after blocks
  slayWeighted() {
    let wSum = 0, wxp = 0, wgp = 0;
    D.slayer.forEach((t) => { if (this.blocks[t.task]) return; const w = t.weight || 0; wSum += w; wxp += w * t.xpHr; wgp += w * t.gpHr; });
    return { xp: wSum > 0 ? Math.round(wxp / wSum) : 0, gp: wSum > 0 ? Math.round(wgp / wSum) : 0, blocked: D.slayer.filter((t) => this.blocks[t.task]).length };
  }

  // ===================== DASHBOARD =====================
  renderDashboard(A) {
    const d = this.derive();
    const sm = this.skillMap;
    // money makers
    const aCost = this.alchCost(), cphr = this.alchcfg.castsPerHour || 1200;
    const alchBest = this.alchItems.map((a) => (a.alch - a.buy - aCost) * cphr).reduce((m, v) => Math.max(m, v), 0);
    const slay = this.slayWeighted();
    const accBoss = D.bosses.filter((b) => this.bossEff(b).acc).map((b) => this.bossEff(b).estGp).reduce((m, v) => Math.max(m, v), 0);
    const herbBest = Math.max(...this.farmDefs.filter((f) => f.unlocked).map((f) => f.net));
    const flipNet = d.logs.flips.map((f) => this.computeFlip(f)).reduce((a, f) => a + f.net, 0);
    const money = [
      { name: "High Alchemy", note: "magic XP + steady gp, AFK-friendly", rate: this.short(alchBest), unit: "gp / hr", c: C.purple },
      { name: "Slayer (after blocks)", note: slay.blocked + " tasks blocked", rate: this.short(slay.gp), unit: "loot / hr", c: C.red },
      { name: "Best boss (open now)", note: "scaled to your combat & slayer", rate: this.short(accBoss), unit: "gp / hr", c: C.teal },
      { name: "Herb run", note: "~5 min, best unlocked tier", rate: this.short(herbBest), unit: "gp / run", c: C.green },
    ];
    const bestNow = money.slice(0, 3).reduce((b, m) => (this.parseNum(m.rate) > this.parseNum(b.rate) ? m : b));
    // next quest / diary
    const order = QUEST_ORDER.optimal || [];
    const byName = {}; D.quests.forEach((q) => (byName[q.n] = q));
    const nextQuest = (order.map((n) => byName[n]).find((q) => q && this.qStatus(q) === "Stat-ready") || {}).n || "—";
    const nextDiary = (D.diaries.find((x) => this.diaryStatus(x) === "Stat-ready") || {});
    const bankGoal = this.gcfg.bankGoal || 1e10, baseGoal = this.gcfg.baseGoal || 70;
    const baseLow = Math.min(sm.Attack.l, sm.Strength.l, sm.Defence.l, sm.Hitpoints.l, sm.Ranged.l, sm.Magic.l);
    const goals = [
      { name: "Quest Cape", note: d.qRemaining + " quests remaining · next → " + nextQuest, pct: d.qPct },
      { name: this.short(bankGoal) + " Bank", note: this.short(d.netWorth) + " of " + this.short(bankGoal) + " · " + this.short(d.gpDay) + "/day", pct: Math.min(100, (d.netWorth / bankGoal) * 100) },
      { name: "Base " + baseGoal, note: "lowest combat skill is " + baseLow + (baseLow >= baseGoal ? " · reached" : " · +" + (baseGoal - baseLow) + " to go"), pct: Math.min(100, (baseLow / baseGoal) * 100) },
    ];
    return (
      <div>
        {/* hero */}
        <Card style={{ marginBottom: 16, background: "linear-gradient(135deg,#2a1a10,#3a2410)", border: "1px solid #6b5226", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 78, height: 78, borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #e3c878, #b98f3e 60%, #7c5a22)", border: "3px solid #e3c878", display: "flex", alignItems: "center", justifyContent: "center", ...cinzel({ fontWeight: 800, fontSize: 38, color: "#3a2410" }) }}>{(d.logs && (this.stats.rsn[0] || "A")).toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <Kicker color="#9c7c44">The ledger of</Kicker>
            <div style={cinzel({ fontWeight: 700, fontSize: 32, color: "#f0e2bd" })}>{this.stats.rsn}</div>
            <div style={mono({ fontSize: 11, color: "#cbb27a", marginTop: 4 })}>Combat {A.combat} · {d.totalLevel} total · {d.count99} skills at 99 · {this.mode === "iron" ? "Ironman" : "Main"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Kicker color="#9c7c44">★ Best money now</Kicker>
            <div style={cinzel({ fontWeight: 700, fontSize: 20, color: "#e7cf8c", marginTop: 4 })}>{bestNow.name}</div>
            <div style={mono({ fontSize: 13, color: "#cbb27a" })}>{bestNow.rate} {bestNow.unit}</div>
          </div>
        </Card>

        <StatCards cols={4} items={[
          { label: "Net Worth", value: this.short(d.netWorth), sub: "▲ " + this.short(d.netWorth - d.nwStart) + " since start", subColor: C.green },
          { label: "GP / Day (avg)", value: this.short(d.gpDay), sub: "net-worth growth" },
          { label: "Total Level", value: "" + d.totalLevel, sub: d.count99 + " skills at 99" },
          { label: "Quest Cape", value: d.qPct + "%", sub: d.qRemaining + " quests · " + this.questPoints + " QP", subColor: C.red },
        ]} />

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
          <Card>
            <Kicker color={C.goldDeep}>💰 Money meta · earn the most now</Kicker>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {money.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: C.cardLight, borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                  <div style={{ width: 8, height: 36, borderRadius: 3, background: m.c }} />
                  <div style={{ flex: 1 }}>
                    <div style={cinzel({ fontWeight: 600, fontSize: 15, color: C.ink })}>{m.name}</div>
                    <div style={serif({ fontSize: 12, color: C.muted })}>{m.note}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={cinzel({ fontWeight: 700, fontSize: 18, color: m.c })}>{m.rate}</div>
                    <div style={mono({ fontSize: 8.5, letterSpacing: ".12em", color: C.muted, textTransform: "uppercase" })}>{m.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <Kicker color={C.goldDeep}>Primary goals</Kicker>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
              {goals.map((g, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={cinzel({ fontWeight: 600, fontSize: 14, color: C.ink })}>{g.name}</span>
                    <span style={mono({ fontSize: 12, color: C.gold })}>{Math.round(g.pct)}%</span>
                  </div>
                  <Bar pct={Math.max(2, g.pct)} />
                  <div style={serif({ fontSize: 11.5, color: C.muted, marginTop: 4 })}>{g.note}</div>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(44,32,19,.12)", paddingTop: 10 }}>
                <div style={mono({ fontSize: 10, color: C.muted2 })}>NEXT TO GRAB</div>
                <div style={serif({ fontSize: 14, color: C.ink, marginTop: 4 })}>Quest → <b>{nextQuest}</b></div>
                <div style={serif({ fontSize: 14, color: C.ink })}>Diary → <b>{nextDiary.region ? nextDiary.region + " " + nextDiary.tier : "—"}</b></div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ===================== SKILLS =====================
  renderSkills() {
    const d = this.derive();
    const cards = this.skillsRaw.map(([name, level, xp]) => {
      const base = this.xpFor(level), next = this.xpFor(level + 1), need99 = this.xpFor(99);
      const into = xp - base, span = next - base;
      const pctNext = level >= 99 ? 1 : Math.max(0, Math.min(1, span > 0 ? into / span : 0));
      return { name, level, xp, color: this.skillColor(level), barW: pctNext * 100, toNext: level >= 99 ? "maxed" : this.fmt(next - xp) + " to " + (level + 1), to99: level >= 99 ? "★ 99" : this.fmt(need99 - xp) + " to 99" };
    });
    return (
      <div>
        <SectionTitle kicker="Live from your hiscores" title="Skills" accent={themeFor("skills").accent} />
        <StatCards cols={4} items={[
          { label: "Total Level", value: "" + d.totalLevel, color: C.gold },
          { label: "Total XP", value: this.short(d.totalXp), color: C.purple },
          { label: "Skills at 99", value: "" + d.count99, color: C.teal },
          { label: "Combat Level", value: "" + this.account.combat, color: C.red },
        ]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px,1fr))", gap: 12 }}>
          {cards.map((s) => (
            <Card key={s.name} pad={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: s.color, ...cinzel({ fontWeight: 700, fontSize: 15, color: "#f0e7cf" }) }}>{s.level}</div>
                <div style={{ flex: 1 }}>
                  <div style={cinzel({ fontWeight: 600, fontSize: 15, color: C.ink })}>{s.name}</div>
                  <div style={mono({ fontSize: 9.5, color: C.muted })}>{this.short(s.xp)} xp</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}><Bar pct={s.barW} c1={s.color} c2={s.color} h={6} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={mono({ fontSize: 9, color: C.muted })}>{s.toNext}</span>
                <span style={mono({ fontSize: 9, color: C.muted })}>{s.to99}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ===================== GOALS =====================
  renderGoals() {
    const sm = this.skillMap;
    const rows = this.goals.map((g) => {
      const cur = sm[g.skill] || { l: 1, x: 0 }; const tgtXp = this.xpFor(g.tgt); const xpLeft = Math.max(0, tgtXp - cur.x);
      const hours = g.xpHr > 0 ? xpLeft / g.xpHr : 0; const total = Math.round(hours * g.gpHr);
      const bar = xpLeft <= 0 ? 100 : Math.max(3, Math.min(100, (cur.x / tgtXp) * 100));
      return { ...g, cur: cur.l, hours: g.xpHr > 0 ? hours.toFixed(1) + " h" : xpLeft <= 0 ? "done" : "—", total, xpLeft, bar };
    });
    let gH = 0, gG = 0, gActive = 0;
    rows.forEach((r) => { gH += this.parseNum(r.hours) || 0; gG += r.total; if (r.xpLeft > 0) gActive++; });
    const hpd = this.gcfg.hoursPerDay || 2;
    const owned = new Set(this.goals.map((g) => g.skill));
    const addable = this.skillsRaw.map(([n]) => n).filter((n) => !owned.has(n));
    // funding
    const cost = -rows.filter((r) => r.total < 0).reduce((a, r) => a + r.total, 0);
    const bank = this.derive().netWorth;
    const flipPerDay = (() => { const fc = this.logs.flips.map((f) => this.computeFlip(f)); const net = fc.reduce((a, f) => a + f.net, 0); const dates = this.logs.flips.map((f) => new Date(f.sellDate || f.date)); const span = dates.length ? Math.max(1, (Math.max(...dates) - Math.min(...dates)) / 86400000 + 1) : 1; return Math.round(net / span); })();
    const shortfall = Math.max(0, cost - bank);
    const TH = themeFor("goals");
    const objViews = this.objectives.map((o) => ({ o, v: this.objectiveView(o) })).filter((x) => x.v);
    const questOpts = D.quests.filter((q) => this.qStatus(q) !== "Done").map((q) => q.n);
    const diaryOpts = D.diaries.map((x) => x.region + " " + x.tier);
    const lootBosses = Object.keys(this.bossDrops);
    const curBoss = this.state.objBoss || lootBosses[0] || "";
    const lootDrops = (this.bossDrops[curBoss] || []).map((dd) => dd.n);
    const kindColor = (k) => ({ "Bank value": C.green, Quest: "#5a4a8a", Diary: C.gold, Loot: C.red }[k] || TH.accent);
    return (
      <div>
        <SectionTitle kicker="Objectives · live route-finding" title="Goal Ledger" accent={TH.accent}
          right={<div style={{ display: "flex", gap: 8 }}><Btn onClick={() => this.toggleForm("obj")}>+ Objective</Btn><Btn tone="gold" onClick={() => this.toggleForm("goal")}>+ Skill goal</Btn></div>} />
        <StatCards cols={4} items={[
          { label: "Total grind", value: gH.toFixed(0) + " h" },
          { label: "At " + hpd + " h / day", value: (gH / Math.max(0.1, hpd) / 7).toFixed(1) + " wks" },
          { label: "Net GP cost", value: this.signed(gG), color: gG >= 0 ? C.green : C.red },
          { label: "Active goals", value: gActive + " skill · " + this.objectives.length + " obj" },
        ]} />
        {/* ---- Objectives: bank / quest / diary / loot, each with a synthesized route ---- */}
        {this.state.openForm === "obj" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="led" value={this.state.objType} onChange={(e) => this.setState({ objType: e.target.value })} style={{ width: 150 }}>
                <option value="bank">Bank value</option><option value="quest">Quest</option><option value="diary">Diary</option><option value="loot">Loot / drop</option>
              </select>
              {this.state.objType === "bank" && this.field("obj_bank", "Target bank (gp)", { w: 180 })}
              {this.state.objType === "quest" && <select className="led" id="obj_quest" style={{ width: 240 }}><option value="__cape__">Quest Cape (all quests)</option>{questOpts.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
              {this.state.objType === "diary" && <select className="led" id="obj_diary" style={{ width: 240 }}>{diaryOpts.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
              {this.state.objType === "loot" && <select className="led" id="obj_boss" value={curBoss} onChange={(e) => this.setState({ objBoss: e.target.value })} style={{ width: 190 }}>{lootBosses.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
              {this.state.objType === "loot" && <select className="led" id="obj_drop" style={{ width: 190 }}>{lootDrops.map((n) => <option key={n} value={n}>{n}</option>)}</select>}
              <Btn tone="gold" onClick={this.addObjective}>Add</Btn>
            </div>
          </Card>
        )}
        {objViews.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 14, marginBottom: 18 }}>
            {objViews.map(({ o, v }) => {
              const kc = kindColor(v.kind);
              return (
                <Card key={o.id} pad={15} style={{ borderLeft: `4px solid ${kc}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div><Kicker color={kc}>{v.kind}</Kicker><div style={cinzel({ fontWeight: 700, fontSize: 16, color: C.ink, marginTop: 3 })}>{v.title}</div></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Tag color={v.done ? C.green : kc} bg={v.done ? "rgba(92,110,53,.16)" : "transparent"}>{v.eta}</Tag>
                      <span onClick={() => this.removeObjective(o.id)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 12 }) }}>✕</span>
                    </div>
                  </div>
                  <div style={serif({ fontSize: 12.5, color: C.muted, margin: "4px 0 9px" })}>{v.sub}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}><Bar pct={Math.max(2, v.pct)} c1={kc} c2={kc} h={7} /></div>
                    <span style={mono({ fontSize: 11, color: kc })}>{Math.round(v.pct)}%</span>
                  </div>
                  <div style={{ marginTop: 10, background: C.cardLight, border: "1px solid rgba(44,32,19,.1)", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={mono({ fontSize: 8.5, letterSpacing: ".16em", color: C.muted, textTransform: "uppercase", marginBottom: 3 })}>Suggested route</div>
                    <div style={serif({ fontSize: 13, color: C.ink, lineHeight: 1.4 })}>{v.route}</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <Kicker color={C.goldDeep} style={{ marginBottom: 8 }}>Skill goals · personal EHP</Kicker>
        {this.state.openForm === "goal" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="led" id="sg_skill" style={{ width: 150 }}>{addable.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              {this.field("sg_tgt", "Target lvl", { w: 90, def: 99 })}
              {this.field("sg_method", "Method", { w: 220 })}
              {this.field("sg_xphr", "XP/hr", { w: 100 })}
              {this.field("sg_gphr", "GP/hr (±)", { w: 110 })}
              <Btn tone="gold" onClick={this.addGoal}>Save</Btn>
            </div>
          </Card>
        )}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Skill", "Cur", "Tgt", "Method", "XP/hr", "Hours", "GP/hr", "Total", "Progress", ""].map((h, i) => (
                <th key={i} style={{ ...mono({ fontSize: 9, letterSpacing: ".1em", color: C.muted }), textAlign: i > 3 && i < 8 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>))}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.skill}>
                    <td style={{ ...cinzel({ fontWeight: 600, fontSize: 14 }), padding: "7px 9px" }}>{r.skill}</td>
                    <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px" }}>{r.cur}</td>
                    <td style={{ padding: "7px 9px" }}><input className="led" defaultValue={r.tgt} onBlur={(e) => this.setGoalField(r.skill, "tgt", e.target.value)} style={{ width: 52 }} /></td>
                    <td style={{ padding: "7px 9px" }}><input className="led" defaultValue={r.method} onBlur={(e) => this.setGoalField(r.skill, "method", e.target.value)} style={{ width: 200 }} /></td>
                    <td style={{ padding: "7px 9px", textAlign: "right" }}><input className="led" defaultValue={this.fmt(r.xpHr)} onBlur={(e) => this.setGoalField(r.skill, "xpHr", e.target.value)} style={{ width: 76, textAlign: "right" }} /></td>
                    <td style={{ ...mono({ fontSize: 12, color: C.muted2 }), padding: "7px 9px", textAlign: "right" }}>{r.hours}</td>
                    <td style={{ padding: "7px 9px", textAlign: "right" }}><input className="led" defaultValue={this.fmt(r.gpHr)} onBlur={(e) => this.setGoalField(r.skill, "gpHr", e.target.value)} style={{ width: 90, textAlign: "right" }} /></td>
                    <td style={{ ...mono({ fontSize: 12, color: r.total >= 0 ? C.green : C.red }), padding: "7px 9px", textAlign: "right" }}>{r.total === 0 ? "—" : this.signed(r.total)}</td>
                    <td style={{ padding: "7px 9px", width: 120 }}><Bar pct={r.bar} c1={r.xpLeft <= 0 ? C.green : C.gold} c2={r.xpLeft <= 0 ? C.green : C.goldBright} h={6} /></td>
                    <td style={{ padding: "7px 9px" }}><span onClick={() => this.removeGoal(r.skill)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 12 }) }}>✕</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <Kicker color={C.goldDeep}>Funding & timeline</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 }}>
            {[["Bank available", this.short(bank)], ["Cost to fund buyables", this.short(cost)], ["Flip profit / day", this.signed(flipPerDay)], ["Days flipping to fund", flipPerDay > 0 ? Math.ceil(shortfall / flipPerDay) : "—"]].map(([l, v], i) => (
              <div key={i}><Kicker>{l}</Kicker><div style={cinzel({ fontWeight: 700, fontSize: 18, marginTop: 5 })}>{v}</div></div>
            ))}
          </div>
          <div style={serif({ fontSize: 12, fontStyle: "italic", color: C.muted, marginTop: 10 })}>
            Combat hours are summed as if trained in isolation — a ceiling. Controlled style trains 3 melee stats at once, so real time is ~15–25% under the counted total.
          </div>
        </Card>
      </div>
    );
  }

  // ===================== NET WORTH =====================
  renderNetWorth() {
    const d = this.derive();
    const TH = themeFor("networth");
    const vals = d.nwSorted.map((s) => s.cash + s.items);
    const peak = Math.max(1, ...vals), min = vals.length ? Math.min(...vals) : 0;
    const n = vals.length;
    const W = 760, H = 232, padL = 62, padR = 18, padT = 18, padB = 34, iw = W - padL - padR, ih = H - padT - padB;
    const X = (i) => (n <= 1 ? padL + iw / 2 : padL + (i * iw) / (n - 1));
    const Y = (v) => padT + (1 - (v - min) / Math.max(1, peak - min)) * ih;
    const line = vals.map((v, i) => (i === 0 ? "M" : "L") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
    const area = n >= 2 ? "M" + X(0).toFixed(1) + "," + (padT + ih) + " " + vals.map((v, i) => "L" + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ") + " L" + X(n - 1).toFixed(1) + "," + (padT + ih) + " Z" : "";
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((tk) => { const val = min + tk * (peak - min); return { val, y: Y(val) }; });
    const xTickIdx = n <= 1 ? [0] : [...new Set(Array.from({ length: Math.min(6, n) }, (_, j) => Math.round((j * (n - 1)) / (Math.min(6, n) - 1))))];
    const rows = d.nwSorted.map((s, i) => { const v = s.cash + s.items; const prev = i > 0 ? vals[i - 1] : v; return { i: this.logs.nw.indexOf(s), date: this.dShort(s.date), total: this.short(v), cash: this.fmt(s.cash), items: this.fmt(s.items), note: s.note || "", delta: i > 0 ? this.signed(v - prev) : "—", dc: v - prev >= 0 ? C.green : C.red }; }).reverse();
    const lastDelta = vals.length > 1 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
    return (
      <div>
        <SectionTitle kicker="The Treasury" title="Net Worth" accent={TH.accent}
          right={<Btn tone="gold" onClick={() => this.toggleForm("nw")}>+ Log snapshot</Btn>} />
        <StatCards cols={4} items={[
          { label: "Net Worth", value: this.short(d.netWorth) },
          { label: "Δ vs last log", value: this.signed(lastDelta), color: lastDelta >= 0 ? C.green : C.red },
          { label: "Gained total", value: this.signed(d.netWorth - d.nwStart), color: d.netWorth - d.nwStart >= 0 ? C.green : C.red },
          { label: "Avg / day", value: this.short(d.gpDay) },
        ]} />
        {this.state.openForm === "nw" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {this.field("nw_date", "", { type: "date", def: this.today(), w: 150 })}
              {this.field("nw_cash", "Cash (gp)", { w: 140 })}
              {this.field("nw_bank", "Total bank value (gp)", { w: 190 })}
              {this.field("nw_note", "Note (optional)", { w: 200 })}
              <Btn tone="gold" onClick={this.addNw}>Save</Btn>
              <span style={serif({ fontSize: 12, fontStyle: "italic", color: C.muted, flexBasis: "100%" })}>Item/bank value is your total bank minus the cash you hold; net worth is the total. Pull the total from a bank-value plugin or the GE.</span>
            </div>
          </Card>
        )}
        <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
          <Kicker color={TH.accent}>Wealth curve</Kicker>
          {n >= 2 ? (
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 248, marginTop: 6 }}>
              <defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TH.accent} stopOpacity="0.32" /><stop offset="100%" stopColor={TH.accent} stopOpacity="0" /></linearGradient></defs>
              {yTicks.map((tk, i) => (
                <g key={i}>
                  <line x1={padL} y1={tk.y} x2={W - padR} y2={tk.y} stroke="rgba(44,32,19,.13)" strokeWidth="1" strokeDasharray={i === 0 ? "" : "3 3"} />
                  <text x={padL - 9} y={tk.y + 3.5} textAnchor="end" style={mono({ fontSize: 10, fill: C.muted })}>{this.short(tk.val)}</text>
                </g>
              ))}
              {xTickIdx.map((idx, i) => (
                <text key={i} x={X(idx)} y={H - 11} textAnchor="middle" style={mono({ fontSize: 10, fill: C.muted })}>{this.dShort(d.nwSorted[idx].date)}</text>
              ))}
              <path d={area} fill="url(#nwg)" />
              <path d={line} fill="none" stroke={TH.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {vals.map((v, i) => (<circle key={i} cx={X(i)} cy={Y(v)} r={i === n - 1 ? 4.5 : 2.4} fill={i === n - 1 ? C.goldBright : TH.accent} stroke="#f2e9d2" strokeWidth={i === n - 1 ? 2 : 1} />))}
              <text x={X(n - 1) - 6} y={Y(vals[n - 1]) - 10} textAnchor="end" style={cinzel({ fontSize: 13, fontWeight: 700, fill: C.ink })}>{this.short(vals[n - 1])}</text>
            </svg>
          ) : <div style={serif({ fontStyle: "italic", color: C.muted, padding: 20 })}>Log at least two snapshots and your wealth curve draws here.</div>}
        </Card>
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Date", "Total", "Cash", "Items", "Δ", "Note", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 0 && i < 5 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, k) => (
                <tr key={k}>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px" }}>{r.date}</td>
                  <td style={{ ...cinzel({ fontWeight: 600 }), padding: "7px 9px", textAlign: "right" }}>{r.total}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.cash}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.items}</td>
                  <td style={{ ...mono({ fontSize: 12, color: r.dc }), padding: "7px 9px", textAlign: "right" }}>{r.delta}</td>
                  <td style={{ ...serif({ fontSize: 13, fontStyle: r.note ? "italic" : "normal", color: C.muted }), padding: "7px 9px" }}>{r.note || "—"}</td>
                  <td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("nw", r.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ===================== FLIPPING =====================
  renderFlipping() {
    const view = this.state.flipView;
    const cfg = this.flipcfg, capPer = Math.floor(cfg.capital / 8);
    const fc = this.logs.flips.map((f) => this.computeFlip(f));
    const flipNetN = fc.reduce((a, f) => a + f.net, 0);
    const wins = fc.filter((f) => f.net > 0).length;
    const stats = [
      { label: "Realized P&L", value: this.signed(flipNetN), color: flipNetN >= 0 ? C.green : C.red },
      { label: "Flips logged", value: "" + fc.length },
      { label: "Win rate", value: fc.length ? Math.round((wins / fc.length) * 100) + "%" : "—" },
      { label: "Capital / flip", value: this.short(capPer), color: C.gold },
    ];
    return (
      <div>
        <SectionTitle kicker="Grand Exchange" title="Flipping Desk" accent={themeFor("flipping").accent} />
        <StatCards cols={4} items={stats} />
        <div style={{ marginBottom: 16 }}>
          <Seg options={[{ key: "scanner", label: "SCANNER" }, { key: "ledger", label: "LEDGER" }, { key: "perf", label: "PERFORMANCE" }, { key: "calc", label: "FILL CALC" }]} active={view} onPick={(v) => this.setState({ flipView: v, openForm: null })} />
        </div>
        {view === "scanner" && this.renderFlipScanner(cfg, capPer)}
        {view === "ledger" && this.renderFlipLedger(fc)}
        {view === "perf" && this.renderFlipPerf(fc)}
        {view === "calc" && this.renderFillCalc()}
      </div>
    );
  }
  renderFlipScanner(cfg, capPer) {
    const controls = [
      { key: "capital", label: "Flip capital", suffix: "gp", hint: "split across 8 GE slots" },
      { key: "minMargin", label: "Min margin %", suffix: "%", hint: "floor after the 2% tax" },
      { key: "maxMargin", label: "Max margin %", suffix: "%", hint: "ceiling — above is likely stale/manip" },
      { key: "minProfit4h", label: "Min profit / 4h", suffix: "gp", hint: "the 'worth a GE slot' bar" },
      { key: "minVolume", label: "Min daily volume", suffix: "", hint: "liquidity gate" },
      { key: "minBuy", label: "Min buy price", suffix: "gp", hint: "cuts penny junk" },
      { key: "maxAge", label: "Max price age", suffix: "min", hint: "freshness gate" },
    ];
    const rows = this.logs.scan.map((it, i) => {
      const tax = this.flipTax(it.sell, 1); const margin = it.buy > 0 ? ((it.sell - tax - it.buy) / it.buy) * 100 : 0;
      const qty = Math.min(it.limit || 1, Math.floor(capPer / Math.max(1, it.buy)));
      const profit4h = qty * (it.sell - tax - it.buy);
      const cMargin = margin >= cfg.minMargin && margin <= cfg.maxMargin, cVol = (it.vol || 0) >= cfg.minVolume, cAge = (it.age || 0) <= cfg.maxAge, cProfit = profit4h >= cfg.minProfit4h, cBuy = it.buy >= cfg.minBuy;
      const passN = [cMargin, cVol, cAge, cProfit, cBuy].filter(Boolean).length, all = passN === 5;
      return { i, name: it.name, buy: this.fmt(it.buy), sell: this.fmt(it.sell), margin: margin.toFixed(1) + "%", marginColor: cMargin ? C.green : C.red, vol: this.short(it.vol || 0), age: (it.age || 0) + "m", profit4h: this.short(profit4h), profit4hN: profit4h, verdict: all ? "FLIP NOW" : passN >= 3 ? "WATCH" : "SKIP", vColor: all ? C.green : passN >= 3 ? "#9a7530" : C.red, vBg: all ? "rgba(92,110,53,.18)" : passN >= 3 ? "rgba(201,162,74,.16)" : "rgba(150,58,44,.1)", rowBg: all ? "rgba(92,110,53,.07)" : "transparent" };
    }).sort((a, b) => b.profit4hN - a.profit4hN);
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Kicker color={C.goldDeep}>Control panel · tune what counts as worth-it</Kicker>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={this.refreshPrices}>⟳ Live prices</Btn>
              <Btn tone="quiet" onClick={() => this.toggleForm("scan")}>+ Item</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
            {controls.map((c) => (
              <div key={c.key} style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)", display: "flex", flexDirection: "column", minHeight: 108 }}>
                <Kicker style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</Kicker>
                <div style={{ position: "relative", marginTop: 6 }}>
                  <input className="led" defaultValue={this.fmt(cfg[c.key])} onBlur={(e) => this.setCfg("flipcfg", c.key, e.target.value)} style={{ width: "100%", fontWeight: 600, paddingRight: c.suffix ? 34 : 9 }} />
                  {c.suffix && <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", ...mono({ fontSize: 10, color: C.muted }) }}>{c.suffix}</span>}
                </div>
                <div style={serif({ fontSize: 11, fontStyle: "italic", color: C.muted, marginTop: 6, lineHeight: 1.3, flex: 1 })}>{c.hint}</div>
              </div>
            ))}
            <div style={{ background: "linear-gradient(160deg, rgba(201,162,74,.20), rgba(201,162,74,.04))", padding: "11px 13px", borderRadius: 6, border: "1px solid " + C.gold, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 108 }}>
              <Kicker color={C.goldDeep}>Capital / flip</Kicker>
              <div style={cinzel({ fontWeight: 800, fontSize: 23, color: C.ink, marginTop: 4 })}>{this.short(capPer)}</div>
              <div style={serif({ fontSize: 11, fontStyle: "italic", color: C.muted, marginTop: 3 })}>each of 8 GE slots</div>
            </div>
          </div>
          {this.state.priceStatus && <div style={{ marginTop: 10, ...mono({ fontSize: 11, color: C.muted2 }) }}>{this.state.priceStatus}</div>}
        </Card>
        {this.state.openForm === "scan" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {this.field("scan_name", "Item name", { w: 180 })}{this.field("scan_buy", "Buy (low)", { w: 100 })}{this.field("scan_sell", "Sell (high)", { w: 100 })}{this.field("scan_vol", "Daily vol", { w: 110 })}{this.field("scan_limit", "Buy limit", { w: 100 })}{this.field("scan_age", "Age (min)", { w: 90 })}
              <Btn tone="gold" onClick={this.addScan}>Add</Btn>
            </div>
          </Card>
        )}
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Item", "Buy", "Sell", "Margin", "Daily vol", "Age", "Profit / 4h", "Verdict", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 0 && i < 7 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.i} style={{ background: r.rowBg }}>
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 14 }), padding: "7px 9px" }}>{r.name}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.buy}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.sell}</td>
                  <td style={{ ...mono({ fontSize: 12, color: r.marginColor }), padding: "7px 9px", textAlign: "right" }}>{r.margin}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.vol}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.age}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.profit4h}</td>
                  <td style={{ padding: "7px 9px" }}><Tag color={r.vColor} bg={r.vBg}>{r.verdict}</Tag></td>
                  <td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("scan", r.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={serif({ fontSize: 12, fontStyle: "italic", color: C.muted, marginTop: 8 })}>FLIP NOW = clears every gate at your bankroll. Hit ⟳ Live prices to refresh buy/sell/volume from the OSRS Wiki.</div>
        </Card>
      </div>
    );
  }
  renderFlipLedger(fc) {
    const rows = fc.map((f, i) => ({ i, ...f }));
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker color={C.goldDeep}>Flip ledger · realized trades</Kicker>
            <Btn tone="gold" onClick={() => this.toggleForm("flip")}>+ Log a flip</Btn>
          </div>
          {this.state.openForm === "flip" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              {this.field("flip_item", "Item", { w: 170, list: "tradeItems", def: this.state.flipPrefill ? this.state.flipPrefill.item : "" })}
              <datalist id="tradeItems">{this.itemNames.map((n) => <option key={n} value={n} />)}</datalist>
              {this.field("flip_qty", "Qty", { w: 80, def: this.state.flipPrefill ? this.state.flipPrefill.qty : "" })}
              {this.field("flip_buy", "Avg buy", { w: 100, def: this.state.flipPrefill ? this.state.flipPrefill.avgBuy : "" })}
              {this.field("flip_sell", "Avg sell", { w: 100, def: this.state.flipPrefill ? this.state.flipPrefill.avgSell : "" })}
              {this.field("flip_bdate", "", { type: "date", def: this.today(), w: 140 })}
              {this.field("flip_sdate", "", { type: "date", def: this.today(), w: 140 })}
              {this.field("flip_notes", "Notes", { w: 160 })}
              <Btn tone="gold" onClick={this.addFlip}>Save</Btn>
            </div>
          )}
        </Card>
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Item", "Dates", "Qty", "Buy", "Sell", "Tax", "Net", "ROI", "GP/day", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 1 && i < 9 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.i}>
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 14 }), padding: "7px 9px" }}>{r.item}{r.notes ? <div style={serif({ fontSize: 11, fontStyle: "italic", color: C.muted })}>{r.notes}</div> : null}</td>
                  <td style={{ ...mono({ fontSize: 10, color: C.muted }), padding: "7px 9px" }}>{this.dShort(r.buyDate)}→{this.dShort(r.sellDate)}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.qty ? this.fmt(r.qty) : "—"}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.avgBuy ? this.fmt(r.avgBuy) : "—"}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.avgSell ? this.fmt(r.avgSell) : "—"}</td>
                  <td style={{ ...mono({ fontSize: 12, color: C.muted }), padding: "7px 9px", textAlign: "right" }}>{r.tax ? this.short(r.tax) : "—"}</td>
                  <td style={{ ...mono({ fontSize: 12, color: r.net >= 0 ? C.green : C.red }), padding: "7px 9px", textAlign: "right" }}>{this.signed(r.net)}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{(r.roi >= 0 ? "+" : "") + r.roi}%</td>
                  <td style={{ ...mono({ fontSize: 12, color: C.muted }), padding: "7px 9px", textAlign: "right" }}>{r.hold > 0 ? this.signed(r.gpday) : "—"}</td>
                  <td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("flips", r.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }
  renderFlipPerf(fc) {
    const perf = {};
    fc.forEach((f) => { if (!perf[f.item]) perf[f.item] = { item: f.item, flips: 0, net: 0, roiSum: 0, holdSum: 0, wins: 0 }; const p = perf[f.item]; p.flips++; p.net += f.net; p.roiSum += f.roi; p.holdSum += f.hold; if (f.net > 0) p.wins++; });
    const rows = Object.values(perf).map((p) => ({ ...p, roi: (p.roiSum / p.flips).toFixed(1) + "%", hold: (p.holdSum / p.flips).toFixed(1) + "d", win: Math.round((p.wins / p.flips) * 100) + "%" })).sort((a, b) => b.net - a.net);
    const wins = fc.filter((f) => f.net > 0).sort((a, b) => b.net - a.net).slice(0, 5);
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <Card>
          <Kicker color={C.goldDeep}>Performance by item</Kicker>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead><tr>{["Item", "Flips", "Net total", "Avg ROI", "Avg hold", "Win"].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 0 ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, k) => (
              <tr key={k}>
                <td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "6px 8px" }}>{r.item}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{r.flips}</td>
                <td style={{ ...mono({ fontSize: 12, color: r.net >= 0 ? C.green : C.red }), padding: "6px 8px", textAlign: "right" }}>{this.signed(r.net)}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{r.roi}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{r.hold}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{r.win}</td>
              </tr>
            ))}{rows.length === 0 && <tr><td colSpan={6} style={serif({ fontStyle: "italic", color: C.muted, padding: 16 })}>Log some flips to see performance.</td></tr>}</tbody>
          </table>
        </Card>
        <Card>
          <Kicker color={C.goldDeep}>Biggest wins</Kicker>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {wins.map((w, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: C.cardLight, borderRadius: 6 }}>
                <div><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{w.item}</div><div style={mono({ fontSize: 9, color: C.muted })}>{this.dShort(w.sellDate)}</div></div>
                <div style={{ textAlign: "right" }}><div style={mono({ fontSize: 13, color: C.green })}>{this.signed(w.net)}</div><div style={mono({ fontSize: 9, color: C.muted })}>{(w.roi >= 0 ? "+" : "") + w.roi}%</div></div>
              </div>
            ))}
            {wins.length === 0 && <div style={serif({ fontStyle: "italic", color: C.muted })}>No winning flips logged yet.</div>}
          </div>
        </Card>
      </div>
    );
  }
  renderFillCalc() {
    const r = this.state.fillResult;
    const col = (side, label, color) => (
      <div>
        <Kicker color={color}>{label} — qty × price</Kicker>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input className="led" id={`fill_${side}q${i}`} type="number" placeholder="qty" style={{ flex: 1, minWidth: 0 }} />
              <input className="led" id={`fill_${side}p${i}`} type="number" placeholder="price" style={{ flex: 1, minWidth: 0 }} />
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <div>
        <Card>
          <Kicker color={C.goldDeep}>Fill calculator · weighted-average a multi-fill flip</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 12 }}>
            {col("b", "Buy fills", C.green)}
            {col("s", "Sell fills", C.red)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 16 }}>
            <Btn tone="gold" onClick={this.calcFill}>Calculate</Btn>
            {r && (
              <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", background: C.cardLight, border: "1px solid rgba(44,32,19,.2)", borderRadius: 6, padding: "10px 16px" }}>
                {[["Qty", r.qty], ["Avg buy", r.avgBuy], ["Avg sell", r.avgSell]].map(([k, v]) => (
                  <div key={k}><div style={mono({ fontSize: 9, color: C.muted })}>{k.toUpperCase()}</div><div style={cinzel({ fontWeight: 700, fontSize: 18 })}>{this.fmt(v)}</div></div>
                ))}
                <Btn tone="gold" onClick={this.fillToLedger}>→ Send to Ledger</Btn>
                <Btn onClick={this.copyFill}>⎘ Copy</Btn>
              </div>
            )}
          </div>
          {this.state.fillMsg && <div style={{ marginTop: 10, ...mono({ fontSize: 11, color: C.muted2 }) }}>{this.state.fillMsg}</div>}
          <div style={serif({ fontSize: 12.5, fontStyle: "italic", color: C.muted, marginTop: 12 })}>Enter each partial fill as the price moved — the weighted <strong>Qty, Avg buy, Avg sell</strong> come out. Copy it (tab-separated, paste-ready) or send it straight to the Flip Ledger.</div>
        </Card>
      </div>
    );
  }

  // ===================== HIGH ALCHEMY =====================
  renderAlchemy() {
    const d = this.derive(); const aCost = this.alchCost(), cphr = this.alchcfg.castsPerHour || 1200;
    const rows = this.alchItems.map((a) => { const profit = a.alch - a.buy - aCost; const need2h = cphr * 2; const sustain = a.limit >= need2h && d.cash >= a.buy * need2h; return { item: a.item, alch: a.alch, buy: a.buy, profit, p4h: profit * a.limit, phr: profit * cphr, limit: a.limit, gpxp: (profit / 65).toFixed(2), sustain }; }).sort((a, b) => b.phr - a.phr);
    const best = rows.filter((r) => r.sustain && r.profit > 0)[0] || rows.filter((r) => r.profit > 0)[0] || rows[0];
    const log = this.logs.alch;
    const TH = themeFor("alchemy");
    const sess = { n: log.length, profit: log.reduce((a, x) => a + (x.net || 0), 0), xp: log.reduce((a, x) => a + (x.xp || 0), 0), casts: log.reduce((a, x) => a + (x.casts || 0), 0) };
    const setupCell = { background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" };
    return (
      <div>
        <SectionTitle kicker="Arcane Profit · Staff of Fire assumed" title="High Alchemy" accent={TH.accent}
          right={<div style={{ display: "flex", gap: 8 }}><Btn onClick={this.refreshPrices}>⟳ Live prices</Btn><Btn tone="gold" onClick={() => this.toggleForm("alch")}>+ Log session</Btn></div>} />
        {best && <Hero theme={TH} kicker="Verdict · best sustainable alch (2h+)" title={best.item}
          blurb={`+${best.profit} gp/cast · ${best.sustain ? "enough buy-limit & cash to sustain ≥2 hours" : "limited stock — tops out before 2h"}`}
          statLabel="Profit / hr" statValue={this.short(best.phr)} statSub={this.short(best.phr * 2) + " over 2h"} />}
        <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Kicker color={C.purple}>⚙ Setup</Kicker>
            <Btn tone="quiet" onClick={this.refreshNatRune}>⟳ Nat price (Wiki)</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            <div style={setupCell}><Kicker>Casts / hour</Kicker><input className="led" defaultValue={this.fmt(this.alchcfg.castsPerHour)} onBlur={(e) => this.setCfg("alchcfg", "castsPerHour", e.target.value)} style={{ width: "100%", marginTop: 6 }} /></div>
            <div style={setupCell}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Kicker>Nature rune</Kicker><Tag color={C.purple} bg="rgba(106,74,138,.14)">LIVE</Tag></div><div style={cinzel({ fontWeight: 700, fontSize: 19, marginTop: 6 })}>{this.fmt(this.alchcfg.natRune)} <span style={mono({ fontSize: 11, color: C.muted })}>gp</span></div><div style={serif({ fontSize: 10.5, fontStyle: "italic", color: C.muted, marginTop: 2 })}>OSRS Wiki · id 561</div></div>
            <div style={setupCell}><Kicker>Fire rune source</Kicker>
              <select className="led" defaultValue={this.alchcfg.fireSource} onChange={(e) => this.setCfg("alchcfg", "fireSource", e.target.value, { str: true })} style={{ width: "100%", marginTop: 6 }}><option value="staff">Fire staff (free)</option><option value="none">Buy fire runes</option></select></div>
            <div style={setupCell}><Kicker>Cost / cast</Kicker><div style={cinzel({ fontWeight: 700, fontSize: 19, marginTop: 6 })}>{this.fmt(aCost)} <span style={mono({ fontSize: 11, color: C.muted })}>gp</span></div></div>
          </div>
        </Card>
        <StatCards cols={4} items={[
          { label: "Sessions logged", value: "" + sess.n },
          { label: "Total profit", value: sess.n ? this.signed(sess.profit) : "—", color: sess.profit >= 0 ? C.green : C.red },
          { label: "Magic XP", value: sess.xp ? this.short(sess.xp) : "—" },
          { label: "Casts", value: sess.casts ? this.short(sess.casts) : "—" },
        ]} />
        {this.state.openForm === "alch" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {this.field("alch_item", "Item", { w: 170, list: "alchPool" })}<datalist id="alchPool">{this.alchItems.map((a) => <option key={a.item} value={a.item} />)}</datalist>
              {this.field("alch_casts", "Casts", { w: 100 })}{this.field("alch_alch", "Alch value", { w: 110 })}{this.field("alch_buy", "GE buy", { w: 100 })}
              <Btn tone="gold" onClick={this.addAlch}>Save</Btn>
            </div>
          </Card>
        )}
        <Card>
          <Kicker color={C.goldDeep}>Item profitability · live</Kicker>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <thead><tr>{["Item", "Alch", "GE buy", "Profit/cast", "Profit/hr", "Limit", "gp/xp", "Sustain"].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 0 && i < 7 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, k) => (
              <tr key={k} style={{ background: k === 0 ? "rgba(201,162,74,.12)" : "transparent" }}>
                <td style={{ ...cinzel({ fontWeight: 600, fontSize: 14 }), padding: "7px 9px" }}>{r.item}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.fmt(r.alch)}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.fmt(r.buy)}</td>
                <td style={{ ...mono({ fontSize: 12, color: r.profit >= 0 ? C.green : C.red }), padding: "7px 9px", textAlign: "right" }}>{r.profit >= 0 ? "+" : ""}{r.profit}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.short(r.phr)}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.fmt(r.limit)}</td>
                <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{r.gpxp}</td>
                <td style={{ padding: "7px 9px", textAlign: "right" }}><Tag color={r.sustain ? C.green : C.red} bg={r.sustain ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{r.sustain ? "2h+ ✓" : "limited"}</Tag></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
        {log.length > 0 && (
          <Card style={{ marginTop: 14 }}>
            <Kicker color={C.goldDeep}>Session log</Kicker>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr>{["Date", "Item", "Casts", "Net", "XP", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 1 && i < 5 ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{log.map((a, i) => (
                <tr key={i}><td style={{ ...mono({ fontSize: 11 }), padding: "6px 8px" }}>{this.dShort(a.date)}</td><td style={{ ...serif({ fontSize: 13 }), padding: "6px 8px" }}>{a.item}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{this.fmt(a.casts)}</td><td style={{ ...mono({ fontSize: 12, color: a.net >= 0 ? C.green : C.red }), padding: "6px 8px", textAlign: "right" }}>{this.signed(a.net)}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{this.short(a.xp)}</td><td style={{ padding: "6px 8px" }}><span onClick={() => this.delLog("alch", i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td></tr>
              ))}</tbody>
            </table>
          </Card>
        )}
      </div>
    );
  }

  // ===================== BOSSING =====================
  renderBossing() {
    const view = this.state.bossView;
    return (
      <div>
        <SectionTitle kicker="Command Centre · live drop pricing" title="Bossing Compendium" accent={themeFor("bossing").accent}
          right={<Seg options={[{ key: "compendium", label: "DATABASE" }, { key: "tracker", label: "TRACKER" }, { key: "focus", label: "FOCUS" }]} active={view} onPick={(v) => this.setState({ bossView: v, openForm: null })} />} />
        {view === "compendium" && this.renderBossDb()}
        {view === "tracker" && this.renderBossTracker()}
        {view === "focus" && this.renderBossFocus()}
      </div>
    );
  }
  renderBossDb() {
    const kc = {}; this.logs.boss.forEach((b) => (kc[b.boss] = (kc[b.boss] || 0) + (b.kills || 0)));
    const max = Math.max(1, ...D.bosses.map((b) => b.estGp));
    const base = D.bosses.slice().sort((a, b) => (this.bossEff(b).acc ? 1 : 0) - (this.bossEff(a).acc ? 1 : 0) || b.estGp - a.estGp).map((b) => {
      const e = this.bossEff(b);
      return { name: b.n, tier: b.tier, killsHr: e.kills > 0 ? e.kills + "/h" : "—", estGp: e.estGp > 0 ? this.short(e.estGp) + "/h" : "—", kc: kc[b.n] ? this.fmt(kc[b.n]) : "—", unique: b.unique, accLabel: e.acc ? "Open now" : "Gated", accColor: e.acc ? C.green : C.red, accBg: e.acc ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)", gpN: e.estGp, kcN: kc[b.n] || 0, accN: e.acc ? 1 : 0, gpBar: Math.min(100, (e.estGp / max) * 100), b };
    });
    const tiers = Array.from(new Set(D.bosses.map((b) => b.tier).filter(Boolean)));
    const model = this.buildTable("boss", base, [
      { key: "name", label: "BOSS", filter: "text", fval: (r) => r.name, sval: (r) => r.name },
      { key: "tier", label: "TIER", filter: "enum", options: tiers.map((t) => ({ v: t, label: t })), fval: (r) => r.tier, sval: (r) => r.tier },
      { key: "estGp", label: "EST GP/HR", sval: (r) => r.gpN },
      { key: "killsHr", label: "KILLS/HR", align: "right", sval: (r) => r.b.kills },
      { key: "kc", label: "KC", align: "right", sval: (r) => r.kcN },
      { key: "unique", label: "HEADLINE UNIQUE", filter: "text", fval: (r) => r.unique, sval: (r) => r.unique },
      { key: "access", label: "ACCESS", align: "right", filter: "enum", options: [{ v: "1", label: "Open now" }, { v: "0", label: "Gated" }], fval: (r) => r.accN, sval: (r) => r.accN },
    ]);
    const cols = [
      { key: "name", cell: (r) => <span style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.name}</span> },
      { key: "tier", cell: (r) => <Tag>{r.tier}</Tag> },
      { key: "estGp", cell: (r) => <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 120 }}><span style={mono({ fontSize: 12, color: C.gold })}>{r.estGp}</span><Bar pct={r.gpBar} h={4} /></span> },
      { key: "killsHr", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.killsHr}</span> },
      { key: "kc", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.kc}</span> },
      { key: "unique", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted2 })}>{r.unique}</span> },
      { key: "access", align: "right", cell: (r) => <Tag color={r.accColor} bg={r.accBg}>{r.accLabel}</Tag> },
    ];
    return (
      <div>
        <Card style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={serif({ fontSize: 13, fontStyle: "italic", color: C.muted })}>Est GP/hr = base loot + your kills/hr × live rare-drop value. "Open now" = your combat ({this.account.combat}) & Slayer clear the gate. Edit any boss's kills/hr & GP/hr below to dial in your real session rates.</div>
            <Btn onClick={this.refreshDropPrices}>⟳ Price drops</Btn>
          </div>
          {this.state.priceStatus && <div style={{ marginTop: 8, ...mono({ fontSize: 11, color: C.muted2 }) }}>{this.state.priceStatus}</div>}
        </Card>
        <Card style={{ marginBottom: 14 }}><DataTable tableKey="boss" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} empty="No bosses match." /></Card>
        <Card>
          <Kicker color={C.goldDeep}>Dial in your session rates (saved locally)</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10, marginTop: 12 }}>
            {base.map((r) => { const e = this.bossEff(r.b); const ov = this.bossOv[r.name]; return (
              <div key={r.name} style={{ background: C.cardLight, padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={cinzel({ fontWeight: 600, fontSize: 13 })}>{r.name}</span>
                  {ov ? <span onClick={() => this.resetBossOv(r.name)} style={{ cursor: "pointer", ...mono({ fontSize: 9, color: C.red }) }}>reset</span> : <Tag color={r.accColor} bg={r.accBg}>{r.accLabel}</Tag>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <label style={{ flex: 1 }}><span style={mono({ fontSize: 8.5, color: C.muted })}>KILLS/HR</span><input className="led" defaultValue={e.kills} key={"k" + (ov ? 1 : 0)} onBlur={(ev) => this.setBossOv(r.name, "kills", ev.target.value)} style={{ width: "100%" }} /></label>
                  <label style={{ flex: 1.3 }}><span style={mono({ fontSize: 8.5, color: C.muted })}>GP/HR</span><input className="led" defaultValue={e.estGp} key={"g" + (ov ? 1 : 0)} onBlur={(ev) => this.setBossOv(r.name, "gpHr", ev.target.value)} style={{ width: "100%" }} /></label>
                </div>
              </div>
            ); })}
          </div>
        </Card>
      </div>
    );
  }
  renderBossTracker() {
    const log = this.logs.boss;
    const opts = D.bosses.map((b) => b.n);
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker color={C.goldDeep}>Kill-count log</Kicker>
            <Btn tone="gold" onClick={() => this.toggleForm("boss")}>+ Log kills</Btn>
          </div>
          {this.state.openForm === "boss" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <select className="led" id="boss_name" style={{ width: 200 }}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              {this.field("boss_kills", "Kills", { w: 100 })}{this.field("boss_note", "Note", { w: 200 })}
              <Btn tone="gold" onClick={this.addBoss}>Save</Btn>
            </div>
          )}
        </Card>
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Date", "Boss", "Kills", "Note", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i === 2 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{log.map((b, i) => (
              <tr key={i}><td style={{ ...mono({ fontSize: 11 }), padding: "7px 9px" }}>{this.dShort(b.date)}</td><td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "7px 9px" }}>{b.boss}</td><td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.fmt(b.kills)}</td><td style={{ ...serif({ fontSize: 13, color: C.muted }), padding: "7px 9px" }}>{b.note || "—"}</td><td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("boss", i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td></tr>
            ))}{log.length === 0 && <tr><td colSpan={5} style={serif({ fontStyle: "italic", color: C.muted, padding: 16 })}>No kills logged. Track KC here and the Focus tab computes your drop-rate luck.</td></tr>}</tbody>
          </table>
        </Card>
      </div>
    );
  }
  renderBossFocus() {
    const opts = D.bosses.map((b) => b.n);
    const name = this.state.bossFocus || opts[0];
    const b = D.bosses.find((x) => x.n === name) || D.bosses[0];
    const e = this.bossEff(b);
    const killKc = this.logs.boss.filter((x) => x.boss === name).reduce((a, x) => a + (x.kills || 0), 0);
    // A drop logged "at KC N" implies at least N kills, so fold that in — else a
    // 1-KC pet would read as 0 KC and the verdict would never leave "on rate".
    const dropKc = Math.max(0, ...this.logs.drop.filter((dd) => dd.boss === name).map((dd) => dd.kc || 0));
    const kc = Math.max(killKc, dropKc);
    const drops = this.bossDrops[name] || [];
    const dropCount = {}; this.logs.drop.forEach((dd) => { if (dd.boss === name) dropCount[dd.drop] = (dropCount[dd.drop] || 0) + 1; });
    let luck = 0;
    const dropRows = drops.map((dr) => { const exp = kc / dr.rate; const got = dropCount[dr.n] || 0; luck += got * dr.v; const v = this.luckVerdict(kc, dr.rate, got); return { name: dr.n, rate: "1/" + this.fmt(dr.rate), exp: exp >= 1 ? exp.toFixed(2) : exp > 0 ? exp.toPrecision(2) : "0", got, verdict: v.t, vc: v.c, value: dr.v > 0 ? this.short(dr.v) : "pet" }; });
    // gear recs from GEAR_DATA
    const keys = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
    const recs = []; const seen = {};
    ["melee", "ranged", "magic"].forEach((st) => (GEAR_DATA[st] || []).forEach((s) => s.items.forEach((it) => { const hay = ((it.bestFor || "") + " " + (it.get || "")).toLowerCase(); if (keys.length && keys.some((k) => hay.indexOf(k) >= 0) && !seen[it.n]) { seen[it.n] = 1; const price = this.gearPrices[it.n] != null ? this.gearPrices[it.n] : it.gp; recs.push({ style: st, slot: s.slot, n: it.n, req: it.req, price: price > 0 ? this.short(price) : "obtain", c: st === "melee" ? C.red : st === "ranged" ? C.green : C.purple }); } })));
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Kicker color={C.goldDeep}>Focus boss</Kicker>
            <select className="led" value={name} onChange={(ev) => this.setState({ bossFocus: ev.target.value })} style={{ width: 240 }}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={cinzel({ fontWeight: 700, fontSize: 22 })}>{b.n}</div>
            <div style={mono({ fontSize: 11, color: C.muted, marginTop: 2 })}>{b.tier} · {b.style}</div>
            <div style={serif({ fontSize: 14, color: C.ink, marginTop: 10 })}>{this.bossWhy[b.n] || (e.estGp > 0 ? this.short(e.estGp) + "/h · " + b.unique : b.unique)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              {[["GP/hr", e.estGp > 0 ? this.short(e.estGp) : "—"], ["Kills/hr", e.kills > 0 ? e.kills : "—"], ["Your KC", this.fmt(kc)], ["Combat req", "Cb " + b.minCb], ["Slayer", b.slay > 0 ? b.slay : "none"], ["Loot value", this.short(luck)]].map(([l, v], i) => (
                <div key={i}><Kicker>{l}</Kicker><div style={cinzel({ fontWeight: 700, fontSize: 16, marginTop: 4 })}>{v}</div></div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}><Kicker>Requirements</Kicker><div style={serif({ fontSize: 13, color: C.muted2, marginTop: 4 })}>{b.req} · gear: {b.gear}</div></div>
          </Card>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Kicker color={C.goldDeep}>Drop-rate luck (KC {this.fmt(kc)})</Kicker>
              <Btn tone="quiet" onClick={() => this.toggleForm("drop")}>+ Got a drop</Btn>
            </div>
            {this.state.openForm === "drop" && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                <input className="led" id="drop_boss" defaultValue={name} style={{ width: 140 }} />
                {drops.length ? <select className="led" id="drop_name" style={{ width: 150 }}>{drops.map((dd) => <option key={dd.n} value={dd.n}>{dd.n}</option>)}</select> : this.field("drop_name", "Drop", { w: 150 })}
                {this.field("drop_kc", "At KC", { w: 90 })}<Btn tone="gold" onClick={this.addDrop}>Save</Btn>
              </div>
            )}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead><tr>{["Unique", "Rate", "Expected", "Got", "Value", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 0 && i < 5 ? "right" : "left", padding: "6px 7px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{dropRows.map((r, k) => (
                <tr key={k}><td style={{ ...serif({ fontSize: 13 }), padding: "6px 7px" }}>{r.name}</td><td style={{ ...mono({ fontSize: 11 }), padding: "6px 7px", textAlign: "right" }}>{r.rate}</td><td style={{ ...mono({ fontSize: 11 }), padding: "6px 7px", textAlign: "right" }}>{r.exp}</td><td style={{ ...mono({ fontSize: 12, color: r.vc }), padding: "6px 7px", textAlign: "right" }}>{r.got}</td><td style={{ ...mono({ fontSize: 11 }), padding: "6px 7px", textAlign: "right" }}>{r.value}</td><td style={{ padding: "6px 7px" }}><Tag color={r.vc} bg="transparent">{r.verdict}</Tag></td></tr>
              ))}{drops.length === 0 && <tr><td colSpan={6} style={serif({ fontStyle: "italic", color: C.muted, padding: 14 })}>No drop table tracked for this boss.</td></tr>}</tbody>
            </table>
          </Card>
        </div>
        {recs.length > 0 && (
          <Card style={{ marginTop: 14 }}>
            <Kicker color={C.goldDeep}>Suggested gear for {b.n}</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 10, marginTop: 10 }}>
              {recs.slice(0, 8).map((r, i) => (
                <div key={i} style={{ background: C.cardLight, padding: "9px 11px", borderRadius: 6, borderLeft: "3px solid " + r.c }}>
                  <div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{r.n}</div>
                  <div style={mono({ fontSize: 9.5, color: C.muted })}>{r.slot} · {r.req}</div>
                  <div style={mono({ fontSize: 11, color: r.c, marginTop: 3 })}>{r.price}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ===================== SLAYER =====================
  renderSlayer() {
    const view = this.state.slayView;
    const slayLvl = (this.skillMap.Slayer || { l: 1 }).l;
    const w = this.slayWeighted();
    return (
      <div>
        <SectionTitle kicker={"The Slayer · " + (this.mode === "iron" ? "Ironman lens (keep resources)" : "Main lens (sell drops)")} title="Task Planner" accent={themeFor("slayer").accent}
          right={<Seg options={[{ key: "planner", label: "BLOCK CALC" }, { key: "monsters", label: "MONSTER DB" }, { key: "log", label: "LOG" }]} active={view} onPick={(v) => this.setState({ slayView: v, openForm: null })} />} />
        <StatCards cols={4} items={[
          { label: "Weighted XP/hr (after blocks)", value: this.short(w.xp) },
          { label: "Weighted loot/hr", value: this.short(w.gp) },
          { label: "Tasks blocked", value: w.blocked + " / 8" },
          { label: "Your Slayer level", value: "" + slayLvl },
        ]} />
        {view === "planner" && this.renderSlayPlanner(slayLvl)}
        {view === "monsters" && this.renderSlayMonsters(slayLvl)}
        {view === "log" && this.renderSlayLog()}
      </div>
    );
  }
  renderSlayPlanner(slayLvl) {
    const max = Math.max(1, ...D.slayer.map((t) => t.ev));
    const base = D.slayer.slice().sort((a, b) => b.ev - a.ev).map((tk) => ({ task: tk.task, slay: "L" + tk.slay, xpHr: this.short(tk.xpHr) + "/h", gpHr: this.short(tk.gpHr) + "/h", ev: this.short(tk.ev) + "/h", weight: tk.weight || 0, slayN: tk.slay, wtN: tk.weight || 0, xpN: tk.xpHr, gpN: tk.gpHr, evN: tk.ev, blocked: !!this.blocks[tk.task], blkN: this.blocks[tk.task] ? 1 : 0, evBar: Math.min(100, (tk.ev / max) * 100), rowBg: this.blocks[tk.task] ? "rgba(150,58,44,.05)" : "transparent" }));
    const model = this.buildTable("slayTask", base, [
      { key: "task", label: "TASK", filter: "text", fval: (r) => r.task, sval: (r) => r.task },
      { key: "slay", label: "SLAY", align: "right", sval: (r) => r.slayN },
      { key: "weight", label: "WT", align: "right", sval: (r) => r.wtN },
      { key: "xpHr", label: "XP/HR", align: "right", sval: (r) => r.xpN },
      { key: "gpHr", label: "LOOT/HR", align: "right", sval: (r) => r.gpN },
      { key: "ev", label: "EV/HR", sval: (r) => r.evN },
      { key: "blk", label: "BLOCK?", align: "right", filter: "enum", options: [{ v: "1", label: "Blocked" }, { v: "0", label: "Active" }], fval: (r) => r.blkN, sval: (r) => r.blkN },
    ]);
    const cols = [
      { key: "task", cell: (r) => <span style={cinzel({ fontWeight: 600, fontSize: 14, color: r.blocked ? C.muted : C.ink })}>{r.task}</span> },
      { key: "slay", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.slay}</span> },
      { key: "weight", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.weight}</span> },
      { key: "xpHr", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.xpHr}</span> },
      { key: "gpHr", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.gpHr}</span> },
      { key: "ev", cell: (r) => <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 110 }}><span style={mono({ fontSize: 12, color: C.gold })}>{r.ev}</span><Bar pct={r.evBar} h={4} /></span> },
      { key: "blk", align: "right", cell: (r) => <span onClick={() => this.toggleBlock(r.task)} style={{ cursor: "pointer" }}><Tag color={r.blocked ? C.red : C.green} bg={r.blocked ? "rgba(150,58,44,.16)" : "rgba(92,110,53,.12)"}>{r.blocked ? "BLOCKED" : "active"}</Tag></span> },
    ];
    const masters = this.mastersRaw.map((m) => ({ ...m, avail: this.account.combat >= m.cb }));
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={serif({ fontSize: 13, fontStyle: "italic", color: C.muted, marginBottom: 10 })}>Click a row's BLOCK toggle to remove it from your assignment pool — weighted XP/hr & loot/hr above recompute instantly (you get 6 block slots at Duradel).</div>
          <DataTable tableKey="slayTask" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} />
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <Kicker color={C.goldDeep}>Master progression</Kicker>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <thead><tr>{["Master", "Cb", "Best for", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i === 3 ? "right" : "left", padding: "6px 7px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{masters.map((m, i) => (
                <tr key={i} style={{ background: m.name.indexOf("Chaeldar") === 0 ? "rgba(201,162,74,.12)" : "transparent" }}>
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "6px 7px" }}>{m.name}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 7px" }}>{m.cb}</td><td style={{ ...serif({ fontSize: 12.5, color: C.muted }), padding: "6px 7px" }}>{m.best}</td>
                  <td style={{ padding: "6px 7px", textAlign: "right" }}><Tag color={m.avail ? C.green : C.red} bg={m.avail ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{m.avail ? "Usable" : "Locked"}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
          <Card>
            <Kicker color={C.goldDeep}>Point-unlock priorities</Kicker>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {this.slayUnlocks.slice().sort((a, b) => a.pri - b.pri).map((u, i) => (
                <div key={i} style={{ padding: "8px 10px", background: u.pri === 1 ? "rgba(201,162,74,.12)" : C.cardLight, borderRadius: 6, borderLeft: "3px solid " + (u.pri === 1 ? C.gold : "rgba(44,32,19,.2)") }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={cinzel({ fontWeight: 600, fontSize: 13 })}>{u.name}</span><span style={mono({ fontSize: 11, color: C.muted })}>{u.cost > 0 ? this.fmt(u.cost) + " pts" : "quest"}</span></div>
                  <div style={serif({ fontSize: 12, color: C.muted, marginTop: 2 })}>{u.why}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }
  renderSlayMonsters(slayLvl) {
    const base = D.slayer.slice().sort((a, b) => a.slay - b.slay).map((tk) => { const info = this.slayInfo[tk.task] || { loc: "—", drops: "—" }; const can = tk.slay <= slayLvl; return { task: tk.task, slay: "Lv " + tk.slay, xpHr: this.short(tk.xpHr) + "/h", loc: info.loc, drops: info.drops, slayN: tk.slay, xpN: tk.xpHr, canN: can ? 1 : 0, can }; });
    const model = this.buildTable("slayMon", base, [
      { key: "task", label: "MONSTER", filter: "text", fval: (r) => r.task, sval: (r) => r.task },
      { key: "slay", label: "SLAY REQ", align: "right", sval: (r) => r.slayN },
      { key: "xpHr", label: "XP/HR", align: "right", sval: (r) => r.xpN },
      { key: "loc", label: "LOCATION", filter: "text", fval: (r) => r.loc, sval: (r) => r.loc },
      { key: "drops", label: "KEY DROPS", filter: "text", fval: (r) => r.drops, sval: (r) => r.drops },
      { key: "can", label: "CAN I?", align: "right", filter: "enum", options: [{ v: "1", label: "Can do" }, { v: "0", label: "Locked" }], fval: (r) => r.canN, sval: (r) => r.canN },
    ]);
    const cols = [
      { key: "task", cell: (r) => <span style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.task}</span> },
      { key: "slay", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.slay}</span> },
      { key: "xpHr", align: "right", cell: (r) => <span style={mono({ fontSize: 12 })}>{r.xpHr}</span> },
      { key: "loc", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted2 })}>{r.loc}</span> },
      { key: "drops", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted })}>{r.drops}</span> },
      { key: "can", align: "right", cell: (r) => <Tag color={r.can ? C.green : C.red} bg={r.can ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.1)"}>{r.can ? "YES" : "no"}</Tag> },
    ];
    return <Card><DataTable tableKey="slayMon" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} /></Card>;
  }
  renderSlayLog() {
    const log = this.logs.slayerLog; const opts = D.slayer.map((t) => t.task);
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker color={C.goldDeep}>Task log</Kicker><Btn tone="gold" onClick={() => this.toggleForm("slay")}>+ Log task</Btn>
          </div>
          {this.state.openForm === "slay" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <select className="led" id="slay_task" style={{ width: 180 }}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              {this.field("slay_xp", "XP gained", { w: 110 })}{this.field("slay_gp", "Loot gp", { w: 110 })}<Btn tone="gold" onClick={this.addSlay}>Save</Btn>
            </div>
          )}
        </Card>
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Date", "Task", "XP", "Loot", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 1 && i < 4 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{log.map((s, i) => (
              <tr key={i}><td style={{ ...mono({ fontSize: 11 }), padding: "7px 9px" }}>{this.dShort(s.date)}</td><td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "7px 9px" }}>{s.task}</td><td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.short(s.xp || 0)}</td><td style={{ ...mono({ fontSize: 12, color: C.green }), padding: "7px 9px", textAlign: "right" }}>{this.signed(s.gp || 0)}</td><td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("slayerLog", i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td></tr>
            ))}{log.length === 0 && <tr><td colSpan={5} style={serif({ fontStyle: "italic", color: C.muted, padding: 16 })}>No tasks logged yet.</td></tr>}</tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ===================== GEAR =====================
  renderGear() {
    const style = this.state.gearStyle, mode = this.mode;
    const sm = this.skillMap; const lvlOf = (n) => (sm[n] || { l: 1 }).l;
    const gsLvl = { att: lvlOf("Attack"), str: lvlOf("Strength"), def: lvlOf("Defence"), range: lvlOf("Ranged"), mage: lvlOf("Magic"), pray: lvlOf("Prayer"), none: 99 };
    const slots = (GEAR_DATA[style] || []).map((s) => {
      const items = s.items.filter((it) => { const m = it.mode || "both"; return m === "both" || m === mode; }).map((it) => { const price = this.gearPrices[it.n] != null ? this.gearPrices[it.n] : it.gp; const usable = (it.lvl || 1) <= (gsLvl[it.gs || "none"] || 99); return { ...it, price, usable }; });
      let curName = ""; for (let i = items.length - 1; i >= 0; i--) if (items[i].usable) { curName = items[i].n; break; }
      return { slot: s.slot, items: items.map((m) => ({ ...m, current: m.n === curName })) };
    });
    return (
      <div>
        <SectionTitle kicker={"The Armoury · " + (mode === "iron" ? "Ironman (obtain paths)" : "Main (GE prices)")} title="Gear Progression" accent={themeFor("gear").accent}
          right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><Seg options={[{ key: "melee", label: "MELEE" }, { key: "ranged", label: "RANGED" }, { key: "magic", label: "MAGIC" }]} active={style} onPick={(v) => this.setState({ gearStyle: v })} /><Btn onClick={this.refreshGearPrices}>⟳ Prices</Btn></div>} />
        {this.state.gearPriceStatus && <div style={{ marginBottom: 10, ...mono({ fontSize: 11, color: C.muted2 }) }}>{this.state.gearPriceStatus}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {slots.map((s) => (
            <Card key={s.slot}>
              <Kicker color={C.goldDeep}>{s.slot}</Kicker>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
                {s.items.map((it, i) => (
                  <div key={i} style={{ background: it.current ? "rgba(201,162,74,.2)" : it.usable ? C.cardLight : "#ece1c6", border: it.current ? "2px solid " + C.gold : it.usable ? "1px solid rgba(44,32,19,.18)" : "1px dashed rgba(44,32,19,.28)", borderRadius: 6, padding: "9px 11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={cinzel({ fontWeight: 600, fontSize: 13.5, color: it.usable ? C.ink : "#9a8a6a" })}>{it.n}</span>
                      {it.current && <Tag color={C.ink} bg="rgba(201,162,74,.3)">EQUIP</Tag>}
                    </div>
                    <div style={mono({ fontSize: 9.5, color: C.muted, marginTop: 3 })}>{it.req}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                      <span style={mono({ fontSize: 11, color: it.price > 0 ? C.gold : C.muted })}>{it.price > 0 ? this.short(it.price) + " gp" : "untradeable"}</span>
                      {mode === "iron" && it.get && <span style={serif({ fontSize: 10.5, fontStyle: "italic", color: C.muted, textAlign: "right", maxWidth: 130 })}>{it.get}</span>}
                    </div>
                    {it.bestFor && <div style={serif({ fontSize: 11, color: C.muted2, marginTop: 4 })}>{it.bestFor}</div>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ===================== FARMING =====================
  renderFarming() {
    const sm = this.skillMap; const farmLvl = (sm.Farming || { l: 1 }).l, farmXp = (sm.Farming || { x: 0 }).x;
    const goal = (this.goals.find((g) => g.skill === "Farming") || { tgt: 85 }).tgt;
    const runMax = Math.max(1, ...this.farmRunDefs.map((r) => r.xpRun));
    const runRows = this.farmRunDefs.map((r) => ({ ...r, unlocked: r.req <= farmLvl, bar: Math.min(100, (r.xpRun / runMax) * 100) }));
    const unlocked = this.farmRunDefs.filter((r) => r.req <= farmLvl);
    const xpCircuit = unlocked.reduce((a, r) => a + r.xpRun, 0);
    const laps = this.farmcfg.lapsPerDay || 1;
    const xpDay = xpCircuit * laps;
    const xpLeft = Math.max(0, this.xpFor(goal) - farmXp);
    const days = xpDay > 0 ? Math.ceil(xpLeft / xpDay) : 0;
    const agg = {}; this.logs.herb.forEach((h) => { if (!agg[h.tier]) agg[h.tier] = { runs: 0, net: 0 }; agg[h.tier].runs += h.runs || 1; agg[h.tier].net += h.net; });
    const TH = themeFor("farming");
    const bestFarm = this.farmDefs.filter((f) => f.unlocked).slice().sort((a, b) => b.net - a.net)[0] || this.farmDefs[0];
    const loggedNet = this.logs.herb.reduce((a, h) => a + h.net, 0), loggedRuns = this.logs.herb.reduce((a, h) => a + (h.runs || 1), 0);
    return (
      <div>
        <SectionTitle kicker="The Allotments · grow-time, not play-time" title="Farming Engine" accent={TH.accent}
          right={<Btn tone="gold" onClick={() => this.toggleForm("herb")}>+ Log herb run</Btn>} />
        {bestFarm && <Hero theme={TH} kicker="Herb-run verdict · best this account can grow" title={`Plant ${bestFarm.tier}`}
          blurb={`${this.short(bestFarm.net)} net per run at your current Farming level — ${days > 0 ? days + " days to Farming " + goal : "goal reached"}`}
          statLabel="Logged net" statValue={loggedRuns ? this.signed(loggedNet) : "—"} statSub={loggedRuns ? loggedRuns + " runs" : "no runs yet"} />}
        <StatCards cols={4} items={[
          { label: "XP to Farming " + goal, value: this.short(xpLeft) },
          { label: "XP / circuit", value: this.short(xpCircuit) },
          { label: "XP / day", value: this.short(xpDay), sub: laps + " laps/day" },
          { label: "Days to target", value: days > 0 ? "" + days : "—", color: C.green },
        ]} />
        {this.state.openForm === "herb" && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select className="led" id="herb_tier" style={{ width: 150 }}>{this.farmDefs.map((f) => <option key={f.tier} value={f.tier}>{f.tier}</option>)}</select>
              {this.field("herb_runs", "Runs", { w: 80, def: 1 })}{this.field("herb_net", "Net override (gp)", { w: 150 })}<Btn tone="gold" onClick={this.addHerb}>Save</Btn>
            </div>
          </Card>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
          <span style={mono({ fontSize: 11, color: C.muted2 })}>LAPS PER DAY</span>
          <input className="led" defaultValue={laps} onBlur={(e) => this.setCfg("farmcfg", "lapsPerDay", e.target.value)} style={{ width: 70 }} />
          <span style={serif({ fontSize: 12, fontStyle: "italic", color: C.muted })}>Estimate assumes your current best unlocked runs the whole way — it drops as you unlock higher tiers.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          <Card>
            <Kicker color={C.goldDeep}>Daily run circuit · XP engine</Kicker>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
              <thead><tr>{["Run", "Crop", "XP/run", "GP/run", "Time", "Status"].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 1 && i < 5 ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
              <tbody>{runRows.map((r, k) => (
                <tr key={k}>
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "6px 8px" }}>{r.name}</td>
                  <td style={{ ...serif({ fontSize: 13 }), padding: "6px 8px" }}>{r.crop}</td>
                  <td style={{ padding: "6px 8px", textAlign: "right" }}><div style={mono({ fontSize: 12 })}>{this.fmt(r.xpRun)}</div><Bar pct={r.bar} h={3} /></td>
                  <td style={{ ...mono({ fontSize: 12, color: r.gpRun >= 0 ? C.green : C.red }), padding: "6px 8px", textAlign: "right" }}>{r.gpRun >= 0 ? "+" + this.short(r.gpRun) : this.signed(r.gpRun)}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{r.timeMin}m</td>
                  <td style={{ padding: "6px 8px" }}><Tag color={r.unlocked ? C.green : C.red} bg={r.unlocked ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{r.unlocked ? "open" : "lvl " + r.req}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
          <Card>
            <Kicker color={C.goldDeep}>Milestones</Kicker>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {this.farmMilestones.map((m, i) => { const done = m.lvl <= farmLvl; return (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", marginTop: 5, background: done ? C.green : m.lvl === goal ? C.purple : "#c2a877" }} />
                  <div style={{ flex: 1 }}><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>Lvl {m.lvl} {m.tag && <Tag color={m.tag === "GOAL" ? C.purple : C.green} bg="transparent">{m.tag}</Tag>}</div><div style={serif({ fontSize: 12, color: C.muted })}>{m.label}</div></div>
                </div>
              ); })}
            </div>
          </Card>
        </div>
        <Card style={{ marginTop: 14 }}>
          <Kicker color={C.goldDeep}>Herb-run P&L · {this.short(this.logs.herb.reduce((a, h) => a + h.net, 0))} logged over {this.logs.herb.reduce((a, h) => a + (h.runs || 1), 0)} runs</Kicker>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead><tr>{["Tier", "Plant lvl", "Net/run", "Runs logged", "Total net", "Status"].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i > 1 && i < 5 ? "right" : "left", padding: "6px 8px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{this.farmDefs.map((f, k) => { const a = agg[f.tier] || { runs: 0, net: 0 }; return (
              <tr key={k} style={{ background: f.tier === "Snapdragon" ? "rgba(201,162,74,.1)" : "transparent" }}>
                <td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "6px 8px" }}>{f.tier}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px" }}>Lv {f.lvl}</td><td style={{ ...mono({ fontSize: 12, color: C.green }), padding: "6px 8px", textAlign: "right" }}>{this.short(f.net)}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{a.runs}</td><td style={{ ...mono({ fontSize: 12 }), padding: "6px 8px", textAlign: "right" }}>{a.net > 0 ? this.short(a.net) : "—"}</td>
                <td style={{ padding: "6px 8px" }}><Tag color={f.unlocked ? C.green : C.red} bg={f.unlocked ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{f.unlocked ? "unlocked" : "locked"}</Tag></td>
              </tr>
            ); })}</tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ===================== QUESTS =====================
  renderQuests() {
    const d = this.derive();
    const method = this.state.questMethod;
    const allQ = D.quests.map((q) => ({ ...q, st: this.qStatus(q) }));
    const byName = {}; allQ.forEach((q) => (byName[q.n] = q));
    const QO = QUEST_ORDER;
    let ord;
    if (method === "series") { const oi = {}; (QO.optimal || []).forEach((n, i) => (oi[n] = i)); ord = allQ.map((q) => q.n).slice().sort((a, b) => (byName[a].series || "").localeCompare(byName[b].series || "") || ((oi[a] == null ? 9999 : oi[a]) - (oi[b] == null ? 9999 : oi[b]))); }
    else ord = (QO[method] || QO.optimal || allQ.map((q) => q.n)).slice();
    const ordIdx = {}; ord.forEach((n, i) => (ordIdx[n] = i));
    const notDone = ord.map((n) => byName[n]).filter((q) => q && q.st !== "Done");
    const rec = notDone.find((q) => q.st === "Stat-ready") || notDone[0] || null;
    // filters
    const qfS = this.state.qfSeries, qfT = this.state.qfType, qfSt = this.state.qfStatus;
    const qN = (this.state.qName || "").toLowerCase(), qG = (this.state.qGate || "").toLowerCase();
    const gateText = (q) => (q.gate && q.gate !== "-" ? q.gate : q.key && q.key !== "-" ? q.key : "");
    let list = allQ.slice();
    if (qfS.length) list = list.filter((q) => qfS.includes(q.series));
    if (qfT.length) list = list.filter((q) => qfT.includes(q.mem));
    if (qfSt.length) list = list.filter((q) => qfSt.includes(q.st));
    if (qN) list = list.filter((q) => q.n.toLowerCase().includes(qN));
    if (qG) list = list.filter((q) => gateText(q).toLowerCase().includes(qG));
    const sCol = this.state.qsortCol, sDir = this.state.qsortDir;
    const stRank = { "Stat-ready": 0, Blocked: 1, Done: 2 };
    if (sCol) { const cmps = { n: (a, b) => a.n.localeCompare(b.n), series: (a, b) => (a.series || "").localeCompare(b.series || ""), mem: (a, b) => (a.mem > b.mem ? 1 : -1), qp: (a, b) => a.qp - b.qp, status: (a, b) => stRank[a.st] - stRank[b.st] }; const cmp = cmps[sCol] || (() => 0); list.sort((a, b) => cmp(a, b) * sDir); }
    else list.sort((a, b) => (ordIdx[a.n] == null ? 9999 : ordIdx[a.n]) - (ordIdx[b.n] == null ? 9999 : ordIdx[b.n]));
    const seriesSet = Array.from(new Set(D.quests.map((q) => q.series).filter(Boolean))).sort();
    const sortBtn = (col, label) => <span onClick={() => this.setState((s) => (s.qsortCol === col ? (s.qsortDir > 0 ? { qsortDir: -1 } : { qsortCol: "", qsortDir: 1 }) : { qsortCol: col, qsortDir: 1 }))} style={{ cursor: "pointer" }}>{label}{sCol === col ? (sDir > 0 ? " ▲" : " ▼") : ""}</span>;
    const anyF = qfS.length || qfT.length || qfSt.length || qN || qG;
    const methodLabel = { optimal: "Optimal Quest Guide", ironman: "Optimal · Ironman", release: "Release order", series: "By series" }[method] || method;
    return (
      <div>
        <SectionTitle kicker="The Adventure Log" title="Quest Sequencer" accent={themeFor("quests").accent}
          right={<Seg options={[{ key: "optimal", label: "OPTIMAL" }, { key: "ironman", label: "IRONMAN" }, { key: "release", label: "RELEASE" }, { key: "series", label: "SERIES" }]} active={method} onPick={(v) => this.setState({ questMethod: v })} size={9} />} />
        <StatCards cols={4} items={[
          { label: "Completion", value: d.qPct + "%" },
          { label: "Quest points", value: "" + this.questPoints, sub: this.stats.qpApi ? "incl. hiscores" : "from quests marked done" },
          { label: "Remaining", value: "" + d.qRemaining },
          { label: "Next up", value: rec ? rec.n : "Cape!", color: C.green },
        ]} />
        {rec && (
          <Card style={{ marginBottom: 14, background: "rgba(201,162,74,.1)", border: "1px solid rgba(201,162,74,.35)" }}>
            <Kicker color={C.goldDeep}>★ Recommended next ({methodLabel})</Kicker>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
              <span style={cinzel({ fontWeight: 700, fontSize: 22 })}>{rec.n}</span>
              <Tag color={this.stColor(rec.st)} bg={this.stBg(rec.st)}>{rec.st}</Tag>
              <span style={mono({ fontSize: 11, color: C.muted })}>{rec.series} · {rec.qp} QP · unlock: {rec.key && rec.key !== "-" ? rec.key : "—"}</span>
              <Btn tone="gold" onClick={() => this.cycleQuest(rec.n)} style={{ marginLeft: "auto" }}>Mark done ✓</Btn>
            </div>
          </Card>
        )}
        <Card>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <input className="led" placeholder="search quest…" defaultValue={this.state.qName} onChange={(e) => this.setState({ qName: e.target.value })} style={{ width: 180 }} />
            <input className="led" placeholder="gated by…" defaultValue={this.state.qGate} onChange={(e) => this.setState({ qGate: e.target.value })} style={{ width: 150 }} />
            <select className="led" onChange={(e) => { const v = e.target.value; this.setState((s) => ({ qfStatus: v ? [v] : [] })); }} value={qfSt[0] || ""} style={{ width: 130 }}><option value="">All status</option><option value="Stat-ready">Ready</option><option value="Blocked">Blocked</option><option value="Done">Done</option></select>
            <select className="led" onChange={(e) => { const v = e.target.value; this.setState({ qfType: v ? [v] : [] }); }} value={qfT[0] || ""} style={{ width: 120 }}><option value="">All types</option><option value="F2P">F2P</option><option value="Mem">Members</option></select>
            {anyF ? <span onClick={() => this.setState({ qfSeries: [], qfType: [], qfStatus: [], qName: "", qGate: "" })} style={{ cursor: "pointer", ...mono({ fontSize: 10, color: C.red }) }}>clear ✕</span> : null}
            <span style={{ marginLeft: "auto", ...mono({ fontSize: 10, color: C.muted }) }}>{list.length} of {allQ.length} · click a row to toggle Done</span>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 620, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, background: C.card, zIndex: 2 }}><tr>{[["n", "Quest"], ["series", "Series"], ["mem", "Type"], ["qp", "QP"], ["gate", "Gated by"], ["status", "Status"]].map(([c, l], i) => (
                <th key={c} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: c === "qp" ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{c === "gate" ? l : sortBtn(c, l)}</th>))}</tr></thead>
              <tbody>{list.map((q) => (
                <tr key={q.n} onClick={() => this.cycleQuest(q.n)} style={{ cursor: "pointer", background: q.st === "Done" ? "rgba(92,110,53,.06)" : "transparent" }}>
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 13.5 }), padding: "7px 9px" }}>{q.st === "Done" ? "✓ " : ""}{q.n}</td>
                  <td style={{ ...serif({ fontSize: 13, color: C.muted2 }), padding: "7px 9px" }}>{q.series}</td>
                  <td style={{ ...mono({ fontSize: 10, color: q.mem === "F2P" ? C.green : C.muted }), padding: "7px 9px" }}>{q.mem}</td>
                  <td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{q.qp}</td>
                  <td style={{ ...serif({ fontSize: 12.5, color: C.muted }), padding: "7px 9px" }}>{gateText(q) || "—"}</td>
                  <td style={{ padding: "7px 9px" }}><Tag color={this.stColor(q.st)} bg={this.stBg(q.st)}>{q.st}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ===================== DIARY & CA =====================
  renderDiary() {
    const dRank = { Easy: 0, Medium: 1, Hard: 2, Elite: 3 };
    const base = D.diaries.map((d) => { const st = this.diaryStatus(d); return { region: d.region, tier: d.tier, status: st, gate: d.gate || "—", reward: (d.reward || "").split(" — ")[0], tierN: dRank[d.tier] != null ? dRank[d.tier] : 9, stN: { "Stat-ready": 0, Blocked: 1, Done: 2 }[st] }; });
    const model = this.buildTable("diary", base, [
      { key: "region", label: "REGION", filter: "text", fval: (r) => r.region, sval: (r) => r.region },
      { key: "tier", label: "TIER", filter: "enum", options: [{ v: "Easy", label: "Easy" }, { v: "Medium", label: "Medium" }, { v: "Hard", label: "Hard" }, { v: "Elite", label: "Elite" }], fval: (r) => r.tier, sval: (r) => r.tierN },
      { key: "status", label: "STATUS", filter: "enum", options: [{ v: "Stat-ready", label: "Ready" }, { v: "Blocked", label: "Blocked" }, { v: "Done", label: "Done" }], fval: (r) => r.status, sval: (r) => r.stN },
      { key: "gate", label: "GATED BY", filter: "text", fval: (r) => r.gate, sval: (r) => r.gate },
      { key: "reward", label: "HEADLINE REWARD", filter: "text", fval: (r) => r.reward, sval: (r) => r.reward },
    ]);
    const cols = [
      { key: "region", cell: (r) => <span style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.region}</span> },
      { key: "tier", cell: (r) => <Tag>{r.tier}</Tag> },
      { key: "status", cell: (r) => <Tag color={this.stColor(r.status)} bg={this.stBg(r.status)}>{r.status}</Tag> },
      { key: "gate", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted })}>{r.gate}</span> },
      { key: "reward", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted2 })}>{r.reward}</span> },
    ];
    const count = (s) => base.filter((d) => d.status === s).length;
    const caColors = [C.green, C.teal, "#9a7530", C.purple, C.red, C.ink];
    return (
      <div>
        <SectionTitle kicker="Regional Renown" title="Diary & Combat Achievements" accent={themeFor("diary").accent} />
        <StatCards cols={3} items={[
          { label: "Completed", value: "" + count("Done"), color: C.green },
          { label: "Stat-ready", value: "" + count("Stat-ready"), color: "#9a7530" },
          { label: "Blocked", value: "" + count("Blocked"), color: C.red },
        ]} />
        <Card style={{ marginBottom: 14 }}><DataTable tableKey="diary" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} empty="No diaries match." /></Card>
        <Card>
          <Kicker color={C.goldDeep}>Combat Achievement tiers</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
            {(D.ca || []).map((c, i) => (
              <div key={i} style={{ background: C.cardLight, padding: "10px 12px", borderRadius: 6, borderLeft: "3px solid " + caColors[i % caColors.length] }}>
                <div style={cinzel({ fontWeight: 700, fontSize: 14 })}>{c.tier}</div>
                <div style={serif({ fontSize: 12, color: C.muted, margin: "3px 0" })}>{c.gating}</div>
                <div style={serif({ fontSize: 12, color: C.muted2 })}>{c.reward}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }
}
