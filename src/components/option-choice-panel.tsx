"use client";

import { useState } from "react";
import type { AvailableChoice } from "@/lib/engine/collect";
import { PickGrid, PickSection, type PickTile } from "@/components/ui/pick-grid";
import { Keywordize } from "@/components/ui/keyword-text";
import { featureIcon, schoolIcon, skillIcon, styleIcon, toolIcon, weaponIcon, type GameIconName } from "@/lib/ui/game-icons";
import { GearCard } from "@/components/ui/gear-info";
import { findGearInfo, type GearInfo } from "@/lib/content/item-info";
import type { ContentBundle } from "@/lib/content/schema";

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

function candidateIcon(kind: string, candidate: AvailableChoice["candidates"][number], label = ""): GameIconName {
  if (kind === "weapon") {
    return weaponIcon(candidate.name);
  }
  if (kind === "tool") {
    return toolIcon(candidate.name);
  }
  if (kind === "skill") {
    return skillIcon(candidate.id);
  }
  if (kind === "option") {
    return /fighting style/i.test(label) ? styleIcon(candidate.name) : featureIcon(candidate.name);
  }
  if (kind === "ability") {
    return "stars-stack";
  }
  if (kind === "language") {
    return "talk";
  }
  return schoolIcon(candidate.tags.join(" "));
}

function candidateSub(kind: string, tags: string[], summary?: string) {
  if (kind === "option" && summary) {
    return summary.length > 70 ? `${summary.slice(0, 67).trimEnd()}...` : summary;
  }
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
  const [inspected, setInspected] = useState<string | null>(null);
  const { choice, selectedIds, sourceName } = entry;
  const kind = choice.from.kind;
  const needle = query.trim().toLowerCase();
  const candidates = [...entry.candidates]
    .filter((candidate) => !needle || candidate.name.toLowerCase().includes(needle) || selectedIds.includes(candidate.id))
    .sort((left, right) => Number(selectedIds.includes(right.id)) - Number(selectedIds.includes(left.id)));
  const visible = candidates;
  const full = selectedIds.length >= choice.count;
  const tiles: PickTile[] = visible.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    sub: gearFor(content, kind, candidate)?.sub ?? candidateSub(kind, candidate.tags, candidate.summary),
    icon: candidateIcon(kind, candidate, choice.label),
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
        <PickGrid key={needle} items={tiles} columns={kind === "ability" ? 6 : kind === "option" ? 3 : 5} size="sm" pageSize={15} label={choice.label} onPick={pick} onInspect={setInspected} inspectedId={inspected} />
      ) : (
        <p className="pick-note">Nothing matches this choice at your current level.</p>
      )}
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
