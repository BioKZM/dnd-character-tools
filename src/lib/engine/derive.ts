import type { CharacterDraft } from "@/lib/character/demo-sheet";
import { collectGrantSources, type EngineCatalog, type GrantSource } from "@/lib/engine/collect";
import type { AbilityId, Grant, GrantType, ProficiencyCategory } from "@/lib/engine/grants";
import type { z } from "zod";
import type { spellUsesSchema } from "@/lib/engine/grants";

type SpellUses = z.infer<typeof spellUsesSchema>;

export type SourcedValue<T> = T & { sources: string[] };

export type DerivedSpell = {
  spellId: string;
  uses: SpellUses;
  ability?: AbilityId;
  note?: string;
  source: string;
};

export type DerivedSpeed = {
  mode: "walk" | "climb" | "swim" | "fly" | "burrow";
  value: number;
  breakdown: string[];
};

export type DerivedCharacter = {
  sources: GrantSource[];
  proficiencies: Record<ProficiencyCategory, SourcedValue<{ value: string }>[]>;
  expertise: SourcedValue<{ skill: string }>[];
  abilityBonuses: SourcedValue<{ ability: AbilityId; amount: number }>[];
  senses: SourcedValue<{ sense: string; range: number; note?: string }>[];
  speeds: DerivedSpeed[];
  defenses: SourcedValue<{ kind: string; against: string; label: string }>[];
  hp: { perLevel: number; flat: number; breakdown: string[] };
  armorClassBonuses: { bonus: number; condition?: string; source: string }[];
  /** Zirhsizken kullanilabilecek AC tabanlari (Unarmored Defense, dogal zirh...). */
  armorClassBases: { base: number; abilities: AbilityId[]; shield: boolean; source: string }[];
  initiative: { bonus: number; breakdown: string[] };
  /** Jack of All Trades gibi: proficient olunmayan check'lere yarim proficiency. */
  halfProficiency: { sources: string[] };
  spells: DerivedSpell[];
  notes: { text: string; source: string }[];
  resources: { id: string; name: string; uses: number | string; recharge: "short_rest" | "long_rest"; source: string }[];
  /** Kaynaklardan gelen feat'ler (taslakta secilmis olanlar dahil). */
  featIds: string[];
  /** Monk Martial Arts zari (level'a gore cozulmus) ve monk silahlari. */
  martialArts: { die: string; source: string } | null;
  monkWeapons: string[];
  /** Ozel save DC'leri (Ki...). */
  saveDcs: { name: string; ability: AbilityId; source: string }[];
  /** Sadece zirhsiz/kalkansizken gecerli yurume hizi bonusu (Unarmored Movement). */
  unarmoredSpeedBonus: number;
  /** Data'da olup bu motorun islemedigi grant tipleri. Bos olmali; audit scripti kontrol eder. */
  unhandled: { type: string; source: string }[];
};

/** derive.ts'in islemeyi bildigi grant tipleri. audit scripti bunu kullanir. */
export const HANDLED_GRANT_TYPES: GrantType[] = [
  "ability",
  "proficiency",
  "expertise",
  "sense",
  "speed",
  "defense",
  "hp",
  "ac",
  "ac_base",
  "initiative",
  "half_proficiency",
  "spell",
  "feat",
  "resource",
  "note",
  "martial_arts",
  "monk_weapon",
  "save_dc",
];

const SENSE_LABELS: Record<string, string> = {
  darkvision: "Darkvision",
  blindsight: "Blindsight",
  tremorsense: "Tremorsense",
  truesight: "Truesight",
  "devils-sight": "Devil's Sight",
};

export function senseLabel(sense: string) {
  return SENSE_LABELS[sense] ?? sense;
}

function defenseLabel(kind: string, against: string) {
  switch (kind) {
    case "resistance":
      return `Resistance to ${against}`;
    case "immunity":
      return `Immunity to ${against}`;
    case "condition_immunity":
      return `Immune to ${against}`;
    case "save_advantage":
      return `Advantage on saves vs ${against}`;
    default:
      return against;
  }
}

function pushSourced<T extends object>(list: SourcedValue<T>[], key: (item: T) => string, item: T, source: string) {
  const existing = list.find((entry) => key(entry) === key(item));
  if (existing) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
    return existing;
  }
  const created = { ...item, sources: [source] } as SourcedValue<T>;
  list.push(created);
  return created;
}

function baseWalkSpeed(draft: CharacterDraft, catalog: EngineCatalog) {
  const lineage =
    catalog.lineages?.entries.find((entry) => entry.id === draft.speciesId) ??
    catalog.lineages?.entries.find((entry) => entry.sublineages.some((sub) => sub.id === draft.speciesId)) ??
    null;
  const sublineage = lineage?.sublineages.find((entry) => entry.id === draft.speciesId) ?? null;
  const fallback = Number.parseInt(draft.speed, 10) || 30;
  return {
    value: sublineage?.facts.speed?.walk ?? lineage?.facts.speed?.walk ?? fallback,
    label: sublineage?.name ?? lineage?.name ?? "Base",
  };
}

/**
 * Tek gercek hesap noktasi: taslaktaki secimlerden karakterin tum mekanik
 * kazanimlarini, her birinin kaynagiyla birlikte uretir.
 */
export function deriveCharacter(draft: CharacterDraft, catalog: EngineCatalog): DerivedCharacter {
  const sources = collectGrantSources(draft, catalog);
  const result: DerivedCharacter = {
    sources,
    proficiencies: { skill: [], save: [], armor: [], weapon: [], tool: [], language: [] },
    expertise: [],
    abilityBonuses: [],
    senses: [],
    speeds: [],
    defenses: [],
    hp: { perLevel: 0, flat: 0, breakdown: [] },
    armorClassBonuses: [],
    armorClassBases: [],
    initiative: { bonus: 0, breakdown: [] },
    halfProficiency: { sources: [] },
    spells: [],
    notes: [],
    resources: [],
    featIds: [],
    martialArts: null,
    monkWeapons: [],
    saveDcs: [],
    unarmoredSpeedBonus: 0,
    unhandled: [],
  };

  const walk = baseWalkSpeed(draft, catalog);
  const speeds = new Map<DerivedSpeed["mode"], DerivedSpeed>([
    ["walk", { mode: "walk", value: walk.value, breakdown: [`${walk.label}: ${walk.value} ft.`] }],
  ]);
  const equalToWalk: { mode: DerivedSpeed["mode"]; source: string }[] = [];

  const apply = (grant: Grant, source: GrantSource) => {
    const label = source.name;
    switch (grant.type) {
      case "ability":
        result.abilityBonuses.push({ ability: grant.ability, amount: grant.amount, sources: [label] });
        return;
      case "proficiency":
        grant.values.forEach((value) => {
          pushSourced(result.proficiencies[grant.category], (entry) => entry.value.toLowerCase(), { value }, label);
        });
        return;
      case "expertise":
        pushSourced(result.expertise, (entry) => entry.skill, { skill: grant.skill }, label);
        return;
      case "sense": {
        const existing = result.senses.find((entry) => entry.sense === grant.sense);
        if (existing) {
          existing.range = Math.max(existing.range, grant.range);
          existing.sources.push(label);
        } else {
          result.senses.push({ sense: grant.sense, range: grant.range, note: grant.note, sources: [label] });
        }
        return;
      }
      case "speed": {
        if (grant.op === "equal_to_walk") {
          equalToWalk.push({ mode: grant.mode, source: label });
          return;
        }
        const current = speeds.get(grant.mode) ?? { mode: grant.mode, value: 0, breakdown: [] };
        const amount = grant.scaling ? Number(resolveScaling(grant.scaling, draft.level)) || 0 : grant.value;
        if (grant.unarmoredOnly && grant.op === "add") {
          current.value += amount;
          current.breakdown.push(`${label}: +${amount} ft. (no armor or shield)`);
          result.unarmoredSpeedBonus += amount;
          speeds.set(grant.mode, current);
          return;
        }
        if (grant.op === "set") {
          if (amount > current.value) {
            current.value = amount;
            current.breakdown.push(`${label}: ${amount} ft.`);
          }
        } else {
          current.value += amount;
          current.breakdown.push(`${label}: +${amount} ft.`);
        }
        speeds.set(grant.mode, current);
        return;
      }
      case "defense":
        pushSourced(
          result.defenses,
          (entry) => `${entry.kind}:${entry.against.toLowerCase()}`,
          { kind: grant.kind, against: grant.against, label: defenseLabel(grant.kind, grant.against) },
          label,
        );
        return;
      case "hp":
        if (grant.perLevel) {
          result.hp.perLevel += grant.perLevel;
          result.hp.breakdown.push(`${label}: +${grant.perLevel} per level`);
        }
        if (grant.flat) {
          result.hp.flat += grant.flat;
          result.hp.breakdown.push(`${label}: +${grant.flat}`);
        }
        return;
      case "ac":
        result.armorClassBonuses.push({ bonus: grant.bonus, condition: grant.condition, source: label });
        return;
      case "ac_base":
        result.armorClassBases.push({ base: grant.base, abilities: grant.abilities, shield: grant.shield, source: label });
        return;
      case "initiative":
        result.initiative.bonus += grant.bonus;
        result.initiative.breakdown.push(`${label}: +${grant.bonus}`);
        return;
      case "half_proficiency":
        result.halfProficiency.sources.push(label);
        return;
      case "spell":
        if (grant.minLevel && draft.level < grant.minLevel) {
          return;
        }
        result.spells.push({ spellId: grant.spellId, uses: grant.uses, ability: grant.ability, note: grant.note, source: label });
        return;
      case "feat":
        // Zincirleme feat'ler collectGrantSources icinde kaynak olarak eklendi.
        return;
      case "resource":
        result.resources.push({
          id: grant.id,
          name: grant.name,
          uses: grant.uses,
          recharge: grant.shortRestFromLevel && draft.level >= grant.shortRestFromLevel ? "short_rest" : grant.recharge,
          source: label,
        });
        return;
      case "martial_arts":
        result.martialArts = { die: resolveScaling(grant.die, draft.level), source: label };
        return;
      case "monk_weapon":
        grant.weapons.forEach((weapon) => {
          if (!result.monkWeapons.includes(weapon)) {
            result.monkWeapons.push(weapon);
          }
        });
        return;
      case "save_dc":
        result.saveDcs.push({ name: grant.name, ability: grant.ability, source: label });
        return;
      case "note":
        result.notes.push({ text: grant.text, source: label });
        return;
      default: {
        const unknown = grant as { type: string };
        result.unhandled.push({ type: unknown.type, source: label });
      }
    }
  };

  sources.forEach((source) => {
    if (source.kind === "feat" && !result.featIds.includes(source.id)) {
      result.featIds.push(source.id);
    }
    source.grants.forEach((grant) => apply(grant, source));
  });

  const walkValue = speeds.get("walk")?.value ?? walk.value;
  equalToWalk.forEach(({ mode, source }) => {
    const current = speeds.get(mode) ?? { mode, value: 0, breakdown: [] };
    if (walkValue > current.value) {
      current.value = walkValue;
      current.breakdown.push(`${source}: equal to walking speed (${walkValue} ft.)`);
    }
    speeds.set(mode, current);
  });
  result.speeds = [...speeds.values()];

  return result;
}

export function hasProficiency(derived: DerivedCharacter, category: ProficiencyCategory, value: string) {
  return derived.proficiencies[category].some((entry) => entry.value.toLowerCase() === value.toLowerCase());
}

/** Kaynak kullanim sayisini level ve yeteneklere gore cozer ("1 (2 at 17th level)", "CHA", "PB"). */
export function resolveResourceUses(
  uses: number | string,
  context: { level: number; proficiencyBonus: number; modifiers: Record<AbilityId, number> },
) {
  if (typeof uses === "number") {
    return uses;
  }
  const token = uses.trim().toUpperCase();
  if (token === "LEVEL") {
    return context.level;
  }
  if (token === "PB") {
    return context.proficiencyBonus;
  }
  if (token in context.modifiers) {
    return Math.max(1, context.modifiers[token as AbilityId]);
  }
  // "5*LEVEL" (Lay on Hands havuzu), "1+CHA" (Divine Sense), "HALF_LEVEL".
  const multiple = token.match(/^(\d+)\s*\*\s*LEVEL$/);
  if (multiple) {
    return Number(multiple[1]) * context.level;
  }
  const plus = token.match(/^(\d+)\s*\+\s*(STR|DEX|CON|INT|WIS|CHA)$/);
  if (plus) {
    return Math.max(1, Number(plus[1]) + context.modifiers[plus[2] as AbilityId]);
  }
  if (token === "HALF_LEVEL") {
    return Math.max(1, Math.floor(context.level / 2));
  }
  let total = Number(uses.match(/^\d+/)?.[0] ?? 1);
  for (const match of uses.matchAll(/(\d+)\s+at\s+(\d+)/g)) {
    if (context.level >= Number(match[2])) {
      total = Number(match[1]);
    }
  }
  return total;
}

/** "1d4 (1d6 at 5th, 1d8 at 11th)" ya da "10 (15 at 6th)" -> level'a gore gecerli deger. */
export function resolveScaling(text: string, level: number) {
  let value = text.split("(")[0].trim();
  for (const match of text.matchAll(/([\w+.-]+)\s+at\s+(\d+)/g)) {
    if (level >= Number(match[2])) {
      value = match[1];
    }
  }
  return value;
}
