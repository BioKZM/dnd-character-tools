import type { ClassCuratedCollection } from "@/lib/content/class-curated-schema";
import type { AbilityId } from "@/lib/engine/grants";

/**
 * Buyu yapma bilgisi: hangi yetenekle, save DC, attack bonusu ve slotlar.
 * Hepsi class data'sindan (spellcastingAbility, level tablosu) ya da
 * subclass'in spellcasting alanindan (Eldritch Knight) okunur.
 */

const ABILITY_NAMES: Record<string, AbilityId> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export type SpellSlotPool = {
  /** "spell" = normal slotlar (long rest), "pact" = Warlock Pact Magic (short rest). */
  kind: "spell" | "pact";
  level: number;
  total: number;
};

export type SpellcastingProfile = {
  sourceName: string;
  ability: AbilityId;
  modifier: number;
  saveDc: number;
  attackBonus: number;
  slots: SpellSlotPool[];
};

type AbilityModifiers = Record<AbilityId, number>;

function ordinalToNumber(value: string) {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function tableSlots(rows: string[][], level: number, isPact: boolean): SpellSlotPool[] {
  const header = rows.find((row) => row.at(0)?.toLowerCase() === "level") ?? [];
  const row = rows.find((entry) => ordinalToNumber(entry.at(0) ?? "") === level && entry !== header);
  if (!row) {
    return [];
  }

  if (isPact) {
    const countIndex = header.findIndex((cell) => cell === "Spell Slots");
    const levelIndex = header.findIndex((cell) => cell === "Slot Level");
    const total = Number(row.at(countIndex) ?? 0) || 0;
    const slotLevel = ordinalToNumber(row.at(levelIndex) ?? "");
    return total && slotLevel ? [{ kind: "pact", level: slotLevel, total }] : [];
  }

  return ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]
    .map((label, index) => {
      const column = header.findIndex((cell) => cell === label);
      const total = column >= 0 ? Number(row.at(column) ?? 0) || 0 : 0;
      return { kind: "spell" as const, level: index + 1, total };
    })
    .filter((slot) => slot.total > 0);
}

export function spellcastingProfiles(
  params: {
    classId: string;
    subclassId: string | null;
    level: number;
    proficiencyBonus: number;
    modifiers: AbilityModifiers;
  },
  classes?: ClassCuratedCollection,
): SpellcastingProfile[] {
  const classEntry = classes?.entries.find((entry) => entry.id === params.classId);
  if (!classEntry) {
    return [];
  }

  const build = (sourceName: string, ability: AbilityId, slots: SpellSlotPool[]): SpellcastingProfile => {
    const modifier = params.modifiers[ability] ?? 0;
    return {
      sourceName,
      ability,
      modifier,
      saveDc: 8 + params.proficiencyBonus + modifier,
      attackBonus: params.proficiencyBonus + modifier,
      slots,
    };
  };

  if (classEntry.spellcastingAbility) {
    const isPact = classEntry.id === "warlock";
    return [build(classEntry.name, classEntry.spellcastingAbility, tableSlots(classEntry.spellcastingTable.rows, params.level, isPact))];
  }

  const subclass = params.subclassId ? classEntry.subclasses.find((entry) => entry.id === params.subclassId) : null;
  const subclassAbility = subclass?.spellcasting ? ABILITY_NAMES[subclass.spellcasting.ability.toLowerCase()] : undefined;
  if (subclass?.spellcasting && subclassAbility) {
    const band = subclass.spellcasting.progressionBands.find(
      (entry) => params.level >= entry.fromLevel && params.level <= entry.toLevel,
    );
    const slots = Object.entries(band?.spellSlots ?? {})
      .map(([slotLevel, total]) => ({ kind: "spell" as const, level: Number(slotLevel), total }))
      .filter((slot) => slot.total > 0);
    return [build(subclass.name, subclassAbility, slots)];
  }

  return [];
}

/** Cantrip zarlari 5, 11 ve 17. level'da artar. */
export function cantripTier(characterLevel: number) {
  return characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1;
}

/** "1d10 force" -> tier 2 ile "2d10 force". */
export function scaleCantripDamage(damage: string, tier: number) {
  if (tier <= 1) {
    return damage;
  }
  return damage.replace(/^(\d+)d(\d+)/, (_, count: string, die: string) => `${Number(count) * tier}d${die}`);
}
