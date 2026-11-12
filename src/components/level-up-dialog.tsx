"use client";

import { useState } from "react";
import type { LevelGain } from "@/lib/engine/level-up";

export type LevelUpTask = {
  id: string;
  label: string;
  detail: string;
  /** Creator'da acilacak adim. */
  jump: { step: 0 | 1 | 2 | 3; browser: string };
};

export const CREATOR_JUMP_KEY = "codex-creator-jump";

/** Creator'i belirli bir adimda acmak icin (level up'tan "Choose" linkleri). */
export function readCreatorJump(): LevelUpTask["jump"] | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    const raw = window.sessionStorage.getItem(CREATOR_JUMP_KEY);
    return raw ? (JSON.parse(raw) as LevelUpTask["jump"]) : null;
  } catch {
    return null;
  }
}

export function clearCreatorJump() {
  try {
    window.sessionStorage.removeItem(CREATOR_JUMP_KEY);
  } catch {
    // yok say
  }
}

type Props = {
  phase: "preview" | "tasks";
  currentLevel: number;
  className: string;
  hitDie: number;
  hitDieAverage: number;
  conModifier: number;
  gains: LevelGain[];
  tasks: LevelUpTask[];
  lastHpGain: number | null;
  onConfirm: (roll: number | null) => void;
  onJump: (task: LevelUpTask) => void;
  onClose: () => void;
};

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function LevelUpDialog({
  phase,
  currentLevel,
  className,
  hitDie,
  hitDieAverage,
  conModifier,
  gains,
  tasks,
  lastHpGain,
  onConfirm,
  onJump,
  onClose,
}: Props) {
  const [hpMode, setHpMode] = useState<"average" | "roll">("average");
  const [roll, setRoll] = useState<number | null>(null);
  const nextLevel = currentLevel + 1;
  const rollValid = roll !== null && roll >= 1 && roll <= hitDie;
  const hpGain = Math.max(1, (hpMode === "average" ? hitDieAverage : rollValid ? roll : hitDieAverage) + conModifier);

  return (
    <div className="level-up-backdrop" role="presentation" onClick={onClose}>
      <section
        className="level-up-dialog sheet-card"
        role="dialog"
        aria-modal="true"
        aria-label="Level up"
        onClick={(event) => event.stopPropagation()}
      >
        {phase === "preview" ? (
          <>
            <header className="level-up-head">
              <span className="mini-heading">Level Up</span>
              <h2>{`${className} ${currentLevel} → ${nextLevel}`}</h2>
            </header>

            <div className="level-up-block">
              <strong>Hit Points</strong>
              <div className="level-up-hp-modes">
                <button
                  type="button"
                  className={hpMode === "average" ? "ability-flex-pick active" : "ability-flex-pick"}
                  onClick={() => setHpMode("average")}
                >
                  {`Average (${hitDieAverage})`}
                </button>
                <button
                  type="button"
                  className={hpMode === "roll" ? "ability-flex-pick active" : "ability-flex-pick"}
                  onClick={() => setHpMode("roll")}
                >
                  {`Roll 1d${hitDie}`}
                </button>
              </div>
              {hpMode === "roll" ? (
                <div className="level-up-roll-row">
                  <button
                    type="button"
                    className="sheet-button secondary"
                    disabled={roll !== null}
                    onClick={() => setRoll(1 + Math.floor(Math.random() * hitDie))}
                  >
                    {roll !== null ? `Rolled ${roll}` : `Roll d${hitDie}`}
                  </button>
                  <label>
                    <span>or enter your roll</span>
                    <input
                      type="number"
                      min={1}
                      max={hitDie}
                      aria-label="Hit die roll"
                      value={roll ?? ""}
                      onChange={(event) => setRoll(event.target.value ? Number(event.target.value) : null)}
                    />
                  </label>
                </div>
              ) : null}
              <span className="level-up-hp-total">
                {`+${hpGain} max HP (${hpMode === "average" || !rollValid ? hitDieAverage : roll} ${signed(conModifier)} CON)`}
              </span>
              {hpMode === "roll" && roll !== null && !rollValid ? (
                <span className="feat-requirement-unmet">{`Roll must be between 1 and ${hitDie}.`}</span>
              ) : null}
            </div>

            <div className="level-up-block">
              <strong>{`What you gain at level ${nextLevel}`}</strong>
              {gains.length ? (
                <ul className="level-up-gains">
                  {gains.map((gain) => (
                    <li key={`${gain.kind}-${gain.name}-${gain.detail}`}>
                      <span className={`level-up-gain-kind ${gain.kind}`}>
                        {gain.kind === "feature" ? "New" : gain.kind === "improvement" ? "Improved" : "Subclass"}
                      </span>
                      <div>
                        <strong>{gain.name}</strong>
                        <span>{gain.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="level-up-muted">No new class features at this level; your proficiency, slots and HP update automatically.</span>
              )}
            </div>

            <footer className="level-up-actions">
              <button type="button" className="sheet-button secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="sheet-button"
                disabled={hpMode === "roll" && !rollValid}
                onClick={() => onConfirm(hpMode === "roll" && rollValid ? roll : null)}
              >
                {`Level up to ${nextLevel}`}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="level-up-head">
              <span className="mini-heading">{lastHpGain !== null ? `Level ${currentLevel} · +${lastHpGain} max HP` : `Level ${currentLevel}`}</span>
              <h2>{tasks.length ? "Choices to make" : "All set"}</h2>
            </header>
            {tasks.length ? (
              <ul className="level-up-tasks">
                {tasks.map((task) => (
                  <li key={task.id}>
                    <div>
                      <strong>{task.label}</strong>
                      <span>{task.detail}</span>
                    </div>
                    <button type="button" className="sheet-button secondary" onClick={() => onJump(task)}>
                      Choose
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="level-up-muted">Nothing left to choose. Your sheet is up to date.</span>
            )}
            <footer className="level-up-actions">
              <button type="button" className="sheet-button" onClick={onClose}>
                {tasks.length ? "Later" : "Done"}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
