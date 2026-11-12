import type { CharacterDraft } from "@/lib/character/demo-sheet";
import type { EngineCatalog } from "@/lib/engine/collect";
import { activeAsiChoices, classAsiLevels } from "@/lib/engine/feats";

/**
 * Level atlarken neler degisir: yeni feature'lar, mevcut feature'larin gelisimi (milestone), subclass feature'lari.
 * HP artisi da burada: zar sonucu draft.hpRolls[level] icinde saklanir, yoksa ortalama kullanilir.
 */

export type LevelGain = {
  kind: "feature" | "improvement" | "subclass";
  name: string;
  detail: string;
};

export function hitDieAverage(hitDie: number) {
  return Math.floor(hitDie / 2) + 1;
}

/** 2. level ve sonrasi icin hit die sonucu (zar atildiysa o, yoksa ortalama). */
export function hitDieGain(draft: Pick<CharacterDraft, "hpRolls">, level: number, hitDie: number) {
  const rolled = draft.hpRolls?.[level];
  return typeof rolled === "number" && rolled >= 1 && rolled <= hitDie ? rolled : hitDieAverage(hitDie);
}

/** Level 1: tam hit die; sonraki her level: zar ya da ortalama. CON her level eklenir, level basina en az 1 HP. */
export function classHitPoints(draft: Pick<CharacterDraft, "hpRolls" | "level">, hitDie: number, conModifier: number) {
  let total = Math.max(1, hitDie + conModifier);
  for (let level = 2; level <= draft.level; level += 1) {
    total += Math.max(1, hitDieGain(draft, level, hitDie) + conModifier);
  }
  return total;
}

export function levelGains(catalog: EngineCatalog, draft: CharacterDraft, level: number): LevelGain[] {
  const classEntry = catalog.classes?.entries.find((entry) => entry.id === draft.classId);
  if (!classEntry) {
    return [];
  }
  const gains: LevelGain[] = [];
  classEntry.classFeatures.forEach((feature) => {
    if ((feature.unlockLevel ?? 1) === level) {
      gains.push({ kind: "feature", name: feature.name, detail: feature.keyFacts?.[0] ?? feature.summary });
      return;
    }
    const milestone = feature.milestones.find((entry) => entry.level === level);
    if (milestone && (feature.unlockLevel ?? 1) < level) {
      gains.push({ kind: "improvement", name: feature.name, detail: milestone.label });
    }
  });

  const subclassId = draft.selectedSubclassOptions?.[0] ?? null;
  const subclass = subclassId ? classEntry.subclasses.find((entry) => entry.id === subclassId) : null;
  subclass?.features
    .filter((feature) => (feature.unlockLevel ?? 1) === level)
    .forEach((feature) => gains.push({ kind: "subclass", name: feature.name, detail: feature.summary }));
  subclass?.expandedSpells
    .filter((entry) => entry.unlockLevel === level && entry.spells.length)
    .forEach((entry) =>
      gains.push({
        kind: "subclass",
        name: `${subclass.name} spells`,
        detail: `${entry.uses === "list" ? "Added to your spell list" : "Always known"}: ${entry.spells.join(", ")}`,
      }),
    );
  return gains;
}

/** Bu level'da ASI var mi ve doldurulmus mu. */
export function asiStatus(catalog: EngineCatalog, draft: CharacterDraft) {
  const levels = classAsiLevels(catalog, draft.classId).filter((level) => level <= draft.level);
  const active = activeAsiChoices(catalog, draft);
  const open = levels.filter((level) => {
    const choice = active[level];
    if (!choice?.mode) {
      return true;
    }
    if (choice.mode === "feat") {
      return !choice.featId;
    }
    if (choice.mode === "plus-two") {
      return !choice.plusTwoAbilityId;
    }
    return choice.plusOneAbilityIds.length < 2;
  });
  return { levels, open };
}
