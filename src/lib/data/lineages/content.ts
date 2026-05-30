import fs from "node:fs";
import path from "node:path";
import { lineageCatalogSchema, lineageEntrySchema, type LineageCatalog, type LineageEntry } from "@/lib/data/lineages/schema";

const LINEAGE_DATA_ROOT = path.join(process.cwd(), "data", "lineages");
const ENABLED_LINEAGE_IDS = ["human", "elf", "eladrin", "tabaxi"] as const;
const ENABLED_SUBLINEAGE_IDS_BY_LINEAGE: Record<string, string[]> = {
  elf: ["high-elf"],
  human: ["variant-human"],
};

function readLineageFile(relativePath: string) {
  const absolutePath = path.join(LINEAGE_DATA_ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as unknown;
}

export function readLineageDataEntry(lineageId: string): LineageEntry {
  return filterLineageEntry(lineageEntrySchema.parse(readLineageFile(path.join(lineageId, "data.json"))));
}

function filterLineageEntry(entry: LineageEntry): LineageEntry {
  const enabledSublineageIds = ENABLED_SUBLINEAGE_IDS_BY_LINEAGE[entry.id];
  if (!enabledSublineageIds) {
    return entry;
  }

  const sublineages = entry.sublineages.filter((sublineage) => enabledSublineageIds.includes(sublineage.id));
  const referencedChoiceGroupIds = new Set<string>();
  entry.features.forEach((feature) => feature.choiceGroupIds?.forEach((choiceGroupId) => referencedChoiceGroupIds.add(choiceGroupId)));
  sublineages.forEach((sublineage) => {
    sublineage.features.forEach((feature) =>
      feature.choiceGroupIds?.forEach((choiceGroupId) => referencedChoiceGroupIds.add(choiceGroupId)),
    );
  });

  return lineageEntrySchema.parse({
    ...entry,
    sublineages,
    choiceGroups: entry.choiceGroups.filter((choiceGroup) => referencedChoiceGroupIds.has(choiceGroup.id)),
  });
}

export function readLineageDataCatalog(): LineageCatalog {
  if (!fs.existsSync(LINEAGE_DATA_ROOT)) {
    return lineageCatalogSchema.parse({ entries: [] });
  }

  const entries = fs
    .readdirSync(LINEAGE_DATA_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => ENABLED_LINEAGE_IDS.includes(entry.name as (typeof ENABLED_LINEAGE_IDS)[number]))
    .map((entry) => path.join(entry.name, "data.json"))
    .filter((relativePath) => fs.existsSync(path.join(LINEAGE_DATA_ROOT, relativePath)))
    .map((relativePath) => filterLineageEntry(lineageEntrySchema.parse(readLineageFile(relativePath))));

  return lineageCatalogSchema.parse({ entries });
}
