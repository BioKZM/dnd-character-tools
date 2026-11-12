import { CampaignShell } from "@/components/campaign-shell";
import { TravelPlanner } from "../travel-planner";
import { getCampaignHubData } from "../campaign-hub";

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
