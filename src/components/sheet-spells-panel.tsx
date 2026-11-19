"use client";

import { useState, type ReactNode } from "react";
import type { SpellcastingProfile } from "@/lib/engine/spellcasting";
import { UsageDots } from "@/components/sheet-usage-tracker";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import { classIcon, schoolIcon } from "@/lib/ui/game-icons";
import { copyCost, totalCopper, type Currency } from "@/lib/character/spellbook";

/** Sadece wizard'da: kitap, hazirlik limiti, kopyalanabilecek buyuler. */
export type SheetSpellbook = {
  entries: SheetSpellEntry[];
  preparedIds: string[];
  prepareLimit: number;
  freeSlots: number;
  maxLevel: number;
  copyPool: Array<{ id: string; name: string; level: number; school: string }>;
};

export type SheetSpellEntry = {
  id: string;
  spellId?: string;
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
  return /^(selected spell|spellbook)$/i.test(source.trim()) ? null : source;
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
  spellbook = null,
  copiedCount = 0,
  currency,
  onTogglePrepared,
  onAddToBook,
}: {
  profiles: SpellcastingProfile[];
  spells: SheetSpellEntry[];
  usedSlots: Record<string, number>;
  onSlotChange: (slotKey: string, used: number) => void;
  spellbook?: SheetSpellbook | null;
  /** Para ile kopyalanmis buyu sayisi; geri kalani level up'tan gelen bedava buyuler. */
  copiedCount?: number;
  currency?: Currency;
  onTogglePrepared?: (spellId: string) => void;
  /** free: level up'tan gelen bedava hak; degilse kopyalama ucreti oder. */
  onAddToBook?: (spellId: string, mode: "free" | "copy") => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<"prepared" | "book">("prepared");
  const [copyQuery, setCopyQuery] = useState("");
  const [copyWarn, setCopyWarn] = useState<string | null>(null);
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

  const renderRow = (spell: SheetSpellEntry, action?: ReactNode) => {
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
        <div className="sp-row-head">
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
        {action}
        </div>
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

  const renderBook = (book: SheetSpellbook) => {
    const prepared = new Set(book.preparedIds);
    const preparedCount = book.preparedIds.length;
    const freeLeft = Math.max(0, book.freeSlots - Math.max(0, book.entries.length - copiedCount));
    const gold = currency ? totalCopper(currency) / 100 : 0;
    const needle = copyQuery.trim().toLowerCase();
    const pool = book.copyPool.filter((spell) => !needle || spell.name.toLowerCase().includes(needle));
    const levels = [...new Set(book.entries.map((entry) => entry.level))].sort((left, right) => left - right);
    return (
      <>
        <div className="sp-book-bar">
          <span className={preparedCount > book.prepareLimit ? "sp-book-count over" : "sp-book-count"}>
            <b>{`${preparedCount} / ${book.prepareLimit}`}</b>
            <small>prepared today</small>
          </span>
          <span className="sp-book-count">
            <b>{book.entries.length}</b>
            <small>in your spellbook</small>
          </span>
          <p>Prepare spells from your book after a long rest. You can only cast the prepared ones.</p>
        </div>
        {levels.map((level) => (
          <section className="inv-group sp-group" key={`book-${level}`} aria-label={`Spellbook ${LEVEL_TITLES[level]}`}>
            <div className="sp-group-head">
              <h3>
                {LEVEL_TITLES[level]}
                <span>{book.entries.filter((entry) => entry.level === level).length}</span>
              </h3>
            </div>
            <ul>
              {book.entries
                .filter((entry) => entry.level === level)
                .map((entry) => {
                  const id = entry.spellId ?? entry.id;
                  const on = prepared.has(id);
                  const full = !on && preparedCount >= book.prepareLimit;
                  return renderRow(
                    entry,
                    <button
                      type="button"
                      className={on ? "inv-equip on" : "inv-equip"}
                      aria-pressed={on}
                      disabled={full}
                      title={full ? `You can prepare ${book.prepareLimit}. Unprepare one first.` : undefined}
                      onClick={() => onTogglePrepared?.(id)}
                    >
                      {on ? "Prepared" : "Prepare"}
                    </button>,
                  );
                })}
            </ul>
          </section>
        ))}
        <section className="inv-group sp-copy" aria-label="Add to your spellbook">
          <div className="sp-group-head">
            <h3>Add to your spellbook</h3>
            <span className="sp-copy-gold">{freeLeft ? `${freeLeft} free from leveling` : `You have ${Math.floor(gold)} gp`}</span>
          </div>
          <p className="sp-copy-note">
            {freeLeft
              ? "Each wizard level adds 2 spells to your book for free. Spells found on scrolls or in other books cost gold and time to copy."
              : `Copying a spell from a scroll or another book costs 50 gp and 2 hours per spell level. Up to level ${book.maxLevel}.`}
          </p>
          <input type="search" className="choice-picker-search" placeholder={`Search ${book.copyPool.length} wizard spells`} aria-label="Search wizard spells" value={copyQuery} onChange={(event) => setCopyQuery(event.target.value)} />
          <ul className="sp-copy-list">
            {pool.slice(0, 40).map((spell) => {
              const cost = copyCost(spell.level);
              const short = !freeLeft && gold < cost.gp;
              return (
                <li key={spell.id} className="sp-copy-row">
                  <span className="inv-row-icon" aria-hidden="true">
                    <GameIcon name={schoolIcon(spell.school)} />
                  </span>
                  <span className="inv-row-text">
                    <strong>{spell.name}</strong>
                    <small>{`${LEVEL_TITLES[spell.level]} · ${spell.school}${freeLeft ? "" : ` · ${cost.gp} gp, ${cost.hours} hours`}`}</small>
                  </span>
                  {copyWarn === spell.id && short ? (
                    <span className="sp-copy-warn">{`Not enough gold: needs ${cost.gp} gp, you have ${Math.floor(gold)} gp.`}</span>
                  ) : null}
                  <button
                    type="button"
                    className={short ? "inv-equip warn" : "inv-equip"}
                    onClick={() => {
                      if (short) {
                        setCopyWarn(spell.id);
                        return;
                      }
                      setCopyWarn(null);
                      onAddToBook?.(spell.id, freeLeft ? "free" : "copy");
                    }}
                  >
                    {freeLeft ? "Add" : `Copy · ${cost.gp} gp`}
                  </button>
                </li>
              );
            })}
            {pool.length > 40 ? <li className="sp-copy-more">{`${pool.length - 40} more. Search to narrow it down.`}</li> : null}
            {!pool.length ? <li className="sp-copy-more">Nothing matches.</li> : null}
          </ul>
        </section>
      </>
    );
  };

  return (
    <div className="tab-body spells-tab-body sp-v2">
      {spellbook ? (
        <div className="pick-segment sp-view" role="tablist" aria-label="Spell view">
          <button type="button" role="tab" aria-selected={view === "prepared"} className={view === "prepared" ? "active" : undefined} onClick={() => setView("prepared")}>
            Prepared
          </button>
          <button type="button" role="tab" aria-selected={view === "book"} className={view === "book" ? "active" : undefined} onClick={() => setView("book")}>
            Spellbook
          </button>
        </div>
      ) : null}
      {spellbook && view === "book" ? renderBook(spellbook) : null}
      {!spellbook || view === "prepared" ? (
      <>
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
              {list.length ? <ul>{list.map((spell) => renderRow(spell))}</ul> : <p className="sp-none">No spells of this level yet. Your slots still cast lower-level spells.</p>}
            </section>
          );
        })
      ) : (
        <div className="inv-empty">
          <GameIcon name="spell-book" />
          <p>No spells yet. Pick them in the creator.</p>
        </div>
      )}
      </>
      ) : null}
    </div>
  );
}
