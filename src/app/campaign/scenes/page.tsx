import { CampaignShell } from "@/components/campaign-shell";
import { SceneBoard } from "@/components/scene-board";
import { getCampaignHubData } from "@/lib/campaign/campaign-hub";

export default function CampaignScenesPage() {
  const data = getCampaignHubData();

  return (
    <CampaignShell
      eyebrow="Scene Board"
      title="Token & Space"
      description="A lightweight scene layer for encounter placement, objective control, and non-combat positioning."
    >
      <SceneBoard data={data} />
    </CampaignShell>
  );
}
