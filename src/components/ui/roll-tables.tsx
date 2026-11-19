"use client";

import { useState } from "react";
import type { Background } from "@/lib/content/schema";
import { ChoiceSlot } from "@/components/ui/choice-picker";

export type RollTable = Background["tables"][number];

/** Secimler draft.choices icinde; "custom:" oneki sanitizeChoices'tan korur. Deger: 0'dan baslayan satir no. */
export const rollTableKey = (tableId: string) => `custom:table:${tableId}`;

/** 0..sides-1 arasi zar (sadece tiklamada cagrilir). */
function rollDie(sides: number) {
  return Math.floor(Math.random() * sides);
}

/** Secilen satir (yoksa null). */
export function rollTablePick(choices: Record<string, string[]> | undefined, table: RollTable) {
  const raw = choices?.[rollTableKey(table.id)]?.[0];
  const index = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(index) && index >= 0 && index < table.entries.length ? index : null;
}

/**
 * Background zar tablolari (Feylost Fey Mark gibi). Her tablo bir slot; acinca satirlar
 * numarali liste, ustte "Roll d8" butonu. Zar atinca kisa bir yuvarlanma, sonra sonuc secilir.
 */
export function RollTables({
  title,
  tables,
  choices,
  onPick,
}: {
  title: string;
  tables: RollTable[];
  choices: Record<string, string[]> | undefined;
  onPick: (tableId: string, index: number | null) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [rolling, setRolling] = useState<{ id: string; face: number } | null>(null);
  const [lastRoll, setLastRoll] = useState<{ id: string; face: number } | null>(null);
  if (!tables.length) {
    return null;
  }

  const roll = (table: RollTable) => {
    const final = rollDie(table.die);
    let ticks = 0;
    const spin = () => {
      ticks += 1;
      if (ticks < 9) {
        setRolling({ id: table.id, face: rollDie(table.die) });
        window.setTimeout(spin, 45 + ticks * 12);
        return;
      }
      setRolling(null);
      setLastRoll({ id: table.id, face: final });
      onPick(table.id, final);
    };
    spin();
  };

  return (
    <section className="race-gives roll-tables" aria-label={title}>
      <h3 className="section-title">{title}</h3>
      <div className="choice-slots">
        {tables.map((table) => {
          const picked = rollTablePick(choices, table);
          const open = openId === table.id;
          const spinning = rolling?.id === table.id ? rolling.face : null;
          return (
            <div key={table.id} className="choice-slot-wrap">
              <ChoiceSlot
                icon={picked !== null ? "rolling-dices" : null}
                kind={`${table.title} · d${table.die}${table.required ? "" : " · optional"}`}
                value={picked !== null ? table.entries[picked] : table.required ? "Not rolled yet" : "Not chosen"}
                missing={table.required && picked === null}
                open={open}
                action={open ? "Close" : picked !== null ? "Change" : "Roll or pick"}
                onClick={() => setOpenId(open ? null : table.id)}
              />
              {open ? (
                <div className="roll-table">
                  <div className="roll-table-head">
                    {table.note ? <p>{table.note}</p> : null}
                    <button type="button" className="choice-take roll-table-roll" disabled={rolling !== null} onClick={() => roll(table)}>
                      {`Roll d${table.die}`}
                    </button>
                  </div>
                  {lastRoll?.id === table.id && spinning === null ? <p className="roll-table-result">{`You rolled ${lastRoll.face + 1}.`}</p> : null}
                  <ol className="roll-table-list">
                    {table.entries.map((entry, index) => {
                      const on = picked === index;
                      return (
                        <li key={`${table.id}-${index}`}>
                          <button
                            type="button"
                            className={`roll-table-row${on ? " on" : ""}${spinning === index ? " spin" : ""}`}
                            aria-pressed={on}
                            onClick={() => onPick(table.id, on ? null : index)}
                          >
                            <b>{index + 1}</b>
                            <span>{entry}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
