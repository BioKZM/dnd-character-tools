import { CampaignShell } from "@/components/campaign-shell";
import { TravelPlanner } from "@/components/travel-planner";
import { getCampaignHubData } from "@/lib/campaign/campaign-hub";

export default function CampaignTravelPage() {
  const data = getCampaignHubData();

  return (
    <CampaignShell
      eyebrow="Travel Planner"
      title="Route & Pace"
      description="Track route segments, encounter hooks, weather pressure, and continuity across the campaign journey."
    >
      <TravelPlanner data={data} />
    </CampaignShell>
  );
}
