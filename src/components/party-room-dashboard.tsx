"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { CreatorWorkspace } from "@/components/creator-workspace";
import { ClassPortrait } from "@/components/ui/class-portrait";
import { AppIcon } from "@/components/ui/app-icon";
import { buildSheetContent } from "@/lib/character/build-sheet";
import { getEldritchKnightProgression } from "@/lib/character/eldritch-knight";
import { demoCharacter, type CharacterDraft, type AbilityId, type RangerChoices, type FighterChoices } from "@/lib/character/demo-sheet";
import {
  parseWarlockInvocationSummary,
  warlockInvocationMeetsPrerequisite,
} from "@/lib/character/warlock-invocations";
import type { ClassDocCollection } from "@/lib/content/class-docs";
import type { ClassCuratedCollection, ResolvedClassCuratedEntry } from "@/lib/content/class-curated-schema";
import type { WarlockOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { RawBookManifest } from "@/lib/content/raw-books";
import type { SpellReferenceCollection } from "@/lib/content/spell-reference";
type LocalActivity = {
  id: string;
  actorName: string;
  message: string;
  createdAt: string;
};

type InfoTab = "actions" | "inventory" | "features" | "background";
type CreatorStep = 0 | 1 | 2;
type ActivityFilter = "all" | "rolls" | "system";
type ActionFilter = "all" | "Attack" | "Action" | "Bonus Action" | "Reaction" | "Other";

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

function InlineHelp({
  label,
  content,
  variant = "icon",
  tooltipClassName = "sheet-inline-tooltip",
}: {
  label: string;
  content: ReactNode;
  variant?: "icon" | "keyword";
  tooltipClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleEnter = () => {
    clearCloseTimeout();
    setOpen(true);
  };

  const handleLeave = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 220);
  };

  useEffect(() => () => clearCloseTimeout(), []);

  return (
    <span
      className={`inline-help${variant === "keyword" ? " keyword-help" : ""}${open ? " open" : ""}`}
      aria-label={`${label} info`}
      tabIndex={0}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <span className={variant === "keyword" ? "keyword-help-trigger" : "inline-help-trigger"}>{variant === "keyword" ? label : "?"}</span>
      <div
        className={`inline-help-tooltip ${tooltipClassName}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {content}
      </div>
    </span>
  );
}

function renderInlineHelp(label: string, content: string) {
  return <InlineHelp label={label} content={content} />;
}

function renderKeywordHelp(label: string, content: string) {
  return <InlineHelp label={label} content={content} variant="keyword" />;
}

function classIdFromName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function spellChipTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "cantrip" || normalized.startsWith("level ")) return "accent";
  if (["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"].includes(normalized)) return "neutral";
  if (normalized.includes("damage") || normalized.includes("offensive")) return "danger";
  if (normalized.startsWith("save")) return "accent";
  if (normalized.includes("defensive") || normalized.includes("healing")) return "support";
  if (normalized.includes("reaction") || normalized.includes("concentration")) return "accent";
  if (normalized.includes("heal block") || normalized.includes("crowd control") || normalized.includes("area")) return "utility";
  if (normalized.includes("summon") || normalized.includes("utility") || normalized.includes("sustained")) return "neutral";
  return "neutral";
}

function spellChipIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "cantrip" || normalized.startsWith("level ")) return "spark";
  if (["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"].includes(normalized)) return "book";
  if (normalized.includes("damage") || normalized.includes("offensive")) return "dice";
  if (normalized.startsWith("save")) return "spark";
  if (normalized.includes("defensive") || normalized.includes("heal block")) return "shield";
  if (normalized.includes("healing")) return "spark";
  if (normalized.includes("reaction")) return "skill";
  if (normalized.includes("crowd control") || normalized.includes("utility") || normalized.includes("concentration") || normalized.includes("area")) return "book";
  if (normalized.includes("summon")) return "wand";
  if (normalized.includes("sustained")) return "spark";
  return "spark";
}

function actionTooltipContent(action: (ReturnType<typeof buildSheetContent>)["builtActions"][number]) {
  const metaChips = [
    action.category,
    action.range && action.range !== "-" ? `Range ${action.range}` : null,
    action.hit && action.hit !== "-" ? `Hit / DC ${action.hit}` : null,
    action.damage && action.damage !== "-" ? action.damage : null,
  ].filter((entry): entry is string => Boolean(entry));

  const noteChips = action.notes
    ? action.notes
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return (
    <div className="action-inline-tooltip">
      <div className="action-tooltip-head">
        <strong>{action.name}</strong>
        <span className="action-tooltip-source">{action.source}</span>
      </div>
      {metaChips.length ? (
        <div className="action-tooltip-chip-row">
          {metaChips.map((item) => (
            <span key={`${action.id}-meta-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
              <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <p className="action-tooltip-copy">{action.description}</p>
      {noteChips.length ? (
        <div className="action-tooltip-chip-row secondary">
          {noteChips.map((item) => (
            <span key={`${action.id}-note-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
              <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {action.classes?.length ? (
        <div className="action-tooltip-class-strip">
          {action.classes.map((className) => (
            <span className="action-tooltip-class-chip" key={`${action.id}-${className}`}>
              <ClassPortrait classId={classIdFromName(className)} alt={className} className="action-tooltip-portrait" />
              <span>{className}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function actionHintChips(action: (ReturnType<typeof buildSheetContent>)["builtActions"][number]) {
  return [];
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
  const normalizedTarget = className.toLowerCase().trim();
  return (
    spell.classes?.some((entry) => {
      const normalizedEntry = entry.toLowerCase().trim();
      return (
        normalizedEntry === normalizedTarget ||
        normalizedEntry.replace(/\s*\([^)]*\)\s*/g, "").trim() === normalizedTarget
      );
    }) ?? false
  );
}

function docSubclassMatchSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(conclave|archetype|college|domain|circle|oath|tradition|path|spells)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedDocCell(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function eldritchKnightFlexiblePickAllowance(level: number) {
  let allowance = level >= 3 ? 1 : 0;
  if (level >= 8) allowance += 1;
  if (level >= 14) allowance += 1;
  if (level >= 20) allowance += 1;
  return allowance;
}

function deriveEldritchKnightSpellRules(
  classDocs: ClassDocCollection,
  selectedSubclassOptions: string[],
  level: number,
) {
  if (!selectedSubclassOptions.includes("eldritch-knight")) {
    return null;
  }

  const fighterDocs = classDocs.fighter;
  const eldritchKnightDoc =
    fighterDocs?.subclasses.find((entry) => {
      const slugs = [entry.id, docSubclassMatchSlug(entry.name)];
      return slugs.includes("eldritch-knight");
    }) ?? null;

  const spellcastingSection =
    eldritchKnightDoc?.sections.find((section) => docSubclassMatchSlug(section.name) === "spellcasting") ?? null;
  const spellcastingTable =
    spellcastingSection?.tables.find((table) =>
      ["Fighter Level", "Cantrips Known", "Spells Known"].every((header) =>
        table.headers.some((cell) => normalizedDocCell(cell) === normalizedDocCell(header)),
      ),
    ) ??
    eldritchKnightDoc?.sections
      .flatMap((section) => section.tables)
      .find((table) =>
        ["Fighter Level", "Cantrips Known", "Spells Known"].every((header) =>
          table.headers.some((cell) => normalizedDocCell(cell) === normalizedDocCell(header)),
        ),
      ) ??
    null;

  if (!spellcastingTable) {
    const fallbackRow = getEldritchKnightProgression(level);
    if (!fallbackRow) {
      return null;
    }

    const perLevelLimits: Record<number, number> = {};
    for (const spellLevel of [1, 2, 3, 4] as const) {
      if (fallbackRow.slots[spellLevel] > 0) {
        perLevelLimits[spellLevel] = fallbackRow.spellsKnown;
      }
    }

    return {
      maxSpellLevel: ([4, 3, 2, 1] as const).find((spellLevel) => fallbackRow.slots[spellLevel] > 0) ?? 0,
      cantripLimit: fallbackRow.cantripsKnown,
      totalKnownLimit: fallbackRow.spellsKnown,
      perLevelLimits,
      flexibleSchoolAllowance: eldritchKnightFlexiblePickAllowance(level),
    };
  }

  const levelRow = spellcastingTable.rows.find((row) => normalizedDocCell(row[0] ?? "") === normalizedDocCell(levelOrdinal(level)));
  if (!levelRow) {
    return null;
  }

  const readCell = (header: string) => {
    const index = spellcastingTable.headers.findIndex((cell) => normalizedDocCell(cell) === normalizedDocCell(header));
    return index >= 0 ? levelRow[index] ?? "" : "";
  };
  const numericValue = (value: string) => {
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const cantripLimit = numericValue(readCell("Cantrips Known")) || 0;
  const totalKnownLimit = numericValue(readCell("Spells Known")) || 0;
  const maxSpellLevel = [1, 2, 3, 4].reduce((highest, spellLevel) => {
    const slotValue = readCell(levelOrdinal(spellLevel));
    return numericValue(slotValue) > 0 ? spellLevel : highest;
  }, 0);
  const perLevelLimits: Record<number, number> = {};

  for (let spellLevel = 1; spellLevel <= maxSpellLevel; spellLevel += 1) {
    perLevelLimits[spellLevel] = totalKnownLimit;
  }

  return {
    maxSpellLevel,
    cantripLimit,
    totalKnownLimit,
    perLevelLimits,
    flexibleSchoolAllowance: eldritchKnightFlexiblePickAllowance(level),
  };
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

function rangerFavoredEnemyChoiceCount(level: number) {
  if (level >= 14) {
    return 3;
  }
  if (level >= 6) {
    return 2;
  }
  return 1;
}

function normalizeRangerChoices(
  rangerChoices: RangerChoices | undefined,
  level: number,
) {
  const choiceCount = rangerFavoredEnemyChoiceCount(level);
  const terrainChoiceCount = level >= 10 ? 3 : level >= 6 ? 2 : 1;
  const baseChoices = rangerChoices?.favoredEnemies ?? [];
  const favoredEnemies = Array.from({ length: choiceCount }, (_, index) => {
    const existing = baseChoices[index];
    return {
      enemyType: existing?.enemyType ?? "aberrations",
      language: existing?.language ?? "Common",
      humanoidRaces: existing?.humanoidRaces ?? "",
    };
  });

  return {
    favoredEnemyMode: rangerChoices?.favoredEnemyMode === "foe" ? ("foe" as const) : ("enemy" as const),
    favoredEnemies,
    favoredTerrainMode: rangerChoices?.favoredTerrainMode === "deft" ? ("deft" as const) : ("terrain" as const),
    favoredTerrains: Array.from({ length: terrainChoiceCount }, (_, index) => rangerChoices?.favoredTerrains?.[index] ?? "forest"),
    cannySkillId: rangerChoices?.cannySkillId ?? "survival",
    deftLanguages: Array.from({ length: 2 }, (_, index) => rangerChoices?.deftLanguages?.[index] ?? (index === 0 ? "Sylvan" : "Elvish")),
    fightingStyleId: rangerChoices?.fightingStyleId ?? "archery",
    awarenessMode: rangerChoices?.awarenessMode === "primal" ? ("primal" as const) : ("primeval" as const),
    hideMode: rangerChoices?.hideMode === "natures-veil" ? ("natures-veil" as const) : ("plain-sight" as const),
    beastMasterMode: rangerChoices?.beastMasterMode === "primal" ? ("primal" as const) : ("companion" as const),
    primalCompanionFormId: rangerChoices?.primalCompanionFormId ?? "beast-of-the-land",
  };
}

function normalizeFighterChoices(fighterChoices: FighterChoices | undefined) {
  return {
    fightingStyleId: fighterChoices?.fightingStyleId ?? "archery",
  } satisfies FighterChoices;
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
  const normalizedRangerChoices = normalizeRangerChoices(previous.rangerChoices, previous.level);
  const normalizedFighterChoices = normalizeFighterChoices(previous.fighterChoices);
  const rangerFavoredEnemyLanguages =
    chosenClass.id === "ranger" && normalizedRangerChoices.favoredEnemyMode === "enemy"
      ? normalizedRangerChoices.favoredEnemies
          .map((entry) => entry.language.trim())
          .filter(Boolean)
      : [];
  const rangerDeftExplorerLanguages =
    chosenClass.id === "ranger" && normalizedRangerChoices.favoredTerrainMode === "deft"
      ? normalizedRangerChoices.deftLanguages.map((entry) => entry.trim()).filter(Boolean)
      : [];

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
    rangerChoices: chosenClass.id === "ranger"
      ? normalizedRangerChoices
        : {
          favoredEnemyMode: "enemy",
          favoredEnemies: [
            {
              enemyType: "aberrations",
              language: "Common",
              humanoidRaces: "",
            },
          ],
          favoredTerrainMode: "terrain",
          favoredTerrains: ["forest"],
          cannySkillId: "survival",
          deftLanguages: ["Sylvan", "Elvish"],
          fightingStyleId: "archery",
          awarenessMode: "primeval",
          hideMode: "plain-sight",
          beastMasterMode: "companion",
          primalCompanionFormId: "beast-of-the-land",
        },
    fighterChoices:
      chosenClass.id === "fighter"
        ? normalizedFighterChoices
        : {
            fightingStyleId: "archery",
          },
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
        ...rangerFavoredEnemyLanguages,
        ...rangerDeftExplorerLanguages,
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
      const expertise =
        chosenClass.id === "ranger" &&
        normalizedRangerChoices.favoredTerrainMode === "deft" &&
        normalizedRangerChoices.cannySkillId === skillId &&
        proficient;
      return {
        id: skillId,
        label: existing?.label ?? skillLabel(skillId),
        ability,
        proficient,
        bonus: modifier + (proficient ? proficiencyBonus : 0) + (expertise ? proficiencyBonus : 0),
        breakdown: expertise
          ? `${ability} modifier + expertise.`
          : proficient
            ? `${ability} modifier + proficiency.`
            : `${ability} modifier.`,
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
  initialClassDocs,
  initialSpellReferenceCollection,
  mode = "creator",
}: {
  initialBookManifest: RawBookManifest | null;
  initialContent: ContentBundle;
  initialCreatorOptions: CreatorOptions;
  initialLineageCollection: LineageCollection;
  initialClassCuratedCollection: ClassCuratedCollection;
  initialWarlockOptions: WarlockOptionCollection;
  initialClassDocs: ClassDocCollection;
  initialSpellReferenceCollection: SpellReferenceCollection;
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
  const sheetContent = useMemo(
    () => buildSheetContent(initialContent, draft, initialClassDocs, initialClassCuratedCollection),
    [initialContent, draft, initialClassDocs, initialClassCuratedCollection],
  );
  const [bookManifest] = useState<RawBookManifest | null>(initialBookManifest);
  const [currentHp, setCurrentHp] = useState(() => draft.currentHp);
  const [tempHp, setTempHp] = useState(() => draft.tempHp);
  const [activityLog, setActivityLog] = useState<LocalActivity[]>([]);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [activeTab, setActiveTab] = useState<InfoTab>("actions");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [creatorStep, setCreatorStep] = useState<CreatorStep>(0);
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

  const filteredActions =
    activeTab === "actions"
      ? sheetContent.builtActions.filter((action) => actionFilter === "all" || action.category === actionFilter)
      : [];
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
  const effectiveSelectedSubclassOptions =
    draft.selectedSubclassOptions.length
      ? draft.selectedSubclassOptions
      : currentCuratedClass?.subclasses?.[0]?.id
        ? [currentCuratedClass.subclasses[0].id]
        : [];
  const isEffectiveEldritchKnight = effectiveSelectedSubclassOptions.includes("eldritch-knight");
  const eldritchKnightSpellRules = deriveEldritchKnightSpellRules(initialClassDocs, effectiveSelectedSubclassOptions, draft.level);
  const spellSelectionRules = eldritchKnightSpellRules ?? deriveSpellSelectionRules(currentCuratedClass, draft.level);
  const maxSpellLevel = spellSelectionRules.maxSpellLevel;
  const eldritchKnightSelectedOffSchoolCount = draft.spellIds.filter((spellId) => {
    const spell = initialContent.spells.find((entry) => entry.id === spellId);
    return Boolean(
      spell &&
      spell.level > 0 &&
      classMatchesSpell(spell, "Wizard") &&
      !["abjuration", "evocation"].includes(spell.school.toLowerCase()),
    );
  }).length;
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
    const byEldritchKnight =
      draft.classId === "fighter" &&
      isEffectiveEldritchKnight &&
      classMatchesSpell(spell, "Wizard");
    const bySubclass = (spell.subclassOptions ?? []).some((option) =>
      draft.selectedSubclassOptions.includes(option),
    );

    if (!(byClass || bySubclass || byEldritchKnight)) {
      return false;
    }

    if (spell.level === 0) {
      return spellSelectionRules.cantripLimit > 0;
    }

    if (
      draft.classId === "fighter" &&
      isEffectiveEldritchKnight &&
      byEldritchKnight &&
      !draft.spellIds.includes(spell.id) &&
      !["abjuration", "evocation"].includes(spell.school.toLowerCase()) &&
      eldritchKnightSelectedOffSchoolCount >= (eldritchKnightSpellRules?.flexibleSchoolAllowance ?? 0)
    ) {
      return false;
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
        ability.id === abilityId ? { ...ability, score } : ability,
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

  const setRangerFavoredEnemyMode = (mode: "enemy" | "foe") => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        favoredEnemyMode: mode,
      },
    }));
  };

  const updateRangerFavoredEnemyChoice = (
    index: number,
    field: "enemyType" | "language" | "humanoidRaces",
    value: string,
  ) => {
    updateDraft((current) => {
      const rangerChoices = normalizeRangerChoices(current.rangerChoices, current.level);
      return {
        ...current,
        rangerChoices: {
          ...rangerChoices,
          favoredEnemies: rangerChoices.favoredEnemies.map((entry, entryIndex) =>
            entryIndex === index ? { ...entry, [field]: value } : entry,
          ),
        },
      };
    });
  };

  const setRangerFavoredTerrainMode = (mode: "terrain" | "deft") => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        favoredTerrainMode: mode,
      },
    }));
  };

  const updateRangerFavoredTerrain = (index: number, value: string) => {
    updateDraft((current) => {
      const rangerChoices = normalizeRangerChoices(current.rangerChoices, current.level);
      return {
        ...current,
        rangerChoices: {
          ...rangerChoices,
          favoredTerrains: rangerChoices.favoredTerrains.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
        },
      };
    });
  };

  const setRangerCannySkill = (skillId: string) => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        cannySkillId: skillId,
      },
    }));
  };

  const updateRangerDeftLanguage = (index: number, value: string) => {
    updateDraft((current) => {
      const rangerChoices = normalizeRangerChoices(current.rangerChoices, current.level);
      return {
        ...current,
        rangerChoices: {
          ...rangerChoices,
          deftLanguages: rangerChoices.deftLanguages.map((entry, entryIndex) => (entryIndex === index ? value : entry)),
        },
      };
    });
  };

  const setRangerFightingStyle = (styleId: string) => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        fightingStyleId: styleId,
      },
    }));
  };

  const setFighterFightingStyle = (styleId: string) => {
    updateDraft((current) => ({
      ...current,
      fighterChoices: {
        ...normalizeFighterChoices(current.fighterChoices),
        fightingStyleId: styleId,
      },
    }));
  };

  const setRangerAwarenessMode = (mode: "primeval" | "primal") => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        awarenessMode: mode,
      },
    }));
  };

  const setRangerHideMode = (mode: "plain-sight" | "natures-veil") => {
    updateDraft((current) => ({
      ...current,
      rangerChoices: {
        ...normalizeRangerChoices(current.rangerChoices, current.level),
        hideMode: mode,
      },
    }));
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

        if (
          current.classId === "fighter" &&
          (current.selectedSubclassOptions.length ? current.selectedSubclassOptions : effectiveSelectedSubclassOptions).includes("eldritch-knight") &&
          classMatchesSpell(targetSpell, "Wizard") &&
          targetSpell.level > 0 &&
          !["abjuration", "evocation"].includes(targetSpell.school.toLowerCase())
        ) {
          const selectedFlexSpells = selectedSpells.filter(
            (spell) =>
              spell.level > 0 &&
              classMatchesSpell(spell, "Wizard") &&
              !["abjuration", "evocation"].includes(spell.school.toLowerCase()),
          ).length;

          if (selectedFlexSpells >= (eldritchKnightSpellRules?.flexibleSchoolAllowance ?? 0)) {
            return current;
          }
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
              classDocs={initialClassDocs}
              spellReferenceCollection={initialSpellReferenceCollection}
              currentClassRules={currentClassRules}
              classOptions={initialCreatorOptions.classOptions}
              multiclassChoices={multiclassChoices}
              availableSubclassOptions={availableSubclassOptions}
              availableSpells={availableSpells}
              availableFeats={availableFeats}
              maxSpellLevel={maxSpellLevel}
              spellSelectionRules={spellSelectionRules}
              eldritchKnightFlexibleSchoolAllowance={eldritchKnightSpellRules?.flexibleSchoolAllowance ?? 0}
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
              setRangerFavoredEnemyMode={setRangerFavoredEnemyMode}
              updateRangerFavoredEnemyChoice={updateRangerFavoredEnemyChoice}
              setRangerFavoredTerrainMode={setRangerFavoredTerrainMode}
              updateRangerFavoredTerrain={updateRangerFavoredTerrain}
              setRangerCannySkill={setRangerCannySkill}
              updateRangerDeftLanguage={updateRangerDeftLanguage}
              setRangerFightingStyle={setRangerFightingStyle}
              setFighterFightingStyle={setFighterFightingStyle}
              setRangerAwarenessMode={setRangerAwarenessMode}
              setRangerHideMode={setRangerHideMode}
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
                <span className="stat-label">
                  {renderKeywordHelp(
                    "Proficiency",
                    "Proficiency bonus is added to trained skills, saving throws, attacks, and other checks your character is proficient with.",
                  )}
                </span>
                <strong>{formatSigned(draft.proficiencyBonus)}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label">
                  {renderKeywordHelp(
                    "Walking",
                    "Walking speed shows how far your character can move on foot during a turn under normal conditions.",
                  )}
                </span>
                <strong>{draft.speed}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label">
                  {renderKeywordHelp(
                    "Initiative",
                    "Initiative determines your place in combat order when an encounter begins.",
                  )}
                </span>
                <strong>{formatSigned(draft.initiative)}</strong>
              </article>

              <article className="badge-card badge-card-secondary">
                <span className="stat-label">
                  {renderKeywordHelp(
                    "AC",
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
                <h2>
                  {renderKeywordHelp(
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
                    onClick={() => void broadcastCheck(`${save.ability} save`, save.bonus)}
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
                  <div className="sense-row" key={sense.id}>
                    <strong>{sense.value}</strong>
                    <span>{renderKeywordHelp(sense.label, `${sense.description} Current value: ${sense.value}.`)}</span>
                  </div>
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
                  <span className="mini-heading">{renderKeywordHelp("Armor", proficiencyTooltip("Armor", draft.proficiencies.armor))}</span>
                  <p>{draft.proficiencies.armor.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading">{renderKeywordHelp("Weapons", proficiencyTooltip("Weapons", draft.proficiencies.weapons))}</span>
                  <p>{draft.proficiencies.weapons.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading">{renderKeywordHelp("Tools", proficiencyTooltip("Tools", draft.proficiencies.tools))}</span>
                  <p>{draft.proficiencies.tools.join(", ")}</p>
                </div>
                <div>
                  <span className="mini-heading">{renderKeywordHelp("Languages", proficiencyTooltip("Languages", draft.proficiencies.languages))}</span>
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
                    <div className="skill-meta">
                      <span className="skill-dot">{skill.proficient ? "★" : "○"}</span>
                      <span className="skill-ability">{skill.ability}</span>
                      <strong className="skill-name">
                        {renderKeywordHelp(skill.label, skill.description || skillDescriptions[skill.id] || skill.breakdown)}
                      </strong>
                    </div>
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
                <div className="detail-card">
                  <span className="mini-heading inline-heading">
                    <span>Defenses</span>
                    {renderInlineHelp("Defenses", "Resistances, immunities, and passive protections currently affecting the character.")}
                  </span>
                  <p>{draft.defenses.join(", ")}</p>
                </div>
                <div className="detail-card">
                  <span className="mini-heading inline-heading">
                    <span>Conditions</span>
                    {renderInlineHelp("Conditions", "Current combat states and ongoing effects such as concentration, prone, or restrained.")}
                  </span>
                  <p>{draft.conditions.join(", ")}</p>
                </div>
              </div>
            </article>
          </div>

          <div className="sheet-column right-column">
            <article className="sheet-card tabs-card pdf-page-break-before-soft">
              <div className="tab-strip">
                {(["actions", "inventory", "features", "background"] as InfoTab[]).map((tab) => (
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
                <div className="tab-body action-tab-body">
                  <div className="action-header">
                    <span>Actions</span>
                    <span>{`${sheetContent.builtActions.length} total entries`}</span>
                  </div>
                  <div className="action-filter-strip">
                    {(["all", "Attack", "Action", "Bonus Action", "Reaction", "Other"] as ActionFilter[]).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={actionFilter === filter ? "tab-button active" : "tab-button"}
                        onClick={() => setActionFilter(filter)}
                      >
                        {filter === "all" ? "All" : filter}
                      </button>
                    ))}
                  </div>
                  <div className="action-card-list">
                    {filteredActions.length ? filteredActions.map((action) => (
                      <article className="spell-selection-row action-selection-row" key={action.id}>
                        <div className="spell-selection-main">
                          <strong className="spell-selection-title">
                            <InlineHelp
                              label={action.name}
                              variant="keyword"
                              tooltipClassName="sheet-inline-tooltip action-inline-tooltip-shell"
                              content={actionTooltipContent(action)}
                            />
                          </strong>
                          <span className="action-selection-source">{action.source}</span>
                        </div>
                        <div className="spell-selection-tags important">
                          {actionHintChips(action).map((item) => (
                            <span key={`${action.id}-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
                              <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
                              {item}
                            </span>
                          ))}
                        </div>
                      </article>
                    )) : (
                      <div className="list-row">
                        <strong>No actions in this filter</strong>
                        <span>Change the filter or add more spells, action-ready features, or inventory items.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "inventory" ? (
                <div className="tab-body simple-list">
                  {draft.inventory.map((item) => (
                    <div className="list-row" key={item}>
                      <strong>
                        <InlineHelp
                          label={item}
                          variant="keyword"
                          content={`${item} is currently equipped or carried by the character.`}
                        />
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === "features" ? (
                <div className="tab-body feature-grid">
                  {sheetContent.builtFeatures.map((feature) => (
                    <article className="feature-sheet-card" key={feature.id}>
                      <div className="feature-sheet-card-head">
                        <strong>
                          <InlineHelp
                            label={feature.name}
                            variant="keyword"
                            content={`${feature.summary} ${feature.kind} | ${feature.source}`}
                          />
                        </strong>
                        <span className="feature-kind-pill">{feature.kind}</span>
                      </div>
                      <p>{feature.summary}</p>
                      <span className="feature-sheet-card-meta">{feature.source}</span>
                    </article>
                  ))}
                </div>
              ) : null}

              {activeTab === "background" ? (
                <div className="tab-body prose-block">
                  <div className="list-row">
                    <strong>{sheetContent.backgroundName}</strong>
                    <span>{sheetContent.backgroundSummary}</span>
                  </div>
                  {sheetContent.backgroundSkillProficiencies ? (
                    <div className="list-row">
                      <strong>Skill Proficiencies</strong>
                      <span>{sheetContent.backgroundSkillProficiencies}</span>
                    </div>
                  ) : null}
                  {sheetContent.backgroundToolProficiencies ? (
                    <div className="list-row">
                      <strong>Tool Proficiencies</strong>
                      <span>{sheetContent.backgroundToolProficiencies}</span>
                    </div>
                  ) : null}
                  {sheetContent.backgroundLanguages ? (
                    <div className="list-row">
                      <strong>Languages</strong>
                      <span>{sheetContent.backgroundLanguages}</span>
                    </div>
                  ) : null}
                  <p>{draft.background}</p>
                </div>
              ) : null}
            </article>

          </div>
        </section>
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
