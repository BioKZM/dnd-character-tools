import fs from "node:fs";
import path from "node:path";
import {
  classCuratedCollectionSchema,
  classCuratedEntrySchema,
  resolvedClassCuratedEntrySchema,
  type ClassCuratedCollection,
  type ClassCuratedEntry,
  type ClassCuratedSubclass,
  type ResolvedClassCuratedEntry,
} from "@/lib/content/class-curated-schema";

const ROOT = path.join(process.cwd(), "data", "classes");
const ENABLED_CLASS_IDS = ["fighter", "ranger", "warlock", "bard"] as const;
const ENABLED_SUBCLASS_IDS_BY_CLASS: Record<string, string[]> = {
  fighter: ["eldritch-knight"],
  ranger: ["horizon-walker"],
  warlock: ["great-old-one"],
  bard: ["whispers"],
};

function readClassJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

function readSubclass(classId: string, subclassId: string) {
  return resolvedClassCuratedEntrySchema.shape.subclasses.element.parse(
    readClassJsonFile<ClassCuratedSubclass>(path.join(classId, "subclasses", `${subclassId}.json`)),
  );
}

function readClassEntry(classId: string): ResolvedClassCuratedEntry {
  const entry = classCuratedEntrySchema.parse(
    readClassJsonFile<ClassCuratedEntry>(path.join(classId, "data.json")),
  );

  return resolvedClassCuratedEntrySchema.parse({
    ...entry,
    subclasses: entry.subclasses
      .filter((subclassId) => (ENABLED_SUBCLASS_IDS_BY_CLASS[classId] ?? entry.subclasses).includes(subclassId))
      .filter((subclassId) => fs.existsSync(path.join(ROOT, classId, "subclasses", `${subclassId}.json`)))
      .map((subclassId) => readSubclass(classId, subclassId)),
  });
}

export function readClassCuratedCollection(): ClassCuratedCollection {
  if (!fs.existsSync(ROOT)) {
    return classCuratedCollectionSchema.parse({ entries: [] });
  }

  const classIds = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => ENABLED_CLASS_IDS.includes(entry.name as (typeof ENABLED_CLASS_IDS)[number]))
    .filter((entry) => fs.existsSync(path.join(ROOT, entry.name, "data.json")))
    .map((entry) => entry.name);

  return classCuratedCollectionSchema.parse({
    entries: classIds.map((classId) => readClassEntry(classId)),
  });
}
