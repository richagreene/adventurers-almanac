// Authoritative quest-requirement supplements consumed by the Oracle's dependency
// engines. Names match LEDGER_DATA exactly. These OVERRIDE fragile text
// parsing of the `req` fields, and add edges that live nowhere in the base data
// (slayer-monster access quests, training-method unlocks).
export const CONTENT_REQS = {
  // Boss -> hard quest prerequisites (to fight it at all).
  bosses: {
    "Deranged Archaeologist": ["Bone Voyage"],
    "The Barrows Brothers": ["Priest in Peril"],
    "Dagannoth Kings": ["Horror from the Deep"],
    "Zulrah": ["Regicide"],
    "Vorkath": ["Dragon Slayer II"],
    "Phantom Muspah": ["Secrets of the North"],
    "Vardorvis": ["Desert Treasure II - The Fall of Jhallan"],
    "Duke Sucellus": ["Desert Treasure II - The Fall of Jhallan"],
    "The Leviathan": ["Desert Treasure II - The Fall of Jhallan"],
    "The Whisperer": ["Desert Treasure II - The Fall of Jhallan"],
    "The Gauntlet": ["Song of the Elves"],
    "Corrupted Gauntlet": ["Song of the Elves"],
    "Zalcano": ["Song of the Elves"],
    "The Nightmare": ["Sins of the Father"],
    "Phosani's Nightmare": ["Sins of the Father"]
  },
  // Slayer monster -> quest gating its area / assignment (level reqs live in base data).
  tasks: {
    "Dark beasts": ["Mourning's End Part I"],
    "Suqahs": ["Lunar Diplomacy"]
  },
  // Slayer master -> quests needed to unlock the master (for future master-aware modelling).
  slayerMasters: {
    "Duradel": ["Shilo Village"],
    "Nieve": ["Monkey Madness I"],
    "Konar": []
  },
  // Training-method keyword -> quests it depends on. Matched case-insensitively against
  // the free-text `method` on skill goals so the Oracle knows a method is quest-locked.
  methodKeywords: [
    { kw: ["ice barrage", "barrage", "ancient magick", "ancients"], quests: ["Desert Treasure I"] },
    { kw: ["ava", "assembler"], quests: ["Animal Magnetism"] },
    { kw: ["fairy ring"], quests: ["Fairytale II - Cure a Queen"] },
    { kw: ["vengeance", "lunar spell", "lunar"], quests: ["Lunar Diplomacy"] },
    { kw: ["chin", "maniacal", "mm2 tunnel"], quests: ["Monkey Madness II"] },
    { kw: ["duradel"], quests: ["Shilo Village"] },
    { kw: ["salve"], quests: ["Haunted Mine"] },
    { kw: ["blowpipe"], quests: ["Regicide"] },
    { kw: ["kandarin diary", "hard diary"], quests: [] }
  ]
};
// (ES module port — no ready event needed in the Vite build.)
