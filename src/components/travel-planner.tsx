import type { CampaignHubData } from "@/lib/campaign/campaign-hub";

export function TravelPlanner({ data }: { data: CampaignHubData }) {
  return (
    <section className="dashboard-grid">
      <article className="sheet-card">
        <div className="card-heading">
          <h2>Travel Timeline</h2>
          <span>Pace, danger, and hooks</span>
        </div>
        <div className="dashboard-stack">
          {data.travelPlan.map((leg) => (
            <div className="travel-leg-card" key={leg.id}>
              <div className="travel-leg-head">
                <strong>{leg.title}</strong>
                <span>{leg.risk} risk</span>
              </div>
              <div className="monster-stats">
                <span>{leg.distance}</span>
                <span>{leg.weather}</span>
              </div>
              <p>{leg.encounterHook}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="sheet-card">
        <div className="card-heading">
          <h2>Planner Notes</h2>
          <span>DM workflow</span>
        </div>
        <div className="dashboard-stack">
          <div className="dashboard-note reminder">
            <strong>Route beats</strong>
            <p>Turn each leg into a reusable scene with travel checks, weather state, and NPC interruptions.</p>
          </div>
          <div className="dashboard-note alert">
            <strong>Encounter pacing</strong>
            <p>Attach monster bundles to specific legs so hard fights do not stack accidentally.</p>
          </div>
          <div className="dashboard-note secret">
            <strong>Story continuity</strong>
            <p>Keep hidden reveals and clue states here so travel decisions do not break your mystery pacing.</p>
          </div>
        </div>
      </article>
    </section>
  );
}
