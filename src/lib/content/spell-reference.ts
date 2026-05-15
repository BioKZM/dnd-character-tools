import type { ContentBundle } from "@/lib/content/schema";
import { readSpellDataCatalog } from "@/lib/data/spells/content";

export type SpellReferenceEntry = {
  id: string;
  name: string;
  level: number;
  school: string;
  source?: string;
  subtitle?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  summary: string[];
  detailLines: string[];
  detailTables: { headers: string[]; rows: string[][] }[];
  atHigherLevels?: string;
  tags: string[];
  classes: string[];
  subclassOptions: string[];
};

export type SpellReferenceCollection = Record<string, SpellReferenceEntry>;

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function readSpellReferenceCollection(): SpellReferenceCollection {
  const catalog = readSpellDataCatalog();
  return Object.fromEntries(catalog.entries.map((entry) => [entry.id, entry]));
}

export function mergeSpellReferencesIntoContent(
  content: ContentBundle,
  references: SpellReferenceCollection,
): ContentBundle {
  const normalizedSpellMap = new Map(content.spells.map((spell) => [spell.id, spell] as const));
  const mergedSpellIds = unique([...normalizedSpellMap.keys(), ...Object.keys(references)]);
  const mergedSpells: ContentBundle["spells"] = mergedSpellIds
    .map((spellId) => {
      const normalizedSpell = normalizedSpellMap.get(spellId);
      const reference =
        references[spellId] ??
        (normalizedSpell
          ? references[
              normalizedSpell.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")
            ]
          : undefined);

      if (!normalizedSpell && !reference) {
        return null;
      }

      const classes = reference?.classes?.length ? unique(reference.classes.filter(Boolean)) : normalizedSpell?.classes;

      return {
        id: reference?.id ?? normalizedSpell?.id ?? spellId,
        name: reference?.name ?? normalizedSpell?.name ?? spellId,
        level: reference?.level ?? normalizedSpell?.level ?? 0,
        school: reference?.school ?? normalizedSpell?.school ?? "Abjuration",
        subtitle: reference?.subtitle ?? normalizedSpell?.subtitle,
        castingTime: reference?.castingTime ?? normalizedSpell?.castingTime ?? "",
        range: reference?.range ?? normalizedSpell?.range ?? "",
        components: reference?.components ?? normalizedSpell?.components,
        duration: reference?.duration ?? normalizedSpell?.duration ?? "",
        summary: reference?.summary?.length ? reference.summary.join("\n\n") : normalizedSpell?.summary ?? "",
        detailLines: reference?.detailLines ?? normalizedSpell?.detailLines ?? [],
        detailTables: reference?.detailTables ?? normalizedSpell?.detailTables ?? [],
        atHigherLevels: reference?.atHigherLevels ?? normalizedSpell?.atHigherLevels,
        tags: reference?.tags?.length ? unique(reference.tags.filter(Boolean)) : normalizedSpell?.tags,
        source: reference?.source ?? normalizedSpell?.source,
        classes,
        subclassOptions: reference?.subclassOptions?.length ? reference.subclassOptions : normalizedSpell?.subclassOptions ?? [],
      } satisfies ContentBundle["spells"][number];
    })
    .filter((spell): spell is NonNullable<typeof spell> => Boolean(spell))
    .sort((left, right) => (left.level === right.level ? left.name.localeCompare(right.name) : left.level - right.level));

  return {
    ...content,
    spells: mergedSpells,
  };
}
