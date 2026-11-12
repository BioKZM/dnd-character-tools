import type { CharacterDraft } from "@/lib/character/demo-sheet";
import type { ContentBundle } from "@/lib/content/schema";
import { optionalFeatureActive, type EngineCatalog } from "@/lib/engine/collect";
import { deriveCharacter, resolveResourceUses, type DerivedCharacter, type DerivedSpell } from "@/lib/engine/derive";
import { computeArmorClass, mageArmorAvailable, type ArmorClassResult } from "@/lib/engine/armor-class";
import { cantripTier, scaleCantripDamage, spellcastingProfiles, type SpellcastingProfile } from "@/lib/engine/spellcasting";
import type { AbilityId } from "@/lib/engine/grants";

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

type SpellActionSource = {
  spellId: string;
  sourceLabel: string;
};

type DerivedStatTone = "neutral" | "boosted";

export type DerivedStatDisplay = {
  id: string;
  label: string;
  displayValue: string;
  baseValue: number;
  currentValue: number;
  bonusValue: number;
  tone: DerivedStatTone;
  breakdown: string[];
};

function uniqueById<T extends { id: string }>(items: T[]) {
  return items.filter((item, index, collection) => collection.findIndex((entry) => entry.id === item.id) === index);
}

function uniqueFeatures(items: BuiltFeature[]) {
  return items.filter(
    (item, index, collection) =>
      collection.findIndex(
        (entry) =>
          entry.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
          entry.summary.trim().toLowerCase() === item.summary.trim().toLowerCase() &&
          entry.kind === item.kind,
      ) === index,
  );
}

function uniqueSpellActionSources(items: SpellActionSource[]) {
  return items.filter(
    (item, index, collection) =>
      collection.findIndex((entry) => entry.spellId === item.spellId && entry.sourceLabel === item.sourceLabel) === index,
  );
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

function spellMatchesName(spellName: string, targetName: string) {
  return spellName.trim().toLowerCase() === targetName.trim().toLowerCase();
}

function parseFeetValue(value: string) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function formatFeet(value: number) {
  return `${value} ft.`;
}

function languageNamesFromIds(content: ContentBundle, languageIds: string[]) {
  return languageIds.map((languageId) => content.languages.find((language) => language.id === languageId)?.name ?? languageId);
}

function backgroundLanguageChoiceLabel(choice: ContentBundle["backgrounds"][number]["languages"]["choices"][number]) {
  if (Array.isArray(choice.options)) {
    return `${choice.label}: ${choice.options.join(", ")}`;
  }

  const optionLabel = choice.options === "any" ? "any language" : `${choice.options} language`;
  return `${choice.label} (${choice.count} ${optionLabel}${choice.count === 1 ? "" : "s"})`;
}

function backgroundLanguageSummary(content: ContentBundle, background: ContentBundle["backgrounds"][number]) {
  return [
    ...languageNamesFromIds(content, background.languages.fixed),
    ...background.languages.choices.map(backgroundLanguageChoiceLabel),
  ];
}

function toolNameFromValue(content: ContentBundle, value: string) {
  return content.tools.find((tool) => tool.id === value)?.name ?? value;
}

function toolIdFromValue(content: ContentBundle, value: string) {
  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    content.tools.find(
      (tool) =>
        tool.id === value ||
        tool.name.toLowerCase() === value.toLowerCase() ||
        tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedValue,
    )?.id ?? value
  );
}

function toolChoiceOptions(content: ContentBundle, options: ContentBundle["backgrounds"][number]["toolProficiencies"]["choices"][number]["options"]) {
  if (options === "any") {
    return content.tools.map((tool) => tool.id);
  }

  if (typeof options === "string") {
    const categoryTools = content.tools.filter((tool) => tool.category === options).map((tool) => tool.id);
    return categoryTools.length ? categoryTools : [options];
  }

  return options.flatMap((option) => {
    const categoryTools = content.tools.filter((tool) => tool.category === option).map((tool) => tool.id);
    return categoryTools.length ? categoryTools : [toolIdFromValue(content, option)];
  });
}

function backgroundToolChoiceLabel(content: ContentBundle, choice: ContentBundle["backgrounds"][number]["toolProficiencies"]["choices"][number]) {
  const optionLabels: Record<string, string> = {
    any: "any tool",
    "artisan-tools": "artisan tool",
    "gaming-sets": "gaming set",
    "musical-instruments": "musical instrument",
    vehicles: "vehicle",
  };

  if (Array.isArray(choice.options)) {
    return `${choice.label}: ${toolChoiceOptions(content, choice.options).map((option) => toolNameFromValue(content, option)).join(", ")}`;
  }

  const optionLabel = optionLabels[choice.options] ?? choice.options;
  return `${choice.label} (${choice.count} ${optionLabel}${choice.count === 1 ? "" : "s"})`;
}

function backgroundToolSummary(content: ContentBundle, background: ContentBundle["backgrounds"][number], selections: Record<string, string[]> = {}) {
  return [
    ...background.toolProficiencies.fixed,
    ...background.toolProficiencies.choices.map((choice) => {
      const selected = (selections[choice.id] ?? []).map((value) => toolNameFromValue(content, value));
      return selected.length ? selected.join(", ") : backgroundToolChoiceLabel(content, choice);
    }),
  ];
}

function isCustomBackground(backgroundId: string) {
  return backgroundId === "custom-background";
}

function customBackgroundProficiencyLabel(content: ContentBundle, value: string) {
  const [kind, id] = value.split(":");
  if (kind === "tool") {
    return content.tools.find((tool) => tool.id === id)?.name ?? id;
  }
  if (kind === "language") {
    return content.languages.find((language) => language.id === id)?.name ?? id;
  }
  return value;
}

function customBackgroundSource(content: ContentBundle, backgroundId: string | null | undefined) {
  return content.backgrounds.find((background) => background.id === backgroundId && !isCustomBackground(background.id)) ?? null;
}

function derivedStatTone(baseValue: number, currentValue: number): DerivedStatTone {
  return currentValue > baseValue ? "boosted" : "neutral";
}

function normalizeEquipmentName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function inventoryHasArmorName(inventory: string[], armor: ContentBundle["armors"][number]) {
  const inventoryNames = new Set(inventory.map(normalizeEquipmentName));
  return [armor.name, ...armor.aliases].some((name) => inventoryNames.has(normalizeEquipmentName(name)));
}




function deriveMovementStats(
  derived: DerivedCharacter,
  armorSpeedPenalty = 0,
  inactiveUnarmoredBonus = 0,
): { walkingSpeed: DerivedStatDisplay; extraMovementModes: DerivedStatDisplay[] } {
  const walk = derived.speeds.find((speed) => speed.mode === "walk");
  const baseWalk = Number.parseInt(walk?.breakdown[0]?.match(/(\d+) ft\./)?.[1] ?? "", 10) || walk?.value || 30;
  const currentWalk = Math.max(0, (walk?.value ?? baseWalk) - armorSpeedPenalty - inactiveUnarmoredBonus);

  const walkingSpeed: DerivedStatDisplay = {
    id: "walking-speed",
    label: "Walking Speed",
    displayValue: formatFeet(currentWalk),
    baseValue: baseWalk,
    currentValue: currentWalk,
    bonusValue: currentWalk - baseWalk,
    tone: derivedStatTone(baseWalk, currentWalk),
    breakdown: [
      ...(walk?.breakdown ?? []),
      ...(armorSpeedPenalty ? [`Heavy armor without enough STR: -${armorSpeedPenalty} ft.`] : []),
      ...(inactiveUnarmoredBonus ? [`Wearing armor or a shield: -${inactiveUnarmoredBonus} ft. (Unarmored Movement off)`] : []),
    ],
  };

  return {
    walkingSpeed,
    extraMovementModes: derived.speeds
      .filter((speed) => speed.mode !== "walk" && speed.value > 0)
      .map((speed) => ({
        id: `${speed.mode}-speed`,
        label: `${speed.mode.charAt(0).toUpperCase() + speed.mode.slice(1)} Speed`,
        displayValue: formatFeet(speed.value),
        baseValue: 0,
        currentValue: speed.value,
        bonusValue: speed.value,
        tone: derivedStatTone(0, speed.value),
        breakdown: speed.breakdown,
      })),
  };
}

function deriveArmorClassStat(armorClass: ArmorClassResult): DerivedStatDisplay {
  return {
    id: "armor-class",
    label: "Armor Class",
    displayValue: `${armorClass.value}`,
    baseValue: armorClass.baseline,
    currentValue: armorClass.value,
    bonusValue: armorClass.value - armorClass.baseline,
    tone: derivedStatTone(armorClass.baseline, armorClass.value),
    breakdown: [...armorClass.breakdown, ...armorClass.warnings.map((warning) => `Warning: ${warning}`)],
  };
}

const SPELL_USE_LABELS: Record<DerivedSpell["uses"], string> = {
  at_will: "at will",
  long_rest: "1 / long rest",
  known: "always known",
  list: "spell list",
  ritual: "ritual only",
};

/** Lineage, subclass, invocation, feat vb. kaynaklardan otomatik gelen buyuler (ortak motordan). */
function grantedSpellSources(content: ContentBundle, derived: DerivedCharacter): SpellActionSource[] {
  return uniqueSpellActionSources(
    derived.spells
      .filter((spell) => spell.uses !== "list")
      .map((spell) => {
        const match =
          content.spells.find((entry) => entry.id === spell.spellId) ??
          content.spells.find((entry) => spellMatchesName(entry.name, spell.spellId.replace(/-/g, " ")));
        return match ? { spellId: match.id, sourceLabel: `${spell.source} · ${SPELL_USE_LABELS[spell.uses]}` } : null;
      })
      .filter((entry): entry is SpellActionSource => Boolean(entry)),
  );
}

function isActionableFeatureSummary(summary: string) {
  const normalized = summary.toLowerCase();
  return [
    "as an action",
    "use your action",
    "use an action",
    "bonus action",
    "use a bonus action",
    "reaction",
    "use your reaction",
    "attack roll",
    "spell attack",
    "melee attack",
    "ranged attack",
  ].some((pattern) => normalized.includes(pattern));
}

function buildFeatureActions(features: BuiltFeature[]): BuiltAction[] {
  return features
    .filter((feature) => feature.kind !== "Background" && isActionableFeatureSummary(feature.summary))
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

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
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

function inventoryHasWeaponName(inventory: string[], weapon: ContentBundle["weapons"][number]) {
  // "10 Darts", "2x Handaxes" gibi adetli kayitlar da silah sayilir.
  const inventoryNames = new Set(
    inventory.flatMap((item) => {
      const bare = item.replace(/^\s*\d+\s*x?\s+/i, "");
      const name = normalizeEquipmentName(bare);
      return [normalizeEquipmentName(item), name, name.replace(/s$/, ""), name.replace(/es$/, "")];
    }),
  );
  return [weapon.name, ...weapon.aliases].some((name) => inventoryNames.has(normalizeEquipmentName(name)));
}

function weaponAbilityModifier(draft: CharacterDraft, weapon: ContentBundle["weapons"][number]) {
  const strength = draft.abilities.find((ability) => ability.id === "STR")?.modifier ?? 0;
  const dexterity = draft.abilities.find((ability) => ability.id === "DEX")?.modifier ?? 0;
  if (weapon.properties.includes("finesse")) {
    return Math.max(strength, dexterity);
  }
  return weapon.attackType === "ranged" ? dexterity : strength;
}

function weaponRange(weapon: ContentBundle["weapons"][number]) {
  if (weapon.range) {
    return weapon.range;
  }

  if (weapon.properties.includes("reach")) {
    return "10 ft.";
  }

  return weapon.attackType === "melee" ? "5 ft." : "-";
}

function weaponDamage(draft: CharacterDraft, weapon: ContentBundle["weapons"][number]) {
  if (!weapon.damage || !weapon.damageType) {
    return "-";
  }

  if (weapon.damage === "1") {
    return `1 ${weapon.damageType}`;
  }

  return `${weapon.damage}${formatSigned(weaponAbilityModifier(draft, weapon))} ${weapon.damageType}`;
}

/** Monk silahi: shortsword, iki elli/heavy olmayan simple melee, ya da Kensei gibi kaynaklarin ekledigi silahlar. */
function isMonkWeapon(weapon: ContentBundle["weapons"][number], extraIds: string[]) {
  return (
    extraIds.includes(weapon.id) ||
    weapon.id === "shortsword" ||
    (weapon.proficiency === "simple" && weapon.attackType === "melee" && !weapon.properties.includes("two-handed") && !weapon.properties.includes("heavy"))
  );
}

function dieAverage(die: string) {
  const match = die.match(/^(\d+)d(\d+)/);
  return match ? (Number(match[1]) * (Number(match[2]) + 1)) / 2 : Number(die) || 0;
}

type MartialArtsContext = { die: string; monkWeapons: string[] } | null;

function inventoryWeaponActions(content: ContentBundle, draft: CharacterDraft, martialArts: MartialArtsContext = null): BuiltAction[] {
  const strength = draft.abilities.find((ability) => ability.id === "STR")?.modifier ?? 0;
  const dexterity = draft.abilities.find((ability) => ability.id === "DEX")?.modifier ?? 0;
  const martialModifier = Math.max(strength, dexterity);
  const weapons = content.weapons.filter((weapon) => weapon.attackType !== "ammunition" && inventoryHasWeaponName(draft.inventory, weapon));
  const unarmed: BuiltAction = martialArts
    ? {
        id: "unarmed-strike",
        name: "Unarmed Strike",
        category: "Attack",
        range: "5 ft.",
        hit: formatSigned(draft.proficiencyBonus + martialModifier),
        damage: `${martialArts.die}${formatSigned(martialModifier)} bludgeoning`,
        notes: "Martial Arts",
        description: "Martial Arts: uses the better of STR or DEX and your Martial Arts die. After you attack with an unarmed strike or monk weapon, you can make one unarmed strike as a bonus action.",
        source: "Martial Arts",
      }
    : {
        id: "unarmed-strike",
        name: "Unarmed Strike",
        category: "Attack",
        range: "5 ft.",
        hit: meleeAttackModifier(draft),
        damage: `${abilityDamage(strength)} bludgeoning`,
        notes: "Melee Attack",
        description: "A basic melee attack using fists, kicks, or body weight.",
        source: "Core Rules",
      };
  const weaponStats = (weapon: ContentBundle["weapons"][number]) => {
    if (!martialArts || !isMonkWeapon(weapon, martialArts.monkWeapons) || !weapon.damage || !weapon.damageType) {
      return { hit: formatSigned(draft.proficiencyBonus + weaponAbilityModifier(draft, weapon)), damage: weaponDamage(draft, weapon), monk: false };
    }
    const modifier = weapon.attackType === "ranged" ? dexterity : Math.max(weaponAbilityModifier(draft, weapon), martialModifier);
    const die = dieAverage(martialArts.die) > dieAverage(weapon.damage) ? martialArts.die : weapon.damage;
    return { hit: formatSigned(draft.proficiencyBonus + modifier), damage: `${die}${formatSigned(modifier)} ${weapon.damageType}`, monk: true };
  };
  return [
    unarmed,
    ...weapons.map((weapon) => ({
      id: `weapon-${weapon.id}`,
      name: weapon.name,
      category: "Attack" as const,
      range: weaponRange(weapon),
      hit: weaponStats(weapon).hit,
      damage: weaponStats(weapon).damage,
      notes: weapon.properties.length ? weapon.properties.map((property) => property.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-")).join(", ") : "-",
      description: `${weaponStats(weapon).monk ? "Monk weapon (Martial Arts). " : ""}${weapon.specialDescription ?? `${weapon.proficiency === "martial" ? "Martial" : "Simple"} ${weapon.attackType} weapon attack.`}`,
      source: "Inventory",
    })),
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

function rangerChoiceFeatures(draft: CharacterDraft): BuiltFeature[] {
  if (draft.classId !== "ranger") {
    return [];
  }

  const rangerChoices = draft.rangerChoices;
  if (!rangerChoices) {
    return [];
  }
  const favoredEnemies = rangerChoices.favoredEnemies ?? [];

  if (rangerChoices.favoredEnemyMode === "foe") {
    const damageDie = draft.level >= 14 ? "1d8" : draft.level >= 6 ? "1d6" : "1d4";
    return [
      {
        id: "ranger-favored-foe-selection",
        name: "Favored Foe",
        kind: "Feature",
        summary: `You use Favored Foe instead of Favored Enemy. You can mark a target ${draft.proficiencyBonus} times per long rest, and your first hit each turn deals an extra ${damageDie} damage while the mark lasts.`,
        source: "Character Draft",
      },
    ];
  }

  const summary = favoredEnemies
    .map((entry) =>
      entry.enemyType === "humanoids"
        ? `Humanoids (${entry.humanoidRaces || "choose two races"}) with ${entry.language || "a chosen language"}`
        : `${entry.enemyType} with ${entry.language || "a chosen language"}`
    )
    .join("; ");

  return summary
    ? [
        {
          id: "ranger-favored-enemy-selection",
          name: "Favored Enemy Choices",
          kind: "Feature",
          summary: `Current favored enemy selections: ${summary}.`,
          source: "Character Draft",
        },
      ]
    : [];
}

function rangerTerrainFeatures(draft: CharacterDraft): BuiltFeature[] {
  if (draft.classId !== "ranger") {
    return [];
  }

  const rangerChoices = draft.rangerChoices;
  if (!rangerChoices) {
    return [];
  }
  const favoredTerrains = rangerChoices.favoredTerrains ?? [];
  const deftLanguages = rangerChoices.deftLanguages ?? [];

  if (rangerChoices.favoredTerrainMode === "deft") {
    const languages = deftLanguages.filter(Boolean).join(", ");
    return [
      {
        id: "ranger-deft-explorer-selection",
        name: "Deft Explorer Choices",
        kind: "Feature",
        summary: `Using Deft Explorer. Canny skill: ${rangerChoices.cannySkillId ?? "none selected"}. Additional languages: ${languages || "none selected"}.`,
        source: "Character Draft",
      },
    ];
  }

  return favoredTerrains.length
    ? [
        {
          id: "ranger-natural-explorer-selection",
          name: "Favored Terrain Choices",
          kind: "Feature",
          summary: `Current favored terrain selections: ${favoredTerrains.join(", ")}.`,
          source: "Character Draft",
        },
      ]
    : [];
}

function rangerAdditionalModeFeatures(draft: CharacterDraft): BuiltFeature[] {
  if (draft.classId !== "ranger" || !draft.rangerChoices) {
    return [];
  }

  const features: BuiltFeature[] = [];

  if (draft.rangerChoices.fightingStyleId) {
    const summary = fightingStyleSummary(draft.rangerChoices.fightingStyleId);
    features.push({
      id: "ranger-fighting-style-selection",
      name: "Fighting Style Choice",
      kind: "Feature",
      summary: summary ?? "Selected fighting style.",
      source: "Character Draft",
    });
  }

  features.push({
    id: "ranger-awareness-selection",
    name: "Awareness Choice",
    kind: "Feature",
    summary: `Using ${draft.rangerChoices.awarenessMode === "primal" ? "Primal Awareness" : "Primeval Awareness"}.`,
    source: "Character Draft",
  });

  features.push({
    id: "ranger-hide-selection",
    name: "Stealth Feature Choice",
    kind: "Feature",
    summary: `Using ${draft.rangerChoices.hideMode === "natures-veil" ? "Nature's Veil" : "Hide in Plain Sight"}.`,
    source: "Character Draft",
  });

  if (draft.selectedSubclassOptions.includes("beast-master-conclave")) {
    const primalFormLabel = (draft.rangerChoices.primalCompanionFormId ?? "beast-of-the-land")
      .replace(/-\d+$/, "")
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    features.push({
      id: "ranger-beast-master-choice",
      name: "Beast Master Companion Choice",
      kind: "Feature",
      summary:
        draft.rangerChoices.beastMasterMode === "primal"
          ? `Using Primal Companion. Selected form: ${primalFormLabel}.`
          : "Using Ranger's Companion.",
      source: "Character Draft",
    });
  }

  return features;
}

function fighterChoiceFeatures(draft: CharacterDraft): BuiltFeature[] {
  if (draft.classId !== "fighter" || !draft.fighterChoices?.fightingStyleId) {
    return [];
  }

  return [
    {
      id: "fighter-fighting-style-selection",
      name: "Fighting Style Choice",
      kind: "Feature",
      summary:
        draft.fighterChoices.fightingStyleId === "superior-technique" && draft.fighterChoices.superiorTechniqueManeuverId
          ? `${fightingStyleSummary(draft.fighterChoices.fightingStyleId) ?? "Selected fighting style."} Selected maneuver: ${draft.fighterChoices.superiorTechniqueManeuverId
              .split("-")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ")}.`
          : fightingStyleSummary(draft.fighterChoices.fightingStyleId) ?? "Selected fighting style.",
      source: "Character Draft",
    },
  ];
}

const fightingStyleDescriptions: Record<string, { name: string; summary: string }> = {
  archery: {
    name: "Archery",
    summary: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
  },
  "blind-fighting": {
    name: "Blind Fighting",
    summary: "You gain blindsight out to 10 feet and can perceive creatures in darkness or invisibility within that range unless they hide successfully.",
  },
  defense: {
    name: "Defense",
    summary: "While you are wearing armor, you gain a +1 bonus to AC.",
  },
  dueling: {
    name: "Dueling",
    summary: "When you wield a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
  },
  "great-weapon-fighting": {
    name: "Great Weapon Fighting",
    summary: "When you roll a 1 or 2 on a damage die for a two-handed or versatile melee weapon attack, you can reroll the die and must use the new roll.",
  },
  interception: {
    name: "Interception",
    summary: "When a creature you can see hits a nearby target, you can use your reaction to reduce the damage by 1d10 + your proficiency bonus.",
  },
  protection: {
    name: "Protection",
    summary: "When a creature you can see attacks a nearby ally, you can use your reaction to impose disadvantage on the attack roll while wielding a shield.",
  },
  "superior-technique": {
    name: "Superior Technique",
    summary: "You learn one Battle Master maneuver and gain one d6 superiority die that refreshes on a short or long rest.",
  },
  "thrown-weapon-fighting": {
    name: "Thrown Weapon Fighting",
    summary: "You can draw a thrown weapon as part of the attack, and thrown weapon hits gain +2 damage.",
  },
  "two-weapon-fighting": {
    name: "Two-Weapon Fighting",
    summary: "You can add your ability modifier to the damage of the second attack when fighting with two weapons.",
  },
  "unarmed-fighting": {
    name: "Unarmed Fighting",
    summary: "Your unarmed strikes deal 1d6 + Strength modifier, or 1d8 if you are not wielding weapons or a shield, and grappled creatures take 1d4 damage at the start of your turn.",
  },
};

function fightingStyleSummary(styleId: string | null | undefined) {
  if (!styleId) {
    return null;
  }

  const entry = fightingStyleDescriptions[styleId];
  if (entry) {
    return `${entry.name}. ${entry.summary}`;
  }

  const fallbackName = styleId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `${fallbackName}. Selected fighting style.`;
}

export function buildSheetContent(content: ContentBundle, draft: CharacterDraft, engine: EngineCatalog) {
  const classCuratedCollection = engine.classes;
  const derived = deriveCharacter(draft, engine);
  const chosenClass = content.classes.find((item) => item.id === draft.classId);
  const chosenSpecies = content.species.find((item) => item.id === draft.speciesId);
  const chosenBackground = content.backgrounds.find(
    (item) => item.id === draft.backgroundId,
  );
  const customFeatureBackground = chosenBackground && isCustomBackground(chosenBackground.id)
    ? customBackgroundSource(content, draft.customBackground?.featureBackgroundId)
    : null;
  const customEquipmentBackground = chosenBackground && isCustomBackground(chosenBackground.id)
    ? customBackgroundSource(content, draft.customBackground?.equipmentBackgroundId)
    : null;
  const customSkillLabels = (draft.customBackground?.skillIds ?? [])
    .map((skillId) => skillId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "));
  const customToolLabels = (draft.customBackground?.proficiencyIds ?? [])
    .filter((entry) => entry.startsWith("tool:"))
    .map((entry) => customBackgroundProficiencyLabel(content, entry));
  const customLanguageLabels = (draft.customBackground?.proficiencyIds ?? [])
    .filter((entry) => entry.startsWith("language:"))
    .map((entry) => customBackgroundProficiencyLabel(content, entry));

  const learnedSpellSources = uniqueSpellActionSources([
    ...draft.spellIds.map((spellId) => ({ spellId, sourceLabel: "Selected Spell" })),
    ...(draft.selectedPactCantripIds ?? []).map((spellId) => ({ spellId, sourceLabel: "Book of Shadows" })),
    ...Object.values(draft.mysticArcanumSelections ?? {})
      .filter((spellId): spellId is string => typeof spellId === "string" && Boolean(spellId))
      .map((spellId) => ({ spellId, sourceLabel: "Mystic Arcanum" })),
    ...grantedSpellSources(content, derived),
  ]);
  const learnedSpells = learnedSpellSources
    .map((entry) => {
      const spell = content.spells.find((item) => item.id === entry.spellId);
      return spell ? { spell, sourceLabel: entry.sourceLabel } : null;
    })
    .filter((entry): entry is { spell: ContentBundle["spells"][number]; sourceLabel: string } => Boolean(entry));
  // Taslakta secilen feat'ler + background gibi kaynaklarin verdigi feat'ler.
  const selectedFeats = content.feats.filter((feat) => derived.featIds.includes(feat.id));
  const selectedSubclassId = draft.selectedSubclassOptions[0] ?? null;
  const currentCuratedClass = classCuratedCollection?.entries.find((entry) => entry.id === draft.classId) ?? null;
  const currentCuratedSubclass =
    selectedSubclassId && currentCuratedClass
      ? currentCuratedClass.subclasses.find((entry) => entry.id === selectedSubclassId) ?? null
      : null;

  const classFeatures =
    chosenClass?.featuresByLevel
      ? Object.entries(chosenClass.featuresByLevel)
          .filter(([level]) => Number(level) <= draft.level)
          .flatMap(([level, features]) =>
            features
              // Tasha optional feature'lari: sadece secilen taraf listelenir (orn. Favored Foe secildiyse Favored Enemy yok).
              .filter((feature) => optionalFeatureActive(feature.id, draft))
              .map((feature) => ({
              id: feature.id,
              name: feature.name,
              kind: "Feature" as const,
              summary: feature.summary,
              source: `${chosenClass.name} level ${level}`,
            })),
          )
      : [];

  const subclassFeatures =
    currentCuratedSubclass?.features
      .filter((feature) => !feature.unlockLevel || feature.unlockLevel <= draft.level)
      .map((feature) => ({
        id: feature.id,
        name: feature.name,
        kind: "Feature" as const,
        summary: feature.summary,
        source: `${currentCuratedSubclass.name}${feature.unlockLevel ? ` level ${feature.unlockLevel}` : ""}`,
      })) ?? [];

  const speciesTraits =
    uniqueFeatures(
      chosenSpecies?.traits.map((trait) => ({
      id: trait.id,
      name: trait.name,
      kind: "Trait" as const,
      summary: trait.summary,
      source: chosenSpecies.name,
      })) ?? [],
    );

  const featFeatures = selectedFeats.map((feat) => {
    const grantedBy = derived.sources.find(
      (source) => source.kind !== "feat" && source.grants.some((grant) => grant.type === "feat" && grant.featId === feat.id),
    );
    return {
      id: feat.id,
      name: feat.name,
      kind: "Feat" as const,
      summary: feat.summary,
      source: grantedBy && !draft.featIds.includes(feat.id) ? `Feat (from ${grantedBy.name})` : "Feat",
    };
  });

  // Invocation ve Pact Boon gibi secilen opsiyonlar (eskiden sheet'te hic gorunmuyordu).
  const optionFeatures = derived.sources
    .filter((source) => source.showAsFeature)
    .map((source) => ({
      id: `${source.kind}-${source.id}`,
      name: source.name,
      kind: "Feature" as const,
      summary: source.summary,
      source: source.kind === "invocation" ? "Eldritch Invocation" : source.kind === "pact-boon" ? "Pact Boon" : source.kind,
    }));

  const manualFeatures = (draft.features ?? []).map((feature) => ({
    id: `draft-feature-${feature.id}`,
    name: feature.name,
    kind:
      feature.kind === "Background"
        ? ("Background" as const)
        : feature.kind === "Trait"
          ? ("Trait" as const)
          : ("Feature" as const),
    summary: feature.summary,
    source: "Character Draft",
  }));

  const builtFeatures = uniqueFeatures(uniqueById<BuiltFeature>([
    ...speciesTraits,
    ...classFeatures,
    ...subclassFeatures,
    ...featFeatures,
    ...optionFeatures,
    ...rangerChoiceFeatures(draft),
    ...rangerTerrainFeatures(draft),
    ...rangerAdditionalModeFeatures(draft),
    ...fighterChoiceFeatures(draft),
    ...manualFeatures,
    ...(chosenBackground
      ? [
          {
            id: chosenBackground.id,
            name: chosenBackground.name,
            kind: "Background" as const,
            summary: customFeatureBackground
              ? `${customFeatureBackground.name} feature. ${customFeatureBackground.summary}`
              : chosenBackground.summary,
            source: "Background",
          },
        ]
      : []),
  ]));

  // Buyu yapma: yetenek, save DC, attack bonusu, slotlar (class data'sindan).
  const abilityModifiers = Object.fromEntries(draft.abilities.map((ability) => [ability.id, ability.modifier])) as Record<AbilityId, number>;
  const spellcasting = spellcastingProfiles(
    {
      classId: draft.classId,
      subclassId: draft.selectedSubclassOptions[0] ?? null,
      level: draft.level,
      proficiencyBonus: draft.proficiencyBonus,
      modifiers: abilityModifiers,
    },
    classCuratedCollection,
  );
  const grantedSpellAbility = new Map(derived.spells.filter((spell) => spell.ability).map((spell) => [spell.spellId, spell.ability as AbilityId]));
  const castingFor = (spellId: string): SpellcastingProfile | null => {
    const ability = grantedSpellAbility.get(spellId);
    const base = spellcasting.at(0) ?? null;
    if (!ability) {
      return base;
    }
    const modifier = abilityModifiers[ability] ?? 0;
    return {
      sourceName: base?.sourceName ?? "Innate",
      ability,
      modifier,
      saveDc: 8 + draft.proficiencyBonus + modifier,
      attackBonus: draft.proficiencyBonus + modifier,
      slots: [],
    };
  };
  const tier = cantripTier(draft.level);
  const hasAgonizingBlast = derived.sources.some((source) => source.kind === "invocation" && source.id === "agonizing-blast");
  const spellHit = (spell: ContentBundle["spells"][number]) => {
    const casting = castingFor(spell.id);
    const parsed = parseHitFromText(spell.summary);
    if (!casting) {
      return parsed;
    }
    if (parsed.endsWith(" save")) {
      return `DC ${casting.saveDc} ${parsed.replace(" save", "")}`;
    }
    if (parsed === "Spell attack" || /spell attack/i.test(spell.summary)) {
      return formatSigned(casting.attackBonus);
    }
    return "-";
  };
  const spellDamage = (spell: ContentBundle["spells"][number]) => {
    const parsed = parseDamageFromText(spell.summary);
    // "1d8 + your spellcasting ability modifier" (Cure Wounds, Healing Word) -> "1d8+3".
    const casting = castingFor(spell.id);
    const base = /\+\s*your$/i.test(parsed) && casting ? `${parsed.replace(/\s*\+\s*your$/i, "")}${formatSigned(casting.modifier)}` : parsed;
    if (spell.level !== 0 || base === "-") {
      return base;
    }
    if (spell.id === "eldritch-blast") {
      // Eldritch Blast zarlari degil isin sayisini arttirir; Agonizing Blast her isina CHA ekler.
      const charisma = abilityModifiers.CHA ?? 0;
      const perBeam = hasAgonizingBlast && charisma ? `1d10${formatSigned(charisma)} force` : "1d10 force";
      return tier > 1 ? `${tier} beams × ${perBeam}` : perBeam;
    }
    return scaleCantripDamage(base, tier);
  };

  const armorClass = computeArmorClass({
    armors: content.armors,
    inventory: draft.inventory,
    itemState: draft.itemState,
    modifiers: abilityModifiers,
    strengthScore: draft.abilities.find((ability) => ability.id === "STR")?.score ?? 10,
    armorProficiencies: draft.proficiencies?.armor ?? [],
    derived,
    mageArmorActive: (draft.activeEffects ?? []).includes("mage-armor") && mageArmorAvailable(derived, draft.spellIds),
  });
  // Martial Arts sadece zirh ve kalkan yokken.
  const martialArts: MartialArtsContext =
    derived.martialArts && armorClass.unarmored ? { die: derived.martialArts.die, monkWeapons: derived.monkWeapons } : null;
  const saveDcs = derived.saveDcs.map((entry) => ({
    ...entry,
    value: 8 + draft.proficiencyBonus + (abilityModifiers[entry.ability] ?? 0),
  }));

  const builtActions = uniqueById<BuiltAction>([
    ...inventoryWeaponActions(content, draft, martialArts),
    ...learnedSpells.map(({ spell, sourceLabel }) => ({
      id: `${spell.id}-${sourceLabel}`,
      name: spell.name,
      category: spellCategory(spell.castingTime),
      range: spell.range,
      hit: spellHit(spell),
      damage: spellDamage(spell),
      notes: `${spell.school} | ${spell.duration}${spell.classes?.length ? ` | ${spell.classes.join(", ")}` : ""}`,
      description: spell.summary,
      source: sourceLabel,
      classes: spell.classes ?? [],
    })),
    ...buildFeatureActions(builtFeatures),
  ]);

  const movementStats = deriveMovementStats(derived, armorClass.speedPenalty, armorClass.unarmored ? 0 : derived.unarmoredSpeedBonus);
  const armorClassStat = deriveArmorClassStat(armorClass);

  return {
    className: chosenClass?.name ?? draft.classLine,
    speciesName: chosenSpecies?.name ?? draft.ancestry,
    backgroundName: chosenBackground?.name ?? "Unknown Background",
    backgroundSummary: customFeatureBackground
      ? `${customFeatureBackground.name} feature. ${customFeatureBackground.summary}`
      : chosenBackground?.summary ?? draft.background,
    backgroundSkillProficiencies: customFeatureBackground
      ? customSkillLabels.join(", ")
      : chosenBackground?.skillProficiencies.join(", ") ?? "",
    backgroundToolProficiencies: customFeatureBackground
      ? customToolLabels.join(", ")
      : chosenBackground ? backgroundToolSummary(content, chosenBackground, draft.backgroundToolChoiceIds ?? {}).join(", ") : "",
    backgroundLanguages: customFeatureBackground
      ? customLanguageLabels.join(", ")
      : chosenBackground ? backgroundLanguageSummary(content, chosenBackground).join(", ") : "",
    backgroundEquipment: customEquipmentBackground
      ? draft.customBackground?.equipmentMode === "coin"
        ? "Spend coin on gear"
        : customEquipmentBackground.name
      : "",
    learnedSpells: uniqueById(learnedSpells.map((entry) => entry.spell)),
    builtActions,
    builtFeatures,
    spellcasting,
    saveDcs,
    martialArtsDie: derived.martialArts?.die ?? null,
    mageArmorAvailable: mageArmorAvailable(derived, draft.spellIds),
    // Spells sekmesi icin: level'a gore siralanmis, kaynagi ve DC/attack'i hazir buyu listesi.
    spellEntries: learnedSpells
      .map(({ spell, sourceLabel }) => ({
        id: `${spell.id}-${sourceLabel}`,
        spellId: spell.id,
        name: spell.name,
        level: spell.level,
        school: spell.school,
        castingTime: spell.castingTime,
        range: spell.range,
        duration: spell.duration,
        concentration: /concentration/i.test(spell.duration),
        ritual: /ritual/i.test(spell.subtitle ?? "") || (spell.tags ?? []).includes("Ritual"),
        source: sourceLabel,
        hit: spellHit(spell),
        damage: spellDamage(spell),
        summary: spell.summary,
      }))
      .sort((left, right) => left.level - right.level || left.name.localeCompare(right.name)),
    // Kisa / uzun dinlenmede yenilenen kaynaklar (Second Wind, Bardic Inspiration...).
    resources: derived.resources.map((resource) => ({
      ...resource,
      total: resolveResourceUses(resource.uses, {
        level: draft.level,
        proficiencyBonus: draft.proficiencyBonus,
        modifiers: abilityModifiers,
      }),
    })),
    derivedStats: {
      walkingSpeed: movementStats.walkingSpeed,
      extraMovementModes: movementStats.extraMovementModes,
      armorClass: armorClassStat,
    },
  };
}
