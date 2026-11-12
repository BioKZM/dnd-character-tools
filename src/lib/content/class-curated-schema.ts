import { z } from "zod";
import { abilityIdSchema, grantSchema, optionChoiceSchema, spellUsesSchema } from "@/lib/engine/grants";

export const classCuratedFeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  keyFacts: z.array(z.string()).default([]),
  /** Bir bakista okunan tek satir (fiille baslar, ~12 kelime). Tam kural metni summary'de kalir. */
  short: z.string().optional(),
  /** Taranabilir kural bilgisi: sheet ve tooltip'lerde etiket olarak gosterilir. */
  facts: z
    .object({
      action: z.enum(["Action", "Bonus Action", "Reaction", "Passive", "Special"]).optional(),
      cost: z.string().optional(),
      uses: z.string().optional(),
      range: z.string().optional(),
      save: z.string().optional(),
      /** Save DC'si hangi hesaptan gelir. */
      dc: z.enum(["spell", "ki"]).optional(),
      duration: z.string().optional(),
    })
    .strict()
    .optional(),
  unlockLevel: z.number().int().positive().optional(),
  currentValueTemplate: z.string().optional(),
  tags: z.array(z.string()).default([]),
  milestones: z
    .array(
      z.object({
        level: z.number().int().positive(),
        label: z.string(),
      }),
    )
    .default([]),
  grants: z.array(grantSchema).default([]),
  /** Feature'in oyuncu secimleri (orn. Bard Expertise: proficient oldugun 2 skill). */
  choices: z.array(optionChoiceSchema).default([]),
});

export const classCuratedSpellGrantSchema = z.object({
  unlockLevel: z.number().int().positive(),
  spells: z.array(z.string()).default([]),
  /** "list": sadece secilebilir havuza eklenir (Warlock patron listeleri). "known": otomatik bilinir. */
  uses: spellUsesSchema.default("known"),
});

export const classJourneyStageSchema = z.object({
  id: z.string(),
  label: z.string(),
  browser: z.string(),
  minLevel: z.number().int().positive().optional(),
  requiresSubclassId: z.string().optional(),
  summary: z.string().default(""),
});

export const classStartingEquipmentGroupSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  options: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      items: z.array(z.string()),
    }),
  ),
});

export const classCuratedSubclassSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  summary: z.string().default(""),
  features: z.array(classCuratedFeatureSchema).default([]),
  journeyStages: z.array(classJourneyStageSchema).default([]),
  spellcasting: z
    .object({
      progressionBands: z
        .array(
          z.object({
            fromLevel: z.number().int().positive(),
            toLevel: z.number().int().positive(),
            cantripsKnown: z.number().int().nonnegative(),
            spellsKnown: z.number().int().nonnegative(),
            spellSlots: z.record(z.string(), z.number().int().nonnegative()).default({}),
          }),
        )
        .default([]),
      ability: z.string(),
      saveDcFormula: z.string(),
      attackModifierFormula: z.string(),
      schoolFocus: z.array(z.string()).default([]),
      unrestrictedSpellLevels: z.array(z.number().int().positive()).default([]),
      cantripsKnownByLevel: z.record(z.string(), z.number().int().nonnegative()).default({}),
      spellsKnownByLevel: z.record(z.string(), z.number().int().nonnegative()).default({}),
      notes: z.array(z.string()).default([]),
    })
    .optional(),
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
  primaryAbilities: z.array(abilityIdSchema).default([]),
  savingThrows: z.array(abilityIdSchema).default([]),
  /** Class'in buyu yapma yetenegi (Bard CHA, Ranger WIS, Warlock CHA). Fighter gibi buyusuz class'larda yok; Eldritch Knight subclass'tan gelir. */
  spellcastingAbility: abilityIdSchema.optional(),
  /** 1. level'da class'tan gelen proficiency'ler (armor, weapon, tool, save). */
  startingGrants: z.array(grantSchema).default([]),
  hitPoints: z.record(z.string(), z.string()),
  proficiencies: z.record(z.string(), z.string()),
  spellcastingTable: classCuratedSpellTableSchema,
  spellcastingNotes: z.array(z.string()).default([]),
  classFeatures: z.array(classCuratedFeatureSchema).default([]),
  journeyStages: z.array(classJourneyStageSchema).default([]),
  startingEquipment: z.array(classStartingEquipmentGroupSchema).default([]),
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
export type ClassJourneyStage = z.infer<typeof classJourneyStageSchema>;
export type ClassStartingEquipmentGroup = z.infer<typeof classStartingEquipmentGroupSchema>;
export type ClassCuratedSubclass = z.infer<typeof classCuratedSubclassSchema>;
export type ClassCuratedSpellTable = z.infer<typeof classCuratedSpellTableSchema>;
export type ClassCuratedEntry = z.infer<typeof classCuratedEntrySchema>;
export type ResolvedClassCuratedEntry = z.infer<typeof resolvedClassCuratedEntrySchema>;
export type ClassCuratedCollection = z.infer<typeof classCuratedCollectionSchema>;
