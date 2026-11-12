"use client";

import type { LanguageChoice } from "@/lib/engine/collect";

/** Race ve background'dan gelen dil secimleri (orn. Human ekstra dil, Lorehold Student 2 dil). */
export function LanguageChoicePanel({
  choices,
  onToggle,
}: {
  choices: LanguageChoice[];
  onToggle: (choiceId: string, language: string) => void;
}) {
  if (!choices.length) {
    return null;
  }

  return (
    <div className="creator-subsection-stack">
      {choices.map((choice) => {
        const full = choice.selectedNames.length >= choice.count;
        return (
          <div className="creator-inline-list" key={choice.id}>
            <div className="list-row">
              <strong>{`${choice.sourceName}: ${choice.label}`}</strong>
              <span>{`${choice.selectedNames.length} / ${choice.count} selected`}</span>
            </div>
            <div className="fighter-feature-grid compact fighter-equipment-source-grid">
              {choice.options.map((language) => {
                const active = choice.selectedNames.includes(language);
                const disabled = !active && full;
                return (
                  <button
                    key={`${choice.id}-${language}`}
                    type="button"
                    className={active ? "fighter-journey-card active tool-choice-card" : `fighter-journey-card tool-choice-card${disabled ? " disabled" : ""}`}
                    disabled={disabled}
                    onClick={() => onToggle(choice.id, language)}
                  >
                    <strong>{language}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
