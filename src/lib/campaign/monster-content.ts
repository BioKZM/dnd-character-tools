import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const monsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  cr: z.string(),
  type: z.string(),
  environment: z.array(z.string()),
  ac: z.number().int(),
  hp: z.number().int(),
  speed: z.string(),
  role: z.string(),
  senses: z.string(),
  languages: z.array(z.string()),
  traits: z.array(z.string()),
  actions: z.array(z.string()),
  notes: z.string(),
  size: z.string().optional(),
  alignment: z.string().optional(),
  subtitle: z.string().optional(),
  savingThrows: z.string().optional(),
  skills: z.string().optional(),
  damageVulnerabilities: z.string().optional(),
  damageResistances: z.string().optional(),
  damageImmunities: z.string().optional(),
  conditionImmunities: z.string().optional(),
  legendary: z.boolean().optional(),
  rawSections: z
    .object({
      traits: z.array(z.string()),
      actions: z.array(z.string()),
      bonusActions: z.array(z.string()),
      reactions: z.array(z.string()),
      legendaryActions: z.array(z.string()),
    })
    .optional(),
});

export type MonsterRecord = z.infer<typeof monsterSchema>;

export function readNormalizedMonsters(): MonsterRecord[] {
  const absolutePath = path.join(process.cwd(), "content", "normalized", "monsters.json");
  const parsed = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  return z.array(monsterSchema).parse(parsed);
}
