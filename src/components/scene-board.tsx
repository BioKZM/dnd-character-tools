import type { CampaignHubData } from "@/lib/campaign/campaign-hub";

export function SceneBoard({ data }: { data: CampaignHubData }) {
  return (
    <section className="dashboard-grid">
      <article className="sheet-card">
        <div className="card-heading">
          <h2>Token Board</h2>
          <span>Positioning for combat and story scenes</span>
        </div>
        <div className="scene-board">
          {data.tokens.map((token) => (
            <div className={`token-card ${token.kind}`} key={token.id}>
              <strong>{token.label}</strong>
              <span>{token.position}</span>
              <p>{token.state}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="sheet-card">
        <div className="card-heading">
          <h2>Scene Goals</h2>
          <span>What this board will become</span>
        </div>
        <div className="dashboard-stack">
          <div className="dashboard-note reminder">
            <strong>Token drop workflow</strong>
            <p>Drag PCs, monsters, objectives, and hazards into a lightweight board instead of a full VTT.</p>
          </div>
          <div className="dashboard-note alert">
            <strong>Current monster staging</strong>
            <p>
              {data.monsters
                .slice(0, 2)
                .map((monster) => `${monster.name} (${monster.role})`)
                .join(" and ")}{" "}
              are ready to be pinned into the current scene board.
            </p>
          </div>
          <div className="dashboard-note reminder">
            <strong>Condition overlay</strong>
            <p>Show concentration, hidden, prone, grappled, and aura radius directly on the token layer.</p>
          </div>
          <div className="dashboard-note reminder">
            <strong>Travel continuity</strong>
            <p>Re-use the same board for camp scenes, chases, and dungeon beats so story flow stays coherent.</p>
          </div>
        </div>
      </article>
    </section>
  );
}
