import fs from "node:fs";
import path from "node:path";

export type ClassDocOption = {
  id: string;
  name: string;
  summary: string;
};

export type ClassDocBlock = {
  heading: string | null;
  paragraphs: string[];
};

export type ClassDocTable = {
  title: string | null;
  groupedHeaders?: string[];
  headers: string[];
  rows: string[][];
};

export type ClassDocSpellGrant = {
  unlockLevel: number;
  spells: string[];
};

export type ClassDocSection = {
  id: string;
  name: string;
  summary: string;
  blocks: ClassDocBlock[];
  tables: ClassDocTable[];
  options: ClassDocOption[];
  level?: number;
};

export type ClassDocChoiceGroup = {
  id: string;
  name: string;
  source: "base" | "subclass";
  subclassId?: string;
  level?: number;
  summary: string;
  blocks: ClassDocBlock[];
  tables: ClassDocTable[];
  options: ClassDocOption[];
};

export type ClassSubclassDoc = {
  id: string;
  name: string;
  summary: string;
  source: string;
  sections: ClassDocSection[];
  grantedSpells: ClassDocSpellGrant[];
  choiceGroups: ClassDocChoiceGroup[];
};

export type ClassDocEntry = {
  classId: string;
  baseSections: Record<string, string>;
  baseSectionEntries: Record<string, ClassDocSection>;
  baseChoiceGroups: ClassDocChoiceGroup[];
  subclasses: ClassSubclassDoc[];
  baseGrantedSpells?: ClassDocSpellGrant[];
};

export type ClassDocCollection = Record<string, ClassDocEntry>;

const ROOT = path.join(process.cwd(), "src", "app", "docs", "classes");

const CLASS_DOC_CONFIG = {
  bard: {
    baseFile: path.join(ROOT, "bard", "Bard.md"),
    subclassDir: path.join(ROOT, "bard", "subclasses"),
    subclassPrefix: /^bard\s*:/i,
  },
  ranger: {
    baseFile: path.join(ROOT, "ranger", "Ranger.md"),
    baseSpellFile: path.join(ROOT, "ranger", "Ranger Spells.md"),
    subclassDir: path.join(ROOT, "ranger", "subclasses"),
    subclassPrefix: /^ranger\s*:/i,
  },
  fighter: {
    baseFile: path.join(ROOT, "fighter", "Fighter.md"),
    subclassDir: path.join(ROOT, "fighter", "Subclasses"),
    subclassPrefix: /^fighter\s*:/i,
  },
} as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/Ã‚/g, " ")
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“|Ã¢â‚¬Â/g, '"')
    .replace(/Ã¢â‚¬â€|Ã¢â‚¬â€œ/g, "-")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLevelFromHeading(value: string) {
  const match = value.match(/(\d+)(?:st|nd|rd|th)\s+level/i);
  return match ? Number(match[1]) : undefined;
}

function subclassMatchSlug(value: string) {
  return slugify(
    value
      .replace(/\b(conclave|archetype|college|domain|circle|oath|tradition|path|spells)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function splitSections(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading) {
        sections.push({
          heading: cleanMarkdownText(currentHeading),
          body: currentBody.join("\n").trim(),
        });
      }
      currentHeading = headingMatch[1];
      currentBody = [];
      continue;
    }

    if (currentHeading) {
      currentBody.push(line);
    }
  }

  if (currentHeading) {
    sections.push({
      heading: cleanMarkdownText(currentHeading),
      body: currentBody.join("\n").trim(),
    });
  }

  return sections;
}

function parseBulletOptions(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const options: ClassDocOption[] = [];
  let current: ClassDocOption | null = null;

  for (const line of lines) {
    const bulletMatch = line.match(/^\s*-\s+\*\*(.+?)\.\*\*\s*(.*)$/) ?? line.match(/^\s*-\s+\*\*(.+?)\*\*\.\s*(.*)$/);
    if (bulletMatch) {
      if (current) {
        current.summary = cleanMarkdownText(current.summary);
        options.push(current);
      }
      current = {
        id: slugify(bulletMatch[1]),
        name: cleanMarkdownText(bulletMatch[1]),
        summary: bulletMatch[2] ?? "",
      };
      continue;
    }

    if (current && /^\s{2,}-\s+/.test(line)) {
      current.summary += ` ${line.replace(/^\s*-\s+/, "")}`;
      continue;
    }

    if (current && line.trim()) {
      current.summary += ` ${line.trim()}`;
    }
  }

  if (current) {
    current.summary = cleanMarkdownText(current.summary);
    options.push(current);
  }

  return options;
}

function isTableSeparator(line: string) {
  return /^\|?[\s:-|]+\|?$/.test(line.trim());
}

function parseMarkdownTables(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const tables: ClassDocTable[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim().startsWith("|")) {
      index += 1;
      continue;
    }

    const tableLines: string[] = [];
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      tableLines.push(lines[index].trim());
      index += 1;
    }

    const contentRows = tableLines
      .filter((line) => !isTableSeparator(line))
      .map((line) => line.split("|").slice(1, -1).map((cell) => cleanMarkdownText(cell)));

    if (!contentRows.length) {
      continue;
    }

    let title: string | null = null;
    let groupedHeaders: string[] | undefined;
    let headers = contentRows[0] ?? [];
    let rows = contentRows.slice(1);

    if (contentRows.length > 1 && contentRows[0].filter(Boolean).length <= 1) {
      title = contentRows[0].find(Boolean) ?? null;
      headers = contentRows[1] ?? [];
      rows = contentRows.slice(2);

      if (headers.filter(Boolean).length <= 1) {
        rows = [headers, ...rows].filter((row) => row.some(Boolean));
        headers = [];
      }
    } else if (contentRows.length > 2 && contentRows[1].filter(Boolean).length > contentRows[0].filter(Boolean).length) {
      groupedHeaders = contentRows[0];
      headers = contentRows[1] ?? [];
      rows = contentRows.slice(2);
    }

    tables.push({
      title,
      groupedHeaders,
      headers,
      rows,
    });
  }

  return tables;
}

function parseSectionBlocks(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: ClassDocBlock[] = [];
  let currentHeading: string | null = null;
  let currentParagraphs: string[] = [];

  const pushBlock = () => {
    const normalizedParagraphs = currentParagraphs.map((paragraph) => cleanMarkdownText(paragraph)).filter(Boolean);
    if (!normalizedParagraphs.length && !currentHeading) {
      return;
    }

    blocks.push({
      heading: currentHeading ? cleanMarkdownText(currentHeading) : null,
      paragraphs: normalizedParagraphs,
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("|")) {
      while (index + 1 < lines.length && lines[index + 1].trim().startsWith("|")) {
        index += 1;
      }
      continue;
    }

    const subheadingMatch = line.match(/^#{4,6}\s+(.+)$/);
    if (subheadingMatch) {
      pushBlock();
      currentHeading = subheadingMatch[1];
      currentParagraphs = [];
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      currentParagraphs.push(line.replace(/^\s*-\s+/, ""));
      continue;
    }

    currentParagraphs.push(line);
  }

  pushBlock();
  return blocks;
}

function parseSectionData(heading: string, body: string): ClassDocSection {
  const blocks = parseSectionBlocks(body);
  const tables = parseMarkdownTables(body);
  const options = parseBulletOptions(body);

  return {
    id: slugify(heading),
    name: heading,
    summary: cleanMarkdownText(body),
    blocks,
    tables,
    options,
    level: parseLevelFromHeading(body) ?? parseLevelFromHeading(heading),
  };
}

function parseSpellGrantsFromSections(sections: ClassDocSection[]) {
  const grants: ClassDocSpellGrant[] = [];

  for (const section of sections) {
    for (const table of section.tables) {
      const headerText = table.headers.map((cell) => cell.toLowerCase()).join(" | ");
      const looksLikeSpellGrantTable =
        headerText.includes("level") &&
        (headerText.includes("spell") || headerText.includes("spells"));

      if (!looksLikeSpellGrantTable) {
        continue;
      }

      for (const row of table.rows) {
        const levelCell = row[0] ?? "";
        const spellCell = row[1] ?? "";
        const unlockLevel = parseLevelFromHeading(levelCell);
        if (!unlockLevel || !spellCell) {
          continue;
        }

        grants.push({
          unlockLevel,
          spells: spellCell
            .split(/,\s*/)
            .map((spell) => cleanMarkdownText(spell))
            .filter(Boolean),
        });
      }
    }
  }

  return grants;
}

function mergeSpellGrants(...collections: Array<ClassDocSpellGrant[] | undefined>) {
  const grantMap = new Map<number, Set<string>>();

  for (const collection of collections) {
    for (const entry of collection ?? []) {
      if (!grantMap.has(entry.unlockLevel)) {
        grantMap.set(entry.unlockLevel, new Set());
      }
      const bucket = grantMap.get(entry.unlockLevel)!;
      for (const spell of entry.spells) {
        const cleaned = cleanMarkdownText(spell);
        if (cleaned) {
          bucket.add(cleaned);
        }
      }
    }
  }

  return [...grantMap.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([unlockLevel, spells]) => ({
      unlockLevel,
      spells: [...spells],
    }));
}

function parseSpellNamesFromReferenceMarkdown(markdown: string) {
  const names: string[] = [];
  const pattern = /^===\s*(.+?)\s*===\s*$/gm;
  let match = pattern.exec(markdown);

  while (match) {
    const name = cleanMarkdownText(match[1] ?? "");
    if (name) {
      names.push(name);
    }
    match = pattern.exec(markdown);
  }

  return names;
}

function parseSpellGrantsFromReferenceFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const spellNames = parseSpellNamesFromReferenceMarkdown(fs.readFileSync(filePath, "utf-8"));
  const unlockLevels = [3, 5, 9, 13, 17];

  return spellNames
    .slice(0, unlockLevels.length)
    .map((spellName, index) => ({
      unlockLevel: unlockLevels[index] ?? 0,
      spells: [spellName],
    }))
    .filter((entry) => entry.unlockLevel > 0 && entry.spells.length > 0);
}

function parseBaseDocs(markdown: string) {
  const sections = splitSections(markdown);
  const parsedSections = sections.map((section) => parseSectionData(section.heading, section.body));
  const baseSections = Object.fromEntries(parsedSections.map((section) => [section.id, section.summary])) as Record<string, string>;
  const baseSectionEntries = Object.fromEntries(parsedSections.map((section) => [section.id, section])) as Record<string, ClassDocSection>;
  const baseChoiceGroups = parsedSections
    .map((section) => ({
      id: section.id,
      name: section.name,
      source: "base" as const,
      level: section.level,
      summary: section.summary,
      blocks: section.blocks,
      tables: section.tables,
      options: section.options,
    }))
    .filter((section) => section.options.length > 0 || section.tables.length > 0);

  return {
    baseSections,
    baseSectionEntries,
    baseChoiceGroups,
  };
}

function parseSubclassDoc(filePath: string, prefix: RegExp): ClassSubclassDoc | null {
  const markdown = fs.readFileSync(filePath, "utf-8");
  const lines = markdown.replace(/\r/g, "").split("\n").filter(Boolean);
  const title = cleanMarkdownText(lines[0] ?? path.basename(filePath, ".md"));
  if (!prefix.test(title)) {
    return null;
  }
  const summary = cleanMarkdownText(lines[1] ?? "");
  const sourceLine = lines.find((line) => line.startsWith("Source:")) ?? "";
  const source = cleanMarkdownText(sourceLine.replace(/^Source:\s*/, ""));
  const subclassName = title.includes(":") ? cleanMarkdownText(title.split(":").slice(1).join(":")) : title;
  const subclassId = slugify(subclassName);
  const sections = splitSections(markdown);
  const parsedSections = sections.map((section) => parseSectionData(section.heading, section.body));
  const firstSectionIndex = markdown.search(/^###\s+/m);
  const preamble = firstSectionIndex >= 0 ? markdown.slice(0, firstSectionIndex) : "";
  const preambleTables = parseMarkdownTables(preamble);

  if (preambleTables.length && parsedSections.length) {
    const spellcastingIndex = parsedSections.findIndex((section) => subclassMatchSlug(section.name) === "spellcasting");
    const targetIndex = spellcastingIndex >= 0 ? spellcastingIndex : 0;
    parsedSections[targetIndex] = {
      ...parsedSections[targetIndex],
      tables: [...preambleTables, ...parsedSections[targetIndex].tables],
    };
  }

  const choiceGroups = parsedSections
    .map((parsed) => {
      return {
        id: `${subclassId}-${parsed.id}`,
        name: parsed.name,
        source: "subclass" as const,
        subclassId,
        level: parsed.level,
        summary: parsed.summary,
        blocks: parsed.blocks,
        tables: parsed.tables,
        options: parsed.options,
      };
    })
    .filter((section) => section.options.length > 0 || section.tables.length > 0);

  return {
    id: subclassId,
    name: subclassName,
    summary,
    source,
    sections: parsedSections,
    grantedSpells: parseSpellGrantsFromSections(parsedSections),
    choiceGroups,
  };
}

function readSingleClassDocs(classId: keyof typeof CLASS_DOC_CONFIG): ClassDocEntry {
  const config = CLASS_DOC_CONFIG[classId];
  const baseMarkdown = fs.readFileSync(config.baseFile, "utf-8");
  const subclasses = fs.existsSync(config.subclassDir)
    ? fs
        .readdirSync(config.subclassDir)
        .filter((entry) => entry.toLowerCase().endsWith(".md"))
        .map((entry) => parseSubclassDoc(path.join(config.subclassDir, entry), config.subclassPrefix))
        .filter((entry): entry is ClassSubclassDoc => Boolean(entry))
    : [];

  const subclassSpellFileMap = fs.existsSync(config.subclassDir)
    ? new Map(
        fs
          .readdirSync(config.subclassDir)
          .filter((entry) => /\bspells\.md$/i.test(entry))
          .map((entry) => {
            const fullPath = path.join(config.subclassDir, entry);
            const baseName = path.basename(entry, ".md").replace(/\s+Spells$/i, "").trim();
            return [subclassMatchSlug(baseName), fullPath] as const;
          }),
      )
    : new Map<string, string>();

  const enrichedSubclasses = subclasses.map((entry) => {
    const spellFilePath =
      subclassSpellFileMap.get(subclassMatchSlug(entry.name)) ??
      subclassSpellFileMap.get(subclassMatchSlug(entry.id)) ??
      null;

    return {
      ...entry,
      grantedSpells: mergeSpellGrants(entry.grantedSpells, spellFilePath ? parseSpellGrantsFromReferenceFile(spellFilePath) : []),
    };
  });

  const baseGrantedSpells =
    "baseSpellFile" in config && config.baseSpellFile
      ? parseSpellGrantsFromReferenceFile(config.baseSpellFile)
      : [];

  return {
    classId,
    ...parseBaseDocs(baseMarkdown),
    subclasses: enrichedSubclasses,
    baseGrantedSpells,
  };
}

export function readClassDocCollection(): ClassDocCollection {
  return {
    bard: readSingleClassDocs("bard"),
    ranger: readSingleClassDocs("ranger"),
    fighter: readSingleClassDocs("fighter"),
  };
}
