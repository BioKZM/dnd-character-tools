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
}: {
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
                return {
                  id: language,
                  name: language,
                  sub: info?.sub,
                  icon: info?.icon ?? "talk",
                  selected: active,
                  dim: !active && full,
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
