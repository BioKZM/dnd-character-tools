import type { ClassOptionEntry } from "@/lib/content/class-options-schema";
import type { OptionPrerequisite } from "@/lib/engine/grants";

export type InvocationRequirementContext = {
  level: number;
  pactBoonId: string | null;
  spellIds: string[];
};

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Yapisal on kosulu ekranda gosterilecek metne cevirir. */
export function invocationPrerequisiteLabel(prerequisite: OptionPrerequisite | undefined) {
  if (!prerequisite) {
    return null;
  }
  if (prerequisite.text) {
    return prerequisite.text;
  }

  const parts: string[] = [];
  if (prerequisite.level) {
    const suffix = prerequisite.level === 1 ? "st" : prerequisite.level === 2 ? "nd" : prerequisite.level === 3 ? "rd" : "th";
    parts.push(`${prerequisite.level}${suffix} level`);
  }
  if (prerequisite.pactBoon) {
    parts.push(`${titleCase(prerequisite.pactBoon)} feature`);
  }
  if (prerequisite.spellId) {
    parts.push(`${prerequisite.spellId.replace(/-/g, " ")} cantrip`);
  }
  return parts.length ? parts.join(", ") : null;
}

/** Invocation kartinin gosterim bilgisi. Eskiden ham Wikidot metninden regex'le ayristiriliyordu. */
export function parseWarlockInvocationSummary(option: ClassOptionEntry) {
  return {
    source: option.source ?? null,
    prerequisite: invocationPrerequisiteLabel(option.prerequisite),
    requirement: option.prerequisite,
    description: option.summary,
  };
}

export function warlockInvocationMeetsPrerequisite(
  prerequisite: OptionPrerequisite | undefined,
  context: InvocationRequirementContext,
) {
  if (!prerequisite) {
    return true;
  }
  if (prerequisite.level && context.level < prerequisite.level) {
    return false;
  }
  if (prerequisite.pactBoon && context.pactBoonId !== prerequisite.pactBoon) {
    return false;
  }
  if (prerequisite.spellId && !context.spellIds.includes(prerequisite.spellId)) {
    return false;
  }
  return true;
}
