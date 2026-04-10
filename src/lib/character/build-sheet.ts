import type { CharacterDraft } from "@/lib/character/demo-sheet";
import type { ContentBundle } from "@/lib/content/schema";

type BuiltAction = {
  id: string;
  name: string;
  category: "Attack" | "Action" | "Bonus Action" | "Reaction" | "Other";
  range: string;
  hit: string;
  damage: string;
  notes: string;
  description: string;
  source: string;
};

type BuiltFeature = {
  id: string;
  name: string;
  kind: "Trait" | "Feature" | "Feat" | "Background";
  summary: string;
  source: string;
};

function spellCategory(castingTime: string): BuiltAction["category"] {
  const normalized = castingTime.toLowerCase();
  if (normalized.includes("bonus action")) {
    return "Bonus Action";
  }
  if (normalized.includes("reaction")) {
    return "Reaction";
  }
  return "Action";
}

function estimatedAttackBonus(draft: CharacterDraft) {
  const intelligence = draft.abilities.find((ability) => ability.id === "INT")?.modifier ?? 0;
  const total = draft.proficiencyBonus + intelligence;
  return total >= 0 ? `+${total}` : `${total}`;
}

function estimatedDamage(spellLevel: number) {
  if (spellLevel === 0) {
    return "1d10";
  }
  if (spellLevel === 1) {
    return "1st-level effect";
  }
  return `${spellLevel}nd-level effect`;
}

function meleeAttackModifier(draft: CharacterDraft) {
  const strength = draft.abilities.find((ability) => ability.id === "STR")?.modifier ?? 0;
  const total = draft.proficiencyBonus + strength;
  return total >= 0 ? `+${total}` : `${total}`;
}

function finesseAttackModifier(draft: CharacterDraft) {
  const dexterity = draft.abilities.find((ability) => ability.id === "DEX")?.modifier ?? 0;
  const total = draft.proficiencyBonus + dexterity;
  return total >= 0 ? `+${total}` : `${total}`;
}

function abilityDamage(modifier: number, fallback = 1) {
  const value = modifier >= 0 ? modifier : fallback;
  return value > 0 ? `${value}` : `${fallback}`;
}

function inventoryWeaponActions(draft: CharacterDraft): BuiltAction[] {
  const strength = draft.abilities.find((ability) => ability.id === "STR")?.modifier ?? 0;
  const dexterity = draft.abilities.find((ability) => ability.id === "DEX")?.modifier ?? 0;
  const inventory = draft.inventory.map((item) => item.toLowerCase());
  const hasQuarterstaff = inventory.some((item) => item.includes("quarterstaff"));
  const hasDagger = inventory.some((item) => item.includes("dagger"));
  const hasLightCrossbow = inventory.some((item) => item.includes("light crossbow"));

  return [
    {
      id: "unarmed-strike",
      name: "Unarmed Strike",
      category: "Attack",
      range: "5 ft.",
      hit: meleeAttackModifier(draft),
      damage: `${abilityDamage(strength)} bludgeoning`,
      notes: "Melee Attack",
      description: "A basic melee attack using fists, kicks, or body weight.",
      source: "Core Rules",
    },
    ...(hasQuarterstaff
      ? [
          {
            id: "quarterstaff",
            name: "Quarterstaff",
            category: "Attack" as const,
            range: "5 ft.",
            hit: meleeAttackModifier(draft),
            damage: `1d6+${abilityDamage(strength)} bludgeoning`,
            notes: "Versatile",
            description: "A simple melee weapon attack with a quarterstaff.",
            source: "Inventory",
          },
        ]
      : []),
    ...(hasDagger
      ? [
          {
            id: "dagger",
            name: "Dagger",
            category: "Attack" as const,
            range: "20/60 ft.",
            hit: finesseAttackModifier(draft),
            damage: `1d4+${abilityDamage(Math.max(strength, dexterity))} piercing`,
            notes: "Finesse, Light, Thrown",
            description: "A light melee or thrown weapon attack with a dagger.",
            source: "Inventory",
          },
        ]
      : []),
    ...(hasLightCrossbow
      ? [
          {
            id: "light-crossbow",
            name: "Light Crossbow",
            category: "Attack" as const,
            range: "80/320 ft.",
            hit: finesseAttackModifier(draft),
            damage: `1d8+${abilityDamage(dexterity)} piercing`,
            notes: "Ammunition, Loading, Two-Handed",
            description: "A ranged weapon attack using a light crossbow.",
            source: "Inventory",
          },
        ]
      : []),
  ];
}

function coreCombatActions(): BuiltAction[] {
  return [
    {
      id: "dash",
      name: "Dash",
      category: "Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "Movement",
      description: "Gain extra movement for the turn equal to your speed.",
      source: "Core Rules",
    },
    {
      id: "disengage",
      name: "Disengage",
      category: "Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "Movement",
      description: "Your movement does not provoke opportunity attacks for the rest of the turn.",
      source: "Core Rules",
    },
    {
      id: "dodge",
      name: "Dodge",
      category: "Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "Defense",
      description: "Attack rolls against you have disadvantage, and you make Dexterity saving throws with advantage until your next turn.",
      source: "Core Rules",
    },
    {
      id: "help",
      name: "Help",
      category: "Action",
      range: "5 ft.",
      hit: "-",
      damage: "-",
      notes: "Support",
      description: "Grant an ally advantage on a task or attack when you meaningfully assist them.",
      source: "Core Rules",
    },
  ];
}

export function buildSheetContent(content: ContentBundle, draft: CharacterDraft) {
  const chosenClass = content.classes.find((item) => item.id === draft.classId);
  const chosenSpecies = content.species.find((item) => item.id === draft.speciesId);
  const chosenBackground = content.backgrounds.find(
    (item) => item.id === draft.backgroundId,
  );

  const learnedSpells = content.spells.filter((spell) =>
    draft.spellIds.includes(spell.id),
  );
  const selectedFeats = content.feats.filter((feat) =>
    draft.featIds.includes(feat.id),
  );

  const classFeatures =
    chosenClass?.featuresByLevel
      ? Object.entries(chosenClass.featuresByLevel)
          .filter(([level]) => Number(level) <= draft.level)
          .flatMap(([level, features]) =>
            features.map((feature) => ({
              id: feature.id,
              name: feature.name,
              kind: "Feature" as const,
              summary: feature.summary,
              source: `${chosenClass.name} level ${level}`,
            })),
          )
      : [];

  const speciesTraits =
    chosenSpecies?.traits.map((trait) => ({
      id: trait.id,
      name: trait.name,
      kind: "Trait" as const,
      summary: trait.summary,
      source: chosenSpecies.name,
    })) ?? [];

  const featFeatures = selectedFeats.map((feat) => ({
    id: feat.id,
    name: feat.name,
    kind: "Feat" as const,
    summary: feat.summary,
    source: "Feat",
  }));

  const builtActions: BuiltAction[] = [
    ...inventoryWeaponActions(draft),
    ...coreCombatActions(),
    ...learnedSpells.map((spell) => ({
      id: spell.id,
      name: spell.name,
      category: spellCategory(spell.castingTime),
      range: spell.range,
      hit: spell.level === 0 ? estimatedAttackBonus(draft) : "Save / attack",
      damage: estimatedDamage(spell.level),
      notes: `${spell.school} | ${spell.duration}${spell.classes?.length ? ` | ${spell.classes.join(", ")}` : ""}`,
      description: spell.summary,
      source: spell.source ? `${spell.source} | Spell level ${spell.level}` : `Spell level ${spell.level}`,
    })),
  ].filter(
    (action, index, actions) => actions.findIndex((item) => item.id === action.id) === index,
  );

  const builtFeatures: BuiltFeature[] = [
    ...speciesTraits,
    ...classFeatures,
    ...featFeatures,
    ...(chosenBackground
      ? [
          {
            id: chosenBackground.id,
            name: chosenBackground.name,
            kind: "Background" as const,
            summary: chosenBackground.summary,
            source: "Background",
          },
        ]
      : []),
  ];

  return {
    className: chosenClass?.name ?? draft.classLine,
    speciesName: chosenSpecies?.name ?? draft.ancestry,
    backgroundName: chosenBackground?.name ?? "Unknown Background",
    backgroundSummary: chosenBackground?.summary ?? draft.background,
    learnedSpells,
    builtActions,
    builtFeatures,
  };
}
