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
  classes?: string[];
};

type BuiltFeature = {
  id: string;
  name: string;
  kind: "Trait" | "Feature" | "Feat" | "Background";
  summary: string;
  source: string;
};

function uniqueById<T extends { id: string }>(items: T[]) {
  return items.filter((item, index, collection) => collection.findIndex((entry) => entry.id === item.id) === index);
}

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

function textCategory(summary: string): BuiltAction["category"] {
  const normalized = summary.toLowerCase();
  if (normalized.includes("bonus action")) {
    return "Bonus Action";
  }
  if (normalized.includes("reaction")) {
    return "Reaction";
  }
  if (normalized.includes("attack")) {
    return "Attack";
  }
  if (normalized.includes("as an action") || normalized.includes("use your action")) {
    return "Action";
  }
  return "Other";
}

function parseHitFromText(summary: string) {
  const normalized = summary.toLowerCase();
  const saveMatch = summary.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/i);
  if (saveMatch) {
    return `${saveMatch[1].slice(0, 3).toUpperCase()} save`;
  }
  if (normalized.includes("spell attack")) {
    return "Spell attack";
  }
  if (normalized.includes("attack roll")) {
    return "Attack roll";
  }
  return "-";
}

function parseDamageFromText(summary: string) {
  const typed = summary.match(/(\d+d\d+(?:\s*\+\s*\w+)?)\s+([A-Za-z]+)\s+damage/i);
  if (typed) {
    return `${typed[1]} ${typed[2]}`;
  }

  const dice = summary.match(/\b(\d+d\d+(?:\s*\+\s*\w+)?)\b/i);
  return dice ? dice[1] : "-";
}

function parseRangeFromText(summary: string) {
  const match = summary.match(/(\d+\s*ft\.?(?:\s*\/\s*\d+\s*ft\.?)?)/i);
  return match?.[1] ?? "Self";
}

function buildFeatureActions(features: BuiltFeature[]): BuiltAction[] {
  return features
    .filter((feature) => feature.kind !== "Background")
    .map((feature) => ({
      id: `feature-action-${feature.id}`,
      name: feature.name,
      category: textCategory(feature.summary),
      range: parseRangeFromText(feature.summary),
      hit: parseHitFromText(feature.summary),
      damage: parseDamageFromText(feature.summary),
      notes: `${feature.kind} | ${feature.source}`,
      description: feature.summary,
      source: feature.source,
    }));
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
  if (spellLevel === 2) {
    return "2nd-level effect";
  }
  if (spellLevel === 3) {
    return "3rd-level effect";
  }
  return `${spellLevel}th-level effect`;
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
    {
      id: "hide",
      name: "Hide",
      category: "Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "Stealth",
      description: "Attempt to become unseen while you have the right cover, darkness, or distraction.",
      source: "Core Rules",
    },
    {
      id: "ready",
      name: "Ready",
      category: "Action",
      range: "Self",
      hit: "-",
      damage: "-",
      notes: "Trigger",
      description: "Prepare a trigger and response to use later in the round when the trigger happens.",
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

  const manualFeatures = (draft.features ?? []).map((feature) => ({
    id: `draft-feature-${feature.id}`,
    name: feature.name,
    kind: feature.kind === "Background" ? ("Background" as const) : ("Feature" as const),
    summary: feature.summary,
    source: "Character Draft",
  }));

  const builtFeatures = uniqueById<BuiltFeature>([
    ...speciesTraits,
    ...classFeatures,
    ...featFeatures,
    ...manualFeatures,
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
  ]);

  const builtActions = uniqueById<BuiltAction>([
    ...learnedSpells.map((spell) => ({
      id: spell.id,
      name: spell.name,
      category: spellCategory(spell.castingTime),
      range: spell.range,
      hit: parseHitFromText(spell.summary) === "-" && spell.level === 0 ? estimatedAttackBonus(draft) : parseHitFromText(spell.summary),
      damage: parseDamageFromText(spell.summary) !== "-" ? parseDamageFromText(spell.summary) : estimatedDamage(spell.level),
      notes: `${spell.school} | ${spell.duration}${spell.classes?.length ? ` | ${spell.classes.join(", ")}` : ""}`,
      description: spell.summary,
      source: spell.source ? `${spell.source} | Spell level ${spell.level}` : `Spell level ${spell.level}`,
      classes: spell.classes ?? [],
    })),
  ]);

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
