import { CampaignShell } from "@/components/campaign-shell";
import { PartyRoomDashboard } from "@/components/party-room-dashboard";
import { loadCharacterCatalog } from "@/lib/content/load-catalog";

export default function CampaignCreatorPage() {
  return (
    <CampaignShell eyebrow="" title="" description="">
      <PartyRoomDashboard {...loadCharacterCatalog()} mode="creator" />
    </CampaignShell>
  );
}
