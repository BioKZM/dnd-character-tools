import { z } from "zod";

export const featureSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
});

export const spellSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(0).max(9),
  school: z.string(),
  castingTime: z.string(),
  range: z.string(),
  duration: z.string(),
  summary: z.string(),
  source: z.string().optional(),
  classes: z.array(z.string()).optional(),
  subclassOptions: z.array(z.string()).optional(),
});

export const classSchema = z.object({
  id: z.string(),
  name: z.string(),
  hitDie: z.number().int(),
  primaryAbilities: z.array(z.string()),
  savingThrows: z.array(z.string()),
  featuresByLevel: z.record(z.string(), z.array(featureSchema)),
  source: z.string().optional(),
  multiclassRequirement: z.string().optional(),
});

export const speciesSchema = z.object({
  id: z.string(),
  name: z.string(),
  traits: z.array(featureSchema),
  source: z.string().optional(),
});

export const backgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  source: z.string().optional(),
  skillProficiencies: z.string().optional(),
  toolProficiencies: z.string().optional(),
  languages: z.string().optional(),
});

export const featSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  source: z.string().optional(),
  prerequisite: z.string().optional(),
  isRacialFeat: z.boolean().optional(),
});

export const sourceBookSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["ready", "queued", "draft"]),
  notes: z.string(),
});

export const contentBundleSchema = z.object({
  sourceBooks: z.array(sourceBookSchema),
  classes: z.array(classSchema),
  species: z.array(speciesSchema),
  backgrounds: z.array(backgroundSchema),
  feats: z.array(featSchema),
  spells: z.array(spellSchema),
});

export type Feature = z.infer<typeof featureSchema>;
export type Spell = z.infer<typeof spellSchema>;
export type CharacterClass = z.infer<typeof classSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type Feat = z.infer<typeof featSchema>;
export type SourceBook = z.infer<typeof sourceBookSchema>;
export type ContentBundle = z.infer<typeof contentBundleSchema>;
