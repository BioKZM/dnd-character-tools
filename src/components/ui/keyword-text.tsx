import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { AppIcon } from "@/components/ui/app-icon";

/**
 * LoL tarzi anahtar kelime vurgusu: metinde gecen stat'lar, HP, AC ve hasar turleri
 * kendi renginde ve ikonuyla gosterilir. Ornek: "Constitution" yesil + kalp.
 * Renkler globals.css'teki .kw-* siniflarinda.
 */

type IconName = Parameters<typeof AppIcon>[0]["name"];
type KeywordRule = { pattern: string; kind: string; icon: IconName; caseSensitive?: boolean };

const RULES: KeywordRule[] = [
  // Stat'lar: tam adlar buyuk harfle baslayinca, kisaltmalar sadece buyuk harfle (lowercase "con" eslesmesin).
  { pattern: "Strength|STR", kind: "str", icon: "sword", caseSensitive: true },
  { pattern: "Dexterity|DEX", kind: "dex", icon: "feather", caseSensitive: true },
  { pattern: "Constitution|CON", kind: "con", icon: "heart", caseSensitive: true },
  { pattern: "Intelligence|INT", kind: "int", icon: "book", caseSensitive: true },
  { pattern: "Wisdom|WIS", kind: "wis", icon: "eye", caseSensitive: true },
  { pattern: "Charisma|CHA", kind: "cha", icon: "feat", caseSensitive: true },
  // Can ve savunma
  { pattern: "temporary hit points|hit points|hit point|HP", kind: "hp", icon: "heart" },
  { pattern: "Armor Class|AC", kind: "ac", icon: "shield", caseSensitive: true },
  // Hasar turleri: "fire damage" gibi, "fire a bolt" eslesmesin diye "damage" ile birlikte.
  { pattern: "fire damage", kind: "fire", icon: "flame" },
  { pattern: "cold damage", kind: "cold", icon: "snowflake" },
  { pattern: "lightning damage", kind: "lightning", icon: "bolt" },
  { pattern: "thunder damage", kind: "thunder", icon: "bolt" },
  { pattern: "acid damage", kind: "acid", icon: "droplet" },
  { pattern: "poison damage", kind: "poison", icon: "droplet" },
  { pattern: "necrotic damage", kind: "necrotic", icon: "skull" },
  { pattern: "radiant damage", kind: "radiant", icon: "sun" },
  { pattern: "psychic damage", kind: "psychic", icon: "eye" },
  { pattern: "force damage", kind: "force", icon: "spark" },
  { pattern: "(?:bludgeoning|piercing|slashing) damage", kind: "physical", icon: "sword" },
  // Zar avantaji
  { pattern: "disadvantage", kind: "disadvantage", icon: "arrow-down" },
  { pattern: "advantage", kind: "advantage", icon: "arrow-up" },
];

// Kurallar sirayla denenir; uzun ifadeler (temporary hit points) kisalardan once yazili.
function buildMatcher() {
  // Buyuk/kucuk harf duyarsiz kurallar harf siniflariyla yazilir; boylece tek regex'te iki tur kural birlikte calisir.
  const source = RULES.map((rule) => {
    if (rule.caseSensitive) {
      return `\\b(${rule.pattern})\\b`;
    }
    const insensitive = rule.pattern.replace(/[a-z]/g, (char) => `[${char}${char.toUpperCase()}]`);
    return `\\b(${insensitive})\\b`;
  }).join("|");
  return new RegExp(source, "g");
}

let matcher: RegExp | null = null;

export function highlightKeywords(text: string, keyPrefix = "kw"): ReactNode {
  matcher ??= buildMatcher();
  matcher.lastIndex = 0;
  const parts: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    const ruleIndex = match.slice(1).findIndex((group) => group !== undefined);
    const rule = RULES[ruleIndex];
    if (!rule) {
      continue;
    }
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    parts.push(
      <span key={`${keyPrefix}-${match.index}`} className={`kw kw-${rule.kind}`}>
        <AppIcon name={rule.icon} className="kw-icon" />
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (!parts.length) {
    return text;
  }
  if (last < text.length) {
    parts.push(text.slice(last));
  }
  return parts;
}

/** Alt agactaki tum metinleri vurgular. data-no-keywords olan elemanlara dokunmaz. */
export function Keywordize({ children }: { children: ReactNode }): ReactNode {
  return keywordizeNode(children, "kw");
}

function keywordizeNode(node: ReactNode, keyPrefix: string): ReactNode {
  return Children.map(node, (child, index) => {
    if (typeof child === "string") {
      return highlightKeywords(child, `${keyPrefix}-${index}`);
    }
    if (!isValidElement(child)) {
      return child;
    }
    const element = child as ReactElement<{ children?: ReactNode; "data-no-keywords"?: boolean }>;
    if (element.type === "svg" || element.props["data-no-keywords"] || element.props.children === undefined) {
      return element;
    }
    return cloneElement(element, undefined, keywordizeNode(element.props.children, `${keyPrefix}-${index}`));
  });
}

