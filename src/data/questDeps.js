// Quest prerequisite graph (dependent -> [direct prerequisite quests]).
// Names match LEDGER_DATA.quests[].n exactly. Curated to the well-known
// keystone chains; quests with no hard quest prereqs are simply omitted.
// Consumed by the Pathfinder dependency engine to compute unlock cascades.
export const QUEST_DEPS = {
  // --- Elf / Underground Pass line ---
  "Biohazard": ["Plague City"],
  "Underground Pass": ["Biohazard"],
  "Regicide": ["Underground Pass"],
  "Roving Elves": ["Regicide", "Waterfall Quest"],
  "Mourning's End Part I": ["Roving Elves", "Big Chompy Bird Hunting", "Sheep Herder"],
  "Mourning's End Part II": ["Mourning's End Part I"],
  "Within the Light": ["Mourning's End Part II"],
  "Song of the Elves": ["Within the Light"],

  // --- Gnome ---
  "The Eyes of Glouphrie": ["The Grand Tree"],
  "The Path of Glouphrie": ["The Eyes of Glouphrie", "Waterfall Quest"],
  "Monkey Madness I": ["The Grand Tree", "Tree Gnome Village"],
  "Monkey Madness II": ["Monkey Madness I", "Enlightened Journey", "The Eyes of Glouphrie", "Watchtower"],

  // --- Morytania / Myreque ---
  "Nature Spirit": ["Priest in Peril", "The Restless Ghost"],
  "In Search of the Myreque": ["Nature Spirit"],
  "In Aid of the Myreque": ["In Search of the Myreque"],
  "Darkness of Hallowvale": ["In Aid of the Myreque"],
  "A Taste of Hope": ["Darkness of Hallowvale"],
  "Sins of the Father": ["A Taste of Hope"],
  "Priest in Peril": ["The Restless Ghost"],
  "Ghosts Ahoy": ["Priest in Peril"],
  "Creature of Fenkenstrain": ["Priest in Peril", "The Restless Ghost"],
  "Haunted Mine": ["Priest in Peril"],
  "Shades of Mort'ton": ["Priest in Peril"],

  // --- Troll ---
  "Troll Stronghold": ["Death Plateau"],
  "Troll Romance": ["Troll Stronghold"],
  "Eadgar's Ruse": ["Troll Stronghold", "Druidic Ritual"],
  "My Arm's Big Adventure": ["Eadgar's Ruse", "The Feud", "Jungle Potion"],
  "Making Friends with My Arm": ["My Arm's Big Adventure", "Swan Song", "Cold War", "Romeo & Juliet"],

  // --- Fremennik ---
  "The Fremennik Isles": ["The Fremennik Trials"],
  "Lunar Diplomacy": ["The Fremennik Trials", "Lost City", "Rune Mysteries", "Shilo Village"],
  "Dream Mentor": ["Lunar Diplomacy", "Eadgar's Ruse"],
  "The Fremennik Exiles": ["The Fremennik Isles", "Lunar Diplomacy", "Mountain Daughter", "Heroes' Quest"],
  "Throne of Miscellania": ["The Fremennik Trials", "Heroes' Quest"],
  "Royal Trouble": ["Throne of Miscellania"],
  "Olaf's Quest": ["The Fremennik Trials"],

  // --- Great guild / legends chain ---
  "Heroes' Quest": ["Shield of Arrav", "Merlin's Crystal", "Lost City", "Dragon Slayer I", "Druidic Ritual"],
  "Legends' Quest": ["Family Crest", "Heroes' Quest", "Shilo Village", "Underground Pass", "Waterfall Quest"],
  "Holy Grail": ["Merlin's Crystal"],

  // --- Desert ---
  "Desert Treasure I": ["Priest in Peril", "Waterfall Quest", "Temple of Ikov", "The Tourist Trap", "Troll Stronghold"],
  "Desert Treasure II - The Fall of Jhallan": ["Desert Treasure I", "Secrets of the North", "Beneath Cursed Sands", "The Garden of Death", "Below Ice Mountain"],
  "Contact!": ["Icthlarin's Little Helper"],
  "Dealing with Scabaras": ["Icthlarin's Little Helper"],
  "Beneath Cursed Sands": ["Contact!"],

  // --- Dragon Slayer II web ---
  "Dragon Slayer II": ["Legends' Quest", "Dream Mentor", "A Tail of Two Cats", "Animal Magnetism", "Ghosts Ahoy", "Bone Voyage", "Client of Kourend"],
  "A Tail of Two Cats": ["Icthlarin's Little Helper"],
  "Animal Magnetism": ["The Restless Ghost", "Ernest the Chicken", "Priest in Peril"],
  "Bone Voyage": ["The Dig Site"],

  // --- Fairytale ---
  "Fairytale I - Growing Pains": ["Lost City", "Nature Spirit"],
  "Fairytale II - Cure a Queen": ["Fairytale I - Growing Pains"],

  // --- Karamja ---
  "Jungle Potion": ["Druidic Ritual"],
  "Shilo Village": ["Jungle Potion"],
  "Tai Bwo Wannai Trio": ["Jungle Potion"],
  "Zogre Flesh Eaters": ["Big Chompy Bird Hunting", "Jungle Potion"],

  // --- Misc keystones ---
  "Recipe for Disaster": ["Cook's Assistant", "Big Chompy Bird Hunting", "Shilo Village", "Gertrude's Cat", "Shadow of the Storm", "Monkey Madness I", "Fishing Contest"],
  "Secrets of the North": ["Making History", "Hazeel Cult", "The Golem"],
  "Making History": ["Priest in Peril", "The Restless Ghost"],
  "Shadow of the Storm": ["The Golem", "Demon Slayer"],
  "Wanted!": ["Recruitment Drive", "The Lost Tribe", "Priest in Peril"],
  "Recruitment Drive": ["Black Knights' Fortress", "Druidic Ritual"],
  "Devious Minds": ["Wanted!", "Troll Stronghold", "Doric's Quest"],
  "The Slug Menace": ["Wanted!", "Sea Slug"],
  "What Lies Below": ["Rune Mysteries"],
  "Elemental Workshop II": ["Elemental Workshop I"],
  "Defender of Varrock": ["The Dig Site"],
  "Grim Tales": ["Witch's House"],

  // --- Dorgeshuun / dwarf ---
  "The Lost Tribe": ["Goblin Diplomacy", "Rune Mysteries", "Fishing Contest"],
  "Death to the Dorgeshuun": ["The Lost Tribe"],
  "Another Slice of H.A.M.": ["Death to the Dorgeshuun", "The Giant Dwarf", "The Dig Site"],
  "Land of the Goblins": ["The Lost Tribe", "Fishing Contest", "Goblin Diplomacy"],
  "Between a Rock...": ["Dwarf Cannon", "Fishing Contest"],
  "Forgettable Tale of a Drunken Dwarf": ["The Giant Dwarf", "Fishing Contest"],

  // --- Pirate ---
  "Cabin Fever": ["Pirate's Treasure"],
  "Rum Deal": ["Cabin Fever"],
  "The Great Brain Robbery": ["Creature of Fenkenstrain", "Cabin Fever"],

  // --- Misc chains ---
  "Swan Song": ["One Small Favour", "Garden of Tranquillity"],
  "One Small Favour": ["Rune Mysteries", "Shilo Village"],
  "Garden of Tranquillity": ["Creature of Fenkenstrain"],

  // --- Kourend ---
  "The Queen of Thieves": ["Client of Kourend"],
  "The Depths of Despair": ["Client of Kourend"],
  "Tale of the Righteous": ["Client of Kourend"],
  "The Forsaken Tower": ["Client of Kourend"],
  "The Ascent of Arceuus": ["Client of Kourend"],
  "Getting Ahead": ["The Depths of Despair"],
  "A Kingdom Divided": ["The Depths of Despair", "The Queen of Thieves", "Tale of the Righteous", "The Forsaken Tower", "The Ascent of Arceuus"],

  // --- Varlamore ---
  "Twilight's Promise": ["Children of the Sun"],
  "The Heart of Darkness": ["Twilight's Promise"],
  "Perilous Moons": ["Twilight's Promise"],
  "Death on the Isle": ["The Heart of Darkness"],
  "The Final Dawn": ["Death on the Isle", "Perilous Moons"]
};
// (ES module port — no ready event needed in the Vite build.)
