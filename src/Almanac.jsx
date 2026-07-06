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
import { ACTIVITIES_DATA } from "./data/activitiesData.js";
import { SKILL_MILESTONES } from "./data/skillMilestones.js";
import { CONTENT_REQS } from "./data/contentReqs.js";
import { QUEST_DEPS } from "./data/questDeps.js";
import { BOSS_GUIDES } from "./data/bossGuides.js";
import { refreshActivityGp, liveGpRate, geSellNet } from "./lib/activityPrices.js";
import { fetchPlayer, fetchPrices, priceById, combatLevel, fetchItemNames, natureRunePrice, wikiExtract, wikiSections } from "./lib/api.js";
import { C, mono, serif, cinzel, Card, Kicker, SectionTitle, StatCards, Bar, Seg, Tag, Btn, DataTable, Hero, themeFor, LineChart, BarChartH, Icon, Donut, BandBar } from "./lib/ui.jsx";
import { loadItemIndex, itemIconUrl, skillIconUrl, ensureItemStats, getItemStats } from "./lib/icons.js";

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
  { label: "Overview", items: [["dashboard", "Dashboard"], ["skills", "Skills"], ["pathfinder", "Pathfinder"], ["goals", "Goals"]] },
  { label: "Treasury", items: [["networth", "Net Worth"], ["flipping", "GE Flipping"], ["alchemy", "High Alchemy"]] },
  { label: "Combat", items: [["bossing", "Bossing"], ["slayer", "Slayer"], ["gear", "Gear Path"]] },
  { label: "Skilling", items: [["farming", "Farming"], ["quests", "Quests"], ["diary", "Diary & CA"]] },
  { label: "Chronicle", items: [["journal", "Journal"]] },
];
const TITLES = {
  dashboard: ["The Adventurer's Almanac", "Account Dashboard"], skills: ["Character Progression", "Skills"],
  goals: ["Time to Goal", "Goal Ledger"], pathfinder: ["Dependency Atlas", "The Keystone Web"], networth: ["The Treasury", "Net Worth"],
  flipping: ["Grand Exchange", "Flipping Desk"], alchemy: ["Arcane Profit", "High Alchemy"],
  bossing: ["Command Centre", "Bossing Compendium"], slayer: ["The Slayer", "Task Planner"],
  gear: ["The Armoury", "Gear Progression"], farming: ["The Allotments", "Farming Engine"],
  quests: ["The Adventure Log", "Quest Sequencer"], diary: ["Regional Renown", "Diary & Combat Achievements"],
  journal: ["The Chronicle", "Adventurer's Journal"],
};

export default class Almanac extends React.Component {
  state = {
    section: "dashboard", openForm: null, fetching: false, fetchMsg: "", priceStatus: "", gearPriceStatus: "",
    flipView: "scanner", fillResult: null, fillMsg: "", bossView: "compendium", bossFocus: "", bossGearStyle: "", dropFormBoss: "",
    slayView: "planner", slayMaster: "Duradel", gearStyle: "melee", gearSlot: "Weapon", gearItem: null, gearStatMode: "set", gearDetail: null,
    questMethod: "optimal", qsortCol: "", qsortDir: 1, qFilterOpen: "", qfSeries: [], qfType: [], qfStatus: [], qName: "", qGate: "",
    tSort: {}, tFilt: {}, tOpen: "", flipPrefill: null, objType: "bank", objBoss: "", flipShowWatch: false, flipCfgVer: 0, _v: 0,
    counselLens: "balanced", goalId: "none", pfSort: "lev", farmView: "planner", bossPage: "",
    jSel: null, jEdit: null, jSeal: "crimson",
  };

  // ---- static reference tables (ported from the workbook / design) ----
  alchItems = [
    { item: "Magic longbow", alch: 1536, buy: 1098, limit: 18000 },
    { item: "Camphor repair kit", alch: 2100, buy: 1595, limit: 13000 },
    { item: "Dragon javelin tips", alch: 1170, buy: 650, limit: 10000 },
    { item: "Rune javelin tips", alch: 810, buy: 370, limit: 10000 },
    { item: "Yew longbow", alch: 768, buy: 475, limit: 18000 },
  ];
  // Herb tiers. seed/herb prices are snapshots until "⟳ Live prices" re-prices
  // them; net/run is always computed live from the yield model in herbYield()
  // (harvest lives × chance-to-save × disease survival) via farmNet().
  // plantXp/harvestXp are the game's per-crop constants (harvest xp is per herb
  // picked), so xp/run = patches × (plant + harvest × yield-model herbs).
  farmDefs = [
    { tier: "Ranarr", lvl: 32, unlocked: true, seedItem: "Ranarr seed", herbItem: "Grimy ranarr weed", seed: 26678, herb: 5346, plantXp: 27, harvestXp: 30.5 },
    { tier: "Snapdragon", lvl: 62, unlocked: true, seedItem: "Snapdragon seed", herbItem: "Grimy snapdragon", seed: 53508, herb: 8393, plantXp: 87.5, harvestXp: 98.5 },
    { tier: "Torstol", lvl: 85, unlocked: false, seedItem: "Torstol seed", herbItem: "Grimy torstol", seed: 15900, herb: 3155, plantXp: 199.5, harvestXp: 224.5 },
  ];
  // Herb yield model (OSRS Wiki "Crop yield" mechanics):
  //   chance to save a harvest life  p = (1 + floor(interp × bonuses)) / 256
  //     interp = (CTS1·(99−L) + CTS99·(L−1)) / 98 — all herbs share CTS1=25, CTS99=80
  //     bonuses: magic secateurs ×1.10 · farming cape ×1.05 · attas plant ×1.05
  //   expected herbs from a LIVE patch  E = lives / (1 − p)
  //     lives = 3, +1 compost / +2 super / +3 ultra
  //   disease: 3 growth checkpoints; per-stage chance by compost — survival = (1−d)³
  //   (Trollheim · Weiss · Hosidius patches never roll disease → "disease-free" count)
  herbCompost = {
    none: { label: "No compost", lives: 3, d: 27 / 128, item: null },
    compost: { label: "Compost", lives: 4, d: 14 / 128, item: "Compost" },
    super: { label: "Supercompost", lives: 5, d: 6 / 128, item: "Supercompost" },
    ultra: { label: "Ultracompost", lives: 6, d: 3 / 128, item: "Ultracompost" },
  };
  // The game's herb patches. Access is auto-derived from your quest log /
  // Farming level / diary state (overridable per patch); df = never rolls
  // disease. Order is yours to arrange — it becomes the run route.
  herbPatches = [
    { id: "falador", name: "Falador", tele: "Explorer's ring 2", df: false },
    { id: "ardougne", name: "Ardougne", tele: "Ardougne cloak 2", df: false },
    { id: "catherby", name: "Catherby", tele: "Camelot teleport", df: false },
    { id: "morytania", name: "Morytania", tele: "Ectophial", df: false, quest: "Priest in Peril" },
    { id: "hosidius", name: "Hosidius", tele: "Xeric's talisman", df: true },
    { id: "trollheim", name: "Troll Stronghold", tele: "Stony basalt / Trollheim tele", df: true, quest: "My Arm's Big Adventure" },
    { id: "weiss", name: "Weiss", tele: "Icy basalt", df: true, quest: "Making Friends with My Arm" },
    { id: "guild", name: "Farming Guild", tele: "Skills necklace", df: false, lvl: 65 },
    { id: "varlamore", name: "Civitas illa Fortis", tele: "Civitas teleport", df: false, quest: "Children of the Sun" },
    { id: "harmony", name: "Harmony Island", tele: "Harmony teleport tab", df: false, quest: "The Great Brain Robbery", diary: ["Morytania", "Elite"] },
  ];
  // growHrs = real grow time; caps how many runs/day are actually possible
  // (24h ÷ growHrs). Herbs ~80 min, fruit trees 16h, trees ~hours, hardwoods slow.
  farmRunDefs = [
    // payItem/payQty = the farmer's protection payment PER PATCH (guarantees the
    // tree can't die); priced into gpRun on a live refresh alongside saplings —
    // the static gpRun fallbacks below include a payment estimate too.
    // rdKey = stable key for runs/day overrides (the herb row's crop changes).
    // optIn rows (Hespori · Tithe) count toward the daily KPIs only when you
    // set a runs/day on them.
    { rdKey: "Herb", name: "Herb run", crop: "Snapdragon", type: "Herb", req: 62, xpRun: 6981, gpRun: 80260, timeMin: 6, growHrs: 1.33, patches: 6, teles: "Ectophial · Explorer ring · Ardy cloak · Catherby · Hosidius", seeds: "6× seed + compost" },
    { rdKey: "Palm", name: "Fruit tree run", crop: "Palm", type: "Fruit", req: 68, xpRun: 51303, gpRun: -59000, sapItem: "Palm sapling", payItem: "Papaya fruit", payQty: 15, timeMin: 13, growHrs: 16, patches: 6, teles: "Gnome Stronghold · Tree Gnome Village · Brimhaven · Catherby · Lletya · Farming Guild", seeds: "6× Palm sapling" },
    { rdKey: "Yew", name: "Tree run", crop: "Yew", type: "Tree", req: 60, xpRun: 35755, gpRun: -36000, sapItem: "Yew sapling", payItem: "Cactus spine", payQty: 10, timeMin: 14, growHrs: 8, patches: 5, teles: "Lumbridge · Varrock · Falador · Gnome Stronghold · Farming Guild", seeds: "5× Yew sapling" },
    { rdKey: "Mahogany", name: "Hardwood run", crop: "Mahogany", type: "Hardwood", req: 55, xpRun: 31500, gpRun: -12000, sapItem: "Mahogany sapling", payItem: "Yanillian hops", payQty: 25, timeMin: 6, growHrs: 24, patches: 2, teles: "Fossil Island · Mushroom forest", seeds: "2× Mahogany sapling" },
    { rdKey: "Magic", name: "Tree run", crop: "Magic", type: "Tree", req: 75, xpRun: 69569, gpRun: -78000, sapItem: "Magic sapling", payItem: "Coconut", payQty: 25, timeMin: 14, growHrs: 8, patches: 5, teles: "Lumbridge · Varrock · Falador · Gnome Stronghold · Farming Guild", seeds: "5× Magic sapling" },
    { rdKey: "Hespori", name: "Hespori", crop: "Hespori", type: "Boss patch", req: 65, xpRun: 13100, gpRun: 45000, timeMin: 8, growHrs: 32, patches: 1, optIn: true, teles: "Farming Guild basement · seed drops from PvM & skilling", seeds: "1× Hespori seed (untradeable)", note: "avg kill loot, estimate" },
    { rdKey: "Tithe", name: "Tithe Farm", crop: "—", type: "Minigame", req: 34, xpRun: 0, gpRun: 0, timeMin: 60, growHrs: 0, patches: 0, optIn: true, teles: "Farming Guild lobby", seeds: "Seeds provided free", note: "points buy farmer's outfit (+2.5% xp), herb sack & seed box — worth focused sessions until owned" },
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
  // Comprehensive drop tables keyed to the exact boss names in D.bosses. Each
  // entry: { n, rate (1/N), v (approx gp; live-repriced by name for tradeables),
  // cat: "unique" | "common" | "tertiary" }. Rates/uniques follow the OSRS Wiki.
  bossDrops = {
    "Giant Mole": [{ n: "Baby mole", rate: 3000, v: 0, cat: "tertiary" }, { n: "Clue scroll (hard)", rate: 25, v: 0, cat: "tertiary" }, { n: "Mole claw", rate: 1, v: 460, cat: "common" }, { n: "Mole skin", rate: 1, v: 540, cat: "common" }, { n: "Numulite", rate: 6, v: 30, cat: "common" }],
    "Obor": [{ n: "Hill giant club", rate: 118, v: 110000, cat: "unique" }, { n: "Giant key", rate: 1, v: 0, cat: "common" }, { n: "Big bones", rate: 1, v: 280, cat: "common" }, { n: "Clue scroll (medium)", rate: 32, v: 0, cat: "tertiary" }],
    "Bryophyta": [{ n: "Bryophyta's essence", rate: 118, v: 240000, cat: "unique" }, { n: "Mossy key", rate: 1, v: 0, cat: "common" }, { n: "Nature rune", rate: 4, v: 90, cat: "common" }, { n: "Clue scroll (medium)", rate: 32, v: 0, cat: "tertiary" }],
    "Scurrius": [{ n: "Scurrius' spine", rate: 3, v: 0, cat: "unique" }, { n: "Scurry", rate: 3000, v: 0, cat: "tertiary" }, { n: "Clue scroll (hard)", rate: 200, v: 0, cat: "tertiary" }, { n: "Bones", rate: 1, v: 110, cat: "common" }],
    "Deranged Archaeologist": [{ n: "Clue scroll (elite)", rate: 400, v: 0, cat: "tertiary" }, { n: "Death rune", rate: 4, v: 180, cat: "common" }, { n: "Ancient page", rate: 35, v: 0, cat: "unique" }, { n: "Snapdragon seed", rate: 30, v: 50000, cat: "common" }],
    "Sarachnis": [{ n: "Sarachnis cudgel", rate: 384, v: 1500000, cat: "unique" }, { n: "Jar of eyes", rate: 2000, v: 180000, cat: "tertiary" }, { n: "Sraracha", rate: 3000, v: 0, cat: "tertiary" }, { n: "Giant egg sac(full)", rate: 80, v: 0, cat: "common" }, { n: "Grimy ranarr weed", rate: 12, v: 7000, cat: "common" }, { n: "Clue scroll (elite)", rate: 256, v: 0, cat: "tertiary" }],
    "The Barrows Brothers": [{ n: "Dharok's set piece", rate: 2448, v: 3000000, cat: "unique" }, { n: "Ahrim's set piece", rate: 2448, v: 1500000, cat: "unique" }, { n: "Karil's set piece", rate: 2448, v: 700000, cat: "unique" }, { n: "Guthan's set piece", rate: 2448, v: 350000, cat: "unique" }, { n: "Torag's set piece", rate: 2448, v: 150000, cat: "unique" }, { n: "Verac's set piece", rate: 2448, v: 200000, cat: "unique" }, { n: "Bolt rack", rate: 1, v: 90, cat: "common" }],
    "Dagannoth Kings": [{ n: "Berserker ring", rate: 128, v: 2700000, cat: "unique" }, { n: "Archers ring", rate: 128, v: 950000, cat: "unique" }, { n: "Seers ring", rate: 128, v: 55000, cat: "unique" }, { n: "Warrior ring", rate: 128, v: 50000, cat: "unique" }, { n: "Dragon axe", rate: 128, v: 55000, cat: "unique" }, { n: "Seercull", rate: 128, v: 90000, cat: "unique" }, { n: "Pet dagannoth prime", rate: 5000, v: 0, cat: "tertiary" }],
    "Kalphite Queen": [{ n: "Dragon chainbody", rate: 128, v: 270000, cat: "unique" }, { n: "Dragon 2h sword", rate: 256, v: 110000, cat: "unique" }, { n: "Kq head", rate: 256, v: 90000, cat: "unique" }, { n: "Jar of sand", rate: 2000, v: 100000, cat: "tertiary" }, { n: "Kalphite princess", rate: 3000, v: 0, cat: "tertiary" }, { n: "Clue scroll (elite)", rate: 128, v: 0, cat: "tertiary" }],
    "King Black Dragon": [{ n: "Draconic visage", rate: 5000, v: 1700000, cat: "unique" }, { n: "Kbd heads", rate: 128, v: 5000, cat: "unique" }, { n: "Prince black dragon", rate: 3000, v: 0, cat: "tertiary" }, { n: "Dragon rune drops", rate: 4, v: 5000, cat: "common" }, { n: "Black dragonhide", rate: 6, v: 7000, cat: "common" }, { n: "Clue scroll (elite)", rate: 1500, v: 0, cat: "tertiary" }],
    "Zulrah": [{ n: "Tanzanite fang", rate: 512, v: 2700000, cat: "unique" }, { n: "Magic fang", rate: 512, v: 2300000, cat: "unique" }, { n: "Serpentine visage", rate: 512, v: 1100000, cat: "unique" }, { n: "Uncut onyx", rate: 1024, v: 2500000, cat: "unique" }, { n: "Tanzanite mutagen", rate: 13106, v: 4500000, cat: "tertiary" }, { n: "Magma mutagen", rate: 13106, v: 3000000, cat: "tertiary" }, { n: "Jar of swamp", rate: 3000, v: 120000, cat: "tertiary" }, { n: "Pet snakeling", rate: 4000, v: 0, cat: "tertiary" }, { n: "Zulrah's scales", rate: 1, v: 150, cat: "common" }],
    "Vorkath": [{ n: "Skeletal visage", rate: 5000, v: 1700000, cat: "unique" }, { n: "Dragonbone necklace", rate: 1000, v: 180000, cat: "unique" }, { n: "Vorkath's head", rate: 50, v: 0, cat: "unique" }, { n: "Jar of decay", rate: 3000, v: 60000, cat: "tertiary" }, { n: "Vorki", rate: 3000, v: 0, cat: "tertiary" }, { n: "Superior dragon bones", rate: 1, v: 8500, cat: "common" }, { n: "Blue dragonhide", rate: 3, v: 1500, cat: "common" }],
    "Cerberus": [{ n: "Primordial crystal", rate: 512, v: 4500000, cat: "unique" }, { n: "Pegasian crystal", rate: 512, v: 2900000, cat: "unique" }, { n: "Eternal crystal", rate: 512, v: 2700000, cat: "unique" }, { n: "Smouldering stone", rate: 512, v: 350000, cat: "unique" }, { n: "Jar of souls", rate: 2000, v: 150000, cat: "tertiary" }, { n: "Hellpuppy", rate: 3000, v: 0, cat: "tertiary" }, { n: "Key master teleport", rate: 64, v: 8000, cat: "common" }],
    "Abyssal Sire": [{ n: "Abyssal bludgeon piece", rate: 516, v: 9000000, cat: "unique" }, { n: "Abyssal dagger", rate: 256, v: 3600000, cat: "unique" }, { n: "Abyssal whip", rate: 256, v: 2000000, cat: "unique" }, { n: "Unsired", rate: 100, v: 0, cat: "unique" }, { n: "Jar of miasma", rate: 1500, v: 130000, cat: "tertiary" }, { n: "Abyssal orphan", rate: 2560, v: 0, cat: "tertiary" }],
    "Kraken": [{ n: "Trident of the seas (full)", rate: 512, v: 150000, cat: "unique" }, { n: "Kraken tentacle", rate: 200, v: 500000, cat: "unique" }, { n: "Pet kraken", rate: 3000, v: 0, cat: "tertiary" }, { n: "Sanfew serum(4)", rate: 100, v: 9000, cat: "common" }, { n: "Dragonstone", rate: 60, v: 12000, cat: "common" }],
    "Thermonuclear Smoke Devil": [{ n: "Smoke battlestaff", rate: 512, v: 130000, cat: "unique" }, { n: "Occult necklace", rate: 350, v: 700000, cat: "unique" }, { n: "Pet smoke devil", rate: 3000, v: 0, cat: "tertiary" }, { n: "Dragon chainbody", rate: 1000, v: 270000, cat: "unique" }, { n: "Mystic robe top (dark)", rate: 40, v: 3500, cat: "common" }],
    "Grotesque Guardians": [{ n: "Black tourmaline core", rate: 1000, v: 2000000, cat: "unique" }, { n: "Granite gloves", rate: 500, v: 130000, cat: "unique" }, { n: "Granite ring", rate: 500, v: 70000, cat: "unique" }, { n: "Granite hammer", rate: 750, v: 700000, cat: "unique" }, { n: "Jar of stone", rate: 5000, v: 200000, cat: "tertiary" }, { n: "Noon", rate: 3000, v: 0, cat: "tertiary" }],
    "Alchemical Hydra": [{ n: "Hydra's claw", rate: 1000, v: 90000000, cat: "unique" }, { n: "Dragon hunter lance", rate: 2000, v: 28000000, cat: "unique" }, { n: "Hydra leather", rate: 514, v: 1300000, cat: "unique" }, { n: "Hydra's eye", rate: 180, v: 200000, cat: "unique" }, { n: "Hydra's fang", rate: 180, v: 180000, cat: "unique" }, { n: "Hydra's heart", rate: 180, v: 220000, cat: "unique" }, { n: "Hydra tail", rate: 512, v: 300000, cat: "unique" }, { n: "Jar of chemicals", rate: 2000, v: 150000, cat: "tertiary" }, { n: "Ikkle hydra", rate: 3000, v: 0, cat: "tertiary" }],
    "Skotizo": [{ n: "Skotos", rate: 65, v: 0, cat: "tertiary" }, { n: "Jar of darkness", rate: 200, v: 250000, cat: "tertiary" }, { n: "Dark claw", rate: 200, v: 0, cat: "unique" }, { n: "Ancient shard", rate: 8, v: 0, cat: "common" }, { n: "Uncut diamond", rate: 8, v: 2700, cat: "common" }, { n: "Clue scroll (hard)", rate: 8, v: 0, cat: "tertiary" }],
    "Phantom Muspah": [{ n: "Venator shard", rate: 100, v: 30000000, cat: "unique" }, { n: "Ancient icon", rate: 200, v: 5000000, cat: "unique" }, { n: "Charged ice", rate: 25, v: 0, cat: "common" }, { n: "Frozen cache", rate: 25, v: 0, cat: "common" }, { n: "Muphin", rate: 2500, v: 0, cat: "tertiary" }, { n: "Ancient essence", rate: 1, v: 30, cat: "common" }],
    "General Graardor (Bandos)": [{ n: "Bandos chestplate", rate: 381, v: 18000000, cat: "unique" }, { n: "Bandos tassets", rate: 381, v: 24000000, cat: "unique" }, { n: "Bandos boots", rate: 381, v: 350000, cat: "unique" }, { n: "Bandos hilt", rate: 508, v: 9000000, cat: "unique" }, { n: "Pet general graardor", rate: 5000, v: 0, cat: "tertiary" }, { n: "Godsword shard 1", rate: 762, v: 100000, cat: "common" }, { n: "Super restore(4)", rate: 30, v: 10000, cat: "common" }],
    "Commander Zilyana (Saradomin)": [{ n: "Armadyl crossbow", rate: 508, v: 25000000, cat: "unique" }, { n: "Saradomin hilt", rate: 508, v: 4500000, cat: "unique" }, { n: "Saradomin sword", rate: 127, v: 230000, cat: "unique" }, { n: "Saradomin's light", rate: 254, v: 250000, cat: "unique" }, { n: "Pet zilyana", rate: 5000, v: 0, cat: "tertiary" }, { n: "Shark", rate: 20, v: 800, cat: "common" }],
    "Kree'arra (Armadyl)": [{ n: "Armadyl helmet", rate: 381, v: 6000000, cat: "unique" }, { n: "Armadyl chestplate", rate: 381, v: 21000000, cat: "unique" }, { n: "Armadyl chainskirt", rate: 381, v: 23000000, cat: "unique" }, { n: "Armadyl hilt", rate: 508, v: 1300000, cat: "unique" }, { n: "Pet kree'arra", rate: 5000, v: 0, cat: "tertiary" }, { n: "Ranarr seed", rate: 100, v: 35000, cat: "common" }],
    "K'ril Tsutsaroth (Zamorak)": [{ n: "Staff of the dead", rate: 508, v: 8000000, cat: "unique" }, { n: "Zamorakian spear", rate: 127, v: 160000, cat: "unique" }, { n: "Steam battlestaff", rate: 512, v: 400000, cat: "unique" }, { n: "Zamorak hilt", rate: 508, v: 3500000, cat: "unique" }, { n: "Pet k'ril tsutsaroth", rate: 5000, v: 0, cat: "tertiary" }, { n: "Super restore(4)", rate: 30, v: 10000, cat: "common" }],
    "Nex": [{ n: "Torva full helm", rate: 516, v: 90000000, cat: "unique" }, { n: "Torva platebody", rate: 516, v: 200000000, cat: "unique" }, { n: "Torva platelegs", rate: 516, v: 180000000, cat: "unique" }, { n: "Nihil horn", rate: 172, v: 60000000, cat: "unique" }, { n: "Zaryte vambraces", rate: 258, v: 50000000, cat: "unique" }, { n: "Ancient hilt", rate: 516, v: 90000000, cat: "unique" }, { n: "Nexling", rate: 500, v: 0, cat: "tertiary" }, { n: "Nihil shard", rate: 1, v: 0, cat: "common" }],
    "Callisto / Artio": [{ n: "Tyrannical ring", rate: 700, v: 600000, cat: "unique" }, { n: "Voidwaker hilt", rate: 2400, v: 25000000, cat: "unique" }, { n: "Dragon pickaxe", rate: 350, v: 1100000, cat: "unique" }, { n: "Claws of callisto", rate: 1000, v: 60000, cat: "unique" }, { n: "Callisto cub", rate: 2000, v: 0, cat: "tertiary" }, { n: "Dragon 2h sword", rate: 256, v: 110000, cat: "common" }],
    "Venenatis / Spindel": [{ n: "Treasonous ring", rate: 700, v: 400000, cat: "unique" }, { n: "Voidwaker blade", rate: 2400, v: 25000000, cat: "unique" }, { n: "Dragon pickaxe", rate: 350, v: 1100000, cat: "unique" }, { n: "Fangs of venenatis", rate: 1000, v: 60000, cat: "unique" }, { n: "Venenatis spiderling", rate: 2000, v: 0, cat: "tertiary" }],
    "Vet'ion / Calvar'ion": [{ n: "Ring of the gods", rate: 700, v: 1100000, cat: "unique" }, { n: "Voidwaker gem", rate: 2400, v: 25000000, cat: "unique" }, { n: "Skull of vet'ion", rate: 1000, v: 60000, cat: "unique" }, { n: "Dragon pickaxe", rate: 350, v: 1100000, cat: "unique" }, { n: "Vet'ion jr.", rate: 2000, v: 0, cat: "tertiary" }],
    "Chaos Elemental": [{ n: "Dragon pickaxe", rate: 256, v: 1100000, cat: "unique" }, { n: "Dragon 2h sword", rate: 128, v: 110000, cat: "unique" }, { n: "Pet chaos elemental", rate: 300, v: 0, cat: "tertiary" }, { n: "Rune platebody", rate: 30, v: 38000, cat: "common" }],
    "Scorpia": [{ n: "Odium shard 3", rate: 256, v: 100000, cat: "unique" }, { n: "Malediction shard 3", rate: 256, v: 100000, cat: "unique" }, { n: "Scorpia's offspring", rate: 2016, v: 0, cat: "tertiary" }, { n: "Grimy toadflax", rate: 10, v: 2500, cat: "common" }],
    "Crazy Archaeologist": [{ n: "Fedora", rate: 128, v: 0, cat: "unique" }, { n: "Odium shard 2", rate: 256, v: 60000, cat: "unique" }, { n: "Malediction shard 2", rate: 256, v: 60000, cat: "unique" }, { n: "Clue scroll (elite)", rate: 128, v: 0, cat: "tertiary" }, { n: "Death rune", rate: 4, v: 180, cat: "common" }],
    "Vardorvis": [{ n: "Ultor vestige", rate: 539, v: 90000000, cat: "unique" }, { n: "Executioner's axe head", rate: 1088, v: 12000000, cat: "unique" }, { n: "Virtus mask", rate: 1083, v: 25000000, cat: "unique" }, { n: "Blood quartz", rate: 2200, v: 4000000, cat: "unique" }, { n: "Awakener's orb", rate: 50, v: 0, cat: "common" }, { n: "Butch", rate: 3000, v: 0, cat: "tertiary" }],
    "Duke Sucellus": [{ n: "Magus vestige", rate: 590, v: 90000000, cat: "unique" }, { n: "Eye of the duke", rate: 1040, v: 8000000, cat: "unique" }, { n: "Virtus robe top", rate: 1083, v: 25000000, cat: "unique" }, { n: "Magus icon", rate: 2200, v: 4000000, cat: "unique" }, { n: "Chromium ingot", rate: 27, v: 4000000, cat: "common" }, { n: "Baron", rate: 2500, v: 0, cat: "tertiary" }],
    "The Leviathan": [{ n: "Venator vestige", rate: 590, v: 90000000, cat: "unique" }, { n: "Leviathan's lure", rate: 1040, v: 9000000, cat: "unique" }, { n: "Virtus robe legs", rate: 1083, v: 25000000, cat: "unique" }, { n: "Smol heredit", rate: 2500, v: 0, cat: "tertiary" }, { n: "Lil'viathan", rate: 2500, v: 0, cat: "tertiary" }],
    "The Whisperer": [{ n: "Bellator vestige", rate: 590, v: 90000000, cat: "unique" }, { n: "Siren's staff", rate: 1040, v: 8000000, cat: "unique" }, { n: "Virtus mask", rate: 1083, v: 25000000, cat: "unique" }, { n: "Wisp", rate: 2000, v: 0, cat: "tertiary" }],
    "The Nightmare": [{ n: "Inquisitor's armour piece", rate: 600, v: 15000000, cat: "unique" }, { n: "Nightmare staff", rate: 600, v: 12000000, cat: "unique" }, { n: "Harmonised orb", rate: 1800, v: 20000000, cat: "unique" }, { n: "Volatile orb", rate: 1800, v: 4000000, cat: "unique" }, { n: "Eldritch orb", rate: 1800, v: 6000000, cat: "unique" }, { n: "Inquisitor's mace", rate: 1800, v: 5000000, cat: "unique" }, { n: "Slepey tablet", rate: 25, v: 70000, cat: "common" }, { n: "Little nightmare", rate: 4000, v: 0, cat: "tertiary" }, { n: "Jar of dreams", rate: 2000, v: 200000, cat: "tertiary" }],
    "Phosani's Nightmare": [{ n: "Inquisitor's armour piece", rate: 480, v: 15000000, cat: "unique" }, { n: "Nightmare staff", rate: 480, v: 12000000, cat: "unique" }, { n: "Harmonised orb", rate: 1440, v: 20000000, cat: "unique" }, { n: "Volatile orb", rate: 1440, v: 4000000, cat: "unique" }, { n: "Eldritch orb", rate: 1440, v: 6000000, cat: "unique" }, { n: "Slepey tablet", rate: 12, v: 70000, cat: "common" }, { n: "Parasitic egg", rate: 200, v: 0, cat: "common" }, { n: "Little nightmare", rate: 1000, v: 0, cat: "tertiary" }],
    "The Gauntlet": [{ n: "Crystal weapon seed", rate: 120, v: 100000, cat: "unique" }, { n: "Crystal armour seed", rate: 120, v: 90000, cat: "unique" }, { n: "Enhanced crystal weapon seed", rate: 2000, v: 0, cat: "unique" }, { n: "Youngllef", rate: 2000, v: 0, cat: "tertiary" }, { n: "Crystal shard", rate: 1, v: 0, cat: "common" }, { n: "Raw paddlefish", rate: 1, v: 100, cat: "common" }],
    "Corrupted Gauntlet": [{ n: "Enhanced crystal weapon seed", rate: 400, v: 0, cat: "unique" }, { n: "Crystal weapon seed", rate: 50, v: 100000, cat: "unique" }, { n: "Crystal armour seed", rate: 50, v: 90000, cat: "unique" }, { n: "Gauntlet cape", rate: 1, v: 0, cat: "common" }, { n: "Youngllef", rate: 800, v: 0, cat: "tertiary" }],
    "Zalcano": [{ n: "Crystal tool seed", rate: 200, v: 1800000, cat: "unique" }, { n: "Crystal armour seed", rate: 150, v: 90000, cat: "unique" }, { n: "Zalcano shard", rate: 750, v: 0, cat: "unique" }, { n: "Uncut onyx", rate: 200, v: 2500000, cat: "unique" }, { n: "Smolcano", rate: 2250, v: 0, cat: "tertiary" }, { n: "Crystal shard", rate: 1, v: 0, cat: "common" }],
    "TzTok-Jad (Fight Caves)": [{ n: "Fire cape", rate: 1, v: 0, cat: "unique" }, { n: "Tzrek-jad", rate: 200, v: 0, cat: "tertiary" }, { n: "Tokkul", rate: 1, v: 1, cat: "common" }],
    "TzKal-Zuk (Inferno)": [{ n: "Infernal cape", rate: 1, v: 0, cat: "unique" }, { n: "Jal-nib-rek", rate: 100, v: 0, cat: "tertiary" }, { n: "Tokkul", rate: 1, v: 1, cat: "common" }],
    "Chambers of Xeric (CoX)": [{ n: "Twisted bow", rate: 691, v: 1700000000, cat: "unique" }, { n: "Kodai insignia", rate: 691, v: 80000000, cat: "unique" }, { n: "Elder maul", rate: 691, v: 90000000, cat: "unique" }, { n: "Dragon claws", rate: 691, v: 70000000, cat: "unique" }, { n: "Dinh's bulwark", rate: 691, v: 18000000, cat: "unique" }, { n: "Ancestral hat", rate: 691, v: 35000000, cat: "unique" }, { n: "Twisted buckler", rate: 691, v: 22000000, cat: "unique" }, { n: "Dragon hunter crossbow", rate: 691, v: 65000000, cat: "unique" }, { n: "Olmlet", rate: 3000, v: 0, cat: "tertiary" }],
    "Theatre of Blood (ToB)": [{ n: "Scythe of vitur", rate: 86, v: 850000000, cat: "unique" }, { n: "Ghrazi rapier", rate: 86, v: 130000000, cat: "unique" }, { n: "Sanguinesti staff", rate: 86, v: 90000000, cat: "unique" }, { n: "Justiciar faceguard", rate: 86, v: 12000000, cat: "unique" }, { n: "Justiciar chestguard", rate: 86, v: 16000000, cat: "unique" }, { n: "Justiciar legguards", rate: 86, v: 14000000, cat: "unique" }, { n: "Avernic defender hilt", rate: 19, v: 100000000, cat: "unique" }, { n: "Lil' zik", rate: 650, v: 0, cat: "tertiary" }],
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
  flipDefaults = { minMargin: 5, maxMargin: 20, minProfit4h: 150000, minVolume: 10000, minBuy: 250, maxAge: 15, capital: 14828291, watchTol: 15 };
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
  _save(k, v) {
    try {
      // Capture one undo point per synchronous action, before the first write.
      if (!this._undoSuspended && this._undoKeys.includes(k) && !this._undoTxn) {
        (this._undoStack = this._undoStack || []).push(this._snap());
        if (this._undoStack.length > 100) this._undoStack.shift();
        this._redoStack = [];
        this._undoTxn = true; Promise.resolve().then(() => { this._undoTxn = false; });
      }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }
  saveLogs() { this._save("almanac.logs.v1", this.logs); }
  bump() { this.setState((s) => ({ _v: s._v + 1 })); }

  componentDidMount() {
    this._undoSuspended = true;
    this.loadState();
    this._undoSuspended = false;
    this._undoStack = []; this._redoStack = [];
    this.gearPrices = {};
    this.itemNames = [];
    this.priceRows = null;
    this.bump();
    // Background: pull the full tradeable-item list (for flip autocomplete) and
    // the live nature-rune price. Both degrade silently if the network is blocked.
    fetchItemNames().then((names) => { this.itemNames = names; this.bump(); }).catch(() => {});
    loadItemIndex().then(() => this.bump()).catch(() => {});
    this.refreshNatRune();
    // Restore the Oracle's chosen ambition and re-price the activities library
    // (gp stays live; xp rates are never price-refreshed).
    const savedGoal = this._load("almanac.counselgoal.v1", null);
    if (savedGoal) this.setState({ goalId: savedGoal });
    refreshActivityGp().then(() => this.bump()).catch(() => {});
    // Enter commits any editable field: every input in the app recalculates on
    // blur, so blur it — no more clicking dead space to apply a value.
    // (Textareas are excluded so multi-line paste keeps working; fields with
    // their own Enter behaviour, like the RSN box, run theirs first.)
    this._enterCommit = (e) => { if (e.key === "Enter" && e.target && e.target.tagName === "INPUT") e.target.blur(); };
    document.addEventListener("keydown", this._enterCommit);
    // Tick the live field-session clock (elapsed + kills/hr) while one runs.
    this._sessTick = setInterval(() => { if (this.bossSession) this.bump(); }, 10000);
  }
  componentWillUnmount() { if (this._enterCommit) document.removeEventListener("keydown", this._enterCommit); if (this._sessTick) clearInterval(this._sessTick); }

  // Load every persisted collection from localStorage into instance fields.
  // Reused on first mount, on undo/redo, and after a clear. `firstRun` (no saved
  // logs) seeds the demo scan list; a deliberate clear leaves logs empty.
  loadState() {
    this.stats = this._load("almanac.stats.v1", null) || { rsn: "Lumbridge Local", skills: DEMO_SKILLS, mode: "main", source: "demo", qpApi: null, at: 0, demo: true };
    this.skillsRaw = this.stats.skills;
    const savedLogs = this._load("almanac.logs.v1", null);
    this.logs = savedLogs || JSON.parse(JSON.stringify(D.seeds || {}));
    ["nw", "flips", "alch", "herb", "boss", "slayerLog", "watch", "scan", "drop"].forEach((k) => { if (!this.logs[k]) this.logs[k] = []; });
    if (!savedLogs && !this.logs.scan.length) this.logs.scan = JSON.parse(JSON.stringify(this.scanSeed));
    this.goals = this._load("almanac.goals.v1", null) || this.defaultGoals.map((x) => ({ ...x }));
    this.questOv = this._load("almanac.questdone.v1", null);
    if (!this.questOv) { this.questOv = {}; (D.quests || []).forEach((q) => { if (q.status === "Done") this.questOv[q.n] = true; }); this._save("almanac.questdone.v1", this.questOv); }
    // Diary + Combat Achievement completion, user-markable (seeded from the
    // static data statuses the first time, like quests).
    this.diaryOv = this._load("almanac.diarydone.v1", null);
    if (!this.diaryOv) { this.diaryOv = {}; (D.diaries || []).forEach((d) => { if (d.status === "Done") this.diaryOv[d.region + "|" + d.tier] = true; }); this._save("almanac.diarydone.v1", this.diaryOv); }
    this.caOv = this._load("almanac.cadone.v1", null) || {};
    this.flipcfg = this._load("almanac.flipcfg.v1", null) || { ...this.flipDefaults };
    this.alchcfg = this._load("almanac.alchcfg.v1", null) || { castsPerHour: 1200, fireSource: "staff", natRune: 127, fireRune: 5 };
    this.farmcfg = { lapsPerDay: 1, compost: "ultra", secateurs: true, farmCape: false, attas: false, herbsOverride: 0, patchOrder: null, patchOv: {}, runsPerDay: {}, herbCrop: "Snapdragon", runPriority: "gp", ...(this._load("almanac.farmcfg.v1", null) || {}) };
    if (!this.farmcfg.patchOv) this.farmcfg.patchOv = {};
    if (!this.farmcfg.runsPerDay) this.farmcfg.runsPerDay = {};
    this.compostPrices = this.compostPrices || { compost: 80, super: 450, ultra: 750 };
    this.gcfg = this._load("almanac.gcfg.v1", null) || { hoursPerDay: 2, bankGoal: 10000000000, baseGoal: 70 };
    this.blocks = this._load("almanac.blocks.v1", null);
    if (!this.blocks) { this.blocks = {}; (D.slayer || []).forEach((t) => { if (t.verdict === "Block") this.blocks[t.task] = true; }); }
    this.bossOv = this._load("almanac.bossov.v1", null) || {};
    this.objectives = this._load("almanac.objectives.v1", null) || this.defaultObjectives();
    this.avoidDismiss = this._load("almanac.avoiddismiss.v1", null) || {};
    this.loadout = this._load("almanac.loadout.v1", null) || { melee: {}, ranged: {}, magic: {} };
    this.gearOwned = this._load("almanac.gearowned.v1", null) || {};
    this.journal = this._load("almanac.journal.v1", null) || [];
    // Live boss field session (survives refresh/navigation; not an undo key —
    // ENDING a session writes the logs, and that write is the undo point).
    this.bossSession = this._load("almanac.bosssession.v1", null) || null;
  }

  // ---------- undo / redo ----------
  // Every persisted key. _save snapshots the *pre-mutation* state of these keys
  // (localStorage lags the in-memory mutation by one write), grouped per
  // synchronous action, so any add/edit/delete/config change is one undo step.
  _undoKeys = ["almanac.logs.v1", "almanac.goals.v1", "almanac.objectives.v1", "almanac.flipcfg.v1", "almanac.alchcfg.v1", "almanac.farmcfg.v1", "almanac.gcfg.v1", "almanac.blocks.v1", "almanac.bossov.v1", "almanac.questdone.v1", "almanac.stats.v1", "almanac.avoiddismiss.v1", "almanac.loadout.v1", "almanac.gearowned.v1", "almanac.diarydone.v1", "almanac.cadone.v1", "almanac.journal.v1"];
  _snap() { const s = {}; this._undoKeys.forEach((k) => { s[k] = localStorage.getItem(k); }); return s; }
  _restore(snap) {
    this._undoSuspended = true;
    this._undoKeys.forEach((k) => { const v = snap[k]; if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
    this.loadState();
    this._undoSuspended = false;
    this.bump();
  }
  undo = () => { if (!this._undoStack || !this._undoStack.length) return; (this._redoStack = this._redoStack || []).push(this._snap()); this._restore(this._undoStack.pop()); };
  redo = () => { if (!this._redoStack || !this._redoStack.length) return; (this._undoStack = this._undoStack || []).push(this._snap()); this._restore(this._redoStack.pop()); };
  clearAllLogs = () => {
    if (typeof window !== "undefined" && !window.confirm("Clear every logged entry (flips, kills, snapshots, herb runs, drops…)? You can undo this.")) return;
    const empty = {}; ["nw", "flips", "alch", "herb", "boss", "slayerLog", "watch", "scan", "drop"].forEach((k) => (empty[k] = []));
    this.logs = empty; this.saveLogs(); this.bump();
  };

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
    // User-marked completion wins (seeded once from static data); otherwise
    // derive Stat-ready vs Blocked from the gate text and live stats.
    if (this.diaryOv && this.diaryOv[d.region + "|" + d.tier]) return "Done";
    const lv = {}; this.skillsRaw.forEach(([nm, l]) => { lv[nm.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft;
    let ok = true; const re = /([A-Za-z]+)\s+(\d+)/g; let m;
    while ((m = re.exec(d.gate || ""))) { const sk = m[1].toLowerCase(), need = +m[2]; if (lv[sk] != null && lv[sk] < need) ok = false; }
    return ok ? "Stat-ready" : "Blocked";
  }
  cycleDiary = (region, tier) => { const k = region + "|" + tier; this.diaryOv[k] = !this.diaryOv[k]; this._save("almanac.diarydone.v1", this.diaryOv); this._pfCache = null; this.bump(); };
  cycleCa = (tier) => { this.caOv[tier] = !this.caOv[tier]; this._save("almanac.cadone.v1", this.caOv); this.bump(); };
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
  // GE sell tax: 2% per item, exempt under 50 gp, capped at 5M per item.
  flipTax(sell, qty) { return sell < 50 ? 0 : Math.min(5000000, Math.floor(sell * 0.02)) * qty; }
  computeFlip(f) {
    if (f.avgBuy != null && f.avgSell != null) {
      const qty = f.qty || 1; const tax = this.flipTax(f.avgSell, qty); const net = Math.round((f.avgSell - f.avgBuy) * qty - tax);
      const cost = f.avgBuy * qty; const roi = cost > 0 ? +((net / cost) * 100).toFixed(1) : 0;
      const hold = f.buyDate && f.sellDate ? Math.max(0, Math.round((new Date(f.sellDate) - new Date(f.buyDate)) / 86400000)) : 0;
      return { item: f.item, qty, avgBuy: f.avgBuy, avgSell: f.avgSell, buyDate: f.buyDate, sellDate: f.sellDate, notes: f.notes || "", tax, net, roi, hold, gpday: Math.round(net / Math.max(1, hold)) };
    }
    return { item: f.item, qty: f.qty || 0, avgBuy: 0, avgSell: 0, buyDate: f.date, sellDate: f.date, notes: f.notes || "", tax: 0, net: f.net || 0, roi: f.roi || 0, hold: 0, gpday: 0 };
  }
  // Margin capture rate: how much of the scanner's theoretical margin your
  // REAL flips actually banked. Each logged flip is matched by name to the
  // current market scan and graded realizedROI ÷ today's sanity-checked margin
  // on that same item (clamped 0–2 so one fluke can't dominate), weighted by
  // capital committed. Honest caveat baked into the labels: scans aren't
  // archived, so the yardstick is TODAY'S margin on the same items, not the
  // margin you saw the day you flipped.
  flipCapture() {
    const total = this.logs.flips.length;
    if (!this.priceRows || !this.priceRows.length || !total) return { rate: null, matched: 0, total };
    const byName = {}; this.priceRows.forEach((r) => { byName[(r.name || "").toLowerCase()] = r; });
    let wSum = 0, cSum = 0, matched = 0;
    this.logs.flips.forEach((f) => {
      const c = this.computeFlip(f);
      if (!(c.avgBuy > 0) || !(c.qty > 0)) return;
      const m = byName[(c.item || "").toLowerCase()];
      if (!m) return;
      // Same effective prices the scanner trades on (hourly-average sanity check).
      const has1h = m.hvol1h != null;
      const buy = has1h && m.avgLow1h > 0 ? Math.max(m.buy, m.avgLow1h) : m.buy;
      const sell = has1h && m.avgHigh1h > 0 ? Math.min(m.sell, m.avgHigh1h) : m.sell;
      if (!(buy > 0) || !(sell > 0)) return;
      const theo = ((sell - this.flipTax(sell, 1) - buy) / buy) * 100;
      if (theo < 0.05) return; // no meaningful margin today — nothing to grade against
      const w = c.avgBuy * c.qty;
      wSum += w; cSum += Math.max(0, Math.min(2, c.roi / theo)) * w; matched++;
    });
    return { rate: wSum > 0 ? cSum / wSum : null, matched, total };
  }
  alchCost() { const c = this.alchcfg; return c.fireSource === "staff" ? c.natRune : c.natRune + 5 * c.fireRune; }

  // ---------- farming yield model ----------
  // Can this account use a patch? Auto-derived from quest log + Farming level
  // + diary state; returns { ok, why } (why = the unmet gate when locked).
  patchAccess(pt) {
    if (pt.lvl && (this.skillMap.Farming || { l: 1 }).l < pt.lvl) return { ok: false, why: "needs Farming " + pt.lvl };
    if (pt.quest) { const q = (D.quests || []).find((x) => x.n === pt.quest); if (q && !this.questDone(q)) return { ok: false, why: "needs " + pt.quest }; }
    if (pt.diary) { const d = (D.diaries || []).find((x) => x.region === pt.diary[0] && x.tier === pt.diary[1]); if (!d || this.diaryStatus(d) !== "Done") return { ok: false, why: "needs " + pt.diary.join(" ") + " diary" }; }
    return { ok: true, why: "" };
  }
  // The patch roster in YOUR route order, each with auto access + your manual
  // override applied. This is the source of truth for patches/run.
  activePatches() {
    const cfg = this.farmcfg;
    const byId = {}; this.herbPatches.forEach((p) => (byId[p.id] = p));
    const saved = (cfg.patchOrder || []).filter((id) => byId[id]);
    const order = saved.concat(this.herbPatches.map((p) => p.id).filter((id) => !saved.includes(id)));
    return order.map((id) => {
      const pt = byId[id];
      const acc = this.patchAccess(pt);
      const ov = cfg.patchOv ? cfg.patchOv[id] : undefined;
      return { ...pt, auto: acc.ok, why: acc.why, overridden: ov !== undefined, active: ov !== undefined ? ov : acc.ok };
    });
  }
  movePatch = (id, dir) => { const order = this.activePatches().map((p) => p.id); const i = order.indexOf(id), j = i + dir; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; this.setFarmOpt("patchOrder", order); };
  // Drag-and-drop reordering: dropping INSERTS at the slot (everything below
  // shifts down one), unlike the arrows' single-step swap.
  dropPatch = (overIdx) => {
    // _pDrag is an instance field (not state): drop can fire before React
    // commits the dragover's setState, so state would be stale here.
    const id = this._pDrag; if (!id) return;
    const order = this.activePatches().map((p) => p.id);
    const from = order.indexOf(id); if (from < 0) return;
    let to = overIdx; order.splice(from, 1); if (to > from) to--;
    order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
    this._pDrag = null;
    this.setState({ pDrag: null, pOver: -1 });
    this.setFarmOpt("patchOrder", order);
  };
  // Per-run-type runs/day override. Empty input = back to the global default;
  // 0 = deliberately skip that run type.
  setRunsPerDay = (crop, raw) => { const m = { ...(this.farmcfg.runsPerDay || {}) }; if (("" + raw).trim() === "") delete m[crop]; else m[crop] = Math.max(0, Math.round(this.parseNum(raw) || 0)); this.setFarmOpt("runsPerDay", m); };
  togglePatch = (id, on) => { const ov = { ...(this.farmcfg.patchOv || {}) }; ov[id] = on; this.setFarmOpt("patchOv", ov); };
  autoPatch = (id) => { const ov = { ...(this.farmcfg.patchOv || {}) }; delete ov[id]; this.setFarmOpt("patchOv", ov); };
  // Everything the herb net/run needs, derived from the mechanics above +
  // your live Farming level + the run-mechanics controls. Patches/run and the
  // disease-free count come from the patch roster.
  herbYield() {
    const cfg = this.farmcfg;
    const L = Math.max(1, (this.skillMap.Farming || { l: 1 }).l);
    const co = this.herbCompost[cfg.compost] || this.herbCompost.ultra;
    const bonus = (cfg.secateurs ? 1.1 : 1) * (cfg.farmCape ? 1.05 : 1) * (cfg.attas ? 1.05 : 1);
    const interp = (25 * (99 - L) + 80 * (L - 1)) / 98;
    const p = Math.min(0.9, (1 + Math.floor(interp * bonus)) / 256);
    const perLive = co.lives / (1 - p);
    const surv = Math.pow(1 - co.d, 3);
    const act = this.activePatches().filter((x) => x.active);
    const P = act.length;
    const df = act.filter((x) => x.df).length;
    const ov = (cfg.herbsOverride || 0) > 0;
    // survival-weighted average herbs per patch across the circuit; an override
    // is treated as your OWN realized average (deaths already baked in).
    const eff = ov ? cfg.herbsOverride : P > 0 ? perLive * ((df + (P - df) * surv) / P) : 0;
    const compostCost = cfg.compost === "none" ? 0 : (this.compostPrices || {})[cfg.compost] || 0;
    return { L, p, lives: co.lives, perLive, surv, P, df, eff, ov, compostCost, patches: act };
  }
  // The yield model's survival-weighted herbs/patch at an arbitrary Farming
  // level (current compost/gear/roster config) — powers the model-vs-reality
  // curve over your logged runs.
  herbEffAt(L) {
    const cfg = this.farmcfg;
    const co = this.herbCompost[cfg.compost] || this.herbCompost.ultra;
    const bonus = (cfg.secateurs ? 1.1 : 1) * (cfg.farmCape ? 1.05 : 1) * (cfg.attas ? 1.05 : 1);
    const interp = (25 * (99 - L) + 80 * (L - 1)) / 98;
    const p = Math.min(0.9, (1 + Math.floor(interp * bonus)) / 256);
    const perLive = co.lives / (1 - p);
    const surv = Math.pow(1 - co.d, 3);
    const act = this.activePatches().filter((x) => x.active);
    const P = Math.max(1, act.length), df = Math.min(P, act.filter((x) => x.df).length);
    return perLive * ((df + (P - df) * surv) / P);
  }
  // Net gp for one full herb run of a tier: every patch pays seed + compost,
  // harvested herbs (yield model) sell after the 2% GE tax.
  farmNet(f) {
    const y = this.herbYield();
    return Math.round(y.P * (y.eff * geSellNet(f.herb) - f.seed - y.compostCost));
  }
  // XP for one herb run of a tier, from the same yield model.
  herbXpRun(f) { const y = this.herbYield(); return Math.round(y.P * ((f.plantXp || 0) + (f.harvestXp || 0) * y.eff)); }
  // Tithe Farm xp per 1h session, by unlocked fruit tier (34/54/74).
  titheXpRun() { const l = (this.skillMap.Farming || { l: 1 }).l; return l >= 74 ? 90000 : l >= 54 ? 55000 : l >= 34 ? 34000 : 0; }
  // The herb crop you've CHOSEN to run (feeds the circuit + KPIs); falls back
  // to the best tier you can plant.
  selHerbCrop() { const f = this.farmDefs.find((x) => x.tier === this.farmcfg.herbCrop); if (f) return f; const lvl = (this.skillMap.Farming || { l: 1 }).l; return this.farmDefs.filter((x) => lvl >= x.lvl).pop() || this.farmDefs[0]; }
  // ---------- run advisor ----------
  // Scores every run type by your ACTIVE minutes — grow time is free, attention
  // isn't. gp includes seeds, compost and protection payments at live prices;
  // money-losing runs are judged as XP PURCHASES by their gp-per-xp price.
  farmAdvisor() {
    const farmLvl = (this.skillMap.Farming || { l: 1 }).l;
    const mode = this.farmcfg.runPriority === "xp" ? "xp" : "gp";
    const sel = this.selHerbCrop();
    const rows = [];
    this.farmDefs.forEach((f) => rows.push({ key: "herb-" + f.tier, name: "Herb run · " + f.tier, req: f.lvl, time: 6, growHrs: 1.33, xpRun: this.herbXpRun(f), gpRun: this.farmNet(f), herbTier: f.tier, selected: sel.tier === f.tier }));
    this.farmRunDefs.filter((r) => !/herb/i.test(r.type || "")).forEach((r) => rows.push({ key: r.rdKey, name: r.name + (r.crop && r.crop !== "—" ? " · " + r.crop : ""), req: r.req, time: r.timeMin, growHrs: r.growHrs, xpRun: r.rdKey === "Tithe" ? this.titheXpRun() : r.xpRun, gpRun: r.gpRun, note: r.note }));
    rows.forEach((c) => {
      c.unlocked = farmLvl >= c.req;
      c.gpm = Math.round(c.gpRun / Math.max(1, c.time));
      c.xpm = Math.round(c.xpRun / Math.max(1, c.time));
      c.capDay = c.growHrs > 0 ? +(24 / c.growHrs).toFixed(2) : 24;
      c.costPerXp = c.gpRun < 0 && c.xpRun > 0 ? +(-c.gpRun / c.xpRun).toFixed(1) : 0;
    });
    const act = rows.filter((c) => c.unlocked).sort((a, b) => (mode === "gp" ? b.gpm - a.gpm : b.xpm - a.xpm));
    const locked = rows.filter((c) => !c.unlocked).sort((a, b) => a.req - b.req);
    act.forEach((c, i) => {
      if (mode === "gp") {
        c.verdict = c.gpRun > 0 ? (i === 0 ? "BEST MONEY" : "PROFITABLE") : c.gpRun === 0 ? "XP / REWARDS" : "XP PURCHASE";
        c.vc = c.gpRun > 0 ? C.green : c.gpRun === 0 ? "#9a7530" : C.red;
        c.why = c.gpRun > 0 ? this.short(c.gpm) + "/active min · up to " + this.short(c.gpRun * Math.min(c.capDay, 24)) + "/day at " + c.capDay + " runs" : c.gpRun === 0 ? "costs nothing — do it for the xp & unlocks, not the gp" : "loses " + this.short(-c.gpRun) + "/run — do it for the xp (" + c.costPerXp + " gp/xp), not the gp";
      } else {
        c.verdict = i === 0 ? "BEST XP" : c.costPerXp === 0 ? "FREE XP" : c.costPerXp <= 15 ? "EFFICIENT XP" : c.costPerXp <= 30 ? "FAIR PRICE" : "PREMIUM XP";
        c.vc = i === 0 || c.costPerXp <= 15 ? C.green : c.costPerXp <= 30 ? "#9a7530" : C.red;
        c.why = this.fmt(c.xpm) + " xp/active min" + (c.costPerXp ? " · " + c.costPerXp + " gp/xp" : c.gpRun > 0 ? " · PAYS you " + this.short(c.gpRun) + "/run" : " · costs nothing") + (c.capDay < 24 ? " · max " + c.capDay + "/day" : "");
      }
    });
    return { mode, rows: act, locked, top: act[0] || null };
  }
  setFarmOpt = (k, v) => { this.farmcfg[k] = v; this._save("almanac.farmcfg.v1", this.farmcfg); this.bump(); };

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
    this.setState({ priceStatus: "Scanning the live market…" });
    try {
      const { byName, byId } = await fetchPrices({ maxAgeMs: 0 }); const now = Date.now() / 1000; let n = 0;
      // A flip quote is only as fresh as its STALER side — you need both a live
      // insta-sell (your buy) and a live insta-buy (your sell). Using the fresher
      // side let one-sided stale quotes show phantom margins that passed the
      // freshness gate.
      const quoteAge = (m) => { const oldest = Math.min(m.highTime || 0, m.lowTime || 0); return oldest > 0 ? Math.max(0, (now - oldest) / 60 | 0) : 9999; };
      this.logs.scan.forEach((it) => { const m = byName[(it.name || "").toLowerCase()]; if (m) { if (m.low) it.buy = m.low; if (m.high) it.sell = m.high; if (m.limit) it.limit = m.limit; if (m.volume) it.vol = m.volume; it.age = quoteAge(m); n++; } });
      this.alchItems.forEach((a) => { const m = byName[a.item.toLowerCase()]; if (m) { if (m.high) a.buy = m.high; if (m.highalch) a.alch = m.highalch; if (m.limit) a.limit = m.limit; } });
      const nat = byName["nature rune"]; if (nat && (nat.high || nat.low)) { this.alchcfg.natRune = nat.high || nat.low; this._save("almanac.alchcfg.v1", this.alchcfg); }
      // Farming: re-price seeds, herbs, compost and saplings from the live feed.
      // (net/run itself is always computed on demand by farmNet() from the
      // yield model, so the run-mechanics controls react instantly.)
      this.farmDefs.forEach((f) => {
        const s = byName[(f.seedItem || "").toLowerCase()], h = byName[(f.herbItem || "").toLowerCase()];
        if (!s || !h) return;
        const seed = s.high || s.low, herb = h.low || h.high; // pay the ask for seeds, insta-sell the grimys
        if (seed) f.seed = seed; if (herb) f.herb = herb;
      });
      Object.entries(this.herbCompost).forEach(([k, co]) => { if (!co.item) return; const m = byName[co.item.toLowerCase()]; if (m && (m.high || m.low)) this.compostPrices[k] = m.high || m.low; });
      this.farmRunDefs.forEach((r) => {
        if (/herb/i.test(r.type || "")) return; // herb run net comes from farmNet()
        const sap = byName[(r.sapItem || "").toLowerCase()];
        const pay = r.payItem ? byName[r.payItem.toLowerCase()] : null;
        if (sap && (sap.high || sap.low)) {
          const payCost = pay && (pay.high || pay.low) ? (r.payQty || 0) * (pay.high || pay.low) : 0;
          r.gpRun = -Math.round((r.patches || 1) * ((sap.high || sap.low) + payCost));
        }
      });
      // Keep the whole tradeable market so the scanner ranks real flips, not just
      // a handful of seed items. Drop items with no live buy & sell.
      this.priceRows = Object.values(byId).filter((m) => m.high > 0 && m.low > 0).map((m) => ({ name: m.name, buy: m.low, sell: m.high, vol: m.volume || 0, limit: m.limit || 0, age: quoteAge(m), avgHigh1h: m.avgHigh1h, avgLow1h: m.avgLow1h, hvol1h: m.hvol1h, lvol1h: m.lvol1h }));
      this.saveLogs(); this.setState({ priceStatus: `Scanned ${this.priceRows.length.toLocaleString()} items · ${new Date().toLocaleTimeString()}` });
    } catch (err) { this.setState({ priceStatus: "Live market unavailable right now — using your manual list." }); }
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
  go = (s) => { this.setState({ section: s, openForm: null }); if ((s === "flipping" || s === "farming") && !this.priceRows && !this._marketLoading) { this._marketLoading = true; this.refreshPrices(); } };
  setLens = (id) => this.setState({ counselLens: id });
  setGoal = (id) => { this.setState({ goalId: id }); this._save("almanac.counselgoal.v1", id); };
  setPfSort = (id) => this.setState({ pfSort: id });
  resetFlipCfg = () => { this.flipcfg = { ...this.flipDefaults }; this._save("almanac.flipcfg.v1", this.flipcfg); this.setState((s) => ({ flipCfgVer: s.flipCfgVer + 1 })); };
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
  addWatch = () => { const item = this.val("watch_item"); if (!item) return; const type = this.val("watch_type") || "watch"; this.logs.watch.unshift({ item, type, note: this.val("watch_note") }); this.saveLogs(); this.setState({ openForm: null }); };
  dismissAvoid = (item) => { this.avoidDismiss[(item || "").toLowerCase()] = true; this._save("almanac.avoiddismiss.v1", this.avoidDismiss); this.bump(); };
  undismissAvoid = (item) => { delete this.avoidDismiss[(item || "").toLowerCase()]; this._save("almanac.avoiddismiss.v1", this.avoidDismiss); this.bump(); };
  // Decide whether an item's flip history flags it. Avoid triggers (any):
  // net-negative over ≥3 flips, ≤33% win over ≥3, or one flip ≤ −10% ROI.
  // Dead-capital (only if not avoided): ≥3 flips, net ≥ 0 but avg ROI < 1%.
  flipFlag(p) {
    const winRate = p.flips ? p.wins / p.flips : 0, avgRoi = p.flips ? p.roiSum / p.flips : 0;
    if (p.flips >= 3 && p.net < 0) return { tier: "avoid", reason: `${this.signed(p.net)} over ${p.flips} flips · ${Math.round(winRate * 100)}% win` };
    if (p.flips >= 3 && winRate <= 1 / 3) return { tier: "avoid", reason: `only ${Math.round(winRate * 100)}% win over ${p.flips} flips` };
    if (p.worstRoi <= -10) return { tier: "avoid", reason: `a flip at ${p.worstRoi.toFixed(1)}% ROI` };
    if (p.flips >= 3 && p.net >= 0 && avgRoi < 1) return { tier: "dead", reason: `avg ROI ${avgRoi.toFixed(1)}% · ties up a GE slot` };
    return null;
  }
  // Shared watch/avoid model used by both the Performance tab and the scanner.
  flipAvoidList() {
    const perf = {};
    this.logs.flips.map((f) => this.computeFlip(f)).forEach((f) => {
      if (!perf[f.item]) perf[f.item] = { item: f.item, flips: 0, net: 0, roiSum: 0, holdSum: 0, wins: 0, worstRoi: Infinity };
      const p = perf[f.item]; p.flips++; p.net += f.net; p.roiSum += f.roi; p.holdSum += f.hold; if (f.net > 0) p.wins++; p.worstRoi = Math.min(p.worstRoi, f.roi);
    });
    const manual = this.logs.watch.map((w, i) => ({ ...w, i, type: w.type || "watch" }));
    const manualLc = new Set(manual.map((m) => m.item.toLowerCase()));
    const auto = Object.values(perf).map((p) => ({ p, flag: this.flipFlag(p) })).filter((x) => x.flag && !manualLc.has(x.p.item.toLowerCase()) && !this.avoidDismiss[x.p.item.toLowerCase()]);
    const byName = new Map();
    manual.filter((m) => m.type === "avoid").forEach((m) => byName.set(m.item.toLowerCase(), { tier: "avoid", reason: m.note || "manually avoided" }));
    auto.forEach((x) => byName.set(x.p.item.toLowerCase(), { tier: x.flag.tier, reason: x.flag.reason }));
    return { manual, auto, byName, perf };
  }
  addAlch = () => { const casts = this.num("alch_casts"); if (casts <= 0) return; const item = this.val("alch_item") || "High alch", alchVal = this.num("alch_alch"), buy = this.num("alch_buy"); this.logs.alch.unshift({ date: this.today(), item, casts, alchVal, buy, net: (alchVal - buy - this.alchCost()) * casts, xp: casts * 65 }); this.saveLogs(); this.setState({ openForm: null }); };
  // Log a herb run. If per-patch harvest counts were filled in, the entry keeps
  // the per-patch detail and prices the ACTUAL herbs picked (costs still paid on
  // every active patch); otherwise it falls back to the model estimate.
  addHerb = () => {
    const tier = this.val("herb_tier") || "Snapdragon", runs = this.num("herb_runs") || 1, netOv = this.num("herb_net");
    const def = this.farmDefs.find((f) => f.tier === tier);
    const y = this.herbYield();
    const perPatch = {}; let herbs = 0, filled = false;
    y.patches.forEach((p) => { const n = this.num("herb_p_" + p.id); perPatch[p.id] = n; if (n > 0) { filled = true; herbs += n; } });
    let net;
    if (netOv > 0) net = netOv;
    else if (filled && def) net = Math.round(herbs * geSellNet(def.herb) - y.P * (def.seed + y.compostCost)) * runs;
    else net = def ? this.farmNet(def) * runs : 0;
    // Stamp the Farming level the run happened at — straight from the live
    // hiscores stats of the day, never asked for.
    const entry = { date: this.today(), tier, runs, net, lvl: (this.skillMap.Farming || { l: 1 }).l };
    if (filled) { entry.herbs = herbs; entry.patchN = y.P; entry.perPatch = perPatch; }
    this.logs.herb.unshift(entry); this.saveLogs(); this.setState({ openForm: null });
  };
  // Minutes are optional — a timed entry is what turns the kill log into a
  // measured kills/hr (Session Rates grades your reality against the book).
  addBoss = () => { const boss = this.val("boss_name") || D.bosses[0].n, kills = this.num("boss_kills") || 1, mins = this.num("boss_mins"), loot = this.num("boss_loot"); const entry = { date: this.today(), boss, kills, note: this.val("boss_note") }; if (mins > 0) entry.mins = Math.round(mins); if (loot > 0) entry.loot = Math.round(loot); this.logs.boss.unshift(entry); this.saveLogs(); this.setState({ openForm: null }); };
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
  // Your logged reality for a boss, from the same two logs the Focus tab uses:
  //   kills/hr  — timed kill-log sessions only (entries carrying minutes)
  //   gp/kill   — priced drop log ÷ ALL logged KC. Only uniques get logged, so
  //               this is a floor (no commons/supply drops) — labeled as such.
  //   gp/hr     — the two combined: your pace × your loot per kill.
  bossReality(name) {
    let mins = 0, timedKills = 0, kcLog = 0, lootTimed = 0, lootMins = 0;
    this.logs.boss.forEach((b) => {
      if (b.boss !== name) return;
      kcLog += b.kills || 0;
      if (b.mins > 0) { mins += b.mins; timedKills += b.kills || 0; if (b.loot > 0) { lootTimed += b.loot; lootMins += b.mins; } }
    });
    const dropKc = Math.max(0, ...this.logs.drop.filter((d) => d.boss === name).map((d) => d.kc || 0));
    const kcAll = Math.max(kcLog, dropKc);
    const drops = this.bossDrops[name] || [];
    let lootGp = 0, dropsN = 0;
    this.logs.drop.forEach((d) => { if (d.boss !== name) return; const dr = drops.find((x) => x.n === d.drop); if (dr && dr.v > 0) { lootGp += dr.v; dropsN++; } });
    const kph = mins > 0 ? (timedKills * 60) / mins : null;
    // gp/hr, best source first: full session loot over timed minutes (field
    // sessions record it) beats the uniques-only floor from the drop log.
    const gpHrLoot = lootMins > 0 ? Math.round((lootTimed * 60) / lootMins) : null;
    const gpKill = kcAll > 0 && dropsN > 0 ? lootGp / kcAll : null;
    const gpHrUniq = kph != null && gpKill != null ? Math.round(kph * gpKill) : null;
    const gpHr = gpHrLoot != null ? gpHrLoot : gpHrUniq;
    return { kph: kph != null ? Math.round(kph * 10) / 10 : null, gpHr, gpSrc: gpHrLoot != null ? "logged loot" : "uniques only", mins, timedKills, dropsN, kcAll };
  }
  // One click writes BOTH measured rates into the override store (single save =
  // single undo step), so every engine downstream runs on your numbers.
  adoptBossReality = (boss, r) => { if (r.kph == null && r.gpHr == null) return; if (!this.bossOv[boss]) this.bossOv[boss] = {}; if (r.kph != null) this.bossOv[boss].kills = Math.max(1, Math.round(r.kph)); if (r.gpHr != null) this.bossOv[boss].gpHr = Math.max(0, Math.round(r.gpHr)); this._save("almanac.bossov.v1", this.bossOv); this.bump(); };

  // ---------- live boss field session ----------
  // Start at the boss (usually from its battle guide — boss pre-filled), tap
  // kills as they land, log drops from the boss's own table, and the clock
  // measures your kills/hr for you. Ending writes ONE kill-log entry
  // (kills + minutes + loot) and the drop-log entries in a single undo step.
  _saveSess() { this._save("almanac.bosssession.v1", this.bossSession); }
  startBossSession = (boss) => {
    if (this.bossSession || !boss) return;
    this.bossSession = { boss, startAt: Date.now(), kills: 0, otherLoot: 0, drops: [] };
    this._saveSess();
    this.refreshDropPrices(); // price the drop table live so logged loot is honest
    this.setState({ sessQ: "" });
  };
  sessKills = (n) => { const s = this.bossSession; if (!s) return; s.kills = Math.max(0, (s.kills || 0) + n); s.lastAt = Date.now(); this._saveSess(); this.bump(); };
  sessLoot = (raw) => { const s = this.bossSession; if (!s) return; s.otherLoot = Math.max(0, Math.round(this.parseNum(raw) || 0)); this._saveSess(); this.bump(); };
  sessAddDrop = (name, val, qty) => {
    const s = this.bossSession; if (!s || !name) return;
    const tbl = (this.bossDrops[s.boss] || []).find((d) => d.n.toLowerCase() === name.toLowerCase());
    // Instant placeholder (table value / last market scan), then the REAL
    // number: every drop re-prices its UNIT value from the live GE feed the
    // moment it's logged — the row's worth is qty × that kill-time quote, so
    // a 500-rune drop is 500 × today's rune price, not a stale table guess.
    // A hand-edited unit value is never overwritten.
    let v = val != null ? val : tbl ? tbl.v : 0;
    if (!v && this.priceRows) { const m = this.priceRows.find((r) => (r.name || "").toLowerCase() === name.toLowerCase()); if (m) v = m.sell || m.buy || 0; }
    const drop = { n: tbl ? tbl.n : name, v: v || 0, q: Math.max(1, Math.round(qty || 1)), at: Date.now(), tbl: !!tbl, src: tbl ? "table" : "" };
    s.drops.push(drop);
    s.lastAt = Date.now();
    this._saveSess(); this.setState({ sessQ: "", sessOpen: false });
    fetchPrices().then(({ byName }) => {
      const cur = this.bossSession;
      if (!cur || cur !== s || !cur.drops.includes(drop) || drop.src === "manual") return;
      const m = byName[drop.n.toLowerCase().replace(/\s*\(pet\)/, "")];
      if (m && (m.high || m.low)) { drop.v = m.high || m.low; drop.src = "live"; this._saveSess(); this.bump(); }
    }).catch(() => {});
  };
  sessSetDropV = (i, raw) => { const s = this.bossSession; if (!s || !s.drops[i]) return; const v = Math.max(0, Math.round(this.parseNum(raw) || 0)); if (v === s.drops[i].v) return; s.drops[i].v = v; s.drops[i].src = "manual"; this._saveSess(); this.bump(); };
  // Quantity is independent of price provenance — the unit quote stays live.
  sessSetDropQ = (i, raw) => { const s = this.bossSession; if (!s || !s.drops[i]) return; s.drops[i].q = Math.max(1, Math.round(this.parseNum(raw) || 1)); this._saveSess(); this.bump(); };
  // Session loot: Σ qty × unit value across logged drops.
  sessDropGp(s) { return (s.drops || []).reduce((a, d) => a + (d.v || 0) * (d.q || 1), 0); }
  // "500 death rune" / "death rune x500" → { qty, rest } for the drop picker.
  sessParseQty(q) {
    let m = (q || "").match(/^\s*(\d[\d,]*)\s*[x×]?\s+(.+)$/);
    if (m) return { qty: parseInt(m[1].replace(/,/g, ""), 10), rest: m[2] };
    m = (q || "").match(/^(.+?)\s*[x×]\s*(\d[\d,]*)\s*$/i);
    if (m) return { qty: parseInt(m[2].replace(/,/g, ""), 10), rest: m[1] };
    return { qty: 1, rest: q || "" };
  }
  sessDelDrop = (i) => { const s = this.bossSession; if (!s) return; s.drops.splice(i, 1); this._saveSess(); this.bump(); };
  endBossSession = (save) => {
    const s = this.bossSession; if (!s) return;
    if (save && ((s.kills || 0) > 0 || s.drops.length > 0)) {
      const mins = Math.max(1, Math.round((Date.now() - s.startAt) / 60000));
      const dropGp = this.sessDropGp(s);
      const loot = dropGp + (s.otherLoot || 0);
      // Drops land at your KC as of the END of this session.
      const priorKc = this.logs.boss.filter((x) => x.boss === s.boss).reduce((a, x) => a + (x.kills || 0), 0);
      const priorDropKc = Math.max(0, ...this.logs.drop.filter((d) => d.boss === s.boss).map((d) => d.kc || 0));
      const kcNow = Math.max(priorKc, priorDropKc) + (s.kills || 0);
      if ((s.kills || 0) > 0) {
        const entry = { date: this.today(), boss: s.boss, kills: s.kills, mins, note: "field session" + (s.drops.length ? ` · ${s.drops.length} drop${s.drops.length > 1 ? "s" : ""}` : "") };
        if (loot > 0) entry.loot = loot;
        this.logs.boss.unshift(entry);
      }
      s.drops.forEach((d) => { if (d.tbl) this.logs.drop.unshift({ date: this.today(), boss: s.boss, drop: d.n, kc: kcNow }); });
      this.saveLogs();
    }
    this.bossSession = null; this._save("almanac.bosssession.v1", null); this.setState({ sessQ: "" });
  };
  // Fuzzy scorer for the drop picker: substring beats subsequence, earlier and
  // tighter matches rank higher. Returns -1 for no match.
  fuzzyScore(q, s) {
    q = (q || "").toLowerCase(); s = (s || "").toLowerCase();
    if (!q) return 0;
    const ix = s.indexOf(q); if (ix >= 0) return 1000 - ix;
    let i = 0, gaps = 0, last = -2;
    for (let j = 0; j < s.length && i < q.length; j++) if (s[j] === q[i]) { if (last >= 0 && last !== j - 1) gaps++; last = j; i++; }
    return i === q.length ? 500 - gaps * 25 - s.length : -1;
  }
  // Ranked drop-picker options: the boss's own table first (empty query shows
  // it whole, uniques on top), then the full GE list for off-table loot.
  sessDropOptions(boss, q) {
    const tbl = this.bossDrops[boss] || [];
    const catRank = { unique: 0, tertiary: 1, common: 2 };
    const own = tbl.map((d) => ({ n: d.n, v: d.v, cat: d.cat || "common", tbl: true, sc: this.fuzzyScore(q, d.n) }))
      .filter((d) => d.sc >= 0)
      .sort((a, b) => b.sc - a.sc || (catRank[a.cat] ?? 3) - (catRank[b.cat] ?? 3));
    if (!q || q.length < 2) return own.slice(0, 10);
    const have = new Set(own.map((d) => d.n.toLowerCase()));
    const ge = (this.itemNames || []).map((n) => ({ n, sc: this.fuzzyScore(q, n) }))
      .filter((d) => d.sc >= 0 && !have.has(d.n.toLowerCase()))
      .sort((a, b) => b.sc - a.sc).slice(0, 5)
      .map((d) => ({ n: d.n, v: 0, cat: "market", tbl: false, sc: d.sc }));
    return own.slice(0, 8).concat(ge);
  }

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
              <div style={{ display: "flex", gap: 4, paddingRight: 6, marginRight: 2, borderRight: "1px solid rgba(44,32,19,.2)" }}>
                <Btn tone="quiet" onClick={this.undo} style={{ opacity: (this._undoStack || []).length ? 1 : 0.4 }}>↶ Undo</Btn>
                <Btn tone="quiet" onClick={this.redo} style={{ opacity: (this._redoStack || []).length ? 1 : 0.4 }}>↷ Redo</Btn>
                <Btn tone="quiet" onClick={this.clearAllLogs} style={{ color: C.red }}>⌫ Clear all</Btn>
              </div>
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
            {sec === "pathfinder" && this.renderPathfinder()}
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
            {sec === "journal" && this.renderJournal()}
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

  // Parse the OSRS-Wiki recommended combat style(s) out of a boss's style text.
  // Primary = first style the wiki lists; "Any"/"All 3" → all three viable.
  bossStyles(b) {
    const s = (b.style || "").toLowerCase();
    const found = [];
    const mi = s.indexOf("melee"); if (mi >= 0) found.push(["Melee", mi]);
    const ri = s.indexOf("range"); if (ri >= 0) found.push(["Ranged", ri]);
    const gi = s.indexOf("mag"); if (gi >= 0) found.push(["Magic", gi]);
    found.sort((a, b) => a[1] - b[1]);
    let all = found.map((f) => f[0]);
    if (!all.length) all = ["Melee", "Ranged", "Magic"];
    return { primary: all[0], all, note: b.style };
  }
  // Best gear the player can actually use for a style, one piece per slot, drawn
  // from GEAR_DATA (highest tier whose stat requirement is met).
  bestGearForStyle(styleName) {
    const key = { Melee: "melee", Ranged: "ranged", Magic: "magic" }[styleName] || "melee";
    const lvlFor = { att: "Attack", str: "Strength", def: "Defence", range: "Ranged", mage: "Magic", pray: "Prayer", hp: "Hitpoints" };
    const sm = this.skillMap;
    return (GEAR_DATA[key] || []).map((s) => {
      const usable = (s.items || []).filter((it) => { const sk = lvlFor[it.gs]; const lv = sk ? (sm[sk] || { l: 1 }).l : 99; return (it.lvl || 1) <= lv; });
      const best = usable.slice().sort((a, b) => (b.lvl || 0) - (a.lvl || 0))[0];
      return best ? { slot: s.slot, key, ...best } : null;
    }).filter(Boolean);
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

  // ===================== ORACLE COUNSEL + PATHFINDER ENGINES =====================
  // Data-driven recommendation engines over the ACTIVITIES_DATA library and the
  // SKILL_MILESTONES ladders (ported from the prototype). gp stays LIVE (via the
  // activityPrices service), xp stays STABLE, and the player's own logs override
  // library estimates wherever they exist ("your data" vs "estimate").

  // Skill-name -> level map (lowercase keys) + a runecrafting alias.
  _lvMap() { const lv = {}; this.skillsRaw.forEach(([n, l]) => { lv[n.toLowerCase()] = l; }); lv.runecrafting = lv.runecraft; return lv; }
  // Parse "70 Attack, Slayer 95"-style gate text into [{skill,lvl}].
  gateSkills(str) {
    const out = []; if (!str) return out;
    const SK = this._skillSet || (this._skillSet = { attack: 1, strength: 1, defence: 1, hitpoints: 1, ranged: 1, prayer: 1, magic: 1, runecraft: 1, construction: 1, agility: 1, herblore: 1, thieving: 1, crafting: 1, fletching: 1, slayer: 1, hunter: 1, mining: 1, smithing: 1, fishing: 1, cooking: 1, firemaking: 1, woodcutting: 1, farming: 1, combat: 1 });
    const re = /([A-Za-z][A-Za-z']+)\s+(\d+)|(\d+)\s+([A-Za-z][A-Za-z']+)/g; let m;
    while ((m = re.exec(str))) {
      let sk, lvl;
      if (m[1]) { sk = m[1].toLowerCase(); lvl = +m[2]; } else { sk = m[4].toLowerCase(); lvl = +m[3]; }
      if (sk === "runecrafting") sk = "runecraft";
      if (SK[sk]) out.push({ skill: sk, lvl });
    }
    return out;
  }
  // Quest names mentioned in free text (word-boundary match against D.quests).
  _canonQuests() { if (this._canonQ) return this._canonQ; this._canonQ = (D.quests || []).map((q) => q.n).sort((a, b) => b.length - a.length); return this._canonQ; }
  questsInText(text) {
    if (!text) return []; const t = "" + text; const out = [];
    this._canonQuests().forEach((nm) => {
      let idx = t.indexOf(nm);
      while (idx >= 0) { const b = idx === 0 ? " " : t[idx - 1]; const a = idx + nm.length >= t.length ? " " : t[idx + nm.length]; if (!/[A-Za-z0-9]/.test(b) && !/[A-Za-z0-9]/.test(a)) { out.push(nm); break; } idx = t.indexOf(nm, idx + 1); }
    });
    return out;
  }
  bossReqQuestsC(b) { const M = CONTENT_REQS.bosses || {}; if (M[b.n]) return M[b.n].slice(); return this.questsInText(b.req || ""); }
  taskReqQuestsC(name) { const M = CONTENT_REQS.tasks || {}; return (M[name] || []).slice(); }
  questDeps(name) { return QUEST_DEPS[name] || []; }

  counselLensDefs() {
    return [
      { id: "balanced", label: "Balanced", w: [0.30, 0.16, 0.26, 0.14, 0.14], dom: {} },
      { id: "gold", label: "Gold", w: [0.52, 0.05, 0.22, 0.06, 0.15], dom: {} },
      { id: "xp", label: "XP", w: [0.07, 0.48, 0.17, 0.20, 0.08], dom: {} },
      { id: "unlock", label: "Unlock", w: [0.14, 0.09, 0.55, 0.10, 0.12], dom: {} },
      { id: "complete", label: "Complete", w: [0.14, 0.12, 0.28, 0.18, 0.12], dom: { quest: 1.5, diary: 1.5, ca: 1.4 } },
    ];
  }
  // ---- Activities library adapters (Oracle candidate source) ----
  _actById() { if (this._actByIdCache) return this._actByIdCache; const m = {}; ACTIVITIES_DATA.forEach((a) => { m[a.id] = a; }); this._actByIdCache = m; return m; }
  // gp normalized to hourly — daily/run loops must NOT be annualized as
  // continuous income: hr→rate; run→rate×perDay/5; day→rate/5. Rates come from
  // the live price service when the row is computed, else the snapshot.
  activityGpHr(a) { if (!a || !a.gp) return 0; let r = liveGpRate(a); if (r < 0) return 0; const per = a.gp.per || "hr"; if (per === "hr") return r; const perDay = (a.loop && a.loop.perDay) || 4; if (per === "run") return Math.round((r * perDay) / 5); if (per === "day") return Math.round(r / 5); return r; }
  activityXpHr(a) { if (!a || !a.xp || !a.xp.length) return 0; let best = 0; a.xp.forEach((x) => { let r = x.rate || 0; if ((x.per || "hr") === "run") { const dm = (a.loop && a.loop.durationMin) || 10; r = r * (60 / dm); } if (r > best) best = r; }); return Math.round(best); }
  // 0-100 reachability: count unmet HARD reqs, then dock for the SIZE of the
  // biggest skill/combat gap so a 94-level wall reads deeply-locked.
  activityAccess(a, lv, combat, isDone, questByName) {
    const r = a.reqs || {}; let unmet = 0, total = 0, worstGap = 0;
    const sk = r.skills || {};
    Object.keys(sk).forEach((k) => { if (sk[k] > 1) { total++; const cur = lv[k] || 1; if (cur < sk[k]) { unmet++; worstGap = Math.max(worstGap, (sk[k] - cur) / Math.max(1, sk[k])); } } });
    if (r.combat) { total++; if (combat < r.combat) { unmet++; worstGap = Math.max(worstGap, (r.combat - combat) / Math.max(1, r.combat)); } }
    (r.quests || []).forEach((nm) => { const q = questByName[nm]; if (!q) return; total++; if (!isDone(q)) unmet++; });
    // NOTE (deferred): reqs.items possession isn't gated — the app doesn't track
    // inventory. Quest-chain depth is also deferred here: a quest counts as ONE
    // gate regardless of its prereq chain length (QUEST_DEPS could weight it;
    // the Pathfinder's cascade already consumes that graph).
    if (total === 0 || unmet === 0) return 100;
    let acc = unmet === 1 ? 62 : Math.max(15, Math.round(100 - unmet * 28));
    acc = Math.round(acc * (1 - Math.min(0.75, worstGap)));
    return Math.max(8, acc);
  }
  // Personalize an activity's gp from the USER's own logs/config where they have
  // it (their farm-run nets, their alch margins, their flip ROI × current cash).
  // Falls back to the library snapshot otherwise. Returns {perRun}|{gpHr,metric}|null.
  _userGp(a, lv) {
    if (!a) return null; const id = a.id;
    if (id === "herb-run") {
      const fl = (lv && lv.farming) || 1;
      const best = (this.farmDefs || []).filter((d) => fl >= d.lvl).map((d) => this.farmNet(d)).sort((a, b) => b - a)[0];
      if (best > 0) return { perRun: best };
    } else if (id === "high-alch") {
      const cost = this.alchCost ? this.alchCost() : 180; let best = 0;
      (this.alchItems || []).forEach((it) => { const m = (it.alch || 0) - (it.buy || 0) - cost; if (m > best) best = m; });
      if (best > 0) { let cph = (this.alchcfg && this.alchcfg.castsPerHour) || 1200; if (!(cph > 0) || cph > 1400) cph = 1200; /* ~1200/hr is the physical alch ceiling; guard bad config */ return { gpHr: Math.min(Math.round(best * cph), 900000) }; }
    } else if (id === "ge-flipping") {
      const flips = (this.logs && this.logs.flips) || []; if (!flips.length) return null;
      let roiSum = 0, n = 0;
      flips.forEach((f) => { try { const c = this.computeFlip(f); if (c && isFinite(c.roi)) { roiSum += c.roi; n++; } } catch (e) {} });
      if (!n) return null; const avgRoi = roiSum / n;
      const cash = this.logs && this.logs.nw && this.logs.nw.length ? this.logs.nw[this.logs.nw.length - 1].cash || 0 : 0;
      if (cash > 0) { const est = Math.round((cash * avgRoi) / 100); return { gpHr: est, metric: this.short(est) + "/cycle · " + avgRoi.toFixed(1) + "% ROI" }; }
      return { gpHr: 0, metric: avgRoi.toFixed(1) + "% ROI" };
    }
    return null;
  }
  // Build a scored counsel candidate per current activity in the library.
  activityCandidates() {
    const AA = ACTIVITIES_DATA; if (!AA.length) return [];
    const lv = this._lvMap();
    const combat = this.account.combat || 3;
    const questByName = {}; (D.quests || []).forEach((q) => (questByName[q.n] = q));
    const isDone = (q) => this.questDone(q);
    const goalId = this.state.goalId || "none";
    const cap = (s) => ("" + (s || "")).charAt(0).toUpperCase() + ("" + (s || "")).slice(1);
    const GOTO = { pvm: "bossing", minigame: "skills", skilling: "skills", processing: "skills", gathering: "skills", passive: "farming", flip: "flipping" };
    const out = [];
    AA.forEach((a) => {
      if (a.current === false) return;
      const adv = a.advances || {};
      const access = this.activityAccess(a, lv, combat, isDone, questByName);
      const xpHr = this.activityXpHr(a);
      const _ov = this._userGp(a, lv); const _perDay = (a.loop && a.loop.perDay) || 4;
      let gpHr, source, ovMetric = "";
      if (_ov && _ov.perRun != null) { gpHr = Math.round((_ov.perRun * _perDay) / 5); ovMetric = this.short(_ov.perRun) + "/run"; source = "your data"; }
      else if (_ov && _ov.gpHr != null) { gpHr = _ov.gpHr; ovMetric = _ov.metric || (gpHr > 0 ? this.short(gpHr) + "/hr" : ""); source = "your data"; }
      else { gpHr = this.activityGpHr(a); source = a.gp ? "estimate" : ""; }
      const domain = a.subtype === "slayer" ? "slayer" : a.subtype === "boss" || a.category === "pvm" ? "boss" : a.category === "passive" ? "farm" : a.category === "flip" ? "flip" : "train";
      const rawLev = (adv.unlockv || 0) * 10 + (adv.money || 0) * 2;
      const onGoal = goalId !== "none" && (adv.goals || []).indexOf(goalId) >= 0;
      const fit = Math.min(100, (onGoal ? 60 : 20) + (adv.money || 0) * 4 + (adv.xpv || 0) * 3 + (adv.unlockv || 0) * 3);
      const metric = ovMetric || (a.gp && a.gp.per === "run" && liveGpRate(a) > 0 ? this.short(liveGpRate(a)) + "/run" : a.gp && a.gp.per === "day" && liveGpRate(a) > 0 ? this.short(liveGpRate(a)) + "/day" : gpHr > 0 ? this.short(gpHr) + "/hr" : xpHr > 0 ? this.short(xpHr) + " xp/hr" : "");
      const px = a.xp && a.xp[0] ? this.short(a.xp[0].rate) + " " + cap(a.xp[0].skill) + " xp/hr" : "";
      const bits = []; if (gpHr > 0) bits.push("about " + this.short(gpHr) + "/hr"); if (px) bits.push(px);
      const lead = domain === "boss" ? "Combat money & drops" : domain === "slayer" ? "Slayer xp with income" : gpHr > 0 && xpHr > 0 ? "Money while you train" : gpHr > 0 ? "Idle-friendly income" : xpHr > 0 ? "Efficient training" : "Steady progress";
      let why = lead + (bits.length ? " — " + bits.join(", ") + "." : ".");
      if (onGoal) why += " Advances your " + goalId + " goal.";
      out.push({ domain, title: a.name, gpHr, xpHr, rawLev, fit, access, metric, source, why, goto: GOTO[a.category] || "skills", adv, actId: a.id, daily: a.category === "passive" });
    });
    return out;
  }
  computeCounsel() {
    const lv = this._lvMap();
    const combat = this.account.combat || 3;
    const goals = this.goals || this.defaultGoals || [];
    const goalBy = {}; goals.forEach((g) => (goalBy[(g.skill || "").toLowerCase()] = g));
    const cap = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
    const isDone = (q) => this.questDone(q);
    const questByName = {}; (D.quests || []).forEach((q) => (questByName[q.n] = q));
    const readyNow = (q) => !isDone(q) && this.questReqsMet(q);
    const bossReqQuests = (b) => this.bossReqQuestsC(b);
    const bossBlockers = (b) => {
      const reasons = [];
      if (combat < (b.minCb || 0)) reasons.push({ type: "combat", skill: "combat", need: b.minCb, gap: b.minCb - combat });
      if ((b.slay || 0) > 0 && (lv.slayer || 1) < b.slay) reasons.push({ type: "skill", skill: "slayer", need: b.slay, gap: b.slay - (lv.slayer || 1) });
      this.gateSkills(b.req).forEach((g) => { if (g.skill !== "combat" && (lv[g.skill] || 1) < g.lvl) reasons.push({ type: "skill", skill: g.skill, need: g.lvl, gap: g.lvl - (lv[g.skill] || 1) }); });
      bossReqQuests(b).forEach((nm) => { const q = questByName[nm]; if (q && !isDone(q)) reasons.push({ type: "quest", quest: nm, ready: readyNow(q) }); });
      return reasons;
    };
    const bossGp = (b) => { const e = this.bossEff(b); return typeof e.estGp === "number" ? e.estGp : 0; };
    const diaryUtil = (d) => { const r = (d.reward || "").toLowerCase(); let u = { easy: 1, medium: 1.6, hard: 2.4, elite: 3.4 }[(d.tier || "").toLowerCase()] || 1; let k = 0.4; if (/unlimited teleport|unlimited/.test(r)) k = 2.2; else if (/teleport/.test(r)) k = 1.5; else if (/xp|prayer|run energy|slayer/.test(r)) k = 1.3; else if (/cosmetic|no new benefit/.test(r)) k = 0.3; return u * k; };

    // ---- bottleneck (reverse-dependency) graph ----
    const locked = {}, cnt = {};
    const addLock = (sk, v, kind) => { if (!sk) return; locked[sk] = (locked[sk] || 0) + v; if (!cnt[sk]) cnt[sk] = { quest: 0, diary: 0, boss: 0, task: 0 }; if (kind) cnt[sk][kind]++; };
    (D.bosses || []).forEach((b) => { const gp = bossGp(b); if (gp <= 0) return; const rs = bossBlockers(b).filter((r) => r.type !== "quest"); if (!rs.length) return; const share = gp / 1e4 / rs.length; rs.forEach((r) => addLock(r.skill, share, "boss")); });
    (D.slayer || []).forEach((t) => { if ((t.slay || 1) > (lv.slayer || 1)) addLock("slayer", (t.ev || t.gpHr || 0) / 4e4, "task"); });
    (D.quests || []).forEach((q) => { if (isDone(q) || this.questReqsMet(q)) return; const gs = this.gateSkills(q.gate).filter((g) => (lv[g.skill] || 1) < g.lvl); if (!gs.length) return; const val = ((q.qp || 1) * 3) / gs.length; gs.forEach((g) => addLock(g.skill, val, "quest")); });
    (D.diaries || []).forEach((d) => { if (this.diaryStatus(d) === "Done") return; const gs = this.gateSkills(d.gate).filter((g) => (lv[g.skill] || 1) < g.lvl); if (!gs.length) return; const val = (diaryUtil(d) * 2) / gs.length; gs.forEach((g) => addLock(g.skill, val, "diary")); });
    const bottleneck = Object.keys(locked).filter((s) => s !== "combat").map((s) => ({ skill: s, val: locked[s], cnt: cnt[s] || {} })).sort((a, b) => b.val - a.val);

    // ---- candidate generation ----
    const lg = (v, lo, hi) => { if (v <= 0) return 0; const a = Math.log10(v); return Math.max(0, Math.min(100, ((a - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100)); };
    const cands = [];
    const push = (c) => { c.gpHr = c.gpHr || 0; c.xpHr = c.xpHr || 0; c.rawLev = c.rawLev || 0; c.fit = c.fit || 0; c.access = c.access == null ? 100 : c.access; cands.push(c); };

    // (Retired legacy blocks — "best boss now", "combat milestone → boss", the
    //  hardcoded High Alchemy / farm-run / slayer-task / flip-deploy pushes.
    //  Those methods now come from ACTIVITIES_DATA with correct goal-tags via
    //  activityCandidates(); combat progression lives in the Pathfinder.)

    // C. stat-ready quests that unlock a premier boss (chain reasoning)
    const chain = [];
    (D.quests || []).forEach((q) => {
      if (!readyNow(q)) return; let best = null, bestOther = null;
      (D.bosses || []).forEach((b) => { if (bossGp(b) <= 0) return; const rs = bossBlockers(b); if (!rs.some((r) => r.type === "quest" && r.quest === q.n)) return; const other = rs.filter((r) => !(r.type === "quest" && r.quest === q.n)); const okOther = other.every((r) => r.type === "combat" || (r.type === "quest" && r.ready)); if (okOther && (!best || bossGp(b) > bossGp(best))) { best = b; bestOther = other; } });
      if (best) { const cbR = bestOther.find((r) => r.type === "combat"); chain.push({ q: q.n, boss: best, gp: bossGp(best), cbNeed: cbR ? cbR.need : 0, cbGap: cbR ? cbR.gap : 0 }); }
    });
    chain.sort((a, b) => b.gp - a.gp);
    const chainWhy = (c, lead) => { let s = lead + " Completing it opens " + c.boss.n + " — about " + this.short(c.gp) + "/hr."; if (c.cbGap > 0) s += c.cbGap <= 3 ? " You are only ~" + c.cbGap + " combat from entry." : " Pair it with ~" + c.cbNeed + " combat to step in."; return s; };
    if (chain[0]) { const c = chain[0]; push({ domain: "quest", title: "Complete " + c.q, gpHr: c.gp, xpHr: 0, rawLev: Math.sqrt(c.gp / 1e4) * 11, fit: 74, access: 100, metric: "unlocks " + c.boss.n, why: chainWhy(c, "A quest you can start now."), goto: "quests" }); }
    if (chain[1]) { const c = chain[1]; push({ domain: "quest", title: "Complete " + c.q, gpHr: c.gp, xpHr: 0, rawLev: Math.sqrt(c.gp / 1e4) * 9, fit: 66, access: 100, metric: "unlocks " + c.boss.n, why: chainWhy(c, "Ready right now."), goto: "quests" }); }

    // G. clear a bottleneck skill (top 2 by locked value)
    bottleneck.slice(0, 2).forEach((bn, i) => {
      const sk = bn.skill, cur = lv[sk] || 1, goal = goalBy[sk], tgt = goal ? goal.tgt : Math.min(70, cur + 20), c = bn.cnt || {};
      const parts = []; if (c.boss) parts.push(c.boss + " boss" + (c.boss > 1 ? "es" : "")); if (c.task) parts.push(c.task + " slayer task" + (c.task > 1 ? "s" : "")); if (c.quest) parts.push(c.quest + " quest" + (c.quest > 1 ? "s" : "")); if (c.diary) parts.push(c.diary + " diar" + (c.diary > 1 ? "ies" : "y"));
      const blurb = parts.join(", ") || "downstream content";
      push({ domain: "train", skill: sk, title: "Train " + cap(sk) + " " + cur + " → " + tgt, gpHr: 0, xpHr: Math.max(0, goal ? goal.xpHr : 20000), rawLev: Math.sqrt(bn.val) * (i === 0 ? 13 : 9), fit: goal ? 100 : 60, access: 100, metric: "unblocks " + (parts[0] || "content"), why: cap(sk) + " sits at " + cur + " — " + (i === 0 ? "the single deepest lock on your account" : "a major lock") + ". It gates " + blurb + ". Nothing else you do compounds this hard.", goto: "skills" });
    });

    // H. a diary reward you can claim now
    const doDiary = (D.diaries || []).filter((d) => this.diaryStatus(d) === "Stat-ready").map((d) => ({ d, u: diaryUtil(d) })).sort((a, b) => b.u - a.u)[0];
    if (doDiary) { const d = doDiary.d, rw = (d.reward || "").split("—")[0].trim(); push({ domain: "diary", title: d.region + " " + d.tier + " Diary", gpHr: 0, xpHr: 0, rawLev: doDiary.u * 3, fit: 52, access: 100, metric: rw, why: "Ready to claim now. Grants " + rw + " — permanent quality-of-life you keep forever and compounds every session.", goto: "diary" }); }

    // ---- inject the Activities library (money / training / daily methods, goal-tagged) ----
    this.activityCandidates().forEach(push);
    // dedupe by title (ledger candidates ran first, so their richer prose wins)
    (function () { const seen = {}, uniq = []; cands.forEach((c) => { const k = (c.title || "").toLowerCase(); if (seen[k]) return; seen[k] = 1; uniq.push(c); }); cands.length = 0; Array.prototype.push.apply(cands, uniq); })();

    // ---- scoring: access is a MULTIPLICATIVE gate so a locked 17M/hr boss
    // can't out-score reachable methods ----
    const maxLev = Math.max.apply(null, [1].concat(cands.map((c) => c.rawLev)));
    cands.forEach((c) => { c.gpS = lg(c.gpHr, 40000, 3000000); c.xpS = lg(c.xpHr, 8000, 400000); c.levS = Math.round((c.rawLev / maxLev) * 100); c.fitS = Math.round(c.fit); c.accS = c.access; });
    const lens = this.state.counselLens || "balanced";
    const LD = this.counselLensDefs(), L = LD.find((x) => x.id === lens) || LD[0];
    cands.forEach((c) => { const dm = (L.dom && L.dom[c.domain]) || 1; const accMult = Math.pow(Math.max(0, Math.min(100, c.access == null ? 100 : c.access)) / 100, 1.3); c.score = (L.w[0] * c.gpS + L.w[1] * c.xpS + L.w[2] * c.levS + L.w[3] * c.fitS + L.w[4] * c.accS) * dm * accMult; });
    cands.sort((a, b) => b.score - a.score);

    // ---- ambition engine: bias the whole queue toward a chosen end-goal ----
    const goalId = this.state.goalId || "none";
    const nwLast = this.logs && this.logs.nw && this.logs.nw.length ? this.logs.nw[this.logs.nw.length - 1] : { cash: 0, items: 0 };
    const netWorth = (nwLast.cash || 0) + (nwLast.items || 0);
    const qDone = (D.quests || []).filter((q) => isDone(q)).length, qTotal = (D.quests || []).length || 1;
    const diTotal = (D.diaries || []).length || 1, diDone = (D.diaries || []).filter((d) => this.diaryStatus(d) === "Done").length;
    const totalLevel = this.skillsRaw.reduce((a, s) => a + s[1], 0);
    const skillArr = this.skillsRaw.map((s) => ({ n: s[0], nl: s[0].toLowerCase(), l: s[1] }));
    const GS = { none: { label: "Free Counsel", icon: "🧭" }, questcape: { label: "Quest Cape", icon: "📜" }, base70: { label: "Base 70", icon: "🛡️", N: 70 }, base80: { label: "Base 80", icon: "⚔️", N: 80 }, max: { label: "Max — all 99", icon: "👑" }, bank: { label: "1B Bank", icon: "💰", target: 1e9 }, diary: { label: "Diary Cape", icon: "🗺️" }, firecape: { label: "Fire Cape", icon: "🔥" }, gloves: { label: "Barrows Gloves", icon: "🧤" } };
    const goalOrder = ["none", "questcape", "base70", "base80", "max", "bank", "diary", "firecape", "gloves"];
    const belowN = (N) => skillArr.filter((s) => s.l < N).sort((a, b) => a.l - b.l);
    const cntSk = (sk, kind) => (cnt[sk] && cnt[sk][kind]) || 0;
    const gspec = GS[goalId] || GS.none;
    let goalPct = 0, goalPath = "";
    const goalActive = goalId !== "none" && !!GS[goalId];
    if (goalId === "questcape") { goalPct = qDone / qTotal; const qb = Object.keys(cnt).filter((s) => s !== "combat" && cnt[s].quest > 0).map((s) => ({ s, n: cnt[s].quest })).sort((a, b) => b.n - a.n)[0]; const readyQ = (D.quests || []).filter((q) => readyNow(q)).length; goalPath = qTotal - qDone + " quests remain · " + readyQ + " you can do now" + (qb ? " · training " + cap(qb.s) + " clears " + qb.n + " more" : ""); }
    else if (goalId === "base70" || goalId === "base80") { const N = GS[goalId].N, below = belowN(N); goalPct = (skillArr.length - below.length) / skillArr.length; goalPath = below.length ? below.length + " skills below " + N + " · lowest: " + below.slice(0, 3).map((s) => cap(s.n) + " " + s.l).join(", ") : "Every skill at " + N + " — done!"; }
    else if (goalId === "max") { goalPct = totalLevel / 2277; const below = belowN(99); goalPath = 2277 - totalLevel + " levels from 2277 · lowest: " + below.slice(0, 3).map((s) => cap(s.n) + " " + s.l).join(", "); }
    else if (goalId === "bank") { goalPct = netWorth / GS.bank.target; const doable = cands.filter((c) => c.gpHr > 0 && (c.access == null || c.access >= 100)); const tm = (doable.length ? doable : cands.filter((c) => c.gpHr > 0)).sort((a, b) => b.gpHr - a.gpHr)[0]; goalPath = this.short(Math.max(0, GS.bank.target - netWorth)) + " from 1B · fastest lever you can do now: " + (tm ? tm.title + " (~" + this.short(tm.gpHr) + "/hr)" : "stack money makers"); }
    else if (goalId === "diary") { goalPct = diDone / diTotal; const db = Object.keys(cnt).filter((s) => s !== "combat" && cnt[s].diary > 0).map((s) => ({ s, n: cnt[s].diary })).sort((a, b) => b.n - a.n)[0]; goalPath = diTotal - diDone + " diaries remain" + (db ? " · training " + cap(db.s) + " clears " + db.n : ""); }
    else if (goalId === "firecape") { const r = lv.ranged || 1, p = lv.prayer || 1; goalPct = Math.min(1, (Math.min(r, 75) / 75) * 0.7 + (Math.min(p, 43) / 43) * 0.3); goalPath = r >= 75 && p >= 43 ? "Ranged " + r + " · Prayer " + p + " — brave the Fight Caves!" : "Ranged " + r + "/75 · Prayer " + p + "/43 · build ranged + prayer first"; }
    else if (goalId === "gloves") { const need = [["herblore", 31], ["fishing", 50], ["cooking", 70]]; const unmet = need.filter((x) => (lv[x[0]] || 1) < x[1]); goalPct = (need.length - unmet.length) / need.length; goalPath = unmet.length ? "RFD gated on " + unmet.map((x) => cap(x[0]) + " " + x[1] + " (now " + (lv[x[0]] || 1) + ")").join(", ") : "Skill gates met — grind the RFD subquests"; }
    const biasOf = (c) => {
      if (!goalActive) return 1; const sk = c.skill || "", g = c.gpS || 0;
      // Activity candidates carry real goal-tags: strongly prefer on-goal, demote
      // off-goal. (This is what stops High Alchemy leaking onto a Diary path.)
      if (c.adv) { return (c.adv.goals || []).indexOf(goalId) >= 0 ? 1.9 : 0.45; }
      if (goalId === "questcape") { if (c.domain === "quest") return 2.0; if (c.domain === "train") return 1.2 + Math.min(1, cntSk(sk, "quest") / 6) * 0.9; if (c.domain === "diary") return 0.85; return 0.92; }
      if (goalId === "base70" || goalId === "base80") { const N = GS[goalId].N; if (c.domain === "train") return (lv[sk] || 99) < N ? 2.2 : 0.7; if (c.domain === "boss" || c.domain === "slayer" || c.domain === "combat") return 1.3; return 0.85; }
      if (goalId === "max") { if (c.domain === "train") return 1.7; if (c.domain === "alch" || c.domain === "farm" || c.domain === "slayer") return 1.2; return 0.92; }
      if (goalId === "bank") { if (c.gpHr > 0 || c.domain === "quest") return 1 + Math.min(1.4, (g / 100) * 1.4); if (c.domain === "train") return 0.65; return 0.85; }
      if (goalId === "diary") { if (c.domain === "diary") return 2.0; if (c.domain === "train") return 1.15 + Math.min(1, cntSk(sk, "diary") / 6) * 0.8; return 0.9; }
      if (goalId === "firecape") { if (c.domain === "train" && (sk === "ranged" || sk === "prayer" || sk === "defence")) return 1.9; if (c.domain === "boss" || c.domain === "slayer" || c.domain === "combat") return 1.5; return 0.85; }
      if (goalId === "gloves") { if (c.domain === "quest") return 1.7; if (c.domain === "train" && (sk === "herblore" || sk === "fishing" || sk === "cooking")) return 2.0; return 0.85; }
      return 1;
    };
    cands.forEach((c) => { c.goalMult = biasOf(c); c.score *= c.goalMult; c.onPath = goalActive && c.goalMult > 1.08; });
    cands.sort((a, b) => b.score - a.score);
    if (typeof window !== "undefined") window.__counsel = cands; // debug: inspect the full ranked candidate list
    const goalChips = goalOrder.map((id) => ({ id, icon: GS[id].icon, label: GS[id].label, active: id === goalId, bg: id === goalId ? "#e3c878" : "rgba(255,255,255,.05)", fg: id === goalId ? "#2c2013" : "#c3b0da", bd: id === goalId ? "#e3c878" : "rgba(227,200,120,.16)" }));

    // ---- presentation ----
    const DGL = { boss: { g: "⚔️", c: "#a23a2c", label: "Bossing", goto: "bossing" }, slayer: { g: "💀", c: "#7a2a1f", label: "Slayer", goto: "slayer" }, train: { g: "📈", c: "#2f7d72", label: "Skilling", goto: "skills" }, alch: { g: "🔮", c: "#6a4a8a", label: "Alchemy", goto: "alchemy" }, farm: { g: "🌿", c: "#5c7a35", label: "Farming", goto: "farming" }, quest: { g: "📜", c: "#4a59a0", label: "Quest", goto: "quests" }, diary: { g: "🗺️", c: "#2f7d7a", label: "Diary", goto: "diary" }, flip: { g: "💰", c: "#b8863a", label: "Flipping", goto: "flipping" }, combat: { g: "⚔️", c: "#a23a2c", label: "Combat", goto: "bossing" } };
    const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    const mk = (c, i) => {
      const dg = DGL[c.domain] || DGL.boss; const accLabel = c.access >= 100 ? "Ready now" : c.access >= 60 ? "Almost there" : "Locked"; const accColor = c.access >= 100 ? "#8fbf5a" : c.access >= 60 ? "#d0a94e" : "#d98a6a";
      return {
        rank: ROMAN[i] || "" + (i + 1), rankColor: c.onPath ? "#e3c878" : "#6a5a88", onPath: !!c.onPath, glyph: dg.g, domColor: dg.c, domLabel: dg.label, title: c.title, why: c.why, metric: c.metric || "", src: c.source || "", hasSrc: !!c.source, srcColor: c.source === "your data" ? "#8fbf5a" : "#9a86c0", accLabel, accColor, goto: c.goto || dg.goto,
        bars: [{ k: "GOLD", pct: Math.max(3, c.gpS).toFixed(0) + "%", color: "#d2a94f", val: Math.round(c.gpS) }, { k: "XP", pct: Math.max(3, c.xpS).toFixed(0) + "%", color: "#46a596", val: Math.round(c.xpS) }, { k: "LEV", pct: Math.max(3, c.levS).toFixed(0) + "%", color: "#9a7bc0", val: Math.round(c.levS) }, { k: "FIT", pct: Math.max(3, c.fitS).toFixed(0) + "%", color: "#8fbf5a", val: Math.round(c.fitS) }, { k: "ACC", pct: Math.max(3, c.accS).toFixed(0) + "%", color: "#d0a94e", val: Math.round(c.accS) }],
      };
    };
    const hero = cands[0] ? mk(cands[0], 0) : null;
    const queue = cands.slice(1, 7).map((c, i) => mk(c, i + 1));
    const synthCount = (D.quests || []).length + (D.diaries || []).length + (D.bosses || []).length + (D.slayer || []).length + this.skillsRaw.length + goals.length + ((this.logs && this.logs.flips) || []).length + (this.alchItems || []).length + (this.farmRunDefs || []).length;
    const topBn = bottleneck[0], bnc = topBn ? topBn.cnt : {}; const bnParts = []; if (bnc.boss) bnParts.push(bnc.boss + " bosses"); if (bnc.task) bnParts.push(bnc.task + " tasks"); if (bnc.quest) bnParts.push(bnc.quest + " quests"); if (bnc.diary) bnParts.push(bnc.diary + " diaries");
    const lenses = LD.map((x) => ({ id: x.id, label: x.label, active: x.id === lens, bg: x.id === lens ? "#e3c878" : "transparent", fg: x.id === lens ? "#2c2013" : "#c9a24e" }));
    return {
      counselHero: hero, counselQueue: queue, counselLenses: lenses, counselSynth: "" + synthCount, counselDomains: "9", counselBnLabel: topBn ? cap(topBn.skill) + " " + (lv[topBn.skill] || 1) : "—", counselBnParts: bnParts.join(" · ") || "nothing right now", counselLensName: L.label,
      counselGoals: goalChips, counselGoalActive: goalActive, counselGoalLabel: gspec.label, counselGoalPct: (Math.max(0, Math.min(1, goalPct)) * 100).toFixed(1) + "%", counselGoalPctLabel: Math.round(Math.min(1, goalPct) * 100) + "%", counselGoalPath: goalPath,
    };
  }

  // ---------- The Keystone Web: dependency-aware bottleneck / cascade engine ----------
  _pfSig() { return this.skillsRaw.map((s) => s[1]).join(",") + "|" + (this.account.combat || 0) + "|" + (this.state.pfSort || "lev") + "|" + Object.keys(this.questOv || {}).filter((k) => this.questOv[k]).sort().join("~") + "|" + Object.keys(this.diaryOv || {}).filter((k) => this.diaryOv[k]).sort().join("~"); }
  computePathfinder() { const sig = this._pfSig(); if (this._pfCache && this._pfCache.sig === sig) return this._pfCache.data; const data = this._buildPathfinder(); this._pfCache = { sig, data }; return data; }
  _buildPathfinder() {
    const lv0 = this._lvMap();
    const combat0 = this.account.combat || 3;
    const cap = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
    const isDone = (q) => this.questDone(q);
    const questByName = {}; (D.quests || []).forEach((q) => (questByName[q.n] = q));
    const bossReqQuests = (b) => this.bossReqQuestsC(b);
    const diaryUtil = (d) => { const r = (d.reward || "").toLowerCase(); let u = { easy: 1, medium: 1.6, hard: 2.4, elite: 3.4 }[(d.tier || "").toLowerCase()] || 1; let k = 0.4; if (/unlimited teleport|unlimited/.test(r)) k = 2.2; else if (/teleport/.test(r)) k = 1.5; else if (/xp|prayer|run energy|slayer/.test(r)) k = 1.3; else if (/cosmetic|no new benefit/.test(r)) k = 0.3; return u * k; };
    const bossGp = (b) => { const e = this.bossEff(b); return typeof e.estGp === "number" ? e.estGp : 0; };
    const questValue = (q) => { let v = (q.qp || 1) * 2; const k = (q.key || "").toLowerCase(); if (/barrows glove|ancient|dragon slayer|blowpipe|ava|salve|fairy ring|lunar|prifddinas|faerdhinen|bofa| v's shield|ectophial|dragon defender/.test(k)) v += 15; else if (k && k !== "-") v += 4; return v; };

    // done set (mutable base)
    const doneBase = {}; (D.quests || []).forEach((q) => { if (isDone(q)) doneBase[q.n] = true; });

    // requirement key helpers
    const skKey = (s, l) => "S:" + s + ":" + l, cbKey = (l) => "C:" + l, qKey = (n) => "Q:" + n;
    const SK = { attack: 1, strength: 1, defence: 1, hitpoints: 1, ranged: 1, prayer: 1, magic: 1, runecraft: 1, construction: 1, agility: 1, herblore: 1, thieving: 1, crafting: 1, fletching: 1, slayer: 1, hunter: 1, mining: 1, smithing: 1, fishing: 1, cooking: 1, firemaking: 1, woodcutting: 1, farming: 1 };
    const parseGates = (str) => { const out = []; if (!str) return out; const re = /([A-Za-z][A-Za-z']+)\s+(\d+)|(\d+)\s+([A-Za-z][A-Za-z']+)/g; let m; while ((m = re.exec(str))) { let s, l; if (m[1]) { s = m[1].toLowerCase(); l = +m[2]; } else { s = m[4].toLowerCase(); l = +m[3]; } if (s === "runecrafting") s = "runecraft"; if (SK[s]) out.push({ s, l }); } return out; };

    // build content nodes with requirement key-lists
    const DOM = { boss: { icon: "⚔️", color: "#a23a2c", label: "boss", plural: "bosses", goto: "bossing" }, task: { icon: "💀", color: "#7a2a1f", label: "task", plural: "tasks", goto: "slayer" }, quest: { icon: "📜", color: "#4a59a0", label: "quest", plural: "quests", goto: "quests" }, diary: { icon: "🗺️", color: "#2f7d7a", label: "diary", plural: "diaries", goto: "diary" }, gear: { icon: "🛡️", color: "#9a7233", label: "gear piece", plural: "gear", goto: "gear" } };
    const items = []; // locked content
    const reqOfQuest = {}; // name -> req keys (skills + prereq quests)
    (D.quests || []).forEach((q) => { const reqs = []; parseGates(q.gate).forEach((g) => reqs.push(skKey(g.s, g.l))); this.questDeps(q.n).forEach((pn) => { if (questByName[pn]) reqs.push(qKey(pn)); }); reqOfQuest[q.n] = reqs; });
    (D.quests || []).forEach((q) => { if (isDone(q)) return; items.push({ type: "quest", name: q.n, value: questValue(q), reqs: reqOfQuest[q.n] || [], goto: "quests" }); });
    (D.diaries || []).forEach((d) => { if (this.diaryStatus(d) === "Done") return; const reqs = []; parseGates(d.gate).forEach((g) => reqs.push(skKey(g.s, g.l))); items.push({ type: "diary", name: d.region + " " + d.tier, value: diaryUtil(d) * 3, reqs, goto: "diary" }); });
    (D.bosses || []).forEach((b) => { const gp = bossGp(b); if (gp <= 0) return; const reqs = []; if (b.minCb) reqs.push(cbKey(b.minCb)); if (b.slay > 0) reqs.push(skKey("slayer", b.slay)); parseGates(b.req).forEach((g) => { if (g.s !== "combat") reqs.push(skKey(g.s, g.l)); }); bossReqQuests(b).forEach((pn) => { if (questByName[pn]) reqs.push(qKey(pn)); }); items.push({ type: "boss", name: b.n, value: gp / 1e4, reqs, goto: "bossing", gp }); });
    (D.slayer || []).forEach((t) => { const qr = this.taskReqQuestsC(t.task); if ((t.slay || 1) <= 1 && !qr.length) return; const reqs = []; if ((t.slay || 1) > 1) reqs.push(skKey("slayer", t.slay)); qr.forEach((pn) => { if (questByName[pn]) reqs.push(qKey(pn)); }); items.push({ type: "task", name: t.task, value: (t.ev || t.gpHr || 0) / 4e4, reqs, goto: "slayer", gpHr: t.gpHr }); });
    // gear dimension: quest-gated equipment (BiS pieces locked behind quests)
    const gearSeen = {};
    Object.keys(GEAR_DATA).forEach((st) => { (GEAR_DATA[st] || []).forEach((sl) => { (sl.items || []).forEach((it) => { if (gearSeen[it.n]) return; const qs = this.questsInText(it.req || ""); if (!qs.length) return; gearSeen[it.n] = 1; const reqs = []; parseGates(it.req).forEach((g) => { if (g.s !== "combat") reqs.push(skKey(g.s, g.l)); }); qs.forEach((pn) => { if (questByName[pn]) reqs.push(qKey(pn)); }); items.push({ type: "gear", name: it.n, value: 6, reqs, goto: "gear" }); }); }); });

    // met-state evaluator over a mutable world (lv map, combat, done set)
    const metKey = (key, lvm, cb, dn) => { const p = key.split(":"); if (p[0] === "S") return (lvm[p[1]] || 1) >= +p[2]; if (p[0] === "C") return cb >= +p[1]; return !!dn[p[1]]; };
    const unmetReqs = (it, lvm, cb, dn) => it.reqs.filter((r) => !metKey(r, lvm, cb, dn));
    const blocked = (it) => unmetReqs(it, lv0, combat0, doneBase).length > 0;
    const lockedItems = items.filter(blocked);

    // simulate an action -> {direct:[items], horizon:[items]}
    const simulate = (action) => {
      const lvm = Object.assign({}, lv0); let cb = combat0; const dn = Object.assign({}, doneBase);
      if (action.kind === "skill") lvm[action.s] = Math.max(lvm[action.s] || 1, action.l);
      else if (action.kind === "combat") cb = Math.max(cb, action.l);
      else if (action.kind === "quest") dn[action.name] = true;
      // direct: locked items fully met after this single action
      const direct = lockedItems.filter((it) => unmetReqs(it, lvm, cb, dn).length === 0);
      // horizon: keep completing any now-doable locked quest, cascade
      const dn2 = Object.assign({}, dn); let changed = true, guard = 0;
      while (changed && guard < 12) { changed = false; guard++; (D.quests || []).forEach((q) => { if (dn2[q.n]) return; if (unmetReqs({ reqs: reqOfQuest[q.n] || [] }, lvm, cb, dn2).length === 0) { dn2[q.n] = true; changed = true; } }); }
      const horizon = lockedItems.filter((it) => (it.type !== "quest" || !dn[it.name]) && unmetReqs(it, lvm, cb, dn2).length === 0);
      return { direct, horizon };
    };
    const summarize = (list) => { const c = { boss: 0, task: 0, quest: 0, diary: 0, gear: 0 }; let val = 0; list.forEach((it) => { c[it.type]++; val += it.value; }); return { counts: c, val }; };

    // ---- keystone candidates ----
    const keystones = [];
    // skill keystones — walk the MILESTONE ladder to the NEXT breakpoint instead
    // of one global-max leap. Ranking (lev) reflects the skill's full DOWNSTREAM
    // value (reach = what maxing it eventually opens), but the ACTION targets the
    // realistic next rung, with a time estimate and the method to climb it.
    const MS = SKILL_MILESTONES;
    const actById = this._actById();
    const rungType = (t) => (t === "boss" || t === "monster" ? "boss" : t === "gear" ? "gear" : t === "area" ? "quest" : "task");
    const mergeDir = (dObj, curated) => { const c = Object.assign({}, dObj.counts); let v = dObj.val; curated.forEach((u) => { c[u.type] = (c[u.type] || 0) + 1; v += u.value || 1; }); return { counts: c, val: v }; };
    Object.keys(MS).forEach((key) => {
      const L = MS[key]; if (!L || L.kind === "combat") return;
      const cur = lv0[key] || 1;
      const bps = (L.rungs || []).filter((r) => r.isBreakpoint && r.level > cur).sort((a, b) => a.level - b.level);
      if (!bps.length) return;
      const nextRung = bps[0], topLevel = bps[bps.length - 1].level;
      const simTop = simulate({ kind: "skill", s: key, l: topLevel }); const dT = summarize(simTop.direct), hT = summarize(simTop.horizon); const reach = dT.val + 0.35 * hT.val;
      const simN = simulate({ kind: "skill", s: key, l: nextRung.level }); const dN = summarize(simN.direct), hN = summarize(simN.horizon);
      const rungVal = (nextRung.unlocks || []).reduce((a, u) => a + (u.value || 1), 0);
      const levels = nextRung.level - cur, xp = Math.max(0, this.xpFor(nextRung.level) - this.xpFor(cur));
      const mId = (nextRung.band && nextRung.band.method && nextRung.band.method[0]) || null;
      const mAct = mId ? actById[mId] : null, rate = mAct ? this.activityXpHr(mAct) : 0, hours = rate > 0 ? Math.round(xp / rate) : 0;
      const impact = reach + rungVal; if (impact <= 0) return;
      const curated = (nextRung.unlocks || []).map((u) => ({ name: u.name, value: u.value || 1, type: rungType(u.type) }));
      keystones.push({ kind: "skill", skill: key, level: nextRung.level, action: "Train " + cap(key) + " to " + nextRung.level,
        effortLabel: "+" + levels + " lvl · " + this.short(xp) + " xp" + (hours > 0 ? " · ~" + hours + "h" : ""),
        why: nextRung.why || "", methodName: mAct ? mAct.name : "", hours,
        dir: mergeDir(dN, curated), hor: hN, impact, lev: impact / (1 + levels * 0.03), unlocked: curated.concat(simN.direct), goto: "skills" });
    });
    // combat keystone — same laddering; also feeds the chokepoint section via bestCb.
    let bestCb = null;
    (() => {
      const L = MS.combat; if (!L) return; const cur = combat0;
      const bps = (L.rungs || []).filter((r) => r.isBreakpoint && r.level > cur).sort((a, b) => a.level - b.level); if (!bps.length) return;
      const nextRung = bps[0], topLevel = bps[bps.length - 1].level;
      const simTop = simulate({ kind: "combat", l: topLevel }); const dT = summarize(simTop.direct), hT = summarize(simTop.horizon); const reach = dT.val + 0.35 * hT.val;
      const simN = simulate({ kind: "combat", l: nextRung.level }); const dN = summarize(simN.direct), hN = summarize(simN.horizon);
      const rungVal = (nextRung.unlocks || []).reduce((a, u) => a + (u.value || 1), 0); const levels = nextRung.level - cur; const impact = reach + rungVal; if (impact <= 0) return;
      const curated = (nextRung.unlocks || []).map((u) => ({ name: u.name, value: u.value || 1, type: rungType(u.type) }));
      bestCb = { l: nextRung.level, dir: mergeDir(dN, curated), hor: hN, impact, lev: impact / (1 + levels * 0.05), direct: simN.direct };
      keystones.push({ kind: "combat", level: nextRung.level, action: "Reach " + nextRung.level + " Combat", effortLabel: "+" + levels + " combat lvl",
        why: nextRung.why || "", methodName: "", hours: 0, dir: bestCb.dir, hor: hN, impact, lev: bestCb.lev, unlocked: curated.concat(simN.direct), goto: "bossing" });
    })();
    // quest keystones: any not-done quest that unlocks >=1 item
    (D.quests || []).forEach((q) => { if (isDone(q)) return; const sim = simulate({ kind: "quest", name: q.n }); const d = summarize(sim.direct), h = summarize(sim.horizon); if (d.val + h.val <= 0) return; const unmetPre = (reqOfQuest[q.n] || []).filter((r) => r[0] === "Q" && !metKey(r, lv0, combat0, doneBase)).length; const unmetSk = (reqOfQuest[q.n] || []).filter((r) => r[0] === "S" && !metKey(r, lv0, combat0, doneBase)).length; const eff = 1 + unmetPre * 0.4 + unmetSk * 0.25; const impact = d.val + 0.45 * h.val; keystones.push({ kind: "quest", name: q.n, action: "Complete " + q.n, effortLabel: unmetPre ? unmetPre + " prereq quest" + (unmetPre > 1 ? "s" : "") + " first" : unmetSk ? unmetSk + " stat gate" + (unmetSk > 1 ? "s" : "") : "ready to start", dir: d, hor: h, impact, lev: impact / eff, unlocked: sim.direct, goto: "quests" }); });

    // rank
    const byImpact = keystones.slice().sort((a, b) => b.impact - a.impact);
    const byLev = keystones.slice().sort((a, b) => b.lev - a.lev);

    // presentation for a keystone
    const KIND = { skill: { icon: "📈", color: "#2f7d72" }, combat: { icon: "⚔️", color: "#a23a2c" }, quest: { icon: "📜", color: "#4a59a0" } };
    const chip = (c) => { const out = []; ["boss", "task", "quest", "diary", "gear"].forEach((t) => { if (c.counts[t] > 0) out.push({ icon: DOM[t].icon, n: "" + c.counts[t], color: DOM[t].color }); }); return out; };
    const maxImpact = Math.max.apply(null, [1].concat(keystones.map((k) => k.impact)));
    const maxLev = Math.max.apply(null, [1].concat(keystones.map((k) => k.lev)));
    const mkK = (k, i, scoreKey) => {
      const kd = KIND[k.kind] || KIND.skill; const tot = k.dir.counts.boss + k.dir.counts.task + k.dir.counts.quest + k.dir.counts.diary + k.dir.counts.gear; const horTot = k.hor.counts.boss + k.hor.counts.task + k.hor.counts.quest + k.hor.counts.diary + k.hor.counts.gear;
      const unl = (k.unlocked || []).slice().sort((a, b) => b.value - a.value).slice(0, 10).map((it) => ({ name: it.name, color: DOM[it.type].color, icon: DOM[it.type].icon }));
      return {
        rank: "" + (i + 1), kind: k.kind, icon: kd.icon, color: kd.color, action: k.action, effort: k.effortLabel,
        chips: chip(k.dir), directN: "" + tot, horizonN: horTot > tot ? "+" + (horTot - tot) + " on the horizon" : "", barPct: Math.max(4, (scoreKey === "lev" ? k.lev / maxLev : k.impact / maxImpact) * 100).toFixed(0) + "%",
        unlocked: unl, unlockedMore: (k.unlocked || []).length > 10 ? "+" + ((k.unlocked || []).length - 10) + " more" : "", goto: k.goto,
        why: k.why || "", hasWhy: !!k.why, climb: k.methodName ? "Climb via " + k.methodName + (k.hours ? " · ~" + k.hours + "h to this rung" : "") : "", hasClimb: !!k.methodName,
      };
    };

    const sortMode = this.state.pfSort || "lev";
    const ranked = (sortMode === "impact" ? byImpact : byLev).slice(0, 9).map((k, i) => mkK(k, i, sortMode));

    // frontier: locked items one SHORT step from opening — a single unmet
    // requirement that's also genuinely close (skill/combat gap ≤ 10 levels,
    // or a prereq quest you're already stat-ready to start). "One lock away"
    // used to include an 86-level Slayer climb, which is one lock in name only.
    const oneLock = lockedItems.map((it) => ({ it, um: unmetReqs(it, lv0, combat0, doneBase) })).filter((x) => x.um.length === 1)
      .map((x) => {
        const r = x.um[0].split(":"); let blk, bc, near, gap = 0;
        if (r[0] === "S") { gap = +r[2] - (lv0[r[1]] || 1); near = gap <= 10; blk = cap(r[1]) + " " + r[2] + " (+" + gap + ")"; bc = "#2f7d72"; }
        else if (r[0] === "C") { gap = +r[1] - combat0; near = gap <= 10; blk = "Combat " + r[1] + " (+" + gap + ")"; bc = "#a23a2c"; }
        else { const q = questByName[r[1]]; near = !!q && this.questReqsMet(q); gap = near ? 0 : 5; blk = r[1] + (near ? " — ready to start" : ""); bc = "#4a59a0"; }
        return { name: x.it.name, type: x.it.type, glyph: DOM[x.it.type].icon, typeColor: DOM[x.it.type].color, blocker: blk, blockerColor: bc, value: x.it.value, goto: x.it.goto, near, gap };
      });
    const frontier = oneLock.filter((x) => x.near).sort((a, b) => a.gap - b.gap || b.value - a.value);
    const frontierFar = oneLock.length - frontier.length;

    // reachability tiers
    const tiers = { one: 0, two: 0, deep: 0 };
    lockedItems.forEach((it) => { const n = unmetReqs(it, lv0, combat0, doneBase).length; if (n === 1) tiers.one++; else if (n === 2) tiers.two++; else tiers.deep++; });

    // ---- chokepoint by centrality: which requirement sits in the most blocker-sets ----
    const part = {}, pcount = {}; let totalW = 0;
    const pw = (it) => (it.type === "boss" ? 3 : it.type === "gear" ? 1.6 : it.type === "task" ? 1.4 : 1);
    lockedItems.forEach((it) => { const um = unmetReqs(it, lv0, combat0, doneBase); if (!um.length) return; const w = pw(it); totalW += w; const share = w / um.length; um.forEach((r) => { const p = r.split(":"); let key = null; if (p[0] === "S") key = p[1]; else if (p[0] === "C") key = "combat"; if (!key) return; part[key] = (part[key] || 0) + share; if (!pcount[key]) pcount[key] = { boss: 0, task: 0, quest: 0, diary: 0, gear: 0 }; pcount[key][it.type]++; }); });
    const totalLockedVal = totalW || 1;
    const chokeKey = Object.keys(part).filter((k) => k !== "combat").sort((a, b) => part[b] - part[a])[0] || null;
    let choke = null;
    if (chokeKey) {
      const isCb = chokeKey === "combat"; const kd = isCb ? KIND.combat : KIND.skill; const pc = pcount[chokeKey]; let action, effort;
      if (isCb) { const l = bestCb ? bestCb.l : combat0 + 1; action = "Reach " + l + " Combat"; effort = "+" + (l - combat0) + " combat lvl"; }
      else { const ksk = keystones.find((k) => k.kind === "skill" && k.skill === chokeKey); const cur = lv0[chokeKey] || 1; const tgt = ksk ? ksk.level : cur; action = "Train " + cap(chokeKey) + " to " + tgt; effort = ksk ? ksk.effortLabel : "from " + cur; }
      const spokesRaw = [["boss", pc.boss], ["task", pc.task], ["quest", pc.quest], ["diary", pc.diary], ["gear", pc.gear]].filter((x) => x[1] > 0);
      // 320×240 canvas, hub at (160,120). Labels sit PAST the circle edge
      // (len + r + 13) so counts stay inside their circles and names outside.
      const spokes = spokesRaw.map((x, idx) => {
        const ang = ((-90 + idx * (360 / Math.max(1, spokesRaw.length))) * Math.PI) / 180;
        const r = 9 + Math.min(10, x[1] * 0.6);
        const len = 54 + Math.min(24, x[1] * 1.6);
        const lab = len + r + 13;
        return { x2: (160 + Math.cos(ang) * len).toFixed(1), y2: (120 + Math.sin(ang) * len).toFixed(1), lx: (160 + Math.cos(ang) * lab).toFixed(1), ly: (120 + Math.sin(ang) * lab).toFixed(1), n: "" + x[1], label: DOM[x[0]].plural, color: DOM[x[0]].color, r: r.toFixed(0) };
      });
      const parts = []; ["boss", "task", "quest", "diary", "gear"].forEach((t) => { if (pc[t] > 0) parts.push(pc[t] + " " + (pc[t] > 1 ? DOM[t].plural : DOM[t].label)); });
      const totalPieces = pc.boss + pc.task + pc.quest + pc.diary + pc.gear;
      choke = { icon: kd.icon, color: kd.color, action, coverPct: Math.round((part[chokeKey] / totalLockedVal) * 100) + "%", blurb: (isCb ? "Combat" : cap(chokeKey)) + " appears in the blocker list of " + totalPieces + " locked pieces — " + parts.join(", ") + ". No single requirement gates a wider swath of the account.", spokes, effort };
    }

    return {
      pfChoke: choke, pfKeystones: ranked, pfFrontier: frontier.slice(0, 10), pfFrontierMore: [frontier.length > 10 ? "+" + (frontier.length - 10) + " more within reach" : "", frontierFar > 0 ? frontierFar + " more sit one lock away but behind a long climb — the keystones above chart those" : ""].filter(Boolean).join(" · "),
      pfTierOne: "" + tiers.one, pfTierTwo: "" + tiers.two, pfTierDeep: "" + tiers.deep, pfTotalLocked: "" + lockedItems.length,
      pfHasData: keystones.length > 0,
    };
  }

  // ===================== DASHBOARD =====================
  // The Oracle's Counsel — the data-driven recommendation card at the top of the
  // dashboard (1:1 port of the prototype's presentation).
  renderCounsel() {
    const cm = this.computeCounsel();
    const hero = cm.counselHero;
    const rule = <span style={{ height: 1, flex: 1, background: "linear-gradient(90deg, rgba(227,200,120,.34), transparent)" }} />;
    return (
      <div style={{ position: "relative", border: "2px solid #6b5226", borderRadius: 9, overflow: "hidden", marginBottom: 26, background: "radial-gradient(130% 150% at 12% 0%, #241a33 0%, #1b1526 44%, #130e1b 100%)", boxShadow: "0 14px 38px rgba(18,10,28,.42), inset 0 1px 0 rgba(227,200,120,.14)" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.55, backgroundImage: "radial-gradient(circle at 86% 14%, rgba(227,200,120,.16), transparent 42%), radial-gradient(circle at 16% 96%, rgba(106,74,138,.26), transparent 46%)", pointerEvents: "none" }} />
        {/* header row + lens picker */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 15, padding: "17px 22px 14px", borderBottom: "1px solid rgba(227,200,120,.18)", flexWrap: "wrap", rowGap: 11 }}>
          <div style={{ width: 46, height: 46, flex: "0 0 46px", borderRadius: "50%", background: "radial-gradient(circle at 35% 28%, #f0dc98, #c39a44 58%, #7c5520)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, boxShadow: "0 0 20px rgba(227,200,120,.4), inset 0 1px 2px rgba(255,255,255,.5)" }}>🔮</div>
          <div style={{ flex: 1, minWidth: 230 }}>
            <div style={cinzel({ fontWeight: 800, fontSize: 21, color: "#f2e2b2", letterSpacing: ".01em" })}>The Oracle’s Counsel</div>
            <div style={mono({ fontSize: 10.5, color: "#9a86c0", marginTop: 2 })}>Synthesised <span style={{ color: "#e3c878" }}>{cm.counselSynth}</span> signals across {cm.counselDomains} domains · reading the whole ledger for your next move</div>
          </div>
          <div style={{ display: "flex", gap: 3, padding: 3, background: "rgba(0,0,0,.3)", border: "1px solid rgba(227,200,120,.2)", borderRadius: 9 }}>
            {cm.counselLenses.map((L) => (
              <a key={L.id} href="#" onClick={(e) => { e.preventDefault(); this.setLens(L.id); }} style={{ padding: "6px 12px", borderRadius: 6, textDecoration: "none", background: L.bg, color: L.fg, transition: "background .12s", ...mono({ fontSize: 10.5, letterSpacing: ".03em" }) }}>{L.label}</a>
            ))}
          </div>
        </div>
        {/* ambition chip row */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 22px", borderBottom: "1px solid rgba(227,200,120,.14)", background: "rgba(0,0,0,.16)", flexWrap: "wrap", rowGap: 9 }}>
          <span style={mono({ fontSize: 9.5, letterSpacing: ".2em", color: "#9a86c0", flex: "0 0 auto" })}>AMBITION</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {cm.counselGoals.map((g) => (
              <a key={g.id} href="#" onClick={(e) => { e.preventDefault(); this.setGoal(g.id); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, textDecoration: "none", background: g.bg, color: g.fg, border: `1px solid ${g.bd}`, ...mono({ fontSize: 10.5 }) }}><span style={{ fontSize: 11 }}>{g.icon}</span>{g.label}</a>
            ))}
          </div>
        </div>
        {/* active-goal progress strip */}
        {cm.counselGoalActive && (
          <div style={{ position: "relative", padding: "13px 22px", borderBottom: "1px solid rgba(227,200,120,.14)", background: "linear-gradient(90deg, rgba(106,74,138,.22), rgba(90,64,120,.06))" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7, gap: 12, flexWrap: "wrap" }}>
              <span style={cinzel({ fontWeight: 700, fontSize: 13, color: "#ecdcf4" })}>Charting your path to {cm.counselGoalLabel}</span>
              <span style={mono({ fontSize: 10.5, color: "#e3c878" })}>{cm.counselGoalPctLabel} complete</span>
            </div>
            <div style={{ height: 8, background: "rgba(0,0,0,.32)", borderRadius: 4, overflow: "hidden", border: "1px solid rgba(227,200,120,.12)" }}><div style={{ height: "100%", width: cm.counselGoalPct, background: "linear-gradient(90deg,#9a7bc0,#e3c878)" }} /></div>
            <div style={mono({ fontSize: 10.5, color: "#b8a6d8", marginTop: 8 })}>◆ {cm.counselGoalPath}</div>
          </div>
        )}
        {/* hero + queue */}
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))" }}>
          {hero && (
            <div style={{ padding: "19px 22px 21px", borderRight: "1px solid rgba(227,200,120,.14)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={mono({ fontWeight: 600, fontSize: 10, color: "#9a86c0", letterSpacing: ".24em" })}>TOP COUNSEL</span>{rule}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 54, height: 54, flex: "0 0 54px", borderRadius: 11, background: hero.domColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, boxShadow: "0 5px 14px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.18)" }}>{hero.glyph}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span style={{ padding: "2px 8px", border: "1px solid rgba(227,200,120,.32)", borderRadius: 4, ...mono({ fontSize: 9, letterSpacing: ".14em", color: "#c9b06a" }) }}>{hero.domLabel}</span>
                    <span style={mono({ fontSize: 9.5, color: hero.accColor })}>● {hero.accLabel}</span>
                    {hero.onPath && <span style={mono({ fontSize: 9, color: "#e3c878" })}>◆ on your path</span>}
                  </div>
                  <div style={cinzel({ fontWeight: 800, fontSize: 19, color: "#f4e8c8", lineHeight: 1.2, marginTop: 6 })}>{hero.title}</div>
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.58, color: "#d4c7ae", margin: "13px 0 16px" }}>{hero.why}</div>
              <div style={cinzel({ fontWeight: 800, fontSize: 22, color: "#e3c878", marginBottom: 4 })}>{hero.metric}</div>
              {hero.hasSrc && <div style={mono({ fontSize: 9, letterSpacing: ".14em", color: hero.srcColor, marginBottom: 16 })}>● {hero.src}</div>}
              <div style={{ marginBottom: 17 }}>
                <div style={mono({ fontSize: 8.5, letterSpacing: ".22em", color: "#8a7aa8", marginBottom: 11 })}>WHY IT RANKS · SIGNAL FINGERPRINT</div>
                <div style={{ display: "flex", gap: 13 }}>
                  {hero.bars.map((b) => (
                    <div key={b.k} style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={mono({ fontSize: 8.5, color: "#9a8ab8", letterSpacing: ".04em" })}>{b.k}</span>
                        <span style={mono({ fontSize: 9, color: "#c9b78a" })}>{b.val}</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,.09)", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: b.pct, background: b.color }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <a href="#" onClick={(e) => { e.preventDefault(); this.go(hero.goto); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 17px", borderRadius: 6, background: "linear-gradient(180deg,#e9d18a,#c9a24e)", color: "#2c2013", textDecoration: "none", boxShadow: "0 4px 12px rgba(227,200,120,.26)", ...cinzel({ fontWeight: 700, fontSize: 13 }) }}>Act on this →</a>
            </div>
          )}
          <div style={{ padding: "15px 17px 17px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <span style={mono({ fontWeight: 600, fontSize: 10, color: "#9a86c0", letterSpacing: ".24em" })}>THE QUEUE</span>{rule}
            </div>
            {cm.counselQueue.map((q, i) => (
              <a key={i} href="#" className="cq-row" onClick={(e) => { e.preventDefault(); this.go(q.goto); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 8, textDecoration: "none", border: "1px solid transparent" }}>
                <span style={{ width: 22, textAlign: "center", flex: "0 0 22px", ...cinzel({ fontWeight: 800, fontSize: 13, color: q.rankColor }) }}>{q.rank}</span>
                <span style={{ width: 33, height: 33, flex: "0 0 33px", borderRadius: 8, background: q.domColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{q.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...cinzel({ fontWeight: 600, fontSize: 13.5, color: "#ece0c4" }) }}>{q.title}</div>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2, ...mono({ fontSize: 9.5, color: "#9a86c0" }) }}>{q.domLabel} · {q.metric}{q.hasSrc && <span> · <span style={{ color: q.srcColor }}>{q.src}</span></span>}</div>
                </div>
                <div style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>
                  {q.bars.map((b) => (
                    <span key={b.k} style={{ width: 4, height: 24, background: "rgba(255,255,255,.09)", borderRadius: 2, display: "flex", alignItems: "flex-end", overflow: "hidden" }}><span style={{ width: "100%", height: b.pct, background: b.color }} /></span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
        {/* footer: bottleneck + lens name */}
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 11, padding: "12px 22px", borderTop: "1px solid rgba(227,200,120,.16)", background: "rgba(0,0,0,.24)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 15 }}>⛓️</span>
          <div style={mono({ fontSize: 11, color: "#b8a6d8" })}>Deepest lock: <span style={{ color: "#e6a5a5", fontWeight: 600 }}>{cm.counselBnLabel}</span> <span style={{ color: "#7a6a98" }}>— gates {cm.counselBnParts}</span></div>
          <span style={{ flex: 1 }} />
          <div style={mono({ fontSize: 10, color: "#6a5a88" })}>lens · {cm.counselLensName}</div>
        </div>
      </div>
    );
  }
  renderDashboard(A) {
    const d = this.derive();
    const sm = this.skillMap;
    // money makers
    const aCost = this.alchCost(), cphr = this.alchcfg.castsPerHour || 1200;
    const alchBest = this.alchItems.map((a) => (a.alch - a.buy - aCost) * cphr).reduce((m, v) => Math.max(m, v), 0);
    const slay = this.slayWeighted();
    const accBoss = D.bosses.filter((b) => this.bossEff(b).acc).map((b) => this.bossEff(b).estGp).reduce((m, v) => Math.max(m, v), 0);
    const farmLvlDash = (sm.Farming || { l: 1 }).l;
    const herbBest = Math.max(0, ...this.farmDefs.filter((f) => farmLvlDash >= f.lvl).map((f) => this.farmNet(f)));
    const flipNet = d.logs.flips.map((f) => this.computeFlip(f)).reduce((a, f) => a + f.net, 0);
    const money = [
      { name: "High Alchemy", note: "magic XP + steady gp, AFK-friendly", rate: this.short(alchBest), unit: "gp / hr", c: C.purple, skill: "Magic" },
      { name: "Slayer (after blocks)", note: slay.blocked + " tasks blocked", rate: this.short(slay.gp), unit: "loot / hr", c: C.red, skill: "Slayer" },
      { name: "Best boss (open now)", note: "scaled to your combat & slayer", rate: this.short(accBoss), unit: "gp / hr", c: C.teal, skill: "Hitpoints" },
      { name: "Herb run", note: "~5 min, best unlocked tier", rate: this.short(herbBest), unit: "gp / run", c: C.green, skill: "Farming" },
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
        {this.renderCounsel()}
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
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: C.cardLight, borderRadius: 6, border: "1px solid rgba(44,32,19,.12)", borderLeft: `4px solid ${m.c}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, flex: "0 0 36px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(44,32,19,.06)", border: `1px solid ${m.c}44` }}><Icon url={skillIconUrl(m.skill)} name={m.skill} size={22} /></div>
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
        {(d.cash > 0 || d.items > 0) && (
          <Card style={{ marginTop: 16 }}>
            <Kicker color={C.goldDeep}>🏛 Wealth composition</Kicker>
            <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 10, flexWrap: "wrap" }}>
              <Donut size={150} thickness={24} centerLabel="TOTAL" centerValue={this.short(d.netWorth)}
                segments={[{ value: d.cash, color: "#b98f3e", label: "Cash" }, { value: d.items, color: C.green, label: "Items" }]} />
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[["Cash · liquid", d.cash, "#b98f3e"], ["Items · held", d.items, C.green]].map(([l, v, c], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: c }} />
                    <div>
                      <div style={mono({ fontSize: 9.5, letterSpacing: ".12em", color: C.muted, textTransform: "uppercase" })}>{l} · {Math.round((v / Math.max(1, d.netWorth)) * 100)}%</div>
                      <div style={cinzel({ fontWeight: 700, fontSize: 19, color: C.ink })}>{this.fmt(v)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  // ===================== SKILLS =====================
  renderSkills() {
    const d = this.derive();
    const TH = themeFor("skills");
    const cards = this.skillsRaw.map(([name, level, xp]) => {
      const base = this.xpFor(level), next = this.xpFor(level + 1), need99 = this.xpFor(99);
      const into = xp - base, span = next - base;
      const pctNext = level >= 99 ? 1 : Math.max(0, Math.min(1, span > 0 ? into / span : 0));
      return { name, level, xp, color: this.skillColor(level), barW: pctNext * 100, toNext: level >= 99 ? "maxed" : this.fmt(next - xp) + " to " + (level + 1), to99: level >= 99 ? "★ 99" : this.fmt(need99 - xp) + " to 99" };
    });
    // Mastery spread by level band.
    const bands = [
      { label: "99", color: "#b98f3e", test: (l) => l >= 99 },
      { label: "90+", color: C.purple, test: (l) => l >= 90 && l < 99 },
      { label: "70–89", color: C.teal, test: (l) => l >= 70 && l < 90 },
      { label: "40–69", color: C.green, test: (l) => l >= 40 && l < 70 },
      { label: "1–39", color: "#9a6a3a", test: (l) => l < 40 },
    ].map((b) => ({ ...b, value: this.skillsRaw.filter(([, l]) => b.test(l)).length }));
    const statCards = [
      { label: "Total Level", value: "" + d.totalLevel, c: "#b98f3e" },
      { label: "Total XP", value: this.short(d.totalXp), c: C.purple },
      { label: "Skills at 99", value: "" + d.count99, c: C.teal },
      { label: "Combat Level", value: "" + this.account.combat, c: C.red },
    ];
    return (
      <div>
        <SectionTitle kicker="Live from your hiscores" title="Skills" accent={TH.accent} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          {statCards.map((s, i) => (
            <Card key={i} pad={14} style={{ borderTop: `3px solid ${s.c}` }}>
              <Kicker>{s.label}</Kicker>
              <div style={cinzel({ fontWeight: 800, fontSize: 26, color: s.c, marginTop: 6 })}>{s.value}</div>
            </Card>
          ))}
        </div>
        <Card style={{ marginBottom: 16, borderTop: `3px solid ${TH.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <Kicker color={TH.accent}>Mastery spread</Kicker>
            <span style={mono({ fontSize: 11, color: C.muted })}>Total level <strong style={{ color: C.ink }}>{d.totalLevel.toLocaleString()}</strong> / 2277</span>
          </div>
          <div style={{ marginBottom: 8 }}><Bar pct={(d.totalLevel / 2277) * 100} c1={TH.accent} c2={TH.lite} h={8} /></div>
          <BandBar segments={bands} height={26} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
            {bands.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: b.color }} />
                <span style={mono({ fontSize: 11, color: C.muted2 })}>{b.label} · {b.value}</span>
              </div>
            ))}
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 12 }}>
          {cards.map((s) => (
            <Card key={s.name} pad={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, flex: "0 0 38px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(44,32,19,.06)", border: `1px solid ${s.color}44` }}>
                  <Icon url={skillIconUrl(s.name)} name={s.name} size={24} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cinzel({ fontWeight: 700, fontSize: 16, color: C.ink })}>{s.name}</div>
                  <div style={mono({ fontSize: 10, color: C.muted })}>{this.fmt(s.xp)} xp</div>
                </div>
                <div style={cinzel({ fontWeight: 800, fontSize: 26, color: s.color })}>{s.level}</div>
              </div>
              <div style={{ marginTop: 11 }}><Bar pct={s.barW} c1={s.color} c2={s.color} h={6} /></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={mono({ fontSize: 9.5, color: C.muted })}>{s.toNext}</span>
                <span style={mono({ fontSize: 9.5, color: C.muted })}>{s.to99}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ===================== PATHFINDER (The Keystone Web) =====================
  renderPathfinder() {
    const TH = themeFor("pathfinder");
    const pf = this.computePathfinder();
    const ch = pf.pfChoke;
    const sortBtn = (id, label) => { const on = (this.state.pfSort || "lev") === id; return <a key={id} href="#" onClick={(e) => { e.preventDefault(); this.setPfSort(id); }} style={{ padding: "5px 11px", borderRadius: 5, textDecoration: "none", background: on ? "#6a4a8a" : "transparent", color: on ? "#fbf3df" : "#7a5aa0", ...mono({ fontSize: 10 }) }}>{label}</a>; };
    return (
      <div>
        <SectionTitle kicker="Dependency Atlas · what unlocks what" title="The Keystone Web" accent={TH.accent} />
        {/* #1 chokepoint hero */}
        {ch && (
          <div style={{ position: "relative", border: "2px solid #5a4478", borderRadius: 9, overflow: "hidden", marginBottom: 22, background: "radial-gradient(130% 150% at 15% 0%, #2a1f3d 0%, #201830 46%, #171021 100%)", boxShadow: "0 14px 38px rgba(18,10,28,.4)" }}>
            <div style={{ position: "absolute", inset: 0, opacity: 0.5, backgroundImage: "radial-gradient(circle at 84% 16%, rgba(154,123,192,.2), transparent 44%), radial-gradient(circle at 14% 92%, rgba(106,74,138,.28), transparent 48%)", pointerEvents: "none" }} />
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", alignItems: "center" }}>
              <div style={{ padding: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg viewBox="0 0 320 240" style={{ width: "100%", maxWidth: 360, height: "auto" }}>
                  {ch.spokes.map((s, i) => <line key={"l" + i} x1="160" y1="120" x2={s.x2} y2={s.y2} stroke={s.color} strokeWidth="2" opacity="0.5" />)}
                  {ch.spokes.map((s, i) => (
                    <g key={"g" + i}>
                      <circle cx={s.x2} cy={s.y2} r={s.r} fill={s.color} opacity="0.92" />
                      <text x={s.x2} y={s.y2} textAnchor="middle" dy="4" fill="#fbf3df" fontFamily="'JetBrains Mono',monospace" fontSize="11" fontWeight="700">{s.n}</text>
                      <text x={s.lx} y={s.ly} textAnchor="middle" dy="3" fill="#b8a6d8" fontFamily="'JetBrains Mono',monospace" fontSize="9">{s.label}</text>
                    </g>
                  ))}
                  <circle cx="160" cy="120" r="26" fill={ch.color} stroke="#e3c878" strokeWidth="2" />
                  <text x="160" y="120" textAnchor="middle" dy="8" fontSize="24">{ch.icon}</text>
                </svg>
              </div>
              <div style={{ padding: "24px 26px 24px 4px" }}>
                <div style={mono({ fontSize: 10, letterSpacing: ".24em", color: "#9a86c0", marginBottom: 9 })}>THE #1 CHOKEPOINT</div>
                <div style={cinzel({ fontWeight: 800, fontSize: 25, color: "#f2e2b2", lineHeight: 1.15 })}>{ch.action}</div>
                <div style={{ margin: "8px 0 12px", ...mono({ fontSize: 11, color: "#e3c878" }) }}>holds <span style={{ fontWeight: 700 }}>{ch.coverPct}</span> of your locked value · {ch.effort}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "#d4c7ae", marginBottom: 16 }}>{ch.blurb}</div>
                <a href="#" onClick={(e) => { e.preventDefault(); this.go("skills"); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 17px", borderRadius: 6, background: "linear-gradient(180deg,#b79bd8,#7a5aa0)", color: "#1a1226", textDecoration: "none", ...cinzel({ fontWeight: 700, fontSize: 13 }) }}>Break this lock →</a>
              </div>
            </div>
          </div>
        )}
        {/* reachability tier cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
          {[[pf.pfTotalLocked, "Locked pieces", "#6a4a8a", "#2c2013"], [pf.pfTierOne, "One lock away", "#5c7a35", "#5c6e35"], [pf.pfTierTwo, "Two locks away", "#9a7530", "#9a7530"], [pf.pfTierDeep, "Deeper in the web", "#963a2c", "#963a2c"]].map(([v, l, bc, fc], i) => (
            <div key={i} style={{ background: "#f2e9d2", border: "1px solid rgba(44,32,19,.2)", borderTop: `3px solid ${bc}`, borderRadius: 5, padding: "16px 18px" }}>
              <div style={cinzel({ fontWeight: 800, fontSize: 30, color: fc })}>{v}</div>
              <div style={{ marginTop: 2, textTransform: "uppercase", ...mono({ fontSize: 9.5, letterSpacing: ".12em", color: "#8a6a38" }) }}>{l}</div>
            </div>
          ))}
        </div>
        {/* keystones */}
        <div style={{ background: "#f2e9d2", border: "1px solid rgba(44,32,19,.2)", borderRadius: 6, boxShadow: "0 4px 14px rgba(90,64,30,.12)", marginBottom: 22, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "15px 20px", borderBottom: "1px solid rgba(44,32,19,.14)", background: "rgba(106,74,138,.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16 }}>🧲</span><h3 style={{ margin: 0, ...cinzel({ fontWeight: 700, fontSize: 16, color: "#2c2013" }) }}>Keystones — highest-leverage unlocks</h3></div>
            <div style={{ display: "flex", gap: 3, padding: 3, background: "rgba(44,32,19,.06)", borderRadius: 7 }}>{sortBtn("lev", "Best leverage")}{sortBtn("impact", "Total cascade")}</div>
          </div>
          {pf.pfKeystones.map((k, i) => (
            <div key={i} style={{ padding: "15px 20px", borderBottom: "1px solid rgba(44,32,19,.08)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <span style={{ width: 20, textAlign: "center", flex: "0 0 20px", ...cinzel({ fontWeight: 800, fontSize: 15, color: "#a88bc8" }) }}>{k.rank}</span>
                <span style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: 9, background: k.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19 }}>{k.icon}</span>
                <a href="#" onClick={(e) => { e.preventDefault(); this.go(k.goto); }} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                  <div style={cinzel({ fontWeight: 700, fontSize: 15.5, color: "#2c2013" })}>{k.action}</div>
                  <div style={{ marginTop: 2, ...mono({ fontSize: 10, color: "#8a6a38" }) }}>{k.effort}</div>
                </a>
                <div style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
                  {k.chips.map((c, j) => <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 12, background: c.color, color: "#fbf3df", ...mono({ fontSize: 10.5, fontWeight: 600 }) }}><span style={{ fontSize: 11 }}>{c.icon}</span>{c.n}</span>)}
                </div>
              </div>
              {k.hasWhy && <div style={{ fontSize: 13, lineHeight: 1.5, color: "#4a3d2a", margin: "9px 0 0 33px" }}>{k.why}</div>}
              {k.hasClimb && <div style={{ margin: "6px 0 0 33px", ...mono({ fontSize: 10, color: "#2f7d72" }) }}>🧲 {k.climb}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "11px 0 0 33px" }}>
                <div style={{ flex: 1, height: 7, background: "rgba(44,32,19,.08)", borderRadius: 4, overflow: "hidden", maxWidth: 230 }}><div style={{ height: "100%", width: k.barPct, background: "linear-gradient(90deg,#9a7bc0,#e3c878)" }} /></div>
                <span style={mono({ fontSize: 10, color: "#6a5436" })}>frees {k.directN} now <span style={{ color: "#7a5aa0" }}>{k.horizonN}</span></span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 0 33px" }}>
                {k.unlocked.map((u, j) => <span key={j} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 5, background: "#fbf6e8", border: "1px solid rgba(44,32,19,.12)", ...mono({ fontSize: 10, color: "#5a4a35" }) }}><span style={{ width: 7, height: 7, borderRadius: 2, background: u.color }} />{u.name}</span>)}
                {k.unlockedMore && <span style={{ alignSelf: "center", ...mono({ fontSize: 10, color: "#a08a5a" }) }}>{k.unlockedMore}</span>}
              </div>
            </div>
          ))}
        </div>
        {/* frontier */}
        <div style={{ background: "#f2e9d2", border: "1px solid rgba(44,32,19,.2)", borderRadius: 6, boxShadow: "0 4px 14px rgba(90,64,30,.12)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 20px", borderBottom: "1px solid rgba(44,32,19,.14)", background: "rgba(106,74,138,.08)" }}><span style={{ fontSize: 16 }}>⚸</span><h3 style={{ margin: 0, ...cinzel({ fontWeight: 700, fontSize: 16, color: "#2c2013" }) }}>The Frontier — one SHORT step from opening</h3><span style={{ marginLeft: "auto", ...mono({ fontSize: 9.5, color: "#7a5aa0" }) }}>≤10 levels or a quest you can start now</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 11, padding: "18px 20px" }}>
            {pf.pfFrontier.length === 0 && <div style={{ gridColumn: "1 / -1", ...serif({ fontSize: 13, fontStyle: "normal", color: C.muted, padding: "6px 2px" }) }}>Nothing sits within a short climb right now — the keystones above are the fastest routes to new unlocks.</div>}
            {pf.pfFrontier.map((f, i) => (
              <a key={i} href="#" onClick={(e) => { e.preventDefault(); this.go(f.goto); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 7, background: "#fbf6e8", border: "1px solid rgba(44,32,19,.14)", textDecoration: "none" }}>
                <span style={{ width: 32, height: 32, flex: "0 0 32px", borderRadius: 7, background: f.typeColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{f.glyph}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...cinzel({ fontWeight: 600, fontSize: 13.5, color: "#2c2013" }) }}>{f.name}</div>
                  <div style={{ marginTop: 2, ...mono({ fontSize: 10, color: f.blockerColor }) }}>needs {f.blocker}</div>
                </div>
              </a>
            ))}
          </div>
          {pf.pfFrontierMore && <div style={{ padding: "0 20px 16px", ...mono({ fontSize: 10.5, color: "#a08a5a" }) }}>{pf.pfFrontierMore}</div>}
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
          <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 10 })}>
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
    const n = vals.length;
    const points = d.nwSorted.map((s) => ({ v: s.cash + s.items, label: this.dShort(s.date) }));
    const deltaBars = d.nwSorted.map((s, i) => ({ label: this.dShort(s.date), v: i > 0 ? (s.cash + s.items) - vals[i - 1] : 0 })).filter((_, i) => i > 0).slice(-8);
    const rows = d.nwSorted.map((s, i) => { const v = s.cash + s.items; const prev = i > 0 ? vals[i - 1] : v; return { i: this.logs.nw.indexOf(s), date: this.dShort(s.date), total: this.short(v), cash: this.fmt(s.cash), items: this.fmt(s.items), note: s.note || "", delta: i > 0 ? this.signed(v - prev) : "—", dc: v - prev >= 0 ? C.green : C.red }; }).reverse();
    const lastDelta = vals.length > 1 ? vals[vals.length - 1] - vals[vals.length - 2] : 0;
    return (
      <div>
        <SectionTitle kicker="The Treasury" title="Net Worth" accent={TH.accent}
          right={<Btn tone="gold" onClick={() => this.toggleForm("nw")}>+ Log snapshot</Btn>} />
        <Hero theme={TH} kicker="Treasury ledger" title={this.short(d.netWorth)}
          blurb={n > 1 ? `${this.signed(d.netWorth - d.nwStart)} since your first snapshot · ${this.signed(lastDelta)} on the last log` : "Log snapshots to chart your wealth over time"}
          statLabel="Avg / day" statValue={this.short(d.gpDay)} statSub={n > 1 ? n + " snapshots" : "—"} />
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
              <span style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, flexBasis: "100%" })}>Item/bank value is your total bank minus the cash you hold; net worth is the total. Pull the total from a bank-value plugin or the GE.</span>
            </div>
          </Card>
        )}
        <div style={{ display: "grid", gridTemplateColumns: n >= 2 ? "1.7fr 1fr" : "1fr", gap: 16, marginBottom: 14 }}>
          <Card style={{ borderTop: `3px solid ${TH.accent}` }}>
            <Kicker color={TH.accent}>Wealth curve</Kicker>
            <div style={{ marginTop: 6 }}><LineChart points={points} theme={TH} yFmt={(v) => this.short(v)} valueLabel={this.short(d.netWorth)} /></div>
          </Card>
          {n >= 2 && (
            <Card style={{ borderTop: `3px solid ${TH.accent}` }}>
              <Kicker color={TH.accent}>Change per snapshot</Kicker>
              <div style={{ marginTop: 10 }}><BarChartH data={deltaBars} theme={TH} valueFmt={(v) => this.signed(v)} /></div>
            </Card>
          )}
        </div>
        <Card>
          <div className="sheetwrap">
            <table className="sheet">
              <thead><tr>{["Date", "Total", "Cash", "Items", "Δ", "Note", ""].map((h, i) => <th key={i} className={i > 0 && i < 5 ? "num" : ""}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, k) => (
                <tr key={k}>
                  <td style={mono({ fontSize: 12 })}>{r.date}</td>
                  <td className="num" style={cinzel({ fontWeight: 600 })}>{r.total}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.cash}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.items}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.dc })}>{r.delta}</td>
                  <td style={serif({ fontSize: 13, fontStyle: r.note ? "italic" : "normal", color: C.muted })}>{r.note || "—"}</td>
                  <td><span onClick={() => this.delLog("nw", r.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td>
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
    const FTH = themeFor("flipping");
    return (
      <div>
        <SectionTitle kicker="Grand Exchange" title="Flipping Desk" accent={FTH.accent} />
        <Hero theme={FTH} icon="⚖" kicker="Grand Exchange ledger" title={this.signed(flipNetN) + " realized"}
          blurb={fc.length ? `${fc.length} flips · ${Math.round((wins / fc.length) * 100)}% win rate · ${this.short(capPer)} working each of 8 GE slots` : "Log flips and tune the scanner — your realized P&L tracks here"}
          statLabel="Capital / flip" statValue={this.short(capPer)} statSub="per GE slot" />
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
    const TH = themeFor("flipping");
    const controls = [
      { key: "capital", label: "Flip capital", suffix: "gp", hint: "split across 8 GE slots" },
      { key: "minMargin", label: "Min margin %", suffix: "%", hint: "floor after the 2% tax" },
      { key: "maxMargin", label: "Max margin %", suffix: "%", hint: "ceiling (stale/manip) · 0 = no limit" },
      { key: "minProfit4h", label: "Min profit / 4h", suffix: "gp", hint: "the 'worth a GE slot' bar · fill capped by limit, capital AND volume" },
      { key: "minVolume", label: "Min daily volume", suffix: "", hint: "liquidity gate" },
      { key: "minBuy", label: "Min buy price", suffix: "gp", hint: "cuts penny junk" },
      { key: "maxAge", label: "Max price age", suffix: "min", hint: "age of the STALER price side · 0 = no limit" },
      { key: "watchTol", label: "Watch tolerance", suffix: "%", hint: "how close a near-miss counts as Watch" },
    ];
    const tol = Math.max(0, (cfg.watchTol != null ? cfg.watchTol : 15)) / 100;
    // Ceilings of 0 = "no limit" so lowering a max field can't silently hide everything.
    const maxMargin = cfg.maxMargin > 0 ? cfg.maxMargin : Infinity;
    const maxAge = cfg.maxAge > 0 ? cfg.maxAge : Infinity;
    // Scan the whole live market when we have it; otherwise the manual list.
    const usingMarket = this.priceRows && this.priceRows.length > 0;
    const source = usingMarket ? this.priceRows : this.logs.scan;
    // Your realized capture rate discounts every projection ("you ≈ …").
    const capR = this.flipCapture();
    const capRate = capR.rate != null && capR.matched >= 2 ? capR.rate : null;
    const fail = { margin: 0, vol: 0, age: 0, profit: 0, buy: 0 };
    const allRows = source.map((it, i) => {
      // Realistic trade prices: a single outlier trade can spike the instant
      // low/high, so when we have the last hour's averages, you can't expect to
      // buy below them or sell above them sustainably.
      const has1h = it.hvol1h != null;
      const buy = has1h && it.avgLow1h > 0 ? Math.max(it.buy, it.avgLow1h) : it.buy;
      const sell = has1h && it.avgHigh1h > 0 ? Math.min(it.sell, it.avgHigh1h) : it.sell;
      const tax = this.flipTax(sell, 1); const margin = buy > 0 ? ((sell - tax - buy) / buy) * 100 : 0;
      // Realistic 4h fill: buy limit AND your capital AND what's ACTUALLY
      // trading. A flip consumes both sides, so current flow = the thinner
      // side of the last hour × 4. Yesterday's 24h volume (vol/12) is only the
      // fallback when the hourly feed is unavailable (e.g. manual items).
      const flowHr = has1h ? Math.min(it.hvol1h || 0, it.lvol1h || 0) : null;
      const throughput = has1h ? flowHr * 4 : Math.floor((it.vol || 0) / 12);
      const qty = Math.min(it.limit || 1, Math.floor(capPer / Math.max(1, buy)), Math.max(0, throughput));
      const profit4h = qty * (sell - tax - buy);
      const cMargin = margin >= cfg.minMargin && margin <= maxMargin, cVol = (it.vol || 0) >= cfg.minVolume, cAge = (it.age || 0) <= maxAge, cProfit = profit4h >= cfg.minProfit4h, cBuy = it.buy >= cfg.minBuy;
      if (!cMargin) fail.margin++; if (!cVol) fail.vol++; if (!cAge) fail.age++; if (!cProfit) fail.profit++; if (!cBuy) fail.buy++;
      // "near" = within the watch tolerance of clearing a gate it currently fails.
      const nMargin = margin >= cfg.minMargin * (1 - tol) && margin <= maxMargin * (1 + tol);
      const nVol = (it.vol || 0) >= cfg.minVolume * (1 - tol), nAge = (it.age || 0) <= maxAge * (1 + tol);
      const nProfit = profit4h >= cfg.minProfit4h * (1 - tol), nBuy = it.buy >= cfg.minBuy * (1 - tol);
      const gates = [[cMargin, nMargin], [cVol, nVol], [cAge, nAge], [cProfit, nProfit], [cBuy, nBuy]];
      const all = gates.every((g) => g[0]);
      const watch = !all && gates.every((g) => g[0] || g[1]);
      return { i, manualIdx: usingMarket ? -1 : i, name: it.name, buy: this.fmt(buy), sell: this.fmt(sell), margin: margin.toFixed(1) + "%", marginColor: cMargin ? C.green : C.red, vol: this.short(it.vol || 0), flow: flowHr == null ? "—" : this.short(flowHr) + "/h", flowN: flowHr == null ? -1 : flowHr, age: (it.age || 0) + "m", profit4h: this.short(profit4h), profit4hN: profit4h, you4h: capRate != null && profit4h > 0 ? this.short(Math.round(profit4h * capRate)) : null, all, watch, verdict: all ? "FLIP NOW" : watch ? "WATCH" : "SKIP", vColor: all ? C.green : watch ? "#9a7530" : C.red, vBg: all ? "rgba(92,110,53,.18)" : watch ? "rgba(201,162,74,.16)" : "rgba(150,58,44,.1)", rowBg: all ? "rgba(92,110,53,.10)" : watch ? "rgba(201,162,74,.07)" : "transparent" };
    });
    const avoidByName = this.flipAvoidList().byName;
    allRows.forEach((r) => { r.avoid = avoidByName.get((r.name || "").toLowerCase()) || null; });
    const flipNowN = allRows.filter((r) => r.all).length, watchN = allRows.filter((r) => r.watch).length;
    const avoidShown = allRows.filter((r) => (r.all || (this.state.flipShowWatch && r.watch)) && r.avoid).length;
    const showWatch = this.state.flipShowWatch;
    const rows = allRows.filter((r) => r.all || (showWatch && r.watch)).sort((a, b) => b.profit4hN - a.profit4hN).slice(0, 150);
    const chartRows = allRows.filter((r) => r.all || r.watch).sort((a, b) => b.profit4hN - a.profit4hN).slice(0, 8).map((r) => ({ label: r.name, v: r.profit4hN, color: r.all ? C.green : "#9a7530" }));
    const scanned = source.length;
    const failTop = Object.entries(fail).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0).slice(0, 2).map(([k, v]) => `${v} fail ${({ margin: "margin band", vol: "min volume", age: "freshness", profit: "min profit/4h", buy: "min buy" })[k]}`).join(" · ");
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Kicker color={C.goldDeep}>Control panel · tune what counts as worth-it</Kicker>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={this.refreshPrices}>⟳ Scan market</Btn>
              <Btn tone="quiet" onClick={this.resetFlipCfg}>Reset</Btn>
              <Btn tone="quiet" onClick={() => this.toggleForm("scan")}>+ Item</Btn>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10 }}>
            {controls.map((c) => (
              <div key={c.key} style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)", display: "flex", flexDirection: "column", minHeight: 108 }}>
                <Kicker style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</Kicker>
                <div style={{ position: "relative", marginTop: 6 }}>
                  <input key={c.key + "-" + this.state.flipCfgVer} className="led" defaultValue={this.fmt(cfg[c.key])} onBlur={(e) => this.setCfg("flipcfg", c.key, e.target.value)} style={{ width: "100%", fontWeight: 600, paddingRight: c.suffix ? 34 : 9 }} />
                  {c.suffix && <span style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", ...mono({ fontSize: 10, color: C.muted }) }}>{c.suffix}</span>}
                </div>
                <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 6, lineHeight: 1.3, flex: 1 })}>{c.hint}</div>
              </div>
            ))}
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
        {chartRows.length > 0 && (
          <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
            <Kicker color={TH.accent}>Best opportunities · projected profit / 4h</Kicker>
            <div style={{ marginTop: 10 }}><BarChartH data={chartRows} theme={TH} valueFmt={(v) => this.short(v)} /></div>
          </Card>
        )}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <Kicker color={C.goldDeep}>{flipNowN} flip now{watchN ? ` · ${watchN} on watch (within ${Math.round(tol * 100)}% of the gates)` : ""} · {usingMarket ? scanned.toLocaleString() + " market items scanned" : scanned + " in your list"}{capRate != null && <span style={{ marginLeft: 8, ...mono({ fontSize: 9, fontWeight: 600, color: "#9a7530", background: "rgba(201,162,74,.16)", padding: "2px 7px", borderRadius: 4, letterSpacing: ".05em" }) }}>YOUR CAPTURE {Math.round(capRate * 100)}%</span>}</Kicker>
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", ...mono({ fontSize: 11, color: C.muted2 }) }}>
              <input type="checkbox" checked={showWatch} onChange={(e) => this.setState({ flipShowWatch: e.target.checked })} style={{ accentColor: C.gold, width: 15, height: 15 }} />
              Show watch items
            </label>
          </div>
          <div className="sheetwrap">
            <table className="sheet">
              <thead><tr>{["Item", "Buy", "Sell", "Margin", "Daily vol", "Flow (1h)", "Age", "Profit / 4h", "Verdict", ""].map((h, i) => <th key={i} className={i > 0 && i < 8 ? "num" : ""}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.i} style={r.avoid ? { background: "rgba(150,58,44,.10)" } : undefined}>
                  <td style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.name}{r.avoid && <span title={r.avoid.reason} style={{ marginLeft: 7, ...mono({ fontSize: 9, fontWeight: 600, color: r.avoid.tier === "dead" ? "#9a7530" : C.red, background: r.avoid.tier === "dead" ? "rgba(201,162,74,.16)" : "rgba(150,58,44,.14)", padding: "2px 6px", borderRadius: 4 }) }}>⚑ {r.avoid.tier === "dead" ? "DEAD CAP" : "AVOID"}</span>}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.buy}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.sell}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.marginColor })}>{r.margin}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.vol}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.flowN === 0 ? C.red : C.muted2 })}>{r.flow}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.age}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{r.profit4h}{r.you4h != null && <div style={mono({ fontSize: 9, color: "#9a7530" })}>you ≈ {r.you4h}</div>}</td>
                  <td><Tag color={r.vColor} bg={r.vBg}>{r.verdict}</Tag></td>
                  <td>{r.manualIdx >= 0 ? <span onClick={() => this.delLog("scan", r.manualIdx)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span> : null}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={10} style={serif({ fontStyle: "normal", color: C.muted, padding: 18 })}>{!usingMarket && this.logs.scan.length === 0 ? "Hit ⟳ Live prices to scan the market, or add items manually." : watchN > 0 ? `Nothing clears every gate. ${watchN} item${watchN > 1 ? "s are" : " is"} close — tick “Show watch items”.` : `Nothing clears the gates among ${scanned.toLocaleString()} items${failTop ? ` (${failTop})` : ""}. Loosen the control panel or hit Reset.`}</td></tr>}</tbody>
            </table>
          </div>
          <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 8 })}>By default only <strong>FLIP NOW</strong> (clears every gate at your bankroll) shows. Watch items sit within the tolerance % of qualifying.{avoidShown ? ` ${avoidShown} shown ${avoidShown > 1 ? "are" : "is"} on your avoid list (⚑) — flagged from past performance.` : ""} Margin is after the 2% sell tax, on prices sanity-checked against the last hour's averages (one outlier trade can't fake a spread). <strong>Flow (1h)</strong> is the thinner side of what actually traded in the last hour — profit/4h fills min(buy limit, your capital per slot, 4h of that flow), so yesterday's volume can't inflate a dead item.{capRate != null ? <> <strong>you ≈</strong> discounts each projection by your {Math.round(capRate * 100)}% capture rate — measured from {capR.matched} of your logged flips graded against today's scanner margins on the same items (see Performance).</> : ""} Hit ⟳ Scan market to refresh from the OSRS Wiki.</div>
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
                  <td style={{ ...cinzel({ fontWeight: 600, fontSize: 14 }), padding: "7px 9px" }}>{r.item}{r.notes ? <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted })}>{r.notes}</div> : null}</td>
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
    const TH = themeFor("flipping");
    const byDate = fc.slice().sort((a, b) => new Date(a.sellDate || a.buyDate) - new Date(b.sellDate || b.buyDate));
    let cum = 0; const cumPts = byDate.map((f) => { cum += f.net; return { v: cum, label: this.dShort(f.sellDate || f.buyDate) }; });
    const itemBars = rows.slice(0, 8).map((r) => ({ label: r.item, v: r.net }));
    const av = this.flipAvoidList();
    const pill = { watch: { c: C.teal, bg: "rgba(60,107,107,.14)", label: "WATCH" }, avoid: { c: C.red, bg: "rgba(150,58,44,.14)", label: "AVOID" }, dead: { c: "#9a7530", bg: "rgba(201,162,74,.16)", label: "DEAD CAP" } };
    const cap = this.flipCapture();
    const capPct = cap.rate != null ? Math.round(cap.rate * 100) : null;
    const capColor = capPct == null ? C.muted : capPct >= 85 ? C.green : capPct >= 55 ? "#9a7530" : C.red;
    return (
      <div>
        <Card style={{ marginBottom: 16, borderTop: `3px solid ${TH.accent}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <div style={{ minWidth: 150 }}>
              <Kicker color={TH.accent}>Margin capture rate</Kicker>
              <div style={mono({ fontSize: 32, fontWeight: 700, color: capColor })}>{capPct != null ? capPct + "%" : "—"}</div>
              <div style={mono({ fontSize: 10, color: C.muted2 })}>{cap.matched > 0 ? `${cap.matched} of ${cap.total} flips matched to the scan` : this.priceRows && this.priceRows.length ? "no logged flips match today's scan" : "hit ⟳ Scan market on the Scanner first"}</div>
            </div>
            <div style={{ flex: 1, minWidth: 280, ...serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted, lineHeight: 1.5 }) }}>
              How much of the scanner's theoretical margin your real flips actually banked: each logged flip's realized ROI is graded against today's sanity-checked margin on the same item, weighted by the capital you committed. The Scanner discounts every projection by this rate (the <strong style={{ color: "#9a7530" }}>you ≈</strong> line) — so the more honestly you log, the more honestly it predicts. Yardstick caveat: scans aren't archived, so it grades against <em>today's</em> margins, not the ones you saw when you flipped.
            </div>
          </div>
        </Card>
        {fc.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
            <Card style={{ borderTop: `3px solid ${TH.accent}` }}>
              <Kicker color={TH.accent}>Cumulative realized P&L</Kicker>
              <div style={{ marginTop: 6 }}><LineChart points={cumPts} theme={TH} yFmt={(v) => this.short(v)} valueLabel={this.signed(cum)} /></div>
            </Card>
            <Card style={{ borderTop: `3px solid ${TH.accent}` }}>
              <Kicker color={TH.accent}>Net by item</Kicker>
              <div style={{ marginTop: 10 }}><BarChartH data={itemBars} theme={TH} valueFmt={(v) => this.signed(v)} /></div>
            </Card>
          </div>
        )}
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
            ))}{rows.length === 0 && <tr><td colSpan={6} style={serif({ fontStyle: "normal", color: C.muted, padding: 16 })}>Log some flips to see performance.</td></tr>}</tbody>
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
            {wins.length === 0 && <div style={serif({ fontStyle: "normal", color: C.muted })}>No winning flips logged yet.</div>}
          </div>
        </Card>
      </div>
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Kicker color={C.goldDeep}>Watchlist &amp; Avoid {av.auto.length ? `· ${av.auto.length} auto-flagged from your history` : ""}</Kicker>
            <Btn tone="gold" onClick={() => this.toggleForm("watch")}>+ Add item</Btn>
          </div>
          {this.state.openForm === "watch" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              {this.field("watch_item", "Item", { w: 180, list: "tradeItems" })}
              <datalist id="tradeItems">{this.itemNames.map((n) => <option key={n} value={n} />)}</datalist>
              <select className="led" id="watch_type" style={{ width: 130 }}><option value="watch">Watch</option><option value="avoid">Avoid</option></select>
              {this.field("watch_note", "Note / why", { w: 200 })}
              <Btn tone="gold" onClick={this.addWatch}>Save</Btn>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 14 }}>
            <div>
              <div style={mono({ fontSize: 9, letterSpacing: ".16em", color: C.muted, textTransform: "uppercase", marginBottom: 8 })}>Watching</div>
              {av.manual.filter((m) => m.type === "watch").map((m) => (
                <div key={m.i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.cardLight, borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${C.teal}` }}>
                  <Tag color={pill.watch.c} bg={pill.watch.bg}>WATCH</Tag>
                  <div style={{ flex: 1 }}><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{m.item}</div>{m.note && <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted })}>{m.note}</div>}</div>
                  <span onClick={() => this.delLog("watch", m.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span>
                </div>
              ))}
              {av.manual.filter((m) => m.type === "watch").length === 0 && <div style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted })}>Nothing on your watchlist — add items you're hunting.</div>}
            </div>
            <div>
              <div style={mono({ fontSize: 9, letterSpacing: ".16em", color: C.muted, textTransform: "uppercase", marginBottom: 8 })}>Avoid &amp; dead capital</div>
              {av.manual.filter((m) => m.type === "avoid").map((m) => (
                <div key={"m" + m.i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.cardLight, borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${C.red}` }}>
                  <Tag color={pill.avoid.c} bg={pill.avoid.bg}>AVOID</Tag>
                  <div style={{ flex: 1 }}><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{m.item}</div>{m.note && <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted })}>{m.note}</div>}</div>
                  <span onClick={() => this.delLog("watch", m.i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span>
                </div>
              ))}
              {av.auto.map((x) => { const p = pill[x.flag.tier]; return (
                <div key={"a" + x.p.item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: C.cardLight, borderRadius: 6, marginBottom: 6, borderLeft: `3px solid ${p.c}` }}>
                  <Tag color={p.c} bg={p.bg}>⚑ {p.label}</Tag>
                  <div style={{ flex: 1 }}><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{x.p.item}</div><div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted })}>{x.flag.reason}</div></div>
                  <span onClick={() => this.dismissAvoid(x.p.item)} title="Dismiss this auto-flag" style={{ cursor: "pointer", ...mono({ fontSize: 10, color: C.muted2 }) }}>dismiss</span>
                </div>
              ); })}
              {av.manual.filter((m) => m.type === "avoid").length === 0 && av.auto.length === 0 && <div style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted })}>No items flagged. Poor performers from your flip log auto-appear here.</div>}
            </div>
          </div>
          <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted, marginTop: 12 })}>Auto-flagged: net-negative or ≤33% win over ≥3 flips, or a single flip ≤ −10% ROI → <strong style={{ color: C.red }}>Avoid</strong>; ≥3 flips that barely clear tax (avg ROI &lt; 1%) → <strong style={{ color: "#9a7530" }}>Dead capital</strong>. Flagged items show a ⚑ in the scanner. Dismiss to ignore.</div>
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
          <div style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted, marginTop: 12 })}>Enter each partial fill as the price moved — the weighted <strong>Qty, Avg buy, Avg sell</strong> come out. Copy it (tab-separated, paste-ready) or send it straight to the Flip Ledger.</div>
        </Card>
      </div>
    );
  }

  // ===================== HIGH ALCHEMY =====================
  renderAlchemy() {
    const d = this.derive(); const aCost = this.alchCost(), cphr = this.alchcfg.castsPerHour || 1200;
    const rows = this.alchItems.map((a) => {
      const profit = a.alch - a.buy - aCost;
      // How many you can actually buy = min(buy limit, what your cash affords);
      // sustain hours = that stock divided by your casts/hr input.
      const qtyAfford = Math.min(a.limit || 0, Math.floor(d.cash / Math.max(1, a.buy)));
      const sustainHrs = cphr > 0 ? qtyAfford / cphr : 0;
      const sustain = sustainHrs >= 2;
      return { item: a.item, alch: a.alch, buy: a.buy, profit, qtyAfford, sustainHrs, phr: profit * cphr, limit: a.limit, gpxp: (profit / 65).toFixed(2), sustain };
    }).sort((a, b) => b.phr - a.phr);
    const best = rows.filter((r) => r.sustain && r.profit > 0)[0] || rows.filter((r) => r.profit > 0)[0] || rows[0];
    const maxPhr = Math.max(1, ...rows.map((r) => r.phr));
    const log = this.logs.alch;
    const TH = themeFor("alchemy");
    const sess = { n: log.length, profit: log.reduce((a, x) => a + (x.net || 0), 0), xp: log.reduce((a, x) => a + (x.xp || 0), 0), casts: log.reduce((a, x) => a + (x.casts || 0), 0) };
    const setupCell = { background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" };
    return (
      <div>
        <SectionTitle kicker="Arcane Profit · Staff of Fire assumed" title="High Alchemy" accent={TH.accent}
          right={<div style={{ display: "flex", gap: 8 }}><Btn onClick={this.refreshPrices}>⟳ Live prices</Btn><Btn tone="gold" onClick={() => this.toggleForm("alch")}>+ Log session</Btn></div>} />
        {best && <Hero theme={TH} kicker="Verdict · best sustainable alch (2h+)" title={best.item}
          blurb={`+${best.profit} gp/cast · ${best.sustain ? `${this.fmt(best.qtyAfford)} buyable → ${best.sustainHrs.toFixed(1)}h sustainable` : best.qtyAfford > 0 ? `only ${this.fmt(best.qtyAfford)} affordable → ${best.sustainHrs.toFixed(1)}h before restock` : "log your cash to size affordability"}`}
          statLabel="Profit / hr" statValue={this.short(best.phr)} statSub={this.short(best.phr * 2) + " over 2h"} />}
        <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Kicker color={C.purple}>⚙ Setup</Kicker>
            <Btn tone="quiet" onClick={this.refreshNatRune}>⟳ Nat price (Wiki)</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            <div style={setupCell}><Kicker>Casts / hour</Kicker><input className="led" defaultValue={this.fmt(this.alchcfg.castsPerHour)} onBlur={(e) => this.setCfg("alchcfg", "castsPerHour", e.target.value)} style={{ width: "100%", marginTop: 6 }} /></div>
            <div style={setupCell}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Kicker>Nature rune</Kicker><Tag color={C.purple} bg="rgba(106,74,138,.14)">LIVE</Tag></div><div style={cinzel({ fontWeight: 700, fontSize: 19, marginTop: 6 })}>{this.fmt(this.alchcfg.natRune)} <span style={mono({ fontSize: 11, color: C.muted })}>gp</span></div><div style={serif({ fontSize: 10.5, fontStyle: "normal", color: C.muted, marginTop: 2 })}>OSRS Wiki · id 561</div></div>
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
          <Kicker color={C.goldDeep}>Item profitability · live · qty afford uses your logged cash {this.short(d.cash)}</Kicker>
          <div className="sheetwrap" style={{ marginTop: 10 }}>
            <table className="sheet">
              <thead><tr>{["Item", "Alch", "GE buy", "Profit/cast", "Profit/hr", "Limit", "Qty afford", "Sustain", "Verdict"].map((h, i) => <th key={i} className={i > 0 && i < 8 ? "num" : ""}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((r, k) => (
                <tr key={k}>
                  <td style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.item}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{this.fmt(r.alch)}</td>
                  <td className="num" style={mono({ fontSize: 12 })}>{this.fmt(r.buy)}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.profit >= 0 ? C.green : C.red })}>{r.profit >= 0 ? "+" : ""}{r.profit}</td>
                  <td className="num"><div style={mono({ fontSize: 12 })}>{this.short(r.phr)}</div><Bar pct={Math.max(0, Math.min(100, (r.phr / maxPhr) * 100))} c1={C.purple} c2={TH.lite} h={4} /></td>
                  <td className="num" style={mono({ fontSize: 12 })}>{this.fmt(r.limit)}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.qtyAfford > 0 ? C.ink : C.muted })}>{r.qtyAfford > 0 ? this.fmt(r.qtyAfford) : "—"}</td>
                  <td className="num" style={mono({ fontSize: 12, color: r.sustain ? C.green : C.muted2 })}>{r.qtyAfford > 0 ? r.sustainHrs.toFixed(1) + "h" : "—"}</td>
                  <td><Tag color={r.sustain ? C.green : C.red} bg={r.sustain ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{r.sustain ? "2h+ ✓" : "limited"}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
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
    // A boss guide page takes over the whole section (full-page view with its
    // own back affordance).
    if (this.state.bossPage) return this.renderBossGuide();
    return (
      <div>
        <SectionTitle kicker="Command Centre · live drop pricing" title="Bossing Compendium" accent={themeFor("bossing").accent}
          right={<Seg options={[{ key: "compendium", label: "DATABASE" }, { key: "tracker", label: "KILL LOG" }, { key: "rates", label: "SESSION RATES" }, { key: "focus", label: "FOCUS" }]} active={view} onPick={(v) => this.setState({ bossView: v, openForm: null })} />} />
        {view === "compendium" && this.renderBossDb()}
        {view === "tracker" && this.renderBossTracker()}
        {view === "rates" && this.renderBossRates()}
        {view === "focus" && this.renderBossFocus()}
      </div>
    );
  }
  // Open a boss guide page and (once per boss per session) pull the live wiki
  // supplement: the strategy page's intro + its section map for deep links.
  // Degrades silently — the battle card is self-contained without it.
  openBossGuide = (name) => {
    this.setState({ bossPage: name });
    // The compendium can be scrolled deep when a name is clicked — the guide
    // is a new page and must open at its top.
    if (typeof window !== "undefined") window.scrollTo(0, 0);
    const g = BOSS_GUIDES[name];
    if (!g || (this._wikiGuide && this._wikiGuide[name])) return;
    this._wikiGuide = this._wikiGuide || {};
    this._wikiGuide[name] = { loading: true, extract: "", sections: [] };
    const title = g.wikiPage.replace(/_/g, " ");
    Promise.allSettled([wikiExtract(title), wikiSections(title)]).then(([ex, se]) => {
      this._wikiGuide[name] = {
        loading: false,
        extract: ex.status === "fulfilled" ? ex.value : "",
        sections: se.status === "fulfilled" ? se.value : [],
        failed: ex.status !== "fulfilled" && se.status !== "fulfilled",
      };
      this.bump();
    });
  };
  // Every unmet gate between this account and the boss (combat, slayer, skill
  // text gates, hard quest prereqs from CONTENT_REQS).
  bossGatesFor(b) {
    const lv = this._lvMap();
    const out = [];
    if (this.account.combat < (b.minCb || 0)) out.push("Combat " + b.minCb + " (now " + this.account.combat + ")");
    if ((b.slay || 0) > 0 && (lv.slayer || 1) < b.slay) out.push("Slayer " + b.slay + " (now " + (lv.slayer || 1) + ")");
    this.gateSkills(b.req).forEach((g) => { if (g.skill === "combat" || (g.skill === "slayer" && (b.slay || 0) > 0)) return; if ((lv[g.skill] || 1) < g.lvl) out.push(g.skill[0].toUpperCase() + g.skill.slice(1) + " " + g.lvl + " (now " + (lv[g.skill] || 1) + ")"); });
    this.bossReqQuestsC(b).forEach((nm) => { const q = (D.quests || []).find((x) => x.n === nm); if (q && !this.questDone(q)) out.push(nm); });
    return out;
  }
  renderBossGuide() {
    const TH = themeFor("bossing");
    const name = this.state.bossPage;
    const b = D.bosses.find((x) => x.n === name);
    const g = BOSS_GUIDES[name];
    if (!b || !g) return <div style={serif({ fontSize: 14, color: C.muted, padding: 20 })}>No guide for “{name}” yet. <a href="#" onClick={(e) => { e.preventDefault(); this.setState({ bossPage: "" }); window.scrollTo(0, 0); }}>Back to the compendium.</a></div>;
    const e = this.bossEff(b);
    const gates = this.bossGatesFor(b);
    const ready = gates.length === 0;
    const killKc = this.logs.boss.filter((x) => x.boss === name).reduce((a, x) => a + (x.kills || 0), 0);
    const dropKc = Math.max(0, ...this.logs.drop.filter((dd) => dd.boss === name).map((dd) => dd.kc || 0));
    const kc = Math.max(killKc, dropKc);
    const styles = this.bossStyles(b);
    const styleColor = { Melee: C.red, Ranged: C.green, Magic: C.purple };
    const prayColor = (p) => (/range/i.test(p) ? C.green : /magic/i.test(p) ? C.purple : /melee/i.test(p) ? C.red : /flick/i.test(p) ? "#9a7530" : C.muted);
    const gearStyle = styles.all.includes(this.state.bossGearStyle) ? this.state.bossGearStyle : styles.primary;
    // Owned-first setup: recommend what the player HAS; slots with nothing
    // owned show the best usable piece as the buy suggestion.
    const setup = this.bestOwnedGearForStyle(gearStyle).map((s) => {
      const it = s.owned || s.best;
      const price = this.gearPrices[it.n] != null ? this.gearPrices[it.n] : it.gp;
      return { slot: s.slot, n: it.n, owned: !!s.owned, price: price > 0 ? this.short(price) : "obtain", upgrade: s.owned && s.owned.n !== s.best.n ? s.best.n : null };
    });
    const ownedN = setup.filter((s) => s.owned).length;
    // drop-table rows (same math as the Focus tab)
    const drops = this.bossDrops[name] || [];
    const dropCount = {}; this.logs.drop.forEach((dd) => { if (dd.boss === name) dropCount[dd.drop] = (dropCount[dd.drop] || 0) + 1; });
    const catColor = { unique: C.gold, common: C.muted2, tertiary: C.purple };
    const catRank = { unique: 0, tertiary: 1, common: 2 };
    const dropRows = drops.slice().sort((a2, b2) => (catRank[a2.cat] ?? 3) - (catRank[b2.cat] ?? 3) || a2.rate - b2.rate).slice(0, 12).map((dr) => { const got = dropCount[dr.n] || 0; const v = this.luckVerdict(kc, dr.rate, got); return { name: dr.n, cat: dr.cat || "common", rate: dr.rate <= 1 ? "common" : "1/" + this.fmt(dr.rate), got, verdict: v.t, vc: v.c, value: dr.v > 0 ? this.short(dr.v) : "—" }; });
    const imgName = name.replace(/\s*\(.*\)$/, "");
    const wikiBase = "https://oldschool.runescape.wiki/w/";
    const bossImgs = [g.img, imgName + ".png"].filter(Boolean).map((f) => wikiBase.replace("/w/", "/w/Special:FilePath/") + encodeURIComponent(f));
    const stars = "★★★★★".slice(0, g.difficulty) + "☆☆☆☆☆".slice(0, 5 - g.difficulty);
    return (
      <div>
        {/* header banner */}
        <div style={{ position: "relative", border: "2px solid #5a2c20", borderRadius: 9, overflow: "hidden", marginBottom: 18, background: "radial-gradient(130% 160% at 14% 0%, #3a1812 0%, #2a100c 48%, #1a0906 100%)", boxShadow: "0 14px 38px rgba(30,8,4,.4)" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.5, backgroundImage: "radial-gradient(circle at 85% 20%, rgba(213,122,90,.18), transparent 45%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, padding: "18px 22px", flexWrap: "wrap" }}>
            <a href="#" onClick={(ev) => { ev.preventDefault(); this.setState({ bossPage: "" }); window.scrollTo(0, 0); }} style={{ textDecoration: "none", padding: "7px 13px", borderRadius: 6, border: "1px solid rgba(213,122,90,.4)", ...mono({ fontSize: 10, letterSpacing: ".08em", color: "#d5a08a" }) }}>← COMPENDIUM</a>
            <div style={{ width: 74, height: 74, flex: "0 0 74px", borderRadius: 10, background: "rgba(0,0,0,.35)", border: "1px solid rgba(213,122,90,.35)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              <Icon url={bossImgs} name={imgName} size={66} style={{ color: "#e8b49a" }} />
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <span style={mono({ fontSize: 9, letterSpacing: ".16em", padding: "2px 8px", border: "1px solid rgba(213,122,90,.4)", borderRadius: 4, color: "#d5a08a" })}>{b.tier}</span>
                <span style={mono({ fontSize: 9, letterSpacing: ".1em", padding: "2px 8px", borderRadius: 4, background: styleColor[styles.primary] + "33", color: "#f0cdbb" })}>BEST: {styles.primary.toUpperCase()}</span>
                <span title={g.diffLabel} style={mono({ fontSize: 11, color: "#e3c878" })}>{stars}</span>
                <span style={mono({ fontSize: 9.5, color: ready ? "#8fbf5a" : "#e6a5a5" })}>{ready ? "● READY — every gate clear" : "● GATED — " + gates.join(" · ")}</span>
              </div>
              <div style={cinzel({ fontWeight: 800, fontSize: 27, color: "#f4e0c8", lineHeight: 1.15, marginTop: 5 })}>{b.n}</div>
              <div style={{ fontSize: 13, color: "#d8b8a4", marginTop: 3, lineHeight: 1.5 }}>{g.tagline}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 130 }}>
              {[["EST GP/HR", e.estGp > 0 ? this.short(e.estGp) : "—"], ["AVG KILL", g.avgKill + " min"], ["YOUR KC", this.fmt(kc)]].map(([l, v]) => (
                <div key={l} style={{ marginBottom: 4 }}><span style={mono({ fontSize: 8.5, letterSpacing: ".14em", color: "#b07c62" })}>{l} </span><span style={cinzel({ fontWeight: 700, fontSize: 15, color: "#f0d8ae" })}>{v}</span></div>
              ))}
            </div>
          </div>
          <div style={{ position: "relative", padding: "12px 22px 15px", borderTop: "1px solid rgba(213,122,90,.22)", fontSize: 13.5, lineHeight: 1.6, color: "#e2c6b2" }}>{g.summary}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 16, alignItems: "start" }}>
          {/* left — the fight */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Card style={{ borderTop: `3px solid ${TH.accent}` }}>
              <Kicker color={TH.accent}>The fight · phase by phase</Kicker>
              <div className="sheetwrap" style={{ marginTop: 10 }}>
                <table className="sheet">
                  <thead><tr>{["Phase", "Pray", "What it does", "Your move"].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                  <tbody>{g.phases.map((p, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap", ...cinzel({ fontWeight: 600, fontSize: 12.5 }) }}>{p.name}</td>
                      <td><Tag color={prayColor(p.pray)} bg={prayColor(p.pray) + "22"}>{p.pray}</Tag></td>
                      <td style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted2 })}>{p.mech}</td>
                      <td style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.ink })}>{p.counter}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </Card>
            {g.rotation && (
              <Card>
                <Kicker color={C.goldDeep}>Rhythm & kill order · the cheat-sheet</Kicker>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {g.rotation.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                      <span style={{ flex: "0 0 18px", textAlign: "center", ...cinzel({ fontWeight: 800, fontSize: 12, color: TH.accent }) }}>{i + 1}</span>
                      <span style={serif({ fontSize: 13.5, fontStyle: "normal", color: C.ink, lineHeight: 1.45 })}>{r}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card style={{ background: "rgba(150,58,44,.05)", border: "1px solid rgba(150,58,44,.22)" }}>
              <Kicker color={C.red}>What actually kills people here</Kicker>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {g.mistakes.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                    <span style={{ color: C.red, ...mono({ fontSize: 11 }) }}>✕</span>
                    <span style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted2, lineHeight: 1.45 })}>{m}</span>
                  </div>
                ))}
              </div>
            </Card>
            {(() => {
              // Live wiki supplement — intro prose + deep links into the full
              // strategy page. Fetched once per boss when the page opens.
              const w = (this._wikiGuide || {})[name];
              const wikiUrl = wikiBase + g.wikiPage;
              return (
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                    <Kicker color={C.goldDeep}>From the OSRS Wiki · live</Kicker>
                    <a href={wikiUrl} target="_blank" rel="noreferrer" style={mono({ fontSize: 10, color: "#9a7530" })}>full strategy page →</a>
                  </div>
                  {!w || w.loading ? (
                    <div style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Consulting the wiki…</div>
                  ) : w.failed ? (
                    <div style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Wiki unreachable right now — the battle card above is self-contained.</div>
                  ) : (
                    <div>
                      {w.extract && <div style={{ marginTop: 8, ...serif({ fontSize: 13.5, fontStyle: "normal", color: C.muted2, lineHeight: 1.55 }) }}>{w.extract.split("\n").filter(Boolean).slice(0, 3).map((para, i) => <p key={i} style={{ margin: i ? "8px 0 0" : 0 }}>{para}</p>)}</div>}
                      {w.sections.length > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={mono({ fontSize: 8.5, letterSpacing: ".14em", color: C.muted, textTransform: "uppercase", marginBottom: 6 })}>Jump straight to</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {w.sections.slice(0, 14).map((s, i) => (
                              <a key={i} href={wikiUrl + "#" + s.anchor} target="_blank" rel="noreferrer" style={{ textDecoration: "none", padding: "3px 10px", borderRadius: 5, background: C.cardLight, border: "1px solid rgba(44,32,19,.14)", ...mono({ fontSize: 10, color: "#6a5436" }) }}>{s.line}</a>
                            ))}
                          </div>
                        </div>
                      )}
                      {!w.extract && !w.sections.length && <div style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted, marginTop: 8 })}>No summary published for this page — the deep link above has the full text.</div>}
                      <div style={serif({ fontSize: 10.5, fontStyle: "normal", color: C.muted, marginTop: 10 })}>Text from the OSRS Wiki (CC BY-NC-SA 3.0) — fetched live, always current.</div>
                    </div>
                  )}
                </Card>
              );
            })()}
          </div>
          {/* right — your setup + ledger */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {this.renderBossSession(name)}
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <Kicker color={C.goldDeep}>Your {gearStyle.toLowerCase()} setup · own {ownedN}/{setup.length} slots</Kicker>
                <Seg options={styles.all.map((s) => ({ key: s, label: s.toUpperCase() }))} active={gearStyle} onPick={(v) => this.setState({ bossGearStyle: v })} size={8.5} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                {setup.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 8px", borderRadius: 5, background: r.owned ? "rgba(92,110,53,.10)" : C.cardLight, border: r.owned ? "1px solid rgba(92,110,53,.28)" : "1px solid transparent", opacity: r.owned ? 1 : 0.85 }}>
                    <Icon url={itemIconUrl(r.n)} name={r.n} size={22} />
                    <span style={{ flex: 1, minWidth: 0, ...serif({ fontSize: 12.5, fontStyle: "normal", color: C.ink }) }}>{r.n}{r.upgrade && <span title={"Best-in-slot you could wear: " + r.upgrade} style={mono({ fontSize: 9, color: "#9a7530" })}> · upgrade: {r.upgrade}</span>}</span>
                    <span style={mono({ fontSize: 9.5, color: C.muted })}>{r.slot}</span>
                    {r.owned ? <span style={mono({ fontSize: 9.5, color: "#3c5322" })}>◆ owned</span> : <span title="You haven't marked this owned — price to buy" style={mono({ fontSize: 10, color: C.red })}>buy {r.price}</span>}
                  </div>
                ))}
              </div>
              <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Built from the gear you've marked <strong style={{ color: "#3c5322" }}>◆ owned</strong> on the Gear Path — unowned slots show the best piece your stats allow, priced live. Wiki style: <strong style={{ color: styleColor[styles.primary] }}>{styles.primary}</strong>. <a href="#" onClick={(e) => { e.preventDefault(); this.go("gear"); }} style={{ color: "#9a7530" }}>Track your gear →</a></div>
            </Card>
            <Card>
              <Kicker color={C.goldDeep}>Inventory · what to bring</Kicker>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
                {g.inventory.map((it, i) => <span key={i} style={{ padding: "4px 10px", borderRadius: 5, background: C.cardLight, border: "1px solid rgba(44,32,19,.14)", ...serif({ fontSize: 12, fontStyle: "normal", color: C.ink }) }}>{it}</span>)}
              </div>
            </Card>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Kicker color={C.goldDeep}>Your ledger · drop luck at KC {this.fmt(kc)}</Kicker>
                <Btn tone="quiet" onClick={() => { this.setState({ bossFocus: name, bossPage: "", bossView: "focus" }); }}>Full tracker →</Btn>
              </div>
              <div className="sheetwrap" style={{ marginTop: 9 }}>
                <table className="sheet">
                  <thead><tr>{["Drop", "Rate", "Got", "Value", "Luck"].map((h, i) => <th key={i} className={i > 0 && i < 4 ? "num" : ""}>{h}</th>)}</tr></thead>
                  <tbody>{dropRows.map((r, k) => (
                    <tr key={k}>
                      <td style={serif({ fontSize: 12, fontStyle: "normal" })}>{r.name}</td>
                      <td className="num" style={mono({ fontSize: 10.5 })}>{r.rate}</td>
                      <td className="num" style={mono({ fontSize: 11.5, color: r.vc })}>{r.got}</td>
                      <td className="num" style={mono({ fontSize: 10.5 })}>{r.value}</td>
                      <td><Tag color={r.vc} bg="transparent">{r.verdict}</Tag></td>
                    </tr>
                  ))}{dropRows.length === 0 && <tr><td colSpan={5} style={serif({ fontStyle: "normal", color: C.muted, padding: 12 })}>No tracked drop table.</td></tr>}</tbody>
                </table>
              </div>
            </Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(44,32,19,.05)", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
              <span style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted })}>Battle card curated {g.asOf} · cross-checked with the OSRS Wiki</span>
              <a href={wikiBase + g.wikiPage} target="_blank" rel="noreferrer" style={{ ...mono({ fontSize: 10.5, color: "#9a7530" }) }}>Full strategy on the Wiki →</a>
            </div>
          </div>
        </div>
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
      { key: "name", cell: (r) => BOSS_GUIDES[r.name] ? <a href="#" onClick={(e) => { e.preventDefault(); this.openBossGuide(r.name); }} title="Open the battle guide" style={{ textDecoration: "none", borderBottom: "1px dotted #9a7530", ...cinzel({ fontWeight: 600, fontSize: 14, color: C.ink }) }}>{r.name} <span style={mono({ fontSize: 9, color: "#9a7530" })}>📖</span></a> : <span style={cinzel({ fontWeight: 600, fontSize: 14 })}>{r.name}</span> },
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
            <div style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted })}>Est GP/hr = base loot + your kills/hr × live rare-drop value. "Open now" = your combat ({this.account.combat}) & Slayer clear the gate. Tune your real kills/hr & GP/hr in the <strong>Session Rates</strong> tab.</div>
            <Btn onClick={this.refreshDropPrices}>⟳ Price drops</Btn>
          </div>
          {this.state.priceStatus && <div style={{ marginTop: 8, ...mono({ fontSize: 11, color: C.muted2 }) }}>{this.state.priceStatus}</div>}
        </Card>
        <Card><DataTable tableKey="boss" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} empty="No bosses match." /></Card>
      </div>
    );
  }
  renderBossRates() {
    const kcAll = {}; this.logs.boss.forEach((b) => (kcAll[b.boss] = (kcAll[b.boss] || 0) + (b.kills || 0)));
    const rows = D.bosses.slice().sort((a, b) => (this.bossEff(b).acc ? 1 : 0) - (this.bossEff(a).acc ? 1 : 0) || this.bossEff(b).estGp - this.bossEff(a).estGp);
    const tuned = Object.keys(this.bossOv).length;
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Kicker color={C.goldDeep}>Session rates · your real kills/hr & GP/hr per boss</Kicker>
            <span style={mono({ fontSize: 11, color: C.muted2 })}>{tuned} boss{tuned === 1 ? "" : "es"} tuned</span>
          </div>
          <div style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted, marginTop: 6 })}>These feed the Dashboard money-meta, Goals route-finding and the Focus tab. Edit a row to override the defaults; live KC comes straight from your Kill Log. <strong>Logged reality</strong> is measured from your own logs — kills/hr from timed Kill Log sessions, gp/hr from your priced drop log at that pace (uniques only, so it's a floor) — hit <strong>adopt</strong> to run every engine on your numbers instead of the book's.</div>
        </Card>
        <Card>
          <div className="sheetwrap">
            <table className="sheet">
              <thead><tr>{["Boss", "Access", "Your KC", "Kills/hr", "GP/hr", "GP/kill", "Logged reality", ""].map((h, i) => <th key={i} className={i > 1 && i < 6 ? "num" : ""}>{h}</th>)}</tr></thead>
              <tbody>{rows.map((b) => { const e = this.bossEff(b); const ov = this.bossOv[b.n]; const kc = kcAll[b.n] || 0; const gpk = e.kills > 0 ? Math.round(e.estGp / e.kills) : 0;
                const r = this.bossReality(b.n);
                const dKph = r.kph != null && e.kills > 0 ? Math.round(((r.kph - e.kills) / e.kills) * 100) : null;
                // "adopted" = the current overrides already match the measurement.
                const adopted = ov && r.kph != null && ov.kills === Math.max(1, Math.round(r.kph)) && (r.gpHr == null || ov.gpHr === Math.max(0, Math.round(r.gpHr)));
                return (
                <tr key={b.n}>
                  <td style={cinzel({ fontWeight: 600, fontSize: 13 })}>{b.n}<div style={mono({ fontSize: 9, color: C.muted })}>{b.tier}</div></td>
                  <td><Tag color={e.acc ? C.green : C.red} bg={e.acc ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{e.acc ? "Open" : "Gated"}</Tag></td>
                  <td className="num" style={mono({ fontSize: 12 })}>{kc ? this.fmt(kc) : "—"}</td>
                  <td className="num"><input className="led" key={"k" + b.n + (ov ? JSON.stringify(ov) : 0)} defaultValue={e.kills} onBlur={(ev) => this.setBossOv(b.n, "kills", ev.target.value)} style={{ width: 70, padding: "4px 6px", textAlign: "right" }} /></td>
                  <td className="num"><input className="led" key={"g" + b.n + (ov ? JSON.stringify(ov) : 0)} defaultValue={e.estGp} onBlur={(ev) => this.setBossOv(b.n, "gpHr", ev.target.value)} style={{ width: 100, padding: "4px 6px", textAlign: "right" }} /></td>
                  <td className="num" style={mono({ fontSize: 12, color: C.muted2 })}>{gpk ? this.short(gpk) : "—"}</td>
                  <td>
                    {r.kph == null ? <span style={mono({ fontSize: 10, color: C.muted })}>{r.kcAll > 0 ? "add minutes to a kill log" : "—"}</span> : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={mono({ fontSize: 11.5 })}>{r.kph}/hr{dKph != null && dKph !== 0 && <span style={{ marginLeft: 6, color: dKph > 0 ? C.green : C.red, fontWeight: 600 }}>{(dKph > 0 ? "+" : "") + dKph}%</span>}<span style={{ marginLeft: 6, color: C.muted, fontSize: 9 }}>({r.timedKills} kills / {r.mins}m)</span></div>
                          <div style={mono({ fontSize: 10, color: C.muted2 })}>{r.gpHr != null ? this.short(r.gpHr) + "/hr · " + r.gpSrc : "log drops or loot to measure gp/hr"}</div>
                        </div>
                        {adopted
                          ? <Tag color={C.green} bg="rgba(92,110,53,.16)">ADOPTED</Tag>
                          : <span onClick={() => this.adoptBossReality(b.n, r)} style={{ cursor: "pointer", color: C.goldDeep, ...mono({ fontSize: 10, fontWeight: 600 }) }}>◈ adopt</span>}
                      </div>
                    )}
                  </td>
                  <td>{ov ? <span onClick={() => this.resetBossOv(b.n)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 10 }) }}>reset</span> : null}</td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }
  // The live field-session panel. ctxBoss = the boss whose page we're on (the
  // battle guide passes its boss so Start is one click, no select). With no
  // context (Kill Log tab) an idle panel offers a boss picker instead.
  renderBossSession(ctxBoss) {
    const TH = themeFor("bossing");
    const s = this.bossSession;
    const ember = { card: { background: "rgba(150,58,44,.055)", border: "1px solid rgba(150,58,44,.30)", borderTop: `3px solid ${TH.accent}` } };
    if (!s) {
      return (
        <Card style={ember.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Kicker color={TH.accent}>Field log · live session</Kicker>
            <span style={{ flex: 1, minWidth: 220, ...serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted }) }}>Start the clock, tap kills as they land, log drops off the table — it measures your kills/hr and loot gp/hr and files everything when you end.</span>
            {!ctxBoss && <select className="led" id="sess_boss" defaultValue={this.state.bossFocus || D.bosses[0].n} style={{ width: 210 }}>{D.bosses.map((o) => <option key={o.n} value={o.n}>{o.n}</option>)}</select>}
            <Btn tone="gold" onClick={() => this.startBossSession(ctxBoss || this.val("sess_boss") || D.bosses[0].n)}>▶ Start session{ctxBoss ? " · " + ctxBoss : ""}</Btn>
          </div>
        </Card>
      );
    }
    const elapsedMs = Math.max(0, Date.now() - s.startAt);
    const emins = Math.floor(elapsedMs / 60000);
    const elapsed = emins >= 60 ? Math.floor(emins / 60) + "h " + (emins % 60) + "m" : emins + "m";
    const hrsF = elapsedMs / 3600000;
    const kph = s.kills > 0 && hrsF > 0.016 ? Math.round((s.kills / hrsF) * 10) / 10 : null;
    const dropGp = this.sessDropGp(s);
    const loot = dropGp + (s.otherLoot || 0);
    const gpHr = loot > 0 && hrsF > 0.016 ? Math.round(loot / hrsF) : null;
    const q = this.state.sessQ || "";
    const qp = this.sessParseQty(q);
    const opts = this.sessDropOptions(s.boss, qp.rest);
    const catColor = { unique: C.gold, tertiary: C.purple, common: C.muted2, market: C.teal };
    return (
      <Card style={ember.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: C.red, boxShadow: "0 0 8px rgba(150,58,44,.8)", animation: "sealpulse 1.6s infinite" }} />
          <Kicker color={TH.accent}>Field session · {s.boss}</Kicker>
          <span style={mono({ fontSize: 11, color: C.muted2 })}>{elapsed} on the clock</span>
          {kph != null && <Tag color={C.teal} bg="rgba(60,107,107,.14)">{kph} kills/hr</Tag>}
          {gpHr != null && <Tag color={C.gold} bg="rgba(201,162,74,.14)">{this.short(gpHr)} gp/hr</Tag>}
          <span style={{ flex: 1 }} />
          <span onClick={() => this.endBossSession(false)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 10 }) }}>discard</span>
          <Btn tone="gold" onClick={() => this.endBossSession(true)}>■ End &amp; save</Btn>
        </div>
        {ctxBoss && ctxBoss !== s.boss && <div style={{ marginTop: 6, ...mono({ fontSize: 10, color: "#9a7530" }) }}>⚠ this session is at {s.boss} — end it before starting one at {ctxBoss}.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, marginTop: 12, alignItems: "start" }}>
          <div style={{ textAlign: "center", padding: "10px 18px", background: C.cardLight, borderRadius: 8, border: "1px solid rgba(44,32,19,.12)" }}>
            <div style={mono({ fontSize: 8.5, letterSpacing: ".16em", color: C.muted, textTransform: "uppercase" })}>Kills</div>
            <div style={cinzel({ fontWeight: 800, fontSize: 34, color: C.ink, lineHeight: 1.1 })}>{s.kills}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
              <Btn tone="gold" onClick={() => this.sessKills(1)}>+1</Btn>
              <Btn onClick={() => this.sessKills(5)}>+5</Btn>
              <Btn tone="quiet" onClick={() => this.sessKills(-1)}>−1</Btn>
            </div>
          </div>
          <div>
            <div style={{ position: "relative" }}>
              <input className="led" value={q} placeholder={"Log a drop… try \"500 death rune\" (searches " + s.boss + "'s table + the GE)"}
                onChange={(ev) => this.setState({ sessQ: ev.target.value, sessOpen: true })}
                onFocus={() => this.setState({ sessOpen: true })}
                onBlur={() => this.setState({ sessOpen: false })}
                onKeyDown={(ev) => { if (ev.key === "Enter" && opts.length) this.sessAddDrop(opts[0].n, opts[0].tbl ? opts[0].v : null, qp.qty); }}
                style={{ width: "100%" }} />
              {this.state.sessOpen && opts.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "#fbf6e8", border: "1px solid rgba(44,32,19,.3)", borderRadius: 6, boxShadow: "0 10px 24px rgba(30,16,6,.25)", maxHeight: 260, overflowY: "auto" }}>
                  {opts.map((o, i) => (
                    <div key={o.n + i} onMouseDown={(ev) => { ev.preventDefault(); this.sessAddDrop(o.n, o.tbl ? o.v : null, qp.qty); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", cursor: "pointer", borderBottom: "1px solid rgba(44,32,19,.07)", background: i === 0 ? "rgba(201,162,74,.10)" : "transparent" }}>
                      <span style={{ flex: 1, ...serif({ fontSize: 12.5, fontStyle: "normal", color: C.ink }) }}>{qp.qty > 1 ? <strong>{this.fmt(qp.qty)}× </strong> : null}{o.n}</span>
                      <span style={mono({ fontSize: 8.5, letterSpacing: ".08em", color: catColor[o.cat] || C.muted, textTransform: "uppercase" })}>{o.tbl ? o.cat : "ge item"}</span>
                      {o.v > 0 && <span style={mono({ fontSize: 10.5, color: C.muted2 })}>{qp.qty > 1 ? `${this.short(o.v)} ea ≈ ${this.short(o.v * qp.qty)}` : this.short(o.v)}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {s.drops.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                {s.drops.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 9px", background: C.cardLight, borderRadius: 5, border: "1px solid rgba(44,32,19,.10)" }}>
                    <Icon url={itemIconUrl(d.n)} name={d.n} size={20} />
                    <span style={{ flex: 1, ...serif({ fontSize: 12.5, fontStyle: "normal", color: C.ink }) }}>{d.n}{!d.tbl && <span style={mono({ fontSize: 8.5, color: C.teal })}> · off-table</span>}</span>
                    <span style={mono({ fontSize: 9, color: C.muted })}>{new Date(d.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {d.src === "live" ? <span title="Unit price quoted from the live GE feed when you logged it" style={mono({ fontSize: 8, fontWeight: 600, letterSpacing: ".08em", color: "#3c5322" })}>● LIVE</span>
                      : d.src === "manual" ? <span title="You set this unit value by hand — it won't be re-priced" style={mono({ fontSize: 8, fontWeight: 600, letterSpacing: ".08em", color: "#9a7530" })}>EDITED</span>
                      : d.src === "table" ? <span title="Drop-table estimate — no live quote available" style={mono({ fontSize: 8, fontWeight: 600, letterSpacing: ".08em", color: C.muted })}>TABLE</span> : null}
                    <span style={mono({ fontSize: 10, color: C.muted })}>×</span>
                    <input className="led" key={"dq" + i + "_" + (d.q || 1)} defaultValue={this.fmt(d.q || 1)} title="Quantity" onBlur={(ev) => this.sessSetDropQ(i, ev.target.value)} style={{ width: 58, padding: "3px 6px", textAlign: "right", fontSize: 11 }} />
                    <input className="led" key={"dv" + i + "_" + d.v} defaultValue={this.fmt(d.v)} title="Unit value (gp each)" onBlur={(ev) => this.sessSetDropV(i, ev.target.value)} style={{ width: 92, padding: "3px 6px", textAlign: "right", fontSize: 11 }} />
                    {(d.q || 1) > 1 && <span style={mono({ fontSize: 10.5, color: C.gold, minWidth: 52, textAlign: "right" })}>= {this.short((d.v || 0) * d.q)}</span>}
                    <span onClick={() => this.sessDelDrop(i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <span style={mono({ fontSize: 10, color: C.muted })}>OTHER LOOT (gp)</span>
              <input className="led" key={"ol" + (s.otherLoot || 0)} defaultValue={s.otherLoot ? this.fmt(s.otherLoot) : ""} placeholder="scales, runes, alchs…" onBlur={(ev) => this.sessLoot(ev.target.value)} style={{ width: 130, padding: "4px 7px", textAlign: "right" }} />
              <span style={{ flex: 1 }} />
              <span style={mono({ fontSize: 11, color: C.muted2 })}>session loot <strong style={{ color: C.gold }}>{loot > 0 ? this.short(loot) : "0"}</strong>{s.drops.length ? ` · ${s.drops.length} drop${s.drops.length > 1 ? "s" : ""}` : ""}</span>
            </div>
          </div>
        </div>
        <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted, marginTop: 10 })}>Ending files one kill-log entry ({"kills + minutes + loot"}) and your drops at the right KC — Session Rates then measures your real kills/hr and gp/hr from it, ready to adopt.</div>
      </Card>
    );
  }
  renderBossTracker() {
    const log = this.logs.boss;
    const opts = D.bosses.map((b) => b.n);
    return (
      <div>
        <div style={{ marginBottom: 14 }}>{this.renderBossSession(null)}</div>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Kicker color={C.goldDeep}>Kill-count log · after the fact</Kicker>
            <Btn tone="gold" onClick={() => this.toggleForm("boss")}>+ Log kills</Btn>
          </div>
          {this.state.openForm === "boss" && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              <select className="led" id="boss_name" style={{ width: 200 }}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              {this.field("boss_kills", "Kills", { w: 100 })}{this.field("boss_mins", "Minutes (opt)", { w: 110 })}{this.field("boss_loot", "Loot gp (opt)", { w: 110 })}{this.field("boss_note", "Note", { w: 150 })}
              <Btn tone="gold" onClick={this.addBoss}>Save</Btn>
              <span style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted })}>Add minutes and Session Rates learns your real kills/hr.</span>
            </div>
          )}
        </Card>
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Date", "Boss", "Kills", "Time", "Pace", "Loot", "Note", ""].map((h, i) => <th key={i} style={{ ...mono({ fontSize: 9, color: C.muted }), textAlign: i >= 2 && i <= 5 ? "right" : "left", padding: "7px 9px", borderBottom: "2px solid rgba(44,32,19,.2)" }}>{h}</th>)}</tr></thead>
            <tbody>{log.map((b, i) => (
              <tr key={i}><td style={{ ...mono({ fontSize: 11 }), padding: "7px 9px" }}>{this.dShort(b.date)}</td><td style={{ ...cinzel({ fontWeight: 600, fontSize: 13 }), padding: "7px 9px" }}>{b.boss}</td><td style={{ ...mono({ fontSize: 12 }), padding: "7px 9px", textAlign: "right" }}>{this.fmt(b.kills)}</td><td style={{ ...mono({ fontSize: 12, color: C.muted2 }), padding: "7px 9px", textAlign: "right" }}>{b.mins > 0 ? b.mins + "m" : "—"}</td><td style={{ ...mono({ fontSize: 12, color: b.mins > 0 ? C.teal : C.muted }), padding: "7px 9px", textAlign: "right" }}>{b.mins > 0 ? Math.round(((b.kills || 0) * 600) / b.mins) / 10 + "/hr" : "—"}</td><td style={{ ...mono({ fontSize: 12, color: b.loot > 0 ? C.gold : C.muted }), padding: "7px 9px", textAlign: "right" }}>{b.loot > 0 ? this.short(b.loot) : "—"}</td><td style={{ ...serif({ fontSize: 13, color: C.muted }), padding: "7px 9px" }}>{b.note || "—"}</td><td style={{ padding: "7px 9px" }}><span onClick={() => this.delLog("boss", i)} style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 11 }) }}>✕</span></td></tr>
            ))}{log.length === 0 && <tr><td colSpan={8} style={serif({ fontStyle: "normal", color: C.muted, padding: 16 })}>No kills logged. Start a field session above, or track KC here after the fact — the Focus tab computes your drop-rate luck, and timed sessions teach Session Rates your real kills/hr.</td></tr>}</tbody>
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
    const catColor = { unique: C.gold, common: C.muted2, tertiary: C.purple };
    const catRank = { unique: 0, tertiary: 1, common: 2 };
    let luck = 0;
    const dropRows = drops.slice().sort((a, b) => (catRank[a.cat] ?? 3) - (catRank[b.cat] ?? 3) || a.rate - b.rate).map((dr) => { const exp = kc / dr.rate; const got = dropCount[dr.n] || 0; luck += got * dr.v; const v = this.luckVerdict(kc, dr.rate, got); return { name: dr.n, cat: dr.cat || "common", rate: dr.rate <= 1 ? "common" : "1/" + this.fmt(dr.rate), exp: exp >= 1 ? exp.toFixed(2) : exp > 0 ? exp.toPrecision(2) : "0", got, verdict: v.t, vc: v.c, value: dr.v > 0 ? this.short(dr.v) : dr.cat === "tertiary" ? "—" : "0" }; });
    // Wiki-aligned recommended style + best gear the player can use for it.
    const styles = this.bossStyles(b);
    const gearStyle = styles.all.includes(this.state.bossGearStyle) ? this.state.bossGearStyle : styles.primary;
    const styleColor = { Melee: C.red, Ranged: C.green, Magic: C.purple };
    const recs = this.bestGearForStyle(gearStyle).map((it) => { const price = this.gearPrices[it.n] != null ? this.gearPrices[it.n] : it.gp; return { slot: it.slot, n: it.n, req: it.req, price: price > 0 ? this.short(price) : "obtain", c: styleColor[gearStyle] }; });
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={cinzel({ fontWeight: 700, fontSize: 22 })}>{b.n}</span>
              {BOSS_GUIDES[b.n] && <Btn tone="gold" onClick={() => this.openBossGuide(b.n)}>📖 Battle guide</Btn>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <span style={mono({ fontSize: 11, color: C.muted })}>{b.tier}</span>
              <Tag color={styleColor[styles.primary]} bg="rgba(44,32,19,.06)">Best: {styles.primary}</Tag>
              {styles.all.length > 1 && <span style={mono({ fontSize: 10, color: C.muted })}>· also {styles.all.slice(1).join(", ")}</span>}
            </div>
            <div style={serif({ fontSize: 13.5, fontStyle: "normal", color: C.muted, marginTop: 3 })}>Wiki: {styles.note}</div>
            <div style={serif({ fontSize: 14, color: C.ink, marginTop: 10 })}>{this.bossWhy[b.n] || (e.estGp > 0 ? this.short(e.estGp) + "/h · " + b.unique : b.unique)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              {[["GP/hr", e.estGp > 0 ? this.short(e.estGp) : "—"], ["Kills/hr", e.kills > 0 ? e.kills : "—"], ["Your KC", this.fmt(kc)], ["Combat req", "Cb " + b.minCb], ["Slayer", b.slay > 0 ? b.slay : "none"], ["Loot logged", this.short(luck)]].map(([l, v], i) => (
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
            <div className="sheetwrap" style={{ marginTop: 10 }}>
              <table className="sheet">
                <thead><tr>{["Drop", "Type", "Rate", "Exp.", "Got", "Value", ""].map((h, i) => <th key={i} className={i > 2 && i < 6 ? "num" : ""}>{h}</th>)}</tr></thead>
                <tbody>{dropRows.map((r, k) => (
                  <tr key={k}>
                    <td style={serif({ fontSize: 13 })}>{r.name}</td>
                    <td><Tag color={catColor[r.cat]} bg="transparent">{r.cat}</Tag></td>
                    <td className="num" style={mono({ fontSize: 11 })}>{r.rate}</td>
                    <td className="num" style={mono({ fontSize: 11 })}>{r.exp}</td>
                    <td className="num" style={mono({ fontSize: 12, color: r.vc })}>{r.got}</td>
                    <td className="num" style={mono({ fontSize: 11 })}>{r.value}</td>
                    <td><Tag color={r.vc} bg="transparent">{r.verdict}</Tag></td>
                  </tr>
                ))}{drops.length === 0 && <tr><td colSpan={7} style={serif({ fontStyle: "normal", color: C.muted, padding: 14 })}>No drop table tracked for this boss.</td></tr>}</tbody>
              </table>
            </div>
          </Card>
        </div>
        {recs.length > 0 && (
          <Card style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Kicker color={C.goldDeep}>Best {gearStyle.toLowerCase()} gear you can use for {b.n}</Kicker>
              <Seg options={styles.all.map((s) => ({ key: s, label: s.toUpperCase() }))} active={gearStyle} onPick={(v) => this.setState({ bossGearStyle: v })} size={9} />
            </div>
            <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 6 })}>Recommended style is <strong style={{ color: styleColor[styles.primary] }}>{styles.primary}</strong> per the OSRS Wiki. Pieces below are the highest tier your stats currently allow.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10, marginTop: 12 }}>
              {recs.map((r, i) => (
                <div key={i} style={{ background: C.cardLight, padding: "9px 11px", borderRadius: 6, borderLeft: "3px solid " + r.c }}>
                  <div style={mono({ fontSize: 8.5, letterSpacing: ".12em", color: C.muted, textTransform: "uppercase" })}>{r.slot}</div>
                  <div style={cinzel({ fontWeight: 600, fontSize: 13, marginTop: 2 })}>{r.n}</div>
                  <div style={mono({ fontSize: 9.5, color: C.muted })}>{r.req}</div>
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
          <div style={serif({ fontSize: 13, fontStyle: "normal", color: C.muted, marginBottom: 10 })}>Click a row's BLOCK toggle to remove it from your assignment pool — weighted XP/hr & loot/hr above recompute instantly (you get 6 block slots at Duradel).</div>
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
            ))}{log.length === 0 && <tr><td colSpan={5} style={serif({ fontStyle: "normal", color: C.muted, padding: 16 })}>No tasks logged yet.</td></tr>}</tbody>
          </table>
        </Card>
      </div>
    );
  }

  // ===================== GEAR =====================
  // Per-slot item list for the active style/mode, each item priced, usability-
  // gated, and marked `current` (your best usable = highest tier you can wield).
  gearSlots() {
    const style = this.state.gearStyle, mode = this.mode;
    const sm = this.skillMap; const lvlOf = (n) => (sm[n] || { l: 1 }).l;
    const gsLvl = { att: lvlOf("Attack"), str: lvlOf("Strength"), def: lvlOf("Defence"), range: lvlOf("Ranged"), mage: lvlOf("Magic"), pray: lvlOf("Prayer"), none: 99 };
    const lo = (this.loadout && this.loadout[style]) || {};
    return (GEAR_DATA[style] || []).map((s) => {
      const items = s.items.filter((it) => { const m = it.mode || "both"; return m === "both" || m === mode; }).map((it) => { const price = this.gearPrices[it.n] != null ? this.gearPrices[it.n] : it.gp; const usable = (it.lvl || 1) <= (gsLvl[it.gs || "none"] || 99); return { ...it, price, usable }; });
      let curName = ""; for (let i = items.length - 1; i >= 0; i--) if (items[i].usable) { curName = items[i].n; break; }
      const names = items.map((it) => it.n);
      const equippedName = lo[s.slot] && names.includes(lo[s.slot]) ? lo[s.slot] : curName;
      const best = items[items.length - 1];
      const bisName = best ? best.n : "";
      return { slot: s.slot, items: items.map((m, i) => ({ ...m, order: i + 1, current: m.n === bisName, equipped: m.n === equippedName })), curName, bisName, equippedName };
    });
  }
  // Trade-offs of `name` vs the best-in-slot item — the nuance tags in the modal.
  gearDeltas(name, bisName) {
    if (!name || name === bisName) return { deltas: [], cmpName: "" };
    const a = this._normEq(name), b = this._normEq(bisName);
    if (!a || !b) return { deltas: [], cmpName: bisName };
    const out = [];
    [["Stab", "astab"], ["Slash", "aslash"], ["Crush", "acrush"], ["Magic", "amagic"], ["Range", "arange"], ["Str", "mstr"], ["Rng str", "rstr"], ["Mage %", "mdmg"], ["Prayer", "pray"]].forEach(([k, key]) => { const d = a[key] - b[key]; if (d !== 0) out.push({ k, v: (d > 0 ? "+" : "") + d, c: d > 0 ? C.green : C.red }); });
    if (a.speed && b.speed && a.speed !== b.speed) out.push({ k: "Speed", v: `${a.speed}t vs ${b.speed}t`, c: a.speed < b.speed ? C.green : C.red });
    return { deltas: out, cmpName: bisName };
  }
  openGearDetail = (slot, item) => { ensureItemStats(item, () => this.bump()); this.setState({ gearDetail: { slot, item } }); };
  closeGearDetail = () => this.setState({ gearDetail: null });
  equipItem = (slot, name) => { const st = this.state.gearStyle; if (!this.loadout[st]) this.loadout[st] = {}; this.loadout[st][slot] = name; this._save("almanac.loadout.v1", this.loadout); ensureItemStats(name, () => this.bump()); this.setState({ gearItem: name, gearSlot: slot, gearStatMode: "item" }); };
  resetLoadout = () => { const st = this.state.gearStyle; this.loadout[st] = {}; this._save("almanac.loadout.v1", this.loadout); this.bump(); };
  // Ownership ledger: which gear-path pieces the player actually HAS (banked or
  // equipped) — independent of what their stats unlock. Feeds the boss guides.
  toggleOwned = (name) => { if (this.gearOwned[name]) delete this.gearOwned[name]; else this.gearOwned[name] = true; this._save("almanac.gearowned.v1", this.gearOwned); this.bump(); };
  // Best piece per slot for a style that the player OWNS (and can wear); when a
  // slot has nothing owned, carries the best usable piece as the buy suggestion.
  bestOwnedGearForStyle(styleName) {
    const key = { Melee: "melee", Ranged: "ranged", Magic: "magic" }[styleName] || "melee";
    const lvlFor = { att: "Attack", str: "Strength", def: "Defence", range: "Ranged", mage: "Magic", pray: "Prayer", hp: "Hitpoints" };
    const sm = this.skillMap;
    return (GEAR_DATA[key] || []).map((s) => {
      const usable = (s.items || []).filter((it) => { const sk = lvlFor[it.gs]; const lv = sk ? (sm[sk] || { l: 1 }).l : 99; return (it.lvl || 1) <= lv; });
      const byTier = usable.slice().sort((a, b) => (b.lvl || 0) - (a.lvl || 0));
      const owned = byTier.find((it) => this.gearOwned[it.n]);
      const best = byTier[0];
      if (!best) return null;
      return { slot: s.slot, owned: owned || null, best };
    }).filter(Boolean);
  }
  _normEq(name) {
    const st = getItemStats(name); if (st === undefined) { ensureItemStats(name, () => this.bump()); return undefined; } if (!st || !st.eq) return null;
    const e = st.eq;
    return { astab: e.attack_stab || 0, aslash: e.attack_slash || 0, acrush: e.attack_crush || 0, amagic: e.attack_magic || 0, arange: e.attack_ranged || 0, dstab: e.defence_stab || 0, dslash: e.defence_slash || 0, dcrush: e.defence_crush || 0, dmagic: e.defence_magic || 0, drange: e.defence_ranged || 0, mstr: e.melee_strength || 0, rstr: e.ranged_strength || 0, mdmg: e.magic_damage || 0, pray: e.prayer || 0, speed: st.wp && st.wp.attack_speed ? st.wp.attack_speed : null };
  }
  // Sum the equipped set's bonuses (triggering loads for anything uncached).
  gearTotals(slots) {
    const keys = ["astab", "aslash", "acrush", "amagic", "arange", "dstab", "dslash", "dcrush", "dmagic", "drange", "mstr", "rstr", "mdmg", "pray"];
    const tot = {}; keys.forEach((k) => (tot[k] = 0));
    let loading = 0, counted = 0, speed = null;
    slots.forEach((s) => { if (!s.equippedName) return; const o = this._normEq(s.equippedName); if (o === undefined) { loading++; return; } if (!o) return; counted++; keys.forEach((k) => (tot[k] += o[k])); if (s.slot === "Weapon" && o.speed) speed = o.speed; });
    tot.speed = speed; return { tot, loading, counted };
  }
  // Categories the active item leads its slot in (drives the "good for X" nuance).
  gearLeads(slotItems, name) {
    const e = this._normEq(name); if (!e) return [];
    const others = slotItems.map((it) => this._normEq(it.n)).filter(Boolean);
    const cats = [["Slash", "aslash"], ["Stab", "astab"], ["Crush", "acrush"], ["Magic atk", "amagic"], ["Ranged atk", "arange"], ["Strength", "mstr"], ["Ranged str", "rstr"], ["Magic dmg", "mdmg"]];
    return cats.filter(([, k]) => e[k] > 0 && e[k] >= Math.max(...others.map((o) => o[k]))).map(([l]) => l);
  }
  renderGear() {
    const style = this.state.gearStyle, mode = this.mode;
    const TH = themeFor("gear");
    const slots = this.gearSlots();
    const byName = {}; slots.forEach((s) => (byName[s.slot] = s));
    const upgrades = slots.reduce((a, s) => a + s.items.filter((it) => !it.usable).length, 0);
    // OSRS-style paperdoll layout. The middle-right cell holds ammo (ranged),
    // special weapon (melee) or nothing (magic); shield slot name varies.
    const shieldSlot = byName["Shield / Offhand"] ? "Shield / Offhand" : "Shield";
    const auxSlot = byName["Ammunition"] ? "Ammunition" : byName["Special weapon"] ? "Special weapon" : null;
    const grid = [
      [null, "Helm", null],
      ["Cape", "Amulet", auxSlot],
      ["Weapon", "Body", shieldSlot],
      [null, "Legs", null],
      ["Hands", "Feet", "Ring"],
    ];
    const sel = byName[this.state.gearSlot] ? this.state.gearSlot : "Weapon";
    const selData = byName[sel] || slots[0];
    const equippedCount = slots.filter((s) => s.equippedName).length;
    const cell = (name, k) => {
      if (!name || !byName[name]) return <div key={k} style={{ aspectRatio: "1", borderRadius: 8, border: "1px dashed rgba(201,162,74,.14)" }} />;
      const s = byName[name]; const eqIt = s.items.find((it) => it.equipped);
      const isSel = name === sel; const isBest = eqIt && eqIt.current;
      return (
        <div key={k} onClick={() => this.setState({ gearSlot: name })} title={eqIt ? eqIt.n : name}
          style={{ aspectRatio: "1", borderRadius: 8, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 4, background: isSel ? "rgba(201,162,74,.18)" : "rgba(20,12,6,.5)", border: `2px solid ${isSel ? TH.lite : isBest ? "rgba(201,162,74,.5)" : eqIt ? "rgba(201,162,74,.25)" : "rgba(201,162,74,.1)"}`, boxShadow: isSel ? `0 0 12px ${TH.accent}66` : "none" }}>
          {eqIt ? <Icon url={itemIconUrl(eqIt.n)} name={eqIt.n} size={34} style={{ background: "rgba(201,162,74,.16)", color: "#e7cf8c" }} /> : <span style={mono({ fontSize: 8, color: "#7a6a4a" })}>empty</span>}
          <span style={mono({ fontSize: 7.5, letterSpacing: ".08em", color: "#bfa676", textTransform: "uppercase" })}>{name.split(" ")[0]}</span>
        </div>
      );
    };
    return (
      <div>
        <SectionTitle kicker={"The Armoury · " + (mode === "iron" ? "Ironman (obtain paths)" : "Main (live GE prices)")} title="Gear Progression" accent={TH.accent}
          right={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><Seg options={[{ key: "melee", label: "MELEE" }, { key: "ranged", label: "RANGED" }, { key: "magic", label: "MAGIC" }]} active={style} onPick={(v) => this.setState({ gearStyle: v, gearSlot: "Weapon" })} /><Btn onClick={this.refreshGearPrices}>↻ Refresh GE prices</Btn></div>} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <Seg options={[{ key: "main", label: "MAIN" }, { key: "iron", label: "IRONMAN" }]} active={this.mode} onPick={this.setMode} size={9} />
          <div style={serif({ fontSize: 12.5, color: C.muted2 })}>{style[0].toUpperCase() + style.slice(1)} · {mode === "iron" ? "Ironman" : "Main"} · {upgrades} upgrades · gold ring = your current best</div>
        </div>
        {this.state.gearPriceStatus && <div style={{ marginBottom: 14, padding: "8px 14px", background: "rgba(201,162,74,.1)", borderRadius: 5, ...mono({ fontSize: 11, color: C.green }) }}>{this.state.gearPriceStatus}</div>}
        <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* paperdoll + nested stat card */}
          <div style={{ flex: "0 0 304px", background: "linear-gradient(160deg,#2a1a10,#1a0f08)", border: "1px solid #5a4326", borderRadius: 8, padding: "18px 20px 16px", boxShadow: "0 4px 16px rgba(40,24,10,.28)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={mono({ fontSize: 9, letterSpacing: ".2em", color: "#9c7c44", textTransform: "uppercase" })}>Equipment · {style}</span>
              <span onClick={this.resetLoadout} style={{ cursor: "pointer", ...mono({ fontSize: 9, color: "#c89a5a" }) }}>reset</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {grid.map((row, ri) => (<div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 14px", justifyItems: "center" }}>{row.map((n, ci) => cell(n, ri + "-" + ci))}</div>))}
            </div>
            <div style={{ marginTop: 13, paddingTop: 11, borderTop: "1px solid rgba(231,207,140,.12)", textAlign: "center", ...serif({ fontSize: 11, color: "#9c7c44", lineHeight: 1.35 }) }}>Click a slot, then pick any tier on the right to equip it here.</div>
            {this.renderGearStats(slots, selData, equippedCount)}
          </div>
          {/* upgrade ladder for selected slot */}
          <div style={{ flex: "1 1 440px", minWidth: 320 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={cinzel({ fontWeight: 700, fontSize: 21, color: C.ink })}>{sel}</span>
              <span style={mono({ fontSize: 9, letterSpacing: ".16em", color: C.muted, textTransform: "uppercase" })}>{selData.items.length} tiers · you own {selData.items.filter((x) => this.gearOwned[x.n]).length}</span>
              <span style={{ marginLeft: "auto", ...serif({ fontSize: 13, color: C.muted2 }) }}>equipped: <strong style={{ color: C.green }}>{selData.equippedName || "—"}</strong></span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(214px,1fr))", gap: 12 }}>
              {selData.items.map((it, i) => (
                <div key={i} onClick={() => this.equipItem(sel, it.n)} style={{ position: "relative", cursor: "pointer", background: it.equipped ? "rgba(201,162,74,.16)" : it.usable ? C.cardLight : "#ece1c6", border: it.equipped ? "2px solid " + C.gold : it.usable ? "1px solid rgba(44,32,19,.18)" : "1px dashed rgba(44,32,19,.28)", borderRadius: 6, padding: "11px 12px 12px", boxShadow: it.equipped ? "0 2px 12px rgba(201,162,74,.3)" : "none", opacity: it.usable ? 1 : 0.72 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <div style={{ width: 40, height: 40, flex: "0 0 40px", display: "flex", alignItems: "center", justifyContent: "center", background: "#efe4c8", border: "1px solid rgba(44,32,19,.16)", borderRadius: 5 }}><Icon url={itemIconUrl(it.n)} name={it.n} size={32} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={cinzel({ fontWeight: 600, fontSize: 13.5, color: it.usable ? C.ink : "#9a8a6a", lineHeight: 1.12 })}>{it.n}</div>
                      <div style={mono({ fontSize: 9, color: C.muted, marginTop: 3 })}>{it.req}</div>
                    </div>
                    <span style={{ width: 18, height: 18, flex: "0 0 18px", borderRadius: "50%", background: "#2a1a10", display: "flex", alignItems: "center", justifyContent: "center", ...mono({ fontSize: 8.5, color: "#e7cf8c" }) }}>{it.order}</span>
                  </div>
                  {(it.current || it.equipped || this.gearOwned[it.n]) && (
                    <div style={{ marginBottom: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {it.current && <span style={{ ...mono({ fontSize: 8, letterSpacing: ".1em", color: "#3a2410" }), background: "linear-gradient(180deg,#e3c878,#c9a24a)", borderRadius: 9, padding: "2px 8px" }}>★ BEST IN SLOT</span>}
                      {it.equipped && <span style={{ ...mono({ fontSize: 8, letterSpacing: ".1em", color: "#e7cf8c" }), background: "#2a1a10", borderRadius: 9, padding: "2px 8px" }}>✓ EQUIPPED</span>}
                      {this.gearOwned[it.n] && <span style={{ ...mono({ fontSize: 8, letterSpacing: ".1em", color: "#3c5322" }), background: "rgba(92,110,53,.2)", border: "1px solid rgba(92,110,53,.4)", borderRadius: 9, padding: "2px 8px" }}>◆ OWNED</span>}
                    </div>
                  )}
                  {mode === "iron" ? (
                    <div>{it.get && <div style={serif({ fontSize: 11.5, color: C.green, lineHeight: 1.25 })}>{it.get}</div>}{it.price > 0 && <div style={mono({ fontSize: 9, color: C.muted, marginTop: 4 })}>GE ≈ {this.short(it.price)} gp</div>}</div>
                  ) : (
                    it.price > 0 ? <div style={cinzel({ fontWeight: 700, fontSize: 15, color: C.green })}>{this.short(it.price)} <span style={mono({ fontSize: 9.5, color: C.muted })}>gp</span></div> : <div style={serif({ fontSize: 11.5, color: C.muted2, lineHeight: 1.25 })}>{it.get}</div>
                  )}
                  {it.bestFor && <div style={{ marginTop: 7, paddingTop: 6, borderTop: "1px solid rgba(44,32,19,.12)", ...serif({ fontSize: 11, color: C.muted2, lineHeight: 1.25 }) }}>{it.bestFor}</div>}
                  <div style={{ display: "flex", marginTop: 9, paddingTop: 8, borderTop: "1px solid rgba(44,32,19,.12)" }}>
                    <span onClick={(e) => { e.stopPropagation(); this.toggleOwned(it.n); }} title="Track that you actually have this piece — boss guides recommend from your owned gear" style={{ flex: 1, textAlign: "center", cursor: "pointer", ...mono({ fontSize: 8.5, letterSpacing: ".08em", color: this.gearOwned[it.n] ? "#3c5322" : C.muted, textTransform: "uppercase" }) }}>{this.gearOwned[it.n] ? "◆ owned" : "◇ mark owned"}</span>
                    <span style={{ width: 1, background: "rgba(44,32,19,.12)" }} />
                    <span onClick={(e) => { e.stopPropagation(); this.openGearDetail(sel, it.n); }} style={{ flex: 1, textAlign: "center", cursor: "pointer", ...mono({ fontSize: 8.5, letterSpacing: ".08em", color: C.muted, textTransform: "uppercase" }) }}>Breakdown ▸</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {this.state.gearDetail && this.renderGearDetail()}
      </div>
    );
  }
  renderGearStats(slots, selData, equippedCount) {
    const TH = themeFor("gear");
    const mode = this.state.gearStatMode === "item" ? "item" : "set";
    const ATK = [["Stab", "astab"], ["Slash", "aslash"], ["Crush", "acrush"], ["Magic", "amagic"], ["Range", "arange"]];
    const DEF = [["Stab", "dstab"], ["Slash", "dslash"], ["Crush", "dcrush"], ["Magic", "dmagic"], ["Range", "drange"]];
    const OTH = [["Str", "mstr"], ["Rng str", "rstr"], ["Mage %", "mdmg"], ["Pray", "pray"]];
    const sv = (v) => (v > 0 ? "+" + v : "" + v);
    const sub = (l) => <div style={mono({ fontSize: 8, letterSpacing: ".16em", color: "#8a6a38", textTransform: "uppercase", marginBottom: 5 })}>{l}</div>;
    const rows = (list, obj) => list.map(([l, k]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "1px 0" }}><span style={serif({ fontSize: 12.5, color: C.muted2 })}>{l}</span><span style={mono({ fontSize: 10.5, fontWeight: 600, color: obj[k] > 0 ? C.green : obj[k] < 0 ? C.red : C.muted })}>{sv(obj[k])}</span></div>));
    const statGrid = (obj, speed) => (
      <div style={{ padding: "12px 14px 14px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          <div>{sub("Attack")}{rows(ATK, obj)}</div>
          <div>{sub("Defence")}{rows(DEF, obj)}</div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid rgba(44,32,19,.14)" }}>{sub("Other")}
          {OTH.map(([l, k]) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "1px 0" }}><span style={serif({ fontSize: 12.5, color: C.muted2 })}>{l}</span><span style={mono({ fontSize: 10.5, fontWeight: 600, color: obj[k] > 0 ? C.green : C.muted })}>{sv(obj[k])}</span></div>))}
          {speed ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "1px 0" }}><span style={serif({ fontSize: 12.5, color: C.muted2 })}>Attack speed</span><span style={mono({ fontSize: 9.5, fontWeight: 600, color: C.ink })}>{(speed * 0.6).toFixed(1)}s · {speed}t</span></div> : null}
        </div>
      </div>
    );
    const tab = (k, label) => { const on = mode === k; return <a key={k} href="#" onClick={(e) => { e.preventDefault(); this.setState({ gearStatMode: k }); }} style={{ textDecoration: "none", padding: "7px 12px", borderRadius: "5px 5px 0 0", ...mono({ fontSize: 9, letterSpacing: ".08em", color: on ? "#2a1a10" : "#bfa676" }), background: on ? "#f2e9d2" : "transparent" }}>{label}</a>; };
    let body;
    if (mode === "set") {
      const { tot, loading, counted } = this.gearTotals(slots);
      body = (<div><div style={{ padding: "8px 13px 5px", background: "#321f12" }}><div style={mono({ fontSize: 8, letterSpacing: ".13em", color: "#9c7c44", textTransform: "uppercase" })}>Combined · {counted}/{equippedCount} items{loading ? ` · loading ${loading}` : ""}</div></div>{statGrid(tot, tot.speed)}</div>);
    } else {
      const active = this.state.gearItem && selData.items.find((x) => x.n === this.state.gearItem) ? this.state.gearItem : selData.equippedName;
      const it = selData.items.find((x) => x.n === active) || {};
      const obj = this._normEq(active);
      body = (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", background: "#321f12" }}>
            <Icon url={itemIconUrl(active)} name={active} size={32} style={{ background: "rgba(201,162,74,.14)", color: "#e7cf8c" }} />
            <div style={{ flex: 1, minWidth: 0 }}><div style={cinzel({ fontWeight: 700, fontSize: 12.5, color: "#e7cf8c", lineHeight: 1.12 })}>{active || "No item"}</div><div style={mono({ fontSize: 8, letterSpacing: ".12em", color: "#9c7c44", textTransform: "uppercase", marginTop: 3 })}>{selData.slot} · {it.equipped ? "equipped" : it.current ? "best in slot" : "your pick"}</div></div>
          </div>
          {obj ? <div>{statGrid(obj, obj.speed)}<div style={{ padding: "0 14px 14px" }}><a href="#" onClick={(e) => { e.preventDefault(); this.openGearDetail(selData.slot, active); }} style={{ display: "block", textAlign: "center", textDecoration: "none", padding: 7, borderRadius: 5, background: "#ddcba6", border: "1px solid rgba(44,32,19,.25)", ...mono({ fontSize: 9, letterSpacing: ".1em", color: C.ink, textTransform: "uppercase" }) }}>Full breakdown ▸</a></div></div>
            : obj === null ? <div style={{ padding: "12px 14px", ...serif({ fontSize: 12, color: C.muted, textAlign: "center" }) }}>Stats unavailable for this item.</div>
              : <div style={{ padding: "12px 14px", ...serif({ fontSize: 12.5, color: C.muted, textAlign: "center" }) }}>Loading stats…</div>}
        </div>
      );
    }
    return (
      <div style={{ marginTop: 14, background: C.card, border: "1px solid rgba(231,207,140,.22)", borderRadius: 7, overflow: "hidden" }}>
        <div style={{ display: "flex", padding: "9px 11px 0", background: "#321f12" }}>{tab("set", "FULL SET")}{tab("item", "THIS ITEM")}</div>
        {body}
      </div>
    );
  }
  renderGearDetail() {
    const TH = themeFor("gear"); const d = this.state.gearDetail;
    const slots = this.gearSlots(); const sd = slots.find((s) => s.slot === d.slot) || slots[0];
    const it = sd.items.find((x) => x.n === d.item) || {};
    const name = d.item; const obj = this._normEq(name);
    const leads = obj ? this.gearLeads(sd.items, name) : [];
    const { deltas, cmpName } = obj ? this.gearDeltas(name, sd.bisName) : { deltas: [], cmpName: "" };
    const sv = (v) => (v > 0 ? "+" + v : "" + v);
    const sub = (l) => <div style={mono({ fontSize: 8, letterSpacing: ".16em", color: "#8a6a38", textTransform: "uppercase", marginBottom: 6 })}>{l}</div>;
    const row = (l, v) => (<div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span style={serif({ fontSize: 13, color: C.muted2 })}>{l}</span><span style={mono({ fontSize: 11, fontWeight: 600, color: v > 0 ? C.green : v < 0 ? C.red : C.muted })}>{sv(v)}</span></div>);
    return (
      <div onClick={this.closeGearDetail} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(20,12,6,.62)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "94%", maxHeight: "88vh", overflowY: "auto", background: "#f4ecd6", border: "1px solid #b98f3e", borderRadius: 10, boxShadow: "0 18px 50px rgba(20,12,6,.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "16px 18px", background: "linear-gradient(160deg,#2a1a10,#1a0f08)" }}>
            <div style={{ width: 48, height: 48, flex: "0 0 48px", display: "flex", alignItems: "center", justifyContent: "center", background: "#1c1209", border: "1px solid #5a4326", borderRadius: 7 }}><Icon url={itemIconUrl(name)} name={name} size={36} style={{ color: "#e7cf8c" }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={cinzel({ fontWeight: 700, fontSize: 19, color: "#e7cf8c", lineHeight: 1.1 })}>{name}</div><div style={mono({ fontSize: 9, letterSpacing: ".14em", color: "#9c7c44", textTransform: "uppercase", marginTop: 4 })}>{sd.slot} · {it.req || "—"}</div></div>
            <span onClick={this.closeGearDetail} style={{ cursor: "pointer", ...mono({ fontSize: 15, color: "#9c7c44" }) }}>✕</span>
          </div>
          <div style={{ padding: "18px 20px 20px" }}>
            {obj ? (
              <div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                  {it.current && <span style={{ ...mono({ fontSize: 8.5, letterSpacing: ".1em", color: "#3a2410" }), background: "linear-gradient(180deg,#e3c878,#c9a24a)", borderRadius: 9, padding: "3px 10px" }}>★ BEST IN SLOT</span>}
                  {it.equipped && <span style={{ ...mono({ fontSize: 8.5, letterSpacing: ".1em", color: "#e7cf8c" }), background: "#2a1a10", borderRadius: 9, padding: "3px 10px" }}>✓ EQUIPPED</span>}
                  {it.price > 0 && <span style={{ ...mono({ fontSize: 8.5, letterSpacing: ".1em", color: C.green }), background: "rgba(92,110,53,.12)", borderRadius: 9, padding: "3px 10px" }}>{this.short(it.price)} GP</span>}
                </div>
                {leads.length > 0 && <div style={{ marginBottom: 14 }}>{sub("Leads this slot in")}<div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{leads.map((l) => <span key={l} style={{ ...mono({ fontSize: 9.5, color: C.ink }), background: "rgba(201,162,74,.22)", border: "1px solid rgba(185,143,62,.4)", borderRadius: 5, padding: "3px 9px" }}>{l}</span>)}</div></div>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 22px", marginBottom: 14 }}>
                  <div>{sub("Attack bonuses")}{[["Stab", "astab"], ["Slash", "aslash"], ["Crush", "acrush"], ["Magic", "amagic"], ["Range", "arange"]].map(([l, k]) => <div key={k}>{row(l, obj[k])}</div>)}</div>
                  <div>{sub("Defence bonuses")}{[["Stab", "dstab"], ["Slash", "dslash"], ["Crush", "dcrush"], ["Magic", "dmagic"], ["Range", "drange"]].map(([l, k]) => <div key={k}>{row(l, obj[k])}</div>)}</div>
                </div>
                <div style={{ marginBottom: 14, paddingTop: 10, borderTop: "1px solid rgba(44,32,19,.14)" }}>{sub("Other")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 22px" }}>{[["Melee str", "mstr"], ["Ranged str", "rstr"], ["Magic dmg", "mdmg"], ["Prayer", "pray"]].map(([l, k]) => <div key={k}>{row(l, obj[k])}</div>)}{obj.speed ? <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}><span style={serif({ fontSize: 13, color: C.muted2 })}>Speed</span><span style={mono({ fontSize: 10, fontWeight: 600, color: C.ink })}>{(obj.speed * 0.6).toFixed(1)}s · {obj.speed}t</span></div> : null}</div></div>
                {deltas.length > 0 && <div style={{ marginBottom: 14, paddingTop: 10, borderTop: "1px solid rgba(44,32,19,.14)" }}>{sub("Trade-offs vs best in slot · " + cmpName)}<div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{deltas.map((dd, i) => <span key={i} style={{ ...mono({ fontSize: 9.5, color: dd.c }), background: "rgba(44,32,19,.05)", border: "1px solid rgba(44,32,19,.14)", borderRadius: 5, padding: "3px 9px" }}>{dd.k} {dd.v}</span>)}</div></div>}
                {it.bestFor && <div style={serif({ fontSize: 13, color: C.muted2, lineHeight: 1.4, marginBottom: 8 })}>{it.bestFor}</div>}
                {it.get && <div style={serif({ fontSize: 13, color: C.muted2, lineHeight: 1.4, marginBottom: 14 })}><strong style={{ color: C.green }}>Obtain:</strong> {it.get}</div>}
                <div style={{ display: "flex", gap: 8 }}>
                  {!it.equipped ? <a href="#" onClick={(e) => { e.preventDefault(); this.equipItem(sd.slot, name); this.closeGearDetail(); }} style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: 9, borderRadius: 6, background: "linear-gradient(180deg,#caa24e,#9a7530)", border: "1px solid " + C.gold, ...mono({ fontSize: 10, letterSpacing: ".1em", color: C.ink, textTransform: "uppercase" }) }}>Equip to armour stand</a> : <div style={{ flex: 1, textAlign: "center", padding: 9, ...mono({ fontSize: 9, letterSpacing: ".1em", color: C.green, textTransform: "uppercase" }) }}>✓ Equipped on your stand</div>}
                  <a href="#" onClick={(e) => { e.preventDefault(); this.toggleOwned(name); }} style={{ flex: 1, textAlign: "center", textDecoration: "none", padding: 9, borderRadius: 6, background: this.gearOwned[name] ? "rgba(92,110,53,.16)" : "transparent", border: "1px solid rgba(92,110,53,.45)", ...mono({ fontSize: 10, letterSpacing: ".1em", color: "#3c5322", textTransform: "uppercase" }) }}>{this.gearOwned[name] ? "◆ Owned — untrack" : "◇ Mark owned"}</a>
                </div>
              </div>
            ) : obj === null ? <div style={serif({ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" })}>Equipment stats unavailable for this item{it.get ? ` — obtain: ${it.get}` : ""}.</div>
              : <div style={serif({ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" })}>Loading equipment stats…</div>}
          </div>
        </div>
      </div>
    );
  }

  // ===================== FARMING =====================
  renderFarming() {
    const sm = this.skillMap; const farmLvl = (sm.Farming || { l: 1 }).l, farmXp = (sm.Farming || { x: 0 }).x;
    const goal = (this.goals.find((g) => g.skill === "Farming") || { tgt: 85 }).tgt;
    const laps = this.farmcfg.lapsPerDay || 1;
    const Y = this.herbYield();
    const selCrop = this.selHerbCrop();
    const adv = this.farmAdvisor();
    // Per run-type realistic daily cap = 24h ÷ grow time (fractional); effective
    // = min(your target, cap). The herb row runs YOUR SELECTED crop. Hespori and
    // Tithe (optIn) live in the ADVISOR only — the circuit is the daily loop.
    const runDefs = this.farmRunDefs.filter((r) => !r.optIn).map((r) => {
      const unlocked = r.req <= farmLvl;
      const maxRunsDay = r.growHrs > 0 ? +(24 / r.growHrs).toFixed(2) : 24;
      const rd = this.farmcfg.runsPerDay || {};
      const want = rd[r.rdKey] != null ? rd[r.rdKey] : rd[r.crop];
      const effRuns = Math.min(want != null ? want : r.optIn ? 0 : laps, maxRunsDay);
      const isHerb = /herb/i.test(r.type || "");
      return { ...r, unlocked, maxRunsDay, effRuns, rdOverride: want != null, crop: isHerb ? selCrop.tier : r.crop, gpRun: isHerb ? this.farmNet(selCrop) : r.gpRun, xpRun: isHerb ? this.herbXpRun(selCrop) : r.rdKey === "Tithe" ? this.titheXpRun() : r.xpRun, patches: isHerb ? Y.P : r.patches, isHerb };
    });
    const unlockedRuns = runDefs.filter((r) => r.unlocked);
    const lockedRuns = runDefs.filter((r) => !r.unlocked);
    const runMax = Math.max(1, ...unlockedRuns.map((r) => r.xpRun));
    const xpCircuit = unlockedRuns.reduce((a, r) => a + r.xpRun, 0);
    const xpDay = unlockedRuns.reduce((a, r) => a + r.xpRun * r.effRuns, 0);
    const gpDay = unlockedRuns.reduce((a, r) => a + r.gpRun * r.effRuns, 0);
    const herbGpDay = unlockedRuns.filter((r) => /herb/i.test(r.type || "")).reduce((a, r) => a + r.gpRun * r.effRuns, 0);
    const treeGpDay = gpDay - herbGpDay;
    const xpLeft = Math.max(0, this.xpFor(goal) - farmXp);
    const days = xpDay > 0 ? Math.ceil(xpLeft / xpDay) : 0;
    const agg = {}; this.logs.herb.forEach((h) => { if (!agg[h.tier]) agg[h.tier] = { runs: 0, net: 0 }; agg[h.tier].runs += h.runs || 1; agg[h.tier].net += h.net; });
    const TH = themeFor("farming");
    const loggedNet = this.logs.herb.reduce((a, h) => a + h.net, 0), loggedRuns = this.logs.herb.reduce((a, h) => a + (h.runs || 1), 0);
    // Selection-mismatch note: the advisor may prefer a different herb crop than
    // the one you're set to run.
    const topHerb = adv.rows.find((c) => c.herbTier);
    const selNote = topHerb && !topHerb.selected ? ` You're set to ${selCrop.tier} — ${topHerb.name.replace("Herb run · ", "")} ${adv.mode === "gp" ? "nets " + this.short(this.farmNet(this.farmDefs.find((f) => f.tier === topHerb.herbTier)) - this.farmNet(selCrop)) + " more/run" : "gives more xp/run"}; switch in the advisor below.` : "";
    return (
      <div>
        <SectionTitle kicker="The Allotments · grow-time, not play-time" title="Farming Engine" accent={TH.accent}
          right={<div style={{ display: "flex", gap: 8 }}><Btn onClick={this.refreshPrices}>⟳ Live prices</Btn><Btn tone="gold" onClick={() => this.setState({ farmView: "log", openForm: "herb" })}>+ Log herb run</Btn></div>} />
        {this.state.priceStatus && <div style={{ marginBottom: 14, padding: "8px 14px", background: "rgba(92,110,53,.10)", borderRadius: 5, ...mono({ fontSize: 11, color: "#5c6e35" }) }}>{this.state.priceStatus} — seed costs, herb values and run nets re-priced from the live GE.</div>}
        {adv.top && <Hero theme={TH} icon="🌱" kicker={`Farming ${farmLvl} · ${adv.mode === "gp" ? "gp-priority" : "xp-priority"} verdict`} title={adv.top.name}
          blurb={`${adv.top.why}.${selNote} ${days > 0 ? days + " days to " + goal + " at " + this.short(xpDay) + " xp/day." : ""}`}
          statLabel="Logged net" statValue={loggedRuns ? this.signed(loggedNet) : "—"} statSub={loggedRuns ? loggedRuns + " runs" : "no runs yet"} />}
        <StatCards cols={5} items={[
          { label: "Farming level", value: "" + farmLvl, sub: "→ goal " + goal, color: TH.accent },
          { label: "Net GP / day (runs)", value: this.signed(gpDay), sub: "herbs " + this.signed(herbGpDay) + " · other runs " + this.signed(treeGpDay), color: gpDay >= 0 ? C.green : C.red, subColor: gpDay >= 0 ? C.green : C.red },
          { label: "XP / day (capped)", value: this.short(xpDay), sub: unlockedRuns.reduce((a, r) => a + r.effRuns, 0) + " runs across the circuit" },
          { label: "XP to Farming " + goal, value: this.short(xpLeft) },
          { label: "Days to target", value: days > 0 ? "" + days : "—", color: C.green },
        ]} />
        <div style={{ margin: "2px 0 16px" }}>
          <Seg options={[{ key: "planner", label: "PLANNER" }, { key: "setup", label: "SETUP" }, { key: "log", label: "RUN LOG" }]} active={this.state.farmView || "planner"} onPick={(v) => this.setState({ farmView: v })} />
        </div>
        {(this.state.farmView || "planner") === "planner" && (
          <div>
          {/* run advisor — every run type scored by your active minutes */}
          <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              <Kicker color={TH.accent}>Run advisor · every run priced per ACTIVE minute (grow time is free, your attention isn't)</Kicker>
              <Seg options={[{ key: "gp", label: "GP PRIORITY" }, { key: "xp", label: "XP PRIORITY" }]} active={adv.mode} onPick={(v) => this.setFarmOpt("runPriority", v)} size={9} />
            </div>
            <div className="sheetwrap">
              <table className="sheet">
                <thead><tr>{["#", "Run", "XP/run", "GP/run", "Active", adv.mode === "gp" ? "GP/min" : "XP/min", "GP/XP", "Cap/day", "Verdict", ""].map((h, i) => <th key={i} className={i >= 2 && i <= 7 ? "num" : ""}>{h}</th>)}</tr></thead>
                <tbody>
                  {adv.rows.map((c, i) => (
                    <tr key={c.key} style={c.selected ? { background: "rgba(92,110,53,.10)" } : undefined}>
                      <td style={mono({ fontSize: 12, color: C.muted2 })}>{i + 1}</td>
                      <td><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{c.name}</div><div style={serif({ fontSize: 10.5, fontStyle: "normal", color: C.muted })}>{c.why}{c.note ? " · " + c.note : ""}</div></td>
                      <td className="num" style={mono({ fontSize: 12 })}>{this.short(c.xpRun)}</td>
                      <td className="num" style={mono({ fontSize: 12, color: c.gpRun >= 0 ? C.green : C.red })}>{this.signed(c.gpRun)}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted2 })}>{c.time}m</td>
                      <td className="num" style={mono({ fontSize: 12, fontWeight: 600 })}>{adv.mode === "gp" ? this.signed(c.gpm) : this.fmt(c.xpm)}</td>
                      <td className="num" style={mono({ fontSize: 12, color: c.costPerXp ? c.costPerXp <= 15 ? C.green : c.costPerXp <= 30 ? "#9a7530" : C.red : C.muted })}>{c.costPerXp ? c.costPerXp : "—"}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{c.capDay >= 24 ? "∞" : c.capDay}</td>
                      <td><Tag color={c.vc} bg={c.vc === C.green ? "rgba(92,110,53,.16)" : c.vc === C.red ? "rgba(150,58,44,.12)" : "rgba(201,162,74,.16)"}>{c.verdict}</Tag></td>
                      <td>{c.herbTier ? (c.selected ? <span style={mono({ fontSize: 10, color: C.green })}>✓ running</span> : <a href="#" onClick={(e) => { e.preventDefault(); this.setFarmOpt("herbCrop", c.herbTier); }} style={{ textDecoration: "none", ...mono({ fontSize: 10, color: "#9a7530" }) }}>→ run this</a>) : null}</td>
                    </tr>
                  ))}
                  {adv.locked.map((c) => (
                    <tr key={c.key} style={{ opacity: 0.55 }}>
                      <td style={mono({ fontSize: 12, color: C.muted })}>·</td>
                      <td><div style={cinzel({ fontWeight: 600, fontSize: 13, color: C.muted2 })}>{c.name}</div></td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{this.short(c.xpRun)}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{this.signed(c.gpRun)}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{c.time}m</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>—</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{c.costPerXp || "—"}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{c.capDay >= 24 ? "∞" : c.capDay}</td>
                      <td><Tag color={C.red} bg="rgba(150,58,44,.10)">Farming {c.req}</Tag></td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 8 })}>GP/run includes seeds, compost and protection payments at live prices. <strong>GP priority</strong> ranks by gp per active minute — money-losing runs are flagged as XP purchases. <strong>XP priority</strong> ranks by xp per active minute and prices each run's cost in gp/xp (≤15 efficient · ≤30 fair · above that premium). Cap/day is what grow times physically allow; “→ run this” switches the herb crop your circuit and KPIs are computed from.</div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
            <Card>
              <Kicker color={C.goldDeep}>Daily run circuit · unlocked at Farming {farmLvl}</Kicker>
              <div className="sheetwrap" style={{ marginTop: 10 }}>
                <table className="sheet">
                  <thead><tr>{["Run", "Crop", "Patches", "Protection", "XP/run", "GP/run", "Runs/day", "Grow"].map((h, i) => <th key={i} className={i > 3 ? "num" : ""}>{h}</th>)}</tr></thead>
                  <tbody>{unlockedRuns.map((r, k) => (
                    <tr key={k}>
                      <td><div style={cinzel({ fontWeight: 600, fontSize: 13 })}>{r.name}</div><div title={r.teles} style={{ maxWidth: 190, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...serif({ fontSize: 10.5, fontStyle: "normal", color: C.muted }) }}>{r.teles}</div></td>
                      <td>{r.isHerb ? (
                        <select className="led" value={selCrop.tier} onChange={(e) => this.setFarmOpt("herbCrop", e.target.value)} title="The herb crop your circuit + KPIs are computed from" style={{ padding: "3px 5px", fontSize: 12 }}>
                          {this.farmDefs.map((f) => <option key={f.tier} value={f.tier} disabled={farmLvl < f.lvl}>{f.tier}{farmLvl < f.lvl ? " (lv " + f.lvl + ")" : ""}</option>)}
                        </select>
                      ) : <span style={serif({ fontSize: 13 })}>{r.crop}</span>}</td>
                      <td className="num" style={mono({ fontSize: 12 })}>{r.patches || "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.payItem
                        ? <span title={`${r.payQty}× ${r.payItem} per patch — farmer protection, guarantees the tree can't die; priced into GP/run live`} style={mono({ fontSize: 10, color: C.muted2 })}>{r.payQty}× {r.payItem}</span>
                        : r.isHerb
                          ? <span title={`${(this.herbCompost[this.farmcfg.compost] || {}).label} + ${Y.df} disease-free patches (herbs can't be farmer-protected)`} style={mono({ fontSize: 10, color: C.muted })}>{({ none: "no compost", compost: "Compost", super: "Supercmp", ultra: "Ultracmp" })[this.farmcfg.compost] || "—"} · {Y.df} DF</span>
                          : <span style={mono({ fontSize: 10, color: C.muted })}>—</span>}</td>
                      <td className="num"><div style={mono({ fontSize: 12 })}>{this.fmt(r.xpRun)}</div><Bar pct={Math.min(100, (r.xpRun / runMax) * 100)} c1={TH.accent} c2={TH.lite} h={4} /></td>
                      <td className="num" style={mono({ fontSize: 12, color: r.gpRun >= 0 ? C.green : C.red })}>{r.gpRun >= 0 ? "+" + this.short(r.gpRun) : this.signed(r.gpRun)}</td>
                      <td className="num">
                        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
                          <input className="led" key={r.rdKey + ":" + r.effRuns + ":" + (r.rdOverride ? 1 : 0)} defaultValue={r.effRuns} onBlur={(e) => this.setRunsPerDay(r.rdKey, e.target.value)} title="Runs/day for this run type · empty = global default · 0 = skip" style={{ width: 44, padding: "3px 5px", textAlign: "right", fontWeight: r.rdOverride ? 700 : 400, borderColor: r.rdOverride ? TH.accent : undefined }} />
                          <span style={mono({ fontSize: 12, color: C.muted })}>/{r.maxRunsDay >= 24 ? "∞" : r.maxRunsDay}</span>
                        </span>
                      </td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted })}>{r.growHrs < 1.5 ? Math.round(r.growHrs * 60) + "m" : r.growHrs + "h"}</td>
                    </tr>
                  ))}
                  {unlockedRuns.length === 0 && <tr><td colSpan={8} style={serif({ fontStyle: "normal", color: C.muted, padding: 14 })}>No runs unlocked yet at Farming {farmLvl}.</td></tr>}</tbody>
                </table>
              </div>
              {lockedRuns.length > 0 && <div style={{ marginTop: 10, ...serif({ fontSize: 12, color: C.muted }) }}>Upcoming: {lockedRuns.map((r) => `${r.crop} ${r.name.toLowerCase()} (lvl ${r.req})`).join(" · ")}</div>}
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                <span style={mono({ fontSize: 11, color: C.muted2 })}>DEFAULT RUNS / DAY</span>
                <input className="led" defaultValue={laps} onBlur={(e) => this.setCfg("farmcfg", "lapsPerDay", e.target.value)} style={{ width: 70 }} />
                <span style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted })}>Each run type is capped to what its grow time allows — fruit trees (16h) max one a day, herbs (~80m) many more. Edit the Runs/day cell on any row to set a per-type target (0 = skip that run; clear the cell to go back to this default).</span>
              </div>
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
            <Kicker color={C.goldDeep}>Herb tiers · net/run by plant level · ⟳ re-prices from the live GE</Kicker>
            <div className="sheetwrap" style={{ marginTop: 8 }}>
              <table className="sheet">
                <thead><tr>{["Tier", "Plant lvl", "Seed cost", "Herb (ea)", "Net/run", "Runs logged", "Total net", "Status"].map((h, i) => <th key={i} className={i > 1 && i < 7 ? "num" : ""}>{h}</th>)}</tr></thead>
                <tbody>{this.farmDefs.map((f, k) => { const a = agg[f.tier] || { runs: 0, net: 0 }; const fU = farmLvl >= f.lvl; const net = this.farmNet(f); return (
                  <tr key={k}>
                    <td style={cinzel({ fontWeight: 600, fontSize: 13 })}>{f.tier}</td><td className="num" style={mono({ fontSize: 12 })}>Lv {f.lvl}</td>
                    <td className="num" style={mono({ fontSize: 12, color: C.red })}>{this.short(f.seed)}</td>
                    <td className="num" style={mono({ fontSize: 12 })}>{this.short(f.herb)}</td>
                    <td className="num" style={mono({ fontSize: 12, color: net >= 0 ? C.green : C.red })}>{this.short(net)}</td><td className="num" style={mono({ fontSize: 12 })}>{a.runs}</td><td className="num" style={mono({ fontSize: 12 })}>{a.net > 0 ? this.short(a.net) : "—"}</td>
                    <td><Tag color={fU ? C.green : C.red} bg={fU ? "rgba(92,110,53,.16)" : "rgba(150,58,44,.12)"}>{fU ? "unlocked" : "locked"}</Tag></td>
                  </tr>
                ); })}</tbody>
              </table>
            </div>
            <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Net/run = {Y.P} patches × ({Y.eff.toFixed(2)} herbs/patch from the run-mechanics model above × herb value after the 2% GE tax − seed − compost). Seed & herb prices re-price with ⟳ Live prices; the yield reacts instantly to the controls.</div>
          </Card>
          </div>
        )}
        {this.state.farmView === "setup" && (
          <div>
          <Card style={{ marginBottom: 14, borderTop: `3px solid ${TH.accent}` }}>
            <Kicker color={TH.accent}>Run mechanics · these feed every net/run</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginTop: 10 }}>
              <div style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                <Kicker>Patches / run</Kicker>
                <div style={cinzel({ fontWeight: 800, fontSize: 24, color: C.ink, marginTop: 4 })}>{Y.P}</div>
                <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 4, lineHeight: 1.3 })}>from your patch roster below — toggle patches on/off there</div>
              </div>
              <div style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                <Kicker>Disease-free patches</Kicker>
                <div style={cinzel({ fontWeight: 800, fontSize: 24, color: "#5c6e35", marginTop: 4 })}>{Y.df}</div>
                <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 4, lineHeight: 1.3 })}>Trollheim, Weiss & Hosidius never roll disease</div>
              </div>
              <div style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                <Kicker>Compost</Kicker>
                <select className="led" value={this.farmcfg.compost} onChange={(e) => this.setFarmOpt("compost", e.target.value)} style={{ width: "100%", marginTop: 6 }}>
                  {Object.entries(this.herbCompost).map(([k, co]) => <option key={k} value={k}>{co.label}</option>)}
                </select>
                <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 6, lineHeight: 1.3 })}>+{(this.herbCompost[this.farmcfg.compost] || {}).lives - 3 || 0} harvest lives · {this.short(Y.compostCost)} gp/patch (live)</div>
              </div>
              <div style={{ background: C.cardLight, padding: "11px 13px", borderRadius: 6, border: "1px solid rgba(44,32,19,.12)" }}>
                <Kicker>Herbs / patch override</Kicker>
                <input className="led" defaultValue={this.farmcfg.herbsOverride || 0} onBlur={(e) => this.setCfg("farmcfg", "herbsOverride", e.target.value)} style={{ width: "100%", marginTop: 6, fontWeight: 600 }} />
                <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 6, lineHeight: 1.3 })}>0 = use the model · set your own realized average to replace it</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
              {[["secateurs", "Magic secateurs · +10% yield"], ["farmCape", "Farming cape · +5%"], ["attas", "Attas plant · +5%"]].map(([k, label]) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", ...mono({ fontSize: 11, color: C.muted2 }) }}>
                  <input type="checkbox" checked={!!this.farmcfg[k]} onChange={(e) => this.setFarmOpt(k, e.target.checked)} style={{ accentColor: TH.accent, width: 15, height: 15 }} />{label}
                </label>
              ))}
              <span style={{ marginLeft: "auto", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {(() => {
                  const withDetail = this.logs.herb.filter((h) => h.herbs != null && h.patchN > 0);
                  const totH = withDetail.reduce((a, h) => a + h.herbs, 0), totP = withDetail.reduce((a, h) => a + h.patchN, 0);
                  const chips = [["save chance", (Y.p * 100).toFixed(1) + "%"], ["harvest lives", "" + Y.lives], ["herbs/patch", Y.eff.toFixed(2) + (Y.ov ? " (override)" : "")], ["patch survival", (Y.surv * 100).toFixed(1) + "%"]];
                  if (totP > 0) chips.push(["your logged avg", (totH / totP).toFixed(2) + "/patch · " + totP + "p"]);
                  return chips.map(([l, v]) => (
                    <span key={l} style={{ background: "rgba(92,110,53,.12)", border: "1px solid rgba(92,110,53,.3)", borderRadius: 5, padding: "4px 10px", ...mono({ fontSize: 10.5, color: "#3c5322" }) }}>{l} <strong>{v}</strong></span>
                  ));
                })()}
              </span>
            </div>
            <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 10, lineHeight: 1.45 })}>
              The model (OSRS crop-yield mechanics): chance to save a harvest life at Farming {Y.L} = (1 + ⌊(25·(99−L) + 80·(L−1))/98 × bonuses⌋)/256 = <strong>{(Y.p * 100).toFixed(1)}%</strong> — all herbs share the 25/80 constants. Each patch has {Y.lives} harvest lives ({(this.herbCompost[this.farmcfg.compost] || {}).label?.toLowerCase()}), each life yields 1/(1−p) herbs → <strong>{Y.perLive.toFixed(2)} herbs from a live patch</strong>. Herbs roll disease at 3 growth checks → {(Y.surv * 100).toFixed(1)}% survive ({Y.df} of your {Y.P} patches are disease-free). Net/run = {Y.P} × ({Y.eff.toFixed(2)} herbs × herb price after 2% tax − seed − compost).
            </div>
          </Card>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <Kicker color={C.goldDeep}>Patch roster · your run route, in order · access auto-read from quests, level & diaries</Kicker>
              <span style={mono({ fontSize: 10.5, color: C.muted2 })}>{Y.P} on the route · {Y.df} disease-free</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) this.setState({ pOver: -1 }); }}>
              {this.activePatches().map((p, i, arr) => (
                <div key={p.id} draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", p.id); } catch (err) {} this._pDrag = p.id; this.setState({ pDrag: p.id }); }}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; const r = e.currentTarget.getBoundingClientRect(); const over = e.clientY - r.top < r.height / 2 ? i : i + 1; if (over !== this.state.pOver) this.setState({ pOver: over }); }}
                  onDrop={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); this.dropPatch(e.clientY - r.top < r.height / 2 ? i : i + 1); }}
                  onDragEnd={() => { this._pDrag = null; this.setState({ pDrag: null, pOver: -1 }); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 6, background: p.active ? "rgba(92,110,53,.10)" : C.cardLight, border: p.active ? "1px solid rgba(92,110,53,.3)" : "1px dashed rgba(44,32,19,.18)", opacity: this.state.pDrag === p.id ? 0.35 : p.active ? 1 : 0.7, boxShadow: this.state.pOver === i ? `0 -2px 0 0 ${TH.accent}` : this.state.pOver === i + 1 && i === arr.length - 1 ? `0 2px 0 0 ${TH.accent}` : "none", cursor: "grab" }}>
                  <span title="Drag to reorder" style={{ cursor: "grab", userSelect: "none", ...mono({ fontSize: 13, color: C.muted2, letterSpacing: "-1px" }) }}>⠿</span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span onClick={() => this.movePatch(p.id, -1)} style={{ cursor: i > 0 ? "pointer" : "default", opacity: i > 0 ? 1 : 0.25, lineHeight: 1, ...mono({ fontSize: 10, color: C.muted2 }) }}>▲</span>
                    <span onClick={() => this.movePatch(p.id, 1)} style={{ cursor: i < arr.length - 1 ? "pointer" : "default", opacity: i < arr.length - 1 ? 1 : 0.25, lineHeight: 1, ...mono({ fontSize: 10, color: C.muted2 }) }}>▼</span>
                  </span>
                  <span style={{ width: 20, textAlign: "center", ...mono({ fontSize: 11, color: p.active ? "#5c6e35" : C.muted }) }}>{p.active ? i + 1 : "·"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={cinzel({ fontWeight: 600, fontSize: 13.5, color: C.ink })}>{p.name}</span>
                    {p.df && <span style={{ marginLeft: 8, ...mono({ fontSize: 8.5, letterSpacing: ".08em", color: "#3c5322", background: "rgba(92,110,53,.16)", borderRadius: 4, padding: "2px 6px" }) }}>DISEASE-FREE</span>}
                    <div style={serif({ fontSize: 11, fontStyle: "normal", color: C.muted, marginTop: 1 })}>{p.tele}</div>
                  </div>
                  <span style={mono({ fontSize: 10, color: p.auto ? C.green : C.red })}>{p.auto ? "✓ unlocked" : "✗ " + p.why}</span>
                  {p.overridden && <span onClick={() => this.autoPatch(p.id)} title="Back to auto (quest/level detection)" style={{ cursor: "pointer", ...mono({ fontSize: 9.5, color: "#9a7530" }) }}>manual · reset</span>}
                  <input type="checkbox" checked={p.active} onChange={(e) => this.togglePatch(p.id, e.target.checked)} style={{ accentColor: TH.accent, width: 16, height: 16, cursor: "pointer" }} />
                </div>
              ))}
            </div>
            <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Access is read from your quest log (Priest in Peril → Morytania, My Arm's Big Adventure → Trollheim, Making Friends with My Arm → Weiss, Children of the Sun → Varlamore, The Great Brain Robbery + Morytania Elite → Harmony) and Farming 65 for the Guild. The checkbox overrides the auto-detection either way. Drag a row (⠿) to any spot — the rest shift down — or nudge with ▲▼; the order is your route, and the run logger follows it.</div>
          </Card>
          </div>
        )}
        {this.state.farmView === "log" && (
          <div>
          {this.state.openForm === "herb" && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select className="led" id="herb_tier" defaultValue={selCrop.tier} style={{ width: 150 }}>{this.farmDefs.map((f) => <option key={f.tier} value={f.tier}>{f.tier}</option>)}</select>
                {this.field("herb_runs", "Runs", { w: 80, def: 1 })}{this.field("herb_net", "Net override (gp)", { w: 150 })}<Btn tone="gold" onClick={this.addHerb}>Save</Btn>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(44,32,19,.12)" }}>
                <Kicker>Herbs picked per patch · your route order · optional — leave empty to log the model estimate</Kicker>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {Y.patches.map((p, i) => (
                    <div key={p.id} style={{ width: 108 }}>
                      <div style={mono({ fontSize: 9, letterSpacing: ".06em", color: C.muted2, marginBottom: 3 })}>{i + 1} · {p.name}{p.df ? " ✦" : ""}</div>
                      <input className="led" id={"herb_p_" + p.id} placeholder={"~" + Y.perLive.toFixed(1)} style={{ width: "100%" }} />
                    </div>
                  ))}
                </div>
                <div style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted, marginTop: 8 })}>0 (or empty) = the patch died / was skipped. Filled counts price the run from your ACTUAL harvest — herbs × live price after the 2% tax, minus seed + compost on all {Y.P} patches — and feed your realized herbs/patch average in the mechanics panel.</div>
              </div>
            </Card>
          )}
          {(() => {
            // Model vs reality: your logged herbs/patch (with the run's stamped
            // Farming level) scattered over the yield model's prediction curve.
            const pts = this.logs.herb.filter((h) => h.herbs != null && h.patchN > 0 && h.lvl).map((h) => ({ lvl: h.lvl, v: h.herbs / h.patchN, tier: h.tier, date: h.date }));
            if (!pts.length) return (
              <Card style={{ marginTop: 14 }}>
                <Kicker color={C.goldDeep}>Model vs reality</Kicker>
                <div style={serif({ fontSize: 12.5, fontStyle: "normal", color: C.muted, marginTop: 6 })}>Log runs with per-patch harvest counts and this chart will plot your real herbs/patch against the yield model's prediction at each Farming level.</div>
              </Card>
            );
            const Lmin = Math.max(3, Math.min(...pts.map((p2) => p2.lvl)) - 4), Lmax = 99;
            const model = []; for (let L = Lmin; L <= Lmax; L++) model.push({ L, v: this.herbEffAt(L) });
            const yMax = Math.ceil(Math.max(...model.map((m) => m.v), ...pts.map((p2) => p2.v)) + 0.5);
            const W = 720, H = 210, padL = 40, padR = 14, padT = 12, padB = 28;
            const X = (L) => padL + ((L - Lmin) / (Lmax - Lmin)) * (W - padL - padR);
            const Yc = (v) => padT + (1 - v / yMax) * (H - padT - padB);
            const path = model.map((m, i) => (i ? "L" : "M") + X(m.L).toFixed(1) + " " + Yc(m.v).toFixed(1)).join(" ");
            const avgReal = pts.reduce((a2, p2) => a2 + p2.v, 0) / pts.length;
            const avgModel = pts.reduce((a2, p2) => a2 + this.herbEffAt(p2.lvl), 0) / pts.length;
            const deltaPct = avgModel > 0 ? ((avgReal - avgModel) / avgModel) * 100 : 0;
            const gridY = []; for (let v = 2; v < yMax; v += 2) gridY.push(v);
            const gridX = []; for (let L = Math.ceil(Lmin / 10) * 10; L <= Lmax; L += 10) gridX.push(L);
            return (
              <Card style={{ marginTop: 14, borderTop: `3px solid ${TH.accent}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <Kicker color={TH.accent}>Model vs reality · herbs per patch by Farming level</Kicker>
                  <span style={mono({ fontSize: 10.5, color: Math.abs(deltaPct) <= 8 ? "#3c5322" : "#9a7530" })}>your runs average {deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}% vs the model</span>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 10 }}>
                  {gridY.map((v) => (<g key={"gy" + v}><line x1={padL} x2={W - padR} y1={Yc(v)} y2={Yc(v)} stroke="rgba(44,32,19,.10)" strokeWidth="1" /><text x={padL - 6} y={Yc(v)} dy="3" textAnchor="end" fill="#8a6a38" fontFamily="'JetBrains Mono',monospace" fontSize="9">{v}</text></g>))}
                  {gridX.map((L) => (<g key={"gx" + L}><line y1={padT} y2={H - padB} x1={X(L)} x2={X(L)} stroke="rgba(44,32,19,.06)" strokeWidth="1" /><text x={X(L)} y={H - padB + 13} textAnchor="middle" fill="#8a6a38" fontFamily="'JetBrains Mono',monospace" fontSize="9">{L}</text></g>))}
                  <path d={path} fill="none" stroke={TH.accent} strokeWidth="2.5" opacity="0.9" />
                  {pts.map((p2, i) => (
                    <circle key={i} cx={X(Math.min(Lmax, Math.max(Lmin, p2.lvl)))} cy={Yc(Math.min(yMax, p2.v))} r="4.5" fill={C.gold} stroke="#7c5a22" strokeWidth="1" opacity="0.85"><title>{`${p2.tier} · lvl ${p2.lvl} · ${p2.v.toFixed(2)} herbs/patch (${this.dShort(p2.date)}) — model said ${this.herbEffAt(p2.lvl).toFixed(2)}`}</title></circle>
                  ))}
                  <text x={W - padR} y={padT + 8} textAnchor="end" fill="#8a6a38" fontFamily="'JetBrains Mono',monospace" fontSize="9">herbs / patch</text>
                </svg>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, ...mono({ fontSize: 10, color: C.muted2 }) }}><span style={{ width: 16, height: 3, background: TH.accent, borderRadius: 2 }} />model at your current setup (compost · gear · roster)</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, ...mono({ fontSize: 10, color: C.muted2 }) }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: C.gold, border: "1px solid #7c5a22" }} />your logged runs ({pts.length})</span>
                  <span style={{ marginLeft: "auto", ...serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted }) }}>{Math.abs(deltaPct) > 8 ? "Running " + Math.abs(deltaPct).toFixed(0) + "% " + (deltaPct < 0 ? "under" : "over") + " model — consider setting the herbs/patch override in Setup to your real average." : "Reality tracks the model — the net/run numbers are trustworthy."}</span>
                </div>
              </Card>
            );
          })()}
          <Card style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <Kicker color={C.goldDeep}>Run history · newest first · delete a bad entry and re-log it (undo has your back)</Kicker>
              <span style={mono({ fontSize: 10.5, color: C.muted2 })}>{loggedRuns} runs · {this.short(loggedNet)} total · {loggedRuns ? this.short(loggedNet / loggedRuns) + "/run avg" : "—"}</span>
            </div>
            <div className="sheetwrap" style={{ marginTop: 8 }}>
              <table className="sheet">
                <thead><tr>{["Date", "Tier", "Farm lvl", "Runs", "Herbs", "Patch breakdown", "Net / run", "Net", ""].map((h, i) => <th key={i} className={i >= 2 && i <= 4 || i === 6 || i === 7 ? "num" : ""}>{h}</th>)}</tr></thead>
                <tbody>{this.logs.herb.map((h, i) => {
                  const runs = h.runs || 1;
                  const detail = h.perPatch ? Object.entries(h.perPatch).map(([id, n]) => { const pt = this.herbPatches.find((x) => x.id === id); return { name: pt ? pt.name : id, n: n || 0 }; }) : null;
                  return (
                    <tr key={(h.date || "") + "-" + i}>
                      <td style={mono({ fontSize: 12 })}>{this.dShort(h.date)}</td>
                      <td style={cinzel({ fontWeight: 600, fontSize: 13 })}>{h.tier}</td>
                      <td className="num" title="Farming level at the time of the run (from that day's hiscores)" style={mono({ fontSize: 12, color: h.lvl ? C.muted2 : C.muted })}>{h.lvl || "—"}</td>
                      <td className="num" style={mono({ fontSize: 12 })}>{runs}</td>
                      <td className="num" style={mono({ fontSize: 12, color: h.herbs != null ? C.ink : C.muted })}>{h.herbs != null ? h.herbs + (h.patchN ? " / " + h.patchN + "p" : "") : "—"}</td>
                      <td>{detail ? (
                        <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                          {detail.map((d, j) => <span key={j} title={d.name} style={{ padding: "1px 6px", borderRadius: 4, background: d.n > 0 ? "rgba(92,110,53,.14)" : "rgba(150,58,44,.12)", ...mono({ fontSize: 10, color: d.n > 0 ? "#3c5322" : C.red }) }}>{d.name.slice(0, 3)} {d.n}</span>)}
                        </span>
                      ) : <span style={serif({ fontSize: 11.5, fontStyle: "normal", color: C.muted })}>model estimate</span>}</td>
                      <td className="num" style={mono({ fontSize: 12, color: C.muted2 })}>{this.short(h.net / runs)}</td>
                      <td className="num" style={mono({ fontSize: 12, fontWeight: 600, color: h.net >= 0 ? C.green : C.red })}>{this.signed(h.net)}</td>
                      <td><span onClick={() => this.delLog("herb", i)} title="Delete entry" style={{ cursor: "pointer", color: C.red, ...mono({ fontSize: 12 }) }}>✕</span></td>
                    </tr>
                  );
                })}
                {this.logs.herb.length === 0 && <tr><td colSpan={9} style={serif({ fontStyle: "normal", color: C.muted, padding: 14 })}>No runs logged yet — hit “+ Log herb run”.</td></tr>}</tbody>
              </table>
            </div>
          </Card>
          </div>
        )}
      </div>
    );
  }

  // ===================== JOURNAL (The Chronicle) =====================
  // Wax seal palette — each entry is pressed closed with one.
  jrnSeals = {
    crimson: { c1: "#a03a2a", c2: "#6d2018", sig: "⚔" },
    forest: { c1: "#5c7a35", c2: "#3a4f1e", sig: "🌿" },
    gold: { c1: "#b98f3e", c2: "#7c5a22", sig: "✦" },
    navy: { c1: "#3c5578", c2: "#243650", sig: "🌊" },
    plum: { c1: "#6a4a6e", c2: "#452e48", sig: "🌙" },
  };
  jrnDate(iso) { try { return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } }
  saveJournal = () => {
    const title = this.val("jrn_title").trim() || "Untitled page";
    const body = this.val("jrn_body");
    if (!body.trim()) return;
    const d = this.derive();
    const editing = this.state.jEdit && this.state.jEdit !== "new" ? this.journal.find((e) => e.id === this.state.jEdit) : null;
    if (editing) {
      editing.title = title; editing.body = body; editing.seal = this.state.jSeal; editing.edited = this.today();
    } else {
      // The marginalia: quietly scribe who the character WAS on this day.
      this.journal.unshift({
        id: Date.now(), date: this.today(), title, body, seal: this.state.jSeal,
        stamp: { combat: this.account.combat, total: d.totalLevel, nw: d.netWorth, qp: this.questPoints },
      });
    }
    this._save("almanac.journal.v1", this.journal);
    this.setState({ jEdit: null, jSel: editing ? editing.id : this.journal[0].id });
  };
  deleteJournal = (id) => {
    if (typeof window !== "undefined" && !window.confirm("Tear this page from the chronicle? (Undo can restore it.)")) return;
    this.journal = this.journal.filter((e) => e.id !== id);
    this._save("almanac.journal.v1", this.journal);
    this.setState({ jSel: this.journal.length ? this.journal[0].id : null, jEdit: null });
  };
  renderJournal() {
    const TH = themeFor("journal");
    const entries = this.journal;
    const sel = entries.find((e) => e.id === this.state.jSel) || entries[0] || null;
    const editing = this.state.jEdit; // "new" | id | null
    const editEntry = editing && editing !== "new" ? entries.find((e) => e.id === editing) : null;
    const sealOf = (k) => this.jrnSeals[k] || this.jrnSeals.crimson;
    const Wax = ({ k, size = 40, active, onClick, title, className }) => {
      const s = sealOf(k);
      return <span className={"jrn-seal " + (className || "")} onClick={onClick} title={title} style={{ width: size, height: size, fontSize: size * 0.42, background: `radial-gradient(circle at 34% 30%, ${s.c1}, ${s.c2} 72%)`, outline: active ? "2px solid rgba(227,200,120,.7)" : "none", outlineOffset: 2 }}>{s.sig}</span>;
    };
    return (
      <div>
        <SectionTitle kicker="The Chronicle · in your own hand" title="Adventurer's Journal" accent={TH.accent}
          right={<Btn tone="gold" onClick={() => this.setState({ jEdit: "new", jSeal: "crimson" })}>🖋 Write a new page</Btn>} />
        <div className="jrn-desk">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 0.85fr) minmax(340px, 1.35fr)", gap: 0, alignItems: "stretch" }}>
            {/* left page — Table of Days */}
            <div className="jrn-page jrn-left" style={{ padding: "26px 30px 24px 26px", minHeight: 560 }}>
              <div className="jrn-crease-l" />
              <div className="jrn-hand" style={{ fontSize: 27, fontWeight: 600, color: "#4a2f16", transform: "rotate(-1.2deg)" }}>Table of Days</div>
              <div style={{ height: 2, background: "linear-gradient(90deg, rgba(110,70,30,.4), transparent)", margin: "4px 0 14px", width: "70%" }} />
              {entries.length === 0 && <div style={serif({ fontSize: 14, color: "#7a5a36", lineHeight: 1.6 })}>No pages yet. Every great account deserves a chronicle — the day you finally got the drop, the death that taught you something, the plan for the month ahead.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 470, overflowY: "auto", paddingRight: 6 }}>
                {entries.map((e, i) => {
                  const active = sel && sel.id === e.id && !editing;
                  return (
                    <div key={e.id} className="jrn-entry" onClick={() => this.setState({ jSel: e.id, jEdit: null })}
                      style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "7px 9px", borderRadius: 4, cursor: "pointer", transform: `rotate(${i % 2 ? 0.25 : -0.25}deg)`, background: active ? "rgba(122,74,42,.13)" : "transparent", boxShadow: active ? "inset 0 0 0 1px rgba(122,74,42,.25)" : "none" }}>
                      {active && <span className="jrn-ribbon" style={{ right: 6 }} />}
                      <Wax k={e.seal} size={22} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={serif({ fontSize: 14.5, fontWeight: 600, color: "#3a2818", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>{e.title}</div>
                        <div className="jrn-hand" style={{ fontSize: 15, color: "#8a6038", lineHeight: 1 }}>{this.jrnDate(e.date)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {entries.length > 0 && <div className="jrn-hand" style={{ position: "absolute", bottom: 14, left: 26, fontSize: 16, color: "#9a7248" }}>{entries.length} page{entries.length > 1 ? "s" : ""} in this chronicle</div>}
            </div>
            {/* right page — the open page */}
            <div className="jrn-page jrn-right jrn-dogear" style={{ padding: "26px 34px 30px 34px", minHeight: 560 }}>
              <div className="jrn-crease-r" />
              {editing ? (
                <div style={{ position: "relative" }}>
                  <div className="jrn-hand" style={{ fontSize: 21, color: "#8a6038", marginBottom: 10, transform: "rotate(-0.6deg)" }}>{editEntry ? "amending the page of " + this.jrnDate(editEntry.date) : this.jrnDate(this.today()) + " — a fresh page"}</div>
                  <input className="jrn-title" id="jrn_title" placeholder="Name this day…" defaultValue={editEntry ? editEntry.title : ""} />
                  <div className="jrn-lines" style={{ marginTop: 14 }}>
                    <textarea className="jrn-ink" id="jrn_body" rows={13} placeholder="Dear ledger — today I…" defaultValue={editEntry ? editEntry.body : ""} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
                    <span className="jrn-hand" style={{ fontSize: 17, color: "#8a6038" }}>choose your seal —</span>
                    {Object.keys(this.jrnSeals).map((k) => <Wax key={k} k={k} size={34} active={this.state.jSeal === k} onClick={() => this.setState({ jSeal: k })} title={k} />)}
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); this.setState({ jEdit: null }); }} style={{ ...serif({ fontSize: 13, color: "#8a6038" }) }}>set down the quill</a>
                      <span className="jrn-seal jrn-seal-btn" onClick={this.saveJournal} title="Press your seal to save this page" style={{ width: 58, height: 58, fontSize: 22, background: `radial-gradient(circle at 34% 30%, ${sealOf(this.state.jSeal).c1}, ${sealOf(this.state.jSeal).c2} 72%)`, color: "#f4e0c8" }}>{sealOf(this.state.jSeal).sig}</span>
                    </span>
                  </div>
                  <div style={serif({ fontSize: 11.5, color: "#9a7248", marginTop: 10, fontStyle: "italic" })}>Pressing the seal saves the page{editEntry ? "" : " and scribes today's marginalia — your combat, total level and coin — beside it forever"}.</div>
                </div>
              ) : sel ? (
                <div style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: 500 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div className="jrn-hand" style={{ fontSize: 22, color: "#8a6038", lineHeight: 1, transform: "rotate(-0.6deg)" }}>{this.jrnDate(sel.date)}{sel.edited ? " · amended " + this.dShort(sel.edited) : ""}</div>
                      <div style={cinzel({ fontWeight: 700, fontSize: 24, color: "#33220f", marginTop: 6 })}>{sel.title}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, flex: "0 0 auto", marginTop: 4 }}>
                      <a href="#" title="Amend this page" onClick={(e) => { e.preventDefault(); this.setState({ jEdit: sel.id, jSeal: sel.seal || "crimson" }); }} style={{ textDecoration: "none", fontSize: 15 }}>✎</a>
                      <a href="#" title="Tear out this page" onClick={(e) => { e.preventDefault(); this.deleteJournal(sel.id); }} style={{ textDecoration: "none", fontSize: 14, opacity: 0.65 }}>🔥</a>
                    </div>
                  </div>
                  {sel.stamp && (
                    <div style={{ margin: "8px 0 2px", ...mono({ fontSize: 9.5, letterSpacing: ".08em", color: "#a07848" }) }}>
                      that day · combat {sel.stamp.combat} · {this.fmt(sel.stamp.total)} total · {this.short(sel.stamp.nw)} coin · {sel.stamp.qp} qp
                    </div>
                  )}
                  <div style={{ height: 1, background: "linear-gradient(90deg, rgba(110,70,30,.35), transparent)", margin: "10px 0 4px" }} />
                  <div className="jrn-lines" style={{ flex: 1, padding: "4px 0 12px", ...serif({ fontSize: 16.5, color: "#3a2818" }) }}>
                    <div style={{ lineHeight: "28px", whiteSpace: "pre-wrap" }}>{sel.body}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span className="jrn-hand" style={{ fontSize: 18, color: "#8a6038" }}>— {(this.stats && this.stats.rsn) || "the adventurer"}</span>
                    <Wax k={sel.seal} size={46} title="Sealed" />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, gap: 12 }}>
                  <span style={{ fontSize: 44, opacity: 0.5, filter: "sepia(1)" }}>🖋</span>
                  <div className="jrn-hand" style={{ fontSize: 26, color: "#8a6038" }}>The first page awaits.</div>
                  <Btn tone="gold" onClick={() => this.setState({ jEdit: "new" })}>Begin the chronicle</Btn>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, textAlign: "center", ...serif({ fontSize: 12, fontStyle: "normal", color: C.muted }) }}>Pages live in your browser with the rest of the ledger, count toward global undo, and each carries the marginalia of who you were that day.</div>
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
    const QTH = themeFor("quests");
    const qd = allQ.filter((q) => q.st === "Done").length, qr = allQ.filter((q) => q.st === "Stat-ready").length, qb = allQ.filter((q) => q.st === "Blocked").length;
    const qSeg = [{ value: qd, color: C.green, label: "Done" }, { value: qr, color: "#9a7530", label: "Ready" }, { value: qb, color: C.red, label: "Blocked" }];
    return (
      <div>
        <SectionTitle kicker="The Adventure Log" title="Quest Sequencer" accent={QTH.accent}
          right={<Seg options={[{ key: "optimal", label: "OPTIMAL" }, { key: "ironman", label: "IRONMAN" }, { key: "release", label: "RELEASE" }, { key: "series", label: "SERIES" }]} active={method} onPick={(v) => this.setState({ questMethod: v })} size={9} />} />
        <Card style={{ marginBottom: 14, borderTop: `3px solid ${QTH.accent}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <Donut size={130} thickness={20} centerLabel={`${d.qDone} / ${d.qTotal}`} centerValue={d.qPct + "%"} centerColor={QTH.accent} segments={qSeg} />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={cinzel({ fontWeight: 700, fontSize: 18, color: C.ink, marginBottom: 8 })}>Quest Cape Progress</div>
              <BandBar segments={qSeg} height={24} />
              <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
                {qSeg.map((s, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: s.color }} /><span style={mono({ fontSize: 11, color: C.muted2 })}>{s.label} · {s.value}</span></div>))}
              </div>
            </div>
          </div>
        </Card>
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
      { key: "status", cell: (r) => <span onClick={() => this.cycleDiary(r.region, r.tier)} title={r.status === "Done" ? "Click to un-mark" : "Click to mark this diary done"} style={{ cursor: "pointer" }}><Tag color={this.stColor(r.status)} bg={this.stBg(r.status)}>{r.status}</Tag></span> },
      { key: "gate", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted })}>{r.gate}</span> },
      { key: "reward", wrap: true, cell: (r) => <span style={serif({ fontSize: 12.5, color: C.muted2 })}>{r.reward}</span> },
    ];
    const count = (s) => base.filter((d) => d.status === s).length;
    const caColors = [C.green, C.teal, "#9a7530", C.purple, C.red, C.ink];
    const DTH = themeFor("diary");
    // Per-region renown: each region as a card with its four tier bars.
    const tierOrder = ["Easy", "Medium", "Hard", "Elite"];
    const sColor = (s) => (s === "Done" ? C.green : s === "Stat-ready" ? "#9a7530" : C.red);
    const regions = {}; base.forEach((d) => { (regions[d.region] = regions[d.region] || {})[d.tier] = d; });
    const regionRenown = Object.keys(regions).sort().map((region) => {
      const byTier = regions[region]; const list = Object.values(byTier);
      return { region, doneN: list.filter((t) => t.status === "Done").length, totN: list.length, ordered: tierOrder.map((tn) => byTier[tn] || null) };
    });
    const statRow = [["Completed", count("Done"), C.green], ["Stat-ready", count("Stat-ready"), "#9a7530"], ["Blocked", count("Blocked"), C.red]];
    return (
      <div>
        <SectionTitle kicker="Regional Renown" title="Diary & Combat Achievements" accent={DTH.accent} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
          {statRow.map(([l, v, c], i) => (<Card key={i} pad={16} style={{ borderTop: `3px solid ${c}` }}><Kicker>{l}</Kicker><div style={cinzel({ fontWeight: 800, fontSize: 30, color: c, marginTop: 6 })}>{v}</div></Card>))}
        </div>
        <Card style={{ marginBottom: 16, borderTop: `3px solid ${DTH.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Kicker color={DTH.accent}>Regional renown · all diaries by area</Kicker>
            <div style={{ display: "flex", gap: 14 }}>{[["Done", C.green], ["Ready", "#9a7530"], ["Blocked", C.red]].map(([l, c], i) => (<span key={i} style={{ display: "flex", alignItems: "center", gap: 5, ...mono({ fontSize: 10, color: C.muted2 }) }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}</span>))}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, marginTop: 14 }}>
            {regionRenown.map((r) => (
              <div key={r.region} style={{ background: C.cardLight, border: "1px solid rgba(44,32,19,.15)", borderRadius: 6, padding: "13px 15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <span style={cinzel({ fontWeight: 600, fontSize: 14.5, color: C.ink })}>{r.region}</span>
                  <span style={mono({ fontSize: 10, fontWeight: 600, color: DTH.accent })}>{r.doneN}/{r.totN}</span>
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {r.ordered.map((t, i) => (<div key={i} onClick={t ? () => this.cycleDiary(r.region, tierOrder[i]) : undefined} title={t ? `${tierOrder[i]} · ${t.status} — click to ${t.status === "Done" ? "un-mark" : "mark done"}` : `${tierOrder[i]} · n/a`} style={{ flex: 1, height: 11, borderRadius: 3, cursor: t ? "pointer" : "default", background: t ? sColor(t.status) : "rgba(44,32,19,.10)" }} />))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, ...mono({ fontSize: 8, letterSpacing: ".04em", color: C.muted }) }}>{tierOrder.map((tn) => <span key={tn}>{tn[0]}</span>)}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ marginBottom: 14 }}>
          <DataTable tableKey="diary" model={model} cols={cols} open={this.state.tOpen} on={this.tableHandlers()} empty="No diaries match." />
          <div style={serif({ fontSize: 12, fontStyle: "normal", color: C.muted, marginTop: 8 })}>Click a diary's <strong>status</strong> (or a tier bar in the region cards above) to mark it done — completion feeds the Oracle, the Pathfinder and patch unlocks, and is covered by undo.</div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <Kicker color={C.goldDeep}>Combat Achievement tiers · click to mark claimed</Kicker>
            <span style={mono({ fontSize: 10.5, color: C.muted2 })}>{(D.ca || []).filter((c) => this.caOv[c.tier]).length}/{(D.ca || []).length} claimed</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10, marginTop: 10 }}>
            {(D.ca || []).map((c, i) => {
              const done = !!this.caOv[c.tier];
              return (
                <div key={i} onClick={() => this.cycleCa(c.tier)} title={done ? "Click to un-mark" : "Click to mark this tier's rewards claimed"} style={{ cursor: "pointer", background: done ? "rgba(92,110,53,.10)" : C.cardLight, padding: "10px 12px", borderRadius: 6, borderLeft: "3px solid " + (done ? C.green : caColors[i % caColors.length]), outline: done ? "1px solid rgba(92,110,53,.3)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={cinzel({ fontWeight: 700, fontSize: 14 })}>{c.tier}</span>
                    {done && <span style={mono({ fontSize: 9, letterSpacing: ".08em", color: "#3c5322" })}>✓ CLAIMED</span>}
                  </div>
                  <div style={serif({ fontSize: 12, color: C.muted, margin: "3px 0" })}>{c.gating}</div>
                  <div style={serif({ fontSize: 12, color: C.muted2 })}>{c.reward}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }
}
