/**
 * Wizard spellbook kurallari.
 * Kitap: 1. level'da 6 adet 1st-level buyu, her wizard level'inda +2 (slotu olan herhangi bir level'dan).
 * Hazirlik: her long rest'ten sonra kitaptan INT modifier + wizard level kadar (en az 1).
 * Kopyalama: bulunan scroll / kitaptan, buyu level'i basina 50 gp ve 2 saat.
 * Kitap draft.choices[SPELLBOOK_KEY] icinde tutulur; hazirlanan buyuler draft.spellIds'te.
 */

// "custom:" onekli anahtarlar sanitizeChoices tarafindan korunur.
export const SPELLBOOK_KEY = "custom:wizard-spellbook";
/** Altinla kopyalanan buyuler (bedava level-up haklarindan sayilmaz). */
export const SPELLBOOK_COPIED_KEY = "custom:wizard-spellbook-copied";

export type Currency = { cp: number; sp: number; ep: number; gp: number; pp: number };

/** Level up ile bedava eklenen buyu sayisi (kopyalananlar haric). */
export function spellbookFreeSlots(level: number) {
  return 6 + 2 * Math.max(0, level - 1);
}

export function prepareLimit(intModifier: number, level: number) {
  return Math.max(1, intModifier + level);
}

export function copyCost(spellLevel: number) {
  return { gp: 50 * spellLevel, hours: 2 * spellLevel };
}

const COIN_CP: Record<keyof Currency, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

export function totalCopper(currency: Currency) {
  return (Object.keys(COIN_CP) as Array<keyof Currency>).reduce((total, coin) => total + (currency[coin] ?? 0) * COIN_CP[coin], 0);
}

/**
 * Altini oder: once gp, sonra pp, ep, sp, cp. Buyuk bir para bozulursa ustu gp / sp / cp olarak geri verilir.
 * Para yetmezse null.
 */
export function payGold(currency: Currency, costGp: number): Currency | null {
  let need = Math.round(costGp * 100);
  if (totalCopper(currency) < need) {
    return null;
  }
  const next: Currency = { cp: currency.cp ?? 0, sp: currency.sp ?? 0, ep: currency.ep ?? 0, gp: currency.gp ?? 0, pp: currency.pp ?? 0 };
  for (const coin of ["gp", "pp", "ep", "sp", "cp"] as const) {
    if (need <= 0) break;
    const value = COIN_CP[coin];
    const take = Math.min(next[coin], Math.ceil(need / value));
    next[coin] -= take;
    need -= take * value;
  }
  if (need < 0) {
    let change = -need;
    next.gp += Math.floor(change / 100);
    change %= 100;
    next.sp += Math.floor(change / 10);
    next.cp += change % 10;
  }
  return next;
}
