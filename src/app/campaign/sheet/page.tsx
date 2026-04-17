import { CampaignShell } from "@/components/campaign-shell";
import { PartyRoomDashboard } from "@/components/party-room-dashboard";
import { readClassCuratedCollection } from "@/lib/content/class-curated-content";
import { readClassDocCollection } from "@/lib/content/class-docs";
import { readWarlockOptionCollection } from "@/lib/content/class-options-content";
import { readCreatorOptions, readNormalizedContent } from "@/lib/content/file-content";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { readRawBookManifest } from "@/lib/content/raw-books";
import { mergeSpellReferencesIntoContent, readSpellReferenceCollection } from "@/lib/content/spell-reference";

export default function CampaignSheetPage() {
  const spellReferences = readSpellReferenceCollection();
  const content = mergeSpellReferencesIntoContent(readNormalizedContent(), spellReferences);

  return (
    <CampaignShell
      eyebrow="Character Inspector"
      title="Sheet"
      description="Review the character output in a compact read-only layout."
    >
      <PartyRoomDashboard
        initialBookManifest={readRawBookManifest()}
        initialContent={content}
        initialCreatorOptions={readCreatorOptions()}
        initialLineageCollection={readLineageCollection()}
        initialClassCuratedCollection={readClassCuratedCollection()}
        initialWarlockOptions={readWarlockOptionCollection()}
        initialClassDocs={readClassDocCollection()}
        initialSpellReferenceCollection={spellReferences}
        mode="sheet"
      />
    </CampaignShell>
  );
}
