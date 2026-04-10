import fs from "node:fs";
import path from "node:path";
import {
  lineageCollectionSchema,
  lineageEntrySchema,
  subraceSchema,
  type LineageCollection,
  type LineageEntry,
  type ResolvedLineageEntry,
  type SubraceEntry,
} from "@/lib/content/lineage-schema";

const LINEAGE_ROOTS = [
  path.join(process.cwd(), "content", "lineages-curated"),
  path.join(process.cwd(), "content", "lineages"),
];

function resolveLineagePath(relativePath: string) {
  for (const root of LINEAGE_ROOTS) {
    const absolutePath = path.join(root, relativePath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
  }

  return path.join(LINEAGE_ROOTS[0], relativePath);
}

function readLineageJsonFile<T>(relativePath: string): T {
  const absolutePath = resolveLineagePath(relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

function readSubrace(lineageId: string, subraceId: string) {
  return subraceSchema.parse(readLineageJsonFile<SubraceEntry>(path.join(lineageId, subraceId, "data.json")));
}

function readLineage(lineageId: string): ResolvedLineageEntry {
  const entry = lineageEntrySchema.parse(readLineageJsonFile<LineageEntry>(path.join(lineageId, "data.json")));

  return {
    ...entry,
    subraces: entry.subraces.map((subraceId) => readSubrace(lineageId, subraceId)),
  };
}

export function readLineageCollection(): LineageCollection {
  const lineageIds = Array.from(
    new Set(
      LINEAGE_ROOTS.flatMap((root) => {
        if (!fs.existsSync(root)) {
          return [];
        }

        return fs
          .readdirSync(root, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .filter((entry) => fs.existsSync(path.join(root, entry.name, "data.json")))
          .map((entry) => entry.name);
      }),
    ),
  );

  return lineageCollectionSchema.parse({
    entries: lineageIds.map((lineageId) => readLineage(lineageId)),
  });
}
