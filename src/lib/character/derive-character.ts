import { sampleContent } from "@/lib/content/sample-content";

export type CharacterDraft = {
  name: string;
  level: number;
  classId: string;
  speciesId: string;
  backgroundId: string;
  feats: string[];
  abilities: Record<"STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA", number>;
};

export function deriveCharacterSummary(draft: CharacterDraft) {
  const chosenClass = sampleContent.classes.find((item) => item.id === draft.classId);
  const chosenSpecies = sampleContent.species.find((item) => item.id === draft.speciesId);
  const chosenBackground = sampleContent.backgrounds.find(
    (item) => item.id === draft.backgroundId,
  );

  const conMod = Math.floor((draft.abilities.CON - 10) / 2);
  const proficiencyBonus = Math.ceil(draft.level / 4) + 1;
  const maxHp = chosenClass ? chosenClass.hitDie + conMod + (draft.level - 1) * (6 + conMod) : 0;

  return {
    name: draft.name,
    level: draft.level,
    className: chosenClass?.name ?? "Unknown Class",
    speciesName: chosenSpecies?.name ?? "Unknown Species",
    backgroundName: chosenBackground?.name ?? "Unknown Background",
    proficiencyBonus,
    maxHp,
    spellSaveDc: 8 + proficiencyBonus + Math.floor((draft.abilities.INT - 10) / 2),
    visibleTraits: chosenSpecies?.traits ?? [],
  };
}
