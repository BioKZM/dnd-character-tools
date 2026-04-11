"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CharacterDraft, AbilityId } from "@/lib/character/demo-sheet";
import type { ClassCuratedCollection } from "@/lib/content/class-curated-schema";
import type { WarlockOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection, ResolvedLineageEntry, SubraceEntry } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
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
  | "background"
  | "inventory"
  | "abilities"
  | "level"
  | "multiclass"
  | "subclass"
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

type LineageGroup = ResolvedLineageEntry & { icon: string };

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

function skillLabel(skillId: string) {
  return skillId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function abilityShortLabel(abilityId: string) {
  return abilityLabels[abilityId as AbilityId] ?? abilityId;
}

function formatEnglishList(values: string[]) {
  return values.length ? values.join(", ") : "None";
}

function classMatchesSpell(spell: ContentBundle["spells"][number], className: string) {
  return spell.classes?.includes(className) ?? false;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [arming, setArming] = useState(false);

  const clearHoverTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleEnter = () => {
    clearHoverTimer();
    setArming(true);
    timerRef.current = setTimeout(() => {
      setOpen(true);
      setArming(false);
    }, 1000);
  };

  const handleLeave = () => {
    clearHoverTimer();
    setArming(false);
    setOpen(false);
  };

  useEffect(() => () => clearHoverTimer(), []);

  return (
    <span
      className={`inline-help${variant === "keyword" ? " keyword-help" : ""}${arming ? " arming" : ""}${open ? " open" : ""}`}
      aria-label={`${label} info`}
      tabIndex={0}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span className={variant === "keyword" ? "keyword-help-trigger" : "inline-help-trigger"}>
        {variant === "keyword" ? label : "?"}
      </span>
      <span className={`inline-help-tooltip ${tooltipClassName}`}>{content}</span>
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

function isPreviewStatLabel(label: string) {
  return ["Ability Score Increase", "Size", "Speed", "Languages"].includes(label);
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
  switch (score) {
    case 6:
      return -2;
    case 7:
      return -1;
    case 8:
      return 0;
    case 9:
      return 1;
    case 10:
      return 2;
    case 11:
      return 3;
    case 12:
      return 4;
    case 13:
      return 5;
    case 14:
      return 7;
    case 15:
      return 9;
    default:
      return 0;
  }
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
  currentClassRules,
  classOptions,
  multiclassChoices,
  availableSubclassOptions,
  availableSpells,
  availableFeats,
  maxSpellLevel,
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
}) {
  const lineageGroups = mapLineageEntries(lineageCollection);
  const curatedClassMap = new Map(classCuratedCollection.entries.map((entry) => [entry.id, entry]));
  const [creatorBrowser, setCreatorBrowser] = useState<CreatorBrowser>("lineage");
  const initialLineageGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
  const initialSubrace = initialLineageGroup?.subraces.find((subrace) => subrace.id === draft.speciesId) ?? initialLineageGroup?.subraces[0] ?? null;
  const [selectedLineageId, setSelectedLineageId] = useState(initialLineageGroup?.id ?? "");
  const [selectedSubraceId, setSelectedSubraceId] = useState(initialSubrace?.id ?? "");
  const [lineagePage, setLineagePage] = useState(0);
  const [classTableExpanded, setClassTableExpanded] = useState(false);
  const [selectedClassFeatureId, setSelectedClassFeatureId] = useState<string | null>(null);
  const [selectedSubclassFeatureId, setSelectedSubclassFeatureId] = useState<string | null>(null);
  const [inventoryDraft, setInventoryDraft] = useState("");
  const [showUnavailableOptions, setShowUnavailableOptions] = useState(false);
  const [openWarlockGroup, setOpenWarlockGroup] = useState<"spells" | "pact" | "invocations">("spells");
  const [activeSpellFilter, setActiveSpellFilter] = useState<number | "all">("all");
  const [spellListPage, setSpellListPage] = useState(0);
  const [invocationPage, setInvocationPage] = useState(0);
  const [pactCantripPage, setPactCantripPage] = useState(0);
  const subclassUnlocked = draft.level >= subclassUnlockLevel;
  const classPreviewSummary = classProgressSummary(currentClass, draft.level);
  const speciesPreviewSummary = speciesBenefitSummary(currentSpecies, currentSpeciesRules?.notes);
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
  const subraceAbilityScoreIncreases = (currentSubraceEntry?.stats ?? []).filter(
    (stat) => stat.label === "Ability Score Increase",
  );
  const subracePreviewStats = (currentSubraceEntry?.stats ?? []).filter(
    (stat) => stat.label === "Size" || stat.label === "Speed" || stat.label === "Languages",
  );
  const subraceNonStatBonuses = currentSubraceEntry
    ? subraceBonuses(currentSubraceEntry, currentSpeciesRules?.notes).filter(
        (bonus) => !isDerivedPreviewBonus(bonus),
      )
    : [];
  const flexibleAbilityBonusSource = currentSubraceEntry?.flexibleAbilityScoreIncrease
    ? currentSubraceEntry.name
    : currentLineageGroup.flexibleAbilityScoreIncrease
      ? currentLineageGroup.name
      : null;
  const previewAbilityBonuses = [
    ...(currentLineageGroup.flexibleAbilityScoreIncrease
      ? []
      : lineageAbilityScoreIncreases.flatMap((stat) => parseAbilityScoreIncrease(stat.value))),
    ...(currentSubraceEntry?.flexibleAbilityScoreIncrease
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
  const lineagePageSize = 9;
  const lineagePageCount = Math.max(1, Math.ceil(lineageGroups.length / lineagePageSize));
  const currentCuratedClass = curatedClassMap.get(draft.classId) ?? null;
  const currentCuratedSubclasses = currentCuratedClass?.subclasses ?? [];
  const currentCuratedSubclass =
    currentCuratedSubclasses.find((entry) => draft.selectedSubclassOptions.includes(entry.id)) ??
    currentCuratedSubclasses[0] ??
    null;
  const warlockPactBoonOptions =
    currentClass.id === "warlock"
      ? (warlockOptions.pactBoon?.options.length ? warlockOptions.pactBoon.options : defaultWarlockPactBoons)
      : [];
  const patronSpellGrants =
    currentClass.id === "warlock"
      ? (currentCuratedSubclass?.expandedSpells ?? []).filter((entry) => draft.level >= entry.unlockLevel)
      : [];
  const patronSpellEntries = patronSpellGrants.flatMap((entry) =>
    entry.spells.map((spellName) => ({
      unlockLevel: entry.unlockLevel,
      name: spellName,
      spell:
        content.spells.find((spell) => spell.name.toLowerCase() === spellName.toLowerCase()) ?? null,
    })),
  );
  const subclassIntroLevel =
    currentCuratedClass?.spellcastingTable.rows.find((row) => row.some((cell) => cell.includes(currentCuratedClass.subclassHeading)))?.[0] ??
    null;
  const selectedClassFeature =
    currentCuratedClass?.classFeatures.find((feature) => feature.id === selectedClassFeatureId) ??
    currentCuratedClass?.classFeatures[0] ??
    null;
  const selectedSubclassFeature =
    currentCuratedSubclass?.features.find((feature) => feature.id === selectedSubclassFeatureId) ??
    currentCuratedSubclass?.features[0] ??
    null;
  const classTableRows = currentCuratedClass?.spellcastingTable.rows ?? [];
  const classTableHeaderRow = classTableRows[1] ?? [];
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
      const bySubclass = (spell.subclassOptions ?? []).some((option) =>
        draft.selectedSubclassOptions.includes(option),
      );

      return byClass || bySubclass;
    });
  }, [content.classes, content.spells, currentClass.name, draft.multiclassIds, draft.selectedSubclassOptions]);
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
  const spellLevelPages = [...new Set(visibleSpellCards.map((spell) => spell.level))].sort((left, right) => left - right);
  const activeSpellPool =
    activeSpellFilter === "all"
      ? visibleSpellCards
      : visibleSpellCards.filter((spell) => spell.level === activeSpellFilter);
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
  const pactCantripPageCount = Math.max(1, Math.ceil(pactTomeCantripPool.length / pactCantripPageSize));
  const pagedPactCantripCards = pactTomeCantripPool.slice(
    pactCantripPage * pactCantripPageSize,
    pactCantripPage * pactCantripPageSize + pactCantripPageSize,
  );
  const visibleSelectedInvocationCount = draft.selectedInvocationIds.filter((invocationId) =>
    visibleWarlockInvocations.some((option) => option.id === invocationId),
  ).length;
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
  const visibleClassTableRows = classTableExpanded ? classTableRows : classTableRows.slice(0, 8);
  const paginatedLineages = useMemo(() => {
    const start = lineagePage * lineagePageSize;
    return lineageGroups.slice(start, start + lineagePageSize);
  }, [lineageGroups, lineagePage]);
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

  useEffect(() => {
    const currentMenuItem = creatorMenu.find((item) => item.id === creatorBrowser);
    if (currentMenuItem?.step === creatorStep) {
      return;
    }

    setCreatorBrowser(defaultBrowserForStep(creatorStep));
  }, [creatorBrowser, creatorStep]);

  useEffect(() => {
    const matchedGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
    setSelectedLineageId((current) => current || matchedGroup?.id || "");
    setSelectedSubraceId((current) => current || matchedGroup?.subraces[0]?.id || "");
  }, [draft.speciesId, lineageGroups]);

  useEffect(() => {
    setLineagePage((current) => Math.min(current, Math.max(0, lineagePageCount - 1)));
  }, [lineagePageCount]);

  useEffect(() => {
    setClassTableExpanded(false);
    setSelectedClassFeatureId(currentCuratedClass?.classFeatures[0]?.id ?? null);
  }, [currentCuratedClass?.id]);

  useEffect(() => {
    setSelectedSubclassFeatureId(currentCuratedSubclass?.features[0]?.id ?? null);
  }, [currentCuratedSubclass?.id]);

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
    const selectedIndex = lineageGroups.findIndex((entry) => entry.id === group.id);
    if (selectedIndex >= 0) {
      setLineagePage(Math.floor(selectedIndex / lineagePageSize));
    }

    if (firstSubrace && content.species.some((item) => item.id === firstSubrace.id)) {
      updateDraft((current) => ({ ...current, speciesId: firstSubrace.id }));
    }
  };

  const selectSubrace = (subraceId: string) => {
    setSelectedSubraceId(subraceId);
    if (content.species.some((item) => item.id === subraceId)) {
      updateDraft((current) => ({ ...current, speciesId: subraceId }));
    }
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

      <section className="creator-stage">
        <div className="creator-stage-copy">
          <span className="eyebrow">Character Creation</span>
          <h3>{creatorPageLabels[creatorStep]}</h3>
          <p>{stepDescription(creatorStep)}</p>
        </div>
        <div className="creator-stage-summary">
          <article className="creator-stage-card">
            <span className="mini-heading">Identity</span>
            <strong>{draft.name || "Yeni karakter"}</strong>
            <span>{currentBackground.name} ile başlayan başlangıç hikâyesi.</span>
          </article>
          <article className="creator-stage-card">
            <span className="mini-heading">Species</span>
            <strong>{currentSpecies.name}</strong>
            <span>{speciesPreviewSummary}</span>
          </article>
          <article className="creator-stage-card">
            <span className="mini-heading">Class</span>
            <strong>{currentClass.name}</strong>
            <span>{classPreviewSummary}</span>
          </article>
        </div>
      </section>

      <div className="creator-pagination">
        <button
          className="sheet-button secondary creator-arrow"
          disabled={creatorStep === 0}
          onClick={() => moveCreatorStep(Math.max(0, creatorStep - 1) as CreatorStep)}
          type="button"
        >
          <span aria-hidden="true">&larr;</span>
        </button>
        <div className="creator-pagination-center">
          <strong>{creatorPageLabels[creatorStep]}</strong>
          <span>
            {creatorStep + 1} / {creatorPageLabels.length}
          </span>
        </div>
        <button
          className="sheet-button secondary creator-arrow"
          disabled={creatorStep === 2}
          onClick={() => moveCreatorStep(Math.min(2, creatorStep + 1) as CreatorStep)}
          type="button"
        >
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>

      <div className="creator-progress-track">
        {creatorPageLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            className={creatorStep === index ? "creator-progress-dot active" : "creator-progress-dot"}
            onClick={() => moveCreatorStep(index as CreatorStep)}
            aria-label={label}
          />
        ))}
      </div>

      <div className="creator-workbench creator-workbench-navigation">
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
                <button
                  key={item.id}
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
              ))}
            </div>
          </article>
        </aside>

        <div className="creator-main-panel creator-main-panel-clean">
          {creatorBrowser === "identity" ? (
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
                  <div className="creator-panel creator-panel-tight">
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
                <div className="point-buy-summary">
                  <div className="list-row">
                    <strong>Identity Preview</strong>
                    <span>{`${draft.name || "Unnamed Character"} • Level ${draft.level} • ${currentClass.name}`}</span>
                  </div>
                  <div className="list-row">
                    <strong>Dynamic Progression</strong>
                    <span>{levelProgressDescription(draft.level, maxSpellLevel)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {creatorBrowser === "lineage" ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide">
                <div className="identity-browser-head">
                  <span className="mini-heading creator-section-label">Race Selection</span>
                  <div className="lineage-grid-controls">
                    <button
                      type="button"
                      className="sheet-button secondary lineage-page-button"
                      onClick={() => setLineagePage((current) => Math.max(0, current - 1))}
                      disabled={lineagePage === 0}
                    >
                      <span aria-hidden="true">&larr;</span>
                    </button>
                    <span className="lineage-page-indicator">
                      {lineagePage + 1} / {lineagePageCount}
                    </span>
                    <button
                      type="button"
                      className="sheet-button secondary lineage-page-button"
                      onClick={() => setLineagePage((current) => Math.min(lineagePageCount - 1, current + 1))}
                      disabled={lineagePage >= lineagePageCount - 1}
                    >
                      <span aria-hidden="true">&rarr;</span>
                    </button>
                  </div>
                </div>
                <div className="lineage-grid">
                  {paginatedLineages.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      className={currentLineageGroup.id === group.id ? "lineage-grid-card active" : "lineage-grid-card"}
                      onClick={() => selectLineage(group.id)}
                    >
                      <span className="lineage-grid-icon">
                        <AppIcon name={group.icon as Parameters<typeof AppIcon>[0]["name"]} className="summary-icon lineage-grid-icon-inner" />
                      </span>
                      <strong>{group.name}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="identity-detail-grid">
                <article className="creator-panel identity-detail-panel">
                  <div className="identity-detail-head">
                    <span className="mini-heading creator-section-label">Core Race Traits</span>
                    <h4>{currentLineageGroup.name}</h4>
                  </div>
                  <p className="identity-detail-copy">{currentLineageGroup.summary}</p>
                  {(lineagePreviewStats.length || lineageAbilityScoreIncreases.length) ? (
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
                  ) : null}
                  <div className="identity-trait-list">
                    {currentLineageGroup.coreBonuses
                      .filter((bonus) => !isPreviewStatLabel(bonus.split(".")[0] ?? ""))
                      .map((bonus, index) => (
                      <div key={`${currentLineageGroup.id}-bonus-${index}-${bonus}`} className="identity-trait-item">
                        <strong>{bonus}</strong>
                        <span>{currentLineageGroup.name} için ortak lineage avantajı.</span>
                      </div>
                    ))}
                    {currentLineageGroup.coreTraits.map((trait, index) => (
                      <div key={`${currentLineageGroup.id}-trait-${index}-${trait.id}`} className="identity-trait-item">
                        <strong>{trait.name}</strong>
                        <span>{cleanImportedText(trait.summary)}</span>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          ) : null}

          {creatorBrowser === "subrace" ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide">
                <div className="identity-browser-head">
                  <span className="mini-heading creator-section-label">Subrace Selection</span>
                </div>
                {availableSubraces.length ? (
                  <div className="identity-choice-list subrace-choice-list">
                    {availableSubraces.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={currentSubraceEntry?.id === item.id ? "selection-card active" : "selection-card"}
                        onClick={() => selectSubrace(item.id)}
                      >
                        <strong>{item.name}</strong>
                        {!content.species.some((species) => species.id === item.id) ? (
                          <div className="selection-meta-stack">
                            <span>Bu alt ırk creator draft sistemine henüz bağlı değil.</span>
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="list-row">
                    <strong>No subrace found</strong>
                    <span>{subraceEmptyPrompt(currentLineageGroup.name)}</span>
                  </div>
                )}
              </div>

              <div className="identity-detail-grid">
                <article className="creator-panel identity-detail-panel">
                  <div className="identity-detail-head">
                    <span className="mini-heading creator-section-label">Selected Subrace</span>
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
                      {(currentSubraceEntry.stats.length || subraceNonStatBonuses.length) ? (
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
                      ) : null}
                      <div className="identity-trait-list">
                        {currentSubraceEntry.traits.map((trait, index) => (
                          <div key={`${currentSubraceEntry.id}-trait-${index}-${trait.id}`} className="identity-trait-item">
                            <strong>{trait.name}</strong>
                            <span>{cleanImportedText(trait.summary)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </article>
              </div>
            </div>
          ) : null}

          {creatorBrowser === "class" || creatorBrowser === "subclass" || creatorBrowser === "background" || creatorBrowser === "inventory" || creatorBrowser === "skill-spells" ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide">
                <span className="mini-heading">{browserTitle(creatorBrowser)}</span>
              </div>

              <div className="creator-panel creator-panel-wide">
                <div className="creator-inline-list">
                  <div className="list-row"><strong>Class</strong><span>{currentClass.name}</span></div>
                  <div className="list-row"><strong>Level</strong><span>{`Level ${draft.level}`}</span></div>
                  <div className="list-row"><strong>Subclass</strong><span>{subclassUnlocked ? `${draft.selectedSubclassOptions.length} seçim` : `Level ${subclassUnlockLevel} bekleniyor`}</span></div>
                  <div className="list-row"><strong>Spell erişimi</strong><span>{maxSpellLevel ? `En yüksek Spell seviyesi ${maxSpellLevel}` : "Henüz Spell erişimi yok"}</span></div>
                </div>
              </div>

              <div className="creator-panel creator-panel-wide">
                {creatorBrowser === "class" ? (
                  <div className="creator-stack">
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

                    <article className="creator-panel identity-detail-panel">
                      <div className="identity-detail-head">
                        <span className="mini-heading creator-section-label">Class Overview</span>
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
                        <div className="class-table-card">
                          <div className="identity-detail-head compact">
                            <span className="mini-heading creator-section-label">Progression</span>
                            {classTableRows.length > 8 ? (
                              <button
                                type="button"
                                className="sheet-button secondary class-table-toggle"
                                onClick={() => setClassTableExpanded((current) => !current)}
                              >
                                {classTableExpanded ? "Collapse table" : "Expand table"}
                              </button>
                            ) : null}
                          </div>
                          <div className="class-progression-scroll">
                            <table className="class-progression-table">
                              <tbody>
                                {visibleClassTableRows.map((row, rowIndex) => (
                                  <tr key={`${currentCuratedClass.id}-row-${rowIndex}`}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={`${currentCuratedClass.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {currentCuratedClass?.classFeatures.length ? (
                        <div className="class-feature-layout">
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
                            <article className="identity-trait-item class-feature-detail">
                              <strong>{selectedClassFeature.name}</strong>
                              <span>{selectedClassFeature.summary}</span>
                            </article>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  </div>
                ) : null}

                {creatorBrowser === "subclass" ? (
                  <div className="creator-stack">
                    {!subclassUnlocked ? (
                      <div className="list-row"><strong>Subclass henüz kilitli</strong><span>Bu creator akışında Subclass seçimi Level {subclassUnlockLevel} ile açılır. Şu an Level {draft.level} görünüyorsun.</span></div>
                    ) : currentCuratedSubclasses.length ? (
                      <>
                        <div className="identity-choice-list subrace-choice-list">
                          {currentCuratedSubclasses.map((entry) => (
                            <button
                              type="button"
                              key={entry.id}
                              className={draft.selectedSubclassOptions.includes(entry.id) ? "selection-card active" : "selection-card"}
                              onClick={() =>
                                updateDraft((current) => ({
                                  ...current,
                                  selectedSubclassOptions: [entry.id],
                                }))
                              }
                            >
                              <strong>{entry.name}</strong>
                            </button>
                          ))}
                        </div>

                        <article className="creator-panel identity-detail-panel">
                          <div className="identity-detail-head">
                            <span className="mini-heading creator-section-label">{currentCuratedClass?.subclassHeading ?? "Subclass"}</span>
                            <h4>
                              {currentCuratedSubclass?.name ??
                                "Subclass"}
                            </h4>
                          </div>
                          {currentCuratedClass?.subclassHeading ? (
                            <div className="list-row compact-info-row">
                              <strong>{currentCuratedClass.subclassHeading}</strong>
                              <span>
                                {subclassIntroLevel
                                  ? `This class's subclass path opens at ${subclassIntroLevel}.`
                                  : "This is the subclass path for the selected class."}
                              </span>
                            </div>
                          ) : null}
                          {currentCuratedSubclass?.summary ? (
                            <p className="identity-detail-copy">{currentCuratedSubclass.summary}</p>
                          ) : null}
                          <div className="lineage-detail-meta-grid">
                            {currentCuratedSubclass ? (
                              <div key={`${currentCuratedSubclass.id}-source`} className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="book" className="summary-icon" />
                                  </span>
                                </div>
                                <span>{currentCuratedSubclass.source}</span>
                              </div>
                            ) : null}
                          </div>
                          {currentCuratedSubclass?.features.length ? (
                            <div className="class-feature-layout">
                              <div className="class-feature-list">
                                {currentCuratedSubclass.features.map((feature) => (
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
                                <article className="identity-trait-item class-feature-detail">
                                  <strong>{selectedSubclassFeature.name}</strong>
                                  <span>{selectedSubclassFeature.summary}</span>
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
                  </div>
                ) : null}

                {creatorBrowser === "background" ? (
                  <div className="creator-picker-scroll creator-inline-browser">
                    {content.backgrounds.map((item) => {
                      const metaItems = backgroundMetaDescription(item);

                      return (
                        <button
                          type="button"
                          key={item.id}
                          className={draft.backgroundId === item.id ? "selection-card active background-selection-card" : "selection-card background-selection-card"}
                          onClick={() => updateDraft((current) => ({ ...current, backgroundId: item.id }))}
                        >
                          <div className="background-card-head">
                            <span className="mini-heading">Background</span>
                            <strong>{item.name}</strong>
                          </div>
                          {backgroundDescription(item) ? (
                            <div className="background-card-section">
                              <span className="background-card-label">Overview</span>
                              <p className="selection-description">{backgroundDescription(item)}</p>
                            </div>
                          ) : null}
                          {metaItems.length ? (
                            <div className="background-card-section background-card-meta">
                              <span className="background-card-label">Proficiencies</span>
                              <div className="selection-meta-stack">
                                {metaItems.map((meta) => (
                                  <span key={`${item.id}-${meta}`} className="background-meta-item">
                                    <AppIcon
                                      name={
                                        meta.startsWith("Skill Proficiencies")
                                          ? "skill"
                                          : meta.startsWith("Tool Proficiencies")
                                            ? "wand"
                                            : "book"
                                      }
                                      className="chip-icon"
                                    />
                                    <span>{meta}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {creatorBrowser === "inventory" ? (
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
                ) : null}

                {creatorBrowser === "skill-spells" ? (
                  <div className="creator-split-browser">
                    <div className="creator-inline-list">
                      <div className="list-row"><strong>Languages</strong><span>{draft.proficiencies.languages.join(", ") || "None"}</span></div>
                      <div className="list-row"><strong>Tools</strong><span>{draft.proficiencies.tools.join(", ") || "None"}</span></div>
                      <div className="list-row"><strong>Weapons</strong><span>{draft.proficiencies.weapons.join(", ") || "None"}</span></div>
                      <div className="list-row"><strong>Background Skills</strong><span>{backgroundSkillIds.map(skillLabel).join(", ") || "None"}</span></div>
                    </div>
                    <div className="skill-spell-layout">
                      <section className="skill-spell-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label">Skills</span>
                        </div>
                        <div className="skill-choice-grid">
                        {(currentClassRules?.skillChoices ?? []).map((skillId) => {
                          const skillEntry = draft.skills.find((skill) => skill.id === skillId);
                          return (
                            <label className="selection-card choice-card skill-spell-card" key={skillId}>
                              <input type="checkbox" className="visually-hidden" checked={draft.selectedSkillIds.includes(skillId)} onChange={() => toggleSkillSelection(skillId)} />
                              <div className="skill-spell-card-head">
                                <strong>{skillLabel(skillId)}</strong>
                                {skillEntry?.description ? (
                                  <span className="inline-help" aria-label={`${skillLabel(skillId)} info`} tabIndex={0}>?
                                    <span className="inline-help-tooltip">{skillEntry.description}</span>
                                  </span>
                                ) : null}
                              </div>
                              <div className="skill-spell-card-meta">
                                <span>{abilityLabels[skillAbilities[skillId] ?? "INT"]}</span>
                                <span>{`Choose ${currentClassRules?.skillChoiceCount ?? 2}`}</span>
                                {skillEntry?.proficient ? <span>{`Prof +${draft.proficiencyBonus}`}</span> : null}
                                {skillEntry?.breakdown ? <span>{skillEntry.breakdown}</span> : null}
                              </div>
                            </label>
                          );
                        })}
                        </div>
                      </section>
                      <section className="skill-spell-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label">Spells & Invocations</span>
                        </div>
                        {skillSpellOverviewRows.length ? (
                          <div className="spell-access-card">
                            <div className="spell-access-head">
                              <strong>Spell Access Overview</strong>
                              <span>{`${currentClass.name}${currentCuratedSubclass ? ` • ${currentCuratedSubclass.name}` : ""} • Level ${draft.level}`}</span>
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
                                  {currentCuratedSubclass && patronSpellEntries.length ? (
                                    <div className="creator-inline-list">
                                      <div className="list-row">
                                        <strong>{`${currentCuratedSubclass.name} Patron Spells`}</strong>
                                        <span>Auto added from Pact Magic</span>
                                      </div>
                                      <div className="patron-spell-list">
                                        {patronSpellEntries.map((entry) => (
                                          <div className="patron-spell-row" key={`${currentCuratedSubclass.id}-${entry.unlockLevel}-${entry.name}`}>
                                            <strong>
                                              <HoverTooltip label={entry.name} content={
                                                <>
                                                <span className="spell-tooltip-head">
                                                  <span className="spell-tooltip-class">
                                                    <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                    <ClassEmblem classId={currentClass.id} className="spell-tooltip-emblem" />
                                                    <span>{currentCuratedSubclass.name}</span>
                                                  </span>
                                                  <strong>{entry.name}</strong>
                                                </span>
                                                <span className="spell-tooltip-meta">
                                                  <span>{`Unlocked at Warlock ${entry.unlockLevel}`}</span>
                                                  <span>{currentCuratedSubclass.name}</span>
                                                  <span>Pact Magic</span>
                                                </span>
                                                <span className="spell-tooltip-copy">{entry.spell?.summary ?? `${entry.name} is granted by your patron and added automatically to your warlock spell list.`}</span>
                                                </>
                                            } />
                                            </strong>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                  {spellLevelPages.length ? (
                                    <div className="compact-pagination-row centered">
                                      <div className="pagination-tabs">
                                        <button type="button" className={activeSpellFilter === "all" ? "pagination-tab active" : "pagination-tab"} onClick={() => { setActiveSpellFilter("all"); setSpellListPage(0); }}>All</button>
                                        {spellLevelPages.map((level) => (
                                          <button type="button" key={`spell-level-page-${level}`} className={activeSpellFilter === level ? "pagination-tab active" : "pagination-tab"} onClick={() => { setActiveSpellFilter(level); setSpellListPage(0); }}>
                                            {level === 0 ? "Cantrip" : `Level ${level}`}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="pagination-mini-controls">
                                        <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.max(0, current - 1))} disabled={spellListPage === 0}>‹</button>
                                        <span className="pagination-indicator">{`${spellListPage + 1} / ${spellPageCount}`}</span>
                                        <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.min(spellPageCount - 1, current + 1))} disabled={spellListPage >= spellPageCount - 1}>›</button>
                                      </div>
                                    </div>
                                  ) : null}
                                  <div className="compact-option-list graph-list">
                                    {pagedSpellCards.length ? pagedSpellCards.map((spell) => {
                                      const isUnlocked = availableSpells.some((availableSpell) => availableSpell.id === spell.id);
                                      return (
                                        <label className={draft.spellIds.includes(spell.id) ? `spell-list-item compact list-rowish graph active${isUnlocked ? "" : " disabled"}` : `spell-list-item compact list-rowish graph${isUnlocked ? "" : " disabled"}`} key={spell.id}>
                                          <input type="checkbox" className="visually-hidden" checked={draft.spellIds.includes(spell.id)} disabled={!isUnlocked} onChange={() => toggleSelection("spellIds", spell.id)} />
                                          <div className="spell-list-top">
                                            <div className="spell-list-name">
                                              <strong>
                                                <HoverTooltip label={spell.name} content={
                                                  <>
                                                  <span className="spell-tooltip-head">
                                                    <span className="spell-tooltip-class">
                                                      <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                      <ClassEmblem classId={currentClass.id} className="spell-tooltip-emblem" />
                                                      <span>{currentClass.name}</span>
                                                    </span>
                                                    <strong>{spell.name}</strong>
                                                  </span>
                                                  <span className="spell-tooltip-meta">
                                                    <span>{`Level ${spell.level}`}</span>
                                                    <span>{spell.school}</span>
                                                    <span>{spell.castingTime}</span>
                                                    {currentClass.id === "warlock" && spell.level > 0 && currentWarlockSlotLevelNumber && spell.level < currentWarlockSlotLevelNumber ? (
                                                      <span>{`Casts at ${currentWarlockSlotLevel}`}</span>
                                                    ) : null}
                                                  </span>
                                                  <span className="spell-tooltip-copy">{spell.summary}</span>
                                                  <span className="spell-tooltip-meta spell-tooltip-meta-secondary">
                                                    {spellMetaLines(spell).map((line) => (
                                                      <span key={`${spell.id}-tooltip-${line}`}>{line}</span>
                                                    ))}
                                                  </span>
                                                  </>
                                                } />
                                              </strong>
                                            </div>
                                          </div>
                                          <div className="spell-list-primary">
                                            <span>{`Level ${spell.level}`}</span>
                                            <span>{spell.school}</span>
                                            {currentClass.id === "warlock" && spell.level > 0 && currentWarlockSlotLevelNumber && spell.level < currentWarlockSlotLevelNumber ? (
                                              <span>{`Scales to ${currentWarlockSlotLevel}`}</span>
                                            ) : null}
                                            {spellDamageChip(spell) ? (
                                              <span className="damage-chip">
                                                <AppIcon name="dice" className="damage-chip-icon" />
                                                {spellDamageChip(spell)}
                                              </span>
                                            ) : null}
                                          </div>
                                        </label>
                                      );
                                    }) : <div className="list-row"><strong>Görünen Spell yok</strong><span>Mevcut filtre ve level için burada bir Spell açılmıyor.</span></div>}
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
                                      <div className="compact-pagination-row centered">
                                        <button type="button" className="pagination-arrow" onClick={() => setPactCantripPage((current) => Math.max(0, current - 1))} disabled={pactCantripPage === 0}>‹</button>
                                        <span className="pagination-indicator">{`${pactCantripPage + 1} / ${pactCantripPageCount}`}</span>
                                        <button type="button" className="pagination-arrow" onClick={() => setPactCantripPage((current) => Math.min(pactCantripPageCount - 1, current + 1))} disabled={pactCantripPage >= pactCantripPageCount - 1}>›</button>
                                      </div>
                                      <div className="compact-option-list graph-list">
                                        {pagedPactCantripCards.map((spell) => (
                                          <label className={draft.selectedPactCantripIds.includes(spell.id) ? "spell-list-item compact list-rowish graph active" : `spell-list-item compact list-rowish graph${!draft.selectedPactCantripIds.includes(spell.id) && draft.selectedPactCantripIds.length >= 3 ? " disabled" : ""}`} key={`tome-cantrip-${spell.id}`}>
                                            <input type="checkbox" className="visually-hidden" checked={draft.selectedPactCantripIds.includes(spell.id)} disabled={!draft.selectedPactCantripIds.includes(spell.id) && draft.selectedPactCantripIds.length >= 3} onChange={() => togglePactCantripSelection(spell.id)} />
                                            <div className="spell-list-top">
                                              <div className="spell-list-name">
                                                <strong>
                                                  <HoverTooltip label={spell.name} content={
                                                    <>
                                                    <span className="spell-tooltip-head">
                                                      <span className="spell-tooltip-class">
                                                        <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                        <ClassEmblem classId={currentClass.id} className="spell-tooltip-emblem" />
                                                        <span>Book of Shadows</span>
                                                      </span>
                                                      <strong>{spell.name}</strong>
                                                    </span>
                                                    <span className="spell-tooltip-meta">
                                                      <span>Cantrip</span>
                                                      <span>Any Class</span>
                                                      <span>Pact of the Tome</span>
                                                    </span>
                                                    <span className="spell-tooltip-copy">{spell.summary}</span>
                                                    </>
                                                } />
                                                </strong>
                                              </div>
                                            </div>
                                            <div className="spell-list-primary">
                                              <span>Cantrip</span>
                                              <span>Book</span>
                                              {spellDamageChip(spell) ? (
                                                <span className="damage-chip">
                                                  <AppIcon name="dice" className="damage-chip-icon" />
                                                  {spellDamageChip(spell)}
                                                </span>
                                              ) : null}
                                            </div>
                                          </label>
                                        ))}
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
                                          <label className={draft.selectedInvocationIds.includes(option.id) ? `spell-list-item compact list-rowish graph active${isUnlocked ? "" : " disabled"}` : `spell-list-item compact list-rowish graph${isUnlocked ? "" : " disabled"}`} key={option.id}>
                                            <input type="checkbox" className="visually-hidden" checked={draft.selectedInvocationIds.includes(option.id)} disabled={!isUnlocked} onChange={() => toggleInvocationSelection(option.id)} />
                                            <div className="spell-list-top">
                                              <div className="spell-list-name">
                                                <strong>
                                                  <HoverTooltip label={option.name} content={
                                                    <>
                                                    <span className="spell-tooltip-head">
                                                      <span className="spell-tooltip-class">
                                                        <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                        <ClassEmblem classId={currentClass.id} className="spell-tooltip-emblem" />
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
                                            </div>
                                            {damageChipFromText(parsed.description) ? (
                                              <div className="spell-list-primary">
                                                <span className="damage-chip">
                                                  <AppIcon name="dice" className="damage-chip-icon" />
                                                  {damageChipFromText(parsed.description)}
                                                </span>
                                              </div>
                                            ) : null}
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
                            {spellLevelPages.length ? (
                              <div className="compact-pagination-row centered">
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
                            ) : null}
                            <div className="compact-option-list graph-list">
                              {pagedSpellCards.length ? pagedSpellCards.map((spell) => {
                                const isUnlocked = availableSpells.some((availableSpell) => availableSpell.id === spell.id);
                                return (
                                  <label className={draft.spellIds.includes(spell.id) ? `spell-list-item compact list-rowish graph active${isUnlocked ? "" : " disabled"}` : `spell-list-item compact list-rowish graph${isUnlocked ? "" : " disabled"}`} key={spell.id}>
                                    <input type="checkbox" className="visually-hidden" checked={draft.spellIds.includes(spell.id)} disabled={!isUnlocked} onChange={() => toggleSelection("spellIds", spell.id)} />
                                    <div className="spell-list-top">
                                      <div className="spell-list-name">
                                        <strong>
                                          <HoverTooltip label={spell.name} content={
                                            <>
                                            <span className="spell-tooltip-head">
                                              <span className="spell-tooltip-class">
                                                <ClassPortrait classId={currentClass.id} alt={currentClass.name} className="spell-tooltip-portrait" />
                                                <ClassEmblem classId={currentClass.id} className="spell-tooltip-emblem" />
                                                <span>{currentClass.name}</span>
                                              </span>
                                              <strong>{spell.name}</strong>
                                            </span>
                                            <span className="spell-tooltip-meta">
                                              <span>{`Level ${spell.level}`}</span>
                                              <span>{spell.school}</span>
                                              <span>{spell.castingTime}</span>
                                              {currentClass.id === "warlock" && spell.level > 0 && currentWarlockSlotLevelNumber && spell.level < currentWarlockSlotLevelNumber ? (
                                                <span>{`Casts at ${currentWarlockSlotLevel}`}</span>
                                              ) : null}
                                            </span>
                                            <span className="spell-tooltip-copy">{spell.summary}</span>
                                            <span className="spell-tooltip-meta spell-tooltip-meta-secondary">
                                              {spellMetaLines(spell).map((line) => (
                                                <span key={`${spell.id}-tooltip-${line}`}>{line}</span>
                                              ))}
                                            </span>
                                            </>
                                        } />
                                        </strong>
                                      </div>
                                    </div>
                                    <div className="spell-list-primary">
                                      <span>{`Level ${spell.level}`}</span>
                                      <span>{spell.school}</span>
                                      {currentClass.id === "warlock" && spell.level > 0 && currentWarlockSlotLevelNumber && spell.level < currentWarlockSlotLevelNumber ? (
                                        <span>{`Scales to ${currentWarlockSlotLevel}`}</span>
                                      ) : null}
                                      {spellDamageChip(spell) ? (
                                        <span className="damage-chip">
                                          <AppIcon name="dice" className="damage-chip-icon" />
                                          {spellDamageChip(spell)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </label>
                                );
                              }) : <div className="list-row"><strong>Görünen Spell yok</strong><span>Mevcut filtre ve level için burada bir Spell açılmıyor.</span></div>}
                            </div>
                          </div>
                        ) : null}
                      </section>
                    </div>
                  </div>
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
                    <span>{`27 points | Remaining ${pointBuyRemaining}`}</span>
                  </div>
                </div>
                {flexibleAbilityBonusSource ? (
                  <div className="flexible-bonus-panel compact">
                    <div className="list-row">
                      <strong>Flexible Ability Score Increase</strong>
                      <span>{`${flexibleAbilityBonusSource} lets you assign one +2 and one +1 to different abilities.`}</span>
                    </div>
                  </div>
                ) : null}
                <div className="ability-pointbuy-grid">
                  {previewAbilities.map((ability) => {
                    const canDecrease = ability.score > 6;
                    const nextCost = pointBuyStepCost(ability.score, ability.score + 1);
                    const canIncrease = ability.score < 15 && pointBuyRemaining >= nextCost;

                    return (
                      <article className="ability-pointbuy-card" key={ability.id}>
                        <div className="ability-pointbuy-head">
                          <div className="ability-pointbuy-head-main">
                            <span>{ability.id}</span>
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
                          <strong>{ability.label}</strong>
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
                          <button type="button" className="sheet-button secondary" disabled={!canDecrease} onClick={() => updateAbility(ability.id, Math.max(6, ability.score - 1))}>-</button>
                          <span>{`${pointBuyCost(ability.score)} pts`}</span>
                          <button type="button" className="sheet-button secondary" disabled={!canIncrease} onClick={() => updateAbility(ability.id, Math.min(15, ability.score + 1))}>+</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="creator-rail creator-rail-static">
                <div className={summaryCardClass(creatorBrowser, null, true)}>
                  <span className="summary-icon-wrap"><AppIcon name="shield" className="summary-icon" /></span>
                  <span className="summary-copy">
                    <span className="mini-heading inline-heading">
                      <span>Proficiency</span>
                      <span className="inline-help" aria-label="Proficiency yardım" tabIndex={0}>?
                        <span className="inline-help-tooltip">Proficiency, eğitim aldığın saving throw, skill, tool, weapon veya armor kullanımlarında bonusunu eklemeni sağlar.</span>
                      </span>
                    </span>
                    <strong>{draft.proficiencyBonus >= 0 ? `+${draft.proficiencyBonus}` : draft.proficiencyBonus}</strong>
                    <small>Level ile artan bonus</small>
                  </span>
                </div>
                <div className={summaryCardClass(creatorBrowser, null, true)}><span className="summary-icon-wrap"><AppIcon name="shield" className="summary-icon" /></span><span className="summary-copy"><span className="mini-heading">Armor Class</span><strong>{draft.armorClass}</strong><small>Mevcut build tahmini</small></span></div>
                <div className={summaryCardClass(creatorBrowser, null, true)}><span className="summary-icon-wrap"><AppIcon name="spark" className="summary-icon" /></span><span className="summary-copy"><span className="mini-heading">Initiative</span><strong>{draft.initiative >= 0 ? `+${draft.initiative}` : draft.initiative}</strong><small>Dexterity tabanlı</small></span></div>
                <div className={summaryCardClass(creatorBrowser, null, true)}><span className="summary-icon-wrap"><AppIcon name="skill" className="summary-icon" /></span><span className="summary-copy"><span className="mini-heading">Prepared Skills</span><strong>{draft.skills.filter((skill) => skill.proficient).length}</strong><small>Proficient kayıtlar</small></span></div>
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
                  <span key={ability.id}>{ability.id}</span>
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
