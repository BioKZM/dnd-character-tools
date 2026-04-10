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

const ROOT = path.join(process.cwd(), "content", "classes-curated");

function readClassJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(ROOT, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

function readSubclass(classId: string, subclassId: string) {
  const subclass = readClassJsonFile<ClassCuratedSubclass>(path.join(classId, subclassId, "data.json"));
  const pagePath = path.join(ROOT, classId, subclassId, "page.html");
  const pageHtml = fs.existsSync(pagePath) ? fs.readFileSync(pagePath, "utf-8") : "";

  return resolvedClassCuratedEntrySchema.shape.subclasses.element.parse({
    ...subclass,
    expandedSpells: extractExpandedSpellList(pageHtml),
  });
}

function cleanHtmlText(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractExpandedSpellList(pageHtml: string) {
  if (!pageHtml.includes("Expanded Spell List")) {
    return [];
  }

  const sectionMatch = pageHtml.match(/Expanded Spell List[\s\S]*?<table class="wiki-content-table">([\s\S]*?)<\/table>/i);
  if (!sectionMatch) {
    return [];
  }

  const rowMatches = [...sectionMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
  return rowMatches
    .slice(1)
    .map((match) => {
      const cells = [...match[1].matchAll(/<td>([\s\S]*?)<\/td>/gi)].map((cell) => cleanHtmlText(cell[1]));
      if (cells.length < 2) {
        return null;
      }

      const unlockLevel = Number.parseInt(cells[0].replace(/\D/g, ""), 10);
      if (!Number.isFinite(unlockLevel) || unlockLevel <= 0) {
        return null;
      }

      const spells = cells[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

      return {
        unlockLevel,
        spells,
      };
    })
    .filter((entry): entry is { unlockLevel: number; spells: string[] } => Boolean(entry));
}

function readClassEntry(classId: string): ResolvedClassCuratedEntry {
  const entry = classCuratedEntrySchema.parse(
    readClassJsonFile<ClassCuratedEntry>(path.join(classId, "data.json")),
  );

  return resolvedClassCuratedEntrySchema.parse({
    ...entry,
    subclasses: entry.subclasses
      .filter((subclassId) => fs.existsSync(path.join(ROOT, classId, subclassId, "data.json")))
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
    .filter((entry) => fs.existsSync(path.join(ROOT, entry.name, "data.json")))
    .map((entry) => entry.name);

  return classCuratedCollectionSchema.parse({
    entries: classIds.map((classId) => readClassEntry(classId)),
  });
}
