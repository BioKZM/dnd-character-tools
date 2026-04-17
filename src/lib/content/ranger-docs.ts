import fs from "node:fs";
import path from "node:path";

export type RangerDocOption = {
  id: string;
  name: string;
  summary: string;
};

export type RangerDocBlock = {
  heading: string | null;
  paragraphs: string[];
};

export type RangerDocTable = {
  title: string | null;
  headers: string[];
  rows: string[][];
};

export type RangerDocSection = {
  id: string;
  name: string;
  summary: string;
  blocks: RangerDocBlock[];
  tables: RangerDocTable[];
  options: RangerDocOption[];
  level?: number;
};

export type RangerDocChoiceGroup = {
  id: string;
  name: string;
  source: "base" | "subclass";
  subclassId?: string;
  level?: number;
  summary: string;
  blocks: RangerDocBlock[];
  tables: RangerDocTable[];
  options: RangerDocOption[];
};

export type RangerSubclassDoc = {
  id: string;
  name: string;
  summary: string;
  source: string;
  choiceGroups: RangerDocChoiceGroup[];
};

export type RangerDocCollection = {
  baseSections: Record<string, string>;
  baseSectionEntries: Record<string, RangerDocSection>;
  baseChoiceGroups: RangerDocChoiceGroup[];
  subclasses: RangerSubclassDoc[];
};

const ROOT = path.join(process.cwd(), "src", "app", "docs", "classes", "ranger");

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/â€™/g, "'")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanMarkdownText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/Â/g, " ")
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€”|â€“/g, "-")
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
  const options: RangerDocOption[] = [];
  let current: RangerDocOption | null = null;

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
  const tables: RangerDocTable[] = [];
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
    let headers = contentRows[0] ?? [];
    let rows = contentRows.slice(1);

    if (contentRows.length > 1 && contentRows[0].filter(Boolean).length <= 1) {
      title = contentRows[0].find(Boolean) ?? null;
      headers = contentRows[1] ?? [];
      rows = contentRows.slice(2);
    }

    tables.push({
      title,
      headers,
      rows,
    });
  }

  return tables;
}

function parseSectionBlocks(markdown: string) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const blocks: RangerDocBlock[] = [];
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

function parseSectionData(heading: string, body: string): RangerDocSection {
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

function parseBaseRangerDocs(markdown: string) {
  const sections = splitSections(markdown);
  const parsedSections = sections.map((section) => parseSectionData(section.heading, section.body));
  const sectionMap = Object.fromEntries(
    parsedSections.map((section) => [section.id, section.summary]),
  ) as Record<string, string>;
  const sectionEntries = Object.fromEntries(
    parsedSections.map((section) => [section.id, section]),
  ) as Record<string, RangerDocSection>;

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
    .filter((section) =>
      section.options.length > 0 ||
      section.tables.length > 0 ||
      ["favored-enemy", "favored-foe-optional", "natural-explorer", "deft-explorer-optional", "primeval-awareness", "primal-awareness-optional", "hide-in-plain-sight", "nature-s-veil-optional", "spellcasting"].includes(section.id),
    );

  return {
    baseSections: sectionMap,
    baseSectionEntries: sectionEntries,
    baseChoiceGroups,
  };
}

function parseRangerSubclassDoc(filePath: string): RangerSubclassDoc | null {
  const markdown = fs.readFileSync(filePath, "utf-8");
  const lines = markdown.replace(/\r/g, "").split("\n").filter(Boolean);
  const title = cleanMarkdownText(lines[0] ?? path.basename(filePath, ".md"));
  if (!/^ranger\s*:/i.test(title)) {
    return null;
  }
  const summary = cleanMarkdownText(lines[1] ?? "");
  const sourceLine = lines.find((line) => line.startsWith("Source:")) ?? "";
  const source = cleanMarkdownText(sourceLine.replace(/^Source:\s*/, ""));
  const subclassName = title.includes(":") ? cleanMarkdownText(title.split(":").slice(1).join(":")) : title;
  const subclassId = slugify(subclassName);
  const sections = splitSections(markdown);
  const choiceGroups = sections
    .map((section) => {
      const parsed = parseSectionData(section.heading, section.body);
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
    };})
    .filter((section) => section.options.length > 0 || section.tables.length > 0);

  return {
    id: subclassId,
    name: subclassName,
    summary,
    source,
    choiceGroups,
  };
}

export function readRangerDocCollection(): RangerDocCollection {
  const baseMarkdown = fs.readFileSync(path.join(ROOT, "Ranger.md"), "utf-8");
  const subclassesRoot = path.join(ROOT, "subclasses");
  const subclasses = fs.existsSync(subclassesRoot)
    ? fs
        .readdirSync(subclassesRoot)
        .filter((entry) => entry.toLowerCase().endsWith(".md"))
        .map((entry) => parseRangerSubclassDoc(path.join(subclassesRoot, entry)))
        .filter((entry): entry is RangerSubclassDoc => Boolean(entry))
    : [];

  return {
    ...parseBaseRangerDocs(baseMarkdown),
    subclasses,
  };
}
