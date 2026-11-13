"use client";

import { useState } from "react";
import type { AvailableChoice } from "@/lib/engine/collect";
import { PickGrid, type PickTile } from "@/components/ui/pick-grid";
import { Keywordize } from "@/components/ui/keyword-text";
import { featureIcon, schoolIcon, skillIcon, styleIcon, toolIcon, weaponIcon, type GameIconName } from "@/lib/ui/game-icons";
import { GearCard } from "@/components/ui/gear-info";
import { findGearInfo, type GearInfo } from "@/lib/content/item-info";
import type { ContentBundle } from "@/lib/content/schema";

/**
 * Secilen opsiyonlarin ve acilmis feature'larin `choices` alanlari icin genel secim paneli.
 * Her secim acilir bir grup: basliginda durum (✓ / kesik halka), ne zaman acildigi ve secilen deger.
 * Bir grup dolunca siradaki eksik grup kendiliginden acilir. Data'ya yeni secim eklenince ekstra UI gerekmez.
 */
export function OptionChoicePanel({
  choices,
  onToggle,
  content,
  title,
}: {
  choices: AvailableChoice[];
  onToggle: (choiceId: string, value: string) => void;
  /** Verilirse silah / tool secimlerinde hasar, menzil, ne ise yaradigi gosterilir. */
  content?: ContentBundle;
  /** Grup kutusunun basligi (or. "Kensei choices"). */
  title?: string;
}) {
  // undefined: otomatik (ilk eksik grup acik); null: hepsi kapali.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);
  if (!choices.length) {
    return null;
  }
  const isDone = (entry: AvailableChoice) => entry.selectedIds.length >= (entry.choice.min ?? entry.choice.count);
  const firstOpen = choices.find((entry) => !isDone(entry))?.choice.id ?? null;
  const activeId = openId === undefined ? firstOpen : openId;
  const doneCount = choices.filter(isDone).length;

  const toggle = (entry: AvailableChoice, value: string) => {
    const adding = !entry.selectedIds.includes(value);
    onToggle(entry.choice.id, value);
    // Bu secimle grup doluyorsa siradaki eksik gruba gec.
    if (adding && entry.selectedIds.length + 1 >= entry.choice.count) {
      const next = choices.find((other) => other.choice.id !== entry.choice.id && !isDone(other));
      setOpenId(next ? next.choice.id : null);
    }
  };

  return (
    <section className="choice-groups" aria-label={title ?? "Choices"}>
      <div className="choice-groups-head">
        <strong>{title ?? "Your choices"}</strong>
        <span className={doneCount === choices.length ? "done" : ""}>{`${doneCount} of ${choices.length} done`}</span>
      </div>
      {choices.map((entry) => (
        <ChoiceGroup
          key={entry.choice.id}
          entry={entry}
          open={activeId === entry.choice.id}
          done={isDone(entry)}
          onOpen={() => setOpenId(activeId === entry.choice.id ? null : entry.choice.id)}
          onPick={(value) => toggle(entry, value)}
          content={content}
        />
      ))}
    </section>
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

function ChoiceGroup({
  entry,
  open,
  done,
  onOpen,
  onPick,
  content,
}: {
  entry: AvailableChoice;
  open: boolean;
  done: boolean;
  onOpen: () => void;
  onPick: (value: string) => void;
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
  const full = selectedIds.length >= choice.count;
  const tiles: PickTile[] = candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    // Silahta kartta sadece hasar; el / menzil detayi alttaki kartta.
    sub: (kind === "weapon" ? gearFor(content, kind, candidate)?.sub.split(" · ")[0] : gearFor(content, kind, candidate)?.sub) ?? candidateSub(kind, candidate.tags, candidate.summary),
    icon: candidateIcon(kind, candidate, choice.label),
    selected: selectedIds.includes(candidate.id),
    dim: full && choice.count > 1 && !selectedIds.includes(candidate.id),
  }));
  const focus = entry.candidates.find((candidate) => candidate.id === inspected) ?? null;
  const focusGear = focus ? gearFor(content, kind, focus) : null;
  const chosenNames = selectedIds.map((id) => entry.candidates.find((candidate) => candidate.id === id)?.name ?? id);
  const need = choice.min ?? choice.count;
  const left = Math.max(0, need - selectedIds.length);

  const pick = (id: string) => {
    if (selectedIds.includes(id)) {
      onPick(id);
      return;
    }
    if (full && choice.count === 1 && selectedIds[0]) {
      // Tekli secimde yeni secim eskisinin yerine gecer.
      onPick(selectedIds[0]);
    } else if (full) {
      return;
    }
    onPick(id);
  };

  return (
    <div className={`choice-group${done ? " filled" : ""}${open ? " open" : ""}`}>
      <button type="button" className="choice-group-head" aria-expanded={open} onClick={onOpen}>
        <span className="choice-group-state" aria-hidden="true">
          {done ? "✓" : ""}
        </span>
        <span className="choice-group-title">
          <strong>{choice.label}</strong>
          {sourceName ? <span>{` · ${sourceName}`}</span> : null}
        </span>
        <span className={chosenNames.length ? "choice-group-value" : "choice-group-value pending"}>
          {chosenNames.length ? chosenNames.join(", ") : `Pick ${left || need}`}
          {chosenNames.length && left ? <em>{` · ${left} more`}</em> : null}
        </span>
        <span className="choice-group-caret" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div className="choice-group-body">
          {entry.candidates.length > 16 ? (
            <input
              type="search"
              className="pick-search option-choice-search"
              placeholder="Search..."
              aria-label={`Search ${choice.label}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          ) : null}
          {tiles.length ? (
            <PickGrid
              key={needle}
              items={tiles}
              columns={kind === "ability" ? 6 : kind === "option" ? 3 : 5}
              size="sm"
              pageSize={15}
              label={choice.label}
              onPick={pick}
              onInspect={setInspected}
              inspectedId={inspected}
            />
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
        </div>
      ) : null}
    </div>
  );
}
