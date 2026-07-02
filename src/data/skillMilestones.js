// =============================================================================
// SKILL MILESTONES  —  SKILL_MILESTONES — ES module port of the prototype file
// =============================================================================
// Per-skill LADDERS of meaningful rungs. Fixes the "Train X from 1 to 93 in one
// leap" problem: the engine walks the ladder and surfaces the NEXT useful rung
// (and the one after), each with (a) what it unlocks, (b) WHY, and (c) the
// method to climb that band — the "what to do in between" answer.
//
// EFFORT IN TIME, NOT LEVELS:
//   time = (xpFor(rung.level) - xpFor(currentLevel)) / bandMethodXpHr
//   bandMethodXpHr comes from the ACTIVITIES row referenced by rung.band.method.
//
// SCOPE: the 23 skills already modelled in the almanac + a Combat pseudo-ladder.
// (Sailing deferred — see activities-data.js tail.)
//
// -----------------------------------------------------------------------------
// SCHEMA
//   <skillKey>: { skill, kind:'skill'|'combat', role:'gating'|'money'|'utility'|'combat',
//                 note, masters?[], rungs[] }
//   Rung: { level, isBreakpoint, why, band:{method:[activityId],note}, unlocks[] }
//   Unlock: { type:'boss'|'monster'|'gear'|'method'|'area'|'qol'|'master'|'quest',
//             name, id?, value 1..5, note? }
//   skillKeys match window.LEDGER_DATA naming (lowercase).
// =============================================================================

export const SKILL_MILESTONES = {

  // =========================== SLAYER (the star) ===========================
  slayer: {
    skill:"Slayer", kind:"skill", role:"gating",
    note:"Unlocks assignable monsters and several of the game's best money/xp bosses; the most central skill in the unlock graph.",
    masters:[
      {name:"Turael / Aya", req:"1 Slayer", note:"reset/skip low tasks"},
      {name:"Mazchna", req:"20 combat", note:"Canifis"},
      {name:"Vannaka", req:"40 combat", note:"Edgeville dungeon"},
      {name:"Chaeldar", req:"70 combat + Lost City", note:"solid mid tasks"},
      {name:"Konar quo Maten", req:"75 combat", note:"Brimstone keys — lifts effective gp on ANY task"},
      {name:"Nieve / Steve", req:"85 combat + Monkey Madness I", note:"Gnome Stronghold"},
      {name:"Duradel / Kuradal", req:"50 Slayer + 100 combat + Shilo Village", note:"highest xp/gp weights"},
      {name:"Mortimer (Wyrmscraig)", req:"high Slayer + Fallen From Grace", note:"2026 master — superior-variant-only (incl. hydras)"}
    ],
    rungs:[
      {level:1, isBreakpoint:false, why:"Build a streak and points on Turael/Mazchna tasks; swap masters up as combat rises.",
        band:{method:["slayer-tasks"], note:"assigned low tasks, cannon the big ones"},
        unlocks:[{type:"master", name:"Turael → Mazchna → Vannaka", value:2}]},
      {level:58, isBreakpoint:true, why:"Cave horrors drop the BLACK MASK — the Slayer-helmet base and biggest on-task damage upgrade. First rung to actually rush.",
        band:{method:["slayer-tasks","gargoyles"], note:"push tasks under Chaeldar/Konar"},
        unlocks:[{type:"monster",name:"Cave horrors",value:3,note:"needs Cabin Fever"},{type:"gear",name:"Black mask → Slayer helmet",value:5,note:"+16.7% melee on task"}]},
      {level:72, isBreakpoint:true, why:"Skeletal Wyverns — a self-sustaining, low-intensity first 'real' Slayer earner.",
        band:{method:["gargoyles"], note:"gargoyles become your AFK-adjacent xp engine"},
        unlocks:[{type:"monster",name:"Skeletal Wyverns",value:3}]},
      {level:75, isBreakpoint:true, why:"Gargoyles (steady gp + ~60k Slayer xp/hr) AND the Grotesque Guardians boss (granite gear).",
        band:{method:["gargoyles"], note:"gargoyles = default filler + main xp"},
        unlocks:[{type:"monster",name:"Gargoyles",id:"gargoyles",value:4,note:"rock hammer"},{type:"boss",name:"Grotesque Guardians",value:4}]},
      {level:80, isBreakpoint:false, why:"Greater Nechryael — top-tier Slayer xp with cannon/burst + ensouled-head income.",
        band:{method:["cannon-slayer","barrage-bursting"], note:"burst Nechryael for fastest xp"},
        unlocks:[{type:"monster",name:"Greater Nechryael",value:3}]},
      {level:85, isBreakpoint:true, why:"Abyssal demons (whip + dagger) AND Abyssal Sire — a major, permanent step up in money and gear.",
        band:{method:["barrage-bursting"], note:"burst abyssal demons / nechryael"},
        unlocks:[{type:"monster",name:"Abyssal demons",value:5,note:"Abyssal whip"},{type:"boss",name:"Abyssal Sire",value:4}]},
      {level:87, isBreakpoint:true, why:"Cave krakens → Kraken boss: trident of the seas + tentacle (whip upgrade). Very AFK-friendly.",
        band:{method:["gargoyles"], note:"Kraken is click-light; alternate tasks"},
        unlocks:[{type:"boss",name:"Kraken",value:4,note:"trident, tentacle"}]},
      {level:91, isBreakpoint:true, why:"Cerberus — best-in-slot boot crystals (primordial/pegasian/eternal). Hellhound tasks.",
        band:{method:["gargoyles"], note:"hellhound/Cerberus tasks"},
        unlocks:[{type:"boss",name:"Cerberus",value:5,note:"BiS boots"}]},
      {level:93, isBreakpoint:true, why:"Thermonuclear smoke devil — Occult necklace (BiS magic dmg amulet) + smoke battlestaff.",
        band:{method:["barrage-bursting"], note:"smoke devil tasks"},
        unlocks:[{type:"boss",name:"Thermonuclear smoke devil",value:4,note:"occult necklace"}]},
      {level:95, isBreakpoint:true, why:"Alchemical Hydra — 2.5M/hr + 120k Slayer xp/hr, ferocious gloves, DHL, brimstone ring. The Slayer endgame.",
        band:{method:["alchemical-hydra"], note:"Hydra itself is a premier task"},
        unlocks:[{type:"boss",name:"Alchemical Hydra",id:"alchemical-hydra",value:5,note:"ferocious gloves, DHL"}]}
    ]
  },

  // =========================== COMBAT (pseudo) ============================
  combat: {
    skill:"Combat", kind:"combat", role:"combat",
    note:"Combat level gates entry to most bosses; grouped into comfortable access tiers.",
    rungs:[
      {level:55, isBreakpoint:true, why:"First solo bosses: Giant Mole and Scurrius are forgiving intros.",
        band:{method:["nmz-combat","slayer-tasks"], note:"NMZ / Slayer to climb"},
        unlocks:[{type:"boss",name:"Giant Mole",value:2},{type:"boss",name:"Scurrius",value:2}]},
      {level:65, isBreakpoint:true, why:"Barrows becomes efficient — reliable early money with no hard gear floor.",
        band:{method:["nmz-combat"], note:"NMZ / Slayer"},
        unlocks:[{type:"boss",name:"Barrows",value:3}]},
      {level:75, isBreakpoint:true, why:"King Black Dragon and Sarachnis open — comfortable step-up drops.",
        band:{method:["slayer-tasks"], note:"Slayer is the efficient combat-xp path"},
        unlocks:[{type:"boss",name:"King Black Dragon",value:2},{type:"boss",name:"Sarachnis",value:3}]},
      {level:90, isBreakpoint:true, why:"The money-boss tier: Vorkath, Zulrah, Kalphite Queen — reliable 3M+/hr.",
        band:{method:["vorkath","zulrah"], note:"money bosses now drive gp + combat xp"},
        unlocks:[{type:"boss",name:"Vorkath",id:"vorkath",value:5},{type:"boss",name:"Zulrah",id:"zulrah",value:5},{type:"boss",name:"Kalphite Queen",value:3}]},
      {level:100, isBreakpoint:true, why:"God Wars Dungeon and Wilderness bosses open — Bandos/Armadyl gear, voidwaker pieces.",
        band:{method:["vorkath"], note:"continue high-tier Slayer + money bosses"},
        unlocks:[{type:"boss",name:"God Wars Dungeon",value:4},{type:"boss",name:"Callisto/Vet'ion/Venenatis",value:3}]},
      {level:110, isBreakpoint:true, why:"Raids + DT2 endgame: Chambers of Xeric, Tombs of Amascut, DT2 vestige bosses, Nightmare.",
        band:{method:["toa"], note:"raids become primary progression + income"},
        unlocks:[{type:"boss",name:"Chambers of Xeric",value:5},{type:"boss",name:"Tombs of Amascut",id:"toa",value:5},{type:"boss",name:"Vardorvis/Duke/Leviathan/Whisperer",id:"vardorvis",value:5}]},
      {level:115, isBreakpoint:true, why:"Theatre of Blood and the hardest DT2 bosses — the true endgame gear economy.",
        band:{method:["toa"], note:"ToB + Colosseum + DT2 for BiS"},
        unlocks:[{type:"boss",name:"Theatre of Blood",value:5},{type:"boss",name:"Fortis Colosseum (deep)",value:4}]},
      {level:123, isBreakpoint:true, why:"Max-tier gauntlets: the Inferno (infernal cape) and deep Doom of Mokhaiotl delves.",
        band:{method:["doom-of-mokhaiotl"], note:"pinnacle content"},
        unlocks:[{type:"boss",name:"The Inferno",value:5},{type:"boss",name:"Doom of Mokhaiotl (deep)",id:"doom-of-mokhaiotl",value:5}]}
    ]
  },

  // =========================== ATTACK ===========================
  attack: {
    skill:"Attack", kind:"skill", role:"combat",
    note:"Gates melee weapon tiers — the accuracy backbone of every melee setup.",
    rungs:[
      {level:40, isBreakpoint:true, why:"Rune weapons + Dragon scimitar path opens (via quests) — the first real melee jump.",
        band:{method:["ammonite-crabs","nmz-combat"], note:"crabs / NMZ"},
        unlocks:[{type:"gear",name:"Rune / addy weapons",value:2}]},
      {level:60, isBreakpoint:true, why:"Dragon weapons — Dragon scimitar, Dragon warhammer, and the abyssal-whip approach.",
        band:{method:["nmz-combat"], note:"NMZ / Slayer"},
        unlocks:[{type:"gear",name:"Dragon-tier weapons",value:3}]},
      {level:70, isBreakpoint:true, why:"Abyssal whip and Saradomin sword tier — the standard mid-game melee weapons.",
        band:{method:["nmz-combat","slayer-tasks"], note:"NMZ / Slayer"},
        unlocks:[{type:"gear",name:"Abyssal whip, Saradomin sword",value:4}]},
      {level:75, isBreakpoint:true, why:"Godswords, Ghrazi rapier, Osmumten's fang — the endgame one-hand/2H melee.",
        band:{method:["nmz-combat"], note:"NMZ"},
        unlocks:[{type:"gear",name:"Godswords, Rapier, Fang",value:5}]},
      {level:82, isBreakpoint:false, why:"Blade of Saeldor / Scythe of Vitur effective tier — top BiS melee.",
        band:{method:["nmz-combat"], note:"NMZ"},
        unlocks:[{type:"gear",name:"Blade of Saeldor, Scythe",value:5}]}
    ]
  },

  // =========================== STRENGTH ===========================
  strength: {
    skill:"Strength", kind:"skill", role:"combat",
    note:"Pure damage stat — higher max hits everywhere; few hard gates but huge DPS impact.",
    rungs:[
      {level:50, isBreakpoint:true, why:"Granite maul + solid max hits; combat level climbs fast here.",
        band:{method:["ammonite-crabs"], note:"crabs / aggressive melee"},
        unlocks:[{type:"gear",name:"Granite maul",value:2}]},
      {level:70, isBreakpoint:true, why:"The standard 'base 70' combat milestone — comfortable for most mid-game PvM.",
        band:{method:["nmz-combat"], note:"NMZ is the efficient str grind"},
        unlocks:[{type:"qol",name:"Base-70 combat readiness",value:3}]},
      {level:90, isBreakpoint:true, why:"Near-max hits — meaningfully faster kills at every boss.",
        band:{method:["nmz-combat"], note:"NMZ"},
        unlocks:[{type:"qol",name:"Endgame DPS",value:3}]}
    ]
  },

  // =========================== DEFENCE ===========================
  defence: {
    skill:"Defence", kind:"skill", role:"combat",
    note:"Gates armour tiers and prayers (Piety). Note: pures/zerkers intentionally cap this.",
    rungs:[
      {level:1, isBreakpoint:false, why:"Left at 1 for pures/1-def builds — a deliberate account choice, not a lock.",
        band:{method:[], note:"n/a"},
        unlocks:[{type:"qol",name:"Pure/1-def build",value:1}]},
      {level:40, isBreakpoint:true, why:"Rune armour — the baseline defensive kit.",
        band:{method:["nmz-combat"], note:"NMZ / crabs"},
        unlocks:[{type:"gear",name:"Rune armour",value:2}]},
      {level:70, isBreakpoint:true, why:"Barrows, Bandos, crystal armour — the mid/endgame melee defence tier and Piety enabler.",
        band:{method:["nmz-combat"], note:"NMZ"},
        unlocks:[{type:"gear",name:"Barrows / Bandos armour",value:4}]},
      {level:75, isBreakpoint:true, why:"Justiciar, Torva, Masori, Ancestral, primordial boots — endgame defensive BiS.",
        band:{method:["nmz-combat"], note:"NMZ"},
        unlocks:[{type:"gear",name:"Torva / Masori / Ancestral tier",value:5}]}
    ]
  },

  // =========================== HITPOINTS ===========================
  hitpoints: {
    skill:"Hitpoints", kind:"skill", role:"combat",
    note:"Trained passively through combat; higher HP = survivability, longer trips, more NMZ absorption headroom.",
    rungs:[
      {level:50, isBreakpoint:true, why:"Comfortable early-boss survivability.",
        band:{method:["nmz-combat"], note:"passive from combat"},
        unlocks:[{type:"qol",name:"Early bossing HP",value:2}]},
      {level:75, isBreakpoint:true, why:"The tank threshold for most mid-game bosses (Anglerfish/Sara-brew overheal to ~117).",
        band:{method:["slayer-tasks"], note:"passive from Slayer"},
        unlocks:[{type:"qol",name:"Mid-game boss HP",value:3}]},
      {level:92, isBreakpoint:false, why:"Raid-comfortable HP; deep NMZ absorption and Inferno survivability.",
        band:{method:["slayer-tasks"], note:"passive"},
        unlocks:[{type:"qol",name:"Raid/Inferno HP",value:3}]}
    ]
  },

  // =========================== RANGED ===========================
  ranged: {
    skill:"Ranged", kind:"skill", role:"combat",
    note:"Gates ranged weapons — often the safest way into new bosses.",
    rungs:[
      {level:40, isBreakpoint:true, why:"Rune/broad ammo and the first real bows/crossbows.",
        band:{method:["cannon-slayer","nmz-combat"], note:"crabs / cannon-slayer"},
        unlocks:[{type:"gear",name:"Rune crossbow tier",value:2}]},
      {level:61, isBreakpoint:true, why:"Karil's crossbow / Rune crossbow with bolts — the mid-game workhorse.",
        band:{method:["cannon-slayer"], note:"cannon + Slayer"},
        unlocks:[{type:"gear",name:"Karil's, Rune c'bow + bolts",value:3}]},
      {level:75, isBreakpoint:true, why:"Toxic blowpipe, Armadyl crossbow, and Fire Cape become viable — the key ranged breakpoint.",
        band:{method:["chinning","cannon-slayer"], note:"chinning for fast xp"},
        unlocks:[{type:"gear",name:"Blowpipe, Armadyl crossbow",value:5},{type:"boss",name:"Fire Cape (Fight Caves)",value:4}]},
      {level:85, isBreakpoint:true, why:"Bow of Faerdhinen / Masori / Twisted-bow-effective tier — endgame ranged BiS.",
        band:{method:["chinning"], note:"chinning"},
        unlocks:[{type:"gear",name:"Bowfa, Masori, Twisted bow",value:5}]}
    ]
  },

  // =========================== PRAYER ===========================
  prayer: {
    skill:"Prayer", kind:"skill", role:"combat",
    note:"Gates the prayers that define PvM survivability and DPS — the highest-impact combat support skill.",
    rungs:[
      {level:43, isBreakpoint:true, why:"Protect-from prayers + Eagle Eye/Mystic Might. The single most important combat unlock — trivialises many bosses.",
        band:{method:["gilded-altar","ensouled-heads"], note:"gilded altar bones"},
        unlocks:[{type:"method",name:"Overhead protection prayers",value:5}]},
      {level:70, isBreakpoint:true, why:"Piety (needs 70 Def + King's Ransom) — the standard melee DPS prayer.",
        band:{method:["gilded-altar"], note:"gilded altar"},
        unlocks:[{type:"method",name:"Piety",value:4}]},
      {level:74, isBreakpoint:true, why:"Rigour — the ranged DPS prayer; a major damage boost for all ranged content.",
        band:{method:["gilded-altar"], note:"gilded altar"},
        unlocks:[{type:"method",name:"Rigour",value:4}]},
      {level:77, isBreakpoint:true, why:"Augury — the magic DPS/defence prayer; completes the endgame prayer set.",
        band:{method:["gilded-altar"], note:"gilded altar"},
        unlocks:[{type:"method",name:"Augury",value:4}]}
    ]
  },

  // =========================== MAGIC ===========================
  magic: {
    skill:"Magic", kind:"skill", role:"gating",
    note:"Early utility (alch/teleports), then the Slayer/PvP-defining Ancient spells.",
    rungs:[
      {level:55, isBreakpoint:true, why:"High Alchemy — idle magic xp with modest income. A method, not a goal (advances money/magic-xp only).",
        band:{method:["high-alch"], note:"alch best-margin items"},
        unlocks:[{type:"method",name:"High Alchemy",id:"high-alch",value:2}]},
      {level:70, isBreakpoint:true, why:"Ice Burst (needs Desert Treasure I) — multi-target Slayer bursting begins.",
        band:{method:["barrage-bursting"], note:"burst tasks for magic + slayer xp"},
        unlocks:[{type:"method",name:"Ice Burst / Ancient Magicks",value:4,note:"needs Desert Treasure I"}]},
      {level:94, isBreakpoint:true, why:"Ice Barrage — the defining Slayer-burst and PvP spell; a huge xp/gp multiplier on many tasks.",
        band:{method:["barrage-bursting"], note:"barrage bursting"},
        unlocks:[{type:"method",name:"Ice Barrage",value:5}]}
    ]
  },

  // =========================== RUNECRAFT ===========================
  runecraft: {
    skill:"Runecraft", kind:"skill", role:"money",
    note:"Slow to train but strongly profit-positive at the top; several distinct money altars.",
    rungs:[
      {level:44, isBreakpoint:true, why:"Nature runes — the classic profitable RC and a steady early money altar.",
        band:{method:["gotr"], note:"GOTR is the main training method"},
        unlocks:[{type:"method",name:"Nature runes",value:3}]},
      {level:77, isBreakpoint:true, why:"Blood runes (Arceuus) — near-AFK 2.5-3M/hr while building the skill.",
        band:{method:["blood-runes"], note:"blood runes near the dark altar"},
        unlocks:[{type:"method",name:"Blood runes",id:"blood-runes",value:4}]},
      {level:90, isBreakpoint:true, why:"Soul runes — the top RC money altar.",
        band:{method:["blood-runes"], note:"blood → soul runes"},
        unlocks:[{type:"method",name:"Soul runes",value:4}]},
      {level:91, isBreakpoint:true, why:"Double Nature runes with the Achievement Diary cape — ~2.3M/hr.",
        band:{method:["double-nats"], note:"double nats (needs diary cape)"},
        unlocks:[{type:"method",name:"Double nature runes",id:"double-nats",value:4}]}
    ]
  },

  // =========================== CONSTRUCTION ===========================
  construction: {
    skill:"Construction", kind:"skill", role:"utility",
    note:"Builds POH amenities that are quality-of-life multipliers across the whole account.",
    rungs:[
      {level:25, isBreakpoint:true, why:"POH essentials + Mahogany Homes viable — cheap teleports, workshop, early xp.",
        band:{method:["mahogany-homes"], note:"Mahogany Homes = cheap xp"},
        unlocks:[{type:"qol",name:"POH basics",value:2}]},
      {level:70, isBreakpoint:true, why:"Spirit tree + fairy ring + jewellery box — the POH transport hub every account wants.",
        band:{method:["mahogany-homes"], note:"Mahogany Homes"},
        unlocks:[{type:"qol",name:"Spirit tree, fairy ring, jewellery box",value:4}]},
      {level:75, isBreakpoint:true, why:"Gilded altar (2 burners) — unlocks the fast Prayer training that everything else leans on.",
        band:{method:["mahogany-homes","gilded-benches"], note:"Homes cheap / benches fast"},
        unlocks:[{type:"qol",name:"Gilded altar",value:4}]},
      {level:83, isBreakpoint:false, why:"Ornate pool + Nexus — full boss-prep hub (restore + teleport network).",
        band:{method:["gilded-benches"], note:"benches to 99"},
        unlocks:[{type:"qol",name:"Ornate pool, Nexus",value:3}]}
    ]
  },

  // =========================== AGILITY ===========================
  agility: {
    skill:"Agility", kind:"skill", role:"utility",
    note:"Gates shortcuts, run-energy regen and diary tasks; one strong money course.",
    rungs:[
      {level:52, isBreakpoint:true, why:"Wilderness Agility Course opens — ~2M/hr loot alongside xp (wildy risk).",
        band:{method:["rooftops","wilderness-agility"], note:"rooftops for safe xp"},
        unlocks:[{type:"method",name:"Wilderness Agility Course",id:"wilderness-agility",value:3},{type:"minigame",name:"Hallowed Sepulchre",id:"hallowed-sepulchre",value:4}]},
      {level:70, isBreakpoint:true, why:"Ardougne rooftop — best marks + xp; unlocks common diary shortcuts.",
        band:{method:["hallowed-sepulchre","rooftops"], note:"Sepulchre / Ardy rooftop"},
        unlocks:[{type:"method",name:"Ardougne rooftop",value:3},{type:"gear",name:"Graceful outfit",value:3}]},
      {level:90, isBreakpoint:false, why:"Late shortcuts + elite-diary agility tasks; run energy comfort peaks.",
        band:{method:["hallowed-sepulchre"], note:"Priff course (Song of the Elves)"},
        unlocks:[{type:"qol",name:"Elite diary shortcuts",value:2}]}
    ]
  },

  // =========================== HERBLORE ===========================
  herblore: {
    skill:"Herblore", kind:"skill", role:"money",
    note:"Gates the potions every boss trip relies on; high levels are also strong profit.",
    rungs:[
      {level:55, isBreakpoint:true, why:"Prayer potions + super attack/strength — the baseline combat supply kit.",
        band:{method:["herblore-potions"], note:"make potions from bought ingredients"},
        unlocks:[{type:"method",name:"Prayer / super potions",value:3}]},
      {level:66, isBreakpoint:true, why:"Super restores — mandatory for prayer-flicking at bosses and raids.",
        band:{method:["herblore-potions"], note:"keep decanting"},
        unlocks:[{type:"method",name:"Super restores",value:4}]},
      {level:90, isBreakpoint:true, why:"Super combat potions — the standard melee boost AND a strong money maker (~1.5M/hr).",
        band:{method:["herblore-supercombat"], note:"super combats = money + xp"},
        unlocks:[{type:"method",name:"Super combat potions",id:"herblore-supercombat",value:5}]},
      {level:96, isBreakpoint:true, why:"Overloads (+ divine potions) — required for Tombs of Amascut and top raid setups.",
        band:{method:["herblore-supercombat"], note:"overloads"},
        unlocks:[{type:"method",name:"Overloads / divines",value:4}]}
    ]
  },

  // =========================== THIEVING ===========================
  thieving: {
    skill:"Thieving", kind:"skill", role:"money",
    note:"A profit skill with fast-xp options; Ardougne Knights are the enduring money+xp method.",
    rungs:[
      {level:45, isBreakpoint:true, why:"Blackjacking (The Feud) — the fastest Thieving xp band.",
        band:{method:["blackjacking"], note:"blackjack Menaphite thugs"},
        unlocks:[{type:"method",name:"Blackjacking",id:"blackjacking",value:3}]},
      {level:55, isBreakpoint:true, why:"Ardougne Knights — best AFK-ish Thieving money + xp; scales 2× with the Ardy Elite diary.",
        band:{method:["ardy-knights"], note:"pickpocket knights (dodgy necklace)"},
        unlocks:[{type:"method",name:"Ardougne Knights",id:"ardy-knights",value:4}]},
      {level:71, isBreakpoint:true, why:"Pyramid Plunder top room — strong xp + artefact/sceptre income.",
        band:{method:["pyramid-plunder"], note:"Pyramid Plunder"},
        unlocks:[{type:"method",name:"Pyramid Plunder",id:"pyramid-plunder",value:3}]},
      {level:82, isBreakpoint:false, why:"Elf/master thieving + gem stalls — high-value late Thieving.",
        band:{method:["ardy-knights"], note:"elves / knights"},
        unlocks:[{type:"method",name:"Elf thieving, gem stalls",value:2}]}
    ]
  },

  // =========================== CRAFTING ===========================
  crafting: {
    skill:"Crafting", kind:"skill", role:"money",
    note:"Gates jewellery/d'hide gear; high-level jewellery is profit-positive AND fast xp.",
    rungs:[
      {level:66, isBreakpoint:true, why:"Battlestaves (orbs) — steady crafting xp + profit; a common 99 route.",
        band:{method:["battlestaves-craft","glassblowing"], note:"battlestaves / glassblowing"},
        unlocks:[{type:"method",name:"Battlestaves",id:"battlestaves-craft",value:3}]},
      {level:84, isBreakpoint:true, why:"Black d'hide bodies — the classic mid-game ranged armour crafting tier.",
        band:{method:["battlestaves-craft"], note:"d'hide / battlestaves"},
        unlocks:[{type:"gear",name:"Black d'hide armour",value:2}]},
      {level:89, isBreakpoint:true, why:"Zenyte jewellery — amulet of torture, ring of suffering, etc.: BiS accessories + best crafting money/xp.",
        band:{method:["zenyte-jewellery"], note:"cut+enchant zenytes"},
        unlocks:[{type:"method",name:"Zenyte jewellery",id:"zenyte-jewellery",value:5}]}
    ]
  },

  // =========================== FLETCHING ===========================
  fletching: {
    skill:"Fletching", kind:"skill", role:"utility",
    note:"Cheap/fast to train; mostly self-supply of ammo and bows.",
    rungs:[
      {level:52, isBreakpoint:true, why:"Broad bolts (Slayer unlock) + adamant darts — cheap AFK-ish xp and useful ammo.",
        band:{method:["broad-fletching"], note:"broad bolts / amethyst"},
        unlocks:[{type:"method",name:"Broad bolts, adamant darts",value:2}]},
      {level:81, isBreakpoint:true, why:"Rune darts — the fastest Fletching xp in the game.",
        band:{method:["darts"], note:"fletch rune/amethyst darts"},
        unlocks:[{type:"method",name:"Rune darts",id:"darts",value:3}]}
    ]
  },

  // =========================== HUNTER ===========================
  hunter: {
    skill:"Hunter", kind:"skill", role:"money",
    note:"Hunter Rumours (2024) reshaped it into a strong money + best-xp skill.",
    rungs:[
      {level:1, isBreakpoint:true, why:"Hunter Rumours (Varlamore) — the best Hunter xp AND money from level 1 upward.",
        band:{method:["hunter-rumours"], note:"rumours at the appropriate master"},
        unlocks:[{type:"method",name:"Hunter Rumours",id:"hunter-rumours",value:4}]},
      {level:63, isBreakpoint:true, why:"Black chinchompas (Wilderness) — money + feeds the chinning xp economy.",
        band:{method:["black-chins","hunter-rumours"], note:"black chins / rumours"},
        unlocks:[{type:"method",name:"Black chinchompas",id:"black-chins",value:3}]},
      {level:80, isBreakpoint:true, why:"Herbiboar (Fossil Island) — AFK-adjacent herb income while training.",
        band:{method:["herbiboar"], note:"herbiboar"},
        unlocks:[{type:"method",name:"Herbiboar",id:"herbiboar",value:3}]}
    ]
  },

  // =========================== MINING ===========================
  mining: {
    skill:"Mining", kind:"skill", role:"money",
    note:"AFK options + gathering money; feeds Smithing supply chains.",
    rungs:[
      {level:30, isBreakpoint:true, why:"Motherlode Mine — the AFK backbone; ore + golden nuggets (prospector kit, coal bag).",
        band:{method:["motherlode-mine"], note:"MLM to ~72 then upper floor"},
        unlocks:[{type:"method",name:"Motherlode Mine",id:"motherlode-mine",value:3}]},
      {level:60, isBreakpoint:true, why:"Blast Furnace access + Volcanic Mine — the fast-xp / money mining tier.",
        band:{method:["volcanic-mine","motherlode-mine"], note:"Volcanic Mine for fast xp"},
        unlocks:[{type:"method",name:"Volcanic Mine",id:"volcanic-mine",value:3}]},
      {level:85, isBreakpoint:true, why:"Runite ore — best F2P gathering income; strong members income too.",
        band:{method:["runite-ore"], note:"runite / gem rocks"},
        unlocks:[{type:"method",name:"Runite ore",id:"runite-ore",value:3}]},
      {level:92, isBreakpoint:false, why:"Amethyst — AFK money that feeds broad ammo + darts.",
        band:{method:["amethyst-mining"], note:"amethyst (AFK)"},
        unlocks:[{type:"method",name:"Amethyst",id:"amethyst-mining",value:2}]}
    ]
  },

  // =========================== SMITHING ===========================
  smithing: {
    skill:"Smithing", kind:"skill", role:"money",
    note:"Blast Furnace dominates training; high level unlocks the huge Oathplate money method.",
    rungs:[
      {level:40, isBreakpoint:true, why:"Blast Furnace gold bars (with goldsmith gauntlets) — near-AFK fast xp + light profit.",
        band:{method:["blast-furnace-gold"], note:"BF gold bars"},
        unlocks:[{type:"method",name:"Blast Furnace (gold)",id:"blast-furnace-gold",value:3}]},
      {level:60, isBreakpoint:true, why:"Blast Furnace halves coal use — steel/mith/addy/rune bars become efficient money+xp.",
        band:{method:["blast-furnace-bars"], note:"BF steel→rune bars"},
        unlocks:[{type:"method",name:"Blast Furnace (bars)",id:"blast-furnace-bars",value:3}]},
      {level:83, isBreakpoint:true, why:"Oathplate armour (Varlamore) — a standout high-gp/high-xp smithing money method.",
        band:{method:["blast-furnace-bars"], note:"toward oathplate"},
        unlocks:[{type:"method",name:"Oathplate armour",value:5,note:"verify spread"}]}
    ]
  },

  // =========================== FISHING ===========================
  fishing: {
    skill:"Fishing", kind:"skill", role:"money",
    note:"Barbarian fishing for xp; anglerfish/Tempoross for money + food supply.",
    rungs:[
      {level:35, isBreakpoint:true, why:"Tempoross — money + reward shop (fish barrel, tackle box) from a low level.",
        band:{method:["tempoross"], note:"Tempoross"},
        unlocks:[{type:"method",name:"Tempoross",id:"tempoross",value:3}]},
      {level:58, isBreakpoint:true, why:"Barbarian fishing (3-tick) — near-best Fishing xp plus free Agility + Strength.",
        band:{method:["barb-fishing"], note:"3-tick barb fishing"},
        unlocks:[{type:"method",name:"Barbarian fishing",id:"barb-fishing",value:3}]},
      {level:82, isBreakpoint:true, why:"Anglerfish — money + the premier tank-heal food the whole game buys.",
        band:{method:["anglerfish"], note:"anglerfish"},
        unlocks:[{type:"method",name:"Anglerfish",id:"anglerfish",value:3}]}
    ]
  },

  // =========================== COOKING ===========================
  cooking: {
    skill:"Cooking", kind:"skill", role:"utility",
    note:"Fast, cheap skill; gates food quality and a couple of profit methods.",
    rungs:[
      {level:35, isBreakpoint:true, why:"Wines (1-tick) — the fastest, cheapest Cooking xp to 99.",
        band:{method:["wines-cooking"], note:"1-tick wines"},
        unlocks:[{type:"method",name:"Wines of Kelda",id:"wines-cooking",value:3}]},
      {level:80, isBreakpoint:true, why:"Sharks / cooking gauntlets (reduced burn) + Karambwans as profit+xp.",
        band:{method:["karambwan-cook"], note:"1-tick karambwans"},
        unlocks:[{type:"method",name:"Karambwans, sharks",id:"karambwan-cook",value:2}]}
    ]
  },

  // =========================== FIREMAKING ===========================
  firemaking: {
    skill:"Firemaking", kind:"skill", role:"utility",
    note:"Wintertodt dominates: money, xp, seeds/herbs, and the pyromancer outfit.",
    rungs:[
      {level:50, isBreakpoint:true, why:"Wintertodt — the definitive Firemaking method: supply crates (herbs/seeds/ore) + pet + xp.",
        band:{method:["wintertodt"], note:"Wintertodt to 99"},
        unlocks:[{type:"method",name:"Wintertodt",id:"wintertodt",value:4},{type:"gear",name:"Pyromancer outfit",value:2}]}
    ]
  },

  // =========================== WOODCUTTING ===========================
  woodcutting: {
    skill:"Woodcutting", kind:"skill", role:"money",
    note:"Teaks for fast xp, yews/redwoods for money; Forestry adds group events + a reward shop.",
    rungs:[
      {level:35, isBreakpoint:true, why:"Teak trees (2-tick) — the fastest Woodcutting xp and a construction-log supply.",
        band:{method:["teak-2t","forestry-events"], note:"2-tick teaks"},
        unlocks:[{type:"method",name:"Teak trees",id:"teak-2t",value:3}]},
      {level:60, isBreakpoint:true, why:"Yew logs — reliable (F2P-friendly) money while training.",
        band:{method:["yew-logs","forestry-events"], note:"yews / Forestry"},
        unlocks:[{type:"method",name:"Yew logs",id:"yew-logs",value:2}]},
      {level:90, isBreakpoint:true, why:"Redwoods — the most-AFK high-xp method; logs feed Firemaking money.",
        band:{method:["redwoods"], note:"redwoods (AFK)"},
        unlocks:[{type:"method",name:"Redwoods",id:"redwoods",value:3}]}
    ]
  },

  // =========================== FARMING ===========================
  farming: {
    skill:"Farming", kind:"skill", role:"money",
    note:"The passive money engine via daily runs; higher tiers add tree/herb value.",
    rungs:[
      {level:32, isBreakpoint:true, why:"Ranarr herb runs — the passive-income backbone; do them daily forever.",
        band:{method:["herb-run","tree-runs"], note:"herb runs every ~80 min"},
        unlocks:[{type:"method",name:"Ranarr herb runs",id:"herb-run",value:4}]},
      {level:72, isBreakpoint:true, why:"Snapdragon + mahogany hardwoods — a big jump in herb-run value.",
        band:{method:["herb-run"], note:"add fruit-tree + hardwood patches"},
        unlocks:[{type:"method",name:"Snapdragon / mahogany",value:3}]},
      {level:85, isBreakpoint:true, why:"Torstol — top herb-run gp/run and the standard Farming goal target.",
        band:{method:["herb-run"], note:"torstol seeds"},
        unlocks:[{type:"method",name:"Torstol herbs",value:4}]},
      {level:99, isBreakpoint:false, why:"Farming cape — teleports + no-death trees; the completionist QoL payoff.",
        band:{method:["tree-runs","herb-run"], note:"trees + herbs to 99"},
        unlocks:[{type:"qol",name:"Farming cape",value:2}]}
    ]
  }

};

// (Prototype dispatched 'skill-milestones-ready' here; static ES import makes this synchronous in the Vite build.)
