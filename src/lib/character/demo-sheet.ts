export type AbilityId = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";

export type AbilityScore = {
  id: AbilityId;
  label: string;
  score: number;
  modifier: number;
};

export type SavingThrow = {
  ability: AbilityId;
  bonus: number;
  proficient: boolean;
  breakdown: string;
};

export type Skill = {
  id: string;
  label: string;
  ability: AbilityId;
  bonus: number;
  proficient: boolean;
  breakdown: string;
  description: string;
};

export type Sense = {
  id: string;
  label: string;
  value: number;
  description: string;
};

export type ActionItem = {
  id: string;
  name: string;
  category: "Attack" | "Action" | "Bonus Action" | "Reaction" | "Other";
  range: string;
  hit: string;
  damage: string;
  notes: string;
  description: string;
};

export type FeatureItem = {
  id: string;
  name: string;
  kind: "Trait" | "Feature" | "Background";
  summary: string;
};

export type CharacterDraft = {
  name: string;
  ancestry: string;
  classLine: string;
  classId: string;
  multiclassIds: string[];
  speciesId: string;
  backgroundId: string;
  selectedSubclassOptions: string[];
  pactBoonId: string | null;
  selectedPactCantripIds: string[];
  selectedInvocationIds: string[];
  mysticArcanumSelections: Partial<Record<6 | 7 | 8 | 9, string>>;
  selectedSkillIds: string[];
  spellIds: string[];
  featIds: string[];
  level: number;
  proficiencyBonus: number;
  speed: string;
  armorClass: number;
  initiative: number;
  inspiration: boolean;
  maxHp: number;
  currentHp: number;
  tempHp: number;
  defenses: string[];
  conditions: string[];
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  flexibleAbilityBonuses: {
    plusTwo: AbilityId | null;
    plusOne: AbilityId | null;
  };
  abilities: AbilityScore[];
  savingThrows: SavingThrow[];
  senses: Sense[];
  skills: Skill[];
  actions: ActionItem[];
  inventory: string[];
  features: FeatureItem[];
  background: string;
  notes: string[];
};

export const demoCharacter: CharacterDraft = {
  name: "Elira Voss",
  ancestry: "High Elf",
  classLine: "Wizard 3",
  classId: "wizard",
  multiclassIds: [],
  speciesId: "high-elf",
  backgroundId: "sage",
  selectedSubclassOptions: [],
  pactBoonId: null,
  selectedPactCantripIds: [],
  selectedInvocationIds: [],
  mysticArcanumSelections: {},
  selectedSkillIds: ["arcana", "investigation"],
  spellIds: ["magic-missile", "shield", "misty-step"],
  featIds: ["war-caster", "fey-touched"],
  level: 3,
  proficiencyBonus: 2,
  speed: "30 ft.",
  armorClass: 14,
  initiative: 2,
  inspiration: false,
  maxHp: 20,
  currentHp: 17,
  tempHp: 0,
  defenses: ["Advantage vs charmed", "Resistance to cold"],
  conditions: ["Concentrating on Shield"],
  proficiencies: {
    armor: ["Light Armor"],
    weapons: ["Daggers", "Quarterstaffs", "Light Crossbows"],
    tools: ["Calligrapher's Supplies"],
    languages: ["Common", "Elvish", "Draconic", "Sylvan"],
  },
  flexibleAbilityBonuses: {
    plusTwo: null,
    plusOne: null,
  },
  abilities: [
    { id: "STR", label: "Strength", score: 10, modifier: 0 },
    { id: "DEX", label: "Dexterity", score: 10, modifier: 0 },
    { id: "CON", label: "Constitution", score: 10, modifier: 0 },
    { id: "INT", label: "Intelligence", score: 10, modifier: 0 },
    { id: "WIS", label: "Wisdom", score: 10, modifier: 0 },
    { id: "CHA", label: "Charisma", score: 10, modifier: 0 },
  ] satisfies AbilityScore[],
  savingThrows: [
    { ability: "STR", bonus: -1, proficient: false, breakdown: "Strength modifier only." },
    { ability: "DEX", bonus: 2, proficient: false, breakdown: "Dexterity modifier only." },
    { ability: "CON", bonus: 1, proficient: false, breakdown: "Constitution modifier only." },
    { ability: "INT", bonus: 5, proficient: true, breakdown: "Intelligence modifier + proficiency." },
    { ability: "WIS", bonus: 3, proficient: true, breakdown: "Wisdom modifier + proficiency." },
    { ability: "CHA", bonus: 0, proficient: false, breakdown: "Charisma modifier only." },
  ] satisfies SavingThrow[],
  senses: [
    {
      id: "perception",
      label: "Passive Perception",
      value: 13,
      description: "Used to notice creatures, traps, or hidden details without actively searching.",
    },
    {
      id: "investigation",
      label: "Passive Investigation",
      value: 15,
      description: "Reflects how quickly the character spots patterns, clues, and inconsistencies.",
    },
    {
      id: "insight",
      label: "Passive Insight",
      value: 11,
      description: "Shows how easily the character reads lies, motives, and emotional shifts.",
    },
  ] satisfies Sense[],
  skills: [
    {
      id: "acrobatics",
      label: "Acrobatics",
      ability: "DEX",
      bonus: 2,
      proficient: false,
      breakdown: "Dexterity modifier.",
      description: "Balance, flips, and keeping your feet in unstable situations.",
    },
    {
      id: "arcana",
      label: "Arcana",
      ability: "INT",
      bonus: 5,
      proficient: true,
      breakdown: "Intelligence modifier + proficiency.",
      description: "Lore about spells, planes, magical traditions, and enchantments.",
    },
    {
      id: "history",
      label: "History",
      ability: "INT",
      bonus: 5,
      proficient: true,
      breakdown: "Intelligence modifier + proficiency.",
      description: "Recall kingdoms, wars, noble houses, legends, and ancient events.",
    },
    {
      id: "insight",
      label: "Insight",
      ability: "WIS",
      bonus: 1,
      proficient: false,
      breakdown: "Wisdom modifier.",
      description: "Read a creature's mood, honesty, and intent.",
    },
    {
      id: "investigation",
      label: "Investigation",
      ability: "INT",
      bonus: 5,
      proficient: true,
      breakdown: "Intelligence modifier + proficiency.",
      description: "Piece together clues, hidden compartments, and mechanical logic.",
    },
    {
      id: "perception",
      label: "Perception",
      ability: "WIS",
      bonus: 3,
      proficient: true,
      breakdown: "Wisdom modifier + proficiency.",
      description: "Notice sound, movement, hidden doors, and visual details.",
    },
    {
      id: "persuasion",
      label: "Persuasion",
      ability: "CHA",
      bonus: 0,
      proficient: false,
      breakdown: "Charisma modifier.",
      description: "Negotiate, reassure, and influence with grace.",
    },
    {
      id: "stealth",
      label: "Stealth",
      ability: "DEX",
      bonus: 2,
      proficient: false,
      breakdown: "Dexterity modifier.",
      description: "Move quietly, conceal yourself, and avoid notice.",
    },
  ] satisfies Skill[],
  actions: [
    {
      id: "fire-bolt",
      name: "Fire Bolt",
      category: "Attack",
      range: "120 ft.",
      hit: "+5",
      damage: "1d10 fire",
      notes: "Cantrip",
      description:
        "Ranged spell attack that ignites flammable unattended objects on a hit.",
    },
    {
      id: "ray-of-frost",
      name: "Ray of Frost",
      category: "Attack",
      range: "60 ft.",
      hit: "+5",
      damage: "1d8 cold",
      notes: "Reduces speed by 10 ft.",
      description: "Chilling ray that slows the target until the start of your next turn.",
    },
    {
      id: "misty-step",
      name: "Misty Step",
      category: "Bonus Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "2nd-level spell",
      description: "Teleport up to 30 feet to a visible unoccupied space.",
    },
    {
      id: "shield",
      name: "Shield",
      category: "Reaction",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "+5 AC until next turn",
      description: "Arcane barrier that can turn a hit into a miss and stops magic missile.",
    },
  ] satisfies ActionItem[],
  inventory: [
    "Spellbook",
    "Arcane Focus",
    "Explorer's Pack",
    "2x Healing Potion",
    "Scholar's Journal",
  ],
  features: [
    {
      id: "darkvision",
      name: "Darkvision",
      kind: "Trait",
      summary: "You can see in dim light within 60 feet as if it were bright light.",
    },
    {
      id: "arcane-recovery",
      name: "Arcane Recovery",
      kind: "Feature",
      summary: "Recover spent spell slots during a short rest once per day.",
    },
    {
      id: "researcher",
      name: "Researcher",
      kind: "Background",
      summary: "You usually know where and from whom to obtain obscure knowledge.",
    },
  ] satisfies FeatureItem[],
  background:
    "Elira grew up around old observatories and ruined archives, collecting magical notes others overlooked.",
  notes: [
    "Keep Counterspell reserved for enemy casters.",
    "Use Misty Step if melee enemies close the gap.",
    "Investigate runes before touching cursed objects.",
  ],
};
