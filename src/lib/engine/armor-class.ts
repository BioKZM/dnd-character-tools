import type { ContentBundle } from "@/lib/content/schema";
import type { DerivedCharacter } from "@/lib/engine/derive";
import type { AbilityId } from "@/lib/engine/grants";

/** Inventory'deki bir esyanin durumu. Yazilmamissa: kusanili, adet 1. */
export type ItemState = { equipped?: boolean; quantity?: number };

export type ArmorClassResult = {
  value: number;
  /** Zirhsiz taban (10 + DEX), "bonus" rengini belirlemek icin. */
  baseline: number;
  breakdown: string[];
  warnings: string[];
  wearingArmor: boolean;
  /** STR gereksinimi karsilanmayan agir zirh: hiz 10 ft. duser. */
  speedPenalty: number;
};

type Armor = ContentBundle["armors"][number];

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function itemIsEquipped(itemState: Record<string, ItemState> | undefined, item: string) {
  return itemState?.[item]?.equipped !== false;
}

function armorInInventory(armor: Armor, inventory: string[]) {
  const names = new Map(inventory.map((item) => [normalizeName(item), item]));
  for (const name of [armor.name, ...armor.aliases]) {
    const match = names.get(normalizeName(name));
    if (match) {
      return match;
    }
  }
  return null;
}

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function proficientWith(category: Armor["category"], proficiencies: string[]) {
  const list = proficiencies.map((value) => value.toLowerCase());
  if (category === "shield") {
    return list.some((value) => value.includes("shield"));
  }
  return list.some((value) => value.includes("all armor") || value.includes(`${category} armor`));
}

/**
 * Tek AC hesabi (creator onizlemesi ve sheet ayni fonksiyonu kullanir):
 * 1. Aday tabanlardan en yuksegi: zirhsiz, kusanili zirh, Mage Armor (aktifse), ac_base grant'leri.
 * 2. Kusanili tek kalkan (taban izin veriyorsa).
 * 3. Kosullu bonuslar (Defense: sadece zirhla).
 * Proficiency yoksa ya da STR yetmiyorsa uyari; STR yetmiyorsa hiz -10 ft.
 */
export function computeArmorClass(input: {
  armors: Armor[];
  inventory: string[];
  itemState?: Record<string, ItemState>;
  modifiers: Record<AbilityId, number>;
  strengthScore: number;
  armorProficiencies: string[];
  derived: DerivedCharacter;
  mageArmorActive: boolean;
}): ArmorClassResult {
  const dex = input.modifiers.DEX ?? 0;
  const baseline = 10 + dex;
  const owned = input.armors
    .map((armor) => ({ armor, item: armorInInventory(armor, input.inventory) }))
    .filter((entry): entry is { armor: Armor; item: string } => Boolean(entry.item));
  const equipped = owned.filter((entry) => itemIsEquipped(input.itemState, entry.item));
  const wornArmors = equipped.filter((entry) => entry.armor.category !== "shield");
  const shield = equipped.find((entry) => entry.armor.category === "shield") ?? null;

  type Candidate = { label: string; value: number; formula: string; allowsShield: boolean; armor?: Armor };
  const candidates: Candidate[] = [
    { label: "Unarmored", value: baseline, formula: `10 + DEX ${formatSigned(dex)}`, allowsShield: true },
  ];

  wornArmors.forEach(({ armor }) => {
    const base = armor.baseAc ?? 10;
    const dexPart = armor.dexBonus ? (typeof armor.maxDexBonus === "number" ? Math.min(dex, armor.maxDexBonus) : dex) : 0;
    const formula = armor.dexBonus
      ? `${base} + DEX${typeof armor.maxDexBonus === "number" ? ` (max ${armor.maxDexBonus})` : ""} ${formatSigned(dexPart)}`
      : `${base}`;
    candidates.push({ label: armor.name, value: base + dexPart, formula, allowsShield: true, armor });
  });

  if (!wornArmors.length) {
    if (input.mageArmorActive) {
      candidates.push({ label: "Mage Armor", value: 13 + dex, formula: `13 + DEX ${formatSigned(dex)}`, allowsShield: true });
    }
    input.derived.armorClassBases.forEach((entry) => {
      const total = entry.base + entry.abilities.reduce((sum, ability) => sum + (input.modifiers[ability] ?? 0), 0);
      const formula = [String(entry.base), ...entry.abilities.map((ability) => `${ability} ${formatSigned(input.modifiers[ability] ?? 0)}`)].join(" + ");
      candidates.push({ label: entry.source, value: total, formula, allowsShield: entry.shield });
    });
  }

  const best = candidates.reduce((current, candidate) => (candidate.value > current.value ? candidate : current), candidates[0]);
  const breakdown = [`${best.label}: ${best.formula} = ${best.value}`];
  const warnings: string[] = [];
  let value = best.value;
  let speedPenalty = 0;

  if (wornArmors.length > 1) {
    warnings.push(`More than one armor is equipped; using ${best.label}. Unequip the others in Inventory.`);
  }

  if (shield && best.allowsShield) {
    value += shield.armor.acBonus ?? 2;
    breakdown.push(`${shield.armor.name}: +${shield.armor.acBonus ?? 2}`);
    if (!proficientWith("shield", input.armorProficiencies)) {
      warnings.push(`Not proficient with shields: disadvantage on STR/DEX checks, saves and attacks; no spellcasting.`);
    }
  }

  const wearingArmor = Boolean(best.armor);
  input.derived.armorClassBonuses.forEach((bonus) => {
    const needsArmor = bonus.condition?.toLowerCase().includes("armor") ?? false;
    if (needsArmor && !wearingArmor) {
      breakdown.push(`${bonus.source}: +${bonus.bonus} (${bonus.condition}, not active)`);
      return;
    }
    value += bonus.bonus;
    breakdown.push(`${bonus.source}: +${bonus.bonus}${bonus.condition ? ` (${bonus.condition})` : ""}`);
  });

  if (best.armor) {
    if (!proficientWith(best.armor.category, input.armorProficiencies)) {
      warnings.push(`Not proficient with ${best.armor.category} armor: disadvantage on STR/DEX checks, saves and attacks; no spellcasting.`);
    }
    if (best.armor.strengthRequirement && input.strengthScore < best.armor.strengthRequirement) {
      speedPenalty = 10;
      warnings.push(`${best.armor.name} needs STR ${best.armor.strengthRequirement}: speed -10 ft.`);
    }
    if (best.armor.stealthDisadvantage) {
      breakdown.push(`${best.armor.name}: disadvantage on Stealth checks.`);
    }
  }

  return { value, baseline, breakdown, warnings, wearingArmor, speedPenalty };
}

/** Mage Armor acilabilir mi: secilen buyu ya da Armor of Shadows gibi bir kaynak. */
export function mageArmorAvailable(derived: DerivedCharacter, spellIds: string[]) {
  return spellIds.includes("mage-armor") || derived.spells.some((spell) => spell.spellId === "mage-armor");
}
