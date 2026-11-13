"use client";

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
  title,
  subtitle,
  stats,
}: {
  steps: CreatorFlowStep[];
  activeStep: number;
  activeBrowser: string | null;
  onNavigate: (screen: CreatorFlowScreen) => void;
  title: string;
  subtitle: string;
  stats: SummaryStat[];
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
        <div className="creator-flow-summary">
          <span className="creator-flow-summary-name">
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </span>
          {stats.map((stat) => (
            <span key={`flow-stat-${stat.label}`} className="creator-flow-stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </span>
          ))}
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
}: {
  previous: CreatorFlowScreen | null;
  next: CreatorFlowScreen | null;
  pendingHere: number;
  onNavigate: (screen: CreatorFlowScreen) => void;
}) {
  return (
    <footer className="creator-flow-footer">
      {previous ? (
        <button type="button" className="sheet-button secondary" onClick={() => onNavigate(previous)}>
          {`Back: ${previous.label}`}
        </button>
      ) : (
        <span />
      )}
      <span className={pendingHere ? "creator-flow-note pending" : "creator-flow-note"}>
        {pendingHere
          ? `${pendingHere} ${pendingHere === 1 ? "choice" : "choices"} left here. You can come back later.`
          : "Nothing left to pick here."}
      </span>
      {next ? (
        <button type="button" className="sheet-button primary" onClick={() => onNavigate(next)}>
          {`Next: ${next.label}`}
        </button>
      ) : (
        <span />
      )}
    </footer>
  );
}
