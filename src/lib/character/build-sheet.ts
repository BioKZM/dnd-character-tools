import type { CharacterDraft } from "@/lib/character/demo-sheet";
import type { ContentBundle } from "@/lib/content/schema";
import type { ClassDocCollection, ClassDocSpellGrant, ClassDocTable } from "@/lib/content/class-docs";
import type { ClassCuratedCollection } from "@/lib/content/class-curated-schema";

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function subclassMatchSlug(value: string) {
  return slugify(
    value
      .replace(/\b(conclave|archetype|college|domain|circle|oath|tradition|path|spells)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function spellGrantsFromDocTables(tables: ClassDocTable[]) {
  return tables.flatMap((table) =>
    table.rows
      .map((row) => {
        const levelMatch = row[0]?.match(/(\d+)/);
        if (!levelMatch || row.length < 2) {
          return null;
        }

        const spells = row
          .slice(1)
          .flatMap((cell) => cell.split(/,\s*/))
          .map((entry) => entry.trim())
          .filter(Boolean)
          .filter((entry) => entry !== "-");

        if (!spells.length) {
          return null;
        }

        return {
          unlockLevel: Number(levelMatch[1]),
          spells,
        } satisfies ClassDocSpellGrant;
      })
      .filter((entry): entry is ClassDocSpellGrant => Boolean(entry)),
  );
}

function uniqueSpellGrants(items: ClassDocSpellGrant[]) {
  return items.filter(
    (item, index, collection) =>
      collection.findIndex(
        (entry) =>
          entry.unlockLevel === item.unlockLevel &&
          entry.spells.join("|").toLowerCase() === item.spells.join("|").toLowerCase(),
      ) === index,
  );
}

function spellMatchesName(spellName: string, targetName: string) {
  return spellName.trim().toLowerCase() === targetName.trim().toLowerCase();
}

function autoAddedSpellSources(
  content: ContentBundle,
  draft: CharacterDraft,
  classDocs?: ClassDocCollection,
  classCuratedCollection?: ClassCuratedCollection,
) {
  const results: SpellActionSource[] = [];
  const selectedSubclassId = draft.selectedSubclassOptions[0] ?? null;
  const currentDocClass = draft.classId ? classDocs?.[draft.classId] : undefined;
  const currentDocSubclass =
    selectedSubclassId && currentDocClass
      ? currentDocClass.subclasses.find(
          (entry) =>
            entry.id === selectedSubclassId ||
            slugify(entry.name) === selectedSubclassId ||
            subclassMatchSlug(entry.name) === selectedSubclassId,
        ) ?? null
      : null;

  if (draft.classId === "warlock" && selectedSubclassId && classCuratedCollection) {
    const currentCuratedClass = classCuratedCollection.entries.find((entry) => entry.id === "warlock") ?? null;
    const currentCuratedSubclass = currentCuratedClass?.subclasses.find((entry) => entry.id === selectedSubclassId) ?? null;
    const grants = (currentCuratedSubclass?.expandedSpells ?? []).filter((entry) => draft.level >= entry.unlockLevel);
    grants.forEach((grant) => {
      grant.spells.forEach((spellName) => {
        const spell = content.spells.find((entry) => spellMatchesName(entry.name, spellName));
        if (spell) {
          results.push({ spellId: spell.id, sourceLabel: "Auto Added from Pact Magic" });
        }
      });
    });
  }

  if (draft.classId === "ranger" && currentDocClass) {
    const subclassGrants = uniqueSpellGrants([
      ...(currentDocSubclass?.grantedSpells ?? []),
      ...spellGrantsFromDocTables(currentDocSubclass?.sections.flatMap((section) => section.tables) ?? []),
    ]).filter((entry) => draft.level >= entry.unlockLevel);

    subclassGrants.forEach((grant) => {
      grant.spells.forEach((spellName) => {
        const spell = content.spells.find((entry) => spellMatchesName(entry.name, spellName));
        if (spell) {
          results.push({ spellId: spell.id, sourceLabel: "Auto Added from subclass magic" });
        }
      });
    });

    if (draft.rangerChoices?.awarenessMode === "primal") {
      const primalAwarenessGrants = uniqueSpellGrants([
        ...(currentDocClass.baseGrantedSpells ?? []),
        ...spellGrantsFromDocTables(
          currentDocClass.baseSectionEntries["primal-awareness"]?.tables ??
            currentDocClass.baseSectionEntries["primeval-awareness"]?.tables ??
            [],
        ),
      ]).filter((entry) => draft.level >= entry.unlockLevel);

      primalAwarenessGrants.forEach((grant) => {
        grant.spells.forEach((spellName) => {
          const spell = content.spells.find((entry) => spellMatchesName(entry.name, spellName));
          if (spell) {
            results.push({ spellId: spell.id, sourceLabel: "Auto Added from Primal Awareness" });
          }
        });
      });
    }
  }

  return uniqueSpellActionSources(results);
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
    .filter((feature) => feature.kind === "Feature" && isActionableFeatureSummary(feature.summary))
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
      summary: fightingStyleSummary(draft.fighterChoices.fightingStyleId) ?? "Selected fighting style.",
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

export function buildSheetContent(
  content: ContentBundle,
  draft: CharacterDraft,
  classDocs?: ClassDocCollection,
  classCuratedCollection?: ClassCuratedCollection,
) {
  const chosenClass = content.classes.find((item) => item.id === draft.classId);
  const chosenSpecies = content.species.find((item) => item.id === draft.speciesId);
  const chosenBackground = content.backgrounds.find(
    (item) => item.id === draft.backgroundId,
  );

  const learnedSpellSources = uniqueSpellActionSources([
    ...draft.spellIds.map((spellId) => ({ spellId, sourceLabel: "Selected Spell" })),
    ...(draft.selectedPactCantripIds ?? []).map((spellId) => ({ spellId, sourceLabel: "Book of Shadows" })),
    ...Object.values(draft.mysticArcanumSelections ?? {})
      .filter((spellId): spellId is string => typeof spellId === "string" && Boolean(spellId))
      .map((spellId) => ({ spellId, sourceLabel: "Mystic Arcanum" })),
    ...autoAddedSpellSources(content, draft, classDocs, classCuratedCollection),
  ]);
  const learnedSpells = learnedSpellSources
    .map((entry) => {
      const spell = content.spells.find((item) => item.id === entry.spellId);
      return spell ? { spell, sourceLabel: entry.sourceLabel } : null;
    })
    .filter((entry): entry is { spell: ContentBundle["spells"][number]; sourceLabel: string } => Boolean(entry));
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
    uniqueFeatures(
      chosenSpecies?.traits.map((trait) => ({
      id: trait.id,
      name: trait.name,
      kind: "Trait" as const,
      summary: trait.summary,
      source: chosenSpecies.name,
      })) ?? [],
    );

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
    ...featFeatures,
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
            summary: chosenBackground.summary,
            source: "Background",
          },
        ]
      : []),
  ]));

  const builtActions = uniqueById<BuiltAction>([
    ...learnedSpells.map(({ spell, sourceLabel }) => ({
      id: `${spell.id}-${sourceLabel}`,
      name: spell.name,
      category: spellCategory(spell.castingTime),
      range: spell.range,
      hit: parseHitFromText(spell.summary) === "-" && spell.level === 0 ? estimatedAttackBonus(draft) : parseHitFromText(spell.summary),
      damage: parseDamageFromText(spell.summary),
      notes: `${spell.school} | ${spell.duration}${spell.classes?.length ? ` | ${spell.classes.join(", ")}` : ""}`,
      description: spell.summary,
      source: sourceLabel,
      classes: spell.classes ?? [],
    })),
    ...buildFeatureActions([
      ...featFeatures,
      ...rangerChoiceFeatures(draft),
      ...rangerTerrainFeatures(draft),
      ...rangerAdditionalModeFeatures(draft),
      ...fighterChoiceFeatures(draft),
      ...manualFeatures,
    ]),
  ]);

  return {
    className: chosenClass?.name ?? draft.classLine,
    speciesName: chosenSpecies?.name ?? draft.ancestry,
    backgroundName: chosenBackground?.name ?? "Unknown Background",
    backgroundSummary: chosenBackground?.summary ?? draft.background,
    backgroundSkillProficiencies: chosenBackground?.skillProficiencies ?? "",
    backgroundToolProficiencies: chosenBackground?.toolProficiencies ?? "",
    backgroundLanguages: chosenBackground?.languages ?? "",
    learnedSpells: uniqueById(learnedSpells.map((entry) => entry.spell)),
    builtActions,
    builtFeatures,
  };
}
