import { CampaignShell } from "@/components/campaign-shell";
import { DmScreen } from "@/components/dm-screen";
import { loadCharacterCatalog } from "@/lib/content/load-catalog";

export default function CampaignDmPage() {
  const catalog = loadCharacterCatalog();
  return (
    <CampaignShell eyebrow="" title="" description="">
      <DmScreen
        initialContent={catalog.initialContent}
        initialCreatorOptions={catalog.initialCreatorOptions}
        initialLineageDataCatalog={catalog.initialLineageDataCatalog}
        initialClassCuratedCollection={catalog.initialClassCuratedCollection}
        initialClassOptionCollection={catalog.initialClassOptionCollection}
      />
    </CampaignShell>
  );
}
