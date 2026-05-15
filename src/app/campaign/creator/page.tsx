import { CampaignShell } from "@/components/campaign-shell";
import { PartyRoomDashboard } from "@/components/party-room-dashboard";
import { readClassCuratedCollection } from "@/lib/content/class-curated-content";
import { readClassDocCollection } from "@/lib/content/class-docs";
import { readClassOptionCollection } from "@/lib/content/class-options-content";
import { readCreatorOptions, readNormalizedContent } from "@/lib/content/file-content";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { readLineageDataCatalog } from "@/lib/data/lineages/content";
import { readRawBookManifest } from "@/lib/content/raw-books";
import { mergeSpellReferencesIntoContent, readSpellReferenceCollection } from "@/lib/content/spell-reference";

export default function CampaignCreatorPage() {
  const spellReferences = readSpellReferenceCollection();
  const content = mergeSpellReferencesIntoContent(readNormalizedContent(), spellReferences);

  return (
    <CampaignShell
      eyebrow=""
      title=""
      description=""
    >
      <PartyRoomDashboard
        initialBookManifest={readRawBookManifest()}
        initialContent={content}
        initialCreatorOptions={readCreatorOptions()}
        initialLineageCollection={readLineageCollection()}
        initialLineageDataCatalog={readLineageDataCatalog()}
        initialClassCuratedCollection={readClassCuratedCollection()}
        initialClassOptionCollection={readClassOptionCollection()}
        initialClassDocs={readClassDocCollection()}
        initialSpellReferenceCollection={spellReferences}
        mode="creator"
      />
    </CampaignShell>
  );
}
