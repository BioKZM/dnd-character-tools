import { z } from "zod";

/**
 * Ortak "Grant" dili.
 *
 * Lineage, background, feat, class/subclass feature'i ve invocation / pact boon /
 * fighting style gibi secim opsiyonlarinin hepsi karaktere ne kazandirdigini bu
 * tiplerle anlatir. deriveCharacter() bunlari toplayip tek bir sonuc uretir;
 * Creator ve Sheet bu sonucu gosterir.
 *
 * Yeni bir mekanik eklemek = buraya bir tip + derive.ts'e bir handler.
 * Handler'i olmayan bir tip data'da kullanilirsa `npm run audit:data` hata verir.
 */

export const abilityIdSchema = z.enum(["STR", "DEX", "CON", "INT", "WIS", "CHA"]);
export type AbilityId = z.infer<typeof abilityIdSchema>;

export const proficiencyCategorySchema = z.enum(["skill", "save", "armor", "weapon", "tool", "language"]);
export type ProficiencyCategory = z.infer<typeof proficiencyCategorySchema>;

export const senseIdSchema = z.enum(["darkvision", "blindsight", "tremorsense", "truesight", "devils-sight"]);
export const speedModeSchema = z.enum(["walk", "climb", "swim", "fly", "burrow"]);
export const defenseKindSchema = z.enum(["resistance", "immunity", "condition_immunity", "save_advantage"]);

/**
 * spell.uses:
 *  - at_will        : slot harcamadan istedigi kadar
 *  - long_rest      : long rest basina bir kez, slot harcamadan
 *  - known          : bilinen buyu olarak eklenir, bilinen buyu sayisina dahil DEGIL
 *  - list           : sadece secilebilir buyu havuzuna eklenir (orn. Great Old One expanded spells)
 */
export const spellUsesSchema = z.enum(["at_will", "long_rest", "known", "list"]);

export const grantSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ability"), ability: abilityIdSchema, amount: z.number().int() }).strict(),
  z
    .object({
      type: z.literal("proficiency"),
      category: proficiencyCategorySchema,
      values: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z.object({ type: z.literal("expertise"), skill: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("sense"),
      sense: senseIdSchema,
      range: z.number().int().positive(),
      note: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("speed"),
      mode: speedModeSchema,
      op: z.enum(["set", "add", "equal_to_walk"]),
      value: z.number().int().nonnegative().default(0),
    })
    .strict(),
  z
    .object({
      type: z.literal("defense"),
      kind: defenseKindSchema,
      against: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("hp"),
      perLevel: z.number().int().optional(),
      flat: z.number().int().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("ac"),
      bonus: z.number().int(),
      condition: z.string().optional(),
    })
    .strict(),
  z.object({ type: z.literal("initiative"), bonus: z.number().int() }).strict(),
  z
    .object({
      type: z.literal("spell"),
      spellId: z.string().min(1),
      uses: spellUsesSchema,
      minLevel: z.number().int().positive().optional(),
      ability: abilityIdSchema.optional(),
      note: z.string().optional(),
    })
    .strict(),
  z.object({ type: z.literal("feat"), featId: z.string().min(1) }).strict(),
  z
    .object({
      type: z.literal("resource"),
      id: z.string().min(1),
      name: z.string().min(1),
      uses: z.union([z.number().int().positive(), z.string().min(1)]),
      recharge: z.enum(["short_rest", "long_rest"]),
    })
    .strict(),
  /** Kural motoruna girmeyen ama sheet'te gorunmesi gereken mekanik (orn. "+CHA to eldritch blast damage"). */
  z.object({ type: z.literal("note"), text: z.string().min(1) }).strict(),
]);

export type Grant = z.infer<typeof grantSchema>;
export type GrantType = Grant["type"];

export const GRANT_TYPES = grantSchema.options.map((option) => option.shape.type.value) as GrantType[];

/** Secim opsiyonlarinin (invocation, pact boon, fighting style...) on kosullari. */
export const optionPrerequisiteSchema = z
  .object({
    level: z.number().int().positive().optional(),
    pactBoon: z.string().optional(),
    spellId: z.string().optional(),
    featureId: z.string().optional(),
    text: z.string().optional(),
  })
  .strict();

export type OptionPrerequisite = z.infer<typeof optionPrerequisiteSchema>;
