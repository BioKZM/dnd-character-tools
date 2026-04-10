import fs from "node:fs";
import path from "node:path";

export type RawBookManifest = {
  generatedAt: string;
  books: Array<{
    id: string;
    slug?: string;
    title: string;
    status: "extracted" | "missing";
    sourcePath: string;
    pageCount?: number;
    totalCharacters?: number;
    tags?: string[];
    artifacts?: {
      text: string;
      pages: string;
    };
    detectedSections?: {
      spellSectionHints: string[];
      subclassSectionHints: string[];
      spellCandidatePages: Array<{ page: number; hits: string[] }>;
      subclassCandidatePages: Array<{ page: number; hits: string[] }>;
      ocrHeadings: string[];
    };
  }>;
};

const manifestPath = path.join(process.cwd(), "content", "raw", "books", "index.json");

export function readRawBookManifest(): RawBookManifest | null {
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as RawBookManifest;
}
