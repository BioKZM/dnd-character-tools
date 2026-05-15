import { z } from "zod";

export const lineageAbilityIdSchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);

export const lineageAbilityBonusRuleSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("fixed"),
      ability: lineageAbilityIdSchema,
      amount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("choice"),
      count: z.number().int().positive(),
      amount: z.number().int().positive(),
      restrictedTo: z.array(lineageAbilityIdSchema).min(1).optional(),
    })
    .strict(),
]);

export const lineageSourceSchema = z
  .object({
    book: z.string().min(1),
    page: z.number().int().positive().optional(),
    url: z.string().url().optional(),
  })
  .strict();

export const lineageGrantSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("sense"),
      sense: z.enum(["darkvision", "blindsight", "tremorsense", "truesight"]),
      value: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("damage_resistance"),
      damageType: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("ability_bonus"),
      ability: lineageAbilityIdSchema,
      amount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("save_advantage"),
      against: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("skill_proficiency"),
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("weapon_proficiency"),
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("tool_proficiency"),
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("tool_proficiency_choice"),
      choiceGroupId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("skill_bonus_if_proficient"),
      skillId: z.string().min(1),
      multiplier: z.number().positive(),
      context: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("language"),
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("spell_grant"),
      spellName: z.string().min(1),
      unlockLevel: z.number().int().positive().optional(),
      spellcastingAbility: lineageAbilityIdSchema.optional(),
      countsAsKnown: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      type: z.literal("condition_immunity"),
      against: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("hit_points_per_level"),
      amount: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("armor_training"),
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("movement"),
      mode: z.enum(["walk", "swim", "climb", "fly", "burrow"]),
      operation: z.enum(["set", "increase"]),
      value: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      type: z.literal("armor_class_bonus"),
      amount: z.number().int().positive(),
      condition: z.string().min(1).optional(),
    })
    .strict(),
]);

export const lineageChoiceOptionSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    summary: z.string().min(1).optional(),
    details: z.array(
      z
        .object({
          title: z.string().min(1),
          body: z.string().min(1),
        })
        .strict(),
    ).default([]),
    grants: z.array(lineageGrantSchema).default([]),
    childChoiceGroupIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const lineageChoiceGroupSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["single-select", "multi-select", "ability-choice"]),
    minSelections: z.number().int().nonnegative(),
    maxSelections: z.number().int().positive(),
    options: z.array(lineageChoiceOptionSchema).min(1),
  })
  .strict();

export const lineageFeatureDetailSectionSchema = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

export const lineageFeatureOptionSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();

export const lineageFeatureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(["trait", "passive", "proficiency", "sense"]),
    summary: z.string().min(1),
    details: z.array(lineageFeatureDetailSectionSchema).default([]),
    options: z.array(lineageFeatureOptionSchema).default([]),
    grants: z.array(lineageGrantSchema).default([]),
    choiceGroupIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

export const lineageFactTextSchema = z
  .object({
    summary: z.string().min(1),
  })
  .strict();

export const lineageSizeFactSchema = z
  .object({
    category: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict();

export const lineageSpeedFactSchema = z
  .object({
    walk: z.number().int().positive(),
    description: z.string().min(1).optional(),
  })
  .strict();

export const lineageLanguageFactSchema = z
  .object({
    values: z.array(z.string().min(1)).default([]),
    description: z.string().min(1).optional(),
  })
  .strict();

export const lineageFactsSchema = z
  .object({
    age: lineageFactTextSchema.optional(),
    alignment: lineageFactTextSchema.optional(),
    size: lineageSizeFactSchema.optional(),
    speed: lineageSpeedFactSchema.optional(),
    languages: lineageLanguageFactSchema.default({
      values: [],
    }),
    abilityScoreBonuses: z.array(lineageAbilityBonusRuleSchema).default([]),
  })
  .strict();

export const sublineageSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1),
    source: lineageSourceSchema,
    facts: lineageFactsSchema.default({
      languages: {
        values: [],
      },
      abilityScoreBonuses: [],
    }),
    features: z.array(lineageFeatureSchema).default([]),
    choiceGroups: z.array(lineageChoiceGroupSchema).default([]),
  })
  .strict();

export const lineageEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(["standard", "exotic", "monstrous", "setting-specific"]),
    summary: z.string().min(1),
    source: lineageSourceSchema,
    facts: lineageFactsSchema,
    features: z.array(lineageFeatureSchema).default([]),
    choiceGroups: z.array(lineageChoiceGroupSchema).default([]),
    sublineages: z.array(sublineageSchema).default([]),
  })
  .strict();

export const lineageCatalogSchema = z
  .object({
    entries: z.array(lineageEntrySchema),
  })
  .strict();

export type LineageAbilityId = z.infer<typeof lineageAbilityIdSchema>;
export type LineageAbilityBonusRule = z.infer<typeof lineageAbilityBonusRuleSchema>;
export type LineageSource = z.infer<typeof lineageSourceSchema>;
export type LineageGrant = z.infer<typeof lineageGrantSchema>;
export type LineageChoiceOption = z.infer<typeof lineageChoiceOptionSchema>;
export type LineageChoiceGroup = z.infer<typeof lineageChoiceGroupSchema>;
export type LineageFeatureDetailSection = z.infer<typeof lineageFeatureDetailSectionSchema>;
export type LineageFeatureOption = z.infer<typeof lineageFeatureOptionSchema>;
export type LineageFeature = z.infer<typeof lineageFeatureSchema>;
export type LineageFactText = z.infer<typeof lineageFactTextSchema>;
export type LineageSizeFact = z.infer<typeof lineageSizeFactSchema>;
export type LineageSpeedFact = z.infer<typeof lineageSpeedFactSchema>;
export type LineageLanguageFact = z.infer<typeof lineageLanguageFactSchema>;
export type LineageFacts = z.infer<typeof lineageFactsSchema>;
export type Sublineage = z.infer<typeof sublineageSchema>;
export type LineageEntry = z.infer<typeof lineageEntrySchema>;
export type LineageCatalog = z.infer<typeof lineageCatalogSchema>;
