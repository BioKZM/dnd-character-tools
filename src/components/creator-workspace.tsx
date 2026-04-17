"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CharacterDraft, AbilityId } from "@/lib/character/demo-sheet";
import { eldritchKnightProgression, getEldritchKnightProgression } from "@/lib/character/eldritch-knight";
import type { ClassDocBlock, ClassDocCollection, ClassDocSection, ClassDocTable } from "@/lib/content/class-docs";
import type { ClassCuratedCollection } from "@/lib/content/class-curated-schema";
import type { WarlockOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection, ResolvedLineageEntry, SubraceEntry } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { SpellReferenceCollection, SpellReferenceEntry } from "@/lib/content/spell-reference";
import { AppIcon } from "@/components/ui/app-icon";
import { ClassEmblem } from "@/components/ui/class-emblem";
import { ClassPortrait } from "@/components/ui/class-portrait";
import {
  parseWarlockInvocationSummary,
  warlockInvocationMeetsPrerequisite,
} from "@/lib/character/warlock-invocations";

type CreatorStep = 0 | 1 | 2;
type CreatorBrowser =
  | "identity"
  | "lineage"
  | "subrace"
  | "class"
  | "ranger-choices"
  | "fighter-choices"
  | "background"
  | "inventory"
  | "abilities"
  | "level"
  | "multiclass"
  | "subclass"
  | "subclass-choices"
  | "spells"
  | "skill-spells"
  | "feats"
  | "skills"
  | null;

const abilityLabels: Record<AbilityId, string> = {
  STR: "Strength",
  DEX: "Dexterity",
  CON: "Constitution",
  INT: "Intelligence",
  WIS: "Wisdom",
  CHA: "Charisma",
};

const skillAbilities: Record<string, AbilityId> = {
  acrobatics: "DEX",
  "animal-handling": "WIS",
  arcana: "INT",
  athletics: "STR",
  deception: "CHA",
  history: "INT",
  insight: "WIS",
  intimidation: "CHA",
  investigation: "INT",
  medicine: "WIS",
  nature: "INT",
  perception: "WIS",
  performance: "CHA",
  persuasion: "CHA",
  religion: "INT",
  "sleight-of-hand": "DEX",
  stealth: "DEX",
  survival: "WIS",
};

const skillDescriptionFallbacks: Partial<Record<string, string>> = {
  deception: "Bluff, misdirection, and convincing lies told with confidence.",
  performance: "Entertain, captivate a crowd, and command attention through art or presence.",
  "sleight-of-hand": "Palm objects, pick pockets, and perform precise manual tricks unnoticed.",
};

const classDescriptionTr: Partial<Record<string, string>> = {
  artificer:
    "Büyüyü aletler ve icatlar üzerinden kullanan teknik bir destek sınıfıdır. Eşyaları güçlendirir, utility sağlar ve hazırlıklı oynar.",
  barbarian:
    "Yakın dövüşte öfke ve dayanıklılık üstüne kurulu ön saf savaşçısıdır. Hasar emer, baskı kurar ve fiziksel gücüyle öne çıkar.",
  bard:
    "Destek, kontrol ve sosyal etkileşimde parlayan çok yönlü bir büyü sınıfıdır. İlham vererek takımı güçlendirir.",
  cleric:
    "İlahi güç kullanan dengeli bir caster sınıfıdır. Şifa, destek ve kutsal büyülerle hem savunma hem baskı kurabilir.",
  druid:
    "Doğa temelli büyüler kullanan esnek bir sınıftır. Vahşi Şekil ve alan kontrolüyle farklı rollere uyum sağlar.",
  fighter:
    "Silah ustalığı ve sürekli savaş temposu üzerine kurulu net bir martial sınıftır. Güvenilir hasar ve sağlam aksiyon ekonomisi sunar.",
  monk:
    "Hız, çeviklik ve ki kullanımına dayalı hareketli bir dövüşçüdür. Pozisyon alma ve seri aksiyonlarla oynar.",
  paladin:
    "Kutsal yeminleri ve yüksek patlama hasarıyla öne çıkan ön saf hibritidir. Savunma, aura ve smite gücü taşır.",
  ranger:
    "Takip, keşif ve hedef odaklı savaşta güçlü bir avcı sınıfıdır. Doğa bilgisiyle savaş desteğini birleştirir.",
  rogue:
    "Hassas vuruş, hareket kabiliyeti ve beceri uzmanlığıyla öne çıkan çevik sınıftır. Tek hedef baskısında çok etkilidir.",
  sorcerer:
    "Doğuştan gelen büyü gücüyle oynayan saf caster sınıfıdır. Sorcery point ve metamagic ile büyülerini esnetir.",
  warlock:
    "Bir varlıkla yaptığı anlaşmadan güç alan karizmatik caster sınıfıdır. Az ama etkili slotlar ve invocation seçenekleri sunar.",
  wizard:
    "Geniş büyü havuzu ve hazırlık esnekliğiyle en klasik arcane caster sınıfıdır. Bilgi, kontrol ve büyü çeşitliliği sağlar.",
};

const speciesDescriptionTr: Partial<Record<string, string>> = {
  aarakocra: "Gökyüzünde süzülen, kanatlı ve hava kökenli bir Species seçimidir.",
  aasimar: "Göksel güç taşıyan, ışık ve kutsal enerjiyle öne çıkan bir Species seçimidir.",
  aetherborn: "Kısa ömürlü ama özgün kimliği güçlü, büyüsel süreçlerden doğan bir Species seçimidir.",
  "elf-astral": "Astral kökenli, yıldız ışığı ve ilahi bağlarla öne çıkan bir elf Species seçimidir.",
  autognome: "Gnome ustalığıyla yaratılmış, mekanik yapısı olan bağımsız bir Species seçimidir.",
  bugbear: "Gizlilik, menzil ve fiziksel baskıyla öne çıkan iri yapılı bir goblinoid Species seçimidir.",
  centaur: "Hızlı hareket ve doğal dayanıklılık sunan yarı insan yarı at bir Species seçimidir.",
  changeling: "Kimliğini ve görünümünü değiştirebilen esnek bir Species seçimidir.",
  dragonborn: "Ejderha soyundan gelen, nefes silahı ve güçlü duruşuyla öne çıkan bir Species seçimidir.",
  dwarf: "Dayanıklılık, direnç ve zanaatkarlıkla öne çıkan klasik bir Species seçimidir.",
  elf: "Keskin algıları, zarafeti ve uzun ömrüyle öne çıkan klasik bir Species seçimidir.",
  firbolg: "Doğa ile bağı güçlü, sakin ama kuvvetli bir fey kökenli Species seçimidir.",
  genasi: "Elemental güçlerle şekillenmiş, doğaüstü köken taşıyan bir Species seçimidir.",
  giff: "Ağır silahlar ve askeri disiplinle öne çıkan güçlü bir Species seçimidir.",
  githyanki: "Astral savaş geleneği taşıyan, disiplinli ve saldırgan bir Species seçimidir.",
  githzerai: "Zihin disiplini ve iç dengeyle öne çıkan mistik bir Species seçimidir.",
  gnome: "Merak, zekâ ve yaratıcılıkla öne çıkan küçük ama becerikli bir Species seçimidir.",
  goblin: "Hızlı, kurnaz ve fırsatçı yapısıyla öne çıkan bir Species seçimidir.",
  goliath: "Fiziksel güç, dayanıklılık ve dağ yaşamına uyumuyla öne çıkan bir Species seçimidir.",
  "half-elf": "İnsan ve elf mirasını birleştiren, sosyal ve esnek bir Species seçimidir.",
  halfling: "Şans, çeviklik ve dayanıklılıkla öne çıkan küçük ama inatçı bir Species seçimidir.",
  "half-orc": "Ham güç, direnç ve savaşçı içgüdüleriyle öne çıkan bir Species seçimidir.",
  human: "Uyum yeteneği yüksek, çok yönlü ve esnek bir Species seçimidir.",
  kenku: "Taklit yeteneği, çevikliği ve gölgede kalma becerisiyle öne çıkan bir Species seçimidir.",
  kobold: "Sayı üstünlüğü, kurnazlık ve sürü taktiğiyle öne çıkan küçük bir Species seçimidir.",
  leonin: "Gururlu, korkusuz ve baskın savaşçı doğasıyla öne çıkan bir Species seçimidir.",
  lizardfolk: "İçgüdüsel hayatta kalma becerileri ve sert doğasıyla öne çıkan bir Species seçimidir.",
  orc: "Agresif hamleleri, fiziksel kuvveti ve savaşçı doğasıyla öne çıkan bir Species seçimidir.",
  satyr: "Fey kökenli, neşeli ve büyüye dirençli bir Species seçimidir.",
  shifter: "İçgüdüsel avcı yönünü kısa süreliğine açığa çıkarabilen bir Species seçimidir.",
  tabaxi: "Merak, hız ve çeviklikle öne çıkan kedi benzeri bir Species seçimidir.",
  tiefling: "Cehennemsel kökeni ve karizmatik duruşuyla öne çıkan bir Species seçimidir.",
  tortle: "Doğal zırhı ve sakin dayanıklılığıyla öne çıkan bir Species seçimidir.",
  triton: "Denizlerin koruyucusu olarak bilinen, suya uyumlu bir Species seçimidir.",
  "yuan-ti": "Yılan soyuyla ilişkili, soğukkanlı ve gizemli bir Species seçimidir.",
};

const speciesBenefitTr: Partial<Record<string, string>> = {
  "hill-dwarf": "Ekstra dayanıklılık ve uzun savaşlarda ayakta kalmanı kolaylaştıran sağlam bir yapı sunar.",
  "mountain-dwarf": "Daha ağır savaş düzenlerine uyum sağlayan kuvvetli ve dirençli bir başlangıç hissi verir.",
  dwarf: "Poison dayanıklılığı, sağlam yapı ve ön safta güven veren bir köken hissi taşır.",
  dragonborn: "Breath Weapon ve soyuna bağlı elemental resistance ile agresif bir kimlik kurar.",
  elf: "Keskin algılar, zarif hareket ve büyüsel ya da çevik build'lerle iyi çalışan bir temel sunar.",
  "high-elf": "Arcane yatkınlık ve çeviklik odaklı oynanış için doğal bir başlangıç sağlar.",
  "wood-elf": "Hız, gizlilik ve keşif odaklı build'lerde güçlü hissettiren bir avantaj sunar.",
  "dark-elf": "Karanlıkta üstünlük ve doğal büyü yatkınlığıyla riskli ama güçlü bir profil kurar.",
  gnome: "Mental savunma, merak ve teknik ya da büyüsel Class'larla uyumlu bir yapı sunar.",
  "forest-gnome": "Illusion teması ve doğayla yakınlık sayesinde utility odaklı seçimleri destekler.",
  "rock-gnome": "Tinkering ve bilgi odaklı oyunlarda öne çıkan teknik bir başlangıç verir.",
  halfling: "Lucky etkisiyle istikrarlı zar oyunu kurar ve güvenli oynanışı destekler.",
  "lightfoot-halfling": "Stealth ve sosyal manevra kabiliyetiyle çevik karakterlere çok iyi oturur.",
  "stout-halfling": "Lucky yanında ekstra dayanıklılık hissi vererek güvenli yakın menzil oynanışı destekler.",
  human: "Esnek gelişim alanı açar; hemen her Class'a temiz şekilde uyum sağlar.",
  "half-elf": "Ek Skill genişliği ve sosyal esneklikle hibrit ya da yüz karakterleri güçlendirir.",
  "half-orc": "Sert vuruşlar ve düşmekten dönme hissiyle ön saf martial karakterleri besler.",
  tiefling: "Fire resistance ve innate magic sayesinde karizmatik caster çizgisini güçlendirir.",
  goliath: "Ham dayanıklılık ve fiziksel baskıyla ağır ön saf Class'ları destekler.",
  aasimar: "Şifa, ışık ve kutsal tema çevresinde destek ya da ilahi caster kimliği kurar.",
  tabaxi: "Hızlı pozisyon alma ve hareket oyunu isteyen build'lerde fark yaratır.",
  tortle: "Doğal savunması sayesinde zırh bağımlılığı düşük, güvenli bir başlangıç verir.",
};

const creatorPageLabels = ["Origin", "Class", "Ability Scores"] as const;
const subclassUnlockLevel = 3;
const rangerFavoredEnemyOptions = [
  "aberrations",
  "beasts",
  "celestials",
  "constructs",
  "dragons",
  "elementals",
  "fey",
  "fiends",
  "giants",
  "humanoids",
  "monstrosities",
  "oozes",
  "plants",
  "undead",
] as const;
const rangerLanguageOptions = [
  "Common",
  "Abyssal",
  "Celestial",
  "Deep Speech",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Infernal",
  "Orc",
  "Primordial",
  "Sylvan",
  "Undercommon",
] as const;
const rangerTerrainOptions = [
  "arctic",
  "coast",
  "desert",
  "forest",
  "grassland",
  "mountain",
  "swamp",
  "underdark",
] as const;
const beastMasterPrimalFormNames = [
  "Beast of the Land",
  "Beast of the Sea",
  "Beast of the Sky",
] as const;

type LineageGroup = ResolvedLineageEntry & { icon: string };
type LineageCard = {
  id: string;
  name: string;
  icon: string;
  lineageId: string;
  subraceId?: string;
};

const subraceBonusTr: Partial<Record<string, string[]>> = {
  "hill-dwarf": ["Ability Score Increase: WIS +1", "Dwarven Toughness"],
  "mountain-dwarf": ["Ability Score Increase: STR +2", "Dwarven Armor Training"],
  duergar: ["Psionic temalı dayanıklılık", "Underdark kökenli özel özellikler"],
  "high-elf": ["Cantrip erişimi", "Ek dil", "Arcane eğilim"],
  "wood-elf": ["Daha yüksek hareket kabiliyeti", "Doğada gizlilik odağı"],
  drow: ["Superior Darkvision", "Drow Magic", "Sunlight Sensitivity"],
  "lightfoot-halfling": ["Doğal gizlilik avantajı", "Sosyal ve sinsi oynanış"],
  "stout-halfling": ["Poison dayanıklılığı", "Daha dayanıklı kısa halk yapısı"],
  "forest-gnome": ["Natural Illusionist", "Küçük beast'lerle bağ"],
  "rock-gnome": ["Artificer's Lore", "Tinkering"],
  "deep-gnome": ["Üstün gizlenme ve Underdark uyumu"],
};

function compactMeta(values: (string | undefined)[]) {
  return values.filter(Boolean).join(" | ");
}

function featureSummaryParagraphs(summary: string) {
  const cleaned = cleanImportedText(summary);
  if (!cleaned) {
    return [];
  }

  const sentenceParts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentenceParts.length <= 2) {
    return [cleaned];
  }

  const paragraphs: string[] = [];
  for (let index = 0; index < sentenceParts.length; index += 2) {
    paragraphs.push(sentenceParts.slice(index, index + 2).join(" "));
  }
  return paragraphs;
}

function skillLabel(skillId: string) {
  return skillId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function skillDescription(skillId: string, description?: string) {
  const cleaned = cleanImportedText(description ?? "");
  return cleaned || skillDescriptionFallbacks[skillId] || "";
}

function abilityShortLabel(abilityId: string) {
  return abilityLabels[abilityId as AbilityId] ?? abilityId;
}

function abilityAccentClass(abilityId: string) {
  const normalized = abilityId.toUpperCase();
  return ["STR", "DEX", "CON", "INT", "WIS", "CHA"].includes(normalized)
    ? `ability-accent ability-accent-${normalized.toLowerCase()}`
    : "ability-accent";
}

function formatEnglishList(values: string[]) {
  return values.length ? values.join(", ") : "None";
}

function classMatchesSpell(spell: ContentBundle["spells"][number], className: string) {
  const normalizedTarget = className.toLowerCase().trim();
  return (
    spell.classes?.some((entry) => {
      const normalizedEntry = entry.toLowerCase().trim();
      return (
        normalizedEntry === normalizedTarget ||
        normalizedEntry.replace(/\s*\([^)]*\)\s*/g, "").trim() === normalizedTarget
      );
    }) ?? false
  );
}

function normalizedDocCell(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function HoverTooltip({
  label,
  content,
  variant = "keyword",
  tooltipClassName = "spell-inline-tooltip",
}: {
  label: string;
  content: ReactNode;
  variant?: "icon" | "keyword";
  tooltipClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleEnter = () => {
    clearCloseTimeout();
    setOpen(true);
  };

  const handleLeave = () => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setOpen(false);
      closeTimeoutRef.current = null;
    }, 220);
  };

  useEffect(() => () => clearCloseTimeout(), []);

  return (
    <span
      className={`inline-help${variant === "keyword" ? " keyword-help" : ""}${open ? " open" : ""}`}
      aria-label={`${label} info`}
      tabIndex={0}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <span className={variant === "keyword" ? "keyword-help-trigger" : "inline-help-trigger"}>
        {variant === "keyword" ? label : "?"}
      </span>
      <div
        className={`inline-help-tooltip ${tooltipClassName}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {content}
      </div>
    </span>
  );
}

function cleanImportedText(value: string) {
  return value
    .replace(/â€™/g, "'")
    .replace(/â€”/g, "-")
    .replace(/â€“/g, "-")
    .replace(/â€œ|â€/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function uiSlug(value: string) {
  return cleanImportedText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function docTableLabel(table: ClassDocTable, index: number) {
  return (
    cleanImportedText(
      table.title ??
        table.headers.find(Boolean) ??
        table.rows.flat().find(Boolean) ??
        "",
    ) || `Companion Form ${index + 1}`
  );
}

function spellGrantsFromDocTables(tables: ClassDocTable[]) {
  return tables.flatMap((table) => {
    const headerText = table.headers.map((cell) => cell.toLowerCase()).join(" | ");
    const looksLikeSpellGrantTable =
      headerText.includes("level") && (headerText.includes("spell") || headerText.includes("spells"));

    if (!looksLikeSpellGrantTable) {
      return [];
    }

    return table.rows
      .map((row) => {
        const levelCell = row[0] ?? "";
        const spellCell = row[1] ?? "";
        const unlockLevel = numericSpellLevelLabel(levelCell);
        if (!unlockLevel || !spellCell) {
          return null;
        }

        return {
          unlockLevel,
          spells: spellCell
            .split(/,\s*/)
            .map((item) => cleanImportedText(item))
            .filter(Boolean),
        };
      })
      .filter((entry): entry is { unlockLevel: number; spells: string[] } => Boolean(entry));
  });
}

function uniqueSpellGrants(entries: Array<{ unlockLevel: number; spells: string[] }>) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.unlockLevel}:${entry.spells.join("|").toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueSpellGrantEntries<T extends { unlockLevel: number; name: string }>(entries: T[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.unlockLevel}:${entry.name.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function classIdFromSpellListName(value: string) {
  return value
    .replace(/\s*\(.*?\)\s*/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function subclassMatchSlug(value: string) {
  return uiSlug(
    cleanImportedText(value)
      .replace(/\b(conclave|archetype|college|domain|circle|oath|tradition|path)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

function isPreviewStatLabel(label: string) {
  return ["Ability Score Increase", "Size", "Speed", "Languages"].includes(label);
}

function isLineageDetailTraitName(name: string) {
  return ["Age", "Alignment"].includes(cleanImportedText(name));
}

function dedupeLineageTraits<T extends { id: string; name: string; summary: string }>(traits: T[]) {
  const seen = new Set<string>();
  return traits.filter((trait) => {
    const key = `${cleanImportedText(trait.name).toLowerCase()}::${cleanImportedText(trait.summary).toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function iconForLineageDetailTrait(name: string) {
  switch (cleanImportedText(name)) {
    case "Age":
      return "shield";
    case "Alignment":
      return "spark";
    default:
      return "species";
  }
}

function isDerivedPreviewBonus(value: string) {
  const cleaned = cleanImportedText(value);
  return (
    cleaned.startsWith("Ability Score Increase") ||
    cleaned.startsWith("Size") ||
    cleaned.startsWith("Speed") ||
    cleaned.startsWith("Languages")
  );
}

function iconForLineageStat(label: string) {
  switch (label) {
    case "Size":
      return "shield";
    case "Speed":
      return "skill";
    case "Languages":
      return "book";
    case "Ability Score Increase":
      return "spark";
    default:
      return "species";
  }
}

function compactLineageStatValue(label: string, value: string) {
  const cleaned = cleanImportedText(value);

  if (label === "Size") {
    const match = cleaned.match(/Your size is ([A-Za-z]+)/i);
    return match?.[1] ?? cleaned;
  }

  if (label === "Speed") {
    const match = cleaned.match(/(\d+)\s*feet/i);
    return match ? `${match[1]} ft.` : cleaned;
  }

  if (label === "Languages") {
    const match = cleaned.match(/Common(?: and [A-Za-z'-]+)+/i);
    return match?.[0] ?? cleaned;
  }

  if (label === "Ability Score Increase") {
    if (cleaned.includes("increase one score by 2") && cleaned.includes("different score by 1")) {
      return "+2 / +1 configurable";
    }

    const matches = [...cleaned.matchAll(/([A-Z][a-z]+) score increases by (\d+)/g)];
    if (matches.length) {
      return matches.map((entry) => `${entry[1].slice(0, 3).toUpperCase()} +${entry[2]}`).join(" / ");
    }
  }

  return cleaned;
}

function parseAbilityScoreIncrease(value: string) {
  const cleaned = cleanImportedText(value);
  const matches = [...cleaned.matchAll(/([A-Z][a-z]+) score increases by (\d+)/g)];

  return matches
    .map((entry) => {
      const short = entry[1].slice(0, 3).toUpperCase() as AbilityId;
      const amount = Number(entry[2]);
      return Number.isFinite(amount) ? { ability: short, amount } : null;
    })
    .filter((entry): entry is { ability: AbilityId; amount: number } => Boolean(entry));
}

function pointBuyCost(score: number) {
  if (score <= 13) {
    return score - 8;
  }

  return 5 + (score - 13) * 2;
}

function hasFlexibleAbilityScoreIncreaseText(values: string[]) {
  return values.some((value) => {
    const normalized = cleanImportedText(value).toLowerCase();
    return (
      normalized.includes("increase one score by 2 and increase a different score by 1") ||
      normalized.includes("increase one ability score by 2 and increase a different score by 1") ||
      normalized.includes("increase three different scores by 1") ||
      normalized.includes("choose one score to increase by 2 and a different score to increase by 1") ||
      (normalized.includes("increase one score by 2") && normalized.includes("different score by 1"))
    );
  });
}

function pointBuyStepCost(currentScore: number, nextScore: number) {
  return pointBuyCost(nextScore) - pointBuyCost(currentScore);
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function numericSpellLevelLabel(value: string) {
  const numeric = Number.parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function rangerFavoredEnemyChoiceCount(level: number) {
  if (level >= 14) {
    return 3;
  }
  if (level >= 6) {
    return 2;
  }
  return 1;
}

function rangerFavoredFoeDamage(level: number) {
  if (level >= 14) {
    return "1d8";
  }
  if (level >= 6) {
    return "1d6";
  }
  return "1d4";
}

function rangerEnemyLabel(value: string) {
  if (value === "humanoids") {
    return "Humanoids";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function rangerTerrainLabel(value: string) {
  if (value === "underdark") {
    return "Underdark";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function rangerFeatureTitle(section: ClassDocSection | undefined, fallback: string) {
  return section?.name ?? fallback;
}

function translateToTurkish(value: string) {
  return cleanImportedText(value)
    .replace(/Whether descended from /g, "")
    .replace(/or infused with /g, "ya da ")
    .replace(/are mortals who carry /g, "ölümlülerdir ve ")
    .replace(/within their souls\./g, "ruhlarında taşırlar.")
    .replace(/They can /g, "Bunlar ")
    .replace(/bring light/g, "ışık getirebilir")
    .replace(/ease wounds/g, "yaraları hafifletebilir")
    .replace(/unleash the fury of the heavens/g, "göğün öfkesini açığa çıkarabilir")
    .replace(/Long ago, /g, "Uzun zaman önce, ")
    .replace(/groups of elves ventured /g, "elf toplulukları yolculuk etti ")
    .replace(/to be closer to their gods/g, "tanrılarına daha yakın olmak için")
    .replace(/Life in /g, "")
    .replace(/has imbued their souls with /g, "ruhlarına ")
    .replace(/That light manifests as /g, "Bu ışık ")
    .replace(/A winged people/g, "Kanatlı bir halk")
    .replace(/who originated on /g, "kökenini ")
    .replace(/soar through the sky wherever they wander/g, "nereye giderlerse gitsinler gökyüzünde süzülür")
    .replace(/Autognomes are mechanical beings built by rock gnomes\./g, "Autognome'lar rock gnome'lar tarafından inşa edilmiş mekanik varlıklardır.")
    .replace(/Sometimes, because of a malfunction or a unique circumstance, /g, "Bazen bir arıza ya da sıra dışı bir durum nedeniyle ")
    .replace(/becomes separated from its creator and strikes out on its own/g, "yaratıcısından ayrılır ve kendi yolunu çizer")
    .replace(/Before becoming an adventurer, /g, "Maceracı olmadan önce, ")
    .replace(/you spent much of your adult life /g, "yetişkin hayatının büyük bölümünü ")
    .replace(/Prior to becoming an adventurer, /g, "Maceracı olmadan önce, ")
    .replace(/you spent most of your young life /g, "gençliğinin çoğunu ")
    .replace(/You are /g, "Sen ")
    .replace(/You have /g, "Senin ")
    .replace(/You were /g, "Sen ")
    .replace(/Your family name /g, "Aile adın ")
    .replace(/Every charlatan has /g, "Her charlatanın ")
    .replace(/Choose /g, "Seç ")
    .replace(/Two of your choice/g, "seçtiğin iki dil")
    .replace(/One of your choice/g, "seçtiğin bir dil")
    .replace(/None/g, "Yok");
}

function classDescription(item: ContentBundle["classes"][number]) {
  const translated = classDescriptionTr[item.id];
  if (translated) {
    return translated;
  }

  const firstLevelFeatures = item.featuresByLevel["1"] ?? [];
  const leadFeature = firstLevelFeatures[0]?.summary;
  const supportFeature = firstLevelFeatures[1]?.summary;
  const identity = `Primary abilities: ${item.primaryAbilities.map(abilityShortLabel).join(", ")}.`;

  return [leadFeature, supportFeature, identity].filter(Boolean).join(" ");
}

function classProficiencyLines(classRules: CreatorOptions["classOptions"][string] | undefined) {
  if (!classRules) {
    return [];
  }

  return [
    `Armor Proficiency: ${formatEnglishList(classRules.armor)}`,
    `Weapon Proficiency: ${formatEnglishList(classRules.weapons)}`,
    classRules.tools.length ? `Tool Proficiency: ${formatEnglishList(classRules.tools)}` : null,
  ].filter(Boolean) as string[];
}

function speciesDescription(item: ContentBundle["species"][number]) {
  const override = speciesDescriptionTr[item.id];
  if (override) {
    return override;
  }

  const leadSummary = item.traits.find((trait) => trait.summary.trim())?.summary;
  if (!leadSummary) {
    return `${item.name}, kendine özgü özellikler sunan bir Species seçimidir.`;
  }

  if (!cleanImportedText(leadSummary)) {
    return `${item.name}, kendine özgü özellikler sunan bir Species seçimidir.`;
  }

  return `${item.name}, kendine özgü kökeni ve özel trait'leri olan bir Species seçimidir.`;
}

function backgroundDescription(item: ContentBundle["backgrounds"][number]) {
  if (!item.summary.trim()) {
    return "";
  }

  return cleanImportedText(item.summary);
}

function backgroundMetaDescription(item: ContentBundle["backgrounds"][number]) {
  return [
    item.skillProficiencies ? `Skill Proficiencies: ${item.skillProficiencies}` : null,
    item.toolProficiencies && item.toolProficiencies !== "None"
      ? `Tool Proficiencies: ${item.toolProficiencies}`
      : null,
    item.languages && item.languages !== "None" ? `Languages: ${item.languages}` : null,
  ].filter(Boolean) as string[];
}

function spellMetaLines(spell: ContentBundle["spells"][number]) {
  return [
    `Casting Time: ${spell.castingTime}`,
    `Range: ${spell.range}`,
    `Duration: ${spell.duration}`,
    spell.source ? `Source: ${spell.source}` : null,
  ].filter(Boolean) as string[];
}

function damageChipFromText(text: string) {
  const typedDamage = text.match(/(\d+d\d+(?:\s*\+\s*\w+)?)\s+([A-Za-z]+)\s+damage/i);
  if (typedDamage) {
    return `${typedDamage[1]} ${typedDamage[2]}`;
  }

  const diceOnly = text.match(/\b(\d+d\d+(?:\s*\+\s*\w+)?)\b/i);
  return diceOnly ? diceOnly[1] : null;
}

function spellDamageChip(spell: ContentBundle["spells"][number]) {
  return damageChipFromText(`${spell.summary} ${spell.name}`);
}

const SPELL_DECISION_CHIP_RULES = [
  {
    id: "save",
    test: (text: string) => /saving throw/i.test(text),
    label: (text: string) => {
      const match = text.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i);
      return `Save ${match?.[1]?.slice(0, 3).toUpperCase() ?? ""}`.trim();
    },
  },
  {
    id: "offensive",
    test: (text: string) => /\b(melee|ranged) (spell )?attack\b|\bon a hit\b|takes .* damage/i.test(text),
    label: () => "Offensive",
  },
  {
    id: "defensive",
    test: (text: string) => /temporary hit points|resistance|shield|protective|bonus to ac|armor class/i.test(text),
    label: () => "Defensive",
  },
  {
    id: "crowd-control",
    test: (text: string) => /charmed|frightened|restrained|blinded|deafened|paralyzed|stunned|prone|can't take reactions|speed becomes 0/i.test(text),
    label: () => "Crowd Control",
  },
  {
    id: "utility",
    test: (text: string) => /detect|alarm|invisible|disguise|message|mage hand|identify|illusion|ward|teleport|unseen|object|ritual/i.test(text),
    label: () => "Utility",
  },
  {
    id: "healing",
    test: (text: string) =>
      !/can't regain hit points|cannot regain hit points|can.t regain hit points/i.test(text) &&
      /regain(?:s)?(?: a number of)? hit points|gain(?:s)?(?: a number of)? hit points|healing/i.test(text),
    label: () => "Healing",
  },
  {
    id: "heal-block",
    test: (text: string) => /can't regain hit points|cannot regain hit points|can.t regain hit points/i.test(text),
    label: () => "Heal Block",
  },
  {
    id: "reaction",
    test: (text: string) => /reaction/i.test(text),
    label: () => "Reaction",
  },
  {
    id: "concentration",
    test: (text: string) => /concentration/i.test(text),
    label: () => "Concentration",
  },
  {
    id: "sustained",
    test: (text: string) => /make the attack again|can make the attack again|again on each of your turns|as an action on each of your turns|on each of your turns/i.test(text),
    label: () => "Sustained",
  },
  {
    id: "summon",
    test: (text: string) => /\bsummon\b|\bconjure\b|\bsummons\b|\bconjures\b/i.test(text),
    label: () => "Summon",
  },
  {
    id: "area",
    test: (text: string) => /\bcone\b|\bradius\b|\bcube\b|\bline\b|\beach creature\b|\bcreatures within\b/i.test(text),
    label: () => "Area",
  },
] as const;

const SPELL_DECISION_SUMMARY_RULES = [
  {
    test: (title: string, text: string) => /temporary hit points/i.test(text) && /melee attack/i.test(text) && /cold damage/i.test(text),
    summary: "Defensive ward that grants temporary hit points and punishes melee attackers.",
  },
  {
    test: (_title: string, text: string) => /you hurl|shoot|make a ranged spell attack|melee spell attack/i.test(text) && Boolean(damageChipFromText(text)),
    summary: "Direct offensive spell that deals immediate damage when it lands.",
  },
  {
    test: (_title: string, text: string) => /must make a .* saving throw/i.test(text) && Boolean(damageChipFromText(text)),
    summary: "Forces a saving throw and deals damage on a failed save.",
  },
  {
    test: (_title: string, text: string) => /can't regain hit points|cannot regain hit points|can.t regain hit points/i.test(text),
    summary: "Pressure spell that deals damage and prevents the target from regaining hit points.",
  },
  {
    test: (_title: string, text: string) => /regain hit points/i.test(text) && /attack/i.test(text),
    summary: "Offensive spell that drains a target and restores some of your hit points.",
  },
  {
    test: (_title: string, text: string) => /make the attack again|again on each of your turns/i.test(text),
    summary: "Sustained attack spell that can keep pressuring the same target across turns.",
  },
  {
    test: (_title: string, text: string) => /alarm alerts you/i.test(text),
    summary: "Utility ward that alerts you when a creature enters or touches the protected area.",
  },
  {
    test: (title: string) => /detect/i.test(title) || /magic/i.test(title),
    summary: "Utility spell focused on awareness, detection, or magical information.",
  },
  {
    test: (_title: string, text: string) => /advantage|bonus|bless|shield|resistance|protective/i.test(text),
    summary: "Support or defense spell that improves survivability or reliability.",
  },
  {
    test: (_title: string, text: string) => /charmed|frightened|can.t take reactions|speed becomes 0|restrained/i.test(text),
    summary: "Control-focused spell that pressures enemy actions or positioning.",
  },
  {
    test: (_title: string, text: string) => /\bsummon\b|\bconjure\b|\bsummons\b|\bconjures\b/i.test(text),
    summary: "Creates an ongoing magical effect or object rather than a simple hit.",
  },
] as const;

function spellChipTone(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "cantrip" || normalized.startsWith("level ")) return "accent";
  if (["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"].includes(normalized)) return "neutral";
  if (normalized.includes("damage") || normalized.includes("offensive")) return "danger";
  if (normalized.startsWith("save")) return "accent";
  if (normalized.includes("defensive") || normalized.includes("healing")) return "support";
  if (normalized.includes("reaction") || normalized.includes("concentration")) return "accent";
  if (normalized.includes("heal block") || normalized.includes("crowd control") || normalized.includes("area")) return "utility";
  if (normalized.includes("summon") || normalized.includes("utility") || normalized.includes("sustained")) return "neutral";
  if (normalized.includes("reaction")) return "accent";
  return "neutral";
}

function spellChipIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized === "cantrip" || normalized.startsWith("level ")) return "spark";
  if (["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"].includes(normalized)) return "book";
  if (normalized.includes("damage") || normalized.includes("offensive")) return "dice";
  if (normalized.startsWith("save")) return "spark";
  if (normalized.includes("defensive") || normalized.includes("heal block")) return "shield";
  if (normalized.includes("healing")) return "spark";
  if (normalized.includes("reaction")) return "skill";
  if (normalized.includes("crowd control") || normalized.includes("utility") || normalized.includes("concentration") || normalized.includes("area")) return "book";
  if (normalized.includes("summon")) return "wand";
  if (normalized.includes("sustained")) return "spark";
  return "spark";
}

function spellDecisionChipLabels(summary: string, reference?: SpellReferenceEntry | null) {
  const normalizedSummary = cleanImportedText(
    [
      summary,
      ...(reference?.summary ?? []),
      ...(reference?.detailLines ?? []),
      reference?.atHigherLevels ?? "",
    ].join(" "),
  );
  return SPELL_DECISION_CHIP_RULES
    .filter((rule) =>
      rule.test(
        rule.id === "concentration"
          ? `${reference?.duration ?? ""} ${normalizedSummary}`
          : rule.id === "reaction"
            ? `${reference?.castingTime ?? ""} ${normalizedSummary}`
              : normalizedSummary,
      ),
    )
    .map((rule) =>
      rule.label(
        rule.id === "concentration"
          ? `${reference?.duration ?? ""} ${normalizedSummary}`
          : rule.id === "reaction"
            ? `${reference?.castingTime ?? ""} ${normalizedSummary}`
              : normalizedSummary,
      ),
    );
}

function spellListHintChips(
  spell: ContentBundle["spells"][number],
  reference?: SpellReferenceEntry | null,
) {
  const derived = spellDecisionChipLabels(spell.summary, reference);
  const schoolLabel = spell.school
    ? spell.school.charAt(0).toUpperCase() + spell.school.slice(1)
    : null;
  const hints = [...derived];

  if (reference?.castingTime?.toLowerCase().includes("reaction")) {
    if (!hints.includes("Reaction")) {
      hints.push("Reaction");
    }
  } else if (spell.castingTime?.toLowerCase().includes("reaction")) {
    if (!hints.includes("Reaction")) {
      hints.push("Reaction");
    }
  }

  if (reference?.duration?.toLowerCase().includes("concentration")) {
    if (!hints.includes("Concentration")) {
      hints.push("Concentration");
    }
  } else if (spell.duration?.toLowerCase().includes("concentration")) {
    if (!hints.includes("Concentration")) {
      hints.push("Concentration");
    }
  }

  if (schoolLabel && !hints.includes(schoolLabel)) {
    hints.push(schoolLabel);
  }

  if (!hints.length) {
    return [schoolLabel ?? "Spell"];
  }

  const saveChip = hints.find((item) => item.startsWith("Save "));
  const withoutSaveOrSchool = hints.filter(
    (item) => !item.startsWith("Save ") && (!schoolLabel || item !== schoolLabel),
  );

  if (schoolLabel) {
    const rebuilt = [...withoutSaveOrSchool];
    if (saveChip) {
      rebuilt.push(saveChip);
    }
    rebuilt.push(schoolLabel);
    return rebuilt;
  }

  if (saveChip) {
    return [...withoutSaveOrSchool, saveChip];
  }

  return hints;
}

function spellReferenceFor(
  spellReferenceCollection: SpellReferenceCollection,
  spell: Pick<ContentBundle["spells"][number], "id" | "name"> | null | undefined,
) {
  if (!spell) {
    return null;
  }

  return (
    spellReferenceCollection[spell.id] ??
    spellReferenceCollection[
      spell.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    ] ??
    null
  );
}

function spellSearchableText(
  spell: ContentBundle["spells"][number],
  reference: SpellReferenceEntry | null,
) {
  return [
    spell.name,
    spell.summary,
    spell.school,
    spell.castingTime,
    spell.range,
    spell.duration,
    ...spellMetaLines(spell),
    ...spellDecisionChipLabels(spell.summary, reference),
    ...(reference?.summary ?? []),
    ...(reference?.detailLines ?? []),
    ...((reference?.detailTables ?? []).flatMap((table) => [...table.headers, ...table.rows.flat()])),
    ...(reference?.atHigherLevels ? [reference.atHigherLevels] : []),
    ...(reference?.spellLists ?? []),
    reference?.subtitle,
    reference?.source,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function spellTooltipContent({
  classId,
  className,
  title,
  spellLevel,
  reference,
  summary,
  meta,
  lines = [],
  sourceLabel,
}: {
  classId: string;
  className: string;
  title: string;
  spellLevel?: number;
  reference: SpellReferenceEntry | null;
  summary: string;
  meta: string[];
  lines?: string[];
  sourceLabel?: string;
}) {
  const normalizedSummary = cleanImportedText(reference?.summary?.join(" ") || summary);
  const primaryCopy = reference?.summary?.length
    ? reference.summary
    : reference?.detailLines?.length
      ? reference.detailLines
      : [summary];
  const spellDecisionChips = spellDecisionChipLabels(normalizedSummary, reference);

  const spellDecisionSummary =
    SPELL_DECISION_SUMMARY_RULES.find((rule) => rule.test(title, normalizedSummary))?.summary ??
    "General-purpose spell with utility, control, or combat value depending on the situation.";

  return (
    <>
      <span className="spell-tooltip-head">
        <span className="spell-tooltip-class">
          <ClassPortrait classId={classId} alt={className} className="spell-tooltip-portrait" />
          <span>{className}</span>
        </span>
        <strong>{title}</strong>
      </span>
      {meta.length ? (
        <span className="spell-tooltip-meta">
          {meta.map((item) => (
            <span key={`${title}-meta-${item}`}>{item}</span>
          ))}
        </span>
      ) : null}
      <span className="spell-tooltip-block spell-tooltip-decision-card">
        <span className="spell-tooltip-block-title">Quick Read</span>
        <span className="spell-tooltip-copy">{spellDecisionSummary}</span>
        {spellDecisionChips.length ? (
          <span className="spell-tooltip-chip-grid">
            {spellDecisionChips.map((item) => (
              <span key={`${title}-decision-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
                <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
                {item}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <details className="spell-tooltip-details">
        <summary className="spell-tooltip-more">More details</summary>
        <span className="spell-tooltip-block spell-tooltip-decision-card">
          <span className="spell-tooltip-copy spell-tooltip-copy-structured">
            {primaryCopy.map((paragraph, index) => (
              <span key={`${title}-copy-${index}`} className="spell-tooltip-paragraph">
                {paragraph}
              </span>
            ))}
          </span>
        </span>
        {reference?.atHigherLevels ? (
          <span className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">At Higher Levels</span>
            <span className="spell-tooltip-copy">{reference.atHigherLevels}</span>
          </span>
        ) : null}
        {reference?.detailLines?.length ? (
          <span className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">Key Effects</span>
            <span className="spell-tooltip-line-list">
              {reference.detailLines.map((line) => (
                <span key={`${title}-detail-line-${line}`} className="spell-tooltip-line-item">
                  <span className="spell-tooltip-line-dot" aria-hidden="true" />
                  <span>{line}</span>
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {reference?.detailTables?.length ? (
          <span className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">Reference Table</span>
            <span className="spell-tooltip-table-stack">
              {reference.detailTables.map((table, tableIndex) => (
                <span key={`${title}-table-${tableIndex}`} className="spell-tooltip-table-wrap">
                  <span className="spell-tooltip-table">
                    <span className="spell-tooltip-table-row spell-tooltip-table-row-head">
                      {table.headers.map((header, headerIndex) => (
                        <span key={`${title}-table-${tableIndex}-head-${headerIndex}`} className="spell-tooltip-table-cell">
                          {header}
                        </span>
                      ))}
                    </span>
                    {table.rows.map((row, rowIndex) => (
                      <span key={`${title}-table-${tableIndex}-row-${rowIndex}`} className="spell-tooltip-table-row">
                        {row.map((cell, cellIndex) => (
                          <span key={`${title}-table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`} className="spell-tooltip-table-cell">
                            {cell}
                          </span>
                        ))}
                      </span>
                    ))}
                  </span>
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {reference?.spellLists?.length ? (
          <span className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">Spell Lists</span>
            <span className="spell-tooltip-meta spell-tooltip-class-list">
              {reference.spellLists.map((item) => (
                <span key={`${title}-list-${item}`} className="spell-tooltip-class-pill">
                  <ClassPortrait
                    classId={classIdFromSpellListName(item)}
                    alt={item}
                    className="spell-tooltip-class-pill-portrait"
                  />
                  <span>{item}</span>
                </span>
              ))}
            </span>
          </span>
        ) : null}
        {lines.length ? (
          <span className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">Details</span>
            <span className="spell-tooltip-meta spell-tooltip-meta-secondary">
              {lines.map((line) => (
                <span key={`${title}-line-${line}`}>{line}</span>
              ))}
            </span>
          </span>
        ) : null}
      </details>
    </>
  );
}

const defaultWarlockPactBoons = [
  {
    id: "pact-of-the-blade",
    name: "Pact of the Blade",
    summary:
      "Create or bond with a magical pact weapon. You are proficient with it while wielding it, and it counts as magical.",
  },
  {
    id: "pact-of-the-chain",
    name: "Pact of the Chain",
    summary:
      "Learn find familiar as a ritual and gain special familiar forms such as imp, pseudodragon, quasit, or sprite.",
  },
  {
    id: "pact-of-the-tome",
    name: "Pact of the Tome",
    summary:
      "Receive a Book of Shadows and learn three extra cantrips from any class list. They count as warlock spells for you.",
  },
  {
    id: "pact-of-the-talisman",
    name: "Pact of the Talisman",
    summary:
      "Gain a talisman that can add a d4 to failed ability checks a limited number of times per long rest.",
  },
];

function mysticArcanumUnlockLevel(spellLevel: 6 | 7 | 8 | 9) {
  switch (spellLevel) {
    case 6:
      return 11;
    case 7:
      return 13;
    case 8:
      return 15;
    case 9:
      return 17;
  }
}

function spellTableLabel(classId: string) {
  switch (classId) {
    case "wizard":
      return "Prepared / Slots";
    case "sorcerer":
    case "bard":
    case "warlock":
      return "Known / Slots";
    default:
      return "Class Table";
  }
}

function levelOrdinal(level: number) {
  if (level % 100 >= 11 && level % 100 <= 13) {
    return `${level}th`;
  }

  switch (level % 10) {
    case 1:
      return `${level}st`;
    case 2:
      return `${level}nd`;
    case 3:
      return `${level}rd`;
    default:
      return `${level}th`;
  }
}

function defaultBrowserForStep(step: CreatorStep): CreatorBrowser {
  switch (step) {
    case 0:
      return "identity";
    case 1:
      return "class";
    case 2:
      return "abilities";
    default:
      return null;
  }
}

function speciesBenefitSummary(
  item: ContentBundle["species"][number],
  notes?: string,
) {
  const override = speciesBenefitTr[item.id];
  if (override) {
    return override;
  }

  const cleanedNotes = notes ? cleanImportedText(notes) : "";
  if (cleanedNotes) {
    return cleanedNotes;
  }

  return `${item.name}, kendine özgü trait'leriyle build yönünü etkileyen bir Species seçimidir.`;
}

function speciesMetaDescription(
  currentSpeciesRules:
    | {
        languages: string[];
        toolChoices: string[];
        notes: string;
      }
    | undefined,
) {
  return compactMeta([
    currentSpeciesRules?.languages.length
      ? `Languages: ${currentSpeciesRules.languages.join(", ")}`
      : undefined,
    currentSpeciesRules?.toolChoices.length
      ? `Tool Proficiency: ${currentSpeciesRules.toolChoices.join(", ")}`
      : undefined,
  ]);
}

function lineageGroupIcon(lineageId: string) {
  switch (lineageId) {
    case "dwarf":
      return "shield";
    case "elf":
      return "spark";
    case "halfling":
      return "skill";
    case "gnome":
      return "book";
    default:
      return "species";
  }
}

function mapLineageEntries(collection: LineageCollection): LineageGroup[] {
  return collection.entries.map((entry) => ({
    ...entry,
    icon: lineageGroupIcon(entry.id),
  }));
}

function syntheticLineageGroupFromSpecies(species: ContentBundle["species"][number]): LineageGroup {
  const stats = species.traits
    .filter((trait) => isPreviewStatLabel(trait.name))
    .map((trait) => ({
      label: trait.name,
      value: cleanImportedText(trait.summary),
    }));

  const coreTraits = species.traits
    .filter((trait) => !isPreviewStatLabel(trait.name))
    .map((trait) => ({
      id: trait.id,
      name: trait.name,
      summary: cleanImportedText(trait.summary),
    }));
  const hasFlexibleAbilityScoreIncrease = [...stats.map((stat) => stat.value), ...coreTraits.map((trait) => trait.summary)]
    .some((value) => {
      const normalized = cleanImportedText(value).toLowerCase();
      return (
        normalized.includes("increase one score by 2 and increase a different score by 1") ||
        normalized.includes("increase one ability score by 2 and increase a different score by 1") ||
        normalized.includes("increase three different scores by 1") ||
        normalized.includes("choose one score to increase by 2 and a different score to increase by 1") ||
        (normalized.includes("increase one score by 2") && normalized.includes("different score by 1"))
      );
    });

  return {
    id: species.id,
    name: species.name,
    sourceUrl: "https://www.dndbeyond.com",
    sourceLabel: species.source || "Species",
    summary: species.traits.find((trait) => trait.name === "Overview")?.summary ?? speciesDescription(species),
    stats,
    coreBonuses: [],
    coreTraits,
    flexibleAbilityScoreIncrease: hasFlexibleAbilityScoreIncrease,
    subraces: [],
    notes: [],
    icon: lineageGroupIcon(species.id),
  };
}

function mergeLineageAndSpeciesEntries(
  lineages: LineageCollection,
  speciesEntries: ContentBundle["species"],
): LineageGroup[] {
  const mappedEntries = mapLineageEntries(lineages);
  const lineageIds = new Set(mappedEntries.map((entry) => entry.id));
  const subraceIds = new Set(mappedEntries.flatMap((entry) => entry.subraces.map((subrace) => subrace.id)));
  const speciesOnlyEntries = speciesEntries
    .filter((entry) => !lineageIds.has(entry.id) && !subraceIds.has(entry.id))
    .map((entry) => syntheticLineageGroupFromSpecies(entry));

  return [...mappedEntries, ...speciesOnlyEntries];
}

function lineageCardsFromGroups(lineages: LineageGroup[]): LineageCard[] {
  const cards: LineageCard[] = lineages.map((group) => ({
    id: group.id,
    name: group.name,
    icon: group.icon,
    lineageId: group.id,
  }));

  return cards
    .filter((card, index, collection) => collection.findIndex((entry) => entry.id === card.id) === index)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function lineageGroupForSpecies(lineages: LineageGroup[], speciesId: string) {
  return (
    lineages.find((group) => group.subraces.some((subrace) => subrace.id === speciesId)) ??
    lineages.find((group) => group.id === speciesId) ??
    null
  );
}

function subraceOptionsForGroup(group: LineageGroup | null) {
  return group?.subraces ?? [];
}

function subraceBonuses(subrace: SubraceEntry | null, notes?: string) {
  const override = subrace ? subraceBonusTr[subrace.id] : null;
  if (override?.length) {
    return override;
  }

  if (subrace?.bonuses?.length) {
    return subrace.bonuses;
  }

  if (notes) {
    return [cleanImportedText(notes)];
  }

  return ["Bu alt ırk için özet bonus verisi henüz düzenlenmedi."];
}

function subraceEmptyPrompt(lineageName: string) {
  return `${lineageName} için bu veri setinde ayrı bir subrace kaydı yok. Bu lineage doğrudan ana ırk özellikleriyle kullanılabilir.`;
}

function classProgressSummary(item: ContentBundle["classes"][number], level: number) {
  const abilityLine = item.primaryAbilities.length
    ? `Primary Abilities: ${item.primaryAbilities.map(abilityShortLabel).join(", ")}`
    : null;
  const subclassLine =
    level >= subclassUnlockLevel
      ? `Subclass seçimi aktif.`
      : `Subclass seçimi Level ${subclassUnlockLevel} olduğunda açılır.`;

  return compactMeta([abilityLine ?? undefined, subclassLine]);
}

function levelProgressDescription(level: number, maxSpellLevel: number) {
  const subclassLine =
    level >= subclassUnlockLevel
      ? "Subclass kararın artık build'in aktif bir parçası."
      : `Subclass seçimi için ${subclassUnlockLevel}. Level eşiğine henüz ulaşmadın.`;
  const spellLine =
    maxSpellLevel > 0
      ? `Şu an en yüksek Spell seviyesi ${maxSpellLevel}.`
      : "Bu build şu anda Spell erişimi açmıyor.";

  return `${subclassLine} ${spellLine}`;
}

function summaryCardClass(current: CreatorBrowser, target: CreatorBrowser, isStatic = false) {
  if (isStatic) {
    return "creator-summary-card static";
  }

  return current === target ? "creator-summary-card active" : "creator-summary-card";
}

function summaryIcon(target: CreatorBrowser) {
  switch (target) {
    case "identity":
      return "spark";
    case "abilities":
      return "spark";
    case "lineage":
      return "species";
    case "subrace":
      return "species";
    case "class":
      return "class";
    case "ranger-choices":
      return "spark";
    case "fighter-choices":
      return "spark";
    case "background":
      return "background";
    case "abilities":
      return "spark";
    case "level":
      return "level";
    case "multiclass":
      return "multiclass";
    case "subclass":
      return "spark";
    case "subclass-choices":
      return "spark";
    case "spells":
      return "book";
    case "skill-spells":
      return "book";
    case "feats":
      return "feat";
    case "skills":
      return "skill";
    default:
      return "shield";
  }
}

function stepDescription(step: CreatorStep) {
  switch (step) {
    case 0:
      return "Önce karakter fikrini kur, ardından Species ve Background ile başlangıç kimliğini netleştir.";
    case 1:
      return "Sonra Class yönünü seç, Level ilerlemesini belirle ve uygun olduğunda Subclass yolunu aç.";
    case 2:
      return "Son aşamada Ability Scores dağılımını ve temel combat değerlerini son haline getir.";
    default:
      return "";
  }
}

function browserTitle(browser: CreatorBrowser) {
  switch (browser) {
    case "identity":
      return "Identity";
    case "abilities":
      return "Identity";
    case "lineage":
      return "Race";
    case "subrace":
      return "Subrace";
    case "class":
      return "Classes";
    case "ranger-choices":
      return "Ranger Choices";
    case "fighter-choices":
      return "Fighter Choices";
    case "background":
      return "Backgrounds";
    case "abilities":
      return "Ability Scores";
    case "level":
      return "Level";
    case "multiclass":
      return "Multiclass";
    case "subclass":
      return "Subclass";
    case "subclass-choices":
      return "Subclass Choices";
    case "spells":
      return "Spells";
    case "skill-spells":
      return "Skill & Spells";
    case "feats":
      return "Feats";
    case "skills":
      return "Skills";
    default:
      return "Selection";
  }
}

function browserSubtitle(browser: CreatorBrowser) {
  switch (browser) {
    case "identity":
      return "Karakter adı ve başlangıç level ayarını burada yap.";
    case "abilities":
      return "Point buy ve level ayarını burada tamamla.";
    case "lineage":
      return "Choose the core race and review its shared traits here.";
    case "subrace":
      return "Choose the matching subrace path and review its specific bonuses here.";
    case "class":
      return "Ana savaş ritmini, kaynak kullanımını ve build omurgasını burada seçiyorsun.";
    case "ranger-choices":
      return "Ranger için seçimli class feature kararlarını burada yönet.";
    case "fighter-choices":
      return "Fighter için seçimli class feature kararlarını burada yönet.";
    case "background":
      return "Macera öncesi hayatını ve hangi alışkanlıklarla geldiğini tanımla.";
    case "abilities":
      return "Point buy ve ability dağıtımını burada tamamla.";
    case "level":
      return "İlerleme eşiğini ayarla; Spell seviyesi ve Subclass erişimi burada şekillenir.";
    case "multiclass":
      return "İstersen karakterine ikinci bir yön veya uzmanlık ekle.";
    case "subclass":
      return `Subclass yolu bu creator akışında Level ${subclassUnlockLevel} itibarıyla açılır.`;
    case "subclass-choices":
      return "Seçimli subclass feature kararlarını bu panelden yönet.";
    case "spells":
      return "Bu aşamada erişebildiğin Spell seçeneklerini buradan yönet.";
    case "skill-spells":
      return "Skill seçimlerini ve erişebildiğin Spell havuzunu aynı yerde yönet.";
    case "feats":
      return "Karakterini özelleştiren güçlü seçimleri buradan yap.";
    case "skills":
      return "Uzmanlaşacağın alanları seçerek karakter hissini tamamla.";
    default:
      return "Soldaki seçimlerden birini aç ve bu panelde ayrıntıları incele.";
  }
}

function RangerDocBlocksView({ blocks }: { blocks: ClassDocBlock[] }) {
  return (
    <div className="class-feature-detail-body ranger-doc-blocks">
      {blocks.map((block, blockIndex) => (
        <div key={`ranger-doc-block-${blockIndex}`} className="ranger-doc-block">
          {block.heading ? <strong className="ranger-doc-block-heading">{block.heading}</strong> : null}
          {block.paragraphs.map((paragraph, paragraphIndex) => (
            <p key={`ranger-doc-block-${blockIndex}-paragraph-${paragraphIndex}`}>{paragraph}</p>
          ))}
        </div>
      ))}
    </div>
  );
}

function RangerDocTablesView({ tables }: { tables: ClassDocTable[] }) {
  if (!tables.length) {
    return null;
  }

  return (
    <div className="ranger-doc-table-stack">
      {tables.map((table, tableIndex) => (
        <div key={`ranger-doc-table-${tableIndex}`} className="class-table-card creator-subpanel-flat">
          {table.title ? (
            <div className="identity-detail-head compact">
              <span className="mini-heading creator-section-label">{table.title}</span>
              {table.headers.length ? (
                <span>{table.headers.filter(Boolean).join(" - ")}</span>
              ) : null}
            </div>
          ) : null}
          <div className="class-progression-scroll">
            <table className="class-progression-table">
              <thead>
                {table.groupedHeaders?.length ? (
                  <tr>
                    {table.groupedHeaders.map((header, headerIndex) => {
                      const nonEmptyHeaders = table.groupedHeaders?.filter(Boolean).length ?? 0;
                      const filledBefore = table.groupedHeaders?.slice(0, headerIndex).filter(Boolean).length ?? 0;
                      const filledIncludingCurrent = table.groupedHeaders?.slice(0, headerIndex + 1).filter(Boolean).length ?? 0;
                      const startIndex = headerIndex === 0 ? 0 : Math.floor((filledBefore / nonEmptyHeaders) * table.headers.length);
                      const endIndex = Math.floor((filledIncludingCurrent / nonEmptyHeaders) * table.headers.length);
                      const colSpan = Math.max(1, endIndex - startIndex);

                      return (
                        <th key={`ranger-doc-table-group-${tableIndex}-${headerIndex}`} colSpan={colSpan}>
                          {header}
                        </th>
                      );
                    })}
                  </tr>
                ) : null}
                {table.headers.length ? (
                  <tr>
                    {table.headers.map((header, headerIndex) => (
                      <th key={`ranger-doc-table-${tableIndex}-header-${headerIndex}`}>{header}</th>
                    ))}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={`ranger-doc-table-${tableIndex}-row-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`ranger-doc-table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CreatorWorkspace({
  draft,
  content,
  creatorStep,
  moveCreatorStep,
  currentClass,
  currentSpecies,
  currentSpeciesRules,
  currentBackground,
  lineageCollection,
  classCuratedCollection,
  warlockOptions,
  classDocs,
  spellReferenceCollection,
  currentClassRules,
  classOptions,
  multiclassChoices,
  availableSubclassOptions,
  availableSpells,
  availableFeats,
  maxSpellLevel,
  spellSelectionRules,
  eldritchKnightFlexibleSchoolAllowance,
  backgroundSkillIds,
  updateDraft,
  updateAbility,
  toggleMulticlass,
  toggleSubclassOption,
  toggleSelection,
  toggleSkillSelection,
  toggleInvocationSelection,
  setPactBoon,
  togglePactCantripSelection,
  setMysticArcanumSpell,
  setRangerFavoredEnemyMode,
  updateRangerFavoredEnemyChoice,
  setRangerFavoredTerrainMode,
  updateRangerFavoredTerrain,
  setRangerCannySkill,
  updateRangerDeftLanguage,
  setRangerFightingStyle,
  setFighterFightingStyle,
  setRangerAwarenessMode,
  setRangerHideMode,
}: {
  draft: CharacterDraft;
  content: ContentBundle;
  creatorStep: CreatorStep;
  moveCreatorStep: (step: CreatorStep) => void;
  currentClass: ContentBundle["classes"][number];
  currentSpecies: ContentBundle["species"][number];
  currentSpeciesRules:
    | {
        languages: string[];
        toolChoices: string[];
        notes: string;
      }
    | undefined;
  currentBackground: ContentBundle["backgrounds"][number];
  lineageCollection: LineageCollection;
  classCuratedCollection: ClassCuratedCollection;
  warlockOptions: WarlockOptionCollection;
  classDocs: ClassDocCollection;
  spellReferenceCollection: SpellReferenceCollection;
  currentClassRules:
    | {
        armor: string[];
        weapons: string[];
        tools: string[];
        languages: string[];
        skillChoices: string[];
        recommendedSkills: string[];
        skillChoiceCount: number;
      }
    | undefined;
  classOptions: CreatorOptions["classOptions"];
  multiclassChoices: ContentBundle["classes"];
  availableSubclassOptions: string[];
  availableSpells: ContentBundle["spells"];
  availableFeats: ContentBundle["feats"];
  maxSpellLevel: number;
  spellSelectionRules: {
    maxSpellLevel: number;
    cantripLimit: number;
    totalKnownLimit: number;
    perLevelLimits: Record<number, number>;
  };
  eldritchKnightFlexibleSchoolAllowance: number;
  backgroundSkillIds: string[];
  updateDraft: (updater: (current: CharacterDraft) => CharacterDraft) => void;
  updateAbility: (abilityId: AbilityId, score: number) => void;
  toggleMulticlass: (value: string) => void;
  toggleSubclassOption: (value: string) => void;
  toggleSelection: (key: "spellIds" | "featIds", value: string) => void;
  toggleSkillSelection: (value: string) => void;
  toggleInvocationSelection: (value: string) => void;
  setPactBoon: (value: string) => void;
  togglePactCantripSelection: (value: string) => void;
  setMysticArcanumSpell: (spellLevel: 6 | 7 | 8 | 9, spellId: string) => void;
  setRangerFavoredEnemyMode: (mode: "enemy" | "foe") => void;
  updateRangerFavoredEnemyChoice: (
    index: number,
    field: "enemyType" | "language" | "humanoidRaces",
    value: string,
  ) => void;
  setRangerFavoredTerrainMode: (mode: "terrain" | "deft") => void;
  updateRangerFavoredTerrain: (index: number, value: string) => void;
  setRangerCannySkill: (skillId: string) => void;
  updateRangerDeftLanguage: (index: number, value: string) => void;
  setRangerFightingStyle: (styleId: string) => void;
  setFighterFightingStyle: (styleId: string) => void;
  setRangerAwarenessMode: (mode: "primeval" | "primal") => void;
  setRangerHideMode: (mode: "plain-sight" | "natures-veil") => void;
}) {
  const rangerDocs = classDocs.ranger ?? null;
  const lineageGroups = mergeLineageAndSpeciesEntries(lineageCollection, content.species);
  const lineageCards = lineageCardsFromGroups(lineageGroups);
  const curatedClassMap = new Map(classCuratedCollection.entries.map((entry) => [entry.id, entry]));
  const [creatorBrowser, setCreatorBrowser] = useState<CreatorBrowser>("lineage");
  const initialLineageGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
  const initialSubrace = initialLineageGroup?.subraces.find((subrace) => subrace.id === draft.speciesId) ?? initialLineageGroup?.subraces[0] ?? null;
  const [selectedLineageId, setSelectedLineageId] = useState(initialLineageGroup?.id ?? "");
  const [selectedSubraceId, setSelectedSubraceId] = useState(initialSubrace?.id ?? "");
  const [lineagePage, setLineagePage] = useState(0);
  const [backgroundPage, setBackgroundPage] = useState(0);
  const [classTableExpanded, setClassTableExpanded] = useState(false);
  const [selectedClassFeatureId, setSelectedClassFeatureId] = useState<string | null>(null);
  const [selectedSubclassFeatureId, setSelectedSubclassFeatureId] = useState<string | null>(null);
  const [inventoryDraft, setInventoryDraft] = useState("");
  const [showUnavailableOptions, setShowUnavailableOptions] = useState(false);
  const [openWarlockGroup, setOpenWarlockGroup] = useState<"spells" | "pact" | "invocations">("spells");
  const [activeSpellFilter, setActiveSpellFilter] = useState<number | "all">("all");
  const [spellListPage, setSpellListPage] = useState(0);
  const [spellSearchQuery, setSpellSearchQuery] = useState("");
  const [invocationPage, setInvocationPage] = useState(0);
  const [pactCantripPage, setPactCantripPage] = useState(0);
  const subclassUnlocked = draft.level >= subclassUnlockLevel;
  const speciesMeta = speciesMetaDescription(currentSpeciesRules);
  const currentLineageGroup =
    lineageGroups.find((group) => group.id === selectedLineageId) ??
    lineageGroupForSpecies(lineageGroups, draft.speciesId) ??
    lineageGroups[0];
  const availableSubraces = subraceOptionsForGroup(currentLineageGroup);
  const currentSubraceEntry =
    availableSubraces.find((subrace) => subrace.id === selectedSubraceId) ??
    availableSubraces[0] ??
    null;
  const lineageAbilityScoreIncreases = currentLineageGroup.stats.filter(
    (stat) => stat.label === "Ability Score Increase",
  ).slice(0, 1);
  const lineagePreviewStats = currentLineageGroup.stats.filter(
    (stat) => stat.label === "Size" || stat.label === "Speed" || stat.label === "Languages",
  );
  const lineageDetailTraits = dedupeLineageTraits(
    currentLineageGroup.coreTraits.filter((trait) => isLineageDetailTraitName(trait.name)),
  );
  const lineageFeatureTraits = dedupeLineageTraits(
    currentLineageGroup.coreTraits.filter((trait) => !isLineageDetailTraitName(trait.name)),
  );
  const subraceAbilityScoreIncreases = (currentSubraceEntry?.stats ?? []).filter(
    (stat) => stat.label === "Ability Score Increase",
  );
  const subracePreviewStats = (currentSubraceEntry?.stats ?? []).filter(
    (stat) => stat.label === "Size" || stat.label === "Speed" || stat.label === "Languages",
  );
  const subraceDetailTraits = dedupeLineageTraits(
    (currentSubraceEntry?.traits ?? []).filter((trait) => isLineageDetailTraitName(trait.name)),
  );
  const subraceFeatureTraits = dedupeLineageTraits(
    (currentSubraceEntry?.traits ?? []).filter((trait) => !isLineageDetailTraitName(trait.name)),
  );
  const subraceNonStatBonuses = currentSubraceEntry
    ? subraceBonuses(currentSubraceEntry, currentSpeciesRules?.notes).filter(
        (bonus) => !isDerivedPreviewBonus(bonus),
      )
    : [];
  const subraceHasFlexibleAbilityIncrease =
    Boolean(currentSubraceEntry?.flexibleAbilityScoreIncrease) ||
    hasFlexibleAbilityScoreIncreaseText((currentSubraceEntry?.stats ?? []).map((stat) => stat.value)) ||
    hasFlexibleAbilityScoreIncreaseText((currentSubraceEntry?.traits ?? []).map((trait) => trait.summary));
  const lineageHasFlexibleAbilityIncrease =
    Boolean(currentLineageGroup.flexibleAbilityScoreIncrease) ||
    hasFlexibleAbilityScoreIncreaseText(currentLineageGroup.stats.map((stat) => stat.value)) ||
    hasFlexibleAbilityScoreIncreaseText(currentLineageGroup.coreTraits.map((trait) => trait.summary));
  const flexibleAbilityBonusSource = subraceHasFlexibleAbilityIncrease
    ? currentSubraceEntry?.name ?? null
    : lineageHasFlexibleAbilityIncrease
      ? currentLineageGroup.name
      : null;
  const previewAbilityBonuses = [
    ...(lineageHasFlexibleAbilityIncrease
      ? []
      : lineageAbilityScoreIncreases.flatMap((stat) => parseAbilityScoreIncrease(stat.value))),
    ...(subraceHasFlexibleAbilityIncrease
      ? []
      : subraceAbilityScoreIncreases.flatMap((stat) => parseAbilityScoreIncrease(stat.value))),
  ];
  const flexiblePreviewBonuses = flexibleAbilityBonusSource
    ? [
        draft.flexibleAbilityBonuses.plusTwo
          ? { ability: draft.flexibleAbilityBonuses.plusTwo, amount: 2 }
          : null,
        draft.flexibleAbilityBonuses.plusOne
          ? { ability: draft.flexibleAbilityBonuses.plusOne, amount: 1 }
          : null,
      ].filter((entry): entry is { ability: AbilityId; amount: number } => Boolean(entry))
    : [];
  const previewAbilities = draft.abilities.map((ability) => {
    const racialBonus = previewAbilityBonuses
      .filter((entry) => entry.ability === ability.id)
      .reduce((total, entry) => total + entry.amount, 0);
    const flexibleBonus = flexiblePreviewBonuses
      .filter((entry) => entry.ability === ability.id)
      .reduce((total, entry) => total + entry.amount, 0);
    const bonus = racialBonus + flexibleBonus;
    const previewScore = ability.score + bonus;

    return {
      ...ability,
      previewScore,
      previewModifier: abilityModifier(previewScore),
      racialBonus,
      flexibleBonus,
    };
  });
  const pointBuySpent = draft.abilities.reduce((total, ability) => total + pointBuyCost(ability.score), 0);
  const pointBuyRemaining = 27 - pointBuySpent;
  const lineagePageSize = 15;
  const lineagePageCount = Math.max(1, Math.ceil(lineageCards.length / lineagePageSize));
  const backgroundPageSize = 16;
  const backgroundPageCount = Math.max(1, Math.ceil(content.backgrounds.length / backgroundPageSize));
  const selectedBackground =
    content.backgrounds.find((item) => item.id === draft.backgroundId) ??
    currentBackground ??
    content.backgrounds[0];
  const currentCuratedClass = curatedClassMap.get(draft.classId) ?? null;
  const currentDocClass = classDocs[draft.classId] ?? null;
  const currentCuratedSubclasses = currentCuratedClass?.subclasses ?? [];
  const currentDocSubclassMap = new Map(
    (currentDocClass?.subclasses ?? []).flatMap((entry) => [
      [entry.id, entry] as const,
      [uiSlug(entry.name), entry] as const,
      [subclassMatchSlug(entry.name), entry] as const,
    ]),
  );
  const docFallbackSubclasses = (currentDocClass?.subclasses ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    source: entry.source || "Class Docs",
    sourceUrl: undefined,
    summary: entry.summary,
    features: entry.sections.map((section) => ({
      id: `${entry.id}-${section.id}`,
      name: section.name,
      summary: section.blocks.flatMap((block) => block.paragraphs).join(" ") || section.summary,
    })),
    expandedSpells: entry.grantedSpells.map((grant) => ({
      unlockLevel: grant.unlockLevel,
      spells: grant.spells,
    })),
    notes: [],
  }));
  const visibleSubclassHeading =
    currentCuratedClass?.subclassHeading ??
    currentDocClass?.baseSectionEntries[`${currentClass.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-conclave`]?.name ??
    (currentClass.id === "ranger" ? "Ranger Conclave" : "Subclass");
  const visibleSubclasses = currentCuratedSubclasses.length
    ? currentCuratedSubclasses.map((entry) => {
        const matchingDocSubclass =
          currentDocSubclassMap.get(entry.id) ??
          currentDocSubclassMap.get(uiSlug(entry.name)) ??
          currentDocSubclassMap.get(subclassMatchSlug(entry.name));
        return {
          ...entry,
          summary: entry.summary || matchingDocSubclass?.summary || "",
          expandedSpells:
            entry.expandedSpells?.length
              ? entry.expandedSpells
              : (matchingDocSubclass?.grantedSpells ?? []).map((grant) => ({
                  unlockLevel: grant.unlockLevel,
                  spells: grant.spells,
                })),
        };
      })
    : docFallbackSubclasses;
  const currentVisibleSubclass =
    visibleSubclasses.find((entry) => draft.selectedSubclassOptions.includes(entry.id)) ??
    visibleSubclasses[0] ??
    null;
  const matchingDocSubclasses = (currentDocClass?.subclasses ?? []).filter((entry) => {
    const entrySlugs = [entry.id, uiSlug(entry.name), subclassMatchSlug(entry.name)];
    const selectedSlugs = [
      ...(draft.selectedSubclassOptions ?? []),
      ...((draft.selectedSubclassOptions ?? []).map((value) => uiSlug(value))),
      ...((draft.selectedSubclassOptions ?? []).map((value) => subclassMatchSlug(value))),
      ...(currentVisibleSubclass
        ? [currentVisibleSubclass.id, uiSlug(currentVisibleSubclass.name), subclassMatchSlug(currentVisibleSubclass.name)]
        : []),
    ];

    return entrySlugs.some((slug) => selectedSlugs.includes(slug));
  });
  const currentDocSubclass =
    (currentVisibleSubclass
      ? currentDocSubclassMap.get(currentVisibleSubclass.id) ??
        currentDocSubclassMap.get(uiSlug(currentVisibleSubclass.name)) ??
        currentDocSubclassMap.get(subclassMatchSlug(currentVisibleSubclass.name))
      : null) ??
    matchingDocSubclasses[0] ??
    (currentDocClass?.subclasses ?? []).find((entry) => draft.selectedSubclassOptions.includes(entry.id)) ??
    currentDocClass?.subclasses?.[0] ??
    null;
  const isVisibleEldritchKnight =
    currentClass.id === "fighter" &&
    (draft.selectedSubclassOptions.includes("eldritch-knight") ||
      currentVisibleSubclass?.id === "eldritch-knight" ||
      currentDocSubclass?.id === "eldritch-knight");
  const beastMasterChoiceSections = currentDocSubclass?.id === "beast-master-conclave"
    ? {
        companion: currentDocSubclass.sections.find((section) => section.id === "ranger-s-companion") ?? null,
        primal: currentDocSubclass.sections.find((section) => section.id === "primal-companion-optional") ?? null,
      }
    : null;
  const primalCompanionTables = (beastMasterChoiceSections?.primal?.tables ?? []).slice(0, beastMasterPrimalFormNames.length);
  const primalCompanionOptions = primalCompanionTables.map((table, index) => {
    const label = beastMasterPrimalFormNames[index] ?? docTableLabel(table, index) ?? "Companion Form";
    return {
      id: `${uiSlug(label || "companion-form")}-${index}`,
      label,
      table,
    };
  });
  const selectedPrimalCompanionFormId = draft.rangerChoices?.primalCompanionFormId ?? "beast-of-the-land";
  const selectedPrimalCompanionTable =
    primalCompanionOptions.find((option) => option.id === selectedPrimalCompanionFormId || option.id.startsWith(`${selectedPrimalCompanionFormId}-`))?.table ??
    primalCompanionOptions[0]?.table ??
    null;
  const warlockPactBoonOptions =
    currentClass.id === "warlock"
      ? (warlockOptions.pactBoon?.options.length ? warlockOptions.pactBoon.options : defaultWarlockPactBoons)
      : [];
  const rangerDirectSubclassGrants =
    currentClass.id === "ranger"
      ? uniqueSpellGrants([
          ...(currentDocSubclass?.grantedSpells ?? []),
          ...spellGrantsFromDocTables(currentDocSubclass?.sections.flatMap((section) => section.tables) ?? []),
        ])
      : [];
  const subclassSpellGrantSource =
    currentClass.id === "ranger"
      ? uniqueSpellGrants([
          ...rangerDirectSubclassGrants,
          ...(currentVisibleSubclass?.expandedSpells ?? []),
          ...matchingDocSubclasses.flatMap((entry) => entry.grantedSpells ?? []),
          ...spellGrantsFromDocTables(matchingDocSubclasses.flatMap((entry) => entry.sections.flatMap((section) => section.tables))),
        ])
      : currentClass.id === "warlock"
        ? (currentVisibleSubclass?.expandedSpells ?? [])
        : [];
  const subclassSpellGrants =
    (currentClass.id === "warlock" || currentClass.id === "ranger")
      ? subclassSpellGrantSource.filter((entry) => draft.level >= entry.unlockLevel)
      : [];
  const subclassSpellEntries = subclassSpellGrants.flatMap((entry) =>
    entry.spells.map((spellName) => ({
      unlockLevel: entry.unlockLevel,
      name: spellName,
      spell:
        content.spells.find((spell) => spell.name.toLowerCase() === spellName.toLowerCase()) ?? null,
    })),
  );
  const rangerSubclassMagicSection =
    currentClass.id === "ranger"
      ? currentDocSubclass?.sections.find((section) => /\bmagic\b/i.test(section.name) && section.tables.length) ?? null
      : null;
  const rangerSubclassMagicEntries =
    currentClass.id === "ranger"
      ? uniqueSpellGrantEntries([
          ...subclassSpellEntries,
          ...(rangerSubclassMagicSection
            ? spellGrantsFromDocTables(rangerSubclassMagicSection.tables)
                .filter((entry) => draft.level >= entry.unlockLevel)
                .flatMap((entry) =>
                  entry.spells.map((spellName) => ({
                    unlockLevel: entry.unlockLevel,
                    name: spellName,
                    spell:
                      content.spells.find((spell) => spell.name.toLowerCase() === spellName.toLowerCase()) ?? null,
                  })),
                )
            : []),
        ])
      : [];
  const subclassAutoSpellLabel =
    currentClass.id === "warlock"
      ? `${currentVisibleSubclass?.name ?? "Subclass"} Patron Spells`
      : `${currentVisibleSubclass?.name ?? "Subclass"} Bonus Spells`;
  const subclassAutoSpellSourceLabel =
    currentClass.id === "warlock" ? "Auto added from Pact Magic" : "Auto added from subclass magic";
  const rangerPrimalAwarenessLabel = "Primal Awareness Spells";
  const rangerPrimalAwarenessSourceLabel = "Auto added from Primal Awareness";
  const subclassIntroLevel =
    currentCuratedClass?.spellcastingTable.rows.find((row) => row.some((cell) => cell.includes(currentCuratedClass.subclassHeading)))?.[0] ??
    null;
  const selectedClassFeature =
    currentCuratedClass?.classFeatures.find((feature) => feature.id === selectedClassFeatureId) ??
    currentCuratedClass?.classFeatures[0] ??
    null;
  const selectedClassDocSection =
    (selectedClassFeature
      ? Object.values(currentDocClass?.baseSectionEntries ?? {}).find((section) => {
          const sectionSlug = uiSlug(section.name);
          const featureSlug = uiSlug(selectedClassFeature.name);
          const normalizedSectionSlug = subclassMatchSlug(section.name);
          const normalizedFeatureSlug = subclassMatchSlug(selectedClassFeature.name);

          return (
            sectionSlug === featureSlug ||
            normalizedSectionSlug === normalizedFeatureSlug ||
            section.name === selectedClassFeature.name
          );
        }) ?? null
      : null);
  const selectedSubclassFeature =
    currentVisibleSubclass?.features.find((feature) => feature.id === selectedSubclassFeatureId) ??
    currentVisibleSubclass?.features[0] ??
    null;
  const selectedSubclassDocSection =
    (selectedSubclassFeature
      ? currentDocSubclass?.sections.find(
          (section) =>
            `${currentDocSubclass.id}-${section.id}` === selectedSubclassFeature.id ||
            section.name === selectedSubclassFeature.name,
        ) ?? null
      : null);
  const classTableRows = currentCuratedClass?.spellcastingTable.rows ?? [];
  const classTableHeaderRow = classTableRows[1] ?? [];
  const classTableSpellLevelStartIndex = classTableHeaderRow.findIndex((cell) => /^\d+(st|nd|rd|th)$/i.test(cell));
  const classTableHasGroupedHeader = classTableRows.length > 1 && classTableRows[0].length < classTableHeaderRow.length;
  const classTableTopHeaderRow = classTableHasGroupedHeader ? classTableRows[0] ?? [] : [];
  const classTableBodyRows = classTableHasGroupedHeader ? classTableRows.slice(2) : classTableRows.slice(1);
  const currentLevelSpellcastingRow =
    classTableRows.find((row) => row[0] === levelOrdinal(draft.level)) ?? null;
  const readCurrentSpellTableCell = (header: string) => {
    const index = classTableHeaderRow.findIndex((cell) => cell === header);
    return index >= 0 ? currentLevelSpellcastingRow?.[index] ?? "" : "";
  };
  const currentWarlockSpellsKnown = readCurrentSpellTableCell("Spells Known");
  const currentWarlockSpellSlots = readCurrentSpellTableCell("Spell Slots");
  const currentWarlockSlotLevel = readCurrentSpellTableCell("Slot Level");
  const currentWarlockSlotLevelNumber = numericSpellLevelLabel(currentWarlockSlotLevel);
  const warlockInvocationLimit =
    currentCuratedClass?.id === "warlock"
      ? Number.parseInt(
          currentLevelSpellcastingRow?.[
            classTableHeaderRow.findIndex((header) => header === "Invocations Known")
          ] ?? "0",
          10,
        ) || 0
      : 0;
  const spellAccessRows =
    currentLevelSpellcastingRow && classTableHeaderRow.length
      ? classTableHeaderRow
          .map((header, index) => ({ header, value: currentLevelSpellcastingRow[index] ?? "" }))
          .filter(
            (entry) =>
              entry.header === "Cantrips Known" ||
              /^[1-9](st|nd|rd|th)$/.test(entry.header),
          )
      : [];
  const spellAvailabilityByLevel = [...new Set(availableSpells.map((spell) => spell.level))]
    .sort((left, right) => left - right)
    .map((level) => {
      const pool = availableSpells.filter((spell) => spell.level === level);
      const selectedCount = pool.filter((spell) => draft.spellIds.includes(spell.id)).length;
      const slotInfo = currentClass.id === "warlock"
        ? (level === 0
            ? readCurrentSpellTableCell("Cantrips Known")
            : [currentWarlockSpellsKnown && `Known ${currentWarlockSpellsKnown}`, currentWarlockSpellSlots && `${currentWarlockSpellSlots} slots`, currentWarlockSlotLevel].filter(Boolean).join(" • "))
        : (
          spellAccessRows.find((entry) => entry.header === `${level}st`)?.value ??
          spellAccessRows.find((entry) => entry.header === `${level}nd`)?.value ??
          spellAccessRows.find((entry) => entry.header === `${level}rd`)?.value ??
          spellAccessRows.find((entry) => entry.header === `${level}th`)?.value ??
          (level === 0 ? spellAccessRows.find((entry) => entry.header === "Cantrips Known")?.value : "")
        );

      return {
        level,
        availableCount: pool.length,
        selectedCount,
        slotInfo: slotInfo || "-",
      };
    });
  const warlockCantripPool = availableSpells.filter((spell) => spell.level === 0);
  const warlockLeveledPool = availableSpells.filter((spell) => spell.level > 0);
  const warlockSelectedCantrips = warlockCantripPool.filter((spell) => draft.spellIds.includes(spell.id)).length;
  const warlockSelectedLeveledSpells = warlockLeveledPool.filter((spell) => draft.spellIds.includes(spell.id)).length;
  const spellCandidatePool = useMemo(() => {
    const classPool = [
      currentClass.name,
      ...draft.multiclassIds
        .map((classId) => content.classes.find((item) => item.id === classId)?.name)
        .filter((value): value is string => Boolean(value)),
    ];

    return content.spells.filter((spell) => {
      const byClass = classPool.some((className) => classMatchesSpell(spell, className));
      const byEldritchKnight =
        isVisibleEldritchKnight && classMatchesSpell(spell, "Wizard");
      const bySubclass = (spell.subclassOptions ?? []).some((option) =>
        draft.selectedSubclassOptions.includes(option),
      );

      return byClass || bySubclass || byEldritchKnight;
    });
  }, [content.classes, content.spells, currentClass.name, draft.multiclassIds, draft.selectedSubclassOptions, isVisibleEldritchKnight]);
  const pactTomeCantripPool = content.spells.filter((spell) => spell.level === 0);
  const mysticArcanumOptions = ([6, 7, 8, 9] as const)
    .filter((spellLevel) => draft.level >= mysticArcanumUnlockLevel(spellLevel))
    .map((spellLevel) => ({
      spellLevel,
      unlockLevel: mysticArcanumUnlockLevel(spellLevel),
      selectedSpellId: draft.mysticArcanumSelections?.[spellLevel] ?? null,
      spells: spellCandidatePool.filter((spell) => spell.level === spellLevel),
    }));
  const visibleSpellCards = spellCandidatePool.filter((spell) =>
    showUnavailableOptions || availableSpells.some((availableSpell) => availableSpell.id === spell.id),
  );
  const normalizedSpellSearchQuery = spellSearchQuery.trim().toLowerCase();
  const searchedSpellCards = normalizedSpellSearchQuery
    ? visibleSpellCards.filter((spell) =>
        spellSearchableText(spell, spellReferenceFor(spellReferenceCollection, spell)).includes(
          normalizedSpellSearchQuery,
        ),
      )
    : visibleSpellCards;
  const spellLevelPages = [...new Set(searchedSpellCards.map((spell) => spell.level))].sort((left, right) => left - right);
  const activeSpellPool =
    activeSpellFilter === "all"
      ? searchedSpellCards
      : searchedSpellCards.filter((spell) => spell.level === activeSpellFilter);
  const spellPageSize = 10;
  const spellPageCount = Math.max(1, Math.ceil(activeSpellPool.length / spellPageSize));
  const pagedSpellCards = activeSpellPool.slice(
    spellListPage * spellPageSize,
    spellListPage * spellPageSize + spellPageSize,
  );
  const visibleWarlockInvocations = useMemo(() => {
    if (currentClass.id !== "warlock" || !warlockOptions.eldritchInvocations?.options.length) {
      return [];
    }

    return warlockOptions.eldritchInvocations.options.filter((option) => {
      const parsed = parseWarlockInvocationSummary(option.summary);
      return warlockInvocationMeetsPrerequisite(parsed.prerequisite, {
        level: draft.level,
        pactBoonId: draft.pactBoonId,
        spellIds: draft.spellIds,
      });
    });
  }, [currentClass.id, draft.level, draft.pactBoonId, draft.spellIds, warlockOptions.eldritchInvocations?.options]);
  const invocationCandidatePool = currentClass.id === "warlock"
    ? warlockOptions.eldritchInvocations?.options ?? []
    : [];
  const visibleInvocationCards = invocationCandidatePool.filter((option) => {
    const parsed = parseWarlockInvocationSummary(option.summary);
    const isUnlocked = warlockInvocationMeetsPrerequisite(parsed.prerequisite, {
      level: draft.level,
      pactBoonId: draft.pactBoonId,
      spellIds: draft.spellIds,
    });

    return showUnavailableOptions || isUnlocked;
  });
  const invocationPageSize = 10;
  const invocationPageCount = Math.max(1, Math.ceil(visibleInvocationCards.length / invocationPageSize));
  const pagedInvocationCards = visibleInvocationCards.slice(
    invocationPage * invocationPageSize,
    invocationPage * invocationPageSize + invocationPageSize,
  );
  const pactCantripPageSize = 10;
  const searchedPactCantripCards = normalizedSpellSearchQuery
    ? pactTomeCantripPool.filter((spell) =>
        spellSearchableText(spell, spellReferenceFor(spellReferenceCollection, spell)).includes(
          normalizedSpellSearchQuery,
        ),
      )
    : pactTomeCantripPool;
  const pactCantripPageCount = Math.max(1, Math.ceil(searchedPactCantripCards.length / pactCantripPageSize));
  const pagedPactCantripCards = searchedPactCantripCards.slice(
    pactCantripPage * pactCantripPageSize,
    pactCantripPage * pactCantripPageSize + pactCantripPageSize,
  );
  const visibleSelectedInvocationCount = draft.selectedInvocationIds.filter((invocationId) =>
    visibleWarlockInvocations.some((option) => option.id === invocationId),
  ).length;
  const rangerFavoredEnemyChoices = draft.rangerChoices?.favoredEnemies ?? [];
  const rangerFavoredEnemyChoiceSlots = rangerFavoredEnemyChoiceCount(draft.level);
  const visibleRangerFavoredEnemyChoices = Array.from({ length: rangerFavoredEnemyChoiceSlots }, (_, index) => {
    const existing = rangerFavoredEnemyChoices[index];
    return {
      enemyType: existing?.enemyType ?? "aberrations",
      language: existing?.language ?? "Common",
      humanoidRaces: existing?.humanoidRaces ?? "",
    };
  });
  const isRangerFavoredFoeMode = draft.rangerChoices?.favoredEnemyMode === "foe";
  const rangerFavoredEnemySection = rangerDocs?.baseSectionEntries["favored-enemy"];
  const rangerFavoredFoeSection = rangerDocs?.baseSectionEntries["favored-foe-optional"];
  const isRangerDeftExplorerMode = draft.rangerChoices?.favoredTerrainMode === "deft";
  const rangerNaturalExplorerSection = rangerDocs?.baseSectionEntries["natural-explorer"];
  const rangerDeftExplorerSection = rangerDocs?.baseSectionEntries["deft-explorer-optional"];
  const rangerFightingStyleSection = rangerDocs?.baseSectionEntries["fighting-style"];
  const isRangerPrimalAwarenessMode = draft.rangerChoices?.awarenessMode === "primal";
  const rangerPrimevalAwarenessSection = rangerDocs?.baseSectionEntries["primeval-awareness"];
  const rangerPrimalAwarenessSection = rangerDocs?.baseSectionEntries["primal-awareness-optional"];
  const rangerPrimalAwarenessGrants =
    currentClass.id === "ranger" && isRangerPrimalAwarenessMode
      ? uniqueSpellGrants([
          ...(rangerDocs?.baseGrantedSpells ?? []),
          ...spellGrantsFromDocTables(rangerPrimalAwarenessSection?.tables ?? []),
        ]).filter((entry) => draft.level >= entry.unlockLevel)
      : [];
  const rangerPrimalAwarenessEntries = rangerPrimalAwarenessGrants.flatMap((entry) =>
    entry.spells.map((spellName) => ({
      unlockLevel: entry.unlockLevel,
      name: spellName,
      spell:
        content.spells.find((spell) => spell.name.toLowerCase() === spellName.toLowerCase()) ?? null,
    })),
  );
  const isRangerNaturesVeilMode = draft.rangerChoices?.hideMode === "natures-veil";
  const rangerHideInPlainSightSection = rangerDocs?.baseSectionEntries["hide-in-plain-sight"];
  const rangerNaturesVeilSection = rangerDocs?.baseSectionEntries["nature-s-veil-optional"];
  const rangerSpellcastingSection = rangerDocs?.baseSectionEntries["spellcasting"];
  const fighterDocs = classDocs.fighter;
  const fighterFightingStyleSection = fighterDocs?.baseSectionEntries["fighting-style"];
  const fighterEldritchKnightSpellcastingSection =
    currentClass.id === "fighter" && currentDocSubclass?.id === "eldritch-knight"
      ? currentDocSubclass.sections.find((section) => uiSlug(section.name) === "spellcasting") ?? null
      : null;
  const eldritchKnightFallbackTable: ClassDocTable | null =
    currentClass.id === "fighter" && (currentDocSubclass?.id === "eldritch-knight" || currentVisibleSubclass?.id === "eldritch-knight")
      ? {
          title: "Eldritch Knight Spellcasting",
          groupedHeaders: ["", "", "", "Spell Slots per Spell Level", "", "", ""],
          headers: ["Fighter Level", "Cantrips Known", "Spells Known", "1st", "2nd", "3rd", "4th"],
          rows: eldritchKnightProgression.map((entry) => [
            levelOrdinal(entry.level),
            String(entry.cantripsKnown),
            String(entry.spellsKnown),
            entry.slots[1] > 0 ? String(entry.slots[1]) : "-",
            entry.slots[2] > 0 ? String(entry.slots[2]) : "-",
            entry.slots[3] > 0 ? String(entry.slots[3]) : "-",
            entry.slots[4] > 0 ? String(entry.slots[4]) : "-",
          ]),
        }
      : null;
  const eldritchKnightSpellcastingTable =
    fighterEldritchKnightSpellcastingSection?.tables.find((table) =>
      ["Fighter Level", "Cantrips Known", "Spells Known"].every((header) =>
        table.headers.some((cell) => normalizedDocCell(cell) === normalizedDocCell(header)),
      ),
    ) ??
    (currentClass.id === "fighter" && currentDocSubclass?.id === "eldritch-knight"
      ? currentDocSubclass.sections
          .flatMap((section) => section.tables)
          .find((table) =>
            ["Fighter Level", "Cantrips Known", "Spells Known"].every((header) =>
              table.headers.some((cell) => normalizedDocCell(cell) === normalizedDocCell(header)),
            ),
          ) ?? null
      : null) ??
    eldritchKnightFallbackTable;
  const eldritchKnightSpellcastingRow =
    eldritchKnightSpellcastingTable?.rows.find((row) => normalizedDocCell(row[0] ?? "") === normalizedDocCell(levelOrdinal(draft.level))) ?? null;
  const readEldritchKnightCell = (header: string) => {
    const index =
      eldritchKnightSpellcastingTable?.headers.findIndex((cell) => normalizedDocCell(cell) === normalizedDocCell(header)) ?? -1;
    return index >= 0 ? eldritchKnightSpellcastingRow?.[index] ?? "" : "";
  };
  const selectedSubclassTables =
    selectedSubclassDocSection?.tables?.length
      ? selectedSubclassDocSection.tables
      : currentClass.id === "fighter" &&
          currentDocSubclass?.id === "eldritch-knight" &&
          selectedSubclassDocSection?.name === "Spellcasting" &&
          eldritchKnightSpellcastingTable
        ? [eldritchKnightSpellcastingTable]
        : [];
  const eldritchKnightFallbackRow = getEldritchKnightProgression(draft.level);
  const rangerFavoredTerrainChoiceSlots = draft.level >= 10 ? 3 : draft.level >= 6 ? 2 : 1;
  const visibleRangerFavoredTerrains = Array.from({ length: rangerFavoredTerrainChoiceSlots }, (_, index) => draft.rangerChoices?.favoredTerrains?.[index] ?? "forest");
  const rangerCannySkillOptions = draft.skills.filter((skill) => skill.proficient);
  const rangerDeftLanguages = Array.from({ length: 2 }, (_, index) => draft.rangerChoices?.deftLanguages?.[index] ?? (index === 0 ? "Sylvan" : "Elvish"));
  const rangerFightingStyleOptions = rangerFightingStyleSection?.options ?? [];
  const selectedRangerFightingStyle =
    rangerFightingStyleOptions.find((option) => option.id === draft.rangerChoices?.fightingStyleId) ?? rangerFightingStyleOptions[0] ?? null;
  const fighterFightingStyleOptions = fighterFightingStyleSection?.options ?? [];
  const selectedFighterFightingStyle =
    fighterFightingStyleOptions.find((option) => option.id === draft.fighterChoices?.fightingStyleId) ?? fighterFightingStyleOptions[0] ?? null;
  const rangerFavoredEnemySummary = isRangerFavoredFoeMode
    ? `Favored Foe aktif. Mark uses: ${draft.proficiencyBonus} per long rest • Extra damage: ${rangerFavoredFoeDamage(draft.level)}`
    : visibleRangerFavoredEnemyChoices
        .map((entry) =>
          entry.enemyType === "humanoids"
            ? `Humanoids (${entry.humanoidRaces.trim() || "Choose two"}) • ${entry.language || "Language"}`
            : `${rangerEnemyLabel(entry.enemyType)} • ${entry.language || "Language"}`
        )
        .join(" | ");
  const rangerTerrainSummary = isRangerDeftExplorerMode
    ? `Deft Explorer aktif. Canny skill: ${rangerCannySkillOptions.find((skill) => skill.id === draft.rangerChoices?.cannySkillId)?.label ?? "Choose one"} • Languages: ${rangerDeftLanguages.join(", ")}`
    : visibleRangerFavoredTerrains.map((terrain) => rangerTerrainLabel(terrain)).join(" | ");
  const skillSpellOverviewRows = [
    ...(currentClass.id === "warlock"
      ? [
          {
            id: "warlock-cantrips",
            label: "Cantrips",
            available: warlockCantripPool.length,
            selected: warlockSelectedCantrips,
            rule: readCurrentSpellTableCell("Cantrips Known") || "-",
          },
          {
            id: "warlock-spells-known",
            label: "Spells Known",
            available: warlockLeveledPool.length,
            selected: warlockSelectedLeveledSpells,
            rule: [currentWarlockSpellsKnown && `Known ${currentWarlockSpellsKnown}`, currentWarlockSpellSlots && `${currentWarlockSpellSlots} slots`, currentWarlockSlotLevel && `Slot ${currentWarlockSlotLevel}`].filter(Boolean).join(" • ") || "-",
          },
        ]
      : currentClass.id === "fighter" && (currentDocSubclass?.id === "eldritch-knight" || currentVisibleSubclass?.id === "eldritch-knight")
        ? [
            {
              id: "eldritch-knight-cantrips",
              label: "Cantrips",
              available: availableSpells.filter((spell) => spell.level === 0).length,
              selected: draft.spellIds.filter((spellId) => availableSpells.some((spell) => spell.id === spellId && spell.level === 0)).length,
              rule:
                readEldritchKnightCell("Cantrips Known") ||
                (eldritchKnightFallbackRow ? String(eldritchKnightFallbackRow.cantripsKnown) : "") ||
                (Number.isFinite(spellSelectionRules.cantripLimit) ? String(spellSelectionRules.cantripLimit) : "-"),
            },
            {
              id: "eldritch-knight-spells-known",
              label: "Spells Known",
              available: availableSpells.filter((spell) => spell.level > 0).length,
              selected: draft.spellIds.filter((spellId) => availableSpells.some((spell) => spell.id === spellId && spell.level > 0)).length,
              rule:
                [
                  (readEldritchKnightCell("Spells Known") ||
                    (eldritchKnightFallbackRow ? String(eldritchKnightFallbackRow.spellsKnown) : "") ||
                    (Number.isFinite(spellSelectionRules.totalKnownLimit) ? String(spellSelectionRules.totalKnownLimit) : "")) &&
                    `Known ${readEldritchKnightCell("Spells Known") || (eldritchKnightFallbackRow ? String(eldritchKnightFallbackRow.spellsKnown) : "") || spellSelectionRules.totalKnownLimit}`,
                  [1, 2, 3, 4]
                    .map((level) => {
                      const slotValue =
                        readEldritchKnightCell(levelOrdinal(level)) ||
                        (eldritchKnightFallbackRow && eldritchKnightFallbackRow.slots[level as 1 | 2 | 3 | 4] > 0
                          ? String(eldritchKnightFallbackRow.slots[level as 1 | 2 | 3 | 4])
                          : "") ||
                        ((spellSelectionRules.perLevelLimits[level] ?? 0) > 0 ? String(spellSelectionRules.perLevelLimits[level]) : "");
                      return slotValue && slotValue !== "-" ? `${slotValue}x L${level}` : null;
                    })
                    .filter(Boolean)
                    .join(" • "),
                  "Abjuration / Evocation",
                ]
                  .filter(Boolean)
                .join(" • ") || "-",
            },
            {
              id: "eldritch-knight-any-school",
              label: "Any School Picks",
              available: "-",
              selected: draft.spellIds.filter((spellId) =>
                availableSpells.some((spell) =>
                  spell.id === spellId &&
                  spell.level > 0 &&
                  classMatchesSpell(spell, "Wizard") &&
                  !["abjuration", "evocation"].includes(spell.school.toLowerCase()),
                ),
              ).length,
              rule: `${eldritchKnightFlexibleSchoolAllowance || Math.max(0, draft.level >= 20 ? 4 : draft.level >= 14 ? 3 : draft.level >= 8 ? 2 : draft.level >= 3 ? 1 : 0)}`,
            },
          ]
      : spellAvailabilityByLevel.map((entry) => ({
          id: `spell-tier-${entry.level}`,
          label: entry.level === 0 ? "Cantrip" : `Level ${entry.level}`,
          available: entry.availableCount,
          selected: entry.selectedCount,
          rule: entry.slotInfo,
        }))),
    ...(currentClass.id === "warlock"
      ? [
          {
            id: "invocations",
            label: "Invocations",
            available: visibleWarlockInvocations.length,
            selected: visibleSelectedInvocationCount,
            rule: `${warlockInvocationLimit || 0}`,
          },
          ...mysticArcanumOptions.map((entry) => ({
            id: `mystic-arcanum-${entry.spellLevel}`,
            label: `Mystic Arcanum ${entry.spellLevel}`,
            available: entry.spells.length,
            selected: entry.selectedSpellId ? 1 : 0,
            rule: "1",
          })),
        ]
      : []),
  ];
  const visibleClassTableBodyRows = classTableExpanded ? classTableBodyRows : classTableBodyRows.slice(0, 6);
  const paginatedLineages = useMemo(() => {
    const start = lineagePage * lineagePageSize;
    return lineageCards.slice(start, start + lineagePageSize);
  }, [lineageCards, lineagePage]);
  const pagedBackgrounds = useMemo(() => {
    const start = backgroundPage * backgroundPageSize;
    return content.backgrounds.slice(start, start + backgroundPageSize);
  }, [backgroundPage, backgroundPageSize, content.backgrounds]);
  const creatorMenu: { id: CreatorBrowser; label: string; step: CreatorStep }[] = [
    { id: "identity", label: "Identity", step: 0 },
    { id: "lineage", label: "Race", step: 0 },
    { id: "subrace", label: "Subrace", step: 0 },
    { id: "class", label: "Class", step: 1 },
    { id: "subclass", label: "Subclass", step: 1 },
    { id: "background", label: "Background", step: 1 },
    { id: "inventory", label: "Inventory", step: 1 },
    { id: "skill-spells", label: "Skill & Spells", step: 1 },
    { id: "abilities", label: "Ability Scores", step: 2 },
  ];
  const classSubmenuItems = useMemo(
    () =>
      currentClass.id === "ranger"
        ? [{ id: "ranger-choices" as CreatorBrowser, label: "Ranger Feature Choices", step: 1 as CreatorStep }]
        : currentClass.id === "fighter"
          ? [{ id: "fighter-choices" as CreatorBrowser, label: "Fighter Feature Choices", step: 1 as CreatorStep }]
          : [],
    [currentClass.id],
  );
  const subclassSubmenuItems = useMemo(
    () =>
      beastMasterChoiceSections
        ? [{ id: "subclass-choices" as CreatorBrowser, label: "Subclass Feature Choices", step: 1 as CreatorStep }]
        : [],
    [beastMasterChoiceSections],
  );

  useEffect(() => {
    const currentMenuItem = creatorMenu.find((item) => item.id === creatorBrowser);
    const currentSubmenuItem = classSubmenuItems.find((item) => item.id === creatorBrowser);
    const currentSubclassSubmenuItem = subclassSubmenuItems.find((item) => item.id === creatorBrowser);
    if (currentMenuItem?.step === creatorStep || currentSubmenuItem?.step === creatorStep || currentSubclassSubmenuItem?.step === creatorStep) {
      return;
    }

    setCreatorBrowser(defaultBrowserForStep(creatorStep));
  }, [classSubmenuItems, subclassSubmenuItems, creatorBrowser, creatorStep]);

  useEffect(() => {
    setSpellListPage(0);
    setPactCantripPage(0);
  }, [spellSearchQuery]);

  useEffect(() => {
    const matchedGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
    const matchedSubraceId =
      matchedGroup?.subraces.find((subrace) => subrace.id === draft.speciesId)?.id ??
      matchedGroup?.subraces[0]?.id ??
      "";
    setSelectedLineageId(matchedGroup?.id ?? "");
    setSelectedSubraceId(matchedSubraceId);
  }, [draft.speciesId, lineageGroups]);

  useEffect(() => {
    setLineagePage((current) => Math.min(current, Math.max(0, lineagePageCount - 1)));
  }, [lineagePageCount]);

  useEffect(() => {
    setBackgroundPage((current) => Math.min(current, Math.max(0, backgroundPageCount - 1)));
  }, [backgroundPageCount]);

  useEffect(() => {
    const selectedIndex = content.backgrounds.findIndex((item) => item.id === draft.backgroundId);
    if (selectedIndex >= 0) {
      setBackgroundPage(Math.floor(selectedIndex / backgroundPageSize));
    }
  }, [backgroundPageSize, content.backgrounds, draft.backgroundId]);

  useEffect(() => {
    setClassTableExpanded(false);
    setSelectedClassFeatureId(currentCuratedClass?.classFeatures[0]?.id ?? null);
  }, [currentCuratedClass?.id]);

  useEffect(() => {
    setSelectedSubclassFeatureId(currentVisibleSubclass?.features[0]?.id ?? null);
  }, [currentVisibleSubclass?.id]);

  useEffect(() => {
    if (creatorBrowser === "ranger-choices" && currentClass.id !== "ranger") {
      setCreatorBrowser("class");
    }
  }, [creatorBrowser, currentClass.id]);

  useEffect(() => {
    if (creatorBrowser === "fighter-choices" && currentClass.id !== "fighter") {
      setCreatorBrowser("class");
    }
  }, [creatorBrowser, currentClass.id]);

  useEffect(() => {
    if (activeSpellFilter !== "all" && !spellLevelPages.includes(activeSpellFilter)) {
      setActiveSpellFilter("all");
    }
  }, [activeSpellFilter, spellLevelPages]);

  useEffect(() => {
    setSpellListPage((current) => Math.min(current, Math.max(0, spellPageCount - 1)));
  }, [spellPageCount]);

  useEffect(() => {
    setInvocationPage((current) => Math.min(current, Math.max(0, invocationPageCount - 1)));
  }, [invocationPageCount]);

  useEffect(() => {
    setPactCantripPage((current) => Math.min(current, Math.max(0, pactCantripPageCount - 1)));
  }, [pactCantripPageCount]);

  useEffect(() => {
    if (creatorBrowser !== "lineage") {
      return;
    }

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setLineagePage((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight") {
        setLineagePage((current) => Math.min(lineagePageCount - 1, current + 1));
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [creatorBrowser, lineagePageCount]);

  const applyLevelChange = (level: number) => {
    updateDraft((current) => ({
      ...current,
      level,
      selectedSubclassOptions: level >= subclassUnlockLevel ? current.selectedSubclassOptions : [],
    }));
  };

  const updateFlexibleAbilityBonus = (slot: "plusTwo" | "plusOne", abilityId: AbilityId | "") => {
    updateDraft((current) => {
      const nextValue = abilityId || null;
      const next = {
        ...current.flexibleAbilityBonuses,
        [slot]: nextValue,
      };

      if (slot === "plusTwo" && next.plusOne === next.plusTwo) {
        next.plusOne = null;
      }
      if (slot === "plusOne" && next.plusTwo === next.plusOne) {
        next.plusTwo = null;
      }

      return {
        ...current,
        flexibleAbilityBonuses: next,
      };
    });
  };

  const addInventoryItem = () => {
    const nextItem = cleanImportedText(inventoryDraft);
    if (!nextItem) {
      return;
    }

    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.includes(nextItem) ? current.inventory : [...current.inventory, nextItem],
    }));
    setInventoryDraft("");
  };

  const removeInventoryItem = (item: string) => {
    updateDraft((current) => ({
      ...current,
      inventory: current.inventory.filter((entry) => entry !== item),
    }));
  };

  const selectLineage = (lineageId: string) => {
    const group = lineageGroups.find((entry) => entry.id === lineageId);
    if (!group) {
      return;
    }

    const firstSubrace = group.subraces[0] ?? null;
    setSelectedLineageId(group.id);
    setSelectedSubraceId(firstSubrace?.id ?? "");

    updateDraft((current) => ({
      ...current,
      speciesId: group.id,
    }));
  };

  const selectLineageCard = (card: LineageCard) => {
    if (card.subraceId) {
      setSelectedLineageId(card.lineageId);
      setSelectedSubraceId(card.subraceId);
      updateDraft((current) => ({ ...current, speciesId: card.subraceId! }));
      return;
    }

    selectLineage(card.lineageId);
  };

  const selectSubrace = (subraceId: string) => {
    setSelectedSubraceId(subraceId);
    updateDraft((current) => ({ ...current, speciesId: subraceId }));
  };

  return (
    <div className="creator-layout">
      <div className="creator-ambient creator-ambient-left" aria-hidden="true" />
      <div className="creator-ambient creator-ambient-right" aria-hidden="true" />

      <div className="card-heading">
        <h2 className="heading-with-icon">
          <AppIcon name="wand" className="section-icon" />
          <span>Character Creator</span>
        </h2>
      </div>

      <div className="creator-workbench creator-workbench-navigation creator-workbench-flat">
        <aside className="creator-nav-sidebar">
          <article className="sheet-card creator-nav-card">
            <div className="card-heading">
              <h2 className="heading-with-icon">
                <AppIcon name="search" className="section-icon" />
                <span>Creator Menu</span>
              </h2>
            </div>

            <div className="creator-nav-menu">
              {creatorMenu.map((item) => (
                <div key={item.id} className="creator-menu-group">
                  <button
                    type="button"
                    className={creatorBrowser === item.id ? "creator-menu-button active" : "creator-menu-button"}
                    onClick={() => {
                      moveCreatorStep(item.step);
                      setCreatorBrowser(item.id);
                    }}
                  >
                    <span className="summary-icon-wrap">
                      <AppIcon name={summaryIcon(item.id)} className="summary-icon" />
                    </span>
                    <span className="summary-copy">
                      <strong>{item.label}</strong>
                    </span>
                  </button>
                  {item.id === "class" && classSubmenuItems.length ? (
                    <div className="creator-menu-subgroup">
                      {classSubmenuItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          type="button"
                          className={creatorBrowser === subItem.id ? "creator-menu-button creator-menu-button-sub active" : "creator-menu-button creator-menu-button-sub"}
                          onClick={() => {
                            moveCreatorStep(subItem.step);
                            setCreatorBrowser(subItem.id);
                          }}
                        >
                          <span className="summary-icon-wrap">
                            <AppIcon name={summaryIcon(subItem.id)} className="summary-icon" />
                          </span>
                          <span className="summary-copy">
                            <strong>{subItem.label}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : item.id === "subclass" && subclassSubmenuItems.length ? (
                    <div className="creator-menu-subgroup">
                      {subclassSubmenuItems.map((subItem) => (
                        <button
                          key={subItem.id}
                          type="button"
                          className={creatorBrowser === subItem.id ? "creator-menu-button creator-menu-button-sub active" : "creator-menu-button creator-menu-button-sub"}
                          onClick={() => {
                            moveCreatorStep(subItem.step);
                            setCreatorBrowser(subItem.id);
                          }}
                        >
                          <span className="summary-icon-wrap">
                            <AppIcon name={summaryIcon(subItem.id)} className="summary-icon" />
                          </span>
                          <span className="summary-copy">
                            <strong>{subItem.label}</strong>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </aside>

        <div className="creator-main-panel creator-main-panel-clean creator-main-panel-flat">
          {creatorStep === 0 && creatorBrowser === "identity" ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide">
                <div className="identity-browser-head">
                  <span className="mini-heading creator-section-label">Identity</span>
                </div>
                <div className="creator-identity-grid">
                  <label className="compact-field">
                    <span>Character Name</span>
                    <input
                      type="text"
                      value={draft.name}
                      placeholder="Enter character name"
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="creator-panel creator-panel-tight creator-subpanel-flat">
                    <div className="identity-detail-head compact">
                      <span className="mini-heading creator-section-label">Level</span>
                      <h4>{`Level ${draft.level}`}</h4>
                    </div>
                    <div className="level-chooser">
                      {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
                        <button
                          key={`level-${level}`}
                          type="button"
                          className={draft.level === level ? "level-pill active" : "level-pill"}
                          onClick={() => updateDraft((current) => ({ ...current, level }))}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {creatorStep === 0 && creatorBrowser === "lineage" ? (
            <div className="creator-stack">
              <section className="lineage-picker-shell">
                <div className="identity-browser-head card-section-head">
                  <span className="mini-heading creator-section-label">Race Selection</span>
                </div>
                <div className="lineage-grid">
                    {paginatedLineages.map((group) => (
                      <button
                        type="button"
                        key={group.id}
                        className={
                          draft.speciesId === group.subraceId || (!group.subraceId && currentLineageGroup.id === group.lineageId)
                            ? "lineage-grid-card active"
                            : "lineage-grid-card"
                        }
                        onClick={() => selectLineageCard(group)}
                      >
                        <span className="lineage-grid-icon">
                          <AppIcon name={group.icon as Parameters<typeof AppIcon>[0]["name"]} className="summary-icon lineage-grid-icon-inner" />
                        </span>
                        <strong>{group.name}</strong>
                      </button>
                    ))}
                </div>
                <div className="lineage-grid-controls">
                  <button
                    type="button"
                    className="sheet-button secondary lineage-page-button"
                    onClick={() => setLineagePage((current) => Math.max(0, current - 1))}
                    disabled={lineagePage === 0}
                  >
                    <span aria-hidden="true">&larr;</span>
                  </button>
                  <div className="lineage-page-status">
                    <span className="lineage-page-indicator">
                      {lineagePage + 1} / {lineagePageCount}
                    </span>
                    <div className="lineage-page-dots" aria-hidden="true">
                      {Array.from({ length: lineagePageCount }, (_, index) => (
                        <span key={`lineage-page-dot-${index}`} className={lineagePage === index ? "lineage-page-dot active" : "lineage-page-dot"} />
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sheet-button secondary lineage-page-button"
                    onClick={() => setLineagePage((current) => Math.min(lineagePageCount - 1, current + 1))}
                    disabled={lineagePage >= lineagePageCount - 1}
                  >
                    <span aria-hidden="true">&rarr;</span>
                  </button>
                </div>
              </section>

              <div className="identity-detail-grid">
                <article className="creator-panel identity-detail-panel creator-subpanel-flat">
                  <div className="identity-detail-head card-section-head">
                    <h4>{currentLineageGroup.name}</h4>
                  </div>
                  <p className="identity-detail-copy">{currentLineageGroup.summary}</p>
                  {(lineagePreviewStats.length || lineageAbilityScoreIncreases.length || lineageDetailTraits.length) ? (
                    <section className="identity-block-section">
                      <div className="identity-detail-head compact card-section-head">
                        <span className="mini-heading creator-section-label">Race Details</span>
                      </div>
                      <div className="lineage-detail-meta-grid">
                        {lineagePreviewStats.map((stat, index) => (
                          <div key={`${stat.label}-detail-${index}-${stat.value}`} className="lineage-detail-meta-item">
                            <div className="lineage-detail-meta-head">
                              <span className="summary-icon-wrap">
                                <AppIcon name={iconForLineageStat(stat.label)} className="summary-icon" />
                              </span>
                            </div>
                            <span>{cleanImportedText(stat.value)}</span>
                          </div>
                        ))}
                        {lineageAbilityScoreIncreases.map((stat, index) => (
                          <div key={`${stat.label}-detail-asi-${index}-${stat.value}`} className="lineage-detail-meta-item">
                            <div className="lineage-detail-meta-head">
                              <span className="summary-icon-wrap">
                                <AppIcon name="spark" className="summary-icon" />
                              </span>
                            </div>
                            <span>{cleanImportedText(stat.value)}</span>
                          </div>
                        ))}
                      </div>
                      {lineageDetailTraits.map((trait, index) => (
                        <div key={`${currentLineageGroup.id}-detail-trait-${index}-${trait.id}`} className="lineage-detail-meta-item">
                          <div className="lineage-detail-meta-head">
                            <span className="summary-icon-wrap">
                              <AppIcon name={iconForLineageDetailTrait(trait.name)} className="summary-icon" />
                            </span>
                          </div>
                          <span>{cleanImportedText(trait.summary)}</span>
                        </div>
                      ))}
                    </section>
                  ) : null}
                  <section className="identity-block-section">
                    <div className="identity-detail-head compact card-section-head">
                      <span className="mini-heading creator-section-label">Race Traits</span>
                    </div>
                    <div className="identity-trait-list">
                      {currentLineageGroup.coreBonuses
                        .filter((bonus) => !isPreviewStatLabel(bonus.split(".")[0] ?? ""))
                        .map((bonus, index) => (
                        <div key={`${currentLineageGroup.id}-bonus-${index}-${bonus}`} className="identity-trait-item">
                          <strong>{bonus}</strong>
                          <span>{currentLineageGroup.name} için ortak lineage avantajı.</span>
                        </div>
                      ))}
                      {lineageFeatureTraits.map((trait, index) => (
                        <div key={`${currentLineageGroup.id}-trait-${index}-${trait.id}`} className="identity-trait-item">
                          <strong>{trait.name}</strong>
                          <span>{cleanImportedText(trait.summary)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </article>
              </div>
            </div>
          ) : null}

          {creatorStep === 0 && creatorBrowser === "subrace" ? (
            <div className="creator-stack">
              <section className="lineage-picker-shell">
                <div className="identity-browser-head">
                  <span className="mini-heading creator-section-label">Subrace Selection</span>
                </div>
                {availableSubraces.length ? (
                  <div className="lineage-grid subrace-grid">
                    {availableSubraces.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={currentSubraceEntry?.id === item.id ? "lineage-grid-card active" : "lineage-grid-card"}
                        onClick={() => selectSubrace(item.id)}
                      >
                        <span className="lineage-grid-icon">
                          <AppIcon name={currentLineageGroup.icon as Parameters<typeof AppIcon>[0]["name"]} className="summary-icon lineage-grid-icon-inner" />
                        </span>
                        <strong>{item.name}</strong>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="list-row">
                    <strong>No subrace found</strong>
                    <span>{subraceEmptyPrompt(currentLineageGroup.name)}</span>
                  </div>
                )}
              </section>

              <div className="identity-detail-grid">
                <article className="creator-panel identity-detail-panel creator-subpanel-flat">
                  <div className="identity-detail-head">
                    <h4>{currentSubraceEntry?.name ?? currentLineageGroup.name}</h4>
                  </div>
                  <p className="identity-detail-copy">
                    {currentSubraceEntry?.summary ?? subraceEmptyPrompt(currentLineageGroup.name)}
                  </p>
                  {currentSubraceEntry && speciesMeta ? (
                    <div className="selection-meta-stack">
                      <span>{speciesMeta}</span>
                    </div>
                  ) : null}
                  {currentSubraceEntry ? (
                    <>
                      {(currentSubraceEntry.stats.length || subraceNonStatBonuses.length || subraceDetailTraits.length) ? (
                        <section className="identity-block-section">
                          <div className="identity-detail-head compact">
                            <span className="mini-heading creator-section-label">Subrace Details</span>
                          </div>
                          <div className="lineage-detail-meta-grid">
                            {currentSubraceEntry.stats.map((stat, index) => (
                              <div key={`${currentSubraceEntry.id}-stat-${index}-${stat.label}`} className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name={iconForLineageStat(stat.label)} className="summary-icon" />
                                  </span>
                                </div>
                                <span>{cleanImportedText(stat.value)}</span>
                              </div>
                            ))}
                            {subraceNonStatBonuses.map((bonus, index) => (
                              <div key={`${currentSubraceEntry.id}-bonus-chip-${index}-${bonus}`} className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="spark" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{cleanImportedText(bonus)}</span>
                              </div>
                            ))}
                          </div>
                          {subraceDetailTraits.map((trait, index) => (
                            <div key={`${currentSubraceEntry.id}-detail-trait-${index}-${trait.id}`} className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name={iconForLineageDetailTrait(trait.name)} className="summary-icon" />
                                </span>
                              </div>
                              <span>{cleanImportedText(trait.summary)}</span>
                            </div>
                          ))}
                        </section>
                      ) : null}
                      <section className="identity-block-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label">Subrace Traits</span>
                        </div>
                        <div className="identity-trait-list">
                          {subraceFeatureTraits.map((trait, index) => (
                            <div key={`${currentSubraceEntry.id}-trait-${index}-${trait.id}`} className="identity-trait-item">
                              <strong>{trait.name}</strong>
                              <span>{cleanImportedText(trait.summary)}</span>
                            </div>
                          ))}
                        </div>
                      </section>
                    </>
                  ) : null}
                </article>
              </div>
            </div>
          ) : null}

          {creatorStep === 1 ? (
            <div className="creator-stack">
              <div
                className={
                  creatorBrowser === "class" || creatorBrowser === "ranger-choices" || creatorBrowser === "fighter-choices" || creatorBrowser === "background" || creatorBrowser === "skill-spells"
                    ? "creator-panel creator-panel-wide creator-stage-panel creator-stage-panel-flat"
                    : "creator-panel creator-panel-wide creator-stage-panel"
                }
              >
                {creatorBrowser === "class" ? (
                <section className="creator-section-block">
                    <div className="class-grid">
                      {content.classes.map((item) => {
                        return (
                          <button
                            type="button"
                            key={item.id}
                            className={draft.classId === item.id ? "lineage-grid-card active class-grid-card" : "lineage-grid-card class-grid-card"}
                            onClick={() =>
                              updateDraft((current) => ({
                                ...current,
                                classId: item.id,
                                multiclassIds: current.multiclassIds.filter((entry) => entry !== item.id),
                                selectedSubclassOptions: [],
                                spellIds: [],
                              }))
                            }
                          >
                            <span className="class-grid-media">
                              <ClassPortrait classId={item.id} alt={item.name} className="class-grid-portrait" />
                            </span>
                            <strong>{item.name}</strong>
                            <span>{`d${item.hitDie}`}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="creator-inline-divider" aria-hidden="true" />

                    <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel">
                      <div className="identity-detail-head">
                        <span className="mini-heading creator-section-label class-section-label">Class Overview</span>
                        <h4>{currentCuratedClass?.name ?? currentClass.name}</h4>
                      </div>
                      <p className="identity-detail-copy">{currentCuratedClass?.summary ?? classDescription(currentClass)}</p>

                      <div className="lineage-detail-meta-grid">
                        <div className="lineage-detail-meta-item">
                          <div className="lineage-detail-meta-head">
                            <span className="summary-icon-wrap">
                              <AppIcon name="shield" className="summary-icon" />
                            </span>
                          </div>
                          <span>{currentCuratedClass?.hitDie || `d${currentClass.hitDie}`}</span>
                        </div>
                        {currentCuratedClass?.multiclassRequirement ? (
                          <div className="lineage-detail-meta-item">
                            <div className="lineage-detail-meta-head">
                              <span className="summary-icon-wrap">
                                <AppIcon name="skill" className="summary-icon" />
                              </span>
                            </div>
                            <span>{currentCuratedClass.multiclassRequirement}</span>
                          </div>
                        ) : null}
                        {currentCuratedClass
                          ? Object.entries(currentCuratedClass.proficiencies)
                              .filter(([, value]) => value)
                              .map(([label, value]) => (
                                <div key={`${currentCuratedClass.id}-${label}`} className="lineage-detail-meta-item">
                                  <div className="lineage-detail-meta-head">
                                    <span className="summary-icon-wrap">
                                      <AppIcon name="spark" className="summary-icon" />
                                    </span>
                                  </div>
                                  <span>{`${label}: ${value}`}</span>
                                </div>
                              ))
                          : classProficiencyLines(classOptions[currentClass.id]).map((line) => (
                              <div key={line} className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="spark" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{line}</span>
                              </div>
                            ))}
                      </div>

                      {currentCuratedClass?.spellcastingTable.rows.length ? (
                        <div className="class-table-card creator-subpanel-flat creator-subsection-divider">
                          <div className="identity-detail-head compact">
                            <span className="mini-heading creator-section-label class-section-label">Progression</span>
                          </div>
                          <div className="class-progression-scroll">
                            <table className="class-progression-table">
                              <thead>
                                {classTableTopHeaderRow.length ? (
                                  <tr>
                                    {classTableTopHeaderRow.map((cell, cellIndex) => {
                                      const colSpan =
                                        classTableTopHeaderRow.length === 2 && classTableSpellLevelStartIndex > 0
                                          ? cellIndex === 0
                                            ? classTableSpellLevelStartIndex
                                            : classTableHeaderRow.length - classTableSpellLevelStartIndex
                                          : 1;

                                      return (
                                        <th key={`${currentCuratedClass.id}-top-head-${cellIndex}`} colSpan={colSpan}>
                                          {cell}
                                        </th>
                                      );
                                    })}
                                  </tr>
                                ) : null}
                                {classTableHeaderRow.length ? (
                                  <tr>
                                    {classTableHeaderRow.map((cell, cellIndex) => (
                                      <th key={`${currentCuratedClass.id}-head-${cellIndex}`}>{cell}</th>
                                    ))}
                                  </tr>
                                ) : null}
                              </thead>
                              <tbody>
                                {visibleClassTableBodyRows.map((row, rowIndex) => (
                                  <tr key={`${currentCuratedClass.id}-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`${currentCuratedClass.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {classTableRows.length > 8 ? (
                            <div className="class-table-footer">
                              <button
                                type="button"
                                className="sheet-button secondary class-table-toggle"
                                onClick={() => setClassTableExpanded((current) => !current)}
                              >
                                {classTableExpanded ? "Collapse table" : "Expand table"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {currentCuratedClass?.classFeatures.length ? (
                        <div className="class-feature-layout creator-subsection-divider">
                          <div className="identity-detail-head compact">
                            <span className="mini-heading creator-section-label class-section-label">Class Features</span>
                          </div>
                          <div className="class-feature-list">
                            {currentCuratedClass.classFeatures.map((feature) => (
                              <button
                                key={feature.id}
                                type="button"
                                className={selectedClassFeature?.id === feature.id ? "class-feature-card active" : "class-feature-card"}
                                onClick={() => setSelectedClassFeatureId(feature.id)}
                              >
                                <strong>{feature.name}</strong>
                              </button>
                            ))}
                          </div>
                          {selectedClassFeature ? (
                            <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                              <strong>{selectedClassFeature.name}</strong>
                              {selectedClassDocSection ? (
                                <>
                                  <RangerDocBlocksView blocks={selectedClassDocSection.blocks} />
                                  {selectedClassDocSection.tables.length ? <RangerDocTablesView tables={selectedClassDocSection.tables} /> : null}
                                </>
                              ) : (
                                <div className="class-feature-detail-body">
                                  {featureSummaryParagraphs(selectedClassFeature.summary).map((paragraph, index) => (
                                    <p key={`${selectedClassFeature.id}-paragraph-${index}`}>{paragraph}</p>
                                  ))}
                                </div>
                              )}
                            </article>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                </section>
                ) : null}

                {creatorBrowser === "ranger-choices" ? (
                <section className="creator-section-block">
                    {currentClass.id !== "ranger" ? (
                      <div className="list-row">
                        <strong>No ranger choice panel</strong>
                        <span>This submenu only appears for Ranger characters.</span>
                      </div>
                    ) : (
                      <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel ranger-choice-shell">
                        <div className="identity-detail-head">
                          <span className="mini-heading creator-section-label class-section-label">Ranger Feature Choices</span>
                          <h4>{isRangerFavoredFoeMode ? "Favored Foe" : "Favored Enemy"}</h4>
                        </div>

                        <div className="ranger-choice-stack">
                        <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                          <strong>{isRangerFavoredFoeMode ? rangerFeatureTitle(rangerFavoredFoeSection, "Favored Foe") : rangerFeatureTitle(rangerFavoredEnemySection, "Favored Enemy")}</strong>
                          <div className="class-feature-list ranger-mode-list">
                            <button
                              type="button"
                              className={!isRangerFavoredFoeMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerFavoredEnemyMode("enemy")}
                            >
                              <strong>Favored Enemy</strong>
                            </button>
                            <button
                              type="button"
                              className={isRangerFavoredFoeMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerFavoredEnemyMode("foe")}
                            >
                              <strong>Favored Foe</strong>
                            </button>
                          </div>
                          <RangerDocBlocksView blocks={isRangerFavoredFoeMode ? (rangerFavoredFoeSection?.blocks ?? []) : (rangerFavoredEnemySection?.blocks ?? [])} />
                          {!isRangerFavoredFoeMode ? (
                            <div className="ranger-choice-grid">
                              {visibleRangerFavoredEnemyChoices.map((entry, index) => (
                                <div key={`ranger-favored-enemy-${index}`} className="ranger-choice-card">
                                  <div className="identity-detail-head compact">
                                    <span className="mini-heading creator-section-label">{`Selection ${index + 1}`}</span>
                                    <span>{entry.enemyType === "humanoids" ? "Humanoids" : rangerEnemyLabel(entry.enemyType)}</span>
                                  </div>
                                  <label className="ranger-choice-field">
                                    <span>Enemy Type</span>
                                    <select
                                      value={entry.enemyType}
                                      onChange={(event) => updateRangerFavoredEnemyChoice(index, "enemyType", event.target.value)}
                                    >
                                      {rangerFavoredEnemyOptions.map((option) => (
                                        <option key={`ranger-enemy-option-${option}`} value={option}>
                                          {rangerEnemyLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  {entry.enemyType === "humanoids" ? (
                                    <label className="ranger-choice-field">
                                      <span>Humanoid Races</span>
                                      <input
                                        type="text"
                                        value={entry.humanoidRaces}
                                        onChange={(event) => updateRangerFavoredEnemyChoice(index, "humanoidRaces", event.target.value)}
                                        placeholder="e.g. gnolls, orcs"
                                      />
                                    </label>
                                  ) : null}
                                  <label className="ranger-choice-field">
                                    <span>Associated Language</span>
                                    <select
                                      value={entry.language}
                                      onChange={(event) => updateRangerFavoredEnemyChoice(index, "language", event.target.value)}
                                    >
                                      {rangerLanguageOptions.map((option) => (
                                        <option key={`ranger-language-option-${option}`} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="lineage-detail-meta-grid ranger-choice-summary-grid">
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="spark" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{`Extra damage: ${rangerFavoredFoeDamage(draft.level)}`}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="skill" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{`Uses per long rest: ${draft.proficiencyBonus}`}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="shield" className="summary-icon" />
                                  </span>
                                </div>
                                <span>Concentration up to 1 minute</span>
                              </div>
                            </div>
                          )}
                          <span className="ranger-choice-footer">{rangerFavoredEnemySummary}</span>
                        </article>

                        <div className="creator-inline-divider" aria-hidden="true" />

                        <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                          <strong>{isRangerDeftExplorerMode ? rangerFeatureTitle(rangerDeftExplorerSection, "Deft Explorer") : rangerFeatureTitle(rangerNaturalExplorerSection, "Natural Explorer")}</strong>
                          <div className="class-feature-list ranger-mode-list">
                            <button
                              type="button"
                              className={!isRangerDeftExplorerMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerFavoredTerrainMode("terrain")}
                            >
                              <strong>Natural Explorer</strong>
                            </button>
                            <button
                              type="button"
                              className={isRangerDeftExplorerMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerFavoredTerrainMode("deft")}
                            >
                              <strong>Deft Explorer</strong>
                            </button>
                          </div>
                          {!isRangerDeftExplorerMode ? (
                            <div className="ranger-choice-grid">
                              {visibleRangerFavoredTerrains.map((terrain, index) => (
                                <div key={`ranger-favored-terrain-${index}`} className="ranger-choice-card">
                                  <div className="identity-detail-head compact">
                                    <span className="mini-heading creator-section-label">{`Selection ${index + 1}`}</span>
                                    <span>{rangerTerrainLabel(terrain)}</span>
                                  </div>
                                  <label className="ranger-choice-field">
                                    <span>Favored Terrain</span>
                                    <select
                                      value={terrain}
                                      onChange={(event) => updateRangerFavoredTerrain(index, event.target.value)}
                                    >
                                      {rangerTerrainOptions.map((option) => (
                                        <option key={`ranger-terrain-option-${option}`} value={option}>
                                          {rangerTerrainLabel(option)}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="ranger-choice-grid">
                              <div className="ranger-choice-card">
                                <div className="identity-detail-head compact">
                                  <span className="mini-heading creator-section-label">Selection 1</span>
                                  <span>Expertise Skill</span>
                                </div>
                                <label className="ranger-choice-field">
                                  <span>Skill Proficiency</span>
                                  <select
                                    value={draft.rangerChoices?.cannySkillId ?? ""}
                                    onChange={(event) => setRangerCannySkill(event.target.value)}
                                  >
                                    {rangerCannySkillOptions.map((skill) => (
                                      <option key={`ranger-canny-skill-${skill.id}`} value={skill.id}>
                                        {skill.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                              {rangerDeftLanguages.map((language, index) => (
                                <div key={`ranger-deft-language-${index}`} className="ranger-choice-card">
                                  <div className="identity-detail-head compact">
                                    <span className="mini-heading creator-section-label">{`Selection ${index + 2}`}</span>
                                    <span>{language}</span>
                                  </div>
                                  <label className="ranger-choice-field">
                                    <span>Additional Language</span>
                                    <select
                                      value={language}
                                      onChange={(event) => updateRangerDeftLanguage(index, event.target.value)}
                                    >
                                      {rangerLanguageOptions.map((option) => (
                                        <option key={`ranger-deft-language-option-${index}-${option}`} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              ))}
                            </div>
                          )}
                          <RangerDocBlocksView blocks={isRangerDeftExplorerMode ? (rangerDeftExplorerSection?.blocks ?? []) : (rangerNaturalExplorerSection?.blocks ?? [])} />
                          <span className="ranger-choice-footer">{rangerTerrainSummary}</span>
                        </article>

                        <div className="creator-inline-divider" aria-hidden="true" />

                        <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                          <strong>{rangerFeatureTitle(rangerFightingStyleSection, "Fighting Style")}</strong>
                          <div className="class-feature-list">
                            {rangerFightingStyleOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className={draft.rangerChoices?.fightingStyleId === option.id ? "class-feature-card active" : "class-feature-card"}
                                onClick={() => setRangerFightingStyle(option.id)}
                              >
                                <strong>{option.name}</strong>
                              </button>
                            ))}
                          </div>
                          {selectedRangerFightingStyle ? (
                            <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                              <strong>{selectedRangerFightingStyle.name}</strong>
                              <div className="class-feature-detail-body">
                                <p>{selectedRangerFightingStyle.summary}</p>
                              </div>
                            </article>
                          ) : null}
                        </article>

                        <div className="creator-inline-divider" aria-hidden="true" />

                        <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                          <strong>{isRangerPrimalAwarenessMode ? rangerFeatureTitle(rangerPrimalAwarenessSection, "Primal Awareness") : rangerFeatureTitle(rangerPrimevalAwarenessSection, "Primeval Awareness")}</strong>
                          <div className="class-feature-list ranger-mode-list">
                            <button
                              type="button"
                              className={!isRangerPrimalAwarenessMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerAwarenessMode("primeval")}
                            >
                              <strong>Primeval Awareness</strong>
                            </button>
                            <button
                              type="button"
                              className={isRangerPrimalAwarenessMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerAwarenessMode("primal")}
                            >
                              <strong>Primal Awareness</strong>
                            </button>
                          </div>
                          <RangerDocBlocksView blocks={isRangerPrimalAwarenessMode ? (rangerPrimalAwarenessSection?.blocks ?? []) : (rangerPrimevalAwarenessSection?.blocks ?? [])} />
                          {isRangerPrimalAwarenessMode ? <RangerDocTablesView tables={rangerPrimalAwarenessSection?.tables ?? []} /> : null}
                        </article>

                        <div className="creator-inline-divider" aria-hidden="true" />

                        <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                          <strong>{isRangerNaturesVeilMode ? rangerFeatureTitle(rangerNaturesVeilSection, "Nature's Veil") : rangerFeatureTitle(rangerHideInPlainSightSection, "Hide in Plain Sight")}</strong>
                          <div className="class-feature-list ranger-mode-list">
                            <button
                              type="button"
                              className={!isRangerNaturesVeilMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerHideMode("plain-sight")}
                            >
                              <strong>Hide in Plain Sight</strong>
                            </button>
                            <button
                              type="button"
                              className={isRangerNaturesVeilMode ? "class-feature-card active" : "class-feature-card"}
                              onClick={() => setRangerHideMode("natures-veil")}
                            >
                              <strong>Nature's Veil</strong>
                            </button>
                          </div>
                          <RangerDocBlocksView blocks={isRangerNaturesVeilMode ? (rangerNaturesVeilSection?.blocks ?? []) : (rangerHideInPlainSightSection?.blocks ?? [])} />
                        </article>
                        </div>
                      </article>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "subclass" ? (
                <section className="creator-section-block">
                    {!subclassUnlocked ? (
                      <div className="list-row"><strong>Subclass henüz kilitli</strong><span>Bu creator akışında Subclass seçimi Level {subclassUnlockLevel} ile açılır. Şu an Level {draft.level} görünüyorsun.</span></div>
                    ) : visibleSubclasses.length ? (
                      <>
                        <div className="lineage-grid subrace-grid subclass-grid">
                          {visibleSubclasses.map((entry) => (
                            <button
                              type="button"
                              key={entry.id}
                              className={draft.selectedSubclassOptions.includes(entry.id) ? "lineage-grid-card active subclass-grid-card" : "lineage-grid-card subclass-grid-card"}
                              onClick={() =>
                                updateDraft((current) => ({
                                  ...current,
                                  selectedSubclassOptions: [entry.id],
                                }))
                              }
                            >
                              <span className="lineage-grid-icon">
                                <AppIcon name="spark" className="summary-icon lineage-grid-icon-inner" />
                              </span>
                              <strong>{entry.name}</strong>
                            </button>
                          ))}
                        </div>

                        <div className="creator-inline-divider" aria-hidden="true" />

                        <article className="creator-panel identity-detail-panel creator-subpanel-flat subclass-overview-panel">
                          <div className="identity-detail-head">
                            <span className="mini-heading creator-section-label">{visibleSubclassHeading}</span>
                            <h4>
                              {currentVisibleSubclass?.name ??
                                "Subclass"}
                            </h4>
                          </div>
                          {currentVisibleSubclass?.summary ? (
                            <p className="identity-detail-copy">{currentVisibleSubclass.summary}</p>
                          ) : null}
                          <div className="lineage-detail-meta-grid">
                            {currentVisibleSubclass ? (
                              <div key={`${currentVisibleSubclass.id}-source`} className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="book" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{currentVisibleSubclass.source}</span>
                              </div>
                            ) : null}
                          </div>
                          {currentVisibleSubclass?.features.length ? (
                            <div className="class-feature-layout creator-subsection-divider">
                              <div className="class-feature-list">
                                {currentVisibleSubclass.features.map((feature) => (
                                  <button
                                    key={feature.id}
                                    type="button"
                                    className={selectedSubclassFeature?.id === feature.id ? "class-feature-card active" : "class-feature-card"}
                                    onClick={() => setSelectedSubclassFeatureId(feature.id)}
                                  >
                                    <strong>{feature.name}</strong>
                                  </button>
                                ))}
                              </div>
                              {selectedSubclassFeature ? (
                                <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                                  <strong>{selectedSubclassFeature.name}</strong>
                                  <div className="class-feature-detail-body">
                                    {featureSummaryParagraphs(selectedSubclassFeature.summary).map((paragraph, index) => (
                                      <p key={`${selectedSubclassFeature.id}-paragraph-${index}`}>{paragraph}</p>
                                    ))}
                                  </div>
                                  {selectedSubclassTables.length ? (
                                    <RangerDocTablesView tables={selectedSubclassTables} />
                                  ) : null}
                                </article>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      </>
                    ) : availableSubclassOptions.length ? (
                      <div className="creator-picker-scroll creator-inline-browser">
                        {availableSubclassOptions.map((option) => <label className="selection-card choice-card" key={option}><input type="checkbox" className="visually-hidden" checked={draft.selectedSubclassOptions.includes(option)} onChange={() => toggleSubclassOption(option)} /><strong>{option}</strong><span>Bu yol ek Spell veya tematik erişim sağlayabilir.</span></label>)}
                      </div>
                    ) : (
                      <div className="list-row"><strong>Görünen Subclass verisi yok</strong><span>Bu Class kombinasyonu için eldeki Wiki normalize datasında ek seçim bulunamadı.</span></div>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "subclass-choices" ? (
                <section className="creator-section-block">
                    {!subclassUnlocked ? (
                      <div className="list-row"><strong>Subclass henüz kilitli</strong><span>Bu creator akışında Subclass seçimi Level {subclassUnlockLevel} ile açılır. Şu an Level {draft.level} görünüyorsun.</span></div>
                    ) : beastMasterChoiceSections ? (
                      <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel ranger-choice-shell">
                        <div className="identity-detail-head">
                          <span className="mini-heading creator-section-label class-section-label">Subclass Feature Choices</span>
                          <h4>{currentVisibleSubclass?.name ?? "Subclass Choices"}</h4>
                        </div>

                        <div className="ranger-choice-stack">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>Companion Choice</strong>
                            <div className="class-feature-list ranger-mode-list">
                              <button
                                type="button"
                                className={draft.rangerChoices?.beastMasterMode !== "primal" ? "class-feature-card active" : "class-feature-card"}
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    rangerChoices: {
                                      ...current.rangerChoices,
                                      beastMasterMode: "companion",
                                    },
                                  }))
                                }
                              >
                                <strong>Ranger's Companion</strong>
                              </button>
                              <button
                                type="button"
                                className={draft.rangerChoices?.beastMasterMode === "primal" ? "class-feature-card active" : "class-feature-card"}
                                onClick={() =>
                                  updateDraft((current) => ({
                                    ...current,
                                    rangerChoices: {
                                      ...current.rangerChoices,
                                      beastMasterMode: "primal",
                                    },
                                  }))
                                }
                              >
                                <strong>Primal Companion</strong>
                              </button>
                            </div>
                            <RangerDocBlocksView
                              blocks={
                                draft.rangerChoices?.beastMasterMode === "primal"
                                  ? beastMasterChoiceSections.primal?.blocks ?? []
                                  : beastMasterChoiceSections.companion?.blocks ?? []
                              }
                            />
                          </article>

                          {draft.rangerChoices?.beastMasterMode === "primal" && primalCompanionTables.length ? (
                            <>
                              <div className="creator-inline-divider" aria-hidden="true" />
                              <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                                <strong>Primal Companion Form</strong>
                                <div className="class-feature-list">
                                  {primalCompanionOptions.map((option) => {
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        className={selectedPrimalCompanionFormId === option.id || option.id.startsWith(`${selectedPrimalCompanionFormId}-`) ? "class-feature-card active" : "class-feature-card"}
                                        onClick={() =>
                                          updateDraft((current) => ({
                                            ...current,
                                            rangerChoices: {
                                              ...current.rangerChoices,
                                              primalCompanionFormId: option.id,
                                            },
                                          }))
                                        }
                                      >
                                        <strong>{option.label}</strong>
                                      </button>
                                    );
                                  })}
                                </div>
                                {selectedPrimalCompanionTable ? <RangerDocTablesView tables={[selectedPrimalCompanionTable]} /> : null}
                              </article>
                            </>
                          ) : null}
                        </div>
                      </article>
                    ) : (
                      <div className="list-row"><strong>Bu subclass için seçimli bir panel yok</strong><span>Seçimli subclass feature verisi docs içinde bulunursa burada görünecek.</span></div>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "fighter-choices" ? (
                <section className="creator-section-block">
                    {currentClass.id !== "fighter" ? (
                      <div className="list-row">
                        <strong>No fighter choice panel</strong>
                        <span>This submenu only appears for Fighter characters.</span>
                      </div>
                    ) : (
                      <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel ranger-choice-shell">
                        <div className="identity-detail-head">
                          <span className="mini-heading creator-section-label class-section-label">Fighter Feature Choices</span>
                          <h4>Fighting Style</h4>
                        </div>

                        <div className="ranger-choice-stack">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>{rangerFeatureTitle(fighterFightingStyleSection, "Fighting Style")}</strong>
                            <div className="class-feature-list">
                              {fighterFightingStyleOptions.map((option) => (
                                <button
                                  key={option.id}
                                  type="button"
                                  className={draft.fighterChoices?.fightingStyleId === option.id ? "class-feature-card active" : "class-feature-card"}
                                  onClick={() => setFighterFightingStyle(option.id)}
                                >
                                  <strong>{option.name}</strong>
                                </button>
                              ))}
                            </div>
                            {selectedFighterFightingStyle ? (
                              <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                                <strong>{selectedFighterFightingStyle.name}</strong>
                                <div className="class-feature-detail-body">
                                  <p>{selectedFighterFightingStyle.summary}</p>
                                </div>
                              </article>
                            ) : null}
                          </article>

                          {fighterEldritchKnightSpellcastingSection ? (
                            <>
                              <div className="creator-inline-divider" aria-hidden="true" />
                              <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                                <strong>{rangerFeatureTitle(fighterEldritchKnightSpellcastingSection, "Spellcasting")}</strong>
                                <RangerDocBlocksView blocks={fighterEldritchKnightSpellcastingSection.blocks} />
                                {fighterEldritchKnightSpellcastingSection.tables.length ? (
                                  <RangerDocTablesView tables={fighterEldritchKnightSpellcastingSection.tables} />
                                ) : null}
                              </article>
                            </>
                          ) : null}
                        </div>
                      </article>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "background" ? (
                <section className="creator-section-block">
                  <div className="lineage-grid background-grid">
                    {pagedBackgrounds.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={draft.backgroundId === item.id ? "lineage-grid-card active background-grid-card" : "lineage-grid-card background-grid-card"}
                        onClick={() => updateDraft((current) => ({ ...current, backgroundId: item.id }))}
                      >
                        <span className="lineage-grid-icon">
                          <AppIcon name="background" className="summary-icon lineage-grid-icon-inner" />
                        </span>
                        <strong>{item.name}</strong>
                      </button>
                    ))}
                  </div>

                  {backgroundPageCount > 1 ? (
                    <div className="lineage-grid-controls">
                      <button
                        type="button"
                        className="sheet-button secondary lineage-page-button"
                        onClick={() => setBackgroundPage((current) => Math.max(0, current - 1))}
                        disabled={backgroundPage === 0}
                      >
                        <span aria-hidden="true">←</span>
                      </button>
                      <div className="lineage-page-status">
                        <span className="lineage-page-indicator">{`${backgroundPage + 1} / ${backgroundPageCount}`}</span>
                        <div className="lineage-page-dots" aria-hidden="true">
                          {Array.from({ length: backgroundPageCount }).map((_, index) => (
                            <span key={`background-page-dot-${index}`} className={backgroundPage === index ? "lineage-page-dot active" : "lineage-page-dot"} />
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="sheet-button secondary lineage-page-button"
                        onClick={() => setBackgroundPage((current) => Math.min(backgroundPageCount - 1, current + 1))}
                        disabled={backgroundPage >= backgroundPageCount - 1}
                      >
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  ) : null}

                  <div className="creator-inline-divider" aria-hidden="true" />

                  <article className="creator-panel identity-detail-panel creator-subpanel-flat background-overview-panel">
                    <div className="identity-detail-head">
                      <span className="mini-heading creator-section-label class-section-label">Background</span>
                      <h4>{selectedBackground?.name ?? "Background"}</h4>
                    </div>
                    {selectedBackground ? (
                      <p className="identity-detail-copy">{backgroundDescription(selectedBackground)}</p>
                    ) : null}
                    <div className="lineage-detail-meta-grid">
                      {selectedBackground
                        ? backgroundMetaDescription(selectedBackground).map((meta) => (
                            <div key={`${selectedBackground.id}-${meta}`} className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon
                                    name={
                                      meta.startsWith("Skill Proficiencies")
                                        ? "skill"
                                        : meta.startsWith("Tool Proficiencies")
                                          ? "wand"
                                          : "book"
                                    }
                                    className="summary-icon"
                                  />
                                </span>
                              </div>
                              <span>{meta}</span>
                            </div>
                          ))
                        : null}
                    </div>
                    {selectedBackground?.source ? (
                      <p className="background-source-line">
                        <strong>Source:</strong> {selectedBackground.source}
                      </p>
                    ) : null}
                  </article>
                </section>
                ) : null}

                {creatorBrowser === "inventory" ? (
                <section className="creator-section-block">
                  <div className="creator-inline-list">
                    <div className="inventory-creator-bar">
                      <input
                        type="text"
                        value={inventoryDraft}
                        onChange={(event) => setInventoryDraft(event.target.value)}
                        placeholder="Add item, gear, potion, or note"
                      />
                      <button type="button" className="sheet-button secondary" onClick={addInventoryItem}>
                        Add Item
                      </button>
                    </div>
                    <div className="inventory-creator-list">
                      {draft.inventory.length ? (
                        draft.inventory.map((item) => (
                          <article className="inventory-creator-item" key={item}>
                            <span>{item}</span>
                            <button type="button" className="sheet-button secondary" onClick={() => removeInventoryItem(item)}>
                              Remove
                            </button>
                          </article>
                        ))
                      ) : (
                        <div className="list-row">
                          <strong>No inventory yet</strong>
                          <span>Add weapons, gear, potions, or important carried items here.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
                ) : null}

                {creatorBrowser === "skill-spells" ? (
                <section className="creator-section-block">
                  <div className="skill-spell-layout skill-spell-layout-flat">
                      <section className="skill-spell-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label class-section-label">Skills</span>
                        </div>
                        <div className="skill-choice-grid">
                        {(currentClassRules?.skillChoices ?? []).map((skillId) => {
                          const skillEntry = draft.skills.find((skill) => skill.id === skillId);
                          const skillCopy = skillDescription(skillId, skillEntry?.description);
                          return (
                            <label className="selection-card choice-card skill-spell-card" key={skillId}>
                              <input type="checkbox" className="visually-hidden" checked={draft.selectedSkillIds.includes(skillId)} onChange={() => toggleSkillSelection(skillId)} />
                              <div className="skill-spell-card-head">
                                <strong className="skill-spell-card-title">
                                  {skillLabel(skillId)}
                                  {skillEntry?.proficient ? <span className="skill-proficiency-star" aria-hidden="true">★</span> : null}
                                </strong>
                              </div>
                              {skillCopy ? (
                                <p className="skill-spell-card-description">{skillCopy}</p>
                              ) : null}
                              <div className="skill-spell-card-meta">
                                <span className={abilityAccentClass(skillAbilities[skillId] ?? "INT")}>
                                  {abilityLabels[skillAbilities[skillId] ?? "INT"]}
                                </span>
                                {skillEntry?.breakdown && !skillEntry.breakdown.toLowerCase().includes("modifier")
                                  ? <span>{skillEntry.breakdown}</span>
                                  : null}
                              </div>
                            </label>
                          );
                        })}
                        </div>
                      </section>
                      <div className="creator-inline-divider" aria-hidden="true" />
                      <section className="skill-spell-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label class-section-label">Spells & Invocations</span>
                        </div>
                        {currentClass.id === "ranger" && rangerSpellcastingSection ? (
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>{rangerSpellcastingSection.name}</strong>
                            <RangerDocBlocksView blocks={rangerSpellcastingSection.blocks} />
                          </article>
                        ) : null}
                        {skillSpellOverviewRows.length ? (
                          <div className="spell-access-card creator-subpanel-flat">
                            <div className="spell-access-head">
                              <strong>Spell Access Overview</strong>
                              <span>{`${currentClass.name}${currentVisibleSubclass ? ` • ${currentVisibleSubclass.name}` : ""} • Level ${draft.level}`}</span>
                            </div>
                            <div className="spell-access-table">
                              <div className="spell-access-row spell-access-row-head">
                                <span>Tier</span>
                                <span>Available</span>
                                <span>Selected</span>
                                <span>{currentClass.id === "warlock" ? "Rule / Slots" : spellTableLabel(currentClass.id)}</span>
                              </div>
                              {skillSpellOverviewRows.map((entry) => (
                                <div className="spell-access-row" key={entry.id}>
                                  <span>{entry.label}</span>
                                  <span>{entry.available}</span>
                                  <span>{entry.selected}</span>
                                  <span>{entry.rule}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {currentClass.id === "ranger" && currentVisibleSubclass && rangerSubclassMagicEntries.length ? (
                          <div className="creator-inline-list">
                            <div className="list-row">
                              <strong>{rangerSubclassMagicSection?.name ?? subclassAutoSpellLabel}</strong>
                              <span>{subclassAutoSpellSourceLabel}</span>
                            </div>
                            <div className="patron-spell-list">
                              {rangerSubclassMagicEntries.map((entry) => (
                                <div className="spell-selection-row auto" key={`${currentVisibleSubclass.id}-magic-${entry.unlockLevel}-${entry.name}`}>
                                  <div className="spell-selection-main">
                                    <strong className="spell-selection-title">
                                      <HoverTooltip
                                        label={entry.name}
                                        content={spellTooltipContent({
                                          classId: currentClass.id,
                                          className: rangerSubclassMagicSection?.name ?? currentVisibleSubclass.name,
                                          title: entry.name,
                                          reference: spellReferenceFor(spellReferenceCollection, entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name }),
                                          summary:
                                            entry.spell?.summary ??
                                            `${entry.name} is granted by your subclass and added automatically to your ${currentClass.name.toLowerCase()} spell list.`,
                                          spellLevel: entry.spell?.level,
                                          meta: [`Unlocked at ${currentClass.name} ${entry.unlockLevel}`, currentVisibleSubclass.name, "Subclass Magic"],
                                        })}
                                      />
                                    </strong>
                                    <div className="spell-selection-tags important">
                                      <span className="spell-tooltip-chip tone-support">
                                        <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                        Auto Added
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {currentClass.id !== "warlock" && currentClass.id !== "ranger" && currentVisibleSubclass && subclassSpellEntries.length ? (
                          <div className="creator-inline-list">
                            <div className="list-row">
                              <strong>{subclassAutoSpellLabel}</strong>
                              <span>{subclassAutoSpellSourceLabel}</span>
                            </div>
                            <div className="patron-spell-list">
                              {subclassSpellEntries.map((entry) => (
                                <div className="spell-selection-row auto" key={`${currentVisibleSubclass.id}-${entry.unlockLevel}-${entry.name}`}>
                                  <div className="spell-selection-main">
                                    <strong className="spell-selection-title">
                                      <HoverTooltip
                                        label={entry.name}
                                        content={spellTooltipContent({
                                          classId: currentClass.id,
                                          className: currentVisibleSubclass.name,
                                          title: entry.name,
                                          reference: spellReferenceFor(spellReferenceCollection, entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name }),
                                          summary:
                                            entry.spell?.summary ??
                                            `${entry.name} is granted by your subclass and added automatically to your ${currentClass.name.toLowerCase()} spell list.`,
                                          spellLevel: entry.spell?.level,
                                          meta: [`Unlocked at ${currentClass.name} ${entry.unlockLevel}`, currentVisibleSubclass.name, "Subclass Magic"],
                                        })}
                                      />
                                    </strong>
                                    <div className="spell-selection-tags important">
                                      <span className="spell-tooltip-chip tone-support">
                                        <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                        Auto Added
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {currentClass.id === "ranger" && rangerPrimalAwarenessEntries.length ? (
                          <div className="creator-inline-list">
                            <div className="list-row">
                              <strong>{rangerPrimalAwarenessLabel}</strong>
                              <span>{rangerPrimalAwarenessSourceLabel}</span>
                            </div>
                            <div className="patron-spell-list">
                              {rangerPrimalAwarenessEntries.map((entry) => (
                                <div className="spell-selection-row auto" key={`primal-awareness-${entry.unlockLevel}-${entry.name}`}>
                                  <div className="spell-selection-main">
                                    <strong className="spell-selection-title">
                                      <HoverTooltip
                                        label={entry.name}
                                        content={spellTooltipContent({
                                          classId: currentClass.id,
                                          className: rangerPrimalAwarenessSection?.name ?? "Primal Awareness",
                                          title: entry.name,
                                          reference: spellReferenceFor(
                                            spellReferenceCollection,
                                            entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name },
                                          ),
                                          summary:
                                            entry.spell?.summary ??
                                            `${entry.name} is granted automatically by Primal Awareness and does not count against the number of ranger spells you know.`,
                                          spellLevel: entry.spell?.level,
                                          meta: [`Unlocked at Ranger ${entry.unlockLevel}`, "Primal Awareness", "Auto Added"],
                                        })}
                                      />
                                    </strong>
                                    <div className="spell-selection-tags important">
                                      <span className="spell-tooltip-chip tone-support">
                                        <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                        Auto Added
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="skill-spell-toolbar">
                          <button
                            type="button"
                            className={showUnavailableOptions ? "table-toggle-button active" : "table-toggle-button"}
                            onClick={() => setShowUnavailableOptions((current) => !current)}
                          >
                            {showUnavailableOptions ? "Hide Locked" : "Show Locked"}
                          </button>
                        </div>
                        {currentClass.id === "warlock" ? (
                          <div className="warlock-stage-shell">
                            <div className="warlock-stage-tabs">
                              <button type="button" className={openWarlockGroup === "spells" ? "warlock-stage-tab active" : "warlock-stage-tab"} onClick={() => setOpenWarlockGroup("spells")}>
                                <span className="warlock-flow-step">1</span>
                                <span className="warlock-flow-copy">
                                  <strong>Choose Spells</strong>
                                  <span>{`${availableSpells.length} open spells`}</span>
                                </span>
                              </button>
                              <button type="button" className={openWarlockGroup === "pact" ? "warlock-stage-tab active" : "warlock-stage-tab"} onClick={() => setOpenWarlockGroup("pact")}>
                                <span className="warlock-flow-step">2</span>
                                <span className="warlock-flow-copy">
                                  <strong>Choose Pact</strong>
                                  <span>{draft.pactBoonId ? warlockPactBoonOptions.find((option) => option.id === draft.pactBoonId)?.name ?? "Selected" : "No pact selected"}</span>
                                </span>
                              </button>
                              <button type="button" className={openWarlockGroup === "invocations" ? "warlock-stage-tab active" : "warlock-stage-tab"} onClick={() => setOpenWarlockGroup("invocations")}>
                                <span className="warlock-flow-step">3</span>
                                <span className="warlock-flow-copy">
                                  <strong>Choose Invocations</strong>
                                  <span>{`${visibleSelectedInvocationCount} / ${warlockInvocationLimit || 0} selected`}</span>
                                </span>
                              </button>
                            </div>

                            <div className="warlock-stage-content">
                              {openWarlockGroup === "spells" ? (
                                <>
                                  {currentVisibleSubclass && subclassSpellEntries.length ? (
                                    <div className="creator-inline-list">
                                      <div className="list-row">
                                        <strong>{subclassAutoSpellLabel}</strong>
                                        <span>{subclassAutoSpellSourceLabel}</span>
                                      </div>
                                      <div className="patron-spell-list">
                                        {subclassSpellEntries.map((entry) => (
                                          <div className="spell-selection-row auto" key={`${currentVisibleSubclass.id}-${entry.unlockLevel}-${entry.name}`}>
                                            <div className="spell-selection-main">
                                              <strong className="spell-selection-title">
                                                <HoverTooltip
                                                  label={entry.name}
                                                  content={spellTooltipContent({
                                                    classId: currentClass.id,
                                                    className: currentVisibleSubclass.name,
                                                    title: entry.name,
                                                    reference: spellReferenceFor(spellReferenceCollection, entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name }),
                                                    summary:
                                                      entry.spell?.summary ??
                                                      `${entry.name} is granted by your patron and added automatically to your warlock spell list.`,
                                                    spellLevel: entry.spell?.level,
                                                    meta: [`Unlocked at Warlock ${entry.unlockLevel}`, currentVisibleSubclass.name, "Pact Magic"],
                                                  })}
                                                />
                                              </strong>
                                              <div className="spell-selection-tags important">
                                                <span className="spell-tooltip-chip tone-support">
                                                  <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                                  Auto Added
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="spell-filter-stack">
                                    {spellLevelPages.length ? (
                                      <div className="pagination-tabs">
                                        <button type="button" className={activeSpellFilter === "all" ? "pagination-tab active" : "pagination-tab"} onClick={() => { setActiveSpellFilter("all"); setSpellListPage(0); }}>All</button>
                                        {spellLevelPages.map((level) => (
                                          <button type="button" key={`spell-level-page-${level}`} className={activeSpellFilter === level ? "pagination-tab active" : "pagination-tab"} onClick={() => { setActiveSpellFilter(level); setSpellListPage(0); }}>
                                            {level === 0 ? "Cantrip" : `Level ${level}`}
                                          </button>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div className="skill-spell-search centered">
                                      <AppIcon name="search" className="skill-spell-search-icon" />
                                      <input
                                        type="search"
                                        value={spellSearchQuery}
                                        onChange={(event) => setSpellSearchQuery(event.target.value)}
                                        placeholder="Search spells, keywords, text..."
                                        aria-label="Search spells"
                                      />
                                    </div>
                                  </div>
                                  <div className="compact-option-list graph-list">
                                    {pagedSpellCards.length ? pagedSpellCards.map((spell, spellIndex) => {
                                      const isUnlocked = availableSpells.some((availableSpell) => availableSpell.id === spell.id);
                                      return (
                                        <label className={draft.spellIds.includes(spell.id) ? `spell-selection-row active${isUnlocked ? "" : " disabled"}` : `spell-selection-row${isUnlocked ? "" : " disabled"}`} key={`${spell.id}-${spell.level}-${spellIndex}`}>
                                          <input type="checkbox" className="visually-hidden" checked={draft.spellIds.includes(spell.id)} disabled={!isUnlocked} onChange={() => toggleSelection("spellIds", spell.id)} />
                                          <div className="spell-selection-main">
                                            <strong className="spell-selection-title">
                                              <HoverTooltip
                                                label={spell.name}
                                                content={spellTooltipContent({
                                                  classId: currentClass.id,
                                                  className: currentClass.name,
                                                  title: spell.name,
                                                  spellLevel: spell.level,
                                                  reference: spellReferenceFor(spellReferenceCollection, spell),
                                                  summary: spell.summary,
                                                  meta: [`Level ${spell.level}`, spell.school, spell.castingTime],
                                                  lines: spellMetaLines(spell),
                                                })}
                                              />
                                            </strong>
                                          </div>
                                          <div className="spell-selection-tags important">
                                            {spellListHintChips(spell, spellReferenceFor(spellReferenceCollection, spell)).map((item) => (
                                              <span key={`${spell.id}-important-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
                                                <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
                                                {item}
                                              </span>
                                            ))}
                                          </div>
                                        </label>
                                      );
                                    }) : <div className="list-row"><strong>No visible spells</strong><span>No spells match the current filter, level, or search.</span></div>}
                                  </div>
                                  <div className="compact-pagination-row centered below-list">
                                    <div className="pagination-mini-controls">
                                      <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.max(0, current - 1))} disabled={spellListPage === 0}>‹</button>
                                      <span className="pagination-indicator">{`${spellListPage + 1} / ${spellPageCount}`}</span>
                                      <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.min(spellPageCount - 1, current + 1))} disabled={spellListPage >= spellPageCount - 1}>›</button>
                                    </div>
                                  </div>
                                </>
                              ) : null}
                              {openWarlockGroup === "pact" ? (
                                <div className="warlock-flow-panel">
                                  <div className="list-row">
                                    <strong>Pact Boon</strong>
                                    <span>{draft.pactBoonId ? warlockPactBoonOptions.find((option) => option.id === draft.pactBoonId)?.name ?? draft.pactBoonId : "Select one boon"}</span>
                                  </div>
                                  <div className="identity-choice-list subrace-choice-list">
                                    {warlockPactBoonOptions.map((option) => (
                                      <button
                                        type="button"
                                        key={option.id}
                                        className={draft.pactBoonId === option.id ? "selection-card active" : "selection-card"}
                                        onClick={() => setPactBoon(option.id)}
                                      >
                                        <strong>{option.name}</strong>
                                        <span>{option.summary}</span>
                                      </button>
                                    ))}
                                  </div>
                                  {draft.pactBoonId === "pact-of-the-tome" ? (
                                    <div className="creator-inline-list">
                                      <div className="list-row">
                                        <strong>Book of Shadows Cantrips</strong>
                                        <span>{`${draft.selectedPactCantripIds.length} / 3 selected`}</span>
                                      </div>
                                      <div className="compact-option-list graph-list">
                                        {pagedPactCantripCards.map((spell) => (
                                          <label className={draft.selectedPactCantripIds.includes(spell.id) ? "spell-selection-row active" : `spell-selection-row${!draft.selectedPactCantripIds.includes(spell.id) && draft.selectedPactCantripIds.length >= 3 ? " disabled" : ""}`} key={`tome-cantrip-${spell.id}`}>
                                            <input type="checkbox" className="visually-hidden" checked={draft.selectedPactCantripIds.includes(spell.id)} disabled={!draft.selectedPactCantripIds.includes(spell.id) && draft.selectedPactCantripIds.length >= 3} onChange={() => togglePactCantripSelection(spell.id)} />
                                            <div className="spell-selection-main">
                                              <strong className="spell-selection-title">
                                                <HoverTooltip
                                                  label={spell.name}
                                                  content={spellTooltipContent({
                                                    classId: currentClass.id,
                                                    className: "Book of Shadows",
                                                    title: spell.name,
                                                    spellLevel: spell.level,
                                                    reference: spellReferenceFor(spellReferenceCollection, spell),
                                                    summary: spell.summary,
                                                    meta: ["Cantrip", "Any Class", "Pact of the Tome"],
                                                  })}
                                                />
                                              </strong>
                                            </div>
                                            <div className="spell-selection-tags important">
                                              {spellListHintChips(spell, spellReferenceFor(spellReferenceCollection, spell)).map((item) => (
                                                <span key={`${spell.id}-tome-important-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
                                                  <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
                                                  {item}
                                                </span>
                                              ))}
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                      <div className="compact-pagination-row centered below-list">
                                        <button type="button" className="pagination-arrow" onClick={() => setPactCantripPage((current) => Math.max(0, current - 1))} disabled={pactCantripPage === 0}>‹</button>
                                        <span className="pagination-indicator">{`${pactCantripPage + 1} / ${pactCantripPageCount}`}</span>
                                        <button type="button" className="pagination-arrow" onClick={() => setPactCantripPage((current) => Math.min(pactCantripPageCount - 1, current + 1))} disabled={pactCantripPage >= pactCantripPageCount - 1}>›</button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {openWarlockGroup === "invocations" ? (
                                visibleInvocationCards.length ? (
                                  <div className="warlock-flow-panel">
                                    <div className="compact-pagination-row centered">
                                      <button type="button" className="pagination-arrow" onClick={() => setInvocationPage((current) => Math.max(0, current - 1))} disabled={invocationPage === 0}>‹</button>
                                      <span className="pagination-indicator">{`${invocationPage + 1} / ${invocationPageCount}`}</span>
                                      <button type="button" className="pagination-arrow" onClick={() => setInvocationPage((current) => Math.min(invocationPageCount - 1, current + 1))} disabled={invocationPage >= invocationPageCount - 1}>›</button>
                                    </div>
                                    <div className="compact-option-list graph-list">
                                      {pagedInvocationCards.map((option) => {
                                        const parsed = parseWarlockInvocationSummary(option.summary);
                                        const isUnlocked = warlockInvocationMeetsPrerequisite(parsed.prerequisite, {
                                          level: draft.level,
                                          pactBoonId: draft.pactBoonId,
                                          spellIds: draft.spellIds,
                                        });
                                        return (
                                          <label className={draft.selectedInvocationIds.includes(option.id) ? `spell-selection-row active${isUnlocked ? "" : " disabled"}` : `spell-selection-row${isUnlocked ? "" : " disabled"}`} key={option.id}>
                                            <input type="checkbox" className="visually-hidden" checked={draft.selectedInvocationIds.includes(option.id)} disabled={!isUnlocked} onChange={() => toggleInvocationSelection(option.id)} />
                                            <div className="spell-selection-main">
                                              <strong className="spell-selection-title">
                                                <HoverTooltip label={option.name} content={
                                                  <>
                                                    <span className="spell-tooltip-head">
                                                      <span className="spell-tooltip-class">
                                                        <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                        <span>{currentClass.name}</span>
                                                      </span>
                                                      <strong>{option.name}</strong>
                                                    </span>
                                                    <span className="spell-tooltip-meta">
                                                      {parsed.source ? <span>{parsed.source}</span> : null}
                                                      {parsed.prerequisite ? <span>{`Prerequisite: ${parsed.prerequisite}`}</span> : null}
                                                    </span>
                                                    <span className="spell-tooltip-copy">{parsed.description}</span>
                                                  </>
                                                } />
                                              </strong>
                                            </div>
                                            <div className="spell-selection-tags important">
                                              {parsed.prerequisite ? (
                                                <span className="spell-tooltip-chip tone-utility">
                                                  <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                                  Prerequisite
                                                </span>
                                              ) : null}
                                              {damageChipFromText(parsed.description) ? (
                                                <span className="spell-tooltip-chip tone-danger">
                                                  <AppIcon name="dice" className="spell-tooltip-chip-icon" />
                                                  {damageChipFromText(parsed.description)}
                                                </span>
                                              ) : null}
                                            </div>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="list-row">
                                    <strong>No available invocations</strong>
                                    <span>Your current level, Pact Boon, or learned spells do not unlock an invocation here yet.</span>
                                  </div>
                                )
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                        {currentClass.id !== "warlock" ? (
                          <div className="skill-spell-column">
                            <div className="skill-spell-column-head">
                              <strong>Spells</strong>
                              <span>{`${availableSpells.length} open`}</span>
                            </div>
                            <div className="spell-filter-stack">
                              {spellLevelPages.length ? (
                                <div className="pagination-tabs">
                                  <button
                                    type="button"
                                    className={activeSpellFilter === "all" ? "pagination-tab active" : "pagination-tab"}
                                    onClick={() => {
                                      setActiveSpellFilter("all");
                                      setSpellListPage(0);
                                    }}
                                  >
                                    All
                                  </button>
                                  {spellLevelPages.map((level) => (
                                    <button
                                      type="button"
                                      key={`spell-level-page-${level}`}
                                      className={activeSpellFilter === level ? "pagination-tab active" : "pagination-tab"}
                                      onClick={() => {
                                        setActiveSpellFilter(level);
                                        setSpellListPage(0);
                                      }}
                                    >
                                      {level === 0 ? "Cantrip" : `Level ${level}`}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              <div className="skill-spell-search centered">
                                <AppIcon name="search" className="skill-spell-search-icon" />
                                <input
                                  type="search"
                                  value={spellSearchQuery}
                                  onChange={(event) => setSpellSearchQuery(event.target.value)}
                                  placeholder="Search spells, keywords, text..."
                                  aria-label="Search spells"
                                />
                              </div>
                            </div>
                            <div className="compact-option-list graph-list">
                              {pagedSpellCards.length ? pagedSpellCards.map((spell, spellIndex) => {
                                const isUnlocked = availableSpells.some((availableSpell) => availableSpell.id === spell.id);
                                return (
                                  <label className={draft.spellIds.includes(spell.id) ? `spell-selection-row active${isUnlocked ? "" : " disabled"}` : `spell-selection-row${isUnlocked ? "" : " disabled"}`} key={`${spell.id}-${spell.level}-${spellIndex}`}>
                                    <input type="checkbox" className="visually-hidden" checked={draft.spellIds.includes(spell.id)} disabled={!isUnlocked} onChange={() => toggleSelection("spellIds", spell.id)} />
                                    <div className="spell-selection-main">
                                      <strong className="spell-selection-title">
                                        <HoverTooltip
                                          label={spell.name}
                                          content={spellTooltipContent({
                                            classId: currentClass.id,
                                            className: currentClass.name,
                                            title: spell.name,
                                            spellLevel: spell.level,
                                            reference: spellReferenceFor(spellReferenceCollection, spell),
                                            summary: spell.summary,
                                            meta: [`Level ${spell.level}`, spell.school, spell.castingTime],
                                            lines: spellMetaLines(spell),
                                          })}
                                        />
                                      </strong>
                                    </div>
                                    <div className="spell-selection-tags important">
                                      {spellListHintChips(spell, spellReferenceFor(spellReferenceCollection, spell)).map((item) => (
                                        <span key={`${spell.id}-important-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
                                          <AppIcon name={spellChipIcon(item)} className="spell-tooltip-chip-icon" />
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </label>
                                );
                              }) : <div className="list-row"><strong>No visible spells</strong><span>No spells match the current filter, level, or search.</span></div>}
                            </div>
                            <div className="compact-pagination-row centered below-list">
                              <div className="pagination-mini-controls">
                                <button
                                  type="button"
                                  className="pagination-arrow"
                                  onClick={() => setSpellListPage((current) => Math.max(0, current - 1))}
                                  disabled={spellListPage === 0}
                                >
                                  ‹
                                </button>
                                <span className="pagination-indicator">{`${spellListPage + 1} / ${spellPageCount}`}</span>
                                <button
                                  type="button"
                                  className="pagination-arrow"
                                  onClick={() => setSpellListPage((current) => Math.min(spellPageCount - 1, current + 1))}
                                  disabled={spellListPage >= spellPageCount - 1}
                                >
                                  ›
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </section>
                  </div>
                </section>
                ) : null}
              </div>
            </div>
          ) : null}

          {creatorStep === 2 ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide">
                <div className="ability-pointbuy-topline">
                  <span className="mini-heading">Ability Scores</span>
                  <div className="ability-topline-meta">
                    <span>
                      27 points |{" "}
                      <span className={pointBuyRemaining < 0 ? "ability-remaining-negative" : undefined}>
                        {`Remaining ${pointBuyRemaining}`}
                      </span>
                    </span>
                  </div>
                </div>
                {flexibleAbilityBonusSource ? (
                  <div className="flexible-bonus-panel compact">
                    <div className="list-row">
                      <strong>Flexible Ability Score Increase</strong>
                      <span>{`${flexibleAbilityBonusSource} lets you assign one +2 and one +1 to different abilities.`}</span>
                    </div>
                    <div className="ability-flex-assignment-grid">
                      {draft.abilities.map((ability) => (
                        <div className="ability-flex-assignment-row" key={`flex-assignment-${ability.id}`}>
                          <strong className={abilityAccentClass(ability.id)}>{ability.id}</strong>
                          <div className="ability-flex-picks prominent">
                            <button
                              type="button"
                              className={draft.flexibleAbilityBonuses.plusTwo === ability.id ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                              aria-pressed={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                              onClick={() =>
                                updateFlexibleAbilityBonus(
                                  "plusTwo",
                                  draft.flexibleAbilityBonuses.plusTwo === ability.id ? "" : ability.id,
                                )
                              }
                              disabled={draft.flexibleAbilityBonuses.plusOne === ability.id}
                            >
                              +2
                            </button>
                            <button
                              type="button"
                              className={draft.flexibleAbilityBonuses.plusOne === ability.id ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                              aria-pressed={draft.flexibleAbilityBonuses.plusOne === ability.id}
                              onClick={() =>
                                updateFlexibleAbilityBonus(
                                  "plusOne",
                                  draft.flexibleAbilityBonuses.plusOne === ability.id ? "" : ability.id,
                                )
                              }
                              disabled={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="ability-pointbuy-grid">
                  {previewAbilities.map((ability) => {
                    const canDecrease = true;
                    const canIncrease = true;

                    return (
                      <article className="ability-pointbuy-card" key={ability.id}>
                        <div className="ability-pointbuy-head">
                          <div className="ability-pointbuy-head-main">
                            <span className={abilityAccentClass(ability.id)}>{ability.id}</span>
                            {flexibleAbilityBonusSource ? (
                              <div className="ability-flex-picks">
                                <button
                                  type="button"
                                  className={draft.flexibleAbilityBonuses.plusTwo === ability.id ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                                  aria-pressed={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                                  onClick={() =>
                                    updateFlexibleAbilityBonus(
                                      "plusTwo",
                                      draft.flexibleAbilityBonuses.plusTwo === ability.id ? "" : ability.id,
                                    )
                                  }
                                  disabled={draft.flexibleAbilityBonuses.plusOne === ability.id}
                                >
                                  +2
                                </button>
                                <button
                                  type="button"
                                  className={draft.flexibleAbilityBonuses.plusOne === ability.id ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                                  aria-pressed={draft.flexibleAbilityBonuses.plusOne === ability.id}
                                  onClick={() =>
                                    updateFlexibleAbilityBonus(
                                      "plusOne",
                                      draft.flexibleAbilityBonuses.plusOne === ability.id ? "" : ability.id,
                                    )
                                  }
                                  disabled={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                                >
                                  +1
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <strong className={abilityAccentClass(ability.id)}>{ability.label}</strong>
                        </div>
                        <div className="ability-pointbuy-values">
                          <div className="ability-pointbuy-base">
                            <strong>{ability.previewScore}</strong>
                          </div>
                          <div className="ability-pointbuy-total">
                            <strong>{ability.previewModifier >= 0 ? `+${ability.previewModifier}` : ability.previewModifier}</strong>
                          </div>
                        </div>
                        <div className="ability-pointbuy-meta">
                          <span>{`Base score ${ability.score}`}</span>
                          {ability.racialBonus > 0 ? (
                            <span className="ability-bonus-badge">{`Racial Bonus +${ability.racialBonus}`}</span>
                          ) : null}
                          {ability.flexibleBonus > 0 ? (
                            <span className="ability-bonus-badge secondary">{`Flexible Bonus +${ability.flexibleBonus}`}</span>
                          ) : null}
                        </div>
                        <div className="ability-pointbuy-controls">
                          <button type="button" className="sheet-button secondary" disabled={!canDecrease} onClick={() => updateAbility(ability.id, ability.score - 1)}>-</button>
                          <span>{`${pointBuyCost(ability.score)} pts`}</span>
                          <button type="button" className="sheet-button secondary" disabled={!canIncrease} onClick={() => updateAbility(ability.id, ability.score + 1)}>+</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="creator-preview-sidebar">
          <article className="sheet-card creator-preview-card">
            <div className="lineage-preview-head">
              <span className="mini-heading">Preview</span>
              <h4>{currentLineageGroup.name}</h4>
              <p>
                Level {draft.level} {currentClass?.name || "Paladin"}
              </p>
            </div>

            <div className="lineage-ability-board">
              <div className="lineage-ability-row labels">
                {previewAbilities.map((ability) => (
                  <span key={ability.id} className={abilityAccentClass(ability.id)}>{ability.id}</span>
                ))}
              </div>
              <div className="lineage-ability-row values">
                {previewAbilities.map((ability) => (
                  <strong key={ability.id}>{ability.previewScore}</strong>
                ))}
              </div>
            </div>

            {lineagePreviewStats.length ? (
              <div className="lineage-preview-section">
                <div className="lineage-preview-list">
                  {lineagePreviewStats.map((stat, index) => (
                    <div key={`${stat.label}-${index}-${stat.value}`} className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name={iconForLineageStat(stat.label)} className="summary-icon" />
                        </span>
                        <strong>{stat.label}</strong>
                      </div>
                      <span>{compactLineageStatValue(stat.label, stat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {lineageAbilityScoreIncreases.length ? (
              <div className="lineage-preview-section">
                <span className="mini-heading">Ability Score Increase</span>
                <div className="lineage-preview-list">
                  {lineageAbilityScoreIncreases.map((stat, index) => (
                    <div key={`${stat.label}-asi-${index}-${stat.value}`} className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name="spark" className="summary-icon" />
                        </span>
                        <strong>{stat.label}</strong>
                      </div>
                      <span>{compactLineageStatValue(stat.label, stat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {subraceAbilityScoreIncreases.length ? (
              <div className="lineage-preview-section">
                <span className="mini-heading">Subrace Ability Score Increase</span>
                <div className="lineage-preview-list">
                  {subraceAbilityScoreIncreases.map((stat, index) => (
                    <div key={`${stat.label}-subrace-asi-${index}-${stat.value}`} className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name="spark" className="summary-icon" />
                        </span>
                        <strong>{stat.label}</strong>
                      </div>
                      <span>{compactLineageStatValue(stat.label, stat.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {flexibleAbilityBonusSource && (draft.flexibleAbilityBonuses.plusTwo || draft.flexibleAbilityBonuses.plusOne) ? (
              <div className="lineage-preview-section">
                <span className="mini-heading">Flexible Bonus</span>
                <div className="lineage-preview-list">
                  {draft.flexibleAbilityBonuses.plusTwo ? (
                    <div className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name="spark" className="summary-icon" />
                        </span>
                        <strong>+2</strong>
                      </div>
                      <span>{draft.flexibleAbilityBonuses.plusTwo}</span>
                    </div>
                  ) : null}
                  {draft.flexibleAbilityBonuses.plusOne ? (
                    <div className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name="spark" className="summary-icon" />
                        </span>
                        <strong>+1</strong>
                      </div>
                      <span>{draft.flexibleAbilityBonuses.plusOne}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {(subracePreviewStats.length || subraceNonStatBonuses.length) ? (
              <div className="lineage-preview-section">
                <span className="mini-heading">Subrace</span>
                <div className="lineage-preview-list">
                  {subracePreviewStats.map((stat, index) => (
                    <div key={`${stat.label}-subrace-${index}-${stat.value}`} className="list-row lineage-preview-stat-row">
                      <div className="lineage-preview-stat-head">
                        <span className="summary-icon-wrap">
                          <AppIcon name={iconForLineageStat(stat.label)} className="summary-icon" />
                        </span>
                        <strong>{stat.label}</strong>
                      </div>
                      <span>{compactLineageStatValue(stat.label, stat.value)}</span>
                    </div>
                  ))}
                  {subraceNonStatBonuses.map((bonus, index) => (
                      <div key={`subrace-preview-bonus-${index}-${bonus}`} className="list-row lineage-preview-stat-row">
                        <div className="lineage-preview-stat-head">
                          <span className="summary-icon-wrap">
                            <AppIcon name="spark" className="summary-icon" />
                          </span>
                          <strong>Bonus</strong>
                        </div>
                        <span>{cleanImportedText(bonus)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            <div className="lineage-preview-section">
              <span className="mini-heading">Proficiencies</span>
              <div className="lineage-preview-list">
                <div className="list-row">
                  <strong>Weapons</strong>
                  <span>{draft.proficiencies.weapons.join(", ") || "None"}</span>
                </div>
                <div className="list-row">
                  <strong>Armour</strong>
                  <span>{draft.proficiencies.armor.join(", ") || "None"}</span>
                </div>
                <div className="list-row">
                  <strong>Skills</strong>
                  <span>
                    {draft.selectedSkillIds.length
                      ? draft.selectedSkillIds.map(skillLabel).join(", ")
                      : backgroundSkillIds.length
                        ? backgroundSkillIds.map(skillLabel).join(", ")
                        : "None"}
                  </span>
                </div>
              </div>
            </div>
          </article>
        </aside>

      </div>
    </div>
  );
}
