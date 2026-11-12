import type { LineageEntry, Sublineage } from "@/lib/data/lineages/schema";

/**
 * Esnek stat bonusu kurallarindan iki secim slotunun miktarini cikarir.
 * Tabaxi / Eladrin (Tasha kurali): [2, 1]. Variant Human: [1, 1].
 * Draft'ta slotlar tarihsel sebeple `plusTwo` ve `plusOne` diye adlandirilmis;
 * gercek miktar bu fonksiyondan gelir.
 */
export function flexibleBonusAmounts(lineage: LineageEntry | null | undefined, sublineage: Sublineage | null | undefined): [number, number] {
  const rules = sublineage?.facts.abilityScoreBonuses.some((bonus) => bonus.type === "choice")
    ? sublineage.facts.abilityScoreBonuses
    : lineage?.facts.abilityScoreBonuses ?? [];
  const slots = rules
    .flatMap((bonus) => (bonus.type === "choice" ? Array.from({ length: bonus.count }, () => bonus.amount) : []))
    .sort((left, right) => right - left);
  return [slots.at(0) ?? 2, slots.at(1) ?? 1];
}
