import { z } from "zod";

export const classCuratedFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
});

export const classCuratedSpellGrantSchema = z.object({
  unlockLevel: z.number().int().positive(),
  spells: z.array(z.string()).default([]),
});

export const classCuratedSubclassSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  summary: z.string().default(""),
  features: z.array(classCuratedFeatureSchema).default([]),
  expandedSpells: z.array(classCuratedSpellGrantSchema).default([]),
  notes: z.array(z.string()).default([]),
});

export const classCuratedSpellTableSchema = z.object({
  title: z.string(),
  rows: z.array(z.array(z.string())),
});

export const classCuratedEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().url(),
  summary: z.string(),
  multiclassRequirement: z.string(),
  hitDie: z.string(),
  hitPoints: z.record(z.string(), z.string()),
  proficiencies: z.record(z.string(), z.string()),
  spellcastingTable: classCuratedSpellTableSchema,
  spellcastingNotes: z.array(z.string()).default([]),
  classFeatures: z.array(classCuratedFeatureSchema).default([]),
  subclassHeading: z.string(),
  subclasses: z.array(z.string()),
  notes: z.array(z.string()).default([]),
});

export const resolvedClassCuratedEntrySchema = classCuratedEntrySchema.extend({
  subclasses: z.array(classCuratedSubclassSchema),
});

export const classCuratedCollectionSchema = z.object({
  entries: z.array(resolvedClassCuratedEntrySchema),
});

export type ClassCuratedFeature = z.infer<typeof classCuratedFeatureSchema>;
export type ClassCuratedSpellGrant = z.infer<typeof classCuratedSpellGrantSchema>;
export type ClassCuratedSubclass = z.infer<typeof classCuratedSubclassSchema>;
export type ClassCuratedSpellTable = z.infer<typeof classCuratedSpellTableSchema>;
export type ClassCuratedEntry = z.infer<typeof classCuratedEntrySchema>;
export type ResolvedClassCuratedEntry = z.infer<typeof resolvedClassCuratedEntrySchema>;
export type ClassCuratedCollection = z.infer<typeof classCuratedCollectionSchema>;
