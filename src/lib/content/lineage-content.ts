import { readLineageDataCatalog } from "@/lib/data/lineages/content";
import type { LineageAbilityBonusRule, LineageEntry as StructuredLineageEntry, LineageFeature as StructuredLineageFeature, Sublineage as StructuredSublineage } from "@/lib/data/lineages/schema";
import {
  lineageCollectionSchema,
  type LineageCollection,
  type ResolvedLineageEntry,
  type SubraceEntry,
} from "@/lib/content/lineage-schema";

function abilityBonusSummary(rule: LineageAbilityBonusRule) {
  if (rule.type === "fixed") {
    return `${rule.ability} +${rule.amount}`;
  }

  const scope = rule.restrictedTo?.length ? ` (${rule.restrictedTo.join(", ")})` : "";
  return `Choose ${rule.count} ability score${rule.count > 1 ? "s" : ""} to gain +${rule.amount}${scope}`;
}

function structuredStats(entry: StructuredLineageEntry | StructuredSublineage) {
  const stats = [];

  if (entry.facts.age?.summary) {
    stats.push({ label: "Age", value: entry.facts.age.summary });
  }
  if (entry.facts.alignment?.summary) {
    stats.push({ label: "Alignment", value: entry.facts.alignment.summary });
  }
  if (entry.facts.size?.category) {
    stats.push({
      label: "Size",
      value: entry.facts.size.description ? `${entry.facts.size.category}. ${entry.facts.size.description}` : entry.facts.size.category,
    });
  }
  if (entry.facts.speed?.walk) {
    stats.push({
      label: "Speed",
      value: entry.facts.speed.description ? `${entry.facts.speed.walk} ft. ${entry.facts.speed.description}` : `${entry.facts.speed.walk} ft.`,
    });
  }
  if (entry.facts.languages?.values.length) {
    stats.push({
      label: "Languages",
      value: entry.facts.languages.description
        ? `${entry.facts.languages.values.join(", ")}. ${entry.facts.languages.description}`
        : entry.facts.languages.values.join(", "),
    });
  }

  return stats;
}

function structuredTrait(feature: StructuredLineageFeature) {
  return {
    id: feature.id,
    name: feature.name,
    summary: feature.summary,
  };
}

function structuredSubrace(entry: StructuredSublineage): SubraceEntry {
  return {
    id: entry.id,
    name: entry.name,
    summary: entry.summary,
    bonuses: entry.facts.abilityScoreBonuses.map(abilityBonusSummary),
    traits: entry.features.map(structuredTrait),
    stats: structuredStats(entry),
    flexibleAbilityScoreIncrease: entry.facts.abilityScoreBonuses.some((rule) => rule.type === "choice"),
    source: entry.source.book,
  };
}

function structuredLineage(entry: StructuredLineageEntry): ResolvedLineageEntry {
  return {
    id: entry.id,
    name: entry.name,
    sourceUrl: entry.source.url ?? "https://example.com",
    sourceLabel: entry.source.book,
    summary: entry.summary,
    stats: structuredStats(entry),
    coreBonuses: entry.facts.abilityScoreBonuses.map(abilityBonusSummary),
    coreTraits: entry.features.map(structuredTrait),
    flexibleAbilityScoreIncrease: entry.facts.abilityScoreBonuses.some((rule) => rule.type === "choice"),
    subraces: entry.sublineages.map(structuredSubrace),
    notes: [],
  };
}

export function readLineageCollection(): LineageCollection {
  return lineageCollectionSchema.parse({
    entries: readLineageDataCatalog().entries.map(structuredLineage),
  });
}
