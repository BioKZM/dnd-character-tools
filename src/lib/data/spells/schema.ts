import { z } from "zod";

const nullableOptionalString = z.preprocess(
  (value) => (value == null ? undefined : value),
  z.string().min(1).optional(),
);

export const spellDataTableSchema = z
  .object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  })
  .strict();

export const spellDataEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    level: z.number().int().min(0).max(9),
    school: z.string().min(1),
    source: nullableOptionalString,
    subtitle: nullableOptionalString,
    castingTime: nullableOptionalString,
    range: nullableOptionalString,
    components: nullableOptionalString,
    duration: nullableOptionalString,
    summary: z.array(z.string()).default([]),
    detailLines: z.array(z.string()).default([]),
    detailTables: z.array(spellDataTableSchema).default([]),
    atHigherLevels: nullableOptionalString,
    tags: z.array(z.string()).default([]),
    classes: z.array(z.string()).default([]),
    subclassOptions: z.array(z.string()).default([]),
  })
  .strict();

export const spellDataCatalogSchema = z
  .object({
    entries: z.array(spellDataEntrySchema),
  })
  .strict();

export type SpellDataTable = z.infer<typeof spellDataTableSchema>;
export type SpellDataEntry = z.infer<typeof spellDataEntrySchema>;
export type SpellDataCatalog = z.infer<typeof spellDataCatalogSchema>;
