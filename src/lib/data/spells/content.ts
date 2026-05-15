import fs from "node:fs";
import path from "node:path";
import { spellDataCatalogSchema, type SpellDataCatalog, type SpellDataEntry } from "@/lib/data/spells/schema";

const SPELL_DATA_PATH = path.join(process.cwd(), "data", "spells", "catalog.json");

function cleanReferenceText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€Â¢/g, "'")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, '"')
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“/g, "-")
    .replace(/ÃƒÆ’Ã¢â‚¬Å¡/g, " ")
    .replace(/ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡/g, " ")
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬ÂÃ‚Â¢|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â¢/g, "'")
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“|ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, '"')
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ|ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“|ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â/g, "-")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeSpellDataEntry(entry: SpellDataEntry): SpellDataEntry {
  return {
    ...entry,
    name: cleanReferenceText(entry.name),
    school: cleanReferenceText(entry.school),
    source: entry.source ? cleanReferenceText(entry.source) : undefined,
    subtitle: entry.subtitle ? cleanReferenceText(entry.subtitle) : undefined,
    castingTime: entry.castingTime ? cleanReferenceText(entry.castingTime) : undefined,
    range: entry.range ? cleanReferenceText(entry.range) : undefined,
    components: entry.components ? cleanReferenceText(entry.components) : undefined,
    duration: entry.duration ? cleanReferenceText(entry.duration) : undefined,
    summary: entry.summary.map((item) => cleanReferenceText(item)).filter(Boolean),
    detailLines: entry.detailLines.map((item) => cleanReferenceText(item)).filter(Boolean),
    detailTables: entry.detailTables.map((table) => ({
      headers: table.headers.map((item) => cleanReferenceText(item)).filter(Boolean),
      rows: table.rows.map((row) => row.map((cell) => cleanReferenceText(cell)).filter(Boolean)),
    })),
    atHigherLevels: entry.atHigherLevels ? cleanReferenceText(entry.atHigherLevels) : undefined,
    tags: unique(entry.tags.map((item) => cleanReferenceText(item)).filter(Boolean)),
    classes: unique(entry.classes.map((item) => cleanReferenceText(item)).filter(Boolean)),
    subclassOptions: unique(entry.subclassOptions.map((item) => cleanReferenceText(item)).filter(Boolean)),
  };
}

export function readSpellDataCatalog(): SpellDataCatalog {
  if (!fs.existsSync(SPELL_DATA_PATH)) {
    throw new Error(`Missing spell data catalog at ${SPELL_DATA_PATH}`);
  }

  const raw = fs.readFileSync(SPELL_DATA_PATH, "utf-8");
  const parsed = spellDataCatalogSchema.parse(JSON.parse(raw) as SpellDataCatalog);
  return {
    entries: parsed.entries.map(normalizeSpellDataEntry),
  };
}
