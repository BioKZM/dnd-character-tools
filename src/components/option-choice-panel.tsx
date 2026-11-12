"use client";

import { useState } from "react";
import type { AvailableChoice } from "@/lib/engine/collect";

const PAGE_SIZE = 8;

/**
 * Secilen opsiyonlarin (invocation, pact boon...) `choices` alanlari icin genel secim paneli.
 * Data'ya yeni bir secim eklendiginde ekstra UI kodu gerekmez.
 */
export function OptionChoicePanel({
  choices,
  onToggle,
}: {
  choices: AvailableChoice[];
  onToggle: (choiceId: string, value: string) => void;
}) {
  if (!choices.length) {
    return null;
  }

  return (
    <div className="warlock-flow-panel">
      {choices.map((entry) => (
        <ChoiceBlock key={entry.choice.id} entry={entry} onToggle={onToggle} />
      ))}
    </div>
  );
}

function ChoiceBlock({ entry, onToggle }: { entry: AvailableChoice; onToggle: (choiceId: string, value: string) => void }) {
  const [page, setPage] = useState(0);
  const { choice, candidates, selectedIds, sourceName } = entry;
  const pageCount = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = candidates.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const full = selectedIds.length >= choice.count;
  const counter = choice.min ? `${selectedIds.length} / ${choice.count} selected` : `${selectedIds.length} selected`;

  return (
    <div className="creator-inline-list">
      <div className="list-row">
        <strong>{`${sourceName}: ${choice.label}`}</strong>
        <span>{counter}</span>
      </div>
      {candidates.length ? (
        <div className="compact-option-list graph-list">
          {paged.map((spell) => {
            const active = selectedIds.includes(spell.id);
            const disabled = !active && full;
            return (
              <label
                key={`${choice.id}-${spell.id}`}
                className={active ? "spell-selection-row active" : `spell-selection-row${disabled ? " disabled" : ""}`}
              >
                <input
                  type="checkbox"
                  className="visually-hidden"
                  checked={active}
                  disabled={disabled}
                  onChange={() => onToggle(choice.id, spell.id)}
                />
                <div className="spell-selection-main">
                  <strong className="spell-selection-title" title={spell.summary}>
                    {spell.name}
                  </strong>
                </div>
                <div className="spell-selection-tags important">
                  {spell.tags.map((tag) => (
                    <span key={`${spell.id}-${tag}`} className="spell-tooltip-chip tone-utility">
                      {tag}
                    </span>
                  ))}
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="list-row">
          <span>Nothing matches this choice at your current level.</span>
        </div>
      )}
      {pageCount > 1 ? (
        <div className="compact-pagination-row centered below-list">
          <button type="button" className="pagination-arrow" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>
            ‹
          </button>
          <span className="pagination-indicator">{`${safePage + 1} / ${pageCount}`}</span>
          <button
            type="button"
            className="pagination-arrow"
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
