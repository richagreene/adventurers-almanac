// Boss battle cards — the distilled 20% of each fight that actually kills
// people, structured for the in-app guide pages. Keys match LEDGER_DATA.bosses
// names exactly. Curated from the OSRS Wiki strategy pages (asOf marks the
// review date); the app layers the player's own gates/KC/luck/gear on top.
//
// Schema per boss:
//   tagline     one-line hook
//   difficulty  1..5 (5 = elite) · diffLabel
//   avgKill     rough minutes per kill at competence
//   summary     2-3 sentence orientation
//   phases      [{ name, pray, mech, counter }]  pray: Melee|Ranged|Magic|Flick|—
//   rotation    cheat-sheet lines (kill order / rhythm) or null
//   mistakes    what actually kills people here
//   inventory   suggested consumables/utility
//   wikiPage    deep link target (appended to the wiki base URL)
export const BOSS_GUIDES = {
  "Zulrah": {
    tagline: "The toxic serpent of Zul-Andra — profit machine once the rotations click.",
    difficulty: 4, diffLabel: "High — rotation memory", avgKill: 2,
    summary: "Zulrah cycles through three forms in four fixed rotations. Every death is a wrong prayer or standing in venom; every smooth kill is knowing which form comes next. Bring ranged + magic and switch prayers on the form, not on reaction.",
    phases: [
      { name: "Green — serpentine", pray: "Ranged", mech: "Rapid ranged bolts.", counter: "Pray Ranged, attack freely — your main DPS window." },
      { name: "Blue — turquoise", pray: "Magic", mech: "Magic blasts.", counter: "Pray Magic; keep attacking through it." },
      { name: "Red — crimson", pray: "—", mech: "Melee-only form; lunges if you stand close after two hits.", counter: "No overhead needed — stand a few tiles off and unload. Best DPS phase." },
      { name: "Jad phase (green)", pray: "Flick", mech: "Alternates ranged and magic per attack.", counter: "Watch the projectile and flick between Ranged and Magic each hit." },
      { name: "Snakelings + clouds", pray: "—", mech: "Venom clouds claim tiles; snakelings harass and venom you.", counter: "Pre-move off cloud tiles; ignore snakelings unless low HP — anti-venom+ keeps you safe." },
    ],
    rotation: [
      "Four fixed rotations, identified by the FIRST two forms: Green→Red or Green→Blue starts.",
      "Learn spawn tiles per rotation (or run a helper overlay) — position BEFORE the form lands.",
      "Magic (trident/shadow) on green & blue · switch to ranged (blowpipe) only if that's your stronger style.",
      "Kill snakelings with a blowpipe tap only when the boss submerges.",
    ],
    mistakes: [
      "Praying on reaction instead of on the known rotation — the hit lands with the form change.",
      "Standing on a venom cloud tile 'for one more attack'.",
      "Skipping anti-venom+ — venom stacks quietly kill you during the Jad phase.",
      "Bringing one combat style — red form melts to melee-range DPS but green/blue punish a single style.",
    ],
    inventory: ["Anti-venom+ (4)", "Prayer potions ×3-4", "Sharks / manta rays", "Rune pouch (trident runes)", "Ranged switch (blowpipe + scales)", "House teleport tab (regear)"],
    wikiPage: "Zulrah/Strategies", asOf: "2026-06",
  },
  "Vorkath": {
    tagline: "The undead dragon of Ungael — the most reliable money in the mid-game.",
    difficulty: 3, diffLabel: "Moderate — rhythm fight", avgKill: 3,
    summary: "Vorkath alternates six normal attacks with one of two specials, forever. Learn the two specials and the fight becomes a metronome: DPS, react, DPS. Super antifire + Protect from Magic covers almost everything else.",
    phases: [
      { name: "Normal attacks ×6", pray: "Magic", mech: "Random mix of ranged, magic, dragonfire, prayer-disable shot.", counter: "Pray Magic, super antifire up, hit back with DHCB/lance. Count to six." },
      { name: "Special — acid + fireballs", pray: "Magic", mech: "Floods the arena with acid pools, rapid-fires fireballs that track you.", counter: "Walk two tiles back-and-forth along a clean line ('Woox walk') or just run wide — never stand still." },
      { name: "Special — pink fireball", pray: "Magic", mech: "Lobbed high-damage bomb at your tile (65+ if it lands).", counter: "Move 2+ tiles sideways the moment it launches." },
      { name: "Ice breath + spawn", pray: "Magic", mech: "Freezes you, sends a zombified spawn that explodes on you.", counter: "Kill the spawn instantly — Crumble Undead one-shots it (keep the runes and autocast slot ready)." },
    ],
    rotation: [
      "6 normal attacks → special → 6 normal → the OTHER special. They alternate — you always know which is next.",
      "Ruby bolts (e) below 500 HP wreck him; swap diamond (e) for the last ~250.",
      "Loot every kill — the consistent value is in the dragonhide/bones/supply drops, not just rares.",
    ],
    mistakes: [
      "Eating through the acid phase instead of walking — the fireballs outpace your food.",
      "Forgetting Crumble Undead — the spawn detonation hits like a truck.",
      "Letting super antifire expire mid-kill (set a 6-dose timer habit).",
      "Standing one tile too close after the pink bomb — splash damage still clips you.",
    ],
    inventory: ["Super antifire ×2", "Prayer potions ×2-3", "Chaos + earth runes (Crumble Undead)", "Ruby + diamond dragon bolts (e)", "Sharks ×8-10", "Digsite/Fremennik teleport"],
    wikiPage: "Vorkath/Strategies", asOf: "2026-06",
  },
  "Alchemical Hydra": {
    tagline: "The 95-Slayer chemistry exam — vent management plus a prayer metronome.",
    difficulty: 4, diffLabel: "High — multitasking", avgKill: 3,
    summary: "The Hydra cycles four elemental phases and swaps between ranged and magic every three attacks. Your job is two rhythms at once: flick prayers on the count of three, and lure it over the right chemical vent at each phase so it loses its damage reduction.",
    phases: [
      { name: "Green — poison", pray: "Flick ×3", mech: "Alternates ranged/magic in sets of 3; lobs poison blobs that claim tiles.", counter: "Lure over the RED vent to strip its defence; sidestep poison splats." },
      { name: "Blue — lightning", pray: "Flick ×3", mech: "Lightning bolts wander the room and lock you if touched.", counter: "Lure over the GREEN vent; keep moving between attacks." },
      { name: "Red — fire", pray: "Flick ×3", mech: "Sweeping fire wall traps you; sustained burn if caught.", counter: "Lure over the BLUE vent FIRST, then stand clear of the tracking flame lines." },
      { name: "Final — Jad phase", pray: "Flick each", mech: "Alternates ranged/magic EVERY attack, faster.", counter: "No vent — pure prayer focus. Save a stamina/brew sip for before this starts." },
    ],
    rotation: [
      "Attack rhythm: 3 ranged, 3 magic, repeat — count every shot, flick on 'three'.",
      "Vent order to remember: RED (poison phase) → GREEN (lightning) → BLUE (fire).",
      "If a vent isn't primed the boss keeps 75% damage reduction — luring is worth more than DPS.",
    ],
    mistakes: [
      "Losing the 3-count during vent movement — the phase change resets the count, movement doesn't.",
      "Skipping a vent 'to save time' — you pay it back triple in kill length.",
      "Getting clipped by the fire wall while greedy for one more attack.",
      "No anti-poison for the green phase floor.",
    ],
    inventory: ["Ranged gear (DHCB/blowpipe) + dragon bolts", "Anti-venom+ or antidote++", "Prayer potions ×3", "Saradomin brews ×2 + restores", "Stamina potion", "Boots you can click with — this fight is footwork"],
    wikiPage: "Alchemical_Hydra/Strategies", asOf: "2026-06",
  },
  "Phantom Muspah": {
    tagline: "The frozen phantom of the Wilderness rift — shield breaks and spike dodges.",
    difficulty: 3, diffLabel: "Moderate-high", avgKill: 3,
    summary: "The Muspah swaps between a ranged form and a melee form, periodically shielding itself with your own prayer points. Burst the shield fast, dodge the ice spikes, and save damage for the post-shield windows.",
    phases: [
      { name: "Ranged form — crystal", pray: "Ranged", mech: "Fast crystal shots; occasionally teleports you to it.", counter: "Pray Ranged and DPS; step back out if it drags you in." },
      { name: "Melee form", pray: "Melee", mech: "Charges you down with heavy melee swings.", counter: "Pray Melee, keep max distance — it switches back after a few swings." },
      { name: "Shield phase", pray: "—", mech: "Gains a prayer shield that DRAINS YOUR PRAYER while it holds.", counter: "Unload your fastest attacks (blowpipe/venator) — the shield scales off your prayer, so burst it before you're drained dry." },
      { name: "Ice spikes + darkness", pray: "—", mech: "Homing spikes chase your tile; late fight the room darkens with a spike corridor.", counter: "Keep moving one tile ahead of the spikes; in darkness, hug the lit corridor and keep hitting." },
    ],
    rotation: [
      "Forms alternate on a timer — pre-pot prayer before the shield, not after.",
      "Blowpipe or venator bow for shield breaks; heavier ranged (bowfa/tbow) for the forms.",
      "It sits above the Forgotten Ceremony rift — quest cape of gear not required, Secrets of the North is.",
    ],
    mistakes: [
      "Praying through the shield phase — that's literally feeding it.",
      "Tunnel vision during spikes; they hit for chunks and stack with form damage.",
      "Ignoring the teleport-grab — it pulls you into melee range on the ranged form.",
    ],
    inventory: ["Prayer potions ×3-4 (shield eats prayer)", "Stamina potion", "Sharks/manta + a brew", "Blowpipe (shield) + main ranged weapon", "Icy basalt (bank is close via Weiss)"],
    wikiPage: "Phantom_Muspah/Strategies", asOf: "2026-06",
  },
  "General Graardor (Bandos)": {
    tagline: "The warlord of the God Wars Dungeon — the classic first 'real' boss trip.",
    difficulty: 3, diffLabel: "Moderate — chip damage war", avgKill: 2,
    summary: "Graardor hits a huge melee smash and a room-wide ranged shockwave, while three bodyguards chip you with all three styles. Solo kills are a war of attrition: pray his big hit, burn him down, then deal with the minions in a fixed order every respawn cycle.",
    phases: [
      { name: "Graardor — melee", pray: "Melee", mech: "Massive melee crush on whoever holds aggro.", counter: "Protect from Melee is your default overhead all fight." },
      { name: "Graardor — shockwave", pray: "Melee", mech: "Ranged AoE hits EVERYONE in the room for up to ~35.", counter: "Can't pray both — keep HP above 40 at all times and let food cover the shockwaves." },
      { name: "Minions ×3", pray: "Melee", mech: "Steelwill (mage), Grimspike (range), Strongstack (melee) chip you between boss spawns.", counter: "Kill order after the boss dies: mage → range → melee. Their chip damage is what actually drains trips." },
      { name: "Killcount + altar", pray: "—", mech: "Need 40 Bandos killcount to enter; altar inside restores prayer once per trip window.", counter: "Get KC on goblins/hobgoblins with AoE; tag the altar between kills." },
    ],
    rotation: [
      "Boss dies → minions die in order (mage first) → repeat. Never DPS minions while Graardor is up.",
      "Bandos tassets/hilt trips fund whole accounts — the grind is variance, kill speed is sanity.",
      "Ecumenical keys (Wilderness) skip the 40 KC if you hate the grind.",
    ],
    mistakes: [
      "Sitting below 40 HP when the shockwave lands on top of a minion hit.",
      "Praying Ranged for the shockwave and eating an 60 melee smash instead.",
      "Fighting in the doorway — his melee reach is deceptive, and minions body-block you.",
    ],
    inventory: ["Bandos god item (KC room safety)", "Super combat potion", "Prayer potions ×4", "Sharks ×12+ or brews+restores", "Games necklace/Goblin village for the walk", "Full melee power gear; crush weapon ideal"],
    wikiPage: "General_Graardor/Strategies", asOf: "2026-06",
  },
  "TzTok-Jad (Fight Caves)": {
    tagline: "The original prayer check — 62 waves for one 6-second exam, repeated.",
    difficulty: 4, diffLabel: "High — endurance + nerve", avgKill: 60,
    summary: "The Fight Caves are ~an hour of wave management ending at TzTok-Jad, who one-shots wrong prayers. Jad himself is simple: every attack telegraphs. The caves kill you with fatigue and the healers kill you with panic — have a plan for both.",
    phases: [
      { name: "Waves 1-62", pray: "situational", mech: "Escalating spawns; 360s (ranged+mage) and Ket-Zeks from wave 45 hit through everything but prayer.", counter: "Learn safespots for your spawn rotation; kill order: 45s → 90s → 180s → 360s. Conserve supplies early." },
      { name: "Jad — ranged attack", pray: "Ranged", mech: "Rears up and SLAMS both front legs; boulders drop from above.", counter: "Legs slam down = Protect from Ranged. You have ~1.5s after the animation starts." },
      { name: "Jad — magic attack", pray: "Magic", mech: "Rears BACK on hind legs and breathes a fireball.", counter: "Rears back = Protect from Magic. Pray on the animation, never the projectile." },
      { name: "Healers @ 50%", pray: "keep flicking", mech: "Four Yt-HurKots heal Jad rapidly at half HP.", counter: "Tag each once to aggro them onto you, drag them off, keep flicking Jad the whole time. Panic here is the #1 cape denier." },
    ],
    rotation: [
      "Italy rock / safespot maps exist per rotation — pick one and drill it.",
      "Jad has ONE attack in the air at a time: watch him, not your inventory.",
      "Practice flicking on waves 45+ Ket-Zeks — same speed as Jad, lower stakes.",
    ],
    mistakes: [
      "Praying on the projectile instead of the animation — too late by design.",
      "Tagging healers with attacks that keep you off-prayer too long.",
      "Blowing supplies before wave 30 — the caves are a marathon with a sprint finish.",
      "Logging out mentally after Jad drops below 25% — he kills capeless players at 1% HP daily.",
    ],
    inventory: ["Ranged setup (blowpipe/bowfa; d'hide is fine)", "Purple sweets + brews", "Prayer potions ×6+", "Bring a stamina — healer dragging", "Guthix rest overrides nothing: just pray"],
    wikiPage: "TzTok-Jad/Strategies", asOf: "2026-06",
  },
};
