"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CreatorWorkspace } from "@/components/creator-workspace";
import { ClassPortrait } from "@/components/ui/class-portrait";
import { AppIcon } from "@/components/ui/app-icon";
import { buildSheetContent } from "@/lib/character/build-sheet";
import { demoCharacter, type CharacterDraft, type AbilityId } from "@/lib/character/demo-sheet";
import {
  parseWarlockInvocationSummary,
  warlockInvocationMeetsPrerequisite,
} from "@/lib/character/warlock-invocations";
import type { ClassCuratedCollection, ResolvedClassCuratedEntry } from "@/lib/content/class-curated-schema";
import type { WarlockOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { RawBookManifest } from "@/lib/content/raw-books";
type LocalActivity = {
  id: string;
  actorName: string;
  message: string;
  createdAt: string;
};

type DetailState = {
  title: string;
  body: string;
  meta?: string;
};

type InfoTab = "actions" | "inventory" | "features" | "background" | "notes";
type CreatorStep = 0 | 1 | 2;
type ActivityFilter = "all" | "rolls" | "system";

const abilityLabels: Record<AbilityId, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const skillAbilities: Record<string, AbilityId> = {
  acrobatics: "DEX",
  "animal-handling": "WIS",
  arcana: "INT",
  athletics: "STR",
  deception: "CHA",
  history: "INT",
  insight: "WIS",
  intimidation: "CHA",
  investigation: "INT",
  medicine: "WIS",
  nature: "INT",
  perception: "WIS",
  performance: "CHA",
  persuasion: "CHA",
  religion: "INT",
  "sleight-of-hand": "DEX",
  stealth: "DEX",
  survival: "WIS",
};

const skillDescriptions: Record<string, string> = {
  acrobatics: "Balance, flips, and keeping your footing in unstable situations.",
  arcana: "Lore about spells, magical traditions, planes, and strange effects.",
  history: "Recall wars, noble lines, kingdoms, ancient events, and legends.",
  insight: "Read motives, emotions, lies, and hesitation.",
  investigation: "Piece together clues, hidden compartments, and mechanical logic.",
  perception: "Notice movement, sound, hidden threats, and fine visual detail.",
  persuasion: "Influence with calm words, confidence, and diplomacy.",
  stealth: "Move quietly, stay hidden, and avoid attention.",
  athletics: "Climb, jump, shove, grapple, and test raw physical force.",
  intimidation: "Pressure or frighten others with presence and threat.",
  "animal-handling": "Calm, direct, and read beasts and mounts.",
  medicine: "Stabilize injuries and understand wounds or illness.",
  religion: "Know gods, rites, symbols, and sacred histories.",
};

const defaultSkillOrder = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
] as const;

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function proficiencyBonusForLevel(level: number) {
  return Math.floor((level - 1) / 4) + 2;
}

function rollDice(formula: string) {
  const normalized = formula.trim().toLowerCase();
  const match = normalized.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) {
    return Math.ceil(Math.random() * 20);
  }

  const [, diceCountRaw, dieSizeRaw, modifierRaw] = match;
  const diceCount = Number(diceCountRaw);
  const dieSize = Number(dieSizeRaw);
  const modifier = Number(modifierRaw ?? 0);

  let total = modifier;
  for (let index = 0; index < diceCount; index += 1) {
    total += Math.ceil(Math.random() * dieSize);
  }

  return total;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function skillLabel(skillId: string) {
  return skillId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderInlineHelp(label: string, content: string) {
  return (
    <span className="inline-help" aria-label={`${label} info`} tabIndex={0}>
      ?
      <span className="inline-help-tooltip sheet-inline-tooltip">{content}</span>
    </span>
  );
}

const skillNameToId = Object.fromEntries(
  Object.keys(skillAbilities).map((skillId) => [skillLabel(skillId).toLowerCase(), skillId]),
) as Record<string, string>;

function parseCommaList(value?: string) {
  if (!value) {
    return [];
  }

  return unique(
    value
      .split(/[;,/]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseBackgroundSkills(value?: string) {
  return parseCommaList(value)
    .map((item) => skillNameToId[item.toLowerCase()])
    .filter(Boolean);
}

function raceFeatMatchesSpecies(prerequisite: string | undefined, speciesName: string) {
  if (!prerequisite) {
    return false;
  }

  const normalizedPrerequisite = prerequisite.toLowerCase();
  const normalizedSpecies = speciesName.toLowerCase();
  const speciesParts = normalizedSpecies.split(/[\s()-]+/).filter(Boolean);

  return speciesParts.some((part) => part.length > 2 && normalizedPrerequisite.includes(part));
}

function classMatchesSpell(spell: ContentBundle["spells"][number], className: string) {
  return spell.classes?.includes(className) ?? false;
}

function maxSpellLevelForClass(classId: string, level: number) {
  const fullCasterLevels = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9];
  const halfCasterLevels = [0, 0, 0, 0, 0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5];
  const thirdCasterLevels = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4];
  const warlockLevels = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
  const normalizedLevel = Math.max(1, Math.min(20, level));

  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(classId)) {
    return fullCasterLevels[normalizedLevel - 1];
  }
  if (["paladin", "ranger", "artificer"].includes(classId)) {
    return halfCasterLevels[normalizedLevel - 1];
  }
  if (["eldritch-knight", "arcane-trickster", "fighter", "rogue"].includes(classId)) {
    return thirdCasterLevels[normalizedLevel - 1];
  }
  if (classId === "warlock") {
    return warlockLevels[normalizedLevel - 1];
  }
  return 0;
}

function proficiencyTooltip(label: string, values: string[]) {
  const current = values.length ? values.join(", ") : "None";
  const descriptions: Record<string, string> = {
    Armor: "Armor proficiencies determine which armor types you can wear effectively without losing key combat benefits.",
    Weapons: "Weapon proficiencies determine which weapons you can use with training-based accuracy and related features.",
    Tools: "Tool proficiencies cover crafted kits, instruments, artisan tools, or utility equipment tied to checks and downtime.",
    Languages: "Languages determine which spoken and written tongues your character can understand, read, or speak.",
  };

  return `${descriptions[label] ?? ""} Current: ${current}`;
}

function currentInvocationLimit(curatedClass: ResolvedClassCuratedEntry | null, level: number) {
  if (!curatedClass || curatedClass.id !== "warlock") {
    return 0;
  }

  const rows = curatedClass.spellcastingTable.rows;
  const header = rows[1] ?? [];
  const levelRow = rows.find((row) => row[0] === levelOrdinal(level));
  if (!levelRow) {
    return 0;
  }

  const columnIndex = header.findIndex((cell) => cell === "Invocations Known");
  if (columnIndex < 0) {
    return 0;
  }

  const value = levelRow[columnIndex] ?? "0";
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : 0;
}

function activityKind(message: string): ActivityFilter {
  const normalized = message.toLowerCase();
  if (normalized.includes("rolled")) {
    return "rolls";
  }
  return "system";
}

function activityRollTotal(message: string) {
  const match = message.match(/rolled\s+(-?\d+)/i);
  return match ? Number(match[1]) : null;
}

function activityTone(message: string) {
  const kind = activityKind(message);
  if (kind !== "rolls") {
    return "system";
  }

  const total = activityRollTotal(message);
  if (total === null) {
    return "rolls";
  }
  if (total >= 15) {
    return "success";
  }
  if (total <= 9) {
    return "danger";
  }
  return "rolls";
}

function levelOrdinal(level: number) {
  if (level % 100 >= 11 && level % 100 <= 13) {
    return `${level}th`;
  }

  switch (level % 10) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
}

function deriveSpellSelectionRules(
  curatedClass: ResolvedClassCuratedEntry | null,
  level: number,
) {
  const fallbackMaxLevel = maxSpellLevelForClass(curatedClass?.id ?? "", level);
  const emptyResult = {
    maxSpellLevel: fallbackMaxLevel,
    cantripLimit: Infinity,
    totalKnownLimit: Infinity,
    perLevelLimits: {} as Record<number, number>,
  };

  if (!curatedClass?.spellcastingTable.rows.length) {
    return emptyResult;
  }

  const rows = curatedClass.spellcastingTable.rows;
  const headerRow = rows[1] ?? [];
  const currentRow = rows.find((row) => row[0] === levelOrdinal(level));
  if (!headerRow.length || !currentRow) {
    return emptyResult;
  }

  const readCell = (header: string) => {
    const index = headerRow.findIndex((cell) => cell === header);
    return index >= 0 ? currentRow[index] ?? "" : "";
  };
  const numericValue = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const cantripLimit = numericValue(readCell("Cantrips Known")) || Infinity;
  const totalKnownLimit = numericValue(readCell("Spells Known")) || Infinity;
  const slotLevelRaw = readCell("Slot Level");
  const warlockMaxLevel = slotLevelRaw ? numericValue(slotLevelRaw.replace(/\D/g, "")) : 0;
  const perLevelLimits: Record<number, number> = {};

  for (let spellLevel = 1; spellLevel <= 9; spellLevel += 1) {
    const ordinal = levelOrdinal(spellLevel);
    const slotCount = numericValue(readCell(ordinal));
    if (slotCount > 0) {
      perLevelLimits[spellLevel] = slotCount;
    }
  }

  if (!Object.keys(perLevelLimits).length && warlockMaxLevel > 0) {
    const slotCount = numericValue(readCell("Spell Slots"));
    for (let spellLevel = 1; spellLevel <= warlockMaxLevel; spellLevel += 1) {
      perLevelLimits[spellLevel] = totalKnownLimit === Infinity ? slotCount : totalKnownLimit;
    }
  }

  const maxSpellLevel = Object.keys(perLevelLimits).length
    ? Math.max(...Object.keys(perLevelLimits).map(Number))
    : fallbackMaxLevel;

  return {
    maxSpellLevel,
    cantripLimit,
    totalKnownLimit,
    perLevelLimits,
  };
}

function availableMysticArcanumLevels(level: number) {
  return [6, 7, 8, 9].filter((spellLevel) => {
    const unlockLevel = spellLevel === 6 ? 11 : spellLevel === 7 ? 13 : spellLevel === 8 ? 15 : 17;
    return level >= unlockLevel;
  }) as Array<6 | 7 | 8 | 9>;
}

function buildDraftFromSelection(
  content: ContentBundle,
  creatorOptions: CreatorOptions,
  previous: CharacterDraft,
): CharacterDraft {
  const chosenClass = content.classes.find((item) => item.id === previous.classId) ?? content.classes[0];
  const chosenSpecies =
    content.species.find((item) => item.id === previous.speciesId) ?? content.species[0];
  const chosenBackground =
    content.backgrounds.find((item) => item.id === previous.backgroundId) ?? content.backgrounds[0];
  const classRules = creatorOptions.classOptions[chosenClass.id];
  const speciesRules = creatorOptions.speciesOptions[chosenSpecies.id];
  const backgroundRules = creatorOptions.backgroundOptions[chosenBackground.id];
  const backgroundSkills = parseBackgroundSkills(chosenBackground.skillProficiencies);
  const backgroundTools = parseCommaList(chosenBackground.toolProficiencies);
  const backgroundLanguages = parseCommaList(chosenBackground.languages);
  const classPool = [
    chosenClass.name,
    ...previous.multiclassIds
      .map((classId) => content.classes.find((item) => item.id === classId)?.name)
      .filter((value): value is string => Boolean(value)),
  ];
  const allowedSpellIds = content.spells
    .filter((spell) => {
      const byClass = classPool.some((className) => classMatchesSpell(spell, className));
      const bySubclass = (spell.subclassOptions ?? []).some((option) =>
        previous.selectedSubclassOptions.includes(option),
      );
      return byClass || bySubclass;
    })
    .map((spell) => spell.id);
  const allowedFeatIds = content.feats
    .filter((feat) => !feat.isRacialFeat || raceFeatMatchesSpecies(feat.prerequisite, chosenSpecies.name))
    .map((feat) => feat.id);
  const allowedMysticArcanumLevels = chosenClass.id === "warlock" ? availableMysticArcanumLevels(previous.level) : [];
  const allowedMysticArcanumSpellIds = new Set(
    content.spells
      .filter((spell) => classMatchesSpell(spell, "Warlock") && allowedMysticArcanumLevels.includes(spell.level as 6 | 7 | 8 | 9))
      .map((spell) => spell.id),
  );
  const allowedPactCantripIds = new Set(
    content.spells
      .filter((spell) => spell.level === 0)
      .map((spell) => spell.id),
  );

  const proficiencyBonus = proficiencyBonusForLevel(previous.level);
  const scoreFor = (abilityId: AbilityId) =>
    previous.abilities.find((ability) => ability.id === abilityId)?.score ?? 8;

  const modifiers = {
    STR: abilityModifier(scoreFor("STR")),
    DEX: abilityModifier(scoreFor("DEX")),
    CON: abilityModifier(scoreFor("CON")),
    INT: abilityModifier(scoreFor("INT")),
    WIS: abilityModifier(scoreFor("WIS")),
    CHA: abilityModifier(scoreFor("CHA")),
  };
  const existingSkills = new Map(previous.skills.map((skill) => [skill.id, skill]));

  const maxHp = Math.max(
    chosenClass.hitDie +
      modifiers.CON +
      (previous.level - 1) * (Math.floor(chosenClass.hitDie / 2) + 1 + modifiers.CON),
    1,
  );

  return {
    ...previous,
    ancestry: chosenSpecies.name,
    classLine: `${chosenClass.name} ${previous.level}`,
    background: chosenBackground.summary,
    multiclassIds: previous.multiclassIds.filter((classId) => classId !== chosenClass.id),
    selectedSubclassOptions: previous.selectedSubclassOptions,
    pactBoonId: chosenClass.id === "warlock" ? previous.pactBoonId ?? null : null,
    selectedPactCantripIds:
      chosenClass.id === "warlock" && previous.pactBoonId === "pact-of-the-tome"
        ? (previous.selectedPactCantripIds ?? []).filter((spellId) => allowedPactCantripIds.has(spellId)).slice(0, 3)
        : [],
    selectedInvocationIds: chosenClass.id === "warlock" ? previous.selectedInvocationIds ?? [] : [],
    mysticArcanumSelections:
      chosenClass.id === "warlock"
        ? Object.fromEntries(
            Object.entries(previous.mysticArcanumSelections ?? {}).filter(
              ([level, spellId]) =>
                allowedMysticArcanumLevels.includes(Number(level) as 6 | 7 | 8 | 9) &&
                typeof spellId === "string" &&
                allowedMysticArcanumSpellIds.has(spellId),
            ),
          ) as Partial<Record<6 | 7 | 8 | 9, string>>
        : {},
    spellIds: previous.spellIds.filter((spellId) => allowedSpellIds.includes(spellId)),
    featIds: previous.featIds.filter((featId) => allowedFeatIds.includes(featId)),
    proficiencyBonus,
    initiative: modifiers.DEX,
    armorClass: 12 + modifiers.DEX,
    maxHp,
    currentHp: Math.min(previous.currentHp, maxHp),
    proficiencies: {
      armor: unique([...(classRules?.armor ?? [])]),
      weapons: unique([...(classRules?.weapons ?? [])]),
      tools: unique([
        ...(classRules?.tools ?? []),
        ...(speciesRules?.toolChoices ?? []),
        ...(backgroundRules?.tools ?? []),
        ...backgroundTools,
      ]),
      languages: unique([
        ...(classRules?.languages ?? []),
        ...(speciesRules?.languages ?? []),
        ...(backgroundRules?.languages ?? []),
        ...backgroundLanguages,
      ]),
    },
    flexibleAbilityBonuses: {
      plusTwo: previous.flexibleAbilityBonuses?.plusTwo ?? null,
      plusOne: previous.flexibleAbilityBonuses?.plusOne ?? null,
    },
    abilities: previous.abilities.map((ability) => ({
      ...ability,
      label: abilityLabels[ability.id],
      modifier: abilityModifier(ability.score),
    })),
    savingThrows: (["STR", "DEX", "CON", "INT", "WIS", "CHA"] as AbilityId[]).map((ability) => ({
      ability,
      bonus:
        modifiers[ability] + (chosenClass.savingThrows.includes(ability) ? proficiencyBonus : 0),
      proficient: chosenClass.savingThrows.includes(ability),
      breakdown: chosenClass.savingThrows.includes(ability)
        ? `${abilityLabels[ability]} modifier + class save proficiency.`
        : `${abilityLabels[ability]} modifier only.`,
    })),
    skills: defaultSkillOrder.map((skillId) => {
      const existing = existingSkills.get(skillId);
      const ability = skillAbilities[skillId] ?? existing?.ability ?? "INT";
      const modifier = modifiers[ability];
      const proficient =
        backgroundRules?.skillProficiencies.includes(skillId) ||
        backgroundSkills.includes(skillId) ||
        previous.selectedSkillIds.includes(skillId) ||
        existing?.proficient ||
        false;
      return {
        id: skillId,
        label: existing?.label ?? skillLabel(skillId),
        ability,
        proficient,
        bonus: modifier + (proficient ? proficiencyBonus : 0),
        breakdown: proficient ? `${ability} modifier + proficiency.` : `${ability} modifier.`,
        description: skillDescriptions[skillId] ?? existing?.description ?? "",
      };
    }),
  };
}

function loadInitialDraft(content: ContentBundle, creatorOptions: CreatorOptions) {
  return buildDraftFromSelection(content, creatorOptions, demoCharacter);
}

function readStoredDraft(content: ContentBundle, creatorOptions: CreatorOptions) {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = window.localStorage.getItem("codex-character-draft");
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as CharacterDraft;
    return buildDraftFromSelection(content, creatorOptions, parsed);
  } catch {
    return null;
  }
}

export function PartyRoomDashboard({
  initialBookManifest,
  initialContent,
  initialCreatorOptions,
  initialLineageCollection,
  initialClassCuratedCollection,
  initialWarlockOptions,
  mode = "creator",
}: {
  initialBookManifest: RawBookManifest | null;
  initialContent: ContentBundle;
  initialCreatorOptions: CreatorOptions;
  initialLineageCollection: LineageCollection;
  initialClassCuratedCollection: ClassCuratedCollection;
  initialWarlockOptions: WarlockOptionCollection;
  mode?: "creator" | "sheet";
}) {
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [draft, setDraft] = useState<CharacterDraft>(() => {
    if (typeof window !== "undefined") {
      return readStoredDraft(initialContent, initialCreatorOptions) ?? loadInitialDraft(initialContent, initialCreatorOptions);
    }
    return loadInitialDraft(initialContent, initialCreatorOptions);
  });
  const sheetContent = useMemo(() => buildSheetContent(initialContent, draft), [initialContent, draft]);
  const [bookManifest] = useState<RawBookManifest | null>(initialBookManifest);
  const [currentHp, setCurrentHp] = useState(() => draft.currentHp);
  const [tempHp, setTempHp] = useState(() => draft.tempHp);
  const [activityLog, setActivityLog] = useState<LocalActivity[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [activeTab, setActiveTab] = useState<InfoTab>("actions");
  const [creatorStep, setCreatorStep] = useState<CreatorStep>(0);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detail, setDetail] = useState<DetailState>({
    title: "Action Details",
    body: "Select a sense, skill, action, feature, or condition to see its explanation here.",
    meta: "This panel is the right-hand explanation space from the reference sheet.",
  });
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const pdfImportRef = useRef<HTMLInputElement | null>(null);
  const filteredActivityLog = activityLog.filter((event) =>
    activityFilter === "all" ? true : activityKind(event.message) === activityFilter,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "codex-character-draft",
      JSON.stringify({
        ...draft,
        currentHp,
        tempHp,
      }),
    );
  }, [draft, currentHp, tempHp]);

  const filteredActions = activeTab === "actions" ? sheetContent.builtActions : [];
  const displayedCurrentHp = Math.min(currentHp, draft.maxHp);
  const currentCuratedClass =
    initialClassCuratedCollection.entries.find((entry) => entry.id === draft.classId) ?? null;
  const currentClassRules = initialCreatorOptions.classOptions[draft.classId];
  const currentClass = initialContent.classes.find((item) => item.id === draft.classId) ?? initialContent.classes[0];
  const warlockInvocationLimit = currentInvocationLimit(currentCuratedClass, draft.level);
  const currentSpecies = initialContent.species.find((item) => item.id === draft.speciesId) ?? initialContent.species[0];
  const currentSpeciesRules = initialCreatorOptions.speciesOptions[draft.speciesId];
  const currentBackground =
    initialContent.backgrounds.find((item) => item.id === draft.backgroundId) ?? initialContent.backgrounds[0];
  const multiclassChoices = initialContent.classes.filter((item) => item.id !== draft.classId);
  const spellSelectionRules = deriveSpellSelectionRules(currentCuratedClass, draft.level);
  const maxSpellLevel = spellSelectionRules.maxSpellLevel;
  const availableSubclassOptions = unique(
    initialContent.spells
      .flatMap((spell) => spell.subclassOptions ?? [])
      .filter((option) => option.toLowerCase().includes(currentClass.name.toLowerCase()) || draft.multiclassIds.some((classId) => option.toLowerCase().includes((initialContent.classes.find((item) => item.id === classId)?.name ?? "").toLowerCase()))),
  );
  const availableSpells = initialContent.spells.filter((spell) => {
    const classPool = [currentClass.name, ...draft.multiclassIds
      .map((classId) => initialContent.classes.find((item) => item.id === classId)?.name)
      .filter((value): value is string => Boolean(value))];

    const byClass = classPool.some((className) => classMatchesSpell(spell, className));
    const bySubclass = (spell.subclassOptions ?? []).some((option) =>
      draft.selectedSubclassOptions.includes(option),
    );

    if (!(byClass || bySubclass)) {
      return false;
    }

    if (spell.level === 0) {
      return spellSelectionRules.cantripLimit > 0;
    }

    return (spellSelectionRules.perLevelLimits[spell.level] ?? 0) > 0 && spell.level <= maxSpellLevel;
  });
  useEffect(() => {
    const availableIds = new Set(availableSpells.map((spell) => spell.id));
    const nextSpellIds: string[] = [];
    let cantripCount = 0;
    const perLevelCounts = new Map<number, number>();
    let leveledKnownCount = 0;

    for (const spellId of draft.spellIds) {
      if (!availableIds.has(spellId)) {
        continue;
      }

      const spell = availableSpells.find((entry) => entry.id === spellId);
      if (!spell) {
        continue;
      }

      if (spell.level === 0) {
        if (cantripCount >= spellSelectionRules.cantripLimit) {
          continue;
        }
        cantripCount += 1;
        nextSpellIds.push(spellId);
        continue;
      }

      const currentCount = perLevelCounts.get(spell.level) ?? 0;
      const levelLimit = spellSelectionRules.perLevelLimits[spell.level] ?? 0;
      if (currentCount >= levelLimit) {
        continue;
      }
      if (spellSelectionRules.totalKnownLimit !== Infinity && leveledKnownCount >= spellSelectionRules.totalKnownLimit) {
        continue;
      }

      perLevelCounts.set(spell.level, currentCount + 1);
      leveledKnownCount += 1;
      nextSpellIds.push(spellId);
    }

    if (nextSpellIds.length !== draft.spellIds.length) {
      setDraft((current) => ({
        ...current,
        spellIds: nextSpellIds,
      }));
    }
  }, [availableSpells, draft.spellIds, spellSelectionRules]);
  useEffect(() => {
    if (draft.classId !== "warlock" || !initialWarlockOptions.eldritchInvocations?.options.length) {
      return;
    }

    const eligibleInvocationIds = new Set(
      initialWarlockOptions.eldritchInvocations.options
        .filter((option) =>
          warlockInvocationMeetsPrerequisite(parseWarlockInvocationSummary(option.summary).prerequisite, {
            level: draft.level,
            pactBoonId: draft.pactBoonId,
            spellIds: draft.spellIds,
          }),
        )
        .map((option) => option.id),
    );

    const nextInvocationIds = draft.selectedInvocationIds
      .filter((invocationId) => eligibleInvocationIds.has(invocationId))
      .slice(0, Math.max(warlockInvocationLimit, 0));

    if (nextInvocationIds.length !== draft.selectedInvocationIds.length) {
      setDraft((current) => ({
        ...current,
        selectedInvocationIds: nextInvocationIds,
      }));
    }
  }, [
    draft.classId,
    draft.level,
    draft.pactBoonId,
    draft.selectedInvocationIds,
    draft.spellIds,
    initialWarlockOptions.eldritchInvocations?.options,
    warlockInvocationLimit,
  ]);
  const availableFeats = initialContent.feats.filter((feat) => {
    if (!feat.isRacialFeat) {
      return true;
    }

    return raceFeatMatchesSpecies(feat.prerequisite, currentSpecies.name);
  });
  const backgroundSkillIds = parseBackgroundSkills(currentBackground.skillProficiencies);
  const updateDraft = (updater: (current: CharacterDraft) => CharacterDraft) => {
    setDraft((current) => buildDraftFromSelection(initialContent, initialCreatorOptions, updater(current)));
  };

  const updateAbility = (abilityId: AbilityId, score: number) => {
    updateDraft((current) => ({
      ...current,
      abilities: current.abilities.map((ability) =>
        ability.id === abilityId ? { ...ability, score: Math.max(6, Math.min(15, score)) } : ability,
      ),
    }));
  };

  const toggleInvocationSelection = (invocationId: string) => {
    updateDraft((current) => {
      const existing = current.selectedInvocationIds ?? [];
      if (existing.includes(invocationId)) {
        return {
          ...current,
          selectedInvocationIds: existing.filter((entry) => entry !== invocationId),
        };
      }

      if (current.classId !== "warlock") {
        return current;
      }

      if (warlockInvocationLimit > 0 && existing.length >= warlockInvocationLimit) {
        return current;
      }

      return {
        ...current,
        selectedInvocationIds: [...existing, invocationId],
      };
    });
  };

  const setPactBoon = (pactBoonId: string) => {
    updateDraft((current) => ({
      ...current,
      pactBoonId,
      selectedPactCantripIds: pactBoonId === "pact-of-the-tome" ? current.selectedPactCantripIds ?? [] : [],
    }));
  };

  const togglePactCantripSelection = (spellId: string) => {
    updateDraft((current) => {
      const existing = current.selectedPactCantripIds ?? [];
      if (existing.includes(spellId)) {
        return {
          ...current,
          selectedPactCantripIds: existing.filter((entry) => entry !== spellId),
        };
      }

      if (current.classId !== "warlock" || current.pactBoonId !== "pact-of-the-tome" || existing.length >= 3) {
        return current;
      }

      return {
        ...current,
        selectedPactCantripIds: [...existing, spellId],
      };
    });
  };

  const setMysticArcanumSpell = (spellLevel: 6 | 7 | 8 | 9, spellId: string) => {
    updateDraft((current) => ({
      ...current,
      mysticArcanumSelections: {
        ...(current.mysticArcanumSelections ?? {}),
        [spellLevel]: current.mysticArcanumSelections?.[spellLevel] === spellId ? undefined : spellId,
      },
    }));
  };

  const showDetail = (next: DetailState) => {
    setDetail(next);
    setIsDetailOpen(true);
  };

  const toggleSelection = (key: "spellIds" | "featIds", value: string) => {
    updateDraft((current) => {
      const values = current[key];
      if (key === "spellIds") {
        if (values.includes(value)) {
          return {
            ...current,
            [key]: values.filter((item) => item !== value),
          };
        }

        const selectedSpells = initialContent.spells.filter((spell) => values.includes(spell.id));
        const targetSpell = initialContent.spells.find((spell) => spell.id === value);
        if (!targetSpell) {
          return current;
        }

        if (targetSpell.level === 0) {
          const selectedCantrips = selectedSpells.filter((spell) => spell.level === 0).length;
          if (selectedCantrips >= spellSelectionRules.cantripLimit) {
            return current;
          }
        } else {
          const selectedAtLevel = selectedSpells.filter((spell) => spell.level === targetSpell.level).length;
          const levelLimit = spellSelectionRules.perLevelLimits[targetSpell.level] ?? 0;
          if (selectedAtLevel >= levelLimit) {
            return current;
          }

          if (spellSelectionRules.totalKnownLimit !== Infinity) {
            const selectedLeveled = selectedSpells.filter((spell) => spell.level > 0).length;
            if (selectedLeveled >= spellSelectionRules.totalKnownLimit) {
              return current;
            }
          }
        }
      }

      return {
        ...current,
        [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  };

  const toggleMulticlass = (value: string) => {
    updateDraft((current) => ({
      ...current,
      multiclassIds: current.multiclassIds.includes(value)
        ? current.multiclassIds.filter((item) => item !== value)
        : [...current.multiclassIds, value],
    }));
  };

  const toggleSubclassOption = (value: string) => {
    updateDraft((current) => ({
      ...current,
      selectedSubclassOptions: current.selectedSubclassOptions.includes(value)
        ? current.selectedSubclassOptions.filter((item) => item !== value)
        : [...current.selectedSubclassOptions, value],
    }));
  };

  const toggleSkillSelection = (value: string) => {
    updateDraft((current) => {
      const selected = current.selectedSkillIds;
      if (selected.includes(value)) {
        return {
          ...current,
          selectedSkillIds: selected.filter((item) => item !== value),
        };
      }

      const maxChoices = currentClassRules?.skillChoiceCount || 2;
      if (selected.length >= maxChoices) {
        return {
          ...current,
          selectedSkillIds: [...selected.slice(1), value],
        };
      }

      return {
        ...current,
        selectedSkillIds: [...selected, value],
      };
    });
  };

  const moveCreatorStep = (step: CreatorStep) => {
    setCreatorStep(step);
  };

  const exportSheetPdf = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.print();
  };

  const exportSheetJson = () => {
    if (typeof window === "undefined") {
      return;
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...draft,
            currentHp,
            tempHp,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );

    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.name || "character-sheet"}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const importSheetJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CharacterDraft;
      setDraft(buildDraftFromSelection(initialContent, initialCreatorOptions, parsed));
      setCurrentHp(parsed.currentHp ?? parsed.maxHp ?? draft.maxHp);
      setTempHp(parsed.tempHp ?? 0);
      setActivityLog((current) => [
        {
          id: `json-import-${Date.now()}`,
          actorName: parsed.name || "Imported Character",
          message: `${file.name} imported successfully.`,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    } catch {
      setActivityLog((current) => [
        {
          id: `json-import-error-${Date.now()}`,
          actorName: draft.name,
          message: `${file.name} could not be imported as JSON.`,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    } finally {
      event.target.value = "";
    }
  };

  const importSheetPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "codex-character-pdf-reference",
        JSON.stringify({
          name: file.name,
          size: file.size,
          importedAt: new Date().toISOString(),
        }),
      );
    }

    setActivityLog((current) => [
      {
        id: `pdf-import-${Date.now()}`,
        actorName: draft.name,
        message: `${file.name} attached as PDF reference.`,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);

    event.target.value = "";
  };

  const levelUp = () => {
    updateDraft((current) => ({
      ...current,
      level: Math.min(20, current.level + 1),
    }));
  };

  const broadcastCheck = async (label: string, bonus: number) => {
    const formula = `1d20${bonus >= 0 ? `+${bonus}` : `${bonus}`}`;
    const total = rollDice(formula);
    setActivityLog((current) => [
      {
        id: `${label}-${Date.now()}`,
        actorName: draft.name,
        message: `${label} rolled ${total} (${formula})`,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const applyDamage = (amount: number) => {
    setCurrentHp((value) => Math.max(value - amount, 0));
  };

  const applyHealing = (amount: number) => {
    setCurrentHp((value) => Math.min(value + amount, draft.maxHp));
  };

  if (!isHydrated) {
    return (
      <main className={`sheet-shell mode-${mode}`}>
        <div className="sheet-page">
          <section className="sheet-card">
            <div className="card-heading">
              <h2>Loading Workspace</h2>
              <span>Preparing creator state...</span>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`sheet-shell mode-${mode}`}>
      <div className="sheet-page">
        {mode === "creator" ? (
          <section className="creator-card">
            <CreatorWorkspace
              draft={draft}
              content={initialContent}
              creatorStep={creatorStep}
              moveCreatorStep={moveCreatorStep}
              currentClass={currentClass}
              currentSpecies={currentSpecies}
              currentSpeciesRules={currentSpeciesRules}
              currentBackground={currentBackground}
              lineageCollection={initialLineageCollection}
              classCuratedCollection={initialClassCuratedCollection}
              warlockOptions={initialWarlockOptions}
              currentClassRules={currentClassRules}
              classOptions={initialCreatorOptions.classOptions}
              multiclassChoices={multiclassChoices}
              availableSubclassOptions={availableSubclassOptions}
              availableSpells={availableSpells}
              availableFeats={availableFeats}
              maxSpellLevel={maxSpellLevel}
              backgroundSkillIds={backgroundSkillIds}
              updateDraft={updateDraft}
              updateAbility={updateAbility}
              toggleMulticlass={toggleMulticlass}
              toggleSubclassOption={toggleSubclassOption}
              toggleSelection={toggleSelection}
              toggleSkillSelection={toggleSkillSelection}
              toggleInvocationSelection={toggleInvocationSelection}
              setPactBoon={setPactBoon}
              togglePactCantripSelection={togglePactCantripSelection}
              setMysticArcanumSpell={setMysticArcanumSpell}
            />
          </section>
        ) : null}

        {mode === "sheet" ? (
        <>
        <div className="screen-only">
        <section className="sheet-header">
          <div className="crest-card">
            <ClassPortrait classId={draft.classId} alt={draft.classId} className="sheet-crest-portrait" />
          </div>

          <div className="identity-card">
            <h1>{draft.name}</h1>
            <p>
              {sheetContent.speciesName} {sheetContent.className} | Level {draft.level}
            </p>
          </div>

          <div className="top-actions">
            <div className="top-actions-group">
              <button className="sheet-button secondary" onClick={levelUp}>
                Level Up
              </button>
              <button className="sheet-button secondary">Short Rest</button>
              <button className="sheet-button secondary">Long Rest</button>
            </div>
            <div className="top-actions-divider print-hide" />
            <div className="top-actions-group print-hide">
              <button className="sheet-button secondary" onClick={exportSheetJson}>
                Export JSON
              </button>
              <button className="sheet-button secondary" onClick={() => jsonImportRef.current?.click()}>
                Import JSON
              </button>
              <button className="sheet-button secondary" onClick={() => pdfImportRef.current?.click()}>
                Import PDF
              </button>
              <button className="sheet-button secondary" onClick={exportSheetPdf}>
                Export PDF
              </button>
            </div>
            <input ref={jsonImportRef} type="file" accept="application/json,.json" className="visually-hidden" onChange={importSheetJson} />
            <input ref={pdfImportRef} type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={importSheetPdf} />
          </div>
        </section>

        <section className="top-rack">
          <div className="top-rack-stack">
            <div className="stat-rack stat-rack-primary">
              {draft.abilities.map((ability) => (
                <article className="stat-card" key={ability.id}>
                  <div className="stat-card-top">
                    <span className="stat-label">{ability.label}</span>
                  </div>
                  <div className="stat-card-middle">
                    <button
                      className="stat-roll"
                      onClick={() => void broadcastCheck(`${ability.label} check`, ability.modifier)}
                    >
                      {formatSigned(ability.modifier)}
                    </button>
                  </div>
                  <div className="stat-card-bottom">
                    <span className="stat-score">{ability.score}</span>
                  </div>
                </article>
              ))}
            </div>

            <div className="top-rack-divider" />

            <div className="stat-rack stat-rack-secondary">
              <article className="badge-card badge-card-secondary">
                <span className="stat-label inline-heading">
                  <span>Proficiency</span>
                  {renderInlineHelp(
                    "Proficiency bonus",
                    "Proficiency bonus is added to trained skills, saving throws, attacks, and other checks your character is proficient with.",
                  )}
                </span>
                <strong>{formatSigned(draft.proficiencyBonus)}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label inline-heading">
                  <span>Walking</span>
                  {renderInlineHelp(
                    "Walking speed",
                    "Walking speed shows how far your character can move on foot during a turn under normal conditions.",
                  )}
                </span>
                <strong>{draft.speed}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label inline-heading">
                  <span>Initiative</span>
                  {renderInlineHelp(
                    "Initiative",
                    "Initiative determines your place in combat order when an encounter begins.",
                  )}
                </span>
                <strong>{formatSigned(draft.initiative)}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label inline-heading">
                  <span>Armor Class</span>
                  {renderInlineHelp(
                    "Armor Class",
                    "Armor Class is the number an attack roll must meet or exceed to hit your character.",
                  )}
                </span>
                <strong>{draft.armorClass}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label">Heroic Inspiration</span>
                <strong>{draft.inspiration ? "Ready" : "Empty"}</strong>
              </article>
            </div>
          </div>

          <article className="hp-card">
            <div className="hp-actions">
              <button className="sheet-button success" onClick={() => applyHealing(5)}>
                Heal
              </button>
              <button className="sheet-button danger" onClick={() => applyDamage(5)}>
                Damage
              </button>
              <button className="sheet-button secondary" onClick={() => setTempHp((value) => value + 5)}>
                Temp +5
              </button>
            </div>

            <div className="hp-values">
              <div>
                <span>Current</span>
                <strong>{displayedCurrentHp}</strong>
              </div>
              <div>
                <span>Max</span>
                <strong>{draft.maxHp}</strong>
              </div>
              <div>
                <span>Temp</span>
                <strong>{tempHp}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="sheet-grid">
          <div className="sheet-column left-column">
            <article className="sheet-card">
              <div className="card-heading">
                <h2 className="inline-heading">
                  <span>Saving Throws</span>
                  {renderInlineHelp(
                    "Saving Throws",
                    "Saving throws represent your character resisting harmful effects like spells, traps, poison, fear, or other forced threats.",
                  )}
                </h2>
                <span>System bonuses</span>
              </div>
              <div className="sheet-subcaption">Saving Throw Modifiers</div>
              <div className="save-grid">
                {draft.savingThrows.map((save) => (
                  <button
                    className="save-row interactive"
                    key={save.ability}
                    onClick={() => {
                      showDetail({
                        title: `${save.ability} Saving Throw`,
                        body: save.breakdown,
                        meta: save.proficient ? "Proficient save" : "No proficiency bonus",
                      });
                      void broadcastCheck(`${save.ability} save`, save.bonus);
                    }}
                    >
                    <span className="save-row-main">
                      <span className="save-prof-mark">{save.proficient ? "★" : "○"}</span>
                      <span>{save.ability}</span>
                    </span>
                    <strong>{formatSigned(save.bonus)}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className="sheet-card">
              <div className="card-heading">
                <h2>Senses</h2>
                <span>Click for explanation</span>
              </div>
              <div className="sense-list">
                {draft.senses.map((sense) => (
                  <button
                    className="sense-row interactive"
                    key={sense.id}
                    onClick={() =>
                      showDetail({
                        title: sense.label,
                        body: sense.description,
                        meta: `Current value: ${sense.value}`,
                      })
                    }
                  >
                    <strong>{sense.value}</strong>
                    <span className="inline-heading">
                      <span>{sense.label}</span>
                      {renderInlineHelp(sense.label, `${sense.description} Current value: ${sense.value}.`)}
                    </span>
                  </button>
                ))}
              </div>
            </article>

            <article className="sheet-card">
              <div className="card-heading">
                <h2>Proficiencies & Training</h2>
                <span>Armor, tools, and languages</span>
              </div>
              <div className="training-block">
                <div>
                  <span className="mini-heading inline-heading">
                    <span>Armor</span>
                    {renderInlineHelp("Armor proficiencies", proficiencyTooltip("Armor", draft.proficiencies.armor))}
                  </span>
                  <p>{draft.proficiencies.armor.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading inline-heading">
                    <span>Weapons</span>
                    {renderInlineHelp("Weapon proficiencies", proficiencyTooltip("Weapons", draft.proficiencies.weapons))}
                  </span>
                  <p>{draft.proficiencies.weapons.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading inline-heading">
                    <span>Tools</span>
                    {renderInlineHelp("Tool proficiencies", proficiencyTooltip("Tools", draft.proficiencies.tools))}
                  </span>
                  <p>{draft.proficiencies.tools.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading inline-heading">
                    <span>Languages</span>
                    {renderInlineHelp("Languages", proficiencyTooltip("Languages", draft.proficiencies.languages))}
                  </span>
                  <p>{draft.proficiencies.languages.join(", ")}</p>
                </div>
              </div>
            </article>
          </div>

          <div className="sheet-column middle-column pdf-page-break-before">
            <article className="sheet-card grow-card">
              <div className="card-heading">
                <h2>Skills</h2>
                <span>Click a row for details, hit + to roll</span>
              </div>
              <div className="skill-table-head">
                <span>Prof</span>
                <span>Mod</span>
                <span>Skill</span>
                <span>Bonus</span>
              </div>
              <div className="skill-table">
                {draft.skills.map((skill) => (
                  <div className="skill-row" key={skill.id}>
                    <button
                      className="skill-meta interactive"
                      onClick={() =>
                        showDetail({
                          title: skill.label,
                          body: skill.description,
                          meta: `${skill.ability} | ${skill.breakdown}`,
                        })
                      }
                    >
                      <span className="skill-dot">{skill.proficient ? "★" : "○"}</span>
                      <span className="skill-ability">{skill.ability}</span>
                      <strong className="skill-name">
                        <span>{skill.label}</span>
                        {renderInlineHelp(skill.label, skill.description || skillDescriptions[skill.id] || skill.breakdown)}
                      </strong>
                    </button>
                    <button
                      className="bonus-pill"
                      onClick={() => void broadcastCheck(skill.label, skill.bonus)}
                    >
                      {formatSigned(skill.bonus)}
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="sheet-card">
              <div className="card-heading">
                <h2>Defenses & Conditions</h2>
                <span>Resistances and current effects</span>
              </div>
              <div className="defense-grid">
                <button
                  className="detail-card interactive"
                  onClick={() =>
                    showDetail({
                      title: "Defenses",
                      body: draft.defenses.join(", "),
                      meta: "Resistances, immunities, and passive protections.",
                    })
                  }
                >
                  <span className="mini-heading">Defenses</span>
                  <p>{draft.defenses.join(", ")}</p>
                </button>
                <button
                  className="detail-card interactive"
                  onClick={() =>
                    showDetail({
                      title: "Conditions",
                      body: draft.conditions.join(", "),
                      meta: "Current combat state and ongoing effects.",
                    })
                  }
                >
                  <span className="mini-heading">Conditions</span>
                  <p>{draft.conditions.join(", ")}</p>
                </button>
              </div>
            </article>
          </div>

          <div className="sheet-column right-column">
            <article className="sheet-card tabs-card pdf-page-break-before-soft">
              <div className="tab-strip">
                {(["actions", "inventory", "features", "background", "notes"] as InfoTab[]).map((tab) => (
                  <button
                    className={tab === activeTab ? "tab-button active" : "tab-button"}
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "features" ? "Features & Traits" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {activeTab === "actions" ? (
                <div className="tab-body">
                  <div className="action-header">
                    <span>Actions</span>
                    <span>{sheetContent.learnedSpells.length} spells prepared</span>
                  </div>
                  <div className="action-table">
                    {filteredActions.map((action) => (
                      <button
                        className="action-row interactive"
                        key={action.id}
                        onClick={() =>
                          showDetail({
                            title: action.name,
                            body: action.description,
                            meta: `${action.category} | Range ${action.range} | Hit ${action.hit} | Damage ${action.damage}`,
                          })
                        }
                      >
                        <div>
                          <strong>{action.name}</strong>
                          <span>
                            {action.category} | {action.source}
                          </span>
                        </div>
                        <span>{action.range}</span>
                        <span>{action.hit}</span>
                        <span>{action.damage}</span>
                        <span>{action.notes}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "inventory" ? (
                <div className="tab-body simple-list">
                  {draft.inventory.map((item) => (
                    <button
                      className="list-row interactive"
                      key={item}
                      onClick={() =>
                        showDetail({
                          title: item,
                          body: `${item} is currently equipped or carried by the character.`,
                        })
                      }
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeTab === "features" ? (
                <div className="tab-body simple-list">
                  {sheetContent.builtFeatures.map((feature) => (
                    <button
                      className="list-row interactive"
                      key={feature.id}
                      onClick={() =>
                        showDetail({
                          title: feature.name,
                          body: feature.summary,
                          meta: `${feature.kind} | ${feature.source}`,
                        })
                      }
                    >
                      <strong>{feature.name}</strong>
                      <span>
                        {feature.kind} | {feature.source}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeTab === "background" ? (
                <div className="tab-body prose-block">
                  <div className="list-row">
                    <strong>{sheetContent.backgroundName}</strong>
                    <span>{sheetContent.backgroundSummary}</span>
                  </div>
                  {currentBackground.skillProficiencies ? (
                    <div className="list-row">
                      <strong>Skill Proficiencies</strong>
                      <span>{currentBackground.skillProficiencies}</span>
                    </div>
                  ) : null}
                  {currentBackground.toolProficiencies ? (
                    <div className="list-row">
                      <strong>Tool Proficiencies</strong>
                      <span>{currentBackground.toolProficiencies}</span>
                    </div>
                  ) : null}
                  {currentBackground.languages ? (
                    <div className="list-row">
                      <strong>Languages</strong>
                      <span>{currentBackground.languages}</span>
                    </div>
                  ) : null}
                  <p>{draft.background}</p>
                </div>
              ) : null}

              {activeTab === "notes" ? (
                <div className="tab-body simple-list">
                  {draft.notes.map((note) => (
                    <div className="list-row" key={note}>
                      {note}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

          </div>
        </section>
        <div className={isDetailOpen ? "context-drawer open" : "context-drawer"}>
          <button
            type="button"
            className="context-launcher"
            onClick={() => setIsDetailOpen((current) => !current)}
          >
            <span className="activity-launcher-copy">
              <strong>Context Panel</strong>
              <span>{detail.title}</span>
            </span>
            <span className="activity-launcher-icon">
              <AppIcon name="book" className="summary-icon" />
            </span>
          </button>
          {isDetailOpen ? (
            <article className="sheet-card context-panel">
              <div className="card-heading">
                <h2>{detail.title}</h2>
                <span>Context panel</span>
              </div>
              <p>{detail.body}</p>
              {detail.meta ? <div className="detail-meta">{detail.meta}</div> : null}
            </article>
          ) : null}
        </div>
        <div className={isActivityOpen ? "activity-drawer open" : "activity-drawer"}>
          <button
            type="button"
            className="activity-launcher"
            onClick={() => setIsActivityOpen((current) => !current)}
          >
            <span className="activity-launcher-copy">
              <strong>Recent Activity</strong>
              <span>{activityLog.length ? `${activityLog.length} events` : "Timeline closed"}</span>
            </span>
            <span className="activity-launcher-icon">
              <AppIcon name="scroll" className="summary-icon" />
            </span>
          </button>
          {isActivityOpen ? (
            <article className="sheet-card activity-panel">
              <div className="card-heading">
                <h2>Recent Activity</h2>
                <div className="activity-heading-actions">
                  <span>Local sheet actions</span>
                  <button
                    type="button"
                    className="sheet-button secondary"
                    onClick={() => setActivityLog([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="activity-filters">
                {(["all", "rolls", "system"] as ActivityFilter[]).map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    className={activityFilter === filter ? "activity-filter active" : "activity-filter"}
                    onClick={() => setActivityFilter(filter)}
                  >
                    {filter === "all" ? "All" : filter === "rolls" ? "Rolls" : "System"}
                  </button>
                ))}
              </div>
              <div className="event-log timeline-log">
                {filteredActivityLog.length ? (
                  filteredActivityLog.map((event) => (
                    <article className={`event-row timeline-row tone-${activityTone(event.message)}`} key={event.id}>
                      <span className="timeline-dot" />
                      <div className="timeline-copy">
                        <strong>{event.actorName}</strong>
                        <p>{event.message}</p>
                        <span>{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="empty-log">
                    Checks, quick actions, and local interactions will appear here.
                  </div>
                )}
              </div>
            </article>
          ) : null}
        </div>
        </div>
        <div className="print-only">
          <section className="print-page">
            <section className="sheet-header print-sheet-header">
              <div className="crest-card">
                <ClassPortrait classId={draft.classId} alt={draft.classId} className="sheet-crest-portrait" />
              </div>
              <div className="identity-card">
                <h1>{draft.name}</h1>
                <p>
                  {sheetContent.speciesName} {sheetContent.className} | Level {draft.level}
                </p>
              </div>
            </section>

            <section className="top-rack print-top-rack">
              <div className="stat-rack">
                {draft.abilities.map((ability) => (
                  <article className="stat-card" key={`print-${ability.id}`}>
                    <span className="stat-label">{ability.label}</span>
                    <div className="stat-roll">{formatSigned(ability.modifier)}</div>
                    <span className="stat-score">{ability.score}</span>
                  </article>
                ))}
                <article className="badge-card">
                  <span className="stat-label">Proficiency</span>
                  <strong>{formatSigned(draft.proficiencyBonus)}</strong>
                </article>
                <article className="badge-card">
                  <span className="stat-label">Walking</span>
                  <strong>{draft.speed}</strong>
                </article>
                <article className="badge-card">
                  <span className="stat-label">Armor Class</span>
                  <strong>{draft.armorClass}</strong>
                </article>
              </div>
            </section>

            <section className="print-grid print-grid-page-one">
              <article className="sheet-card">
                <div className="card-heading"><h2>Saving Throws</h2></div>
                <div className="save-grid">
                  {draft.savingThrows.map((save) => (
                    <div className="save-row" key={`print-save-${save.ability}`}>
                      <span>{save.ability}</span>
                      <strong>{formatSigned(save.bonus)}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="sheet-card">
                <div className="card-heading"><h2>Proficiencies & Training</h2></div>
                <div className="training-block">
                  <div><span className="mini-heading">Armor</span><p>{draft.proficiencies.armor.join(", ")}</p></div>
                  <div><span className="mini-heading">Weapons</span><p>{draft.proficiencies.weapons.join(", ")}</p></div>
                  <div><span className="mini-heading">Tools</span><p>{draft.proficiencies.tools.join(", ")}</p></div>
                  <div><span className="mini-heading">Languages</span><p>{draft.proficiencies.languages.join(", ")}</p></div>
                </div>
              </article>

              <article className="sheet-card">
                <div className="card-heading"><h2>Defenses & Conditions</h2></div>
                <div className="defense-grid">
                  <div className="detail-card">
                    <span className="mini-heading">Defenses</span>
                    <p>{draft.defenses.join(", ")}</p>
                  </div>
                  <div className="detail-card">
                    <span className="mini-heading">Conditions</span>
                    <p>{draft.conditions.join(", ")}</p>
                  </div>
                </div>
              </article>
            </section>
          </section>

          <section className="print-page print-page-break">
            <section className="print-grid print-grid-page-two">
              <article className="sheet-card">
                <div className="card-heading"><h2>Skills</h2></div>
                <div className="simple-list">
                  {draft.skills.map((skill) => (
                    <div className="list-row" key={`print-skill-${skill.id}`}>
                      <strong>{skill.label}</strong>
                      <span>{`${skill.ability} | ${formatSigned(skill.bonus)} | ${skill.breakdown}`}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="sheet-card">
                <div className="card-heading"><h2>Actions</h2></div>
                <div className="simple-list">
                  {filteredActions.map((action) => (
                    <div className="list-row" key={`print-action-${action.id}`}>
                      <strong>{action.name}</strong>
                      <span>{`${action.category} | ${action.range} | ${action.hit} | ${action.damage}`}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="sheet-card">
                <div className="card-heading"><h2>Spells</h2></div>
                <div className="simple-list">
                  {sheetContent.learnedSpells.map((spell) => (
                    <div className="list-row" key={`print-spell-${spell.id}`}>
                      <strong>{spell.name}</strong>
                      <span>{`Level ${spell.level} | ${spell.school} | ${spell.castingTime} | ${spell.range}`}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="sheet-card">
                <div className="card-heading"><h2>Features</h2></div>
                <div className="simple-list">
                  {sheetContent.builtFeatures.map((feature) => (
                    <div className="list-row" key={`print-feature-${feature.id}`}>
                      <strong>{feature.name}</strong>
                      <span>{`${feature.kind} | ${feature.source}`}</span>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </section>
        </div>
        </>
        ) : null}
      </div>
    </main>
  );
}
