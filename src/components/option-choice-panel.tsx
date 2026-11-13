"use client";

import { useState } from "react";
import type { AvailableChoice } from "@/lib/engine/collect";
import { PickGrid, PickSection, type PickTile } from "@/components/ui/pick-grid";
import { Keywordize } from "@/components/ui/keyword-text";
import { schoolIcon, skillIcon, toolIcon, weaponIcon, type GameIconName } from "@/lib/ui/game-icons";
import { GearCard } from "@/components/ui/gear-info";
import { findGearInfo, type GearInfo } from "@/lib/content/item-info";
import type { ContentBundle } from "@/lib/content/schema";

const VISIBLE_LIMIT = 24;

/**
 * Secilen opsiyonlarin ve acilmis feature'larin `choices` alanlari icin genel secim paneli.
 * Data'ya yeni bir secim eklendiginde ekstra UI kodu gerekmez.
 */
export function OptionChoicePanel({
  choices,
  onToggle,
  content,
}: {
  choices: AvailableChoice[];
  onToggle: (choiceId: string, value: string) => void;
  /** Verilirse silah / tool secimlerinde hasar, menzil, ne ise yaradigi gosterilir. */
  content?: ContentBundle;
}) {
  if (!choices.length) {
    return null;
  }

  return (
    <div className="option-choice-stack">
      {choices.map((entry) => (
        <ChoiceBlock key={entry.choice.id} entry={entry} onToggle={onToggle} content={content} />
      ))}
    </div>
  );
}

function candidateIcon(kind: string, candidate: AvailableChoice["candidates"][number]): GameIconName {
  if (kind === "weapon") {
    return weaponIcon(candidate.name);
  }
  if (kind === "tool") {
    return toolIcon(candidate.name);
  }
  if (kind === "skill") {
    return skillIcon(candidate.id);
  }
  return schoolIcon(candidate.tags.join(" "));
}

function candidateSub(kind: string, tags: string[]) {
  if (kind === "weapon" && tags.length > 1) {
    return tags.slice(1).join(" · ");
  }
  return tags.join(" · ");
}

function gearFor(content: ContentBundle | undefined, kind: string, candidate: AvailableChoice["candidates"][number]): GearInfo | null {
  if (!content || (kind !== "weapon" && kind !== "tool")) {
    return null;
  }
  return findGearInfo(content, candidate.name);
}

function ChoiceBlock({
  entry,
  onToggle,
  content,
}: {
  entry: AvailableChoice;
  onToggle: (choiceId: string, value: string) => void;
  content?: ContentBundle;
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const { choice, selectedIds, sourceName } = entry;
  const kind = choice.from.kind;
  const needle = query.trim().toLowerCase();
  const candidates = [...entry.candidates]
    .filter((candidate) => !needle || candidate.name.toLowerCase().includes(needle) || selectedIds.includes(candidate.id))
    .sort((left, right) => Number(selectedIds.includes(right.id)) - Number(selectedIds.includes(left.id)));
  const visible = showAll || needle ? candidates : candidates.slice(0, VISIBLE_LIMIT);
  const full = selectedIds.length >= choice.count;
  const tiles: PickTile[] = visible.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    sub: gearFor(content, kind, candidate)?.sub ?? candidateSub(kind, candidate.tags),
    icon: candidateIcon(kind, candidate),
    selected: selectedIds.includes(candidate.id),
    dim: full && choice.count > 1 && !selectedIds.includes(candidate.id),
  }));
  const focus = entry.candidates.find((candidate) => candidate.id === inspected) ?? null;
  const focusGear = focus ? gearFor(content, kind, focus) : null;

  const pick = (id: string) => {
    if (selectedIds.includes(id)) {
      onToggle(choice.id, id);
      return;
    }
    if (full && choice.count === 1 && selectedIds[0]) {
      // Tekli secimde yeni secim eskisinin yerine gecer.
      onToggle(choice.id, selectedIds[0]);
    } else if (full) {
      return;
    }
    onToggle(choice.id, id);
  };

  return (
    <PickSection
      title={choice.label}
      meta={sourceName}
      picked={selectedIds.length}
      total={choice.min ?? choice.count}
      actions={
        entry.candidates.length > 16 ? (
          <input
            type="search"
            className="pick-search option-choice-search"
            placeholder="Search..."
            aria-label={`Search ${choice.label}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null
      }
    >
      {tiles.length ? (
        <PickGrid items={tiles} columns={5} size="sm" label={choice.label} onPick={pick} onInspect={setInspected} inspectedId={inspected} />
      ) : (
        <p className="pick-note">Nothing matches this choice at your current level.</p>
      )}
      {!showAll && !needle && candidates.length > VISIBLE_LIMIT ? (
        <button type="button" className="inspect-toggle" onClick={() => setShowAll(true)}>
          {`Show all ${candidates.length}`}
        </button>
      ) : null}
      {focusGear ? (
        <GearCard key={focusGear.id} info={focusGear} defaultOpen />
      ) : focus?.summary ? (
        <p className="pick-note option-choice-detail">
          <strong>{focus.name}: </strong>
          <Keywordize>{focus.summary}</Keywordize>
        </p>
      ) : null}
    </PickSection>
  );
}
