export type InvocationRequirementContext = {
  level: number;
  pactBoonId: string | null;
  spellIds: string[];
};

const DESCRIPTION_STARTERS = [
  "When ",
  "You ",
  "As ",
  "Once ",
  "While ",
  "Choose ",
  "A ",
  "Your ",
  "Using ",
  "If ",
  "The ",
  "Unless ",
  "With ",
  "On ",
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findFirstBoundaryIndex(value: string) {
  const indexes = DESCRIPTION_STARTERS.map((starter) => value.indexOf(starter)).filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

export function parseWarlockInvocationSummary(summary: string) {
  let remaining = normalizeWhitespace(summary);
  let source: string | null = null;
  let prerequisite: string | null = null;

  if (remaining.startsWith("Source:")) {
    const afterSource = remaining.slice("Source:".length).trim();
    const prerequisiteIndex = afterSource.indexOf("Prerequisite:");
    const descriptionIndex = findFirstBoundaryIndex(afterSource);
    const sourceEndCandidates = [prerequisiteIndex, descriptionIndex].filter((index) => index >= 0);
    const sourceEnd = sourceEndCandidates.length ? Math.min(...sourceEndCandidates) : afterSource.length;
    source = normalizeWhitespace(afterSource.slice(0, sourceEnd));
    remaining = normalizeWhitespace(afterSource.slice(sourceEnd));
  }

  if (remaining.startsWith("Prerequisite:")) {
    const afterPrerequisite = remaining.slice("Prerequisite:".length).trim();
    const descriptionIndex = findFirstBoundaryIndex(afterPrerequisite);
    const prerequisiteEnd = descriptionIndex >= 0 ? descriptionIndex : afterPrerequisite.length;
    prerequisite = normalizeWhitespace(afterPrerequisite.slice(0, prerequisiteEnd));
    remaining = normalizeWhitespace(afterPrerequisite.slice(prerequisiteEnd));
  }

  return {
    source,
    prerequisite,
    description: remaining,
  };
}

export function warlockInvocationMeetsPrerequisite(
  prerequisite: string | null | undefined,
  context: InvocationRequirementContext,
) {
  if (!prerequisite) {
    return true;
  }

  const normalized = prerequisite.toLowerCase();
  const levelRequirement = normalized.match(/(\d+)(?:st|nd|rd|th)\s+level/);
  if (levelRequirement && context.level < Number(levelRequirement[1])) {
    return false;
  }

  if (normalized.includes("pact of the blade feature") && context.pactBoonId !== "pact-of-the-blade") {
    return false;
  }

  if (normalized.includes("pact of the chain feature") && context.pactBoonId !== "pact-of-the-chain") {
    return false;
  }

  if (normalized.includes("pact of the tome feature") && context.pactBoonId !== "pact-of-the-tome") {
    return false;
  }

  if (normalized.includes("pact of the talisman feature") && context.pactBoonId !== "pact-of-the-talisman") {
    return false;
  }

  if (normalized.includes("eldritch blast cantrip") && !context.spellIds.includes("eldritch-blast")) {
    return false;
  }

  return true;
}
