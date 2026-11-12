import type { FeatureFacts } from "@/lib/content/schema";
import { AppIcon } from "@/components/ui/app-icon";
import { highlightKeywords } from "@/components/ui/keyword-text";

/**
 * Feature'larin katmanli gosterimi:
 *  1. short: bir bakista okunan tek satir
 *  2. FactChips: eylem, maliyet, kullanim, menzil, save, sure etiketleri
 *  3. RulesText: wiki'deki tam metin, anahtar kelimeler ve onemli ifadeler vurgulu
 */

type IconName = Parameters<typeof AppIcon>[0]["name"];

const ACTION_ICON: Record<string, IconName> = {
  Action: "sword",
  "Bonus Action": "bolt",
  Reaction: "shield",
  Passive: "spark",
  Special: "spark",
};

const ABILITY_KIND: Record<string, string> = {
  STR: "str",
  DEX: "dex",
  CON: "con",
  INT: "int",
  WIS: "wis",
  CHA: "cha",
};

export type SaveDcs = { spell?: number | null; ki?: number | null };

export function FactChips({ facts, dcs = {}, hidePassive = false }: { facts?: FeatureFacts; dcs?: SaveDcs; hidePassive?: boolean }) {
  if (!facts) {
    return null;
  }
  const chips: { key: string; icon: IconName; label: string; tone?: string }[] = [];
  if (facts.action && !(hidePassive && facts.action === "Passive")) {
    chips.push({ key: "action", icon: ACTION_ICON[facts.action] ?? "spark", label: facts.action, tone: `action-${facts.action.toLowerCase().replace(/\s+/g, "-")}` });
  }
  if (facts.cost) {
    chips.push({ key: "cost", icon: "droplet", label: facts.cost, tone: "cost" });
  }
  if (facts.uses) {
    chips.push({ key: "uses", icon: "level", label: facts.uses });
  }
  if (facts.save) {
    const dc = facts.dc ? dcs[facts.dc] : null;
    chips.push({ key: "save", icon: "shield", label: `${facts.save} save${dc ? ` · DC ${dc}` : ""}`, tone: `kw-${ABILITY_KIND[facts.save] ?? "ac"}` });
  }
  if (facts.range) {
    chips.push({ key: "range", icon: "skill", label: facts.range });
  }
  if (facts.duration) {
    chips.push({ key: "duration", icon: "scroll", label: facts.duration });
  }
  if (!chips.length) {
    return null;
  }
  return (
    <span className="fact-chip-row">
      {chips.map((chip) => (
        <span key={chip.key} className={`fact-chip${chip.tone ? ` fact-chip-${chip.tone}` : ""}`}>
          <AppIcon name={chip.icon} className="fact-chip-icon" />
          {chip.label}
        </span>
      ))}
    </span>
  );
}

/** Ilk cumle: kisa satiri olmayan (irk ozelligi, feat) kayitlar icin yedek. */
export function firstSentence(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(.{20,180}?[.!?])(\s|$)/);
  return match ? match[1] : clean.length > 180 ? `${clean.slice(0, 177)}...` : clean;
}

export function RulesText({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  const paragraphs = text
    .split(/\n{2,}|(?<=\.)\s{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return (
    <div className="rules-text">
      {paragraphs.map((paragraph, index) => (
        <p key={`${keyPrefix}-${index}`}>{highlightKeywords(paragraph, `${keyPrefix}-${index}`)}</p>
      ))}
    </div>
  );
}

/** Kisa satir + etiketler + "Full rules" acilir tam metin. */
export function LayeredFeature({
  id,
  short,
  summary,
  facts,
  dcs,
}: {
  id: string;
  short?: string;
  summary: string;
  facts?: FeatureFacts;
  dcs?: SaveDcs;
}) {
  const glance = short ?? firstSentence(summary);
  const hasMore = summary.replace(/\s+/g, " ").trim().length > glance.length + 10;
  return (
    <div className="layered-feature">
      <p className="layered-feature-short">{highlightKeywords(glance, `${id}-short`)}</p>
      <FactChips facts={facts} dcs={dcs} hidePassive />
      {hasMore ? (
        <details className="layered-feature-more">
          <summary>Full rules</summary>
          <RulesText text={summary} keyPrefix={id} />
        </details>
      ) : null}
    </div>
  );
}
