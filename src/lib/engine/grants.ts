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
 *  - ritual         : sadece ritual olarak yapilabilir (orn. Book of Ancient Secrets)
 */
export const spellUsesSchema = z.enum(["at_will", "long_rest", "known", "list", "ritual"]);

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
      /** Level'la artan deger: "10 (15 at 6th, 20 at 10th)". Varsa value yerine kullanilir. */
      scaling: z.string().optional(),
      /** Sadece zirh ve kalkan yokken gecerli (Monk Unarmored Movement). */
      unarmoredOnly: z.boolean().optional(),
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
  /**
   * Zirh yokken kullanilabilecek alternatif AC tabani: Unarmored Defense (Barbarian 10 + DEX + CON),
   * dogal zirh (Lizardfolk 13 + DEX), Draconic Resilience vb. En yuksek taban secilir.
   */
  z
    .object({
      type: z.literal("ac_base"),
      base: z.number().int(),
      abilities: z.array(abilityIdSchema).default([]),
      shield: z.boolean().default(true),
    })
    .strict(),
  /** Proficient olunmayan ability check'lere yarim proficiency (Bard Jack of All Trades). Initiative dahil. */
  z.object({ type: z.literal("half_proficiency") }).strict(),
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
      /**
       * Sayi, ya da level'a gore artan metin: "1 (2 at 17th level)".
       * "STR".."CHA" = o yetenegin modifier'i (en az 1), "PB" = proficiency bonus.
       */
      uses: z.union([z.number().int().positive(), z.string().min(1)]),
      recharge: z.enum(["short_rest", "long_rest"]),
      /** Bu level'dan itibaren short rest'te de yenilenir (orn. Bard Font of Inspiration, 5). */
      shortRestFromLevel: z.number().int().positive().optional(),
    })
    .strict(),
  /** Monk Martial Arts: zirhsiz/kalkansizken unarmed strike ve monk silahlari bu zari ve STR/DEX'in iyisini kullanir. */
  z.object({ type: z.literal("martial_arts"), die: z.string().min(1) }).strict(),
  /** Martial Arts'tan yararlanan ek silahlar (weapon id). "monk-default": shortsword + iki elli/heavy olmayan simple melee. */
  z.object({ type: z.literal("monk_weapon"), weapons: z.array(z.string().min(1)).min(1) }).strict(),
  /** Sheet'te gosterilecek ozel save DC (orn. Ki: 8 + PB + WIS). */
  z.object({ type: z.literal("save_dc"), name: z.string().min(1), ability: abilityIdSchema }).strict(),
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

/**
 * Oyuncunun sectigi kazanim. Secilenler draft.choices[choice.id] icinde saklanir.
 * Simdilik buyu secimleri destekleniyor; diger turler (skill, dil, feat) ayni kaliba eklenecek.
 */
export const optionChoiceSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** En fazla kac secim. Zorunlu sayi `min` ile verilir. */
    count: z.number().int().positive(),
    min: z.number().int().nonnegative().optional(),
    /** Secim bu karakter level'indan itibaren acilir (orn. Bard'in ikinci Expertise'i, 10). */
    minLevel: z.number().int().positive().optional(),
    from: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("spell"),
          filter: z
            .object({
              level: z.number().int().nonnegative().optional(),
              /** "half_level": karakter level'inin yarisi (yukari yuvarlanir) ve alti. */
              maxLevel: z.union([z.number().int().nonnegative(), z.literal("half_level")]).optional(),
              minLevel: z.number().int().nonnegative().optional(),
              tags: z.array(z.string()).default([]),
              classes: z.array(z.string()).default([]),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("weapon"),
          filter: z
            .object({
              attackType: z.enum(["melee", "ranged"]).optional(),
              /** Kensei: heavy ve special ozelligi olmayan simple/martial silahlar + longbow. */
              kensei: z.boolean().optional(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("tool"),
          options: z.array(z.string().min(1)).min(1),
        })
        .strict(),
      z
        .object({
          kind: z.literal("skill"),
          /** true: sadece karakterin zaten proficient oldugu skill'ler (Expertise icin). */
          proficientOnly: z.boolean().default(false),
        })
        .strict(),
    ]),
    /** Silah secimlerinde (Kensei): secilen silah proficiency + monk silahi olur. */
    /** Buyu secimlerinde: secilen buyu nasil eklenir. */
    grantUses: spellUsesSchema.optional(),
    /** Skill secimlerinde: secilen skill'e ne verilir. */
    grantAs: z.enum(["proficiency", "expertise", "monk_weapon"]).optional(),
    note: z.string().optional(),
  })
  .strict();

export type OptionChoice = z.infer<typeof optionChoiceSchema>;

/**
 * Feat on kosullari. Her kosul ayri ayri saglanmali (AND); "anyOf" icindekilerden biri yeterli.
 * "campaign" kosulu kontrol edilemez, sadece DM'e not olarak gosterilir.
 */
const featConditionBase = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("level"), min: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("ability"), abilities: z.array(abilityIdSchema).min(1), min: z.number().int() }).strict(),
  /** Lineage ya da sublineage id'lerinden biri (orn. "elf", "high-elf"). */
  z.object({ kind: z.literal("lineage"), ids: z.array(z.string()).min(1), label: z.string() }).strict(),
  z.object({ kind: z.literal("proficiency"), category: z.enum(["armor", "weapon"]), value: z.enum(["light", "medium", "heavy", "martial"]) }).strict(),
  /** any: en az bir buyu yapabilmek; feature: class/subclass spellcasting ya da Pact Magic; prepared: buyu hazirlayan class. */
  z.object({ kind: z.literal("spellcasting"), mode: z.enum(["any", "feature", "prepared"]) }).strict(),
  z.object({ kind: z.literal("feat"), ids: z.array(z.string()).min(1) }).strict(),
  z.object({ kind: z.literal("class"), ids: z.array(z.string()).min(1) }).strict(),
  z.object({ kind: z.literal("background"), ids: z.array(z.string()).min(1) }).strict(),
  z.object({ kind: z.literal("campaign"), text: z.string() }).strict(),
]);

export const featConditionSchema = z.union([
  featConditionBase,
  z.object({ kind: z.literal("anyOf"), conditions: z.array(featConditionBase).min(2) }).strict(),
]);

export type FeatCondition = z.infer<typeof featConditionSchema>;
