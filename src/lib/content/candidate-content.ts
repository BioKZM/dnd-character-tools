import fs from "node:fs";
import path from "node:path";

export type CandidateSummary = {
  spellCount: number;
  featCount: number;
};

const candidatesDir = path.join(process.cwd(), "content", "normalized", "candidates");

export function readCandidateSummary(): CandidateSummary | null {
  const summaryPath = path.join(candidatesDir, "summary.json");
  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as CandidateSummary;
}
