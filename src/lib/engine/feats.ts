import type { CharacterDraft, FighterChoices } from "@/lib/character/demo-sheet";
import type { EngineCatalog } from "@/lib/engine/collect";
import type { AbilityId, FeatCondition } from "@/lib/engine/grants";

/**
 * Feat'lerin tek yolu.
 * Karakter feat'i sadece su yerlerden alabilir:
 *  - ASI level'lari (class'in Ability Score Improvement milestone'lari) -> +2, +1/+1 ya da feat
 *  - Lineage feat secimi (Variant Human, Custom Lineage...) -> draft.lineageChoices["...-feat-choice"]
 *  - Background / feature / invocation grant'leri -> otomatik
 * draft.featIds bu fonksiyonlardan turetilir; elle serbest feat eklemek yok.
 */

type AsiChoice = NonNullable<FighterChoices["abilityScoreImprovements"][number]>;

/** Class'in ASI level'lari (Fighter 6 ve 14 dahil). Karakter level'indan bagimsiz tam liste. */
export function classAsiLevels(catalog: EngineCatalog, classId: string): number[] {
  const classEntry = catalog.classes?.entries.find((entry) => entry.id === classId);
  const feature = classEntry?.classFeatures.find((entry) => entry.id === "ability-score-improvement");
  return (feature?.milestones ?? []).map((milestone) => milestone.level).sort((left, right) => left - right);
}

/** Sadece su anki class ve level icin gecerli ASI secimleri. Level dusurulunce eski secim saklanir ama sayilmaz. */
export function activeAsiChoices(catalog: EngineCatalog, draft: CharacterDraft): Record<number, AsiChoice> {
  const stored = draft.fighterChoices?.abilityScoreImprovements ?? {};
  const levels = classAsiLevels(catalog, draft.classId).filter((level) => level <= draft.level);
  const result: Record<number, AsiChoice> = {};
  levels.forEach((level) => {
    const choice = stored[level];
    if (choice) {
      result[level] = choice;
    }
  });
  return result;
}

export function asiFeatIds(catalog: EngineCatalog, draft: CharacterDraft): string[] {
  return Object.values(activeAsiChoices(catalog, draft))
    .filter((choice) => choice.mode === "feat" && choice.featId)
    .map((choice) => choice.featId as string);
}

export function asiAbilityBonuses(catalog: EngineCatalog, draft: CharacterDraft, excludeLevel?: number) {
  const bonuses = new Map<AbilityId, number>();
  Object.entries(activeAsiChoices(catalog, draft)).forEach(([levelKey, choice]) => {
    if (excludeLevel !== undefined && Number(levelKey) === excludeLevel) {
      return;
    }
    if (choice.mode === "plus-two" && choice.plusTwoAbilityId) {
      bonuses.set(choice.plusTwoAbilityId, (bonuses.get(choice.plusTwoAbilityId) ?? 0) + 2);
    }
    if (choice.mode === "split") {
      choice.plusOneAbilityIds.forEach((abilityId) => bonuses.set(abilityId, (bonuses.get(abilityId) ?? 0) + 1));
    }
  });
  return bonuses;
}

export type FeatSlot = {
  key: string;
  kind: "asi" | "lineage";
  label: string;
  level?: number;
  groupId?: string;
  /** ASI'de mod feat degilse null. */
  mode?: AsiChoice["mode"];
  featId: string | null;
};

/** Oyuncunun feat secebilecegi yerler (bos ya da dolu). */
export function featSlots(catalog: EngineCatalog, draft: CharacterDraft): FeatSlot[] {
  const slots: FeatSlot[] = [];
  const lineage =
    catalog.lineages?.entries.find((entry) => entry.id === draft.speciesId) ??
    catalog.lineages?.entries.find((entry) => entry.sublineages.some((sub) => sub.id === draft.speciesId)) ??
    null;
  const sublineage = lineage?.sublineages.find((entry) => entry.id === draft.speciesId) ?? null;
  [...(lineage?.choiceGroups ?? []), ...(sublineage?.choiceGroups ?? [])]
    .filter((group) => group.id.endsWith("-feat-choice"))
    .forEach((group) => {
      slots.push({
        key: `lineage:${group.id}`,
        kind: "lineage",
        label: sublineage?.name ?? lineage?.name ?? "Lineage",
        groupId: group.id,
        featId: draft.lineageChoices?.[group.id]?.[0] ?? null,
      });
    });

  const stored = draft.fighterChoices?.abilityScoreImprovements ?? {};
  classAsiLevels(catalog, draft.classId)
    .filter((level) => level <= draft.level)
    .forEach((level) => {
      const choice = stored[level];
      slots.push({
        key: `asi:${level}`,
        kind: "asi",
        label: `Level ${level} ASI`,
        level,
        mode: choice?.mode ?? null,
        featId: choice?.mode === "feat" ? choice.featId ?? null : null,
      });
    });
  return slots;
}

export type FeatCheckContext = {
  /** Feat haric son ability skorlari. */
  scores: Record<AbilityId, number>;
  /** Karakterin zaten sahip oldugu feat'ler. */
  featIds: string[];
  /** "Light armor", "Martial weapons" gibi proficiency etiketleri. */
  armorProficiencies: string[];
  weaponProficiencies: string[];
  /** Class/subclass spellcasting ya da Pact Magic var mi. */
  hasSpellcastingFeature: boolean;
  /** Herhangi bir kaynaktan buyu yapabiliyor mu (cantrip dahil). */
  canCastSpell: boolean;
};

export type FeatEligibility = {
  eligible: boolean;
  /** Saglanmayan kosullar, insan okunur. */
  unmet: string[];
  /** Kontrol edilemeyen (kampanya) kosullar; DM onayi gerekir. */
  dmNotes: string[];
};

const ABILITY_LABELS: Record<AbilityId, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const PREPARED_CASTERS = ["artificer", "cleric", "druid", "paladin", "wizard"];

function lineageIds(catalog: EngineCatalog, draft: CharacterDraft) {
  const ids = new Set<string>([draft.speciesId]);
  const parent = catalog.lineages?.entries.find((entry) => entry.sublineages.some((sub) => sub.id === draft.speciesId));
  if (parent) {
    ids.add(parent.id);
  }
  return ids;
}

function hasCategory(labels: string[], value: string) {
  return labels.some((label) => label.toLowerCase().includes(value));
}

type Check = { ok: boolean; label: string; campaign?: boolean };

function checkCondition(
  condition: Exclude<FeatCondition, { kind: "anyOf" }>,
  catalog: EngineCatalog,
  draft: CharacterDraft,
  context: FeatCheckContext,
): Check {
  switch (condition.kind) {
    case "level":
      return { ok: draft.level >= condition.min, label: `Level ${condition.min}` };
    case "ability":
      return {
        ok: condition.abilities.some((ability) => (context.scores[ability] ?? 0) >= condition.min),
        label: `${condition.abilities.map((ability) => ABILITY_LABELS[ability]).join(" or ")} ${condition.min}+`,
      };
    case "lineage": {
      const ids = lineageIds(catalog, draft);
      return { ok: condition.ids.some((id) => ids.has(id)), label: condition.label };
    }
    case "proficiency": {
      const labels = condition.category === "armor" ? context.armorProficiencies : context.weaponProficiencies;
      const ok = hasCategory(labels, condition.value) || (condition.category === "armor" && condition.value === "light" && hasCategory(labels, "all armor"));
      const noun = condition.category === "armor" ? "armor" : "weapon";
      return { ok, label: `${condition.value[0].toUpperCase()}${condition.value.slice(1)} ${noun} proficiency` };
    }
    case "spellcasting":
      if (condition.mode === "prepared") {
        return { ok: PREPARED_CASTERS.includes(draft.classId), label: "Class that prepares spells" };
      }
      if (condition.mode === "feature") {
        return { ok: context.hasSpellcastingFeature, label: "Spellcasting or Pact Magic feature" };
      }
      return { ok: context.canCastSpell, label: "Able to cast a spell" };
    case "feat": {
      const names = condition.ids.map((id) => catalog.content.feats.find((feat) => feat.id === id)?.name ?? id);
      return { ok: condition.ids.some((id) => context.featIds.includes(id)), label: `${names.join(" or ")} feat` };
    }
    case "class": {
      const names = condition.ids.map((id) => catalog.classes?.entries.find((entry) => entry.id === id)?.name ?? catalog.content.classes.find((entry) => entry.id === id)?.name ?? id);
      return { ok: condition.ids.includes(draft.classId), label: `${names.join(" or ")} class` };
    }
    case "background": {
      const names = condition.ids.map((id) => catalog.content.backgrounds.find((entry) => entry.id === id)?.name ?? id);
      return { ok: condition.ids.includes(draft.backgroundId), label: `${names.join(" or ")} background` };
    }
    case "campaign":
      return { ok: true, label: condition.text, campaign: true };
  }
}

export function featEligibility(
  featId: string,
  catalog: EngineCatalog,
  draft: CharacterDraft,
  context: FeatCheckContext,
): FeatEligibility {
  const feat = catalog.content.feats.find((entry) => entry.id === featId);
  const result: FeatEligibility = { eligible: true, unmet: [], dmNotes: [] };
  if (!feat) {
    return { eligible: false, unmet: ["Unknown feat"], dmNotes: [] };
  }

  (feat.requires ?? []).forEach((condition) => {
    if (condition.kind === "anyOf") {
      const checks = condition.conditions.map((entry) => checkCondition(entry, catalog, draft, context));
      if (!checks.some((check) => check.ok)) {
        result.unmet.push(checks.map((check) => check.label).join(" or "));
      }
      return;
    }
    const check = checkCondition(condition, catalog, draft, context);
    if (check.campaign) {
      result.dmNotes.push(check.label);
    } else if (!check.ok) {
      result.unmet.push(check.label);
    }
  });

  // Ayni feat iki kez alinamaz (Elemental Adept gibi tekrar alinabilenler haric).
  const repeatable = ["elemental-adept", "resilient"].includes(featId);
  if (!repeatable && context.featIds.includes(featId)) {
    result.unmet.push("Already taken");
  }

  result.eligible = result.unmet.length === 0;
  return result;
}

/**
 * Eski kayitlarda feat'ler serbestce draft.featIds'e eklenebiliyordu.
 * Yuklerken bunlari bos ASI slotlarina yerlestirir; slot yoksa birakilir (motor artik saymaz).
 */
export function migrateLegacyFeatIds(catalog: EngineCatalog, draft: CharacterDraft): CharacterDraft {
  const assigned = new Set(asiFeatIds(catalog, draft));
  Object.values(draft.lineageChoices ?? {}).flat().forEach((id) => assigned.add(id));
  const leftovers = (draft.featIds ?? []).filter((id) => !assigned.has(id));
  if (!leftovers.length) {
    return draft;
  }

  const stored = { ...(draft.fighterChoices?.abilityScoreImprovements ?? {}) };
  const openLevels = classAsiLevels(catalog, draft.classId).filter((level) => level <= draft.level && !stored[level]?.mode);
  leftovers.forEach((featId) => {
    const level = openLevels.shift();
    if (level !== undefined) {
      stored[level] = { mode: "feat", plusTwoAbilityId: null, plusOneAbilityIds: [], featId };
    }
  });
  return {
    ...draft,
    fighterChoices: { ...draft.fighterChoices, abilityScoreImprovements: stored },
  };
}
