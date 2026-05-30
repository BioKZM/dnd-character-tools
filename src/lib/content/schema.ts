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
  subtitle: z.string().optional(),
  castingTime: z.string(),
  range: z.string(),
  components: z.string().optional(),
  duration: z.string(),
  summary: z.string(),
  detailLines: z.array(z.string()).optional(),
  detailTables: z.array(
    z.object({
      headers: z.array(z.string()),
      rows: z.array(z.array(z.string())),
    }),
  ).optional(),
  atHigherLevels: z.string().optional(),
  tags: z.array(z.string()).optional(),
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
  skillProficiencies: z.array(z.string()).default([]),
  toolProficiencies: z
    .object({
      fixed: z.array(z.string()).default([]),
      choices: z
        .array(
          z.object({
            id: z.string(),
            count: z.number().int().positive(),
            options: z.union([
              z.literal("any"),
              z.literal("artisan-tools"),
              z.literal("gaming-sets"),
              z.literal("musical-instruments"),
              z.literal("vehicles"),
              z.array(z.string()),
            ]),
            label: z.string(),
            note: z.string().optional(),
          }),
        )
        .default([]),
    })
    .default({ fixed: [], choices: [] }),
  languages: z
    .object({
      fixed: z.array(z.string()).default([]),
      choices: z
        .array(
          z.object({
            id: z.string(),
            count: z.number().int().positive(),
            options: z.union([z.literal("any"), z.literal("standard"), z.literal("exotic"), z.array(z.string())]),
            label: z.string(),
            note: z.string().optional(),
          }),
        )
        .default([]),
    })
    .default({ fixed: [], choices: [] }),
  equipment: z.array(z.string()).default([]),
});

export const languageSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["standard", "exotic", "setting"]),
  variants: z.array(z.string()).default([]),
});

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["artisan-tools", "gaming-sets", "musical-instruments", "vehicles", "kits"]),
  cost: z.string().optional(),
  weight: z.string().optional(),
});

export const itemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum([
    "equipment-pack",
    "common-item",
    "usable-item",
    "clothes",
    "arcane-focus",
    "druidic-focus",
    "holy-symbol",
    "container",
    "setting-specific-adventuring-gear",
  ]),
  cost: z.string().optional(),
  weight: z.string().optional(),
  capacity: z.string().optional(),
  contents: z.array(z.string()).optional(),
  description: z.array(z.string()).optional(),
  source: z.string().optional(),
  setting: z.string().optional(),
});

export const armorSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(["light", "medium", "heavy", "shield"]),
  baseAc: z.number().int().optional(),
  acBonus: z.number().int().optional(),
  dexBonus: z.boolean(),
  maxDexBonus: z.number().int().optional(),
  strengthRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean(),
  weight: z.string(),
  cost: z.string(),
  aliases: z.array(z.string()).default([]),
});

export const weaponSchema = z.object({
  id: z.string(),
  name: z.string(),
  group: z.enum(["simple-melee", "simple-ranged", "martial-melee", "martial-ranged", "ammunition"]),
  proficiency: z.enum(["simple", "martial", "ammunition"]),
  attackType: z.enum(["melee", "ranged", "ammunition"]),
  cost: z.string(),
  damage: z.string().nullable(),
  damageType: z.string().optional(),
  weight: z.string(),
  properties: z.array(z.string()).default([]),
  range: z.string().optional(),
  versatileDamage: z.string().optional(),
  aliases: z.array(z.string()).default([]),
  specialDescription: z.string().optional(),
  source: z.string().optional(),
  setting: z.string().optional(),
});

export const weaponPropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export const featSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  source: z.string().optional(),
  prerequisite: z.string().optional(),
  isRacialFeat: z.boolean().optional(),
  detailParagraphs: z.array(z.string()).default([]),
  detailTables: z
    .array(
      z.object({
        title: z.string(),
        columns: z.array(z.string()).default([]),
        rows: z.array(z.array(z.string())),
      }),
    )
    .default([]),
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
  languages: z.array(languageSchema),
  tools: z.array(toolSchema),
  items: z.array(itemSchema),
  armors: z.array(armorSchema),
  weapons: z.array(weaponSchema),
  weaponProperties: z.array(weaponPropertySchema),
  feats: z.array(featSchema),
  spells: z.array(spellSchema),
});

export type Feature = z.infer<typeof featureSchema>;
export type Spell = z.infer<typeof spellSchema>;
export type CharacterClass = z.infer<typeof classSchema>;
export type Species = z.infer<typeof speciesSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Armor = z.infer<typeof armorSchema>;
export type Weapon = z.infer<typeof weaponSchema>;
export type WeaponProperty = z.infer<typeof weaponPropertySchema>;
export type Feat = z.infer<typeof featSchema>;
export type SourceBook = z.infer<typeof sourceBookSchema>;
export type ContentBundle = z.infer<typeof contentBundleSchema>;
