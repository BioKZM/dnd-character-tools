import fs from "node:fs";
import path from "node:path";
import type { ContentBundle } from "@/lib/content/schema";

export type SpellReferenceEntry = {
  id: string;
  name: string;
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
  spellLists: string[];
};

export type SpellReferenceCollection = Record<string, SpellReferenceEntry>;

const GENERATED_REFERENCE_PATH = path.join(
  process.cwd(),
  "content",
  "manual",
  "spell_references.generated.json",
);

function cleanReferenceText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€”|â€“/g, "-")
    .replace(/Ã‚/g, " ")
    .replace(/Ãƒâ€š/g, " ")
    .replace(/Ã¢â‚¬â„¢|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€Â¢/g, "'")
    .replace(/Ã¢â‚¬Å“|Ã¢â‚¬Â|ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, '"')
    .replace(/Ã¢â‚¬â€œ|Ã¢â‚¬â€|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“|ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "-")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugifySpellName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripMarkdownDecorators(value: string) {
  return value
    .replace(/\*\*_?At Higher Levels\._?\*\*\s*/i, "")
    .replace(/\*\*_?Spell Lists\._?\*\*\s*/i, "")
    .replace(/\*\*_?(.+?)_?\*\*/g, "$1")
    .replace(/^_(.+)_$/gm, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeSpellListLabel(value: string) {
  return cleanReferenceText(value)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s*\((optional|ritual)\)\s*/gi, "")
    .trim();
}

function parseSpellLevelFromSubtitle(subtitle?: string) {
  if (!subtitle) {
    return 0;
  }

  if (/cantrip/i.test(subtitle)) {
    return 0;
  }

  const match = subtitle.match(/(\d+)(?:st|nd|rd|th)-level/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseSpellSchoolFromSubtitle(subtitle?: string) {
  if (!subtitle) {
    return "Abjuration";
  }

  const cleaned = cleanReferenceText(subtitle)
    .replace(/\(.*?\)/g, "")
    .replace(/^\d+(?:st|nd|rd|th)-level\s+/i, "")
    .replace(/^cantrip\s*/i, "")
    .trim();

  return cleaned ? toTitleCase(cleaned) : "Abjuration";
}

function normalizeSpellReferenceEntry(entry: SpellReferenceEntry): SpellReferenceEntry {
  return {
    ...entry,
    id: slugifySpellName(entry.id || entry.name),
    name: cleanReferenceText(entry.name),
    source: entry.source ? cleanReferenceText(entry.source) : undefined,
    subtitle: entry.subtitle ? cleanReferenceText(entry.subtitle) : undefined,
    castingTime: entry.castingTime ? cleanReferenceText(entry.castingTime) : undefined,
    range: entry.range ? cleanReferenceText(entry.range) : undefined,
    components: entry.components ? cleanReferenceText(entry.components) : undefined,
    duration: entry.duration ? cleanReferenceText(entry.duration) : undefined,
    summary: (entry.summary ?? []).map((item) => cleanReferenceText(item)).filter(Boolean),
    detailLines: (entry.detailLines ?? []).map((item) => cleanReferenceText(item)).filter(Boolean),
    detailTables: (entry.detailTables ?? []).map((table) => ({
      headers: (table.headers ?? []).map((item) => cleanReferenceText(item)).filter(Boolean),
      rows: (table.rows ?? []).map((row) => row.map((cell) => cleanReferenceText(cell)).filter(Boolean)),
    })),
    atHigherLevels: entry.atHigherLevels ? cleanReferenceText(entry.atHigherLevels) : undefined,
    spellLists: unique((entry.spellLists ?? []).map((item) => normalizeSpellListLabel(item)).filter(Boolean)),
  };
}

function normalizeSpellReferenceCollection(collection: SpellReferenceCollection) {
  return Object.fromEntries(
    Object.entries(collection).map(([key, value]) => [slugifySpellName(key), normalizeSpellReferenceEntry(value)]),
  ) as SpellReferenceCollection;
}

function parseSpellBlock(name: string, body: string): SpellReferenceEntry {
  const cleanedBody = cleanReferenceText(body);
  const chunks = cleanedBody
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const entry: SpellReferenceEntry = {
    id: slugifySpellName(name),
    name: name.trim(),
    summary: [],
    detailLines: [],
    detailTables: [],
    spellLists: [],
  };
  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      continue;
    }

    const firstLine = stripMarkdownDecorators(lines[0]);

    if (/^Source:/i.test(firstLine)) {
      entry.source = firstLine.replace(/^Source:\s*/i, "").trim();
      continue;
    }

    if (/^_.+_$/.test(lines[0])) {
      entry.subtitle = stripMarkdownDecorators(lines[0]);
      continue;
    }

    const metadataLines = lines.filter((line) =>
      /^(\*\*)?(Casting Time|Range|Components|Duration):/i.test(stripMarkdownDecorators(line)),
    );
    if (metadataLines.length === lines.length) {
      for (const line of metadataLines) {
        const normalizedLine = stripMarkdownDecorators(line);
        if (/^Casting Time:/i.test(normalizedLine)) {
          entry.castingTime = normalizedLine.replace(/^Casting Time:\s*/i, "").trim();
        } else if (/^Range:/i.test(normalizedLine)) {
          entry.range = normalizedLine.replace(/^Range:\s*/i, "").trim();
        } else if (/^Components:/i.test(normalizedLine)) {
          entry.components = normalizedLine.replace(/^Components:\s*/i, "").trim();
        } else if (/^Duration:/i.test(normalizedLine)) {
          entry.duration = normalizedLine.replace(/^Duration:\s*/i, "").trim();
        }
      }
      continue;
    }

    if (/^\*\*_?At Higher Levels\._?\*\*/i.test(lines[0])) {
      entry.atHigherLevels = stripMarkdownDecorators(lines.join(" "));
      continue;
    }

    if (/^\*\*_?Spell Lists\._?\*\*/i.test(lines[0])) {
      entry.spellLists = stripMarkdownDecorators(lines.join(" "))
        .split(",")
        .map((item) => normalizeSpellListLabel(item))
        .filter(Boolean);
      continue;
    }

    if (lines.every((line) => /^\|.+\|$/.test(line))) {
      const parsedRows = lines
        .map((line) =>
          line
            .split("|")
            .map((cell) => stripMarkdownDecorators(cell.trim()))
            .filter(Boolean),
        )
        .filter((row) => row.length > 1);

      if (parsedRows.length >= 2) {
        const separatorLike = parsedRows[1].every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s+/g, "")));
        const headers = parsedRows[0];
        const rows = separatorLike ? parsedRows.slice(2) : parsedRows.slice(1);
        if (headers.length && rows.length) {
          entry.detailTables.push({ headers, rows });
        }
      }
      continue;
    }

    if (lines.every((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))) {
      entry.detailLines.push(
        ...lines.map((line) =>
          stripMarkdownDecorators(line.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "")),
        ),
      );
      continue;
    }

    entry.summary.push(stripMarkdownDecorators(lines.join(" ")));
  }

  return entry;
}

function readSpellReferenceFiles() {
  const root = process.cwd();
  const preferredDirectory = path.join(root, "src", "app", "docs", "spells");
  const fallbackDirectories = [root, path.join(root, "app", "docs", "spells")];
  const candidateDirectory = fs.existsSync(preferredDirectory)
    ? preferredDirectory
    : fallbackDirectories.find((directory) => fs.existsSync(directory));

  if (!candidateDirectory) {
    return [];
  }

  return fs
    .readdirSync(candidateDirectory)
    .filter((fileName) => /^spells(?:[_-][a-z0-9-]+)?\.md$/i.test(fileName) || /^cantrips\.md$/i.test(fileName))
    .sort((left, right) => {
      if (left.toLowerCase() === "spells.md") return -1;
      if (right.toLowerCase() === "spells.md") return 1;
      if (left.toLowerCase() === "cantrips.md") return -1;
      if (right.toLowerCase() === "cantrips.md") return 1;
      return left.localeCompare(right);
    })
    .map((fileName) => path.join(candidateDirectory, fileName));
}

export function readSpellReferenceCollection(): SpellReferenceCollection {
  if (fs.existsSync(GENERATED_REFERENCE_PATH)) {
    const raw = fs.readFileSync(GENERATED_REFERENCE_PATH, "utf-8");
    return normalizeSpellReferenceCollection(JSON.parse(raw) as SpellReferenceCollection);
  }

  const collection: SpellReferenceCollection = {};
  const spellFiles = readSpellReferenceFiles();

  for (const absolutePath of spellFiles) {
    const raw = fs.readFileSync(absolutePath, "utf-8");
    const normalized = cleanReferenceText(raw);
    const pattern = /^===\s*(.+?)\s*===\s*\n([\s\S]*?)(?=^===\s*.+?\s*===\s*\n?|$)/gm;

    let match = pattern.exec(normalized);
    while (match) {
      const [, name, body] = match;
      const entry = parseSpellBlock(name, body);
      collection[entry.id] = entry;
      match = pattern.exec(normalized);
    }
  }

  return normalizeSpellReferenceCollection(collection);
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

      const classes = reference?.spellLists?.length
        ? unique(reference.spellLists.map((item) => item.replace(/\s*\(.*?\)\s*/g, "").trim()).filter(Boolean))
        : normalizedSpell?.classes;

      const mergedSpell: ContentBundle["spells"][number] = {
        id: reference?.id ?? normalizedSpell?.id ?? spellId,
        name: reference?.name ?? normalizedSpell?.name ?? spellId,
        level: normalizedSpell?.level ?? parseSpellLevelFromSubtitle(reference?.subtitle),
        school: normalizedSpell?.school ?? parseSpellSchoolFromSubtitle(reference?.subtitle),
        castingTime: reference?.castingTime ?? normalizedSpell?.castingTime ?? "",
        range: reference?.range ?? normalizedSpell?.range ?? "",
        duration: reference?.duration ?? normalizedSpell?.duration ?? "",
        summary: reference?.summary?.length ? reference.summary.join("\n\n") : normalizedSpell?.summary ?? "",
        source: reference?.source ?? normalizedSpell?.source,
        classes,
        subclassOptions: normalizedSpell?.subclassOptions ?? [],
      };

      return mergedSpell;
    })
    .filter((spell): spell is NonNullable<typeof spell> => Boolean(spell))
    .sort((left, right) => (left.level === right.level ? left.name.localeCompare(right.name) : left.level - right.level));

  return {
    ...content,
    spells: mergedSpells,
  };
}
