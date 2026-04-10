import { z } from "zod";

export const lineageTraitSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  mechanic: z.string().optional(),
});

export const lineageStatSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const subraceSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  bonuses: z.array(z.string()),
  traits: z.array(lineageTraitSchema).default([]),
  stats: z.array(lineageStatSchema).default([]),
  flexibleAbilityScoreIncrease: z.boolean().default(false),
  source: z.string().optional(),
});

export const lineageEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().url(),
  sourceLabel: z.string(),
  summary: z.string(),
  stats: z.array(lineageStatSchema),
  coreBonuses: z.array(z.string()),
  coreTraits: z.array(lineageTraitSchema),
  flexibleAbilityScoreIncrease: z.boolean().default(false),
  subraces: z.array(z.string()),
  notes: z.array(z.string()).default([]),
});

export const resolvedLineageEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().url(),
  sourceLabel: z.string(),
  summary: z.string(),
  stats: z.array(lineageStatSchema),
  coreBonuses: z.array(z.string()),
  coreTraits: z.array(lineageTraitSchema),
  flexibleAbilityScoreIncrease: z.boolean().default(false),
  subraces: z.array(subraceSchema),
  notes: z.array(z.string()).default([]),
});

export const lineageCollectionSchema = z.object({
  entries: z.array(resolvedLineageEntrySchema),
});

export type LineageTrait = z.infer<typeof lineageTraitSchema>;
export type LineageStat = z.infer<typeof lineageStatSchema>;
export type SubraceEntry = z.infer<typeof subraceSchema>;
export type LineageEntry = z.infer<typeof lineageEntrySchema>;
export type ResolvedLineageEntry = z.infer<typeof resolvedLineageEntrySchema>;
export type LineageCollection = z.infer<typeof lineageCollectionSchema>;
