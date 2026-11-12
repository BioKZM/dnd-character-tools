import type { CharacterDraft } from "@/lib/character/demo-sheet";
import type { ClassCuratedCollection } from "@/lib/content/class-curated-schema";
import type { ClassOptionCollection, ClassOptionEntry } from "@/lib/content/class-options-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { LineageCatalog, LineageGrant } from "@/lib/data/lineages/schema";
import type { Grant, OptionChoice } from "@/lib/engine/grants";

/** deriveCharacter'in ihtiyac duydugu tum veri. */
export type EngineCatalog = {
  content: ContentBundle;
  lineages?: LineageCatalog;
  classes?: ClassCuratedCollection;
  classOptions?: ClassOptionCollection;
};

export type GrantSourceKind =
  | "lineage"
  | "class"
  | "subclass"
  | "invocation"
  | "pact-boon"
  | "fighting-style"
  | "feat"
  | "background";

/** Grant'lerin nereden geldigi: sheet'teki her degerin "neden" aciklamasi buradan uretilir. */
export type GrantSource = {
  kind: GrantSourceKind;
  id: string;
  name: string;
  summary: string;
  /** Sheet'te ayri bir feature karti olarak gosterilsin mi (invocation, pact boon, background feat...). */
  showAsFeature: boolean;
  grants: Grant[];
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Eski lineage grant formatini ortak Grant diline cevirir.
 * TODO(lineage migration): data/lineages dosyalari dogrudan yeni formata tasininca bu adapter silinecek.
 * Not: ability_bonus burada atlaniyor; lineage stat bonuslari simdilik finalAbilityBonuses icinde hesaplaniyor.
 */
export function lineageGrantToGrant(grant: LineageGrant, characterLevel: number): Grant | null {
  switch (grant.type) {
    case "sense":
      return { type: "sense", sense: grant.sense, range: grant.value };
    case "damage_resistance":
      return { type: "defense", kind: "resistance", against: grant.damageType };
    case "save_advantage":
      return { type: "defense", kind: "save_advantage", against: grant.against };
    case "condition_immunity":
      return { type: "defense", kind: "condition_immunity", against: grant.against };
    case "skill_proficiency":
      return { type: "proficiency", category: "skill", values: grant.values };
    case "weapon_proficiency":
      return { type: "proficiency", category: "weapon", values: grant.values };
    case "tool_proficiency":
      return { type: "proficiency", category: "tool", values: grant.values };
    case "armor_training":
      return { type: "proficiency", category: "armor", values: grant.values };
    case "language":
      return { type: "proficiency", category: "language", values: grant.values };
    case "hit_points_per_level":
      return { type: "hp", perLevel: grant.amount };
    case "armor_class_bonus":
      return { type: "ac", bonus: grant.amount, condition: grant.condition };
    case "movement":
      return { type: "speed", mode: grant.mode, op: grant.operation === "set" ? "set" : "add", value: grant.value };
    case "spell_grant":
      if (grant.unlockLevel && characterLevel < grant.unlockLevel) {
        return null;
      }
      return {
        type: "spell",
        spellId: slugify(grant.spellName),
        uses: grant.countsAsKnown ? "known" : "long_rest",
        ability: grant.spellcastingAbility,
      };
    case "skill_bonus_if_proficient":
      return { type: "note", text: `${grant.context}: x${grant.multiplier} proficiency bonus on ${grant.skillId} if proficient` };
    case "ability_bonus":
    case "tool_proficiency_choice":
      return null;
  }
}

function findLineage(catalog: EngineCatalog, draft: CharacterDraft) {
  const lineage =
    catalog.lineages?.entries.find((entry) => entry.id === draft.speciesId) ??
    catalog.lineages?.entries.find((entry) => entry.sublineages.some((sub) => sub.id === draft.speciesId)) ??
    null;
  const sublineage = lineage?.sublineages.find((entry) => entry.id === draft.speciesId) ?? null;
  return { lineage, sublineage };
}

function lineageSources(catalog: EngineCatalog, draft: CharacterDraft): GrantSource[] {
  const { lineage, sublineage } = findLineage(catalog, draft);
  if (!lineage) {
    return [];
  }

  const convert = (grants: LineageGrant[]) =>
    grants.map((grant) => lineageGrantToGrant(grant, draft.level)).filter((grant): grant is Grant => Boolean(grant));

  const sources: GrantSource[] = [];
  const languageValues = sublineage?.facts.languages.values.length
    ? sublineage.facts.languages.values
    : lineage.facts.languages.values;

  sources.push({
    kind: "lineage",
    id: lineage.id,
    name: sublineage?.name ?? lineage.name,
    summary: lineage.summary,
    showAsFeature: false,
    grants: languageValues.length ? [{ type: "proficiency", category: "language", values: languageValues }] : [],
  });

  [...lineage.features, ...(sublineage?.features ?? [])].forEach((feature) => {
    sources.push({
      kind: "lineage",
      id: feature.id,
      name: feature.name,
      summary: feature.summary,
      showAsFeature: false,
      grants: convert(feature.grants),
    });
  });

  [...lineage.choiceGroups, ...(sublineage?.choiceGroups ?? [])].forEach((group) => {
    const selectedIds = draft.lineageChoices?.[group.id] ?? [];
    group.options
      .filter((option) => selectedIds.includes(option.id))
      .forEach((option) => {
        sources.push({
          kind: "lineage",
          id: option.id,
          name: option.label,
          summary: option.summary ?? option.label,
          showAsFeature: false,
          grants: convert(option.grants),
        });
      });
  });

  return sources;
}

function classSources(catalog: EngineCatalog, draft: CharacterDraft): GrantSource[] {
  const classEntry = catalog.classes?.entries.find((entry) => entry.id === draft.classId);
  if (!classEntry) {
    return [];
  }

  const sources: GrantSource[] = [
    {
      kind: "class",
      id: classEntry.id,
      name: classEntry.name,
      summary: classEntry.summary,
      showAsFeature: false,
      grants: classEntry.startingGrants,
    },
  ];

  classEntry.classFeatures
    .filter((feature) => (feature.unlockLevel ?? 1) <= draft.level && feature.grants.length)
    .forEach((feature) => {
      sources.push({
        kind: "class",
        id: feature.id,
        name: feature.name,
        summary: feature.summary,
        showAsFeature: false,
        grants: feature.grants,
      });
    });

  const subclassId = draft.selectedSubclassOptions[0] ?? null;
  const subclass = subclassId ? classEntry.subclasses.find((entry) => entry.id === subclassId) : null;
  if (subclass) {
    subclass.features
      .filter((feature) => (feature.unlockLevel ?? 1) <= draft.level && feature.grants.length)
      .forEach((feature) => {
        sources.push({
          kind: "subclass",
          id: feature.id,
          name: feature.name,
          summary: feature.summary,
          showAsFeature: false,
          grants: feature.grants,
        });
      });

    const expanded = subclass.expandedSpells.filter((entry) => entry.unlockLevel <= draft.level);
    if (expanded.length) {
      sources.push({
        kind: "subclass",
        id: `${subclass.id}-spells`,
        name: subclass.name,
        summary: "",
        showAsFeature: false,
        grants: expanded.flatMap((entry) =>
          entry.spells.map((spellName) => ({ type: "spell" as const, spellId: slugify(spellName), uses: entry.uses })),
        ),
      });
    }
  }

  return sources;
}

/** Opsiyonun secimlerinden (draft.choices) gelen grant'ler. Gecersiz/fazla secimler atlanir. */
function choiceGrants(option: ClassOptionEntry, draft: CharacterDraft, content: ContentBundle): Grant[] {
  return option.choices.flatMap((choice) => {
    const allowed = new Set(choiceCandidates(choice, draft, content).map((spell) => spell.id));
    return (draft.choices?.[choice.id] ?? [])
      .filter((spellId) => allowed.has(spellId))
      .slice(0, choice.count)
      .map((spellId) => ({ type: "spell" as const, spellId, uses: choice.grantUses, note: choice.note }));
  });
}

function optionSource(
  kind: GrantSourceKind,
  option: ClassOptionEntry | undefined,
  draft: CharacterDraft,
  content: ContentBundle,
): GrantSource[] {
  if (!option) {
    return [];
  }
  return [
    {
      kind,
      id: option.id,
      name: option.name,
      summary: option.summary,
      showAsFeature: true,
      grants: [...option.grants, ...choiceGrants(option, draft, content)],
    },
  ];
}

/** Bir secim icin secilebilecek buyuler. */
export function choiceCandidates(choice: OptionChoice, draft: CharacterDraft, content: ContentBundle) {
  const filter = choice.from.filter;
  const maxLevel = filter.maxLevel === "half_level" ? Math.ceil(draft.level / 2) : filter.maxLevel;
  return content.spells.filter((spell) => {
    if (filter.level !== undefined && spell.level !== filter.level) return false;
    if (filter.minLevel !== undefined && spell.level < filter.minLevel) return false;
    if (maxLevel !== undefined && spell.level > maxLevel) return false;
    if (filter.tags.some((tag) => !(spell.tags ?? []).includes(tag))) return false;
    if (filter.classes.length && !filter.classes.some((className) => (spell.classes ?? []).includes(className))) return false;
    return true;
  });
}

/** Taslakta secili olan opsiyonlar (pact boon, invocation, fighting style). */
function selectedClassOptions(catalog: EngineCatalog, draft: CharacterDraft) {
  const options = catalog.classOptions;
  const selected: { kind: GrantSourceKind; option: ClassOptionEntry }[] = [];
  if (!options) {
    return selected;
  }
  const push = (kind: GrantSourceKind, option: ClassOptionEntry | undefined) => {
    if (option) selected.push({ kind, option });
  };

  if (draft.classId === "warlock") {
    if (draft.level >= 3) {
      push("pact-boon", options.warlock.pactBoon?.options.find((entry) => entry.id === draft.pactBoonId));
    }
    if (draft.level >= 2) {
      (draft.selectedInvocationIds ?? []).forEach((invocationId) => {
        push("invocation", options.warlock.eldritchInvocations?.options.find((entry) => entry.id === invocationId));
      });
    }
  }

  const fightingStyleId =
    draft.classId === "fighter"
      ? draft.fighterChoices?.fightingStyleId
      : draft.classId === "ranger" && draft.level >= 2
        ? draft.rangerChoices?.fightingStyleId
        : null;
  if (fightingStyleId) {
    // Ranger icin de ayni havuz; ranger'da olmayan stiller zaten creator'da secilemiyor.
    push("fighting-style", options.fighter.fightingStyle?.options.find((entry) => entry.id === fightingStyleId));
  }

  return selected;
}

export type AvailableChoice = {
  choice: OptionChoice;
  sourceName: string;
  candidates: ContentBundle["spells"];
  selectedIds: string[];
};

/** Creator'da gosterilecek acik secimler (secili opsiyonlarin `choices` alanlari). */
export function availableChoices(draft: CharacterDraft, catalog: EngineCatalog): AvailableChoice[] {
  return selectedClassOptions(catalog, draft).flatMap(({ option }) =>
    option.choices.map((choice) => {
      const candidates = choiceCandidates(choice, draft, catalog.content);
      const allowed = new Set(candidates.map((spell) => spell.id));
      return {
        choice,
        sourceName: option.name,
        candidates,
        selectedIds: (draft.choices?.[choice.id] ?? []).filter((spellId) => allowed.has(spellId)).slice(0, choice.count),
      };
    }),
  );
}

/** Artik gecerli olmayan secimleri (opsiyon birakildi, level dustu...) temizler. */
export function sanitizeChoices(draft: CharacterDraft, catalog: EngineCatalog): Record<string, string[]> {
  return Object.fromEntries(availableChoices(draft, catalog).map((entry) => [entry.choice.id, entry.selectedIds]));
}

function classOptionSources(catalog: EngineCatalog, draft: CharacterDraft): GrantSource[] {
  return selectedClassOptions(catalog, draft).flatMap(({ kind, option }) =>
    optionSource(kind, option, draft, catalog.content).map((source) =>
      kind === "fighting-style" ? { ...source, showAsFeature: false } : source,
    ),
  );
}

function featSource(content: ContentBundle, featId: string, showAsFeature: boolean): GrantSource[] {
  const feat = content.feats.find((entry) => entry.id === featId);
  if (!feat) {
    return [];
  }
  return [
    {
      kind: "feat",
      id: feat.id,
      name: feat.name,
      summary: feat.summary,
      showAsFeature,
      grants: feat.grants,
    },
  ];
}

/**
 * Taslaktaki tum secimlerden (lineage, class, subclass, opsiyonlar, feat, background)
 * grant kaynaklarini toplar. Feat veren kaynaklarin feat'leri de zincirleme eklenir.
 */
export function collectGrantSources(draft: CharacterDraft, catalog: EngineCatalog): GrantSource[] {
  const sources: GrantSource[] = [
    ...lineageSources(catalog, draft),
    ...classSources(catalog, draft),
    ...classOptionSources(catalog, draft),
  ];

  const background = catalog.content.backgrounds.find((entry) => entry.id === draft.backgroundId);
  if (background?.grants.length) {
    sources.push({
      kind: "background",
      id: background.id,
      name: background.name,
      summary: background.summary,
      showAsFeature: false,
      grants: background.grants,
    });
  }

  const featIds = new Set<string>();
  (draft.featIds ?? []).forEach((featId) => {
    featIds.add(featId);
    sources.push(...featSource(catalog.content, featId, false));
  });

  // Background / invocation / feature'lardan gelen feat'ler (orn. Lorehold Student -> Strixhaven Initiate).
  for (let index = 0; index < sources.length; index += 1) {
    sources.at(index)?.grants.forEach((grant) => {
      if (grant.type === "feat" && !featIds.has(grant.featId)) {
        featIds.add(grant.featId);
        sources.push(...featSource(catalog.content, grant.featId, false));
      }
    });
  }

  return sources;
}
