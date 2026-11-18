"use client";

import { useState } from "react";
import type { LanguageChoice } from "@/lib/engine/collect";
import type { ContentBundle } from "@/lib/content/schema";
import { findGearInfo } from "@/lib/content/item-info";
import { ChoiceDetail, ChoicePicker, ChoiceSlot, type ChoiceRow } from "@/components/ui/choice-picker";

/**
 * Race ve background'dan gelen dil secimleri (or. Human ekstra dil, Lorehold Student 2 dil).
 * Stil v2: bildigin diller tek satir, her secim bir slot; slota tiklayinca liste + detay acilir.
 */
export function LanguageChoicePanel({
  choices,
  onToggle,
  content,
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
  const [openId, setOpenId] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const picked = new Set(choices.flatMap((choice) => choice.selectedNames.map((name) => name.toLowerCase())));
  const fixed = knownLanguages.filter((name) => !picked.has(name.toLowerCase()));

  const open = (choice: LanguageChoice) => {
    if (openId === choice.id) {
      setOpenId(null);
      return;
    }
    const knownLower = new Set(knownLanguages.map((name) => name.toLowerCase()));
    setOpenId(choice.id);
    setQuery("");
    setFocus(choice.selectedNames[0] ?? choice.options.find((name) => !knownLower.has(name.toLowerCase())) ?? choice.options[0] ?? null);
  };

  const renderPicker = (choice: LanguageChoice) => {
    const full = choice.selectedNames.length >= choice.count;
    const knownElsewhere = new Set(
      knownLanguages.map((name) => name.toLowerCase()).filter((name) => !choice.selectedNames.some((entry) => entry.toLowerCase() === name)),
    );
    const needle = query.trim().toLowerCase();
    const rows: ChoiceRow[] = choice.options
      .filter((language) => !needle || language.toLowerCase().includes(needle))
      .map((language) => {
        const info = content ? findGearInfo(content, language) : null;
        const mine = choice.selectedNames.includes(language);
        const owned = !mine && knownElsewhere.has(language.toLowerCase());
        return { id: language, name: language, icon: info?.icon ?? "talk", mine, owned, tag: owned ? "Known" : null };
      });
    const focusName = focus && choice.options.includes(focus) ? focus : null;
    const info = focusName && content ? findGearInfo(content, focusName) : null;
    const isMine = focusName ? choice.selectedNames.includes(focusName) : false;
    const known = focusName ? !isMine && knownElsewhere.has(focusName.toLowerCase()) : false;
    const take = () => {
      if (!focusName) return;
      if (isMine || !full) {
        onToggle(choice.id, focusName);
      } else if (choice.count === 1 && choice.selectedNames[0]) {
        onToggle(choice.id, choice.selectedNames[0]);
        onToggle(choice.id, focusName);
      } else {
        return;
      }
      if (!isMine && choice.selectedNames.length + 1 >= choice.count) {
        setOpenId(null);
      }
    };
    const detail = focusName ? (
      <ChoiceDetail
        icon={info?.icon ?? "talk"}
        name={focusName}
        source={info?.kicker ?? null}
        pitch={info?.summary || null}
        facts={info?.rows ?? []}
        warning={known ? "You already speak it." : null}
        action={
          known ? null : isMine ? (
            <button type="button" className="choice-take on" onClick={take}>
              ✓ Yours · remove
            </button>
          ) : full && choice.count > 1 ? (
            <span className="choice-take-note">{`You already picked ${choice.count}. Remove one first.`}</span>
          ) : (
            <button type="button" className="choice-take" onClick={take}>{`Learn ${focusName}`}</button>
          )
        }
      />
    ) : (
      <p className="choice-picker-empty">Pick a language from the list.</p>
    );
    return (
      <ChoicePicker
        label={choice.label}
        rows={rows}
        focusId={focusName}
        onFocus={setFocus}
        query={choice.options.length > 8 ? query : undefined}
        onQuery={choice.options.length > 8 ? setQuery : undefined}
        searchPlaceholder={`Search ${choice.options.length} languages`}
        detail={detail}
      />
    );
  };

  return (
    <section className="race-gives" aria-label="Languages">
      <div className="choice-slots">
        {fixed.length ? <ChoiceSlot auto icon="talk" kind="You speak" value={fixed.join(", ")} /> : null}
        {choices.map((choice) => {
          const isOpen = openId === choice.id;
          const missing = choice.selectedNames.length < choice.count;
          const firstInfo = choice.selectedNames[0] && content ? findGearInfo(content, choice.selectedNames[0]) : null;
          return (
            <div key={choice.id} className="choice-slot-wrap">
              <ChoiceSlot
                icon={choice.selectedNames.length ? firstInfo?.icon ?? "talk" : null}
                kind={`${choice.label}${choice.count > 1 ? ` · ${choice.selectedNames.length} of ${choice.count}` : ""} · ${choice.sourceName}`}
                value={choice.selectedNames.length ? choice.selectedNames.join(", ") : "Not chosen"}
                missing={missing}
                open={isOpen}
                action={isOpen ? "Close" : choice.selectedNames.length ? "Change" : "Choose"}
                onClick={() => open(choice)}
              />
              {isOpen ? renderPicker(choice) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
