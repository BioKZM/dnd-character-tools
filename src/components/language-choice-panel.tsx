"use client";

import type { LanguageChoice } from "@/lib/engine/collect";
import type { ContentBundle } from "@/lib/content/schema";
import { PickGrid, PickSection } from "@/components/ui/pick-grid";
import { findGearInfo } from "@/lib/content/item-info";

/** Race ve background'dan gelen dil secimleri (orn. Human ekstra dil, Lorehold Student 2 dil). */
export function LanguageChoicePanel({
  choices,
  onToggle,
  content,
  onInspect,
  inspectedId,
  knownLanguages = [],
}: {
  /** Baska yerden (irk, background) zaten bilinen diller; tekrar secilemez. */
  knownLanguages?: string[];
  choices: LanguageChoice[];
  onToggle: (choiceId: string, language: string) => void;
  content?: ContentBundle;
  onInspect?: (id: string) => void;
  inspectedId?: string | null;
}) {
  if (!choices.length) {
    return null;
  }

  return (
    <div className="option-choice-stack">
      {choices.map((choice) => {
        const full = choice.selectedNames.length >= choice.count;
        const knownElsewhere = new Set(
          knownLanguages.map((name) => name.toLowerCase()).filter((name) => !choice.selectedNames.some((picked) => picked.toLowerCase() === name)),
        );
        return (
          <PickSection key={choice.id} title={choice.label} meta={choice.sourceName} picked={choice.selectedNames.length} total={choice.count}>
            <PickGrid
              label={choice.label}
              columns={4}
              size="sm"
              inspectedId={inspectedId}
              onInspect={onInspect}
              items={choice.options.map((language) => {
                const info = content ? findGearInfo(content, language) : null;
                const active = choice.selectedNames.includes(language);
                const known = !active && knownElsewhere.has(language.toLowerCase());
                return {
                  id: language,
                  name: language,
                  sub: info?.sub,
                  icon: info?.icon ?? "talk",
                  selected: active,
                  locked: known,
                  lockReason: known ? "You already know it" : undefined,
                  dim: !active && !known && full,
                };
              })}
              onPick={(language) => {
                const active = choice.selectedNames.includes(language);
                if (active || !full) {
                  onToggle(choice.id, language);
                } else if (choice.count === 1 && choice.selectedNames[0]) {
                  onToggle(choice.id, choice.selectedNames[0]);
                  onToggle(choice.id, language);
                }
              }}
            />
          </PickSection>
        );
      })}
    </div>
  );
}
