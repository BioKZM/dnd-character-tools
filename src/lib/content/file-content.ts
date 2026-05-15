import fs from "node:fs";
import path from "node:path";
import { creatorOptionsSchema, type CreatorOptions } from "@/lib/content/creator-options";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { classCuratedEntrySchema } from "@/lib/content/class-curated-schema";
import { contentBundleSchema, type ContentBundle } from "@/lib/content/schema";
import { readSpellDataCatalog } from "@/lib/data/spells/content";

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(process.cwd(), "data", relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

function lineageTraitsAsSpeciesTraits(
  traits: { id: string; name: string; summary: string }[],
  stats: { label: string; value: string }[],
  bonuses?: string[],
) {
  return [
    ...traits.map((trait) => ({
      id: trait.id,
      name: trait.name,
      summary: trait.summary,
    })),
    ...stats.map((stat, index) => ({
      id: `stat-${index}-${stat.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: stat.label,
      summary: stat.value,
    })),
    ...(bonuses ?? []).map((bonus, index) => ({
      id: `bonus-${index}`,
      name: `Bonus ${index + 1}`,
      summary: bonus,
    })),
  ];
}

function mergeSpeciesWithLineages(species: ContentBundle["species"] = []): ContentBundle["species"] {
  const lineageCollection = readLineageCollection();
  const speciesMap = new Map(species.map((entry) => [entry.id, entry]));

  for (const lineage of lineageCollection.entries) {
    if (!speciesMap.has(lineage.id)) {
      speciesMap.set(lineage.id, {
        id: lineage.id,
        name: lineage.name,
        traits: lineageTraitsAsSpeciesTraits(lineage.coreTraits, lineage.stats),
        source: lineage.sourceLabel,
      });
    }

    for (const subrace of lineage.subraces) {
      if (speciesMap.has(subrace.id)) {
        continue;
      }

      speciesMap.set(subrace.id, {
        id: subrace.id,
        name: subrace.name,
        traits: lineageTraitsAsSpeciesTraits(subrace.traits, subrace.stats, subrace.bonuses),
        source: subrace.source ?? lineage.sourceLabel,
      });
    }
  }

  return Array.from(speciesMap.values());
}

function readGroupedClasses(): ContentBundle["classes"] {
  const root = path.join(process.cwd(), "data", "classes");
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "data.json"))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) =>
      classCuratedEntrySchema.parse(JSON.parse(fs.readFileSync(absolutePath, "utf-8"))),
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      hitDie: Number.parseInt(entry.hitDie.replace(/[^0-9]/g, ""), 10) || 0,
      primaryAbilities:
        entry.id === "bard"
          ? ["CHA"]
          : entry.id === "fighter"
            ? ["STR", "DEX"]
            : entry.id === "ranger"
              ? ["DEX", "WIS"]
              : entry.id === "warlock"
                ? ["CHA"]
                : [],
      savingThrows:
        entry.id === "bard"
          ? ["DEX", "CHA"]
          : entry.id === "fighter"
            ? ["STR", "CON"]
            : entry.id === "ranger"
              ? ["STR", "DEX"]
              : entry.id === "warlock"
                ? ["WIS", "CHA"]
                : [],
      featuresByLevel: entry.classFeatures.reduce<Record<string, { id: string; name: string; summary: string }[]>>(
        (accumulator, feature) => {
          const levelMatch = entry.spellcastingTable.rows.find((row) => row[2]?.includes(feature.name));
          const level = levelMatch?.[0]?.match(/^(\d+)/)?.[1] ?? "1";
          accumulator[level] ??= [];
          accumulator[level].push(feature);
          return accumulator;
        },
        {},
      ),
      source: "Player's Handbook",
      multiclassRequirement: entry.multiclassRequirement,
    }));
}

export function readNormalizedContent(): ContentBundle {
  const spellCatalog = readSpellDataCatalog();
  const bundle = {
    sourceBooks: readJsonFile("source-books.json"),
    classes: readGroupedClasses(),
    species: mergeSpeciesWithLineages(),
    backgrounds: readJsonFile("backgrounds.json"),
    languages: readJsonFile("languages.json"),
    tools: readJsonFile("tools.json"),
    items: readJsonFile("items.json"),
    armors: readJsonFile("armors.json"),
    weapons: readJsonFile("weapons.json"),
    weaponProperties: readJsonFile("weapon-properties.json"),
    feats: readJsonFile("feats.json"),
    spells: spellCatalog.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      level: entry.level,
      school: entry.school,
      subtitle: entry.subtitle,
      castingTime: entry.castingTime ?? "",
      range: entry.range ?? "",
      components: entry.components,
      duration: entry.duration ?? "",
      summary: entry.summary.join("\n\n"),
      detailLines: entry.detailLines,
      detailTables: entry.detailTables,
      atHigherLevels: entry.atHigherLevels,
      tags: entry.tags,
      source: entry.source,
      classes: entry.classes,
      subclassOptions: entry.subclassOptions,
    })),
  };

  return contentBundleSchema.parse(bundle);
}

export function readCreatorOptions(): CreatorOptions {
  return creatorOptionsSchema.parse(readJsonFile("creator-options.json"));
}
