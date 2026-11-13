"use client";

import { useState } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import type { GameIconName } from "@/lib/ui/game-icons";

// Creator'in tek navigasyonu: ustte adimlar (Origin, Class, Abilities, Gear),
// altinda aktif adimin ekranlari ve tek satir karakter ozeti. En altta Back / Next.

export type CreatorFlowScreen = {
  step: number;
  browser: string;
  label: string;
  pending: number;
};

export type CreatorFlowStep = {
  id: number;
  label: string;
  screens: CreatorFlowScreen[];
};

type SummaryStat = { label: string; value: string };

export function CreatorFlowNav({
  steps,
  activeStep,
  activeBrowser,
  onNavigate,
}: {
  steps: CreatorFlowStep[];
  activeStep: number;
  activeBrowser: string | null;
  onNavigate: (screen: CreatorFlowScreen) => void;
}) {
  const current = steps.find((step) => step.id === activeStep) ?? steps[0];
  return (
    <section className="creator-flow" aria-label="Creator steps">
      <ol className="creator-flow-steps">
        {steps.map((step, index) => {
          const pending = step.screens.reduce((total, screen) => total + screen.pending, 0);
          const state = step.id === activeStep ? "now" : pending ? "todo" : "done";
          return (
            <li key={`flow-step-${step.id}`} className="creator-flow-step-item">
              <button
                type="button"
                className={`creator-flow-step ${state}`}
                aria-current={step.id === activeStep ? "step" : undefined}
                onClick={() => step.screens[0] && onNavigate(step.screens[0])}
              >
                <span className="creator-flow-dot" aria-hidden="true">
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className="creator-flow-step-label">
                  {step.label}
                  {pending && step.id !== activeStep ? <small>{`${pending} to pick`}</small> : null}
                </span>
              </button>
              {index < steps.length - 1 ? <span className="creator-flow-bar" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
      <div className="creator-flow-row">
        <div className="creator-flow-screens" role="tablist" aria-label={`${current?.label ?? ""} screens`}>
          {current && current.screens.length > 1
            ? current.screens.map((screen) => (
                <button
                  key={`flow-screen-${screen.browser}`}
                  type="button"
                  role="tab"
                  aria-selected={screen.browser === activeBrowser}
                  className={screen.browser === activeBrowser ? "creator-flow-screen active" : "creator-flow-screen"}
                  onClick={() => onNavigate(screen)}
                >
                  <i className={screen.pending ? "pending" : "ok"} aria-hidden="true" />
                  {screen.label}
                </button>
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

export function CreatorFlowFooter({
  previous,
  next,
  pendingHere,
  onNavigate,
  position,
}: {
  previous: CreatorFlowScreen | null;
  next: CreatorFlowScreen | null;
  pendingHere: number;
  onNavigate: (screen: CreatorFlowScreen) => void;
  /** "Class · 3 / 5" gibi konum etiketi. */
  position?: string;
}) {
  return (
    <footer className="creator-flow-footer">
      {previous ? (
        <button type="button" className="creator-nav-button back" onClick={() => onNavigate(previous)}>
          <span aria-hidden="true">←</span>
          <span className="creator-nav-button-text">
            <small>Back</small>
            {previous.label}
          </span>
        </button>
      ) : (
        <span />
      )}
      <span className="creator-flow-note-wrap">
        {position ? <small className="creator-flow-position">{position}</small> : null}
        <span className={pendingHere ? "creator-flow-note pending" : "creator-flow-note"}>
          {pendingHere ? `${pendingHere} ${pendingHere === 1 ? "pick" : "picks"} left on this screen. You can skip and come back.` : "This screen is done."}
        </span>
      </span>
      {next ? (
        <button type="button" className={pendingHere ? "creator-nav-button next" : "creator-nav-button next ready"} onClick={() => onNavigate(next)}>
          <span className="creator-nav-button-text">
            <small>{pendingHere ? "Skip to" : "Next"}</small>
            {next.label}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ) : (
        <span className="creator-flow-finish">All steps visited. Open the sheet to play.</span>
      )}
    </footer>
  );
}

/** Sagda sabit, kompakt karakter ozeti: kim oldugu, renkli statlar ve nelerin kaldigi. */
export function CreatorSummaryPanel({
  icon,
  name,
  lines,
  stats,
  abilities,
  steps,
  activeBrowser,
  onNavigate,
}: {
  icon: GameIconName;
  name: string;
  lines: string[];
  stats: SummaryStat[];
  abilities: Array<{ id: string; value: number }>;
  steps: CreatorFlowStep[];
  activeBrowser: string | null;
  onNavigate: (screen: CreatorFlowScreen) => void;
}) {
  const [todoOpen, setTodoOpen] = useState(false);
  const left = steps.flatMap((step) => step.screens.filter((screen) => screen.pending > 0).map((screen) => ({ step, screen })));
  const total = left.reduce((sum, entry) => sum + entry.screen.pending, 0);
  return (
    <section className="creator-summary" aria-label="Character summary">
      <div className="creator-summary-id">
        <span className="creator-summary-portrait">
          <GameIcon name={icon} />
        </span>
        <span className="creator-summary-name">
          <strong>{name}</strong>
          <span>{lines.join(" · ")}</span>
        </span>
        <span className="creator-summary-stats">
          {stats.map((stat) => (
            <span key={`sum-stat-${stat.label}`}>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
            </span>
          ))}
        </span>
      </div>
      <div className="creator-summary-abilities">
        {abilities.map((ability) => {
          const mod = Math.floor((ability.value - 10) / 2);
          return (
            <span key={`sum-ab-${ability.id}`} className={`ability-accent ability-accent-${ability.id.toLowerCase()}`}>
              <small>{ability.id}</small>
              <strong>{ability.value}</strong>
              <em>{mod >= 0 ? `+${mod}` : mod}</em>
            </span>
          );
        })}
      </div>
      <div className="creator-summary-todo">
        <button type="button" className="creator-summary-todo-toggle" aria-expanded={todoOpen} onClick={() => setTodoOpen((value) => !value)} disabled={!left.length}>
          <span className={total ? "pending" : "done"}>{total ? `Still to pick: ${total}` : "Everything picked"}</span>
          {left.length ? <i aria-hidden="true">{todoOpen ? "▴" : "▾"}</i> : null}
        </button>
        {todoOpen && left.length ? (
          <ul>
            {left.map(({ step, screen }) => (
              <li key={`todo-${screen.step}-${screen.browser}`}>
                <button
                  type="button"
                  className={screen.browser === activeBrowser ? "creator-summary-todo-item active" : "creator-summary-todo-item"}
                  onClick={() => onNavigate(screen)}
                >
                  <span>
                    <small>{step.label}</small>
                    {screen.label}
                  </span>
                  <b>{screen.pending}</b>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
