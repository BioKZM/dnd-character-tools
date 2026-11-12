"use client";

import type { SpellcastingProfile } from "@/lib/engine/spellcasting";
import { UsageDots } from "@/components/sheet-usage-tracker";

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
};

const LEVEL_LABELS = ["Cantrips", "1st Level", "2nd Level", "3rd Level", "4th Level", "5th Level", "6th Level", "7th Level", "8th Level", "9th Level"];

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Sheet'teki Spells sekmesi: DC/attack, slot sayaclari ve level'a gore buyu listesi. */
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
  const levels = [...new Set(spells.map((spell) => spell.level))].sort((left, right) => left - right);

  return (
    <div className="tab-body spells-tab-body">
      {profiles.map((profile) => (
        <div className="spellcasting-summary" key={profile.sourceName}>
          <div className="spellcasting-summary-stat">
            <span>Spellcasting</span>
            <strong>{`${profile.sourceName} · ${profile.ability}`}</strong>
          </div>
          <div className="spellcasting-summary-stat">
            <span>Spell Save DC</span>
            <strong>{profile.saveDc}</strong>
          </div>
          <div className="spellcasting-summary-stat">
            <span>Spell Attack</span>
            <strong>{signed(profile.attackBonus)}</strong>
          </div>
        </div>
      ))}

      {profiles.some((profile) => profile.slots.length) ? (
        <div className="spell-slot-list">
          {profiles.flatMap((profile) =>
            profile.slots.map((slot) => {
              const key = `${slot.kind}-${slot.level}`;
              const used = Math.min(usedSlots[key] ?? 0, slot.total);
              return (
                <div className="list-row spell-slot-row" key={key}>
                  <strong>{slot.kind === "pact" ? `Pact Slots (level ${slot.level})` : `${LEVEL_LABELS[slot.level]} Slots`}</strong>
                  <span className="spell-slot-meta">
                    <UsageDots total={slot.total} used={used} label={key} onChange={(next) => onSlotChange(key, next)} />
                    <span>{`${slot.total - used} / ${slot.total} left${slot.kind === "pact" ? " · short rest" : " · long rest"}`}</span>
                  </span>
                </div>
              );
            }),
          )}
        </div>
      ) : null}

      {levels.length ? (
        levels.map((level) => (
          <section className="spell-level-group" key={`spell-level-${level}`}>
            <div className="action-header">
              <span>{LEVEL_LABELS[level] ?? `Level ${level}`}</span>
              <span>{`${spells.filter((spell) => spell.level === level).length} spells`}</span>
            </div>
            <div className="action-card-list">
              {spells
                .filter((spell) => spell.level === level)
                .map((spell) => (
                  <article className="spell-selection-row action-selection-row" key={spell.id} title={spell.summary}>
                    <div className="spell-selection-main">
                      <strong className="spell-selection-title">{spell.name}</strong>
                      <span className="action-selection-source">{`${spell.source} · ${spell.castingTime} · ${spell.range}`}</span>
                    </div>
                    <div className="spell-selection-tags important">
                      {spell.hit !== "-" ? <span className="spell-tooltip-chip tone-utility">{spell.hit}</span> : null}
                      {spell.damage !== "-" ? <span className="spell-tooltip-chip tone-danger">{spell.damage}</span> : null}
                      {spell.concentration ? <span className="spell-tooltip-chip tone-support">Concentration</span> : null}
                      {spell.ritual ? <span className="spell-tooltip-chip tone-support">Ritual</span> : null}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))
      ) : (
        <div className="list-row">
          <strong>No spells</strong>
          <span>This character has no spells yet.</span>
        </div>
      )}
    </div>
  );
}
