"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { GameIcon } from "@/components/ui/game-icon";
import { AbilityIcon } from "@/components/ui/keyword-text";
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

type SummaryStat = { label: string; value: string; icon?: GameIconName; tip?: string };
export type SummaryIdentity = { key: string; icon: GameIconName; label: string; value: string; missing?: boolean };

const noopSubscribe = () => () => {};

export function CreatorFlowNav({
  steps,
  activeStep,
  onNavigate,
}: {
  steps: CreatorFlowStep[];
  activeStep: number;
  activeBrowser?: string | null;
  onNavigate: (screen: CreatorFlowScreen) => void;
}) {
  // Adimlar ustteki sabit uygulama cubuguna tasinir (campaign-shell'deki slot). Slot yoksa yerinde durur.
  const slot = useSyncExternalStore(
    noopSubscribe,
    () => document.getElementById("creator-steps-slot"),
    () => null,
  );
  const list = (
    <nav className="creator-flow" aria-label="Creator steps">
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
                title={pending && step.id !== activeStep ? `${pending} still to pick` : undefined}
                onClick={() => step.screens[0] && onNavigate(step.screens[0])}
              >
                <span className="creator-flow-dot" aria-hidden="true">
                  {state === "done" ? "✓" : index + 1}
                </span>
                <span className="creator-flow-step-label">{step.label}</span>
              </button>
              {index < steps.length - 1 ? <span className="creator-flow-bar" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
  return slot ? createPortal(list, slot) : list;
}

/** Ortadaki kartin basinda: aktif adimin ekranlari (Name & Level · Race · Background). Biten tik, eksik altin nokta. */
export function CreatorScreenTabs({
  step,
  activeBrowser,
  onNavigate,
}: {
  step: CreatorFlowStep | null;
  activeBrowser: string | null;
  onNavigate: (screen: CreatorFlowScreen) => void;
}) {
  if (!step || step.screens.length < 2) {
    return null;
  }
  return (
    <div className="creator-screen-tabs" role="tablist" aria-label={`${step.label} screens`}>
      {step.screens.map((screen) => (
        <button
          key={`screen-tab-${screen.browser}`}
          type="button"
          role="tab"
          aria-selected={screen.browser === activeBrowser}
          className={screen.browser === activeBrowser ? "creator-screen-tab active" : "creator-screen-tab"}
          onClick={() => onNavigate(screen)}
        >
          {screen.label}
          {screen.pending ? <i className="pending" aria-label={`${screen.pending} to pick`} /> : <b aria-label="done">✓</b>}
        </button>
      ))}
    </div>
  );
}

export function CreatorFlowFooter({
  previous,
  next,
  pendingHere,
  onNavigate,
}: {
  previous: CreatorFlowScreen | null;
  next: CreatorFlowScreen | null;
  pendingHere: number;
  onNavigate: (screen: CreatorFlowScreen) => void;
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
      <span className="creator-flow-spacer" />
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

/** Solda sabit karakter ozeti: kim oldugu, ikonlu kimlik satirlari, renkli statlar. Durum yazisi yok (stepper soyler). */
export function CreatorSummaryPanel({
  icon,
  name,
  identity,
  stats,
  abilities,
}: {
  icon: GameIconName;
  name: string;
  identity: SummaryIdentity[];
  stats: SummaryStat[];
  abilities: Array<{ id: string; value: number; name?: string }>;
}) {
  return (
    <section className="creator-summary" aria-label="Character summary">
      <div className="creator-summary-id">
        <span className="creator-summary-portrait">
          <GameIcon name={icon} />
        </span>
        <strong className="creator-summary-title">{name}</strong>
      </div>
      <ul className="creator-summary-identity">
        {identity.map((row) => (
          <li key={`sum-id-${row.key}`} className={row.missing ? "missing" : undefined}>
            <span className="creator-summary-identity-icon">
              <GameIcon name={row.icon} />
            </span>
            <span className="creator-summary-identity-text" title={row.label}>
              <strong>{row.value}</strong>
            </span>
          </li>
        ))}
      </ul>
      <div className="creator-summary-stats">
        {stats.map((stat) => (
          <span key={`sum-stat-${stat.label}`} className="creator-summary-stat" tabIndex={0} aria-label={`${stat.label} ${stat.value}`}>
            {stat.icon ? <GameIcon name={stat.icon} /> : <small>{stat.label}</small>}
            <strong>{stat.value}</strong>
            {stat.tip ? (
              <span className="creator-summary-tip" role="tooltip">
                <b>{stat.label}</b>
                {stat.tip}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <div className="creator-summary-abilities">
        {abilities.map((ability) => {
          const mod = Math.floor((ability.value - 10) / 2);
          return (
            <span key={`sum-ab-${ability.id}`} className={`ability-accent ability-accent-${ability.id.toLowerCase()}`} title={ability.name}>
              <small>
                <AbilityIcon id={ability.id} />
                {ability.id}
              </small>
              <strong>{ability.value}</strong>
              <em>{mod >= 0 ? `+${mod}` : mod}</em>
            </span>
          );
        })}
      </div>
    </section>
  );
}
