import { z } from "zod";

export const classOptionEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  shortLabel: z.string().optional(),
  keyFacts: z.array(z.string()).default([]),
});

export const classOptionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().nullable().optional(),
  optionCount: z.number().int().nonnegative().optional(),
  options: z.array(classOptionEntrySchema).default([]),
  summary: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

export const classOptionCollectionSchema = z.object({
  warlock: z.object({
    pactBoon: classOptionGroupSchema.nullable(),
    eldritchInvocations: classOptionGroupSchema.nullable(),
  }),
  fighter: z.object({
    fightingStyle: classOptionGroupSchema.nullable(),
    battleMasterManeuvers: classOptionGroupSchema.nullable(),
  }),
});

export type ClassOptionEntry = z.infer<typeof classOptionEntrySchema>;
export type ClassOptionGroup = z.infer<typeof classOptionGroupSchema>;
export type ClassOptionCollection = z.infer<typeof classOptionCollectionSchema>;
