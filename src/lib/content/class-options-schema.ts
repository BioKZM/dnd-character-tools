import { z } from "zod";

export const classOptionEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
});

export const warlockOptionGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceUrl: z.string().nullable().optional(),
  optionCount: z.number().int().nonnegative().optional(),
  options: z.array(classOptionEntrySchema).default([]),
  summary: z.string().optional(),
  notes: z.array(z.string()).default([]),
});

export const warlockOptionCollectionSchema = z.object({
  pactBoon: warlockOptionGroupSchema.nullable(),
  eldritchInvocations: warlockOptionGroupSchema.nullable(),
});

export type ClassOptionEntry = z.infer<typeof classOptionEntrySchema>;
export type WarlockOptionGroup = z.infer<typeof warlockOptionGroupSchema>;
export type WarlockOptionCollection = z.infer<typeof warlockOptionCollectionSchema>;
