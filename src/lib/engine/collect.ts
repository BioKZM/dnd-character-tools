import type { CharacterDraft } from "@/lib/character/demo-sheet";
import { asiFeatIds } from "@/lib/engine/feats";
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

    // Secenekleri data'da degil creator'da uretilen gruplar: secilen deger dogrudan skill / feat / cantrip id'si.
    const dynamicGrants: Grant[] = group.id.endsWith("-skill-choice")
      ? selectedIds.length ? [{ type: "proficiency", category: "skill", values: selectedIds }] : []
      : group.id.endsWith("-feat-choice")
        ? selectedIds.filter((id) => catalog.content.feats.some((feat) => feat.id === id)).map((featId) => ({ type: "feat" as const, featId }))
        : group.id.endsWith("-cantrip-choice")
          ? selectedIds
              .filter((id) => catalog.content.spells.some((spell) => spell.id === id && spell.level === 0))
              .map((spellId) => ({ type: "spell" as const, spellId, uses: "known" as const, ability: "INT" as const }))
          : [];
    if (dynamicGrants.length) {
      sources.push({
        kind: "lineage",
        id: group.id,
        name: sublineage?.name ?? lineage.name,
        summary: group.name,
        showAsFeature: false,
        grants: dynamicGrants,
      });
    }

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

/**
 * Tasha's optional feature'lari ve yerine gectikleri feature'lar: sadece secilen taraf grant verir.
 * Secim su an Ranger'in kendi alanlarinda (draft.rangerChoices) tutuluyor.
 */
const OPTIONAL_FEATURE_SWITCHES: Record<string, (draft: CharacterDraft) => boolean> = {
  "favored-enemy": (draft) => draft.rangerChoices?.favoredEnemyMode !== "foe",
  "favored-foe-optional": (draft) => draft.rangerChoices?.favoredEnemyMode === "foe",
  "natural-explorer": (draft) => draft.rangerChoices?.favoredTerrainMode !== "deft",
  "deft-explorer-optional": (draft) => draft.rangerChoices?.favoredTerrainMode === "deft",
  "primeval-awareness": (draft) => draft.rangerChoices?.awarenessMode !== "primal",
  "primal-awareness-optional": (draft) => draft.rangerChoices?.awarenessMode === "primal",
  "roving-optional": (draft) => draft.rangerChoices?.favoredTerrainMode === "deft",
  "tireless-optional": (draft) => draft.rangerChoices?.favoredTerrainMode === "deft",
  "hide-in-plain-sight": (draft) => draft.rangerChoices?.hideMode !== "natures-veil",
  "nature-s-veil-optional": (draft) => draft.rangerChoices?.hideMode === "natures-veil",
};

export function optionalFeatureActive(featureId: string, draft: CharacterDraft) {
  if (draft.classId !== "ranger") {
    return true;
  }
  return OPTIONAL_FEATURE_SWITCHES[featureId]?.(draft) ?? true;
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
    .filter((feature) => (feature.unlockLevel ?? 1) <= draft.level && (feature.grants.length || feature.choices.length))
    .filter((feature) => optionalFeatureActive(feature.id, draft))
    .forEach((feature) => {
      sources.push({
        kind: "class",
        id: feature.id,
        name: feature.name,
        summary: feature.summary,
        showAsFeature: false,
        grants: [...feature.grants, ...choiceGrants(feature, draft, catalog.content)],
      });
    });

  const subclassId = draft.selectedSubclassOptions[0] ?? null;
  const subclass = subclassId ? classEntry.subclasses.find((entry) => entry.id === subclassId) : null;
  if (subclass) {
    subclass.features
      .filter((feature) => (feature.unlockLevel ?? 1) <= draft.level && (feature.grants.length || feature.choices.length))
      .forEach((feature) => {
        sources.push({
          kind: "subclass",
          id: feature.id,
          name: feature.name,
          summary: feature.summary,
          showAsFeature: false,
          grants: [...feature.grants, ...choiceGrants(feature, draft, catalog.content)],
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

export type ChoiceCandidate = { id: string; name: string; tags: string[]; summary?: string };

type ChoiceHost = { choices: OptionChoice[] };

/** Secimlerden (draft.choices) gelen grant'ler. Gecersiz/fazla secimler atlanir. */
function choiceGrants(host: ChoiceHost, draft: CharacterDraft, content: ContentBundle): Grant[] {
  return host.choices.filter((choice) => !choice.minLevel || draft.level >= choice.minLevel).flatMap((choice): Grant[] => {
    const allowed = new Set(choiceCandidates(choice, draft, content).map((candidate) => candidate.id));
    const picked = (draft.choices?.[choice.id] ?? []).filter((id) => allowed.has(id)).slice(0, choice.count);
    if (choice.from.kind === "weapon") {
      const names = picked.map((id) => content.weapons.find((weapon) => weapon.id === id)?.name ?? id);
      return picked.length
        ? [
            { type: "proficiency" as const, category: "weapon" as const, values: names },
            ...(choice.grantAs === "monk_weapon" ? [{ type: "monk_weapon" as const, weapons: picked }] : []),
          ]
        : [];
    }
    if (choice.from.kind === "tool") {
      return picked.length ? [{ type: "proficiency" as const, category: "tool" as const, values: picked }] : [];
    }
    if (choice.from.kind === "skill") {
      return choice.grantAs === "expertise"
        ? picked.map((skill) => ({ type: "expertise" as const, skill }))
        : picked.length
          ? [{ type: "proficiency" as const, category: "skill" as const, values: picked }]
          : [];
    }
    return picked.map((spellId) => ({ type: "spell" as const, spellId, uses: choice.grantUses ?? "known", note: choice.note }));
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

const SKILL_NAMES: Record<string, string> = {
  acrobatics: "Acrobatics", "animal-handling": "Animal Handling", arcana: "Arcana", athletics: "Athletics",
  deception: "Deception", history: "History", insight: "Insight", intimidation: "Intimidation",
  investigation: "Investigation", medicine: "Medicine", nature: "Nature", perception: "Perception",
  performance: "Performance", persuasion: "Persuasion", religion: "Religion", "sleight-of-hand": "Sleight of Hand",
  stealth: "Stealth", survival: "Survival",
};

/** Bir secim icin secilebilecek adaylar (buyu ya da skill). */
export function choiceCandidates(choice: OptionChoice, draft: CharacterDraft, content: ContentBundle): ChoiceCandidate[] {
  if (choice.from.kind === "skill") {
    const proficientOnly = choice.from.proficientOnly;
    return Object.entries(SKILL_NAMES)
      .filter(([id]) => !proficientOnly || draft.skills.some((skill) => skill.id === id && skill.proficient))
      .map(([id, name]) => ({ id, name, tags: [] }));
  }
  if (choice.from.kind === "tool") {
    return choice.from.options.map((name) => ({ id: name, name, tags: ["Tool"] }));
  }
  if (choice.from.kind === "weapon") {
    const weaponFilter = choice.from.filter;
    return content.weapons
      .filter((weapon) => weapon.attackType !== "ammunition")
      .filter((weapon) => !weaponFilter.attackType || weapon.attackType === weaponFilter.attackType)
      .filter(
        (weapon) =>
          !weaponFilter.kensei ||
          weapon.id === "longbow" ||
          (!weapon.properties.includes("heavy") && !weapon.properties.includes("special")),
      )
      .map((weapon) => ({
        id: weapon.id,
        name: weapon.name,
        tags: [`${weapon.proficiency === "martial" ? "Martial" : "Simple"} ${weapon.attackType}`, weapon.damage ? `${weapon.damage} ${weapon.damageType ?? ""}`.trim() : ""].filter(Boolean),
      }));
  }
  const filter = choice.from.filter;
  const maxLevel = filter.maxLevel === "half_level" ? Math.ceil(draft.level / 2) : filter.maxLevel;
  return content.spells
    .filter((spell) => {
      if (filter.level !== undefined && spell.level !== filter.level) return false;
      if (filter.minLevel !== undefined && spell.level < filter.minLevel) return false;
      if (maxLevel !== undefined && spell.level > maxLevel) return false;
      if (filter.tags.some((tag) => !(spell.tags ?? []).includes(tag))) return false;
      if (filter.classes.length && !filter.classes.some((className) => (spell.classes ?? []).includes(className))) return false;
      return true;
    })
    .map((spell) => ({
      id: spell.id,
      name: spell.name,
      tags: [spell.level === 0 ? "Cantrip" : `Level ${spell.level}`, spell.school],
      summary: spell.summary,
    }));
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
  candidates: ChoiceCandidate[];
  selectedIds: string[];
};

/** Acilmis class / subclass feature'lari arasinda secimi olanlar (orn. Bard Expertise). */
function unlockedFeatureChoiceHosts(catalog: EngineCatalog, draft: CharacterDraft) {
  const classEntry = catalog.classes?.entries.find((entry) => entry.id === draft.classId);
  if (!classEntry) {
    return [];
  }
  const subclass = classEntry.subclasses.find((entry) => entry.id === draft.selectedSubclassOptions[0]);
  return [...classEntry.classFeatures, ...(subclass?.features ?? [])].filter(
    (feature) => feature.choices.length && (feature.unlockLevel ?? 1) <= draft.level,
  );
}

/** Creator'da gosterilecek acik secimler: secili opsiyonlar ve acilmis feature'lar. */
export function availableChoices(draft: CharacterDraft, catalog: EngineCatalog): AvailableChoice[] {
  const hosts = [
    ...selectedClassOptions(catalog, draft).map(({ option }) => ({ name: option.name, choices: option.choices })),
    ...unlockedFeatureChoiceHosts(catalog, draft).map((feature) => ({ name: feature.name, choices: feature.choices })),
  ];
  return hosts.flatMap((host) =>
    host.choices.filter((choice) => !choice.minLevel || draft.level >= choice.minLevel).map((choice) => {
      const candidates = choiceCandidates(choice, draft, catalog.content);
      const allowed = new Set(candidates.map((candidate) => candidate.id));
      return {
        choice,
        sourceName: host.name,
        candidates,
        selectedIds: (draft.choices?.[choice.id] ?? []).filter((id) => allowed.has(id)).slice(0, choice.count),
      };
    }),
  );
}

/** Artik gecerli olmayan secimleri (opsiyon birakildi, level dustu...) temizler. */
export function sanitizeChoices(draft: CharacterDraft, catalog: EngineCatalog): Record<string, string[]> {
  return Object.fromEntries([
    ...availableChoices(draft, catalog).map((entry) => [entry.choice.id, entry.selectedIds]),
    ...languageChoices(draft, catalog).map((entry) => [entry.id, entry.selectedNames]),
  ]);
}

export type LanguageChoice = {
  id: string;
  label: string;
  sourceName: string;
  count: number;
  options: string[];
  selectedNames: string[];
};

/** Lineage dil gruplari (orn. "human-extra-language") secim anahtarlari "lineage:<grup id>". */
function lineageLanguageGroups(catalog: EngineCatalog, draft: CharacterDraft) {
  const { lineage, sublineage } = findLineage(catalog, draft);
  if (!lineage) {
    return [];
  }
  return [...lineage.choiceGroups, ...(sublineage?.choiceGroups ?? [])]
    .filter((group) => group.id.includes("language"))
    .map((group) => ({ group, sourceName: sublineage?.name ?? lineage.name }));
}

/**
 * Race ve background'dan gelen dil secimleri. Secilenler draft.choices icinde
 * "lineage:<grup>" ve "background:<secim>" anahtarlariyla saklanir.
 */
export function languageChoices(draft: CharacterDraft, catalog: EngineCatalog): LanguageChoice[] {
  const languages = catalog.content.languages;
  const { lineage, sublineage } = findLineage(catalog, draft);
  const fixedNames = new Set(
    [
      ...(sublineage?.facts.languages.values.length ? sublineage.facts.languages.values : lineage?.facts.languages.values ?? []),
      ...(catalog.content.backgrounds.find((entry) => entry.id === draft.backgroundId)?.languages.fixed ?? []).map(
        (id) => languages.find((language) => language.id === id)?.name ?? id,
      ),
    ].map((name) => name.toLowerCase()),
  );
  const pool = (filter: "any" | "standard" | "exotic" | string[]) =>
    (Array.isArray(filter)
      ? filter.map((value) => languages.find((language) => language.id === value || language.name === value)?.name ?? value)
      : languages.filter((language) => filter === "any" || language.category === filter).map((language) => language.name)
    ).filter((name) => !fixedNames.has(name.toLowerCase()));

  const entries: Omit<LanguageChoice, "selectedNames">[] = [
    ...lineageLanguageGroups(catalog, draft).map(({ group, sourceName }) => ({
      id: `lineage:${group.id}`,
      label: group.name,
      sourceName,
      count: Math.max(1, group.maxSelections),
      options: pool("any"),
    })),
    ...(catalog.content.backgrounds.find((entry) => entry.id === draft.backgroundId)?.languages.choices ?? []).map((choice) => ({
      id: `background:${choice.id}`,
      label: choice.label,
      sourceName: catalog.content.backgrounds.find((entry) => entry.id === draft.backgroundId)?.name ?? "Background",
      count: choice.count,
      options: pool(choice.options),
    })),
  ];

  // Ayni dil iki farkli secimde secilmesin.
  const taken = new Set<string>();
  return entries.map((entry) => {
    const allowed = new Set(entry.options);
    const selectedNames = (draft.choices?.[entry.id] ?? [])
      .filter((name) => allowed.has(name) && !taken.has(name))
      .slice(0, entry.count);
    selectedNames.forEach((name) => taken.add(name));
    return { ...entry, selectedNames };
  });
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

  const pickedLanguages = languageChoices(draft, catalog).filter((entry) => entry.selectedNames.length);
  pickedLanguages.forEach((entry) => {
    sources.push({
      kind: entry.id.startsWith("lineage:") ? "lineage" : "background",
      id: entry.id,
      name: entry.sourceName,
      summary: entry.label,
      showAsFeature: false,
      grants: [{ type: "proficiency", category: "language", values: entry.selectedNames }],
    });
  });

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
  // Feat'lerin tek yolu: ASI secimleri (lineage ve background feat'leri grant olarak asagida zincirlenir).
  asiFeatIds(catalog, draft).forEach((featId) => {
    if (featIds.has(featId)) {
      return;
    }
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
