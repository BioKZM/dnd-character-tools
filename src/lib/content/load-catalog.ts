import { readClassCuratedCollection } from "@/lib/content/class-curated-content";
import { readClassOptionCollection } from "@/lib/content/class-options-content";
import { readCreatorOptions, readNormalizedContent } from "@/lib/content/file-content";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { readSpellReferenceCollection } from "@/lib/content/spell-reference";
import { readLineageDataCatalog } from "@/lib/data/lineages/content";

/**
 * Creator ve Sheet sayfalarinin build sirasinda okudugu tum veri.
 * Tek yerden yuklenir ki iki sayfa asla farkli veri gormesin.
 */
export function loadCharacterCatalog() {
  return {
    initialContent: readNormalizedContent(),
    initialCreatorOptions: readCreatorOptions(),
    initialLineageCollection: readLineageCollection(),
    initialLineageDataCatalog: readLineageDataCatalog(),
    initialClassCuratedCollection: readClassCuratedCollection(),
    initialClassOptionCollection: readClassOptionCollection(),
    initialSpellReferenceCollection: readSpellReferenceCollection(),
  };
}
