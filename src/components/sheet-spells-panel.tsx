"use client";

import { useState } from "react";
import type { SpellcastingProfile } from "@/lib/engine/spellcasting";
import { UsageDots } from "@/components/sheet-usage-tracker";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import { classIcon, schoolIcon } from "@/lib/ui/game-icons";

export type SheetSpellEntry = {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  source: string;
  hit: string;
  damage: string;
  summary: string;
  /** "At Higher Levels" metni (upcast hesabi icin). */
  atHigherLevels?: string;
};

const LEVEL_TITLES = ["Cantrips", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** "1 reaction, which you take when..." -> "1 reaction". */
function shortCast(value: string) {
  return value.split(",")[0].trim();
}

/** Kendi secilen buyulerde kaynak yazmaya gerek yok; irk / feat / subclass'tan gelenlerde yaz. */
function extraSource(source: string) {
  return /^selected spell$/i.test(source.trim()) ? null : source;
}

/**
 * Sheet Spells sekmesi (stil v2).
 * Ustte buyu gucu seridi (DC + attack), altinda level gruplari. Slot noktalari grubun basliginda:
 * slot ile o level'in buyuleri ayni yerde. Satira tiklayinca detay acilir.
 */
export function SheetSpellsPanel({
  profiles,
  spells,
  usedSlots,
  onSlotChange,
}: {
  profiles: SpellcastingProfile[];
  spells: SheetSpellEntry[];
  usedSlots: Record<string, number>;
  onSlotChange: (slotKey: string, used: number) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const slots = profiles.flatMap((profile) => profile.slots);
  const levels = [...new Set([...spells.map((spell) => spell.level), ...slots.map((slot) => slot.level)])].sort((left, right) => left - right);

  const renderSlots = (level: number) =>
    slots
      .filter((slot) => slot.level === level)
      .map((slot) => {
        const key = `${slot.kind}-${slot.level}`;
        const used = Math.min(usedSlots[key] ?? 0, slot.total);
        return (
          <span key={key} className="sp-slots" title={slot.kind === "pact" ? "Pact slots refill on a short rest" : "Spell slots refill on a long rest"}>
            {slot.kind === "pact" ? <em>Pact</em> : null}
            <UsageDots total={slot.total} used={used} label={slot.kind === "pact" ? `Pact slots level ${slot.level}` : `${LEVEL_TITLES[slot.level]} slots`} onChange={(next) => onSlotChange(key, next)} />
            <span>{`${slot.total - used} left`}</span>
          </span>
        );
      });

  const renderRow = (spell: SheetSpellEntry) => {
    const open = openId === spell.id;
    const source = extraSource(spell.source);
    const sub = [shortCast(spell.castingTime), spell.range, spell.duration && spell.duration !== "Instantaneous" ? spell.duration.replace(/^Concentration,\s*/i, "") : null, source]
      .filter(Boolean)
      .join(" · ");
    const facts = [
      { label: "Casting time", value: spell.castingTime },
      { label: "Range", value: spell.range },
      { label: "Duration", value: `${spell.concentration ? "Concentration, " : ""}${spell.duration}` },
      { label: "School", value: spell.school },
      ...(spell.atHigherLevels ? [{ label: "Higher levels", value: spell.atHigherLevels }] : []),
    ].filter((fact) => fact.value && fact.value !== "-");
    return (
      <li key={spell.id} className={`sp-row${open ? " open" : ""}`}>
        <button type="button" className="sp-row-main" aria-expanded={open} onClick={() => setOpenId(open ? null : spell.id)}>
          <span className="inv-row-icon" aria-hidden="true">
            <GameIcon name={schoolIcon(spell.school)} />
          </span>
          <span className="inv-row-text">
            <strong>{spell.name}</strong>
            <small>{sub}</small>
          </span>
          <span className="sp-tags">
            {spell.hit !== "-" ? <span className="spell-tooltip-chip tone-utility">{spell.hit}</span> : null}
            {spell.damage !== "-" ? <span className="spell-tooltip-chip tone-danger">{spell.damage}</span> : null}
            {spell.concentration ? (
              <span className="sp-flag" title="Concentration">
                C
              </span>
            ) : null}
            {spell.ritual ? (
              <span className="sp-flag" title="Ritual">
                R
              </span>
            ) : null}
          </span>
        </button>
        {open ? (
          <div className="inv-detail">
            {spell.summary ? (
              <p>
                <Keywordize>{spell.summary}</Keywordize>
              </p>
            ) : null}
            <dl>
              {facts.map((fact) => (
                <div key={`${spell.id}-${fact.label}`}>
                  <dt>{fact.label}</dt>
                  <dd>
                    <Keywordize>{fact.value}</Keywordize>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="tab-body spells-tab-body sp-v2">
      {profiles.map((profile) => (
        <div className="sp-power" key={profile.sourceName}>
          <span className="inv-row-icon" aria-hidden="true">
            <GameIcon name={classIcon(profile.sourceName.toLowerCase())} />
          </span>
          <span className="inv-row-text">
            <strong>{profile.sourceName}</strong>
            <small>{`Casts with ${profile.ability}`}</small>
          </span>
          <span className="sp-power-stat">
            <b>{profile.saveDc}</b>
            <small>Save DC</small>
          </span>
          <span className="sp-power-stat">
            <b>{signed(profile.attackBonus)}</b>
            <small>Spell attack</small>
          </span>
        </div>
      ))}

      {levels.length ? (
        levels.map((level) => {
          const list = spells.filter((spell) => spell.level === level);
          return (
            <section className="inv-group sp-group" key={`spell-level-${level}`} aria-label={LEVEL_TITLES[level] ?? `Level ${level}`}>
              <div className="sp-group-head">
                <h3>
                  {LEVEL_TITLES[level] ?? `Level ${level}`}
                  <span>{list.length}</span>
                </h3>
                {renderSlots(level)}
              </div>
              {list.length ? <ul>{list.map(renderRow)}</ul> : <p className="sp-none">No spells of this level yet. Your slots still cast lower-level spells.</p>}
            </section>
          );
        })
      ) : (
        <div className="inv-empty">
          <GameIcon name="spell-book" />
          <p>No spells yet. Pick them in the creator.</p>
        </div>
      )}
    </div>
  );
}
