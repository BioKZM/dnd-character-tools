import { CampaignShell } from "@/components/campaign-shell";
import { PartyRoomDashboard } from "@/components/party-room-dashboard";
import { loadCharacterCatalog } from "@/lib/content/load-catalog";

export default function CampaignSheetPage() {
  return (
    <CampaignShell
      eyebrow="Character Inspector"
      title="Sheet"
      description="Review the character output in a compact read-only layout."
    >
      <PartyRoomDashboard {...loadCharacterCatalog()} mode="sheet" />
    </CampaignShell>
  );
}
