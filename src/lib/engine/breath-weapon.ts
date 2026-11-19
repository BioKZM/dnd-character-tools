/**
 * Dragonborn Breath Weapon (PHB): ejderha rengi hasar turunu, sekli ve save'i belirler.
 * DC = 8 + CON modifier + proficiency. Hasar 2d6, 6. level'da 3d6, 11'de 4d6, 16'da 5d6. Short / long rest'te yenilenir.
 */
const ANCESTRY: Record<string, { damage: string; shape: string; save: "DEX" | "CON" }> = {
  "black-dragon": { damage: "acid", shape: "5 by 30 ft. line", save: "DEX" },
  "blue-dragon": { damage: "lightning", shape: "5 by 30 ft. line", save: "DEX" },
  "brass-dragon": { damage: "fire", shape: "5 by 30 ft. line", save: "DEX" },
  "bronze-dragon": { damage: "lightning", shape: "5 by 30 ft. line", save: "DEX" },
  "copper-dragon": { damage: "acid", shape: "5 by 30 ft. line", save: "DEX" },
  "gold-dragon": { damage: "fire", shape: "15 ft. cone", save: "DEX" },
  "green-dragon": { damage: "poison", shape: "15 ft. cone", save: "CON" },
  "red-dragon": { damage: "fire", shape: "15 ft. cone", save: "DEX" },
  "silver-dragon": { damage: "cold", shape: "15 ft. cone", save: "CON" },
  "white-dragon": { damage: "cold", shape: "15 ft. cone", save: "CON" },
};

export function breathWeaponDice(level: number) {
  return level >= 16 ? 5 : level >= 11 ? 4 : level >= 6 ? 3 : 2;
}

export function breathWeapon(ancestryId: string | undefined, level: number, conModifier: number, proficiencyBonus: number) {
  const ancestry = ancestryId ? ANCESTRY[ancestryId] : undefined;
  const dc = 8 + conModifier + proficiencyBonus;
  return {
    dc,
    save: ancestry?.save ?? "DEX",
    damage: `${breathWeaponDice(level)}d6${ancestry ? ` ${ancestry.damage}` : ""}`,
    shape: ancestry?.shape ?? "Pick an ancestry",
    chosen: Boolean(ancestry),
  };
}
