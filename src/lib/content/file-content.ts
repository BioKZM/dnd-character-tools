import fs from "node:fs";
import path from "node:path";
import { creatorOptionsSchema, type CreatorOptions } from "@/lib/content/creator-options";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { contentBundleSchema, type ContentBundle } from "@/lib/content/schema";

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(process.cwd(), "content", "normalized", relativePath);
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

function mergeSpeciesWithLineages(species: ContentBundle["species"]): ContentBundle["species"] {
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

export function readNormalizedContent(): ContentBundle {
  const bundle = {
    sourceBooks: readJsonFile("source-books.json"),
    classes: readJsonFile("classes.json"),
    species: mergeSpeciesWithLineages(readJsonFile("species.json")),
    backgrounds: readJsonFile("backgrounds.json"),
    feats: readJsonFile("feats.json"),
    spells: readJsonFile("spells.json"),
  };

  return contentBundleSchema.parse(bundle);
}

export function readCreatorOptions(): CreatorOptions {
  return creatorOptionsSchema.parse(readJsonFile("creator-options.json"));
}
