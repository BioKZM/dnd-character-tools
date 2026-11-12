import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const monsterManualScanSchema = z.object({
  status: z.string(),
  sourcePath: z.string(),
  pageCount: z.number().int().optional(),
  nonemptyTextPages: z.number().int().optional(),
  note: z.string(),
  durationSeconds: z.number().optional(),
  sampledPages: z.array(z.number().int()).optional(),
  samplePreviews: z.array(
    z.object({
      page: z.number().int(),
      preview: z.string(),
      characters: z.number().int(),
    }),
  ).optional(),
});

export type MonsterManualScan = z.infer<typeof monsterManualScanSchema>;

export function readMonsterManualScan(): MonsterManualScan | null {
  const absolutePath = path.join(process.cwd(), "content", "raw", "monster-manual", "manifest.json");

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  return monsterManualScanSchema.parse(parsed);
}
