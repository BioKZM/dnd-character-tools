"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { CharacterDraft, AbilityId } from "@/lib/character/demo-sheet";
import { eldritchKnightProgression, getEldritchKnightProgression } from "@/lib/character/eldritch-knight";
import type { LineageCatalog, LineageChoiceGroup, LineageChoiceOption, LineageEntry as StructuredLineageEntry, LineageFeature as StructuredLineageFeature, Sublineage as StructuredSublineage } from "@/lib/data/lineages/schema";
import type { ClassDocBlock, ClassDocCollection, ClassDocSection, ClassDocTable } from "@/lib/content/class-docs";
import type { ClassCuratedCollection, ClassCuratedFeature, ClassJourneyStage, ClassStartingEquipmentGroup } from "@/lib/content/class-curated-schema";
import type { ClassOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection, ResolvedLineageEntry, SubraceEntry } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { SpellReferenceCollection, SpellReferenceEntry } from "@/lib/content/spell-reference";
import { AppIcon } from "@/components/ui/app-icon";
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
  | "lineage-choices"
  | "class"
  | "class-features"
  | "subclass-features"
  | "ranger-choices"
  | "fighter-fighting-style"
  | "fighter-asi"
  | "warlock-pact"
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

type FighterJourneyScene =
  | "fighter-class"
  | "fighter-features"
  | "fighter-equipment"
  | "fighter-style"
  | "fighter-asi"
  | "fighter-subclass"
  | "fighter-eldritch"
  | "warlock-spells"
  | "warlock-pact";

type SidebarNavEntry =
  | {
      type: "item";
      id: CreatorBrowser;
      label: string;
      step: CreatorStep;
    }
  | {
      type: "divider";
      id: string;
      label: string;
    };

function isSidebarNavItem(
  entry: SidebarNavEntry,
): entry is Extract<SidebarNavEntry, { type: "item" }> {
  return entry.type === "item";
}

function findSidebarNavItem(
  entries: SidebarNavEntry[],
  browser: CreatorBrowser,
): Extract<SidebarNavEntry, { type: "item" }> | undefined {
  return entries.find(
    (entry): entry is Extract<SidebarNavEntry, { type: "item" }> =>
      isSidebarNavItem(entry) && entry.id === browser,
  );
}

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

const creatorPageLabels = ["Origin", "Class", "Ability"] as const;
const fighterJourneySceneOrder: FighterJourneyScene[] = [
  "fighter-class",
  "fighter-features",
  "fighter-equipment",
  "fighter-style",
  "fighter-asi",
  "fighter-subclass",
  "warlock-pact",
  "warlock-spells",
  "fighter-eldritch",
];
const defaultSubclassUnlockLevel = 3;
function subclassUnlockLevelForClass(classId: string) {
  return classId === "warlock" ? 1 : defaultSubclassUnlockLevel;
}
const spellbookPageSize = 15;
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
const rangerFightingStyleOptionData = [
  {
    id: "archery",
    name: "Archery",
    shortLabel: "+2 ranged attack rolls",
    keyFacts: ["Works with ranged weapons.", "Improves attack rolls, not damage."],
    summary: "You gain a +2 bonus to attack rolls you make with ranged weapons.",
  },
  {
    id: "blind-fighting",
    name: "Blind Fighting",
    shortLabel: "10 ft blindsight",
    keyFacts: ["Grants blindsight out to 10 feet.", "Lets you perceive creatures in darkness or invisibility unless they successfully hide."],
    summary: "You have blind sight with a range of 10 feet. Within that range, you can effectively see anything that isn't behind total cover, even if you're blinded or in darkness. Moreover, you can see an invisible creature within that range, unless the creature successfully hides from you.",
  },
  {
    id: "defense",
    name: "Defense",
    shortLabel: "+1 AC while armored",
    keyFacts: ["Only works while wearing armor.", "Applies a flat +1 AC bonus."],
    summary: "While you are wearing armor, you gain a +1 bonus to AC.",
  },
  {
    id: "druidic-warrior",
    name: "Druidic Warrior",
    shortLabel: "Two druid cantrips",
    keyFacts: ["Learn two cantrips from the Druid spell list.", "They count as ranger spells for you.", "Wisdom is your spellcasting ability for them."],
    summary: "You learn two cantrips of your choice from the Druid spell list. They count as ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a level in this class, you can replace one of these cantrips with another cantrip from the Druid spell list.",
  },
  {
    id: "dueling",
    name: "Dueling",
    shortLabel: "+2 one-handed weapon damage",
    keyFacts: ["Requires a melee weapon in one hand.", "Requires no other weapons."],
    summary: "When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.",
  },
  {
    id: "thrown-weapon-fighting",
    name: "Thrown Weapon Fighting",
    shortLabel: "Draw freely and deal +2 damage",
    keyFacts: ["You can draw a thrown weapon as part of the attack.", "Thrown weapon hits gain +2 damage."],
    summary: "You can draw a weapon that has the thrown property as part of the attack you make with the weapon. In addition, when you hit with a ranged attack using a thrown weapon, you gain a +2 bonus to the damage roll.",
  },
  {
    id: "two-weapon-fighting",
    name: "Two-Weapon Fighting",
    shortLabel: "Add ability mod to off-hand damage",
    keyFacts: ["Applies while fighting with two weapons.", "Lets the second attack add your ability modifier to damage."],
    summary: "When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.",
  },
] as const;
const beastMasterPrimalFormNames = [
  "Beast of the Land",
  "Beast of the Sea",
  "Beast of the Sky",
] as const;

const classOverviewHighlightsByClass = {
  fighter: [
    {
      id: "combat-role",
      title: "Combat Role",
      body: "Frontline martial with clean weapon mastery, strong durability, and reliable round-to-round pressure.",
    },
    {
      id: "core-resources",
      title: "Core Resources",
      body: "Second Wind keeps you standing, Action Surge spikes your tempo, and Indomitable stabilizes key saving throws.",
    },
    {
      id: "level-rhythm",
      title: "Level Rhythm",
      body: "Big breakpoints arrive at 3 for your archetype, 5 for Extra Attack, 11 for your second attack spike, and 20 for the final jump.",
    },
  ],
  ranger: [
    {
      id: "combat-role",
      title: "Combat Role",
      body: "Mobile explorer and martial striker with weapon pressure, tracking tools, and wilderness control.",
    },
    {
      id: "core-resources",
      title: "Core Resources",
      body: "Favored Enemy helps you read and track threats, Natural Explorer keeps travel steady, and Spellcasting adds control, healing, and utility.",
    },
    {
      id: "level-rhythm",
      title: "Level Rhythm",
      body: "Key turns arrive at 2 for spells and fighting style, 3 for Horizon Walker, 5 for Extra Attack, and 11 for subclass scaling.",
    },
  ],
  warlock: [
    {
      id: "combat-role",
      title: "Combat Role",
      body: "Compact pact caster with short-rest spell slots, cantrip pressure, and patron-driven utility.",
    },
    {
      id: "core-resources",
      title: "Core Resources",
      body: "Pact Magic gives short-rest spell bursts, Eldritch Invocations add always-on tricks, and Pact Boon shapes your weapon, familiar, tome, or talisman play.",
    },
    {
      id: "level-rhythm",
      title: "Level Rhythm",
      body: "The build opens at 1 with your patron, deepens at 2 with invocations, and locks its pact shape at 3.",
    },
  ],
  bard: [
    {
      id: "combat-role",
      title: "Combat Role",
      body: "Flexible support caster with skill breadth, social control, healing, and strong enchantment or illusion tools.",
    },
    {
      id: "core-resources",
      title: "Core Resources",
      body: "Bardic Inspiration swings key rolls, Jack of All Trades broadens checks, Expertise sharpens specialties, and Spellcasting covers support and control.",
    },
    {
      id: "level-rhythm",
      title: "Level Rhythm",
      body: "Bard College unlocks at 3, Inspiration improves at 5 and 10, and Magical Secrets expands your spell access at 10.",
    },
  ],
} as const;

const fallbackFighterStartingEquipment: ClassStartingEquipmentGroup[] = [
  {
    id: "fighter-armor",
    prompt: "Armor",
    options: [
      { id: "chain-mail", label: "Chain Mail", items: ["Chain Mail"] },
      { id: "archer-kit", label: "Leather Armor, Longbow, and 20 Arrows", items: ["Leather Armor", "Longbow", "20 Arrows"] },
    ],
  },
  {
    id: "fighter-arms",
    prompt: "Primary Arms",
    options: [
      { id: "weapon-shield", label: "Martial Weapon and Shield", items: ["Martial Weapon", "Shield"] },
      { id: "two-martial", label: "Two Martial Weapons", items: ["2x Martial Weapons"] },
    ],
  },
  {
    id: "fighter-sidearm",
    prompt: "Ranged or Backup",
    options: [
      { id: "crossbow", label: "Light Crossbow and 20 Bolts", items: ["Light Crossbow", "20 Bolts"] },
      { id: "handaxes", label: "Two Handaxes", items: ["2x Handaxes"] },
    ],
  },
  {
    id: "fighter-pack",
    prompt: "Pack",
    options: [
      { id: "dungeoneer-pack", label: "Dungeoneer's Pack", items: ["Dungeoneer's Pack"] },
      { id: "explorer-pack", label: "Explorer's Pack", items: ["Explorer's Pack"] },
    ],
  },
];

const fighterAsiLevels = [4, 6, 8, 12, 14, 16, 19] as const;

function fighterAsiLevelChoices(
  improvements: CharacterDraft["fighterChoices"]["abilityScoreImprovements"] | undefined,
  excludeLevel?: number,
) {
  const bonuses = new Map<AbilityId, number>();

  Object.entries(improvements ?? {}).forEach(([levelKey, choice]) => {
    const level = Number(levelKey);
    if (!choice || (excludeLevel && level === excludeLevel)) {
      return;
    }

    if (choice.mode === "plus-two" && choice.plusTwoAbilityId) {
      bonuses.set(choice.plusTwoAbilityId, (bonuses.get(choice.plusTwoAbilityId) ?? 0) + 2);
    }

    if (choice.mode === "split") {
      choice.plusOneAbilityIds.forEach((abilityId) => {
        bonuses.set(abilityId, (bonuses.get(abilityId) ?? 0) + 1);
      });
    }
  });

  return bonuses;
}

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
  const normalized = summary.replace(/\r\n/g, "\n");
  const explicitParagraphs = normalized
    .split(/\n\s*\n/)
    .map((part) => cleanImportedText(part))
    .filter(Boolean);

  if (explicitParagraphs.length > 1) {
    return explicitParagraphs;
  }

  const cleaned = cleanImportedText(normalized);
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

function featureSummarySections(summary: string) {
  const raw = summary.replace(/\r\n/g, "\n");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.some((line) => /^#{1,2}.+#{1,2}$/.test(line))) {
    return [];
  }

  const sections: Array<{ heading: string; body: string[] }> = [];
  let currentSection: { heading: string; body: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,2}\s*(.+?)\s*#{1,2}$/);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        heading: cleanImportedText(headingMatch[1]),
        body: [],
      };
      continue;
    }

    if (!currentSection) {
      currentSection = {
        heading: "",
        body: [],
      };
    }

    currentSection.body.push(cleanImportedText(line));
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections.filter((section) => section.heading || section.body.length);
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

function normalizeEquipmentLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b\d+x?\s+/g, "")
    .replace(/\b\d+\s+/g, "")
    .replace(/\b(two|three|four|five|ten|twenty)\s+/g, "")
    .replace(/\bbolts\b/g, "crossbow bolts")
    .replace(/\barrows\b/g, "arrows")
    .replace(/\bhandaxes\b/g, "handaxe")
    .replace(/\bdaggers\b/g, "dagger")
    .replace(/\bshortswords\b/g, "shortsword")
    .replace(/\bweapons\b/g, "weapon")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function equipmentNameVariants(value: string) {
  const normalized = normalizeEquipmentLookup(value);
  const variants = new Set([normalized]);
  if (normalized.endsWith(" armor")) {
    variants.add(normalized.replace(/\s+armor$/, ""));
  } else if (normalized && !normalized.includes("weapon") && !normalized.includes("pack")) {
    variants.add(`${normalized} armor`);
  }
  if (normalized === "crossbow bolts") variants.add("crossbow bolts 20");
  if (normalized === "arrows") variants.add("arrows 20");
  return variants;
}

function equipmentTooltipTitle(label: string, items: string[]) {
  return items.length === 1 ? items[0] : label;
}

type EquipmentTooltipEntry =
  | { type: "item"; data: ContentBundle["items"][number] }
  | { type: "armor"; data: ContentBundle["armors"][number] }
  | { type: "weapon"; data: ContentBundle["weapons"][number] };

function equipmentTooltipContent(content: ContentBundle, label: string, items: string[]) {
  const candidates = [label, ...items].flatMap((item) =>
    item
      .split(/\s*,\s*|\s+and\s+/i)
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const seen = new Set<string>();
  const entries: EquipmentTooltipEntry[] = [];
  candidates.forEach((candidate) => {
    const variants = equipmentNameVariants(candidate);
    const item = content.items.find((entry) => variants.has(normalizeEquipmentLookup(entry.name)));
    if (item && !seen.has(`item-${item.id}`)) {
      seen.add(`item-${item.id}`);
      entries.push({ type: "item", data: item });
      return;
    }

    const armor = content.armors.find((entry) =>
      [entry.name, ...(entry.aliases ?? [])].some((name) => variants.has(normalizeEquipmentLookup(name))),
    );
    if (armor && !seen.has(`armor-${armor.id}`)) {
      seen.add(`armor-${armor.id}`);
      entries.push({ type: "armor", data: armor });
      return;
    }

    const weapon = content.weapons.find((entry) =>
      [entry.name, ...(entry.aliases ?? [])].some((name) => variants.has(normalizeEquipmentLookup(name))),
    );
    if (weapon && !seen.has(`weapon-${weapon.id}`)) {
      seen.add(`weapon-${weapon.id}`);
      entries.push({ type: "weapon", data: weapon });
    }
  });

  if (!entries.length) {
    return (
      <span className="spell-tooltip-copy">
        {items.length ? items.join(", ") : label}
      </span>
    );
  }

  return (
    <span className="spell-tooltip-block">
      <span className="spell-tooltip-head">
        <strong>{equipmentTooltipTitle(label, items)}</strong>
        <span>Equipment</span>
      </span>
      {entries.map((entry) => {
        if (entry.type === "item") {
          const item = entry.data;
          return (
            <span key={`item-${item.id}`} className="spell-tooltip-block">
              <span className="spell-tooltip-block-title">{item.name}</span>
              <span className="spell-tooltip-meta">
                {[item.cost, item.weight, item.capacity].filter(Boolean).map((value) => <span key={`${item.id}-${value}`}>{value}</span>)}
              </span>
              {item.contents?.length ? (
                <span className="spell-tooltip-copy">{item.contents.join(", ")}</span>
              ) : null}
              {item.description?.length ? (
                <span className="spell-tooltip-copy">{item.description.join(" ")}</span>
              ) : null}
            </span>
          );
        }

        if (entry.type === "armor") {
          const armor = entry.data;
          const ac = armor.acBonus ? `AC +${armor.acBonus}` : `AC ${armor.baseAc}${armor.dexBonus ? ` + Dex${armor.maxDexBonus ? ` (max ${armor.maxDexBonus})` : ""}` : ""}`;
          return (
            <span key={`armor-${armor.id}`} className="spell-tooltip-block">
              <span className="spell-tooltip-block-title">{armor.name}</span>
              <span className="spell-tooltip-meta">
                {[ac, armor.strengthRequirement ? `Str ${armor.strengthRequirement}` : null, armor.stealthDisadvantage ? "Stealth Disadvantage" : null, armor.weight, armor.cost]
                  .filter(Boolean)
                  .map((value) => <span key={`${armor.id}-${value}`}>{value}</span>)}
              </span>
            </span>
          );
        }

        const weapon = entry.data;
        return (
          <span key={`weapon-${weapon.id}`} className="spell-tooltip-block">
            <span className="spell-tooltip-block-title">{weapon.name}</span>
            <span className="spell-tooltip-meta">
              {[
                weapon.damage ? `${weapon.damage} ${weapon.damageType ?? ""}`.trim() : null,
                weapon.range ? `Range ${weapon.range}` : null,
                weapon.properties.length ? weapon.properties.join(", ") : null,
                weapon.weight,
                weapon.cost,
              ].filter(Boolean).map((value) => <span key={`${weapon.id}-${value}`}>{value}</span>)}
            </span>
            {weapon.specialDescription ? <span className="spell-tooltip-copy">{weapon.specialDescription}</span> : null}
          </span>
        );
      })}
    </span>
  );
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
  const [mounted, setMounted] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<{ top: number; left: number; maxWidth?: number } | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const gap = 14;
      const maxWidth = Math.min(tooltipRect.width || 520, viewportWidth - 32);
      let left = triggerRect.right + gap;
      let top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;

      if (left + maxWidth > viewportWidth - 16) {
        left = Math.max(16, triggerRect.left - maxWidth - gap);
      }

      if (top + tooltipRect.height > viewportHeight - 16) {
        top = viewportHeight - tooltipRect.height - 16;
      }
      if (top < 16) {
        top = 16;
      }

      setTooltipStyle({ top, left, maxWidth });
    };

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, content]);

  useEffect(() => () => clearCloseTimeout(), []);

  return (
    <span
      ref={triggerRef}
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
      {mounted && open
        ? createPortal(
            <div
              ref={tooltipRef}
              className={`inline-help-tooltip is-portal${tooltipStyle ? "" : " is-measuring"} ${tooltipClassName}`}
              style={tooltipStyle ? { top: tooltipStyle.top, left: tooltipStyle.left, maxWidth: tooltipStyle.maxWidth } : undefined}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
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

function structuredFactValue(fact: StructuredLineageEntry["facts"]["size"] | StructuredLineageEntry["facts"]["speed"] | StructuredLineageEntry["facts"]["languages"]) {
  if (!fact) {
    return "";
  }

  if ("category" in fact) {
    return fact.category;
  }

  if ("walk" in fact) {
    return `${fact.walk} ft.`;
  }

  if ("values" in fact) {
    return fact.values.join(", ");
  }

  return "";
}

function structuredFactDetail(fact: StructuredLineageEntry["facts"]["size"] | StructuredLineageEntry["facts"]["speed"] | StructuredLineageEntry["facts"]["languages"]) {
  if (!fact) {
    return "";
  }

  if ("description" in fact && fact.description) {
    return fact.description;
  }

  return "";
}

function structuredFeatureSummary(feature: StructuredLineageFeature) {
  return cleanImportedText(feature.summary);
}

function structuredChoiceOptionSummary(option: LineageChoiceOption) {
  return cleanImportedText(option.summary ?? "");
}

function creatorBrowserFromJourneyStage(stage: ClassJourneyStage["browser"]): CreatorBrowser {
  return stage as CreatorBrowser;
}

function fighterSceneFromBrowser(browser: CreatorBrowser, subclassId: string | null, classId: string): FighterJourneyScene {
  if (browser === "class-features") {
    return "fighter-features";
  }

  if (browser === "inventory") {
    return "fighter-equipment";
  }

  if (browser === "fighter-fighting-style") {
    return "fighter-style";
  }

  if (browser === "fighter-asi") {
    return "fighter-asi";
  }

  if (browser === "warlock-pact") {
    return "warlock-pact";
  }

  if (browser === "spells" && classId === "warlock") {
    return "warlock-spells";
  }

  if (browser === "spells" && subclassId === "eldritch-knight") {
    return "fighter-eldritch";
  }

  if (browser === "spells") {
    return "warlock-spells";
  }

  if (browser === "subclass" || browser === "subclass-features" || browser === "subclass-choices") {
    return "fighter-subclass";
  }

  return "fighter-class";
}

function buildFeatureUpgradeFacts(feature: ClassCuratedFeature, currentLevel: number) {
  return feature.milestones
    .filter((milestone) => milestone.level > currentLevel)
    .map((milestone) => `Level ${milestone.level}: ${milestone.label}`);
}

function featureTooltipContent(feature: ClassCuratedFeature, currentLevel: number) {
  const upgradeFacts = buildFeatureUpgradeFacts(feature, currentLevel);
  const keyFacts =
    feature.keyFacts.length
      ? feature.keyFacts
      : cleanImportedText(feature.summary)
          .split(/(?<=[.!?])\s+/)
          .filter(Boolean)
          .slice(0, 2);

  return (
    <div className="feature-rich-tooltip">
      <span className="spell-tooltip-head">
        <strong>{feature.name}</strong>
      </span>
      {keyFacts.length ? (
        <span className="spell-tooltip-block">
          <span className="spell-tooltip-block-title">Key Facts</span>
          <span className="spell-tooltip-line-list">
            {keyFacts.map((fact) => (
              <span key={`${feature.id}-fact-${fact}`} className="spell-tooltip-line-item">
                <span className="spell-tooltip-line-dot" aria-hidden="true" />
                <span>{fact}</span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
      {upgradeFacts.length ? (
        <span className="spell-tooltip-block">
          <span className="spell-tooltip-block-title">Upgrade Info</span>
          <span className="spell-tooltip-line-list">
            {upgradeFacts.map((fact) => (
              <span key={`${feature.id}-upgrade-${fact}`} className="spell-tooltip-line-item">
                <span className="spell-tooltip-line-dot" aria-hidden="true" />
                <span>{fact}</span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
      <span className="spell-tooltip-block">
        <span className="spell-tooltip-block-title">Summary</span>
        <span className="spell-tooltip-copy">{cleanImportedText(feature.summary)}</span>
      </span>
    </div>
  );
}

function spellTileTags(spell: ContentBundle["spells"][number]) {
  return (spell.tags ?? [])
    .map((tag) => cleanImportedText(tag))
    .filter((tag) => {
      if (!tag) {
        return false;
      }
      const normalized = tag.toLowerCase();
      if (normalized === cleanImportedText(spell.school).toLowerCase()) {
        return false;
      }
      if (normalized === "cantrip") {
        return false;
      }
      if (normalized === "scales") {
        return false;
      }
      if (/^level\s+\d+$/i.test(normalized)) {
        return false;
      }
      return true;
    })
    .slice(0, 4);
}

function spellTagToneClass(tag: string) {
  const normalized = tag.toLowerCase();

  if (normalized.includes("save")) {
    return "is-save";
  }
  if (normalized.includes("concentration")) {
    return "is-concentration";
  }
  if (normalized.includes("offensive")) {
    return "is-offensive";
  }
  if (normalized.includes("defensive")) {
    return "is-defensive";
  }
  if (normalized.includes("utility")) {
    return "is-utility";
  }
  if (["abjuration", "evocation", "conjuration", "divination", "enchantment", "illusion", "necromancy", "transmutation"].includes(normalized)) {
    return "is-school";
  }
  if (["acid", "cold", "fire", "force", "lightning", "necrotic", "poison", "psychic", "radiant", "thunder"].includes(normalized)) {
    return "is-damage";
  }

  return "is-neutral";
}

function collectChoiceOptionDescendantGroupIds(
  option: LineageChoiceOption,
  groupMap: Map<string, LineageChoiceGroup>,
  seen = new Set<string>(),
) {
  option.childChoiceGroupIds.forEach((groupId) => {
    if (seen.has(groupId)) {
      return;
    }

    seen.add(groupId);
    const childGroup = groupMap.get(groupId);
    if (!childGroup) {
      return;
    }

    childGroup.options.forEach((childOption) => collectChoiceOptionDescendantGroupIds(childOption, groupMap, seen));
  });

  return Array.from(seen);
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

function formatSelectionSummary(label: string, value: string) {
  return `${label}: ${value}`;
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

function rangerSectionTooltipContent(section: ClassDocSection | undefined, fallbackTitle: string, fallbackSummary: string) {
  const paragraphs = section?.blocks.flatMap((block) => block.paragraphs).filter(Boolean) ?? [];
  return (
    <span className="spell-tooltip-block">
      <span className="spell-tooltip-head">
        <strong>{section?.name ?? fallbackTitle}</strong>
        <span>Ranger Feature</span>
      </span>
      <span className="spell-tooltip-copy">
        {(paragraphs.length ? paragraphs : [fallbackSummary]).join(" ")}
      </span>
      {section?.tables.length ? (
        <span className="spell-tooltip-meta">
          <span>{`${section.tables.length} table${section.tables.length === 1 ? "" : "s"}`}</span>
        </span>
      ) : null}
    </span>
  );
}

function normalizedFeatureLookupName(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
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

function languageNamesFromIds(content: ContentBundle, languageIds: string[]) {
  return languageIds.map((languageId) => content.languages.find((language) => language.id === languageId)?.name ?? languageId);
}

function backgroundLanguageChoiceLabel(choice: ContentBundle["backgrounds"][number]["languages"]["choices"][number]) {
  if (Array.isArray(choice.options)) {
    return `${choice.label}: ${choice.options.join(", ")}`;
  }

  const optionLabel = choice.options === "any" ? "any language" : `${choice.options} language`;
  return `${choice.label} (${choice.count} ${optionLabel}${choice.count === 1 ? "" : "s"})`;
}

function backgroundLanguageSummary(content: ContentBundle, item: ContentBundle["backgrounds"][number]) {
  return [
    ...languageNamesFromIds(content, item.languages.fixed),
    ...item.languages.choices.map(backgroundLanguageChoiceLabel),
  ];
}

const toolCategoryLabels: Record<string, string> = {
  any: "any tool",
  "artisan-tools": "artisan tool",
  "gaming-sets": "gaming set",
  "musical-instruments": "musical instrument",
  vehicles: "vehicle",
};

function toolNameFromValue(content: ContentBundle, value: string) {
  return content.tools.find((tool) => tool.id === value)?.name ?? value;
}

function toolIdFromValue(content: ContentBundle, value: string) {
  const normalizedValue = value.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (
    content.tools.find(
      (tool) =>
        tool.id === value ||
        tool.name.toLowerCase() === value.toLowerCase() ||
        tool.name.toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedValue,
    )?.id ?? value
  );
}

function toolChoiceOptions(content: ContentBundle, options: ContentBundle["backgrounds"][number]["toolProficiencies"]["choices"][number]["options"]) {
  if (options === "any") {
    return content.tools.map((tool) => tool.id);
  }

  if (typeof options === "string") {
    const categoryTools = content.tools.filter((tool) => tool.category === options).map((tool) => tool.id);
    return categoryTools.length ? categoryTools : [options];
  }

  return options.flatMap((option) => {
    const categoryTools = content.tools.filter((tool) => tool.category === option).map((tool) => tool.id);
    return categoryTools.length ? categoryTools : [toolIdFromValue(content, option)];
  });
}

function backgroundToolChoiceLabel(content: ContentBundle, choice: ContentBundle["backgrounds"][number]["toolProficiencies"]["choices"][number]) {
  const optionLabels: Record<string, string> = {
    any: "any tool",
    "artisan-tools": "artisan tool",
    "gaming-sets": "gaming set",
    "musical-instruments": "musical instrument",
    vehicles: "vehicle",
  };

  if (Array.isArray(choice.options)) {
    return `${choice.label}: ${toolChoiceOptions(content, choice.options).map((option) => toolNameFromValue(content, option)).join(", ")}`;
  }

  const optionLabel = optionLabels[choice.options] ?? choice.options;
  return `${choice.label} (${choice.count} ${optionLabel}${choice.count === 1 ? "" : "s"})`;
}

function backgroundToolSummary(content: ContentBundle, item: ContentBundle["backgrounds"][number], selections: Record<string, string[]> = {}) {
  return [
    ...item.toolProficiencies.fixed,
    ...item.toolProficiencies.choices.map((choice) => {
      const selected = (selections[choice.id] ?? []).map((value) => toolNameFromValue(content, value));
      return selected.length ? selected.join(", ") : backgroundToolChoiceLabel(content, choice);
    }),
  ];
}

function backgroundMetaDescription(content: ContentBundle, item: ContentBundle["backgrounds"][number]) {
  const backgroundLanguages = backgroundLanguageSummary(content, item);
  const backgroundTools = backgroundToolSummary(content, item);

  return [
    item.skillProficiencies.length ? `Skill Proficiencies: ${item.skillProficiencies.join(", ")}` : null,
    backgroundTools.length ? `Tool Proficiencies: ${backgroundTools.join(", ")}` : null,
    backgroundLanguages.length ? `Languages: ${backgroundLanguages.join(", ")}` : null,
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

function compactPreviewValue(value: string, limit = 3) {
  const parts = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (parts.length <= limit) {
    return value;
  }

  return `${parts.slice(0, limit).join(", ")} +${parts.length - limit} more`;
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
    ...(reference?.classes ?? []),
    ...(reference?.tags ?? []),
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
  const primaryCopy = reference?.summary?.length
    ? reference.summary
    : summary
      ? summary.split(/\n\s*\n/).map((entry) => cleanImportedText(entry)).filter(Boolean)
      : [];
  const classLists = reference?.classes?.length
    ? reference.classes
    : [];
  const structuredTags = reference?.tags?.length
    ? reference.tags
    : [];

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
      {primaryCopy.length ? (
        <span className="spell-tooltip-block spell-tooltip-decision-card">
          <span className="spell-tooltip-copy spell-tooltip-copy-structured">
            {primaryCopy.map((paragraph, index) => (
              <span key={`${title}-copy-${index}`} className="spell-tooltip-paragraph">
                {paragraph}
              </span>
            ))}
          </span>
        </span>
      ) : null}
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
      {structuredTags.length ? (
        <span className="spell-tooltip-block">
          <span className="spell-tooltip-block-title">Tags</span>
          <span className="spell-tooltip-meta spell-tooltip-class-list">
            {structuredTags.map((item) => (
              <span key={`${title}-tag-${item}`} className="spell-tooltip-class-pill">
                <span>{item}</span>
              </span>
            ))}
          </span>
        </span>
      ) : null}
      {classLists.length ? (
        <span className="spell-tooltip-block">
          <span className="spell-tooltip-block-title">Spell Lists</span>
          <span className="spell-tooltip-meta spell-tooltip-class-list">
            {classLists.map((item) => (
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

function levelRangeLabel(fromLevel: number, toLevel: number) {
  if (fromLevel === toLevel) {
    return `${fromLevel}`;
  }

  return Array.from({ length: toLevel - fromLevel + 1 }, (_, index) => String(fromLevel + index)).join(", ");
}

function spellSlotSummary(spellSlots: Record<string, number>) {
  return Object.entries(spellSlots)
    .map(([level, count]) => ({ level: Number(level), count }))
    .filter((entry) => Number.isFinite(entry.level) && entry.count > 0)
    .sort((left, right) => left.level - right.level)
    .map((entry) => `${entry.count}x ${levelOrdinal(entry.level)}`)
    .join(" • ");
}

function spellSlotValue(spellSlots: Record<string, number>, spellLevel: number) {
  const value = spellSlots[String(spellLevel)];
  return typeof value === "number" && value > 0 ? String(value) : "-";
}

function featureMilestoneLabel(level: number) {
  return `Lv ${level}`;
}

function currentFeatureMilestone(
  milestones: Array<{ level: number; label: string }>,
  level: number,
) {
  return [...milestones]
    .filter((milestone) => milestone.level <= level)
    .sort((left, right) => right.level - left.level)[0] ?? null;
}

function nextFeatureMilestone(
  milestones: Array<{ level: number; label: string }>,
  level: number,
) {
  return [...milestones]
    .filter((milestone) => milestone.level > level)
    .sort((left, right) => left.level - right.level)[0] ?? null;
}

function resolveFeatureValueTemplate(
  template: string | undefined,
  values: {
    fighterLevel: number;
    proficiencyBonus: number;
  },
) {
  if (!template) {
    return null;
  }

  return template
    .replace(/\{fighterLevel\}/g, String(values.fighterLevel))
    .replace(/\{proficiencyBonus\}/g, String(values.proficiencyBonus));
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
  const subclassUnlockLevel = subclassUnlockLevelForClass(item.id);
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
    level >= defaultSubclassUnlockLevel
      ? "Subclass kararın artık build'in aktif bir parçası."
      : `Subclass seçimi için ${defaultSubclassUnlockLevel}. Level eşiğine henüz ulaşmadın.`;
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
    case "lineage-choices":
      return "spark";
    case "class":
      return "class";
    case "class-features":
      return "book";
    case "ranger-choices":
      return "spark";
    case "fighter-fighting-style":
    case "fighter-asi":
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
    case "lineage-choices":
      return "Lineage Choices";
    case "class":
      return "Classes";
    case "class-features":
      return "Class Features";
    case "subclass-features":
      return "Subclass Features";
    case "ranger-choices":
      return "Ranger Choices";
    case "fighter-fighting-style":
      return "Fighting Style";
    case "fighter-asi":
      return "Ability Score Improvement";
    case "background":
      return "Backgrounds";
    case "inventory":
      return "Equipment";
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
    case "lineage-choices":
      return "Lineage kaynaklı seçimleri burada tamamla.";
    case "class":
      return "Ana savaş ritmini, kaynak kullanımını ve build omurgasını burada seçiyorsun.";
    case "class-features":
      return "Class feature açıklamalarını, açıldıkları level bilgisiyle birlikte burada incele.";
    case "subclass-features":
      return "Subclass feature açıklamalarını ve seçtiğin yolun getirdiği uzmanlıkları burada incele.";
    case "ranger-choices":
      return "Ranger için seçimli class feature kararlarını burada yönet.";
    case "fighter-fighting-style":
      return "Fighter için Fighting Style seçimini burada yönet.";
    case "fighter-asi":
      return "Fighter seviyelerinden gelen Ability Score Improvement seçimlerini burada yönet.";
    case "background":
      return "Macera öncesi hayatını ve hangi alışkanlıklarla geldiğini tanımla.";
    case "inventory":
      return "Class başlangıç ekipmanını seç ve taşıdığın eşyaları burada yönet.";
    case "abilities":
      return "Point buy ve ability dağıtımını burada tamamla.";
    case "level":
      return "İlerleme eşiğini ayarla; Spell seviyesi ve Subclass erişimi burada şekillenir.";
    case "multiclass":
      return "İstersen karakterine ikinci bir yön veya uzmanlık ekle.";
    case "subclass":
      return `Subclass yolu bu creator akışında Class'a göre açılır. Varsayılan eşik Level ${defaultSubclassUnlockLevel}.`;
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
  lineageDataCatalog,
  classCuratedCollection,
  classOptionCollection,
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
  lineageDataCatalog: LineageCatalog;
  classCuratedCollection: ClassCuratedCollection;
  classOptionCollection: ClassOptionCollection;
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
  const subclassUnlockLevel = subclassUnlockLevelForClass(currentClass.id);
  const lineageGroups = useMemo(
    () => mergeLineageAndSpeciesEntries(lineageCollection, content.species),
    [lineageCollection, content.species],
  );
  const lineageCards = useMemo(() => lineageCardsFromGroups(lineageGroups), [lineageGroups]);
  const curatedClassMap = useMemo(
    () => new Map(classCuratedCollection.entries.map((entry) => [entry.id, entry])),
    [classCuratedCollection.entries],
  );
  const [creatorBrowser, setCreatorBrowser] = useState<CreatorBrowser>("lineage");
  const initialLineageGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
  const initialSubrace = initialLineageGroup?.subraces.find((subrace) => subrace.id === draft.speciesId) ?? initialLineageGroup?.subraces[0] ?? null;
  const [selectedLineageId, setSelectedLineageId] = useState(initialLineageGroup?.id ?? "");
  const [selectedSubraceId, setSelectedSubraceId] = useState(initialSubrace?.id ?? "");
  const [lineagePage, setLineagePage] = useState(0);
  const [backgroundPage, setBackgroundPage] = useState(0);
  const [lineageDetailTab, setLineageDetailTab] = useState("overview");
  const [subraceDetailTab, setSubraceDetailTab] = useState("overview");
  const [selectedClassFeatureId, setSelectedClassFeatureId] = useState<string | null>(null);
  const [selectedSubclassFeatureId, setSelectedSubclassFeatureId] = useState<string | null>(null);
  const [selectedStructuredLineageFeatureId, setSelectedStructuredLineageFeatureId] = useState<string | null>(null);
  const [selectedStructuredSublineageFeatureId, setSelectedStructuredSublineageFeatureId] = useState<string | null>(null);
  const [showUnavailableOptions, setShowUnavailableOptions] = useState(false);
  const [openWarlockGroup, setOpenWarlockGroup] = useState<"spells" | "pact" | "invocations">("spells");
  const [activeSpellFilter, setActiveSpellFilter] = useState<number | "all">("all");
  const [spellListPage, setSpellListPage] = useState(0);
  const [spellSearchQuery, setSpellSearchQuery] = useState("");
  const [fighterJourneyDirection, setFighterJourneyDirection] = useState(1);
  const [fighterProgressionOpen, setFighterProgressionOpen] = useState(false);
  const [fighterSpellLevelFilter, setFighterSpellLevelFilter] = useState<number | "all" | "cantrip">("all");
  const [fighterSpellPage, setFighterSpellPage] = useState(0);
  const [invocationPage, setInvocationPage] = useState(0);
  const [pactCantripPage, setPactCantripPage] = useState(0);
  const subclassUnlocked = draft.level >= subclassUnlockLevel;
  const speciesMeta = speciesMetaDescription(currentSpeciesRules);
  const currentLineageGroup =
    lineageGroups.find((group) => group.id === selectedLineageId) ??
    lineageGroupForSpecies(lineageGroups, draft.speciesId) ??
    lineageGroups[0];
  const currentStructuredLineage =
    lineageDataCatalog.entries.find((entry) => entry.id === currentLineageGroup.id) ??
    lineageDataCatalog.entries.find((entry) => entry.sublineages.some((sublineage) => sublineage.id === draft.speciesId)) ??
    null;
  const availableSubraces = subraceOptionsForGroup(currentLineageGroup);
  const selectedSubraceLookupId = selectedSubraceId || (draft.speciesId !== currentLineageGroup.id ? draft.speciesId : "");
  const currentSubraceEntry =
    (selectedSubraceLookupId ? availableSubraces.find((subrace) => subrace.id === selectedSubraceLookupId) : null) ??
    (currentStructuredLineage?.id === "human" ? null : availableSubraces[0]) ??
    null;
  const currentStructuredSublineage =
    (selectedSubraceLookupId
      ? currentStructuredLineage?.sublineages.find((entry) => entry.id === (currentSubraceEntry?.id ?? selectedSubraceLookupId))
      : null) ??
    (currentStructuredLineage?.id === "human" ? null : currentStructuredLineage?.sublineages[0]) ??
    null;
  const visibleSubraceOptions = [
    ...(currentStructuredLineage?.id === "human"
      ? [{ id: "__none__", name: "None", summary: "Use the standard Human origin without Variant Human choices." }]
      : []),
    ...(currentStructuredLineage?.sublineages.length ? currentStructuredLineage.sublineages : availableSubraces),
  ];
  const currentStructuredChoiceGroups = currentStructuredLineage?.choiceGroups ?? [];
  const currentStructuredSublineageChoiceGroups = currentStructuredSublineage?.choiceGroups ?? [];
  const currentStructuredChoiceGroupMap = useMemo(
    () => new Map(currentStructuredChoiceGroups.map((group) => [group.id, group])),
    [currentStructuredChoiceGroups],
  );
  const currentStructuredSublineageChoiceGroupMap = useMemo(
    () => new Map(currentStructuredSublineageChoiceGroups.map((group) => [group.id, group])),
    [currentStructuredSublineageChoiceGroups],
  );
  const resolvedLineageChoiceGroup = (group: LineageChoiceGroup): LineageChoiceGroup => {
    if (group.id === "half-elf-skill-choice") {
      return {
        ...group,
        options: Object.keys(skillAbilities).map((skillId) => ({
          id: skillId,
          label: skillLabel(skillId),
          summary: skillDescription(skillId, draft.skills.find((entry) => entry.id === skillId)?.description),
          details: [],
          grants: [],
          childChoiceGroupIds: [],
        })),
      };
    }

    if (group.id === "half-elf-cantrip-choice" || group.id === "high-elf-cantrip-choice") {
      return {
        ...group,
        options: content.spells
          .filter((spell) => spell.level === 0 && classMatchesSpell(spell, "Wizard"))
          .map((spell) => ({
            id: spell.id,
            label: spell.name,
            summary: cleanImportedText(spell.summary),
            details: [],
            grants: [],
            childChoiceGroupIds: [],
          })),
      };
    }

    return group;
  };
  const currentStructuredRootChoiceGroups = useMemo(() => {
    const childGroupIds = new Set(
      currentStructuredChoiceGroups.flatMap((group) => group.options.flatMap((option) => option.childChoiceGroupIds)),
    );

    return currentStructuredChoiceGroups.filter((group) => !childGroupIds.has(group.id));
  }, [currentStructuredChoiceGroups]);
  const currentStructuredSublineageRootChoiceGroups = useMemo(() => {
    const childGroupIds = new Set(
      currentStructuredSublineageChoiceGroups.flatMap((group) => group.options.flatMap((option) => option.childChoiceGroupIds)),
    );

    return currentStructuredSublineageChoiceGroups.filter((group) => !childGroupIds.has(group.id));
  }, [currentStructuredSublineageChoiceGroups]);
  const structuredLineageChoicesAvailable = Boolean(currentStructuredLineage?.choiceGroups.length);
  const structuredSublineageChoicesAvailable = Boolean(currentStructuredSublineage?.choiceGroups.length);
  const lineageChoiceTabs = useMemo(
    () =>
      (currentStructuredLineage?.features ?? [])
        .flatMap((feature) =>
          (feature.choiceGroupIds ?? []).map((groupId) => {
            const group = currentStructuredChoiceGroupMap.get(groupId);
            return group ? { id: group.id, label: feature.name, group } : null;
          }),
        )
        .filter((entry): entry is { id: string; label: string; group: LineageChoiceGroup } => Boolean(entry)),
    [currentStructuredChoiceGroupMap, currentStructuredLineage?.features],
  );
  const sublineageChoiceTabs = useMemo(
    () =>
      (currentStructuredSublineage?.features ?? [])
        .flatMap((feature) =>
          (feature.choiceGroupIds ?? []).map((groupId) => {
            const group = currentStructuredSublineageChoiceGroupMap.get(groupId);
            return group ? { id: group.id, label: feature.name, group } : null;
          }),
        )
        .filter((entry) => entry?.id !== "high-elf-cantrip-choice")
        .filter((entry): entry is { id: string; label: string; group: LineageChoiceGroup } => Boolean(entry)),
    [currentStructuredSublineage?.features, currentStructuredSublineageChoiceGroupMap],
  );
  const selectedStructuredLineageFeature =
    currentStructuredLineage?.features.find((feature) => feature.id === selectedStructuredLineageFeatureId) ??
    currentStructuredLineage?.features[0] ??
    null;
  const selectedStructuredSublineageFeature =
    currentStructuredSublineage?.features.find((feature) => feature.id === selectedStructuredSublineageFeatureId) ??
    currentStructuredSublineage?.features[0] ??
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
  const structuredLineageFixedBonuses =
    currentStructuredLineage && !(currentStructuredLineage.id === "human" && currentStructuredSublineage?.id === "variant-human")
      ? currentStructuredLineage.facts.abilityScoreBonuses
          .filter((bonus): bonus is Extract<typeof bonus, { type: "fixed" }> => bonus.type === "fixed")
          .map((bonus) => ({ ability: bonus.ability, amount: bonus.amount }))
      : [];
  const structuredSublineageFixedBonuses = currentStructuredSublineage
    ? currentStructuredSublineage.facts.abilityScoreBonuses
        .filter((bonus): bonus is Extract<typeof bonus, { type: "fixed" }> => bonus.type === "fixed")
        .map((bonus) => ({ ability: bonus.ability, amount: bonus.amount }))
    : [];
  const previewAbilityBonuses = [
    ...(currentStructuredLineage
      ? structuredLineageFixedBonuses
      : lineageHasFlexibleAbilityIncrease
        ? []
        : lineageAbilityScoreIncreases.flatMap((stat) => parseAbilityScoreIncrease(stat.value))),
    ...(currentStructuredLineage
      ? structuredSublineageFixedBonuses
      : subraceHasFlexibleAbilityIncrease
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
  const fighterAsiChoices = draft.fighterChoices?.abilityScoreImprovements ?? {};
  const fighterAsiBonuses = fighterAsiLevelChoices(fighterAsiChoices);
  const previewAbilities = draft.abilities.map((ability) => {
    const racialBonus = previewAbilityBonuses
      .filter((entry) => entry.ability === ability.id)
      .reduce((total, entry) => total + entry.amount, 0);
    const flexibleBonus = flexiblePreviewBonuses
      .filter((entry) => entry.ability === ability.id)
      .reduce((total, entry) => total + entry.amount, 0);
    const classBonus = fighterAsiBonuses.get(ability.id) ?? 0;
    const bonus = racialBonus + flexibleBonus + classBonus;
    const previewScore = ability.score + bonus;

    return {
      ...ability,
      previewScore,
      previewModifier: abilityModifier(previewScore),
      racialBonus,
      flexibleBonus,
      classBonus,
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
  const hasSelectedBackgroundToolData = Boolean(
    selectedBackground?.toolProficiencies.fixed.length || selectedBackground?.toolProficiencies.choices.length,
  );
  const allBackgroundEquipment = useMemo(
    () => content.backgrounds.flatMap((item) => item.equipment ?? []),
    [content.backgrounds],
  );
  const currentCuratedClass = curatedClassMap.get(draft.classId) ?? null;
  const simpleWeaponOptions = useMemo(
    () =>
      content.weapons
        .filter((weapon) => weapon.proficiency === "simple" && weapon.attackType !== "ammunition")
        .map((weapon) => ({
          id: `simple-${weapon.id}`,
          label: weapon.name,
          items: [weapon.name],
        })),
    [content.weapons],
  );
  const simpleMeleeWeaponOptions = useMemo(
    () => simpleWeaponOptions.filter((option) => {
      const weaponId = option.id.replace(/^simple-/, "");
      return content.weapons.some((weapon) => weapon.id === weaponId && weapon.attackType === "melee");
    }),
    [content.weapons, simpleWeaponOptions],
  );
  const martialWeaponOptions = useMemo(
    () =>
      content.weapons
        .filter((weapon) => weapon.proficiency === "martial" && weapon.attackType !== "ammunition")
        .map((weapon) => ({
          id: `martial-${weapon.id}`,
          label: weapon.name,
          items: [weapon.name],
        })),
    [content.weapons],
  );
  const classStartingEquipment = useMemo<ClassStartingEquipmentGroup[]>(() => {
    const baseEquipment =
      currentCuratedClass?.startingEquipment.length
        ? currentCuratedClass.startingEquipment
        : currentCuratedClass?.id === "fighter"
          ? fallbackFighterStartingEquipment
          : [];

    if (currentCuratedClass?.id === "warlock") {
      return baseEquipment.map((group) => ({
        ...group,
        options: group.options.flatMap((option) => {
          if (option.id === "simple-weapon") {
            return simpleWeaponOptions;
          }

          if (option.id === "leather-simple-daggers") {
            return simpleWeaponOptions.map((weaponOption) => ({
              id: `leather-${weaponOption.id}-daggers`,
              label: `Leather Armor, ${weaponOption.label}, and Two Daggers`,
              items: ["Leather Armor", weaponOption.label, "2x Daggers"],
            }));
          }

          return [option];
        }),
      }));
    }

    if (currentCuratedClass?.id === "fighter") {
      return baseEquipment.map((group) => {
        if (group.id !== "fighter-arms") {
          return group;
        }

        return {
          ...group,
          options: group.options.flatMap((option) => {
            if (option.id === "weapon-shield") {
              return martialWeaponOptions.map((weaponOption) => ({
                id: `martial-shield-${weaponOption.id}`,
                label: `${weaponOption.label} and Shield`,
                items: [weaponOption.label, "Shield"],
              }));
            }

            if (option.id === "two-martial") {
              return martialWeaponOptions.flatMap((firstWeapon) =>
                martialWeaponOptions.map((secondWeapon) => ({
                  id: `two-martial-${firstWeapon.id}-${secondWeapon.id}`,
                  label: "Two Martial Weapons",
                  items: [firstWeapon.label, secondWeapon.label],
                })),
              );
            }

            return [option];
          }),
        };
      });
    }

    if (currentCuratedClass?.id !== "bard") {
      if (currentCuratedClass?.id === "ranger") {
        return baseEquipment.map((group) => {
          if (group.id !== "ranger-arms") {
            return group;
          }

          return {
            ...group,
            options: group.options.flatMap((option) => {
              if (option.id !== "two-simple-melee") {
                return [option];
              }

              return simpleMeleeWeaponOptions.flatMap((firstWeapon) =>
                simpleMeleeWeaponOptions.map((secondWeapon) => ({
                  id: `two-simple-melee-${firstWeapon.id}-${secondWeapon.id}`,
                  label: "Two Simple Melee Weapons",
                  items: [firstWeapon.label, secondWeapon.label],
                })),
              );
            }),
          };
        });
      }

      return baseEquipment;
    }

    return baseEquipment.map((group) => {
      if (group.id !== "bard-arms") {
        return group;
      }

      return {
        ...group,
        options: group.options.flatMap((option) => (option.id === "simple-weapon" ? simpleWeaponOptions : [option])),
      };
    });
  }, [currentCuratedClass?.id, currentCuratedClass?.startingEquipment, martialWeaponOptions, simpleMeleeWeaponOptions, simpleWeaponOptions]);
  const fighterStartingEquipment = classStartingEquipment.length ? classStartingEquipment : fallbackFighterStartingEquipment;
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
  const eldritchKnightSpellcastingConfig =
    isVisibleEldritchKnight &&
    currentVisibleSubclass?.id === "eldritch-knight" &&
    "spellcasting" in currentVisibleSubclass
      ? currentVisibleSubclass.spellcasting ?? null
      : null;
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
      ? (classOptionCollection.warlock.pactBoon?.options.length ? classOptionCollection.warlock.pactBoon.options : defaultWarlockPactBoons)
      : [];
  const selectedPactBoon = warlockPactBoonOptions.find((option) => option.id === draft.pactBoonId) ?? null;
  const selectedPactBoonFacts =
    selectedPactBoon && "keyFacts" in selectedPactBoon && Array.isArray(selectedPactBoon.keyFacts)
      ? selectedPactBoon.keyFacts
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
    currentClass.id === "warlock" ? "Auto added from Expanded Spell List" : "Auto added from subclass magic";
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
  const classFeatureLevelMap = useMemo(() => {
    const entries = new Map<string, string>();

    if (currentCuratedClass) {
      currentCuratedClass.spellcastingTable.rows.slice(2).forEach((row) => {
        const levelLabel = row[0] ?? "";
        const featureText = cleanImportedText(row[2] ?? "");
        const normalizedFeatureText = normalizedFeatureLookupName(featureText);
        currentCuratedClass.classFeatures.forEach((feature) => {
          const normalizedName = normalizedFeatureLookupName(feature.name);
          if (!entries.has(feature.id) && normalizedName && normalizedFeatureText.includes(normalizedName)) {
            entries.set(feature.id, levelLabel);
          }
        });
      });
    }

    currentClass.featuresByLevel &&
      Object.entries(currentClass.featuresByLevel).forEach(([level, features]) => {
        features.forEach((feature) => {
          if (!entries.has(feature.id)) {
            entries.set(feature.id, levelOrdinal(Number(level)));
          }
        });
      });

    return entries;
  }, [currentClass.featuresByLevel, currentCuratedClass]);
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
  const classTableHasGroupedHeader = classTableRows.length > 1 && classTableRows[0].length < classTableHeaderRow.length;
  const classTableBodyRows = classTableHasGroupedHeader ? classTableRows.slice(2) : classTableRows.slice(1);
  const classProgressionHeaderRow = classTableHeaderRow.slice(0, 3);
  const classProgressionBodyRows = classTableBodyRows.map((row) => row.slice(0, 3));
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
  const classCantripLimit = spellSelectionRules.cantripLimit || Number(readCurrentSpellTableCell("Cantrips Known") || 0) || 0;
  const classKnownSpellLimit = spellSelectionRules.totalKnownLimit || Number(currentWarlockSpellsKnown || 0) || 0;
  const classSelectedCantrips = availableSpells.filter((spell) => spell.level === 0 && draft.spellIds.includes(spell.id));
  const classSelectedLeveledSpells = availableSpells.filter((spell) => spell.level > 0 && draft.spellIds.includes(spell.id));
  const classSpellUnavailableReason = (spell: ContentBundle["spells"][number]) => {
    if (draft.spellIds.includes(spell.id)) {
      return null;
    }

    const isAvailableByPool = availableSpells.some((entry) => entry.id === spell.id);
    if (!isAvailableByPool) {
      return `${spell.name} is not available to ${currentClass.name} at level ${draft.level}.`;
    }

    if (spell.level === 0) {
      if (classCantripLimit > 0 && classSelectedCantrips.length >= classCantripLimit) {
        return `Cantrip limit reached (${classCantripLimit}/${classCantripLimit}). Remove a cantrip to choose another.`;
      }
      return null;
    }

    const levelLimit = spellSelectionRules.perLevelLimits[spell.level] ?? 0;
    if (levelLimit > 0) {
      const selectedAtLevel = classSelectedLeveledSpells.filter((entry) => entry.level === spell.level).length;
      if (selectedAtLevel >= levelLimit) {
        return `Level ${spell.level} pick limit reached (${levelLimit}/${levelLimit}). Remove a spell of this level to choose another.`;
      }
    }

    if (classKnownSpellLimit > 0 && classSelectedLeveledSpells.length >= classKnownSpellLimit) {
      return `Known spells limit reached (${classKnownSpellLimit}/${classKnownSpellLimit}). Remove a spell to choose another.`;
    }

    return null;
  };
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
  const highElfCantripPool = content.spells.filter((spell) => spell.level === 0 && classMatchesSpell(spell, "Wizard"));
  const selectedHighElfCantripId = draft.lineageChoices?.["high-elf-cantrip-choice"]?.[0] ?? "";
  const selectedHighElfCantrip = highElfCantripPool.find((spell) => spell.id === selectedHighElfCantripId) ?? null;
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
    if (currentClass.id !== "warlock" || !classOptionCollection.warlock.eldritchInvocations?.options.length) {
      return [];
    }

    return classOptionCollection.warlock.eldritchInvocations.options.filter((option) => {
      const parsed = parseWarlockInvocationSummary(option.summary);
      return warlockInvocationMeetsPrerequisite(parsed.prerequisite, {
        level: draft.level,
        pactBoonId: draft.pactBoonId,
        spellIds: draft.spellIds,
      });
    });
  }, [currentClass.id, draft.level, draft.pactBoonId, draft.spellIds, classOptionCollection.warlock.eldritchInvocations?.options]);
  const invocationCandidatePool = currentClass.id === "warlock"
    ? classOptionCollection.warlock.eldritchInvocations?.options ?? []
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
  const selectedPactCantripSpells = draft.selectedPactCantripIds
    .map((spellId) => content.spells.find((spell) => spell.id === spellId) ?? null)
    .filter((spell): spell is ContentBundle["spells"][number] => Boolean(spell));
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
  const visibleClassFeatures = (currentCuratedClass?.classFeatures ?? []).filter((feature) => {
    if (currentClass.id !== "ranger") {
      return true;
    }

    if (isRangerFavoredFoeMode && feature.id === "favored-enemy") return false;
    if (!isRangerFavoredFoeMode && feature.id === "favored-foe-optional") return false;
    if (isRangerDeftExplorerMode && feature.id === "natural-explorer") return false;
    if (!isRangerDeftExplorerMode && feature.id === "deft-explorer-optional") return false;
    if (isRangerPrimalAwarenessMode && feature.id === "primeval-awareness") return false;
    if (!isRangerPrimalAwarenessMode && feature.id === "primal-awareness-optional") return false;
    if (isRangerNaturesVeilMode && feature.id === "hide-in-plain-sight") return false;
    if (!isRangerNaturesVeilMode && feature.id === "nature-s-veil-optional") return false;

    return true;
  });
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
  const intelligenceModifier =
    draft.abilities.find((ability) => ability.id === "INT")?.modifier ?? 0;
  const eldritchKnightCantripSelections = isVisibleEldritchKnight
    ? availableSpells.filter((spell) => spell.level === 0 && draft.spellIds.includes(spell.id))
    : [];
  const eldritchKnightLeveledSelections = isVisibleEldritchKnight
    ? availableSpells.filter((spell) => spell.level > 0 && draft.spellIds.includes(spell.id))
    : [];
  const eldritchKnightOffSchoolSelections = eldritchKnightLeveledSelections.filter(
    (spell) => !["abjuration", "evocation"].includes(spell.school.toLowerCase()),
  );
  const eldritchKnightUnrestrictedLevels =
    eldritchKnightSpellcastingConfig?.unrestrictedSpellLevels.length
      ? eldritchKnightSpellcastingConfig.unrestrictedSpellLevels
      : [3, 8, 14, 20];
  const eldritchKnightFlexibleSchoolLevelsReached = eldritchKnightUnrestrictedLevels.filter((level) => draft.level >= level);
  const eldritchKnightSchoolFocusLabel =
    eldritchKnightSpellcastingConfig?.schoolFocus.length
      ? eldritchKnightSpellcastingConfig.schoolFocus.join(" / ")
      : "Abjuration / Evocation";
  const eldritchKnightCantripLimit =
    Number(
      readEldritchKnightCell("Cantrips Known") ||
        eldritchKnightSpellcastingConfig?.cantripsKnownByLevel[String(draft.level)] ||
        eldritchKnightFallbackRow?.cantripsKnown ||
        spellSelectionRules.cantripLimit ||
        0,
    ) || 0;
  const eldritchKnightSpellsKnownLimit =
    Number(
      readEldritchKnightCell("Spells Known") ||
        eldritchKnightSpellcastingConfig?.spellsKnownByLevel[String(draft.level)] ||
        eldritchKnightFallbackRow?.spellsKnown ||
        spellSelectionRules.totalKnownLimit ||
        0,
    ) || 0;
  const eldritchKnightSpellUnavailableReason = (spell: ContentBundle["spells"][number]) => {
    if (draft.spellIds.includes(spell.id)) {
      return null;
    }

    const isAvailableByPool = availableSpells.some((entry) => entry.id === spell.id);
    const isFocusSchool = ["abjuration", "evocation"].includes(spell.school.toLowerCase());

    if (spell.level === 0) {
      if (!isAvailableByPool || eldritchKnightCantripLimit <= 0) {
        return "Cantrips are not available at this level.";
      }

      if (eldritchKnightCantripSelections.length >= eldritchKnightCantripLimit) {
        return `Cantrip limit reached (${eldritchKnightCantripLimit}/${eldritchKnightCantripLimit}). Remove a cantrip to choose another.`;
      }

      return null;
    }

    const levelLimit = spellSelectionRules.perLevelLimits[spell.level] ?? 0;
    if (!isAvailableByPool || levelLimit <= 0 || spell.level > spellSelectionRules.maxSpellLevel) {
      if (!isFocusSchool && eldritchKnightOffSchoolSelections.length >= eldritchKnightFlexibleSchoolAllowance) {
        return `Any-school picks are full (${eldritchKnightFlexibleSchoolAllowance}/${eldritchKnightFlexibleSchoolAllowance}). Choose ${eldritchKnightSchoolFocusLabel} or remove a flexible pick.`;
      }

      return `Level ${spell.level} spells are not available at Fighter level ${draft.level}.`;
    }

    if (!isFocusSchool && eldritchKnightOffSchoolSelections.length >= eldritchKnightFlexibleSchoolAllowance) {
      return `Any-school picks are full (${eldritchKnightFlexibleSchoolAllowance}/${eldritchKnightFlexibleSchoolAllowance}). Choose ${eldritchKnightSchoolFocusLabel} or remove a flexible pick.`;
    }

    const selectedAtLevel = eldritchKnightLeveledSelections.filter((entry) => entry.level === spell.level).length;
    if (selectedAtLevel >= levelLimit) {
      return `Level ${spell.level} pick limit reached (${levelLimit}/${levelLimit}). Remove a spell of this level to choose another.`;
    }

    if (eldritchKnightLeveledSelections.length >= eldritchKnightSpellsKnownLimit) {
      return `Known spells limit reached (${eldritchKnightSpellsKnownLimit}/${eldritchKnightSpellsKnownLimit}). Remove a known spell to choose another.`;
    }

    return null;
  };
  const eldritchKnightChoiceRows = isVisibleEldritchKnight
    ? [
        {
          id: "eldritch-knight-cantrips-choice",
          label: "Wizard Cantrips",
          value:
            eldritchKnightCantripSelections.map((spell) => spell.name).join(", ") ||
            "None selected",
          note: `Selected ${eldritchKnightCantripSelections.length} / ${eldritchKnightCantripLimit}`,
        },
        {
          id: "eldritch-knight-spells-choice",
          label: "Wizard Spells",
          value:
            eldritchKnightLeveledSelections.map((spell) => spell.name).join(", ") ||
            "None selected",
          note: `Selected ${eldritchKnightLeveledSelections.length} / ${eldritchKnightSpellsKnownLimit}`,
        },
        {
          id: "eldritch-knight-school-rule",
          label: "School Rule",
          value: `${eldritchKnightSchoolFocusLabel} are the default schools for learned spells.`,
          note: eldritchKnightFlexibleSchoolLevelsReached.length
            ? `Any-school picks unlocked at ${eldritchKnightFlexibleSchoolLevelsReached.map((level) => levelOrdinal(level)).join(", ")}`
            : "No any-school picks unlocked yet.",
        },
      ]
    : [];
  const eldritchKnightProgressionBands =
    eldritchKnightSpellcastingConfig?.progressionBands.map((band) => ({
      id: `ek-band-${band.fromLevel}-${band.toLevel}`,
      fromLevel: band.fromLevel,
      toLevel: band.toLevel,
      levelRange: levelRangeLabel(band.fromLevel, band.toLevel),
      cantripsKnown: band.cantripsKnown,
      spellsKnown: band.spellsKnown,
      spellSlotsRaw: band.spellSlots,
      spellSlots: spellSlotSummary(band.spellSlots),
    })) ?? [];
  const selectedSubclassFeatureSections = selectedSubclassFeature
    ? featureSummarySections(selectedSubclassFeature.summary)
    : [];
  const selectedClassFeatureKeyFacts = selectedClassFeature?.keyFacts ?? [];
  const selectedClassFeatureParagraphs = selectedClassFeature
    ? featureSummaryParagraphs(selectedClassFeature.summary)
    : [];
  const selectedClassFeatureMilestones = selectedClassFeature?.milestones ?? [];
  const selectedSubclassFeatureParagraphs = selectedSubclassFeature
    ? featureSummaryParagraphs(selectedSubclassFeature.summary)
    : [];
  const selectedSubclassFeatureKeyFacts =
    selectedSubclassFeature && "keyFacts" in selectedSubclassFeature && Array.isArray(selectedSubclassFeature.keyFacts)
      ? selectedSubclassFeature.keyFacts
      : [];
  const classOverviewHighlights =
    classOverviewHighlightsByClass[currentClass.id as keyof typeof classOverviewHighlightsByClass] ??
    classOverviewHighlightsByClass.fighter;
  const selectedSubclassFeatureTags =
    selectedSubclassFeature && "tags" in selectedSubclassFeature && Array.isArray(selectedSubclassFeature.tags)
      ? selectedSubclassFeature.tags
      : [];
  const selectedClassFeatureMilestoneText = selectedClassFeatureMilestones.length
    ? `Levels ${selectedClassFeatureMilestones.map((milestone) => milestone.level).join(", ")}`
    : null;
  const rangerFavoredTerrainChoiceSlots = draft.level >= 10 ? 3 : draft.level >= 6 ? 2 : 1;
  const visibleRangerFavoredTerrains = Array.from({ length: rangerFavoredTerrainChoiceSlots }, (_, index) => draft.rangerChoices?.favoredTerrains?.[index] ?? "forest");
  const rangerCannySkillOptions = draft.skills.filter((skill) => skill.proficient);
  const rangerDeftLanguages = Array.from({ length: 2 }, (_, index) => draft.rangerChoices?.deftLanguages?.[index] ?? (index === 0 ? "Sylvan" : "Elvish"));
  const rangerFightingStyleOptions = rangerFightingStyleOptionData;
  const selectedRangerFightingStyle =
    rangerFightingStyleOptions.find((option) => option.id === draft.rangerChoices?.fightingStyleId) ?? rangerFightingStyleOptions[0] ?? null;
  const fighterFightingStyleGroup = classOptionCollection.fighter.fightingStyle;
  const fighterBattleMasterManeuverGroup = classOptionCollection.fighter.battleMasterManeuvers;
  const fighterFightingStyleOptions = fighterFightingStyleGroup?.options ?? [];
  const selectedFighterFightingStyle =
    fighterFightingStyleOptions.find((option) => option.id === draft.fighterChoices?.fightingStyleId) ?? null;
  const classFightingStyleOptions = currentClass.id === "ranger" ? rangerFightingStyleOptions : fighterFightingStyleOptions;
  const selectedClassFightingStyle = currentClass.id === "ranger" ? selectedRangerFightingStyle : selectedFighterFightingStyle;
  const selectedClassFightingStyleId = currentClass.id === "ranger" ? draft.rangerChoices?.fightingStyleId : draft.fighterChoices?.fightingStyleId;
  const selectedClassFightingStyleKeyFacts =
    selectedClassFightingStyle && "keyFacts" in selectedClassFightingStyle && Array.isArray(selectedClassFightingStyle.keyFacts)
      ? selectedClassFightingStyle.keyFacts
      : [];
  const fighterBattleMasterManeuverOptions = fighterBattleMasterManeuverGroup?.options ?? [];
  const selectedSuperiorTechniqueManeuver =
    fighterBattleMasterManeuverOptions.find((option) => option.id === draft.fighterChoices?.superiorTechniqueManeuverId) ?? null;
  const fighterAsiFeature =
    currentClass.id === "fighter"
      ? currentCuratedClass?.classFeatures.find((feature) => feature.id === "ability-score-improvement") ?? null
      : null;
  const unlockedFighterAsiLevels = fighterAsiLevels.filter((level) => draft.level >= level);
  const skillChoiceOptions = currentClassRules?.skillChoices ?? [];
  const skillChoiceCount = currentClassRules?.skillChoiceCount ?? 0;
  const selectedClassSkillCount = draft.selectedSkillIds.filter((skillId) => skillChoiceOptions.includes(skillId)).length;
  const remainingClassSkillChoices = Math.max(0, skillChoiceCount - selectedClassSkillCount);
  const backgroundSkillLabels = backgroundSkillIds
    .map((skillId) => skillLabel(skillId))
    .filter((label, index, collection) => collection.indexOf(label) === index);
  const classFeatureUnlockState = useMemo(() => {
    const entries = new Map<
      string,
      {
        unlockLabel: string | null;
        unlockLevel: number | null;
        acquired: boolean;
        selectionSummary: string | null;
        currentSummary: string | null;
        nextSummary: string | null;
      }
    >();

    currentCuratedClass?.classFeatures.forEach((feature) => {
      const unlockLabel = classFeatureLevelMap.get(feature.id) ?? null;
      const unlockLevel = unlockLabel ? numericSpellLevelLabel(unlockLabel) : null;
      const acquired = unlockLevel ? draft.level >= unlockLevel : true;
      let selectionSummary: string | null = null;
      let currentSummary: string | null = null;
      let nextSummary: string | null = null;

      if (currentClass.id === "fighter" && feature.id === "fighting-style") {
        selectionSummary = formatSelectionSummary("Selected Style", selectedFighterFightingStyle?.name ?? "None");
      }
      const templateValue = resolveFeatureValueTemplate(feature.currentValueTemplate, {
        fighterLevel: draft.level,
        proficiencyBonus: draft.proficiencyBonus,
      });
      if (templateValue) {
        currentSummary = `Current: ${templateValue}`;
      }
      if (feature.milestones.length) {
        const currentMilestone = currentFeatureMilestone(feature.milestones, draft.level);
        const nextMilestone = nextFeatureMilestone(feature.milestones, draft.level);
        if (feature.id === "ability-score-improvement") {
          const earnedCount = feature.milestones.filter((milestone) => milestone.level <= draft.level).length;
          currentSummary = earnedCount > 0 ? `ASI opportunities earned: ${earnedCount}` : currentSummary;
        } else {
          currentSummary = currentMilestone ? `Current: ${currentMilestone.label}` : currentSummary;
        }
        nextSummary = nextMilestone ? `Next: ${featureMilestoneLabel(nextMilestone.level)}` : null;
      }

      entries.set(feature.id, {
        unlockLabel,
        unlockLevel,
        acquired,
        selectionSummary,
        currentSummary,
        nextSummary,
      });
    });

    return entries;
  }, [classFeatureLevelMap, currentClass.id, currentCuratedClass?.classFeatures, draft.level, selectedFighterFightingStyle?.name]);
  const subclassFeatureUnlockState = useMemo(() => {
    const entries = new Map<
      string,
      {
        unlockLabel: string | null;
        unlockLevel: number | null;
        acquired: boolean;
        currentSummary: string | null;
        nextSummary: string | null;
      }
    >();

    currentVisibleSubclass?.features.forEach((feature) => {
      const unlockLevel =
        "unlockLevel" in feature && typeof feature.unlockLevel === "number"
          ? feature.unlockLevel
          : currentVisibleSubclass?.id === "eldritch-knight" && feature.id === "spellcasting"
            ? 3
            : null;
      const unlockLabel = unlockLevel ? levelOrdinal(unlockLevel) : null;
      const acquired = unlockLevel ? draft.level >= unlockLevel : true;
      let currentSummary: string | null = null;
      let nextSummary: string | null = null;

      if (currentVisibleSubclass?.id === "eldritch-knight" && feature.id === "spellcasting") {
        const currentBand =
          eldritchKnightProgressionBands.find(
            (entry) => draft.level >= entry.fromLevel && draft.level <= entry.toLevel,
          ) ?? eldritchKnightProgressionBands[0] ?? null;
        const nextBand =
          eldritchKnightProgressionBands.find((entry) => entry.fromLevel > draft.level) ?? null;

        if (currentBand) {
          currentSummary = `Current: ${currentBand.cantripsKnown} cantrips • ${currentBand.spellsKnown} known`;
        }
        if (nextBand) {
          nextSummary = `Next: ${featureMilestoneLabel(nextBand.fromLevel)}`;
        }
      }

      entries.set(feature.id, {
        unlockLabel,
        unlockLevel,
        acquired,
        currentSummary,
        nextSummary,
      });
    });

    return entries;
  }, [currentVisibleSubclass, draft.level, eldritchKnightProgressionBands]);
  const selectedSubclassFeatureUnlockState = selectedSubclassFeature
    ? subclassFeatureUnlockState.get(selectedSubclassFeature.id) ?? null
    : null;
  const selectedSubclassFeatureLevelText =
    selectedSubclassFeature && "unlockLevel" in selectedSubclassFeature && typeof selectedSubclassFeature.unlockLevel === "number"
      ? `Available from ${levelOrdinal(selectedSubclassFeature.unlockLevel)} level`
      : currentVisibleSubclass?.id === "eldritch-knight" && selectedSubclassFeature?.id === "spellcasting"
        ? `Available from ${levelOrdinal(3)} level`
        : null;
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
              rule: eldritchKnightCantripLimit ? String(eldritchKnightCantripLimit) : "-",
            },
            {
              id: "eldritch-knight-spells-known",
              label: "Known Spells",
              available: availableSpells.filter((spell) => spell.level > 0).length,
              selected: draft.spellIds.filter((spellId) => availableSpells.some((spell) => spell.id === spellId && spell.level > 0)).length,
              rule: eldritchKnightSpellsKnownLimit ? String(eldritchKnightSpellsKnownLimit) : "-",
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
  const fighterJourneySpellPool = spellCandidatePool.filter((spell) => classMatchesSpell(spell, "Wizard"));
  const fighterJourneySpellLevelOptions = [...new Set(fighterJourneySpellPool.map((spell) => spell.level).sort((a, b) => a - b))];
  const fighterJourneyFilteredSpellPool = fighterJourneySpellPool.filter((spell) =>
    fighterSpellLevelFilter === "all"
      ? true
      : fighterSpellLevelFilter === "cantrip"
        ? spell.level === 0
        : spell.level === fighterSpellLevelFilter,
  );
  const fighterJourneySpellPageCount = Math.max(1, Math.ceil(fighterJourneyFilteredSpellPool.length / spellbookPageSize));
  const fighterJourneyVisibleSpellTiles = fighterJourneyFilteredSpellPool.slice(
    fighterSpellPage * spellbookPageSize,
    fighterSpellPage * spellbookPageSize + spellbookPageSize,
  );
  const visibleClassTableBodyRows = classProgressionBodyRows;
  const paginatedLineages = useMemo(() => {
    const start = lineagePage * lineagePageSize;
    return lineageCards.slice(start, start + lineagePageSize);
  }, [lineageCards, lineagePage]);
  const pagedBackgrounds = useMemo(() => {
    const start = backgroundPage * backgroundPageSize;
    return content.backgrounds.slice(start, start + backgroundPageSize);
  }, [backgroundPage, backgroundPageSize, content.backgrounds]);
  const creatorMenu = [
    { id: 0 as CreatorStep, label: "Origin" },
    { id: 1 as CreatorStep, label: "Class" },
    { id: 2 as CreatorStep, label: "Ability Scores" },
  ];
  const creatorMenuDescriptions: Record<CreatorStep, string> = {
    0: "Identity, race, subrace, and background setup.",
    1: "Class path, equipment, subclass, and spellcasting choices.",
    2: "Ability scores and skill proficiency setup.",
  };
  const fighterJourneyBrowsers: CreatorBrowser[] = [
    "class",
    "class-features",
    "inventory",
    "fighter-fighting-style",
    "fighter-asi",
    "warlock-pact",
    "subclass",
    "subclass-features",
    "subclass-choices",
    "spells",
  ];
  const fighterJourneyActive =
    creatorStep === 1 &&
    fighterJourneyBrowsers.includes(creatorBrowser);
  const fighterJourneySubclasses =
    currentCuratedClass?.subclasses.filter((entry) =>
      availableSubclassOptions.length ? availableSubclassOptions.includes(entry.id) : true,
    ) ?? [];
  const selectedJourneySubclass =
    fighterJourneySubclasses.find((entry) => draft.selectedSubclassOptions.includes(entry.id)) ?? null;
  const fighterJourneySubclassId = selectedJourneySubclass?.id ?? null;
  const fighterJourneyScene = fighterSceneFromBrowser(creatorBrowser, fighterJourneySubclassId, currentClass.id);
  const fighterJourneyStageItems = useMemo(() => {
    const fallbackStages: ClassJourneyStage[] = [
      {
        id: "class",
        label: "Class",
        browser: "class",
        summary: "Review the class identity and progression.",
      },
      {
        id: "features",
        label: "Class Features",
        browser: "class-features",
        summary: "Review feature cards, milestones, and upgrades.",
      },
      {
        id: "equipment",
        label: "Equipment",
        browser: "inventory",
        summary: "Choose starting equipment and review background tools.",
      },
      ...(currentClass.id === "fighter" || currentClass.id === "ranger"
        ? [
            {
              id: "fighting-style",
              label: "Fighting Style",
              browser: "fighter-fighting-style",
              summary: "Choose the combat style that defines your baseline edge.",
            } satisfies ClassJourneyStage,
          ]
        : []),
      ...(currentClass.id === "fighter"
        ? [
            {
              id: "asi",
              label: "ASI",
              browser: "fighter-asi",
              summary: "Choose Ability Score Improvements or a feat when unlocked.",
            } satisfies ClassJourneyStage,
          ]
        : []),
      {
        id: "subclass",
        label: "Subclass",
        browser: "subclass",
        minLevel: 3,
        summary: `Choose your ${currentCuratedClass?.subclassHeading ?? "subclass"}.`,
      },
      {
        id: "spells",
        label: currentClass.id === "warlock" ? "Spells" : "Spellcasting",
        browser: "spells",
        summary: "Choose spells and class magic options.",
      },
    ];
    const baseStages = currentCuratedClass?.journeyStages.length ? currentCuratedClass.journeyStages : fallbackStages;
    const normalizedBaseStages =
      !baseStages.some((stage) => stage.browser === "inventory")
        ? [
            ...baseStages.slice(0, Math.max(2, baseStages.findIndex((stage) => stage.browser === "fighter-fighting-style"))),
            {
              id: "equipment",
              label: "Equipment",
              browser: "inventory",
              summary: "Choose starting armor, weapons, packs, and review your inventory.",
            } satisfies ClassJourneyStage,
            ...baseStages.slice(Math.max(2, baseStages.findIndex((stage) => stage.browser === "fighter-fighting-style"))),
          ]
        : baseStages;
    const subclassStages = selectedJourneySubclass?.journeyStages ?? [];
    const stageOrder = ["class", "class-features", "inventory", "fighter-fighting-style", "fighter-asi", "subclass", "subclass-features", "subclass-choices", "warlock-pact", "spells"];
    return [...normalizedBaseStages, ...subclassStages]
      .filter((stage) => (stage.minLevel ? draft.level >= stage.minLevel : true))
      .filter((stage) => (stage.requiresSubclassId ? fighterJourneySubclassId === stage.requiresSubclassId : true))
      .map((stage) => ({
        ...stage,
        browser: creatorBrowserFromJourneyStage(stage.browser),
        scene: fighterSceneFromBrowser(creatorBrowserFromJourneyStage(stage.browser), fighterJourneySubclassId, currentClass.id),
      }))
      .sort((left, right) => {
        const leftIndex = stageOrder.indexOf(left.browser ?? "");
        const rightIndex = stageOrder.indexOf(right.browser ?? "");
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      });
  }, [currentClass.id, currentCuratedClass?.journeyStages, currentCuratedClass?.subclassHeading, selectedJourneySubclass?.journeyStages, draft.level, fighterJourneySubclassId]);
  const shouldShowSubraceNav =
    currentStructuredLineage?.id === "human" ||
    Boolean(currentStructuredLineage?.sublineages.length || availableSubraces.length);
  const classSubmenuItems = useMemo<SidebarNavEntry[]>(
    () =>
      [
        { type: "divider", id: "origin-core", label: "Origin" },
        { type: "item", id: "identity", label: "Identity", step: 0 },
        { type: "item", id: "lineage", label: "Race", step: 0 },
        ...(shouldShowSubraceNav ? [{ type: "item", id: "subrace", label: "Subrace", step: 0 } as const] : []),
        { type: "divider", id: "origin-life", label: "Adventuring Setup" },
        { type: "item", id: "background", label: "Background", step: 0 },
      ],
    [shouldShowSubraceNav],
  );
  const subclassSubmenuItems = useMemo<SidebarNavEntry[]>(
    () =>
      [
        { type: "divider", id: "class-core", label: "Class" },
        { type: "item", id: "class", label: "Class Overview", step: 1 },
        { type: "item", id: "class-features", label: "Class Features", step: 1 },
        { type: "item", id: "inventory", label: "Equipment", step: 1 },
        ...(currentClass.id === "fighter" || currentClass.id === "ranger"
          ? [
              { type: "item", id: "fighter-fighting-style", label: currentClass.id === "ranger" ? "Fighting Style" : fighterFightingStyleGroup?.name ?? "Fighting Style", step: 1 } as const,
            ]
          : []),
        { type: "divider", id: "class-subclass", label: "Subclass" },
        { type: "item", id: "subclass", label: "Subclass", step: 1 },
        ...(subclassUnlocked
          ? [{ type: "item", id: "subclass-features", label: "Subclass Features", step: 1 } as const]
          : []),
        ...(subclassUnlocked
          ? [{ type: "item", id: "subclass-choices", label: "Subclass Choices", step: 1 } as const]
          : []),
        { type: "divider", id: "class-spells", label: "Spellcasting" },
        { type: "item", id: "spells", label: "Spells", step: 1 },
      ],
    [currentClass.id, fighterAsiFeature?.name, fighterFightingStyleGroup?.name, subclassUnlocked],
  );
  const abilitySubmenuItems = useMemo<SidebarNavEntry[]>(
    () => [
      { type: "divider", id: "ability-core", label: "Ability Scores" },
      { type: "item", id: "abilities", label: "Ability Scores", step: 2 },
      ...(currentClass.id === "fighter"
        ? [{ type: "item", id: "fighter-asi", label: "ASI", step: 2 } as const]
        : []),
      { type: "divider", id: "ability-skills", label: "Skill Setup" },
      { type: "item", id: "skills", label: "Skills", step: 2 },
    ],
    [currentClass.id],
  );
  const activeSidebarItems = creatorStep === 0 ? classSubmenuItems : creatorStep === 1 ? subclassSubmenuItems : abilitySubmenuItems;
  const activeContextGroups = useMemo(() => {
    const groups: Array<{ id: string; label: string; items: Array<Extract<SidebarNavEntry, { type: "item" }>> }> = [];
    let currentGroup: { id: string; label: string; items: Array<Extract<SidebarNavEntry, { type: "item" }>> } | null = null;

    activeSidebarItems.forEach((entry) => {
      if (entry.type === "divider") {
        currentGroup = { id: entry.id, label: entry.label, items: [] };
        groups.push(currentGroup);
        return;
      }

      if (!currentGroup) {
        currentGroup = { id: "ungrouped", label: "Section", items: [] };
        groups.push(currentGroup);
      }

      currentGroup.items.push(entry);
    });

    return groups.filter((group) => group.items.length);
  }, [activeSidebarItems]);

  useEffect(() => {
    const currentMenuItem = creatorMenu.find((item) => item.id === creatorStep);
    const currentSubmenuItem = findSidebarNavItem(classSubmenuItems, creatorBrowser);
    const currentSubclassSubmenuItem = findSidebarNavItem(subclassSubmenuItems, creatorBrowser);
    const currentAbilitySubmenuItem = findSidebarNavItem(abilitySubmenuItems, creatorBrowser);
    if (currentMenuItem || currentSubmenuItem?.step === creatorStep || currentSubclassSubmenuItem?.step === creatorStep || currentAbilitySubmenuItem?.step === creatorStep) {
      return;
    }

    setCreatorBrowser(defaultBrowserForStep(creatorStep));
  }, [abilitySubmenuItems, classSubmenuItems, subclassSubmenuItems, creatorBrowser, creatorStep]);

  useEffect(() => {
    setSpellListPage(0);
    setPactCantripPage(0);
  }, [spellSearchQuery]);

  useEffect(() => {
    if (currentClass.id === "warlock" && creatorBrowser === "spells" && openWarlockGroup === "pact") {
      setOpenWarlockGroup("spells");
    }
  }, [creatorBrowser, currentClass.id, openWarlockGroup]);

  useEffect(() => {
    const matchedGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
    const matchedSubraceId =
      draft.speciesId === matchedGroup?.id
        ? ""
        : matchedGroup?.subraces.find((subrace) => subrace.id === draft.speciesId)?.id ??
      matchedGroup?.subraces[0]?.id ??
      "";
    const matchedLineageId = matchedGroup?.id ?? "";
    setSelectedLineageId((current) => (current === matchedLineageId ? current : matchedLineageId));
    setSelectedSubraceId((current) => (current === matchedSubraceId ? current : matchedSubraceId));
  }, [draft.speciesId, lineageGroups]);

  useEffect(() => {
    setLineageDetailTab("overview");
  }, [currentStructuredLineage?.id]);

  useEffect(() => {
    setSubraceDetailTab("overview");
  }, [currentStructuredSublineage?.id, currentSubraceEntry?.id]);

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
    setSelectedClassFeatureId(currentCuratedClass?.classFeatures[0]?.id ?? null);
  }, [currentCuratedClass?.id]);

  useEffect(() => {
    setSelectedSubclassFeatureId(currentVisibleSubclass?.features[0]?.id ?? null);
  }, [currentVisibleSubclass?.id]);

  useEffect(() => {
    setSelectedStructuredLineageFeatureId(currentStructuredLineage?.features[0]?.id ?? null);
  }, [currentStructuredLineage?.id]);

  useEffect(() => {
    setSelectedStructuredSublineageFeatureId(currentStructuredSublineage?.features[0]?.id ?? null);
  }, [currentStructuredSublineage?.id]);

  useEffect(() => {
    if (creatorBrowser === "ranger-choices" && currentClass.id !== "ranger") {
      setCreatorBrowser("class");
    }
  }, [creatorBrowser, currentClass.id]);

  useEffect(() => {
    if (creatorBrowser === "fighter-fighting-style" && currentClass.id !== "fighter" && currentClass.id !== "ranger") {
      setCreatorBrowser("class");
    }

    if (creatorBrowser === "fighter-asi" && currentClass.id !== "fighter") {
      setCreatorBrowser("class");
    }
  }, [creatorBrowser, currentClass.id]);

  useEffect(() => {
    if (!fighterJourneyActive) {
      setFighterProgressionOpen(false);
    }
  }, [fighterJourneyActive]);

  useEffect(() => {
    if (!fighterJourneyActive || !fighterJourneyStageItems.length) {
      return;
    }

    if (!fighterJourneyStageItems.some((item) => item.browser === creatorBrowser)) {
      setCreatorBrowser(fighterJourneyStageItems[0]?.browser ?? "class");
    }
  }, [creatorBrowser, fighterJourneyActive, fighterJourneyStageItems]);

  useEffect(() => {
    if (creatorBrowser === "lineage-choices" && !structuredLineageChoicesAvailable) {
      setCreatorBrowser("lineage");
    }

    if (creatorBrowser === "subrace" && !shouldShowSubraceNav) {
      setCreatorBrowser("lineage");
    }
  }, [creatorBrowser, shouldShowSubraceNav, structuredLineageChoicesAvailable]);

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
    setFighterSpellPage(0);
  }, [fighterSpellLevelFilter]);

  useEffect(() => {
    setFighterSpellPage((current) => Math.min(current, Math.max(0, fighterJourneySpellPageCount - 1)));
  }, [fighterJourneySpellPageCount]);

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

  const setFighterEquipmentChoice = (groupId: string, optionId: string) => {
    const equipmentGroup = classStartingEquipment.find((entry) => entry.id === groupId);
    const selectedOption = equipmentGroup?.options.find((option) => option.id === optionId);
    if (!equipmentGroup || !selectedOption) {
      return;
    }

    updateDraft((current) => {
      const currentChoices = current.fighterChoices?.equipmentChoiceIds ?? {};
      const previousOptionId = currentChoices[groupId] ?? null;
      const previousOption = equipmentGroup.options.find((option) => option.id === previousOptionId);
      const previousItems = new Set<string>(previousOption?.items ?? []);
      const trimmedInventory = current.inventory.filter((item) => !previousItems.has(item));
      const nextInventory = [...trimmedInventory];

      selectedOption.items.forEach((item) => {
        if (!nextInventory.includes(item)) {
          nextInventory.push(item);
        }
      });

      return {
        ...current,
        inventory: nextInventory,
        fighterChoices: {
          ...current.fighterChoices,
          fightingStyleId: current.fighterChoices?.fightingStyleId ?? null,
          superiorTechniqueManeuverId: current.fighterChoices?.superiorTechniqueManeuverId ?? null,
          equipmentChoiceIds: {
            ...(current.fighterChoices?.equipmentChoiceIds ?? {}),
            [groupId]: optionId,
          },
          abilityScoreImprovements: current.fighterChoices?.abilityScoreImprovements ?? {},
        },
      };
    });
  };

  useEffect(() => {
    const missingDefaults = classStartingEquipment
      .filter((group) => group.options.length === 1 && !draft.fighterChoices?.equipmentChoiceIds?.[group.id])
      .map((group) => ({ group, option: group.options[0] }));

    if (!missingDefaults.length) {
      return;
    }

    updateDraft((current) => {
      const currentChoices = current.fighterChoices?.equipmentChoiceIds ?? {};
      const nextInventory = [...current.inventory];
      const nextEquipmentChoiceIds = { ...currentChoices };
      let changed = false;

      missingDefaults.forEach(({ group, option }) => {
        if (currentChoices[group.id]) {
          return;
        }

        nextEquipmentChoiceIds[group.id] = option.id;
        option.items.forEach((item) => {
          if (!nextInventory.includes(item)) {
            nextInventory.push(item);
          }
        });
        changed = true;
      });

      if (!changed) {
        return current;
      }

      return {
        ...current,
        inventory: nextInventory,
        fighterChoices: {
          ...current.fighterChoices,
          fightingStyleId: current.fighterChoices?.fightingStyleId ?? null,
          superiorTechniqueManeuverId: current.fighterChoices?.superiorTechniqueManeuverId ?? null,
          equipmentChoiceIds: nextEquipmentChoiceIds,
          abilityScoreImprovements: current.fighterChoices?.abilityScoreImprovements ?? {},
        },
      };
    });
  }, [classStartingEquipment, draft.fighterChoices?.equipmentChoiceIds]);

  const setBackgroundToolChoice = (choiceId: string, optionId: string, count: number) => {
    updateDraft((current) => {
      const currentValues = current.backgroundToolChoiceIds?.[choiceId] ?? [];
      const nextValues = count === 1
        ? [optionId]
        : currentValues.includes(optionId)
          ? currentValues.filter((value) => value !== optionId)
          : [...currentValues, optionId].slice(0, count);

      return {
        ...current,
        backgroundToolChoiceIds: {
          ...(current.backgroundToolChoiceIds ?? {}),
          [choiceId]: nextValues,
        },
      };
    });
  };

  const selectBackground = (backgroundId: string) => {
    const nextBackground = content.backgrounds.find((item) => item.id === backgroundId);
    const nextEquipment = nextBackground?.equipment ?? [];

    updateDraft((current) => {
      const baseInventory = current.inventory.filter((item) => !allBackgroundEquipment.includes(item));

      return {
        ...current,
        backgroundId,
        backgroundToolChoiceIds: {},
        inventory: [
          ...baseInventory,
          ...nextEquipment.filter((item) => !baseInventory.includes(item)),
        ],
      };
    });
  };

  const renderBackgroundToolCards = (keyPrefix: string) => {
    if (!selectedBackground) {
      return null;
    }

    return (
      <>
        {selectedBackground.toolProficiencies.fixed.map((toolName) => (
          <article key={`${keyPrefix}-fixed-${toolName}`} className="fighter-feature-card compact unlocked">
            <div className="fighter-feature-card-head">
              <strong>{toolName}</strong>
              <span className="fighter-feature-check" aria-hidden="true">✓</span>
            </div>
          </article>
        ))}
        {selectedBackground.toolProficiencies.choices.map((choice) => {
          const selectedValues = draft.backgroundToolChoiceIds?.[choice.id] ?? [];
          return (
            <div key={`${keyPrefix}-${choice.id}`} className="background-tool-choice-group">
              <span className="background-tool-choice-label">{choice.label}</span>
              <div className="fighter-feature-grid compact fighter-equipment-source-grid">
                {toolChoiceOptions(content, choice.options).map((optionId) => {
                  const tool = content.tools.find((entry) => entry.id === optionId);
                  const label = tool?.name ?? toolCategoryLabels[optionId] ?? optionId;
                  const isSelected = selectedValues.includes(optionId);
                  return (
                    <button
                      key={`${keyPrefix}-${choice.id}-${optionId}`}
                      type="button"
                      className={isSelected ? "fighter-journey-card active tool-choice-card" : "fighter-journey-card tool-choice-card"}
                      onClick={() => setBackgroundToolChoice(choice.id, optionId, choice.count)}
                    >
                      <span className="fighter-journey-card-label">{isSelected ? "Selected" : "Choose"}</span>
                      <strong>{label}</strong>
                      {tool?.cost || tool?.weight ? (
                        <span>{[tool.cost, tool.weight].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  const renderEquipmentChoiceGroup = (group: ClassStartingEquipmentGroup, keyPrefix: string) => {
    const selectedOptionId = draft.fighterChoices?.equipmentChoiceIds?.[group.id] ?? null;
    const simpleOptionIds = new Set(simpleWeaponOptions.map((option) => option.id));
    const simpleOptions = group.options.filter((option) => simpleOptionIds.has(option.id));
    const warlockBackupWeaponOptions = simpleWeaponOptions
      .map((weaponOption) => ({
        weaponOption,
        option: group.options.find((option) => option.id === `leather-${weaponOption.id}-daggers`) ?? null,
      }))
      .filter((entry): entry is { weaponOption: (typeof simpleWeaponOptions)[number]; option: ClassStartingEquipmentGroup["options"][number] } =>
        Boolean(entry.option),
      );
    const rangerTwoSimpleMeleeOptions = simpleMeleeWeaponOptions.flatMap((firstWeapon) =>
      simpleMeleeWeaponOptions.map((secondWeapon) => ({
        firstWeapon,
        secondWeapon,
        option: group.options.find((option) => option.id === `two-simple-melee-${firstWeapon.id}-${secondWeapon.id}`) ?? null,
      })),
    ).filter((entry): entry is {
      firstWeapon: (typeof simpleMeleeWeaponOptions)[number];
      secondWeapon: (typeof simpleMeleeWeaponOptions)[number];
      option: ClassStartingEquipmentGroup["options"][number];
    } => Boolean(entry.option));
    const selectedTwoSimpleMeleeOption = rangerTwoSimpleMeleeOptions.find((entry) => entry.option.id === selectedOptionId) ?? null;
    const fighterMartialShieldOptions = martialWeaponOptions
      .map((weaponOption) => ({
        weaponOption,
        option: group.options.find((option) => option.id === `martial-shield-${weaponOption.id}`) ?? null,
      }))
      .filter((entry): entry is { weaponOption: (typeof martialWeaponOptions)[number]; option: ClassStartingEquipmentGroup["options"][number] } =>
        Boolean(entry.option),
      );
    const selectedMartialShieldOption = fighterMartialShieldOptions.find((entry) => entry.option.id === selectedOptionId) ?? null;
    const fighterTwoMartialOptions = martialWeaponOptions.flatMap((firstWeapon) =>
      martialWeaponOptions.map((secondWeapon) => ({
        firstWeapon,
        secondWeapon,
        option: group.options.find((option) => option.id === `two-martial-${firstWeapon.id}-${secondWeapon.id}`) ?? null,
      })),
    ).filter((entry): entry is {
      firstWeapon: (typeof martialWeaponOptions)[number];
      secondWeapon: (typeof martialWeaponOptions)[number];
      option: ClassStartingEquipmentGroup["options"][number];
    } => Boolean(entry.option));
    const selectedTwoMartialOption = fighterTwoMartialOptions.find((entry) => entry.option.id === selectedOptionId) ?? null;
    const groupedOptionIds = new Set([
      ...simpleOptions.map((option) => option.id),
      ...warlockBackupWeaponOptions.map((entry) => entry.option.id),
      ...rangerTwoSimpleMeleeOptions.map((entry) => entry.option.id),
      ...fighterMartialShieldOptions.map((entry) => entry.option.id),
      ...fighterTwoMartialOptions.map((entry) => entry.option.id),
    ]);
    const directOptions = group.options.filter((option) => !groupedOptionIds.has(option.id));
    const selectedSimpleOption = simpleOptions.find((option) => option.id === selectedOptionId) ?? null;
    const selectedBackupOption = warlockBackupWeaponOptions.find((entry) => entry.option.id === selectedOptionId) ?? null;

    return (
      <div key={`${keyPrefix}-${group.id}`} className="equipment-choice-group">
        <strong>{group.prompt}</strong>
        <div className="fighter-journey-grid equipment-choice-grid">
          {directOptions.map((option) => (
            <button
              key={`${keyPrefix}-${group.id}-${option.id}`}
              type="button"
              className={selectedOptionId === option.id ? "fighter-journey-card active" : "fighter-journey-card"}
              onClick={() => setFighterEquipmentChoice(group.id, option.id)}
            >
              <span className="fighter-journey-card-label">{selectedOptionId === option.id ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label={option.label}
                  content={equipmentTooltipContent(content, option.label, option.items)}
                />
              </strong>
            </button>
          ))}
          {simpleOptions.length ? (
            <div className={selectedSimpleOption ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
              <span className="fighter-journey-card-label">{selectedSimpleOption ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label={selectedSimpleOption?.label ?? "Any Simple Weapon"}
                  content={equipmentTooltipContent(content, selectedSimpleOption?.label ?? "Any Simple Weapon", selectedSimpleOption?.items ?? [])}
                />
              </strong>
              <select
                className="equipment-picker-select"
                value={selectedSimpleOption?.id ?? ""}
                onChange={(event) => setFighterEquipmentChoice(group.id, event.target.value)}
              >
                <option value="" disabled>
                  Choose weapon
                </option>
                {simpleOptions.map((option) => (
                  <option key={`${keyPrefix}-${group.id}-simple-${option.id}`} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {warlockBackupWeaponOptions.length ? (
            <div className={selectedBackupOption ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
              <span className="fighter-journey-card-label">{selectedBackupOption ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label={selectedBackupOption?.option.label ?? "Leather Armor, Simple Weapon, and Two Daggers"}
                  content={equipmentTooltipContent(
                    content,
                    selectedBackupOption?.option.label ?? "Leather Armor, Simple Weapon, and Two Daggers",
                    selectedBackupOption?.option.items ?? ["Leather Armor", "Simple Weapon", "2x Daggers"],
                  )}
                />
              </strong>
              <select
                className="equipment-picker-select"
                value={selectedBackupOption?.option.id ?? ""}
                onChange={(event) => setFighterEquipmentChoice(group.id, event.target.value)}
              >
                <option value="" disabled>
                  Choose weapon
                </option>
                {warlockBackupWeaponOptions.map(({ weaponOption, option }) => (
                  <option key={`${keyPrefix}-${group.id}-backup-${option.id}`} value={option.id}>
                    {weaponOption.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {rangerTwoSimpleMeleeOptions.length ? (
            <div className={selectedTwoSimpleMeleeOption ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
              <span className="fighter-journey-card-label">{selectedTwoSimpleMeleeOption ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label="Two Simple Melee Weapons"
                  content={equipmentTooltipContent(
                    content,
                    "Two Simple Melee Weapons",
                    selectedTwoSimpleMeleeOption?.option.items ?? [],
                  )}
                />
              </strong>
              <div className="equipment-dual-picker">
                <label>
                  <span>Weapon 1</span>
                  <select
                    className="equipment-picker-select"
                    value={selectedTwoSimpleMeleeOption?.firstWeapon.id ?? ""}
                    onChange={(event) => {
                      const firstWeaponId = event.target.value;
                      const secondWeaponId = selectedTwoSimpleMeleeOption?.secondWeapon.id ?? simpleMeleeWeaponOptions[0]?.id ?? "";
                      const nextOption = group.options.find((option) => option.id === `two-simple-melee-${firstWeaponId}-${secondWeaponId}`);
                      if (nextOption) {
                        setFighterEquipmentChoice(group.id, nextOption.id);
                      }
                    }}
                  >
                    <option value="" disabled>Choose weapon</option>
                    {simpleMeleeWeaponOptions.map((option) => (
                      <option key={`${keyPrefix}-${group.id}-melee-1-${option.id}`} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Weapon 2</span>
                  <select
                    className="equipment-picker-select"
                    value={selectedTwoSimpleMeleeOption?.secondWeapon.id ?? ""}
                    onChange={(event) => {
                      const firstWeaponId = selectedTwoSimpleMeleeOption?.firstWeapon.id ?? simpleMeleeWeaponOptions[0]?.id ?? "";
                      const secondWeaponId = event.target.value;
                      const nextOption = group.options.find((option) => option.id === `two-simple-melee-${firstWeaponId}-${secondWeaponId}`);
                      if (nextOption) {
                        setFighterEquipmentChoice(group.id, nextOption.id);
                      }
                    }}
                  >
                    <option value="" disabled>Choose weapon</option>
                    {simpleMeleeWeaponOptions.map((option) => (
                      <option key={`${keyPrefix}-${group.id}-melee-2-${option.id}`} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
          {fighterMartialShieldOptions.length ? (
            <div className={selectedMartialShieldOption ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
              <span className="fighter-journey-card-label">{selectedMartialShieldOption ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label={selectedMartialShieldOption?.option.label ?? "Martial Weapon and Shield"}
                  content={equipmentTooltipContent(
                    content,
                    selectedMartialShieldOption?.option.label ?? "Martial Weapon and Shield",
                    selectedMartialShieldOption?.option.items ?? ["Martial Weapon", "Shield"],
                  )}
                />
              </strong>
              <select
                className="equipment-picker-select"
                value={selectedMartialShieldOption?.option.id ?? ""}
                onChange={(event) => setFighterEquipmentChoice(group.id, event.target.value)}
              >
                <option value="" disabled>
                  Choose weapon
                </option>
                {fighterMartialShieldOptions.map(({ weaponOption, option }) => (
                  <option key={`${keyPrefix}-${group.id}-martial-shield-${option.id}`} value={option.id}>
                    {weaponOption.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {fighterTwoMartialOptions.length ? (
            <div className={selectedTwoMartialOption ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
              <span className="fighter-journey-card-label">{selectedTwoMartialOption ? "Selected" : "Choose"}</span>
              <strong>
                <HoverTooltip
                  label="Two Martial Weapons"
                  content={equipmentTooltipContent(
                    content,
                    "Two Martial Weapons",
                    selectedTwoMartialOption?.option.items ?? [],
                  )}
                />
              </strong>
              <div className="equipment-dual-picker">
                <label>
                  <span>Weapon 1</span>
                  <select
                    className="equipment-picker-select"
                    value={selectedTwoMartialOption?.firstWeapon.id ?? ""}
                    onChange={(event) => {
                      const firstWeaponId = event.target.value;
                      const secondWeaponId = selectedTwoMartialOption?.secondWeapon.id ?? martialWeaponOptions[0]?.id ?? "";
                      const nextOption = group.options.find((option) => option.id === `two-martial-${firstWeaponId}-${secondWeaponId}`);
                      if (nextOption) {
                        setFighterEquipmentChoice(group.id, nextOption.id);
                      }
                    }}
                  >
                    <option value="" disabled>Choose weapon</option>
                    {martialWeaponOptions.map((option) => (
                      <option key={`${keyPrefix}-${group.id}-martial-1-${option.id}`} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Weapon 2</span>
                  <select
                    className="equipment-picker-select"
                    value={selectedTwoMartialOption?.secondWeapon.id ?? ""}
                    onChange={(event) => {
                      const firstWeaponId = selectedTwoMartialOption?.firstWeapon.id ?? martialWeaponOptions[0]?.id ?? "";
                      const secondWeaponId = event.target.value;
                      const nextOption = group.options.find((option) => option.id === `two-martial-${firstWeaponId}-${secondWeaponId}`);
                      if (nextOption) {
                        setFighterEquipmentChoice(group.id, nextOption.id);
                      }
                    }}
                  >
                    <option value="" disabled>Choose weapon</option>
                    {martialWeaponOptions.map((option) => (
                      <option key={`${keyPrefix}-${group.id}-martial-2-${option.id}`} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const selectLineage = (lineageId: string) => {
    const group = lineageGroups.find((entry) => entry.id === lineageId);
    if (!group) {
      return;
    }

    const firstSubrace = group.subraces[0] ?? null;
    setSelectedLineageId(group.id);
    setSelectedSubraceId(firstSubrace?.id ?? "");
    setLineageDetailTab("overview");
    setSubraceDetailTab("overview");

    updateDraft((current) => ({
      ...current,
      speciesId: group.id,
    }));
  };

  const selectLineageCard = (card: LineageCard) => {
    if (card.subraceId) {
      setSelectedLineageId(card.lineageId);
      setSelectedSubraceId(card.subraceId);
      setLineageDetailTab("overview");
      setSubraceDetailTab("overview");
      updateDraft((current) => ({ ...current, speciesId: card.subraceId! }));
      return;
    }

    selectLineage(card.lineageId);
  };

  const selectSubrace = (subraceId: string) => {
    if (subraceId === "__none__") {
      setSelectedSubraceId("");
      setSubraceDetailTab("overview");
      updateDraft((current) => ({ ...current, speciesId: currentLineageGroup.id }));
      return;
    }

    setSelectedSubraceId(subraceId);
    setSubraceDetailTab("overview");
    updateDraft((current) => ({ ...current, speciesId: subraceId }));
  };

  const setLineageChoiceSelection = (choiceGroupId: string, optionId: string, multiSelect = false) => {
    updateDraft((current) => {
      const currentValues = current.lineageChoices?.[choiceGroupId] ?? [];
      const currentGroup = currentStructuredChoiceGroupMap.get(choiceGroupId);
      if (!multiSelect && optionId === "__none__") {
        const nextLineageChoices = { ...(current.lineageChoices ?? {}) };
        delete nextLineageChoices[choiceGroupId];

        if (currentGroup) {
          currentGroup.options.forEach((option) => {
            collectChoiceOptionDescendantGroupIds(option, currentStructuredChoiceGroupMap).forEach((groupId) => {
              delete nextLineageChoices[groupId];
            });
          });
        }

        return {
          ...current,
          lineageChoices: nextLineageChoices,
        };
      }
      const nextValues = multiSelect
        ? currentValues.includes(optionId)
          ? currentValues.filter((value) => value !== optionId)
          : [...currentValues, optionId]
        : [optionId];
      const nextLineageChoices = {
        ...(current.lineageChoices ?? {}),
        [choiceGroupId]: nextValues,
      };

      if (currentGroup) {
        const optionIdsToClear = multiSelect
          ? currentValues.includes(optionId)
            ? [optionId]
            : []
          : currentValues.filter((value) => value !== optionId);

        optionIdsToClear.forEach((selectedOptionId) => {
          const selectedOption = currentGroup.options.find((option) => option.id === selectedOptionId);
          if (!selectedOption) {
            return;
          }

          collectChoiceOptionDescendantGroupIds(selectedOption, currentStructuredChoiceGroupMap).forEach((childGroupId) => {
            delete nextLineageChoices[childGroupId];
          });
        });
      }

      return {
        ...current,
        lineageChoices: nextLineageChoices,
      };
    });
  };

  const updateFighterAsiChoice = (
    level: number,
    updater: (
      current:
        | {
            mode: "plus-two" | "split" | "feat" | null;
            plusTwoAbilityId: AbilityId | null;
            plusOneAbilityIds: AbilityId[];
            featId: string | null;
          }
        | undefined,
    ) => {
      mode: "plus-two" | "split" | "feat" | null;
      plusTwoAbilityId: AbilityId | null;
      plusOneAbilityIds: AbilityId[];
      featId: string | null;
    },
  ) => {
    updateDraft((current) => ({
      ...current,
      fighterChoices: {
        ...current.fighterChoices,
        abilityScoreImprovements: {
          ...(current.fighterChoices?.abilityScoreImprovements ?? {}),
          [level]: updater(current.fighterChoices?.abilityScoreImprovements?.[level]),
        },
      },
    }));
  };

  const clearFighterAsiChoice = (level: number) => {
    updateDraft((current) => {
      const nextChoices = { ...(current.fighterChoices?.abilityScoreImprovements ?? {}) };
      const previousFeatId = nextChoices[level]?.featId ?? null;
      delete nextChoices[level];
      return {
        ...current,
        featIds: previousFeatId ? current.featIds.filter((featId) => featId !== previousFeatId) : current.featIds,
        fighterChoices: {
          ...current.fighterChoices,
          abilityScoreImprovements: nextChoices,
        },
      };
    });
  };

  const setFighterAsiFeatChoice = (level: number, featId: string) => {
    updateDraft((current) => {
      const previousFeatId = current.fighterChoices?.abilityScoreImprovements?.[level]?.featId ?? null;
      const nextFeatIds = [
        ...current.featIds.filter((entry) => entry !== previousFeatId && entry !== featId),
        ...(featId ? [featId] : []),
      ];
      return {
        ...current,
        featIds: nextFeatIds,
        fighterChoices: {
          ...current.fighterChoices,
          abilityScoreImprovements: {
            ...(current.fighterChoices?.abilityScoreImprovements ?? {}),
            [level]: {
              mode: "feat",
              plusTwoAbilityId: null,
              plusOneAbilityIds: [],
              featId: featId || null,
            },
          },
        },
      };
    });
  };

  const setSuperiorTechniqueManeuver = (maneuverId: string) => {
    updateDraft((current) => ({
      ...current,
      fighterChoices: {
        ...current.fighterChoices,
        superiorTechniqueManeuverId: maneuverId || null,
      },
    }));
  };

  const setHighElfCantripChoice = (spellId: string) => {
    updateDraft((current) => ({
      ...current,
      lineageChoices: {
        ...(current.lineageChoices ?? {}),
        "high-elf-cantrip-choice": spellId ? [spellId] : [],
      },
    }));
  };

  const navigateFighterJourney = (targetBrowser: CreatorBrowser) => {
    const currentIndex = fighterJourneySceneOrder.indexOf(fighterJourneyScene);
    const targetScene = fighterSceneFromBrowser(targetBrowser, fighterJourneySubclassId, currentClass.id);
    const targetIndex = fighterJourneySceneOrder.indexOf(targetScene);
    setFighterJourneyDirection(targetIndex >= currentIndex ? 1 : -1);
    moveCreatorStep(1);
    setCreatorBrowser(targetBrowser);
  };

  const chooseFighterClassJourney = () => {
    navigateFighterJourney("class-features");
  };

  const chooseFighterStyleJourney = (styleId: string) => {
    setFighterFightingStyle(styleId);
  };

  const chooseFighterSubclassJourney = (subclassId: string) => {
    updateDraft((current) => ({
      ...current,
      selectedSubclassOptions: subclassId ? [subclassId] : [],
    }));
  };

  const fighterJourneyActiveIndex = fighterJourneyStageItems.findIndex((item) => item.browser === creatorBrowser);
  const fighterJourneyPreviousBrowser =
    fighterJourneyActiveIndex > 0 ? fighterJourneyStageItems[fighterJourneyActiveIndex - 1]?.browser ?? null : null;
  const fighterJourneyNextBrowser =
    fighterJourneyActiveIndex >= 0 && fighterJourneyActiveIndex < fighterJourneyStageItems.length - 1
      ? fighterJourneyStageItems[fighterJourneyActiveIndex + 1]?.browser ?? null
      : null;

  const fighterAsiProjectedScore = (abilityId: AbilityId, level: number) => {
    const baseScore = draft.abilities.find((ability) => ability.id === abilityId)?.score ?? 8;
    const racialBonus = previewAbilityBonuses
      .filter((entry) => entry.ability === abilityId)
      .reduce((total, entry) => total + entry.amount, 0);
    const flexibleBonus = flexiblePreviewBonuses
      .filter((entry) => entry.ability === abilityId)
      .reduce((total, entry) => total + entry.amount, 0);
    const existingAsiBonus = fighterAsiLevelChoices(fighterAsiChoices, level).get(abilityId) ?? 0;
    return baseScore + racialBonus + flexibleBonus + existingAsiBonus;
  };

  const renderLineageChoiceGroup = (
    group: LineageChoiceGroup,
    nested = false,
    choiceGroupMap: Map<string, LineageChoiceGroup> = currentStructuredChoiceGroupMap,
  ): ReactNode => {
    const resolvedGroup = resolvedLineageChoiceGroup(group);
    const selectedValues = draft.lineageChoices?.[resolvedGroup.id] ?? [];
    const selectedOptions = resolvedGroup.options.filter((option) => selectedValues.includes(option.id));

    return (
      <article key={resolvedGroup.id} className="creator-panel identity-detail-panel creator-subpanel-flat">
        <div className="identity-detail-head">
          <span className="mini-heading creator-section-label">{nested ? "Follow-up Choice" : "Lineage Choice"}</span>
          <h4>{resolvedGroup.name}</h4>
        </div>
        <div className="lineage-choice-list">
          {resolvedGroup.type === "single-select" ? (
            <button
              type="button"
              className={!selectedValues.length ? "lineage-choice-row active" : "lineage-choice-row"}
              onClick={() => setLineageChoiceSelection(resolvedGroup.id, "__none__", false)}
            >
              <span className="lineage-choice-row-copy">
                <strong>None</strong>
                <span className="lineage-choice-option-copy">Leave this selection empty for now.</span>
              </span>
              <span className="lineage-choice-row-state">{!selectedValues.length ? "Selected" : "Skip"}</span>
            </button>
          ) : null}
          {resolvedGroup.options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={selectedValues.includes(option.id) ? "lineage-choice-row active" : "lineage-choice-row"}
              onClick={() => setLineageChoiceSelection(resolvedGroup.id, option.id, resolvedGroup.type === "multi-select")}
            >
              <span className="lineage-choice-row-copy">
                <strong>{option.label}</strong>
                {structuredChoiceOptionSummary(option) ? (
                  <span className="lineage-choice-option-copy">{structuredChoiceOptionSummary(option)}</span>
                ) : null}
              </span>
              <span className="lineage-choice-row-state">{selectedValues.includes(option.id) ? "Selected" : "Choose"}</span>
            </button>
          ))}
        </div>
        {selectedOptions.length ? (
          <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
            <strong>{resolvedGroup.type === "single-select" ? selectedOptions[0]?.label ?? "Selected" : "Selected"}</strong>
            <div className="class-feature-detail-body">
              {resolvedGroup.type === "single-select" && selectedOptions[0] ? (
                <>
                  {structuredChoiceOptionSummary(selectedOptions[0]) ? <p>{structuredChoiceOptionSummary(selectedOptions[0])}</p> : null}
                  {selectedOptions[0].details?.length
                    ? selectedOptions[0].details.map((detail) => (
                        <div key={`${selectedOptions[0]?.id}-${detail.title}`} className="lineage-choice-detail-block">
                          <strong>{detail.title}</strong>
                          <p>{detail.body}</p>
                        </div>
                      ))
                    : null}
                </>
              ) : (
                <p>{selectedOptions.map((option) => option.label).join(" | ")}</p>
              )}
            </div>
          </article>
        ) : null}
        {selectedOptions.length
          ? selectedOptions.flatMap((option) =>
              option.childChoiceGroupIds
                .map((childGroupId) => choiceGroupMap.get(childGroupId))
                .filter((entry): entry is LineageChoiceGroup => Boolean(entry))
                .map((childGroup) => (
                  <div key={`${resolvedGroup.id}-${option.id}-${childGroup.id}`} className="creator-subsection-stack">
                    {renderLineageChoiceGroup(childGroup, true, choiceGroupMap)}
                  </div>
                )),
            )
          : null}
      </article>
    );
  };

  const previewPanelAbilities = previewAbilities.map((ability) => ({
    id: ability.id,
    value: ability.previewScore,
  }));
  const previewPanelStats = [
    { label: "Armor Class", value: String(draft.armorClass) },
    { label: "Initiative", value: `${draft.initiative >= 0 ? "+" : ""}${draft.initiative}` },
    { label: "Speed", value: draft.speed },
    { label: "Hit Points", value: String(draft.maxHp) },
  ] as const;
  const previewPanelArcaneStats = [
    { label: "Spell Save DC", value: String(8 + draft.proficiencyBonus + intelligenceModifier) },
    {
      label: "Spell Attack",
      value: `${draft.proficiencyBonus + intelligenceModifier >= 0 ? "+" : ""}${draft.proficiencyBonus + intelligenceModifier}`,
    },
  ] as const;
  const previewPanelProficiencies = [
    { label: "Weapons", value: compactPreviewValue(draft.proficiencies.weapons.join(", ") || "None", 2) },
    { label: "Armor", value: compactPreviewValue(draft.proficiencies.armor.join(", ") || "None", 2) },
    {
      label: "Skills",
      value: compactPreviewValue(
        draft.skills
          .filter((skill) => skill.proficient || draft.selectedSkillIds.includes(skill.id) || backgroundSkillIds.includes(skill.id))
          .map((skill) => skill.label)
          .join(", ") || "None",
        3,
      ),
    },
  ] as const;
  return (
    <div className="creator-layout">
      <div className="creator-ambient creator-ambient-left" aria-hidden="true" />
      <div className="creator-ambient creator-ambient-right" aria-hidden="true" />

      <div className="creator-workbench creator-workbench-navigation creator-workbench-flat">
        <aside className="creator-stage-rail" aria-label="Creator primary navigation">
          <article className="sheet-card creator-stage-rail-card">
            <div className="creator-stage-rail-head">
              <span className="mini-heading">Sections</span>
            </div>
            <div className="creator-stage-rail-list">
              {creatorMenu.map((item) => (
                <button
                  key={`rail-tab-${item.id}`}
                  type="button"
                  className={creatorStep === item.id ? "creator-stage-rail-button active" : "creator-stage-rail-button"}
                  onClick={() => {
                    moveCreatorStep(item.id);
                    if (item.id === 1 && fighterJourneyStageItems.length) {
                      setCreatorBrowser(fighterJourneyStageItems[0]?.browser ?? "class-features");
                      return;
                    }
                    setCreatorBrowser(defaultBrowserForStep(item.id));
                  }}
                >
                  <span className="creator-stage-rail-icon" aria-hidden="true">
                    <AppIcon
                      name={
                        item.id === 0 ? summaryIcon("lineage") : item.id === 1 ? summaryIcon("class") : summaryIcon("abilities")
                      }
                      className="summary-icon"
                    />
                  </span>
                  <span className="creator-stage-rail-copy">
                    <strong>{item.label}</strong>
                    <span>{creatorMenuDescriptions[item.id]}</span>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </aside>
        <div className="creator-stage-column">
          <section className="creator-stage-header-card" aria-label="Creator stage navigation">
            <div className="creator-stage-header-tabs">
              {creatorStep === 1 && fighterJourneyStageItems.length ? (
                <div className="creator-subtabs">
                  {fighterJourneyStageItems.map((item) => (
                    <button
                      key={`fighter-stage-${item.id}`}
                      type="button"
                      className={creatorBrowser === item.browser ? "creator-subtab active" : "creator-subtab"}
                      onClick={() => navigateFighterJourney(item.browser)}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              {!fighterJourneyActive && activeContextGroups.length ? (
                <div className="creator-subtabs creator-context-tabs" aria-label="Section content navigation">
                  {activeContextGroups.map((group) => (
                    <div key={`context-group-${group.id}`} className="creator-context-group">
                      <span className="creator-context-label">{group.label}</span>
                      <div className="creator-context-buttons creator-subtabs">
                        {group.items.map((item) => (
                          <button
                            key={`context-tab-${item.id}`}
                            type="button"
                            className={creatorBrowser === item.id ? "creator-subtab active" : "creator-subtab"}
                            onClick={() => {
                              moveCreatorStep(item.step);
                              setCreatorBrowser(item.id);
                            }}
                          >
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
          <div className="creator-main-panel creator-main-panel-clean creator-main-panel-flat">
          {fighterJourneyActive ? (
            <div className="creator-stack fighter-journey-stack">
              <AnimatePresence mode="wait" custom={fighterJourneyDirection}>
                <motion.section
                  key={fighterJourneyScene}
                  className={
                    [
                      "creator-panel",
                      "creator-panel-wide",
                      "fighter-journey-panel",
                      fighterJourneyScene === "fighter-features" || fighterJourneyScene === "fighter-equipment" || fighterJourneyScene === "fighter-style" || fighterJourneyScene === "fighter-asi" || fighterJourneyScene === "fighter-class" || fighterJourneyScene === "fighter-eldritch" || fighterJourneyScene === "warlock-pact" || fighterJourneyScene === "warlock-spells"
                        ? "creator-stage-panel-flat fighter-journey-panel-plain"
                        : "",
                      fighterJourneySubclassId === "eldritch-knight" ? "is-arcane" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                  initial={{ x: fighterJourneyDirection > 0 ? 100 : -100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: fighterJourneyDirection > 0 ? -100 : 100, opacity: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {fighterJourneyScene === "fighter-class" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Class</h3>
                        <p>Choose the class you want to build, then review its core identity and progression before moving deeper into specialization.</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <div className="class-grid creator-class-grid-journey">
                        {content.classes.map((item) => {
                          const isActive = draft.classId === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={isActive ? "class-grid-card active" : "class-grid-card"}
                              onClick={() => {
                                updateDraft((current) => ({
                                  ...current,
                                  classId: item.id,
                                  multiclassIds: current.multiclassIds.filter((entry) => entry !== item.id),
                                  selectedSubclassOptions: [],
                                  spellIds: [],
                                }));
                                if (item.id === "fighter") {
                                  setFighterJourneyDirection(0);
                                  setCreatorBrowser("class");
                                } else {
                                  moveCreatorStep(1);
                                  setCreatorBrowser("class");
                                }
                              }}
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
                      <div className="fighter-journey-class-stack">
                        <div className="fighter-journey-scene-head compact">
                          <h3>{currentCuratedClass?.name ?? currentClass.name}</h3>
                          <p>{currentCuratedClass?.summary ?? classDescription(currentClass)}</p>
                        </div>
                        <div className="fighter-class-stat-row">
                          <div className="fighter-class-stat-card">
                            <span>Base HP</span>
                            <strong>{currentCuratedClass?.hitPoints["Hit Points at 1st Level"] || `${currentClass.hitDie} + CON modifier`}</strong>
                          </div>
                          <div className="fighter-class-stat-card">
                            <span>Hit Dice</span>
                            <strong>{currentCuratedClass?.hitPoints["Hit Dice"] || `1d${currentClass.hitDie} per level`}</strong>
                          </div>
                        </div>
                        <div className="class-overview-highlights journey">
                          {classOverviewHighlights.map((item) => (
                            <article key={item.id} className="class-overview-highlight">
                              <strong>{item.title}</strong>
                              <p>{item.body}</p>
                            </article>
                          ))}
                        </div>
                        {currentCuratedClass?.spellcastingTable.rows.length ? (
                          <div className="class-table-card creator-subpanel-flat creator-subsection-divider journey-modern">
                            <div className="identity-detail-head compact">
                              <span className="mini-heading creator-section-label class-section-label">Progression</span>
                            </div>
                            <div className="class-progression-scroll journey-modern">
                              <table className="class-progression-table journey-modern">
                                <thead>
                                  {classProgressionHeaderRow.length ? (
                                    <tr>
                                      {classProgressionHeaderRow.map((cell, cellIndex) => (
                                        <th key={`${currentCuratedClass.id}-head-${cellIndex}`}>{cell}</th>
                                      ))}
                                    </tr>
                                  ) : null}
                                </thead>
                                <tbody>
                                  {classProgressionBodyRows.map((row, rowIndex) => (
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
                      </div>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-features" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Class Features</h3>
                        <p>{`Core ${currentClass.name} tools unlock over time. Hover a card to inspect the exact rule and how it scales.`}</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <div className="fighter-feature-grid">
                        {visibleClassFeatures.map((feature) => {
                          const unlockState = classFeatureUnlockState.get(feature.id);
                          const isUnlocked = unlockState?.acquired ?? true;
                          const currentMeta =
                            isUnlocked && unlockState?.currentSummary && unlockState.currentSummary !== "Unlocked"
                              ? unlockState.currentSummary
                              : null;
                          const nextMeta = isUnlocked ? unlockState?.nextSummary ?? null : null;
                          const lockedLevel =
                            typeof unlockState?.unlockLevel === "number"
                              ? unlockState.unlockLevel
                              : typeof feature.unlockLevel === "number"
                                ? feature.unlockLevel
                                : typeof feature.milestones?.[0]?.level === "number"
                                  ? feature.milestones[0].level
                                  : null;
                          return (
                            <article key={`fighter-feature-${feature.id}`} className={isUnlocked ? "fighter-feature-card unlocked" : "fighter-feature-card locked"}>
                              <div className="fighter-feature-card-head">
                                <HoverTooltip label={feature.name} content={featureTooltipContent(feature, draft.level)} />
                                {isUnlocked ? (
                                  <span className="fighter-feature-check" aria-hidden="true">✓</span>
                                ) : lockedLevel ? (
                                  <span className="fighter-feature-level">{`Lvl. ${lockedLevel}`}</span>
                                ) : null}
                              </div>
                              {currentMeta || nextMeta ? (
                                <div className="fighter-feature-meta">
                                  {currentMeta ? <span>{currentMeta}</span> : null}
                                  {nextMeta ? <span>{nextMeta}</span> : null}
                                </div>
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                      {currentClass.id === "ranger" ? (
                        <>
                          <div className="fighter-journey-scene-divider" aria-hidden="true" />
                          <div className="fighter-journey-scene-head compact">
                            <h3>Feature Choices</h3>
                            <p>Choose which optional ranger variants are active for this build.</p>
                          </div>
                          <div className="equipment-choice-stack">
                            <div className="equipment-choice-group">
                              <strong>Favored Path</strong>
                              <div className="fighter-journey-grid equipment-choice-grid">
                                <button type="button" className={!isRangerFavoredFoeMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerFavoredEnemyMode("enemy")}>
                                  <span className="fighter-journey-card-label">{!isRangerFavoredFoeMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Favored Enemy"
                                      content={rangerSectionTooltipContent(
                                        rangerFavoredEnemySection,
                                        "Favored Enemy",
                                        "Choose a favored enemy type, or two humanoid races. You gain tracking and recall advantages, plus one associated language.",
                                      )}
                                    />
                                  </strong>
                                  <span>Track and study chosen enemy types.</span>
                                </button>
                                <button type="button" className={isRangerFavoredFoeMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerFavoredEnemyMode("foe")}>
                                  <span className="fighter-journey-card-label">{isRangerFavoredFoeMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Favored Foe"
                                      content={rangerSectionTooltipContent(
                                        rangerFavoredFoeSection,
                                        "Favored Foe",
                                        "Mark a creature you hit and deal scaling extra damage the first time each turn you hit it.",
                                      )}
                                    />
                                  </strong>
                                  <span>Mark a target for scaling extra damage.</span>
                                </button>
                              </div>
                              {!isRangerFavoredFoeMode ? (
                                <div className="ranger-choice-grid">
                                  {visibleRangerFavoredEnemyChoices.map((entry, index) => (
                                    <div key={`journey-ranger-favored-enemy-${index}`} className="ranger-choice-card">
                                      <span className="fighter-journey-card-label">{`Choice ${index + 1}`}</span>
                                      <label className="ranger-choice-field">
                                        <span>Enemy Type</span>
                                        <select
                                          className="equipment-picker-select"
                                          value={entry.enemyType}
                                          onChange={(event) => updateRangerFavoredEnemyChoice(index, "enemyType", event.target.value)}
                                        >
                                          {rangerFavoredEnemyOptions.map((option) => (
                                            <option key={`journey-ranger-enemy-option-${option}`} value={option}>
                                              {rangerEnemyLabel(option)}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      {entry.enemyType === "humanoids" ? (
                                        <label className="ranger-choice-field">
                                          <span>Humanoid Races</span>
                                          <input
                                            className="equipment-picker-select"
                                            value={entry.humanoidRaces}
                                            onChange={(event) => updateRangerFavoredEnemyChoice(index, "humanoidRaces", event.target.value)}
                                            placeholder="gnolls, orcs"
                                          />
                                        </label>
                                      ) : null}
                                      <label className="ranger-choice-field">
                                        <span>Language</span>
                                        <select
                                          className="equipment-picker-select"
                                          value={entry.language}
                                          onChange={(event) => updateRangerFavoredEnemyChoice(index, "language", event.target.value)}
                                        >
                                          {rangerLanguageOptions.map((option) => (
                                            <option key={`journey-ranger-language-option-${option}`} value={option}>
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
                                    <strong>Uses</strong>
                                    <span>{`${draft.proficiencyBonus} per long rest`}</span>
                                  </div>
                                  <div className="lineage-detail-meta-item">
                                    <strong>Extra Damage</strong>
                                    <span>{rangerFavoredFoeDamage(draft.level)}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="equipment-choice-group">
                              <strong>Explorer</strong>
                              <div className="fighter-journey-grid equipment-choice-grid">
                                <button type="button" className={!isRangerDeftExplorerMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerFavoredTerrainMode("terrain")}>
                                  <span className="fighter-journey-card-label">{!isRangerDeftExplorerMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Natural Explorer"
                                      content={rangerSectionTooltipContent(
                                        rangerNaturalExplorerSection,
                                        "Natural Explorer",
                                        "Choose favored terrain and gain doubled proficiency on relevant proficient checks plus travel benefits.",
                                      )}
                                    />
                                  </strong>
                                  <span>Specialize in favored terrain travel.</span>
                                </button>
                                <button type="button" className={isRangerDeftExplorerMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerFavoredTerrainMode("deft")}>
                                  <span className="fighter-journey-card-label">{isRangerDeftExplorerMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Deft Explorer"
                                      content={rangerSectionTooltipContent(
                                        rangerDeftExplorerSection,
                                        "Deft Explorer",
                                        "Choose Canny expertise and learn extra languages; later upgrades improve movement and endurance.",
                                      )}
                                    />
                                  </strong>
                                  <span>Gain Canny expertise and languages.</span>
                                </button>
                              </div>
                              {!isRangerDeftExplorerMode ? (
                                <div className="ranger-choice-grid">
                                  {visibleRangerFavoredTerrains.map((terrain, index) => (
                                    <div key={`journey-ranger-favored-terrain-${index}`} className="ranger-choice-card">
                                      <span className="fighter-journey-card-label">{`Terrain ${index + 1}`}</span>
                                      <label className="ranger-choice-field">
                                        <span>Favored Terrain</span>
                                        <select
                                          className="equipment-picker-select"
                                          value={terrain}
                                          onChange={(event) => updateRangerFavoredTerrain(index, event.target.value)}
                                        >
                                          {rangerTerrainOptions.map((option) => (
                                            <option key={`journey-ranger-terrain-option-${option}`} value={option}>
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
                                    <span className="fighter-journey-card-label">Canny</span>
                                    <label className="ranger-choice-field">
                                      <span>Skill Expertise</span>
                                      <select
                                        className="equipment-picker-select"
                                        value={draft.rangerChoices?.cannySkillId ?? ""}
                                        onChange={(event) => setRangerCannySkill(event.target.value)}
                                      >
                                        <option value="" disabled>Choose skill</option>
                                        {rangerCannySkillOptions.map((skill) => (
                                          <option key={`journey-ranger-canny-skill-${skill.id}`} value={skill.id}>
                                            {skill.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  </div>
                                  {rangerDeftLanguages.map((language, index) => (
                                    <div key={`journey-ranger-deft-language-${index}`} className="ranger-choice-card">
                                      <span className="fighter-journey-card-label">{`Language ${index + 1}`}</span>
                                      <label className="ranger-choice-field">
                                        <span>Language</span>
                                        <select
                                          className="equipment-picker-select"
                                          value={language}
                                          onChange={(event) => updateRangerDeftLanguage(index, event.target.value)}
                                        >
                                          {rangerLanguageOptions.map((option) => (
                                            <option key={`journey-ranger-deft-language-option-${index}-${option}`} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="equipment-choice-group">
                              <strong>Awareness</strong>
                              <div className="fighter-journey-grid equipment-choice-grid">
                                <button type="button" className={!isRangerPrimalAwarenessMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerAwarenessMode("primeval")}>
                                  <span className="fighter-journey-card-label">{!isRangerPrimalAwarenessMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Primeval Awareness"
                                      content={rangerSectionTooltipContent(
                                        rangerPrimevalAwarenessSection,
                                        "Primeval Awareness",
                                        "Use an action and expend a ranger spell slot to sense certain creature types nearby.",
                                      )}
                                    />
                                  </strong>
                                  <span>Sense creature types by spending slots.</span>
                                </button>
                                <button type="button" className={isRangerPrimalAwarenessMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerAwarenessMode("primal")}>
                                  <span className="fighter-journey-card-label">{isRangerPrimalAwarenessMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Primal Awareness"
                                      content={rangerSectionTooltipContent(
                                        rangerPrimalAwarenessSection,
                                        "Primal Awareness",
                                        "Automatically learn nature utility spells at certain ranger levels; they do not count against ranger spells known.",
                                      )}
                                    />
                                  </strong>
                                  <span>Auto-learn nature utility spells.</span>
                                </button>
                              </div>
                            </div>
                            <div className="equipment-choice-group">
                              <strong>Stealth</strong>
                              <div className="fighter-journey-grid equipment-choice-grid">
                                <button type="button" className={!isRangerNaturesVeilMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerHideMode("plain-sight")}>
                                  <span className="fighter-journey-card-label">{!isRangerNaturesVeilMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Hide in Plain Sight"
                                      content={rangerSectionTooltipContent(
                                        rangerHideInPlainSightSection,
                                        "Hide in Plain Sight",
                                        "Use camouflage materials to make yourself harder to detect.",
                                      )}
                                    />
                                  </strong>
                                  <span>Build camouflage for strong hiding.</span>
                                </button>
                                <button type="button" className={isRangerNaturesVeilMode ? "fighter-journey-card active" : "fighter-journey-card"} onClick={() => setRangerHideMode("natures-veil")}>
                                  <span className="fighter-journey-card-label">{isRangerNaturesVeilMode ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label="Nature's Veil"
                                      content={rangerSectionTooltipContent(
                                        rangerNaturesVeilSection,
                                        "Nature's Veil",
                                        "Use nature's power to turn invisible as a bonus action.",
                                      )}
                                    />
                                  </strong>
                                  <span>Turn invisible as a bonus action.</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-equipment" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Equipment</h3>
                        <p>Choose the fighter kit you start with. Background tool proficiencies are listed separately below.</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <article className="fighter-equipment-section">
                        <div className="equipment-choice-stack">
                          {classStartingEquipment.length ? classStartingEquipment.map((group) => renderEquipmentChoiceGroup(group, "journey")) : (
                            <div className="list-row">
                              <strong>No class equipment choices</strong>
                              <span>This class does not have curated starting equipment yet.</span>
                            </div>
                          )}
                        </div>
                      </article>
                      <article className="fighter-equipment-section">
                        <div className="fighter-equipment-source-row">
                          <span className="fighter-equipment-source-label">Background</span>
                          {hasSelectedBackgroundToolData ? (
                            <div className="fighter-feature-grid compact fighter-equipment-source-grid">
                              {renderBackgroundToolCards("background-tool")}
                            </div>
                          ) : (
                            <div className="list-row">
                              <strong>No background tools</strong>
                              <span>This background does not grant tool proficiencies.</span>
                            </div>
                          )}
                        </div>
                      </article>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-style" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <span className="mini-heading creator-section-label">Fighting Style</span>
                        <h3>Fighting Style</h3>
                        <p>{`Choose the combat edge that defines your ${currentClass.name} baseline game feel.`}</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <div className="fighter-journey-split">
                        <div className="fighter-journey-grid">
                          <button
                            type="button"
                            className={
                              currentClass.id === "ranger"
                                ? !draft.rangerChoices?.fightingStyleId
                                  ? "fighter-journey-card active is-none"
                                  : "fighter-journey-card dimmed is-none"
                                : !draft.fighterChoices?.fightingStyleId
                                  ? "fighter-journey-card active is-none"
                                  : "fighter-journey-card dimmed is-none"
                            }
                            onClick={() => (currentClass.id === "ranger" ? setRangerFightingStyle("") : chooseFighterStyleJourney(""))}
                          >
                            <strong>None</strong>
                            <span>No style selected yet.</span>
                          </button>
                          {classFightingStyleOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              className={
                                selectedClassFightingStyleId === option.id
                                  ? "fighter-journey-card active"
                                  : selectedClassFightingStyleId
                                    ? "fighter-journey-card dimmed"
                                    : "fighter-journey-card"
                              }
                              onClick={() => (currentClass.id === "ranger" ? setRangerFightingStyle(option.id) : chooseFighterStyleJourney(option.id))}
                            >
                              <strong>
                                <HoverTooltip
                                  label={option.name}
                                  content={featureTooltipContent({
                                    id: option.id,
                                    name: option.name,
                                    summary: option.summary,
                                    keyFacts: "keyFacts" in option && Array.isArray(option.keyFacts) ? option.keyFacts : [],
                                    unlockLevel: 1,
                                    currentValueTemplate: undefined,
                                    tags: [],
                                    milestones: [],
                                  }, draft.level)}
                                />
                              </strong>
                              <span>{"shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : option.summary}</span>
                            </button>
                          ))}
                        </div>
                        <div className="fighter-journey-detail">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat fighter-journey-detail-card">
                            <span className="feature-detail-label">Focus</span>
                            <strong>{selectedClassFightingStyle?.name ?? "None"}</strong>
                            {selectedClassFightingStyleKeyFacts.length ? (
                              <div className="feature-key-facts-list structured">
                                {selectedClassFightingStyleKeyFacts.map((fact, index) => (
                                  <div key={`${selectedClassFightingStyle?.id ?? "style"}-journey-fact-${index}`} className="feature-key-fact-row">
                                    <span className="feature-key-fact-dot" aria-hidden="true" />
                                    <span>{fact}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="class-feature-detail-body">
                              <p>{selectedClassFightingStyle?.summary ?? "Leave Fighting Style on None for now, or choose one to define your baseline combat edge."}</p>
                            </div>
                          </article>
                          {currentClass.id === "fighter" && selectedFighterFightingStyle?.id === "superior-technique" ? (
                            <article className="identity-trait-item class-feature-detail creator-subpanel-flat fighter-journey-detail-card">
                              <span className="feature-detail-label">Maneuver</span>
                              {selectedSuperiorTechniqueManeuver ? (
                                <article className="fighter-feature-card compact unlocked">
                                  <div className="fighter-feature-card-head">
                                    <HoverTooltip
                                      label={selectedSuperiorTechniqueManeuver.name}
                                      content={featureTooltipContent({
                                        id: selectedSuperiorTechniqueManeuver.id,
                                        name: selectedSuperiorTechniqueManeuver.name,
                                        summary: selectedSuperiorTechniqueManeuver.summary,
                                        keyFacts: selectedSuperiorTechniqueManeuver.keyFacts ?? [],
                                        unlockLevel: 1,
                                        currentValueTemplate: undefined,
                                        tags: [],
                                        milestones: [],
                                      }, draft.level)}
                                    />
                                    <span className="fighter-feature-check" aria-hidden="true">✓</span>
                                  </div>
                                  <p>{selectedSuperiorTechniqueManeuver.shortLabel ?? selectedSuperiorTechniqueManeuver.summary}</p>
                                </article>
                              ) : (
                                <div className="list-row">
                                  <strong>Choose a maneuver</strong>
                                  <span>Superior Technique grants one Battle Master maneuver.</span>
                                </div>
                              )}
                              <div className="fighter-journey-mini-grid">
                                {fighterBattleMasterManeuverOptions.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={draft.fighterChoices?.superiorTechniqueManeuverId === option.id ? "fighter-journey-mini-card active" : "fighter-journey-mini-card"}
                                    onClick={() => setSuperiorTechniqueManeuver(option.id)}
                                  >
                                    <strong>
                                      <HoverTooltip
                                        label={option.name}
                                        content={featureTooltipContent({
                                          id: option.id,
                                          name: option.name,
                                          summary: option.summary,
                                          keyFacts: "keyFacts" in option && Array.isArray(option.keyFacts) ? option.keyFacts : [],
                                          unlockLevel: 1,
                                          currentValueTemplate: undefined,
                                          tags: [],
                                          milestones: [],
                                        }, draft.level)}
                                      />
                                    </strong>
                                    <span>{"shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : option.summary}</span>
                                  </button>
                                ))}
                              </div>
                            </article>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-asi" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <span className="mini-heading creator-section-label">ASI</span>
                        <h3>{fighterAsiFeature?.name ?? "Ability Score Improvement"}</h3>
                        <p>Choose a +2 bonus, split two +1 bonuses, or take a feat when an ASI level is unlocked.</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <div className="fighter-asi-stack">
                        {unlockedFighterAsiLevels.length ? unlockedFighterAsiLevels.map((level) => {
                          const choice = fighterAsiChoices[level];
                          const selectedMode = choice?.mode ?? null;
                          const plusTwoAbilityId = choice?.plusTwoAbilityId ?? null;
                          const plusOneAbilityIds = choice?.plusOneAbilityIds ?? [];
                          const selectedFeatId = choice?.featId ?? "";

                          return (
                            <article key={`journey-fighter-asi-tab-${level}`} className="fighter-asi-card">
                              <div className="fighter-asi-card-head">
                                <div>
                                  <span className="mini-heading">Level {level}</span>
                                  <strong>{fighterAsiFeature?.milestones.find((milestone) => milestone.level === level)?.label ?? "+2 or +1 / +1"}</strong>
                                </div>
                                <button type="button" className="fighter-choice-clear" onClick={() => clearFighterAsiChoice(level)}>
                                  Clear
                                </button>
                              </div>
                              <div className="fighter-asi-mode-row">
                                <button
                                  type="button"
                                  className={selectedMode === "plus-two" ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                                  onClick={() =>
                                    updateFighterAsiChoice(level, () => ({
                                      mode: "plus-two",
                                      plusTwoAbilityId: null,
                                      plusOneAbilityIds: [],
                                      featId: null,
                                    }))
                                  }
                                >
                                  +2 to one ability
                                </button>
                                <button
                                  type="button"
                                  className={selectedMode === "split" ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                                  onClick={() =>
                                    updateFighterAsiChoice(level, () => ({
                                      mode: "split",
                                      plusTwoAbilityId: null,
                                      plusOneAbilityIds: [],
                                      featId: null,
                                    }))
                                  }
                                >
                                  +1 / +1 split
                                </button>
                                <button
                                  type="button"
                                  className={selectedMode === "feat" ? "ability-flex-pick active" : "ability-flex-pick"}
                                  onClick={() =>
                                    updateFighterAsiChoice(level, () => ({
                                      mode: "feat",
                                      plusTwoAbilityId: null,
                                      plusOneAbilityIds: [],
                                      featId: selectedFeatId || null,
                                    }))
                                  }
                                >
                                  Feat
                                </button>
                              </div>
                              {selectedMode === "feat" ? (
                                <div className="equipment-picker-card fighter-asi-feat-picker">
                                  <strong>Choose a feat</strong>
                                  <select
                                    className="equipment-picker-select"
                                    value={selectedFeatId}
                                    onChange={(event) => setFighterAsiFeatChoice(level, event.target.value)}
                                  >
                                    <option value="" disabled>
                                      Choose feat
                                    </option>
                                    {content.feats.map((feat) => (
                                      <option key={`journey-fighter-asi-feat-${level}-${feat.id}`} value={feat.id}>
                                        {feat.name}
                                      </option>
                                    ))}
                                  </select>
                                  {selectedFeatId ? (
                                    <span>{content.feats.find((feat) => feat.id === selectedFeatId)?.summary ?? "Feat selected."}</span>
                                  ) : (
                                    <span>Pick one feat instead of ability score bonuses.</span>
                                  )}
                                </div>
                              ) : (
                                <div className="ability-flex-assignment-grid fighter-asi-grid">
                                  {draft.abilities.map((ability) => {
                                    const projectedScore = fighterAsiProjectedScore(ability.id, level);
                                    const canTakePlusTwo = projectedScore <= 18;
                                    const canTakePlusOne =
                                      projectedScore <= 19 ||
                                      plusOneAbilityIds.includes(ability.id);
                                    const splitLocked =
                                      !plusOneAbilityIds.includes(ability.id) &&
                                      plusOneAbilityIds.length >= 2;

                                    return (
                                      <div className="ability-flex-assignment-row fighter-asi-row" key={`journey-fighter-asi-tab-${level}-${ability.id}`}>
                                        <strong className={abilityAccentClass(ability.id)}>{ability.id}</strong>
                                        <div className="fighter-asi-row-meta">
                                          <span>{ability.label}</span>
                                          <span>{`Current ${previewAbilities.find((entry) => entry.id === ability.id)?.previewScore ?? ability.score}`}</span>
                                        </div>
                                        <div className="ability-flex-picks prominent">
                                          <button
                                            type="button"
                                            className={plusTwoAbilityId === ability.id ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                                            disabled={selectedMode !== "plus-two" || !canTakePlusTwo}
                                            onClick={() =>
                                              updateFighterAsiChoice(level, (current) => ({
                                                mode: "plus-two",
                                                plusTwoAbilityId: current?.plusTwoAbilityId === ability.id ? null : ability.id,
                                                plusOneAbilityIds: [],
                                                featId: null,
                                              }))
                                            }
                                          >
                                            +2
                                          </button>
                                          <button
                                            type="button"
                                            className={plusOneAbilityIds.includes(ability.id) ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                                            disabled={selectedMode !== "split" || !canTakePlusOne || splitLocked}
                                            onClick={() =>
                                              updateFighterAsiChoice(level, (current) => {
                                                const currentIds = current?.plusOneAbilityIds ?? [];
                                                return {
                                                  mode: "split",
                                                  plusTwoAbilityId: null,
                                                  plusOneAbilityIds: currentIds.includes(ability.id)
                                                    ? currentIds.filter((entry) => entry !== ability.id)
                                                    : [...currentIds, ability.id].slice(0, 2),
                                                  featId: null,
                                                };
                                              })
                                            }
                                          >
                                            +1
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </article>
                          );
                        }) : (
                          <div className="list-row">
                            <strong>No ASI unlocked yet</strong>
                            <span>Fighters gain their first Ability Score Improvement at 4th level.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-subclass" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head">
                        <span className="mini-heading creator-section-label">{visibleSubclassHeading}</span>
                        <h3>{visibleSubclassHeading}</h3>
                        <p>{`Choose the ${visibleSubclassHeading.toLowerCase()} that defines your ${currentClass.name} path.`}</p>
                      </div>
                      <div className="fighter-journey-split">
                        <div className="fighter-journey-grid">
                          {fighterJourneySubclasses.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              className={
                                draft.selectedSubclassOptions.includes(entry.id)
                                  ? "fighter-journey-card active"
                                  : draft.selectedSubclassOptions.length
                                    ? "fighter-journey-card dimmed"
                                    : "fighter-journey-card"
                              }
                              onClick={() => chooseFighterSubclassJourney(entry.id)}
                            >
                              <span className="fighter-journey-card-label">{visibleSubclassHeading}</span>
                              <strong>{entry.name}</strong>
                              <span>{entry.source}</span>
                            </button>
                          ))}
                        </div>
                        <div className="fighter-journey-detail">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat fighter-journey-detail-card">
                            <span className="feature-detail-label">Subclass</span>
                            <strong>{selectedJourneySubclass?.name ?? "Choose a subclass"}</strong>
                            {selectedJourneySubclass?.features?.length ? (
                              <div className="feature-key-facts-list structured">
                                {selectedJourneySubclass.features.slice(0, 3).map((feature) => (
                                  <div key={`${selectedJourneySubclass.id}-${feature.id}`} className="feature-key-fact-row">
                                    <span className="feature-key-fact-dot" aria-hidden="true" />
                                    <span>{feature.name}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            <div className="class-feature-detail-body">
                              <p>{selectedJourneySubclass?.summary ?? "Select a Fighter subclass to continue."}</p>
                            </div>
                          </article>
                          {selectedJourneySubclass?.features?.length ? (
                            <div className="fighter-feature-grid compact">
                              {selectedJourneySubclass.features.map((feature) => {
                                const unlockState = subclassFeatureUnlockState.get(feature.id);
                                const isUnlocked = unlockState?.acquired ?? true;
                                return (
                                  <article key={`${selectedJourneySubclass.id}-${feature.id}`} className={isUnlocked ? "fighter-feature-card unlocked compact" : "fighter-feature-card locked compact"}>
                                    <div className="fighter-feature-card-head">
                                      <HoverTooltip label={feature.name} content={featureTooltipContent(feature, draft.level)} />
                                      {isUnlocked ? <span className="fighter-feature-check" aria-hidden="true">✓</span> : null}
                                    </div>
                                    <div className="fighter-feature-meta">
                                      {isUnlocked ? (
                                        <>
                                          {unlockState?.currentSummary ? <span>{unlockState.currentSummary}</span> : <span>Unlocked</span>}
                                          {unlockState?.nextSummary ? <span>{unlockState.nextSummary}</span> : null}
                                        </>
                                      ) : (
                                        <span>{unlockState?.unlockLabel ? `Unlocks at ${unlockState.unlockLabel}` : "Locked"}</span>
                                      )}
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div className="fighter-journey-footer">
                        {fighterJourneyPreviousBrowser ? (
                          <button type="button" className="sheet-button secondary" onClick={() => navigateFighterJourney(fighterJourneyPreviousBrowser)}>
                            Back
                          </button>
                        ) : <span />}
                        {fighterJourneyNextBrowser ? (
                          <button
                            type="button"
                            className="sheet-button primary"
                            onClick={() => navigateFighterJourney(fighterJourneyNextBrowser)}
                            disabled={!fighterJourneyNextBrowser}
                          >
                            Next
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "warlock-pact" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <span className="mini-heading creator-section-label">Pact Boon</span>
                        <h3>Pact Boon</h3>
                        <p>Choose the gift your patron grants at 3rd level. The choice also gates Pact-specific invocations and Tome cantrip setup.</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      {draft.level < 3 ? (
                        <div className="list-row">
                          <strong>Pact Boon locked</strong>
                          <span>Pact Boon opens at Warlock Level 3. Raise the class level to choose a boon.</span>
                        </div>
                      ) : (
                        <div className="warlock-flow-panel">
                          <div className="warlock-pact-layout">
                            <div className="fighter-journey-grid equipment-choice-grid">
                              {warlockPactBoonOptions.map((option) => (
                                <button
                                  type="button"
                                  key={`journey-pact-${option.id}`}
                                  className={draft.pactBoonId === option.id ? "fighter-journey-card active pact-boon-card" : "fighter-journey-card pact-boon-card"}
                                  onClick={() => setPactBoon(option.id)}
                                >
                                  <span className="fighter-journey-card-label">{draft.pactBoonId === option.id ? "Selected" : "Choose"}</span>
                                  <strong>
                                    <HoverTooltip
                                      label={option.name}
                                      content={featureTooltipContent({
                                        id: option.id,
                                        name: option.name,
                                        summary: option.summary,
                                        keyFacts: "keyFacts" in option && Array.isArray(option.keyFacts) ? option.keyFacts : [],
                                        currentValueTemplate: undefined,
                                        tags: [],
                                        milestones: [],
                                      }, draft.level)}
                                    />
                                  </strong>
                                  <span>{"shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : option.summary}</span>
                                </button>
                              ))}
                            </div>
                            <article className="identity-trait-item class-feature-detail creator-subpanel-flat warlock-pact-detail-card">
                              <span className="feature-detail-label">Selected Pact</span>
                              <strong>{selectedPactBoon?.name ?? "No Pact Boon Selected"}</strong>
                              <p>{
                                selectedPactBoon && "shortLabel" in selectedPactBoon && typeof selectedPactBoon.shortLabel === "string"
                                  ? selectedPactBoon.shortLabel
                                  : selectedPactBoon?.summary ?? "Choose a Pact Boon to review the gift your patron grants."
                              }</p>
                              {selectedPactBoonFacts.length ? (
                                <div className="feature-key-facts-list structured">
                                  {selectedPactBoonFacts.map((fact, index) => (
                                    <div key={`${selectedPactBoon?.id ?? "pact"}-pact-fact-${index}`} className="feature-key-fact-row">
                                      <span className="feature-key-fact-dot" aria-hidden="true" />
                                      <span>{fact}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </article>
                          </div>
                          <div className="fighter-journey-scene-divider" aria-hidden="true" />
                          {draft.pactBoonId === "pact-of-the-tome" ? (
                            <div className="creator-inline-list">
                              <div className="list-row">
                                <strong>Book of Shadows Cantrips</strong>
                                <span>{`${draft.selectedPactCantripIds.length} / 3 selected`}</span>
                              </div>
                              <div className="compact-option-list graph-list">
                                {pagedPactCantripCards.map((spell) => (
                                  <label className={draft.selectedPactCantripIds.includes(spell.id) ? "spell-selection-row active" : `spell-selection-row${!draft.selectedPactCantripIds.includes(spell.id) && draft.selectedPactCantripIds.length >= 3 ? " disabled" : ""}`} key={`journey-tome-cantrip-${spell.id}`}>
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
                                        <span key={`${spell.id}-journey-tome-important-${item}`} className={`spell-tooltip-chip tone-${spellChipTone(item)}`}>
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
                      )}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "warlock-spells" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head with-action">
                        <div className="fighter-journey-scene-head-copy">
                          <span className="mini-heading creator-section-label">Spellcasting</span>
                          <h3>{`${currentClass.name} Spellbook`}</h3>
                          <p>{currentClass.id === "warlock" ? "Choose your warlock spells, review patron additions, and see any Book of Shadows cantrips granted by Pact of the Tome." : `Filter by level, browse a stable tile grid, and track ${currentClass.name.toLowerCase()} spell choices in real time.`}</p>
                        </div>
                        <button type="button" className="sheet-button secondary" onClick={() => setFighterProgressionOpen(true)}>
                          Progression
                        </button>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <div className="fighter-journey-counter-row">
                        <div className="fighter-journey-counter">
                          <span>Cantrips</span>
                          <strong>{classCantripLimit ? `${classSelectedCantrips.length}/${classCantripLimit}` : String(classSelectedCantrips.length)}</strong>
                        </div>
                        <div className="fighter-journey-counter">
                          <span>Known Spells</span>
                          <strong>{classKnownSpellLimit ? `${classSelectedLeveledSpells.length}/${classKnownSpellLimit}` : String(classSelectedLeveledSpells.length)}</strong>
                        </div>
                        <div className="fighter-journey-counter">
                          <span>Max Level</span>
                          <strong>{spellSelectionRules.maxSpellLevel ? `Level ${spellSelectionRules.maxSpellLevel}` : "-"}</strong>
                        </div>
                        <div className="fighter-journey-counter wide">
                          <span>Source</span>
                          <strong>{currentVisibleSubclass?.name ?? currentClass.name}</strong>
                          <small>{currentClass.id === "warlock" ? "Patron and pact grants are shown as auto-added cards." : "Class and subclass grants stay separate from manual choices."}</small>
                        </div>
                      </div>
                      {currentStructuredSublineage?.id === "high-elf" ? (
                        <div className="creator-inline-list">
                          <div className="list-row">
                            <strong>High Elf Cantrip</strong>
                            <span>Choose one Wizard cantrip. Intelligence is your spellcasting ability for it.</span>
                          </div>
                          <div className={selectedHighElfCantrip ? "fighter-journey-card active equipment-picker-card" : "fighter-journey-card equipment-picker-card"}>
                            <span className="fighter-journey-card-label">{selectedHighElfCantrip ? "Selected" : "Choose"}</span>
                            <strong>
                              {selectedHighElfCantrip ? (
                                <HoverTooltip
                                  label={selectedHighElfCantrip.name}
                                  content={spellTooltipContent({
                                    classId: "elf",
                                    className: "High Elf",
                                    title: selectedHighElfCantrip.name,
                                    spellLevel: selectedHighElfCantrip.level,
                                    reference: spellReferenceFor(spellReferenceCollection, selectedHighElfCantrip),
                                    summary: selectedHighElfCantrip.summary,
                                    meta: ["Cantrip", selectedHighElfCantrip.school, "High Elf"],
                                    lines: spellMetaLines(selectedHighElfCantrip),
                                  })}
                                />
                              ) : "Choose one Wizard cantrip"}
                            </strong>
                            <select
                              className="equipment-picker-select"
                              value={selectedHighElfCantripId}
                              onChange={(event) => setHighElfCantripChoice(event.target.value)}
                            >
                              <option value="" disabled>
                                Choose cantrip
                              </option>
                              {highElfCantripPool.map((spell) => (
                                <option key={`high-elf-cantrip-${spell.id}`} value={spell.id}>
                                  {spell.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : null}
                      {currentClass.id === "ranger" && currentVisibleSubclass && rangerSubclassMagicEntries.length ? (
                        <div className="creator-inline-list">
                          <div className="list-row">
                            <strong>{rangerSubclassMagicSection?.name ?? subclassAutoSpellLabel}</strong>
                            <span>Auto added from subclass magic</span>
                          </div>
                          <div className="fighter-spellbook-grid leveled fixed">
                            {rangerSubclassMagicEntries.map((entry) => (
                              <div className="fighter-spell-tile active auto-grant patron-auto" key={`journey-ranger-magic-${entry.unlockLevel}-${entry.name}`}>
                                <div className="spell-selection-main">
                                  <strong className="spell-selection-title">
                                    <HoverTooltip
                                      label={entry.name}
                                      content={spellTooltipContent({
                                        classId: currentClass.id,
                                        className: rangerSubclassMagicSection?.name ?? currentVisibleSubclass.name,
                                        title: entry.name,
                                        reference: spellReferenceFor(spellReferenceCollection, entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name }),
                                        summary: entry.spell?.summary ?? `${entry.name} is granted automatically by your ranger subclass.`,
                                        spellLevel: entry.spell?.level,
                                        meta: [`Unlocked at Ranger ${entry.unlockLevel}`, currentVisibleSubclass.name, "Auto Added"],
                                      })}
                                    />
                                  </strong>
                                  <div className="fighter-spell-tags">
                                    <span className="fighter-spell-tag tone-support">
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
                          <div className="fighter-spellbook-grid leveled fixed">
                            {rangerPrimalAwarenessEntries.map((entry) => (
                              <div className="fighter-spell-tile active auto-grant pact-tome-auto" key={`journey-ranger-primal-${entry.unlockLevel}-${entry.name}`}>
                                <div className="spell-selection-main">
                                  <strong className="spell-selection-title">
                                    <HoverTooltip
                                      label={entry.name}
                                      content={spellTooltipContent({
                                        classId: currentClass.id,
                                        className: rangerPrimalAwarenessSection?.name ?? "Primal Awareness",
                                        title: entry.name,
                                        reference: spellReferenceFor(spellReferenceCollection, entry.spell ?? { id: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), name: entry.name }),
                                        summary: entry.spell?.summary ?? `${entry.name} is granted automatically by Primal Awareness and does not count against the number of ranger spells you know.`,
                                        spellLevel: entry.spell?.level,
                                        meta: [`Unlocked at Ranger ${entry.unlockLevel}`, "Primal Awareness", "Auto Added"],
                                      })}
                                    />
                                  </strong>
                                  <div className="fighter-spell-tags">
                                    <span className="fighter-spell-tag tone-support">
                                      Auto Added
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {currentClass.id === "warlock" && currentVisibleSubclass && subclassSpellEntries.length ? (
                        <div className="creator-inline-list">
                          <div className="list-row">
                            <strong>{subclassAutoSpellLabel}</strong>
                            <span>{subclassAutoSpellSourceLabel}</span>
                          </div>
                          <div className="fighter-spellbook-grid leveled fixed">
                            {subclassSpellEntries.map((entry) => (
                              <div className="fighter-spell-tile active auto-grant patron-auto" key={`journey-warlock-patron-${entry.unlockLevel}-${entry.name}`}>
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
                                        meta: [`Unlocked at Warlock ${entry.unlockLevel}`, currentVisibleSubclass.name, "Auto Added"],
                                      })}
                                    />
                                  </strong>
                                  <div className="fighter-spell-tags">
                                    <span className="fighter-spell-tag tone-support">
                                      Auto Added
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {currentClass.id === "warlock" && draft.pactBoonId === "pact-of-the-tome" && selectedPactCantripSpells.length ? (
                        <div className="creator-inline-list">
                          <div className="list-row">
                            <strong>Book of Shadows Cantrips</strong>
                            <span>{`${selectedPactCantripSpells.length} / 3 selected from Pact of the Tome`}</span>
                          </div>
                          <div className="fighter-spellbook-grid leveled fixed">
                            {selectedPactCantripSpells.map((spell) => (
                              <div className="fighter-spell-tile active auto-grant pact-tome-auto" key={`journey-selected-tome-${spell.id}`}>
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
                                        meta: ["Cantrip", "Pact of the Tome", "Auto Added"],
                                      })}
                                    />
                                  </strong>
                                </div>
                                <div className="fighter-spell-tags">
                                  <span className="fighter-spell-tag tone-support">
                                    Pact Tome
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <div className="fighter-spellbook-toolbar">
                        {spellLevelPages.length ? (
                          <div className="fighter-spellbook-filters">
                            <button type="button" className={activeSpellFilter === "all" ? "fighter-filter-pill active" : "fighter-filter-pill"} onClick={() => { setActiveSpellFilter("all"); setSpellListPage(0); }}>All</button>
                            {spellLevelPages.map((level) => (
                              <button type="button" key={`journey-warlock-spell-level-${level}`} className={activeSpellFilter === level ? "fighter-filter-pill active" : "fighter-filter-pill"} onClick={() => { setActiveSpellFilter(level); setSpellListPage(0); }}>
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
                            placeholder="Search warlock spells..."
                            aria-label="Search warlock spells"
                          />
                        </div>
                      </div>
                      <div className="fighter-spellbook-section fixed">
                        <div className="fighter-spellbook-grid leveled fixed">
                        {pagedSpellCards.length ? pagedSpellCards.map((spell, spellIndex) => {
                          const unavailableReason = classSpellUnavailableReason(spell);
                          const isUnlocked = !unavailableReason;
                          const tags = spellListHintChips(spell, spellReferenceFor(spellReferenceCollection, spell));
                          return (
                            <button
                              type="button"
                              className={[
                                "fighter-spell-tile",
                                draft.spellIds.includes(spell.id) ? "active" : "",
                                !isUnlocked ? "disabled" : "",
                              ].filter(Boolean).join(" ")}
                              key={`journey-warlock-spell-${spell.id}-${spell.level}-${spellIndex}`}
                              aria-checked={draft.spellIds.includes(spell.id)}
                              aria-disabled={!isUnlocked}
                              onClick={() => {
                                if (!isUnlocked) {
                                  return;
                                }
                                toggleSelection("spellIds", spell.id);
                              }}
                            >
                              <span className="fighter-spell-school">
                                {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school}
                              </span>
                              {!isUnlocked ? <span className="fighter-spell-disabled-badge" aria-hidden="true">⊘</span> : null}
                              <strong className="fighter-spell-title">
                                <HoverTooltip
                                  label={spell.name}
                                  content={spellTooltipContent({
                                    classId: currentClass.id,
                                    className: currentClass.name,
                                    title: spell.name,
                                    spellLevel: spell.level,
                                    reference: spellReferenceFor(spellReferenceCollection, spell),
                                    summary: spell.summary,
                                    meta: [spell.level === 0 ? "Cantrip" : `Level ${spell.level}`, spell.school, spell.castingTime],
                                    lines: spellMetaLines(spell),
                                  })}
                                />
                              </strong>
                              <div className="fighter-spell-tags">
                                {tags.map((item) => (
                                  <span key={`${spell.id}-journey-warlock-important-${item}`} className={`fighter-spell-tag tone-${spellChipTone(item)}`}>
                                    {item}
                                  </span>
                                ))}
                              </div>
                              {!isUnlocked ? (
                                <span className="fighter-spell-unavailable-row">
                                  <strong>
                                    <HoverTooltip
                                      label={spell.name}
                                      content={spellTooltipContent({
                                        classId: currentClass.id,
                                        className: currentClass.name,
                                        title: spell.name,
                                        reference: spellReferenceFor(spellReferenceCollection, spell),
                                        summary: spell.summary,
                                        spellLevel: spell.level,
                                        meta: [spell.level === 0 ? "Cantrip" : `Level ${spell.level}`, spell.school],
                                      })}
                                    />
                                  </strong>
                                  <span className="fighter-spell-unavailable-divider" aria-hidden="true" />
                                  <span>
                                    <HoverTooltip
                                      label="Unavailable"
                                      content={<span className="spell-tooltip-copy">{unavailableReason}</span>}
                                    />
                                  </span>
                                </span>
                              ) : null}
                            </button>
                          );
                        }) : <div className="list-row"><strong>No visible spells</strong><span>No spells match the current filter, level, or search.</span></div>}
                        </div>
                      </div>
                      <div className="compact-pagination-row centered below-list">
                        <div className="pagination-mini-controls">
                          <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.max(0, current - 1))} disabled={spellListPage === 0}>‹</button>
                          <span className="pagination-indicator">{`${spellListPage + 1} / ${spellPageCount}`}</span>
                          <button type="button" className="pagination-arrow" onClick={() => setSpellListPage((current) => Math.min(spellPageCount - 1, current + 1))} disabled={spellListPage >= spellPageCount - 1}>›</button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-eldritch" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head with-action">
                        <div className="fighter-journey-scene-head-copy">
                          <span className="mini-heading creator-section-label">Spellcasting</span>
                          <h3>Eldritch Knight Spellbook</h3>
                          <p>Filter by level, browse a stable tile grid, and track your cantrip, known spell, and any-school allowances in real time.</p>
                        </div>
                        <button type="button" className="sheet-button secondary" onClick={() => setFighterProgressionOpen(true)}>
                          Progression
                        </button>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      {fighterJourneySubclassId !== "eldritch-knight" ? (
                        <div className="list-row">
                          <strong>Eldritch Knight not selected</strong>
                          <span>Choose the Eldritch Knight archetype first to unlock spellcasting.</span>
                        </div>
                      ) : (
                        <>
                          <div className="fighter-journey-counter-row">
                            <div className="fighter-journey-counter">
                              <span>Cantrips</span>
                              <strong>{`${eldritchKnightCantripSelections.length}/${eldritchKnightCantripLimit}`}</strong>
                            </div>
                            <div className="fighter-journey-counter">
                              <span>Known Spells</span>
                              <strong>{`${eldritchKnightLeveledSelections.length}/${eldritchKnightSpellsKnownLimit}`}</strong>
                            </div>
                            <div className="fighter-journey-counter">
                              <span>Any-School Picks</span>
                              <strong>{`${eldritchKnightOffSchoolSelections.length}/${eldritchKnightFlexibleSchoolAllowance}`}</strong>
                            </div>
                            <div className="fighter-journey-counter wide">
                              <span>School Rule</span>
                              <strong>{eldritchKnightSchoolFocusLabel}</strong>
                              <small>{`${eldritchKnightFlexibleSchoolAllowance} any-school pick${eldritchKnightFlexibleSchoolAllowance === 1 ? "" : "s"} available`}</small>
                            </div>
                          </div>
                          <div className="fighter-spellbook-toolbar">
                            <div className="fighter-spellbook-filters">
                              <button
                                type="button"
                                className={fighterSpellLevelFilter === "all" ? "fighter-filter-pill active" : "fighter-filter-pill"}
                                onClick={() => setFighterSpellLevelFilter("all")}
                              >
                                All
                              </button>
                              <button
                                type="button"
                                className={fighterSpellLevelFilter === "cantrip" ? "fighter-filter-pill active" : "fighter-filter-pill"}
                                onClick={() => setFighterSpellLevelFilter("cantrip")}
                              >
                                Cantrips
                              </button>
                              {fighterJourneySpellLevelOptions.filter((level) => level > 0).map((level) => (
                                <button
                                  key={`fighter-level-filter-${level}`}
                                  type="button"
                                  className={fighterSpellLevelFilter === level ? "fighter-filter-pill active" : "fighter-filter-pill"}
                                  onClick={() => setFighterSpellLevelFilter(level)}
                                >
                                  {`Level ${level}`}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="fighter-spellbook-section fixed">
                            <div className="fighter-spellbook-grid leveled fixed">
                              {fighterJourneyVisibleSpellTiles.map((spell) => {
                                const isSelected = draft.spellIds.includes(spell.id);
                                const unavailableReason = eldritchKnightSpellUnavailableReason(spell);
                                const isUnlocked = !unavailableReason;
                                const isFocusSchool = ["abjuration", "evocation"].includes(spell.school.toLowerCase());
                                const tags = spellTileTags(spell);

                                return (
                                  <button
                                    key={`journey-spell-${spell.id}`}
                                    type="button"
                                    className={[
                                      "fighter-spell-tile",
                                      isSelected ? "active" : "",
                                      isFocusSchool ? "focus-school" : "",
                                      !isUnlocked ? "disabled" : "",
                                    ].filter(Boolean).join(" ")}
                                    aria-disabled={!isUnlocked}
                                    onClick={() => {
                                      if (!isUnlocked) {
                                        return;
                                      }
                                      toggleSelection("spellIds", spell.id);
                                    }}
                                  >
                                    <span className="fighter-spell-school">
                                      {spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} · {spell.school}
                                    </span>
                                    {!isUnlocked ? <span className="fighter-spell-disabled-badge" aria-hidden="true">⊘</span> : null}
                                    <strong className="fighter-spell-title">
                                      <HoverTooltip
                                        label={spell.name}
                                        content={spellTooltipContent({
                                          classId: currentClass.id,
                                          className: "Eldritch Knight",
                                          title: spell.name,
                                          reference: spellReferenceFor(spellReferenceCollection, spell),
                                          summary: spell.summary,
                                          spellLevel: spell.level,
                                          meta: [spell.level === 0 ? "Cantrip" : `Level ${spell.level}`, spell.school, isFocusSchool ? "Preferred School" : "Wizard Spell"],
                                        })}
                                      />
                                    </strong>
                                    <div className="fighter-spell-tags">
                                      {tags.map((tag) => (
                                        <span key={`${spell.id}-${tag}`} className={`fighter-spell-tag ${spellTagToneClass(tag)}`}>
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                    {!isUnlocked ? (
                                      <span className="fighter-spell-unavailable-row">
                                        <strong>
                                          <HoverTooltip
                                            label={spell.name}
                                            content={spellTooltipContent({
                                              classId: currentClass.id,
                                              className: "Eldritch Knight",
                                              title: spell.name,
                                              reference: spellReferenceFor(spellReferenceCollection, spell),
                                              summary: spell.summary,
                                              spellLevel: spell.level,
                                              meta: [spell.level === 0 ? "Cantrip" : `Level ${spell.level}`, spell.school, isFocusSchool ? "Preferred School" : "Wizard Spell"],
                                            })}
                                          />
                                        </strong>
                                        <span className="fighter-spell-unavailable-divider" aria-hidden="true" />
                                        <strong>
                                          <HoverTooltip
                                            label="Unavailable"
                                            content={spellTooltipContent({
                                              classId: currentClass.id,
                                              className: "Eldritch Knight",
                                              title: "Unavailable",
                                              reference: null,
                                              summary: unavailableReason ?? "This spell cannot be selected right now.",
                                              meta: [],
                                            })}
                                          />
                                        </strong>
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="fighter-journey-footer fighter-spellbook-pagination">
                              <button
                                type="button"
                                className="sheet-button secondary"
                                disabled={fighterSpellPage === 0}
                                onClick={() => setFighterSpellPage((current) => Math.max(0, current - 1))}
                              >
                                Prev
                              </button>
                              <span className="fighter-pagination-status">{`${fighterSpellPage + 1} / ${fighterJourneySpellPageCount}`}</span>
                              <button
                                type="button"
                                className="sheet-button secondary"
                                disabled={fighterSpellPage >= fighterJourneySpellPageCount - 1}
                                onClick={() => setFighterSpellPage((current) => Math.min(fighterJourneySpellPageCount - 1, current + 1))}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </motion.section>
              </AnimatePresence>
            </div>
          ) : null}

          {!fighterJourneyActive && creatorStep === 0 && creatorBrowser === "identity" ? (
            <div className="creator-stack">
              <div className="creator-panel creator-panel-wide identity-rework-panel">
                <div className="identity-rework-head">
                  <div>
                    <span className="mini-heading creator-section-label">Identity</span>
                    <h3>{draft.name.trim() || "Unnamed Character"}</h3>
                  </div>
                  <span className="identity-level-badge">{`Level ${draft.level}`}</span>
                </div>
                <div className="identity-rework-grid">
                  <label className="identity-name-card">
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
                  <div className="identity-summary-strip">
                    <div>
                      <span>Race</span>
                      <strong>{currentStructuredLineage?.name ?? currentLineageGroup.name}</strong>
                    </div>
                    <div>
                      <span>Class</span>
                      <strong>{currentClass.name}</strong>
                    </div>
                    <div>
                      <span>Background</span>
                      <strong>{currentBackground.name}</strong>
                    </div>
                  </div>
                </div>
                <div className="identity-level-panel">
                  <div className="identity-level-panel-head">
                    <strong>Level</strong>
                    <span>{`${draft.proficiencyBonus >= 0 ? "+" : ""}${draft.proficiencyBonus} proficiency bonus`}</span>
                  </div>
                  <div className="level-chooser identity-level-chooser">
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
          ) : null}

          {creatorStep === 0 && creatorBrowser === "lineage" ? (
            <div className="creator-stack">
              <section className="lineage-picker-shell">
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

              <div className="identity-detail-head origin-detail-head-top">
                <span className="mini-heading creator-section-label">Race</span>
                <h4>{currentStructuredLineage?.name ?? currentLineageGroup.name}</h4>
              </div>

              {lineageChoiceTabs.length ? (
                <div className="creator-subtabs creator-origin-tabs creator-origin-tabs-top" aria-label="Race detail tabs">
                  <button
                    type="button"
                    className={lineageDetailTab === "overview" ? "creator-subtab active" : "creator-subtab"}
                    onClick={() => setLineageDetailTab("overview")}
                  >
                    <span>Overview</span>
                  </button>
                  {lineageChoiceTabs.map((tab) => (
                    <button
                      key={`lineage-detail-tab-${tab.id}`}
                      type="button"
                      className={lineageDetailTab === tab.id ? "creator-subtab active" : "creator-subtab"}
                      onClick={() => setLineageDetailTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="identity-detail-grid">
                {currentStructuredLineage ? (
                  <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel origin-overview-panel">
                    {lineageDetailTab === "overview" ? (
                      <>
                        <p className="origin-summary-copy">{currentStructuredLineage.summary}</p>
                        <div className="lineage-detail-meta-grid origin-bonus-grid">
                          {currentStructuredLineage.facts.abilityScoreBonuses.map((bonus, index) => (
                            <div key={`${currentStructuredLineage.id}-human-asi-${index}`} className="lineage-detail-meta-item">
                              <span>{"ability" in bonus ? `${bonus.ability} +${bonus.amount}` : `Choose ${bonus.count} abilities (+${bonus.amount})`}</span>
                            </div>
                          ))}
                        </div>
                        <div className="class-overview-highlights origin-overview-highlights">
                          {currentStructuredLineage.facts.size ? (
                            <article className="class-overview-highlight">
                              <strong>Size</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.size)}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.speed ? (
                            <article className="class-overview-highlight">
                              <strong>Speed</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.speed)}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.languages.values.length ? (
                            <article className="class-overview-highlight">
                              <strong>Language</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.languages)}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.age ? (
                            <article className="class-overview-highlight">
                              <strong>Age</strong>
                              <p>{currentStructuredLineage.facts.age.summary}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.alignment ? (
                            <article className="class-overview-highlight">
                              <strong>Alignment</strong>
                              <p>{currentStructuredLineage.facts.alignment.summary}</p>
                            </article>
                          ) : null}
                        </div>
                        {currentStructuredLineage.features.length ? (
                          <>
                            <div className="creator-inline-divider" aria-hidden="true" />
                            <div className="identity-trait-list">
                              {currentStructuredLineage.features.map((feature) => (
                                <div key={`${currentStructuredLineage.id}-overview-feature-${feature.id}`} className="identity-trait-item">
                                  <strong>{feature.name}</strong>
                                  <span>{feature.summary}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : lineageChoiceTabs.length ? (
                      renderLineageChoiceGroup(
                        lineageChoiceTabs.find((tab) => tab.id === lineageDetailTab)?.group ?? lineageChoiceTabs[0].group,
                      )
                    ) : null}
                  </article>
                ) : (
                <article className="creator-panel identity-detail-panel creator-subpanel-flat">
                  {false ? (
                    <>
                      <section className="identity-block-section">
                        <div className="lineage-detail-meta-grid">
                          {currentStructuredLineage!.facts.abilityScoreBonuses.map((bonus, index) => (
                            <div key={`${currentStructuredLineage!.id}-asi-${index}`} className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="spark" className="summary-icon" />
                                </span>
                              </div>
                              <span>
                                {"ability" in bonus ? `${bonus.ability} +${bonus.amount}` : `Choose ${bonus.count} abilities (+${bonus.amount})`}
                              </span>
                            </div>
                          ))}
                          {currentStructuredLineage!.facts.size ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="shield" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredLineage!.facts.size)}</strong>
                              {structuredFactDetail(currentStructuredLineage!.facts.size) ? (
                                <span>{structuredFactDetail(currentStructuredLineage!.facts.size)}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {currentStructuredLineage!.facts.speed ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="skill" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredLineage!.facts.speed)}</strong>
                              {structuredFactDetail(currentStructuredLineage!.facts.speed) ? (
                                <span>{structuredFactDetail(currentStructuredLineage!.facts.speed)}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {currentStructuredLineage!.facts.languages.values.length ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="book" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredLineage!.facts.languages)}</strong>
                              {structuredFactDetail(currentStructuredLineage!.facts.languages) ? (
                                <span>{structuredFactDetail(currentStructuredLineage!.facts.languages)}</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {currentStructuredLineage!.facts.age ? (
                          <div className="identity-trait-item">
                            <strong>Age</strong>
                            <span>{currentStructuredLineage!.facts.age?.summary}</span>
                          </div>
                        ) : null}
                        {currentStructuredLineage!.facts.alignment ? (
                          <div className="identity-trait-item">
                            <strong>Alignment</strong>
                            <span>{currentStructuredLineage!.facts.alignment?.summary}</span>
                          </div>
                        ) : null}
                      </section>

                      {currentStructuredLineage!.features.length ? (
                        <>
                          <div className="creator-inline-divider" aria-hidden="true" />
                          <section className="identity-block-section">
                            <div className="class-feature-layout">
                              <div className="class-feature-list">
                                {currentStructuredLineage!.features.map((feature) => (
                                  <button
                                    key={feature.id}
                                    type="button"
                                    className={selectedStructuredLineageFeature?.id === feature.id ? "class-feature-card active" : "class-feature-card"}
                                    onClick={() => setSelectedStructuredLineageFeatureId(feature.id)}
                                  >
                                    <strong>{feature.name}</strong>
                                  </button>
                                ))}
                              </div>
                              {selectedStructuredLineageFeature ? (
                                <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                                  <strong>{selectedStructuredLineageFeature?.name}</strong>
                                  <div className="class-feature-detail-body">
                                    <p>{selectedStructuredLineageFeature ? structuredFeatureSummary(selectedStructuredLineageFeature!) : ""}</p>
                                  </div>
                                </article>
                              ) : null}
                            </div>
                          </section>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {(lineagePreviewStats.length || lineageAbilityScoreIncreases.length || lineageDetailTraits.length) ? (
                        <section className="identity-block-section">
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
                    </>
                  )}
                </article>
                )}
              </div>
            </div>
          ) : null}

          {creatorStep === 0 && creatorBrowser === "subrace" ? (
            <div className="creator-stack">
              <section className="lineage-picker-shell">
                <div className="identity-browser-head">
                  <span className="mini-heading creator-section-label">Subrace Selection</span>
                </div>
                {visibleSubraceOptions.length ? (
                  <div className="lineage-grid subrace-grid">
                    {visibleSubraceOptions.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={
                          item.id === "__none__"
                            ? !currentStructuredSublineage && !currentSubraceEntry
                              ? "lineage-grid-card active"
                              : "lineage-grid-card"
                            : (currentStructuredSublineage?.id ?? currentSubraceEntry?.id) === item.id
                              ? "lineage-grid-card active"
                              : "lineage-grid-card"
                        }
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

              <div className="identity-detail-head origin-detail-head-top">
                <span className="mini-heading creator-section-label">Subrace</span>
                <h4>{currentStructuredSublineage?.name ?? currentSubraceEntry?.name ?? (currentStructuredLineage?.id === "human" ? "None" : currentLineageGroup.name)}</h4>
              </div>

              {sublineageChoiceTabs.length ? (
                <div className="creator-subtabs creator-origin-tabs creator-origin-tabs-top" aria-label="Subrace detail tabs">
                  <button
                    type="button"
                    className={subraceDetailTab === "overview" ? "creator-subtab active" : "creator-subtab"}
                    onClick={() => setSubraceDetailTab("overview")}
                  >
                    <span>Overview</span>
                  </button>
                  {sublineageChoiceTabs.map((tab) => (
                    <button
                      key={`subrace-detail-tab-${tab.id}`}
                      type="button"
                      className={subraceDetailTab === tab.id ? "creator-subtab active" : "creator-subtab"}
                      onClick={() => setSubraceDetailTab(tab.id)}
                    >
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="identity-detail-grid">
                {currentStructuredLineage ? (
                  <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel origin-overview-panel">
                    {currentStructuredSublineage ? (
                      subraceDetailTab === "overview" ? (
                        <>
                          <p className="origin-summary-copy">
                            {currentStructuredSublineage.summary ?? currentSubraceEntry?.summary ?? subraceEmptyPrompt(currentLineageGroup.name)}
                          </p>
                          <div className="class-overview-highlights origin-overview-highlights">
                            <article className="class-overview-highlight">
                              <strong>Ability Scores</strong>
                              <p>
                                {currentStructuredSublineage.facts.abilityScoreBonuses.length
                                  ? currentStructuredSublineage.facts.abilityScoreBonuses
                                      .map((bonus) =>
                                        "ability" in bonus ? `${bonus.ability} +${bonus.amount}` : `Choose ${bonus.count} abilities (+${bonus.amount})`,
                                      )
                                      .join(" | ")
                                  : "No bonus changes"}
                              </p>
                            </article>
                            {currentStructuredSublineage.features.map((feature) => (
                              <article key={`${currentStructuredSublineage.id}-overview-${feature.id}`} className="class-overview-highlight">
                                <strong>{feature.name}</strong>
                                <p>{feature.summary}</p>
                              </article>
                            ))}
                          </div>
                        </>
                      ) : sublineageChoiceTabs.length ? (
                        renderLineageChoiceGroup(
                          sublineageChoiceTabs.find((tab) => tab.id === subraceDetailTab)?.group ?? sublineageChoiceTabs[0].group,
                          false,
                          currentStructuredSublineageChoiceGroupMap,
                        )
                      ) : null
                    ) : (
                      <>
                        <p className="origin-summary-copy">
                          Standard Human keeps the base Human traits and skips Variant Human's optional skill and feat package.
                        </p>
                        <div className="class-overview-highlights origin-overview-highlights">
                          {currentStructuredLineage.facts.abilityScoreBonuses.map((bonus, index) => (
                            <article key={`human-none-asi-${index}`} className="class-overview-highlight">
                              <strong>Ability Scores</strong>
                              <p>{"ability" in bonus ? `${bonus.ability} +${bonus.amount}` : `Choose ${bonus.count} abilities (+${bonus.amount})`}</p>
                            </article>
                          ))}
                          {currentStructuredLineage.facts.size ? (
                            <article className="class-overview-highlight">
                              <strong>Size</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.size)}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.speed ? (
                            <article className="class-overview-highlight">
                              <strong>Speed</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.speed)}</p>
                            </article>
                          ) : null}
                          {currentStructuredLineage.facts.languages.values.length ? (
                            <article className="class-overview-highlight">
                              <strong>Language</strong>
                              <p>{structuredFactValue(currentStructuredLineage.facts.languages)}</p>
                            </article>
                          ) : null}
                        </div>
                      </>
                    )}
                  </article>
                ) : (
                <article className="creator-panel identity-detail-panel creator-subpanel-flat">
                  <p className="identity-detail-copy">
                    {currentStructuredSublineage?.summary ?? currentSubraceEntry?.summary ?? subraceEmptyPrompt(currentLineageGroup.name)}
                  </p>
                  {currentStructuredSublineage ? (
                    <>
                      <section className="identity-block-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label">Sublineage Details</span>
                        </div>
                        <div className="lineage-detail-meta-grid">
                          {currentStructuredSublineage.facts.abilityScoreBonuses.map((bonus, index) => (
                            <div key={`${currentStructuredSublineage.id}-asi-${index}`} className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="spark" className="summary-icon" />
                                </span>
                              </div>
                              <span>{"ability" in bonus ? `${bonus.ability} +${bonus.amount}` : `Choose ${bonus.count} abilities (+${bonus.amount})`}</span>
                            </div>
                          ))}
                          {currentStructuredSublineage.facts.size ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="shield" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredSublineage.facts.size)}</strong>
                              {structuredFactDetail(currentStructuredSublineage.facts.size) ? <span>{structuredFactDetail(currentStructuredSublineage.facts.size)}</span> : null}
                            </div>
                          ) : null}
                          {currentStructuredSublineage.facts.speed ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="skill" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredSublineage.facts.speed)}</strong>
                              {structuredFactDetail(currentStructuredSublineage.facts.speed) ? <span>{structuredFactDetail(currentStructuredSublineage.facts.speed)}</span> : null}
                            </div>
                          ) : null}
                          {currentStructuredSublineage.facts.languages.values.length ? (
                            <div className="lineage-detail-meta-item">
                              <div className="lineage-detail-meta-head">
                                <span className="summary-icon-wrap">
                                  <AppIcon name="book" className="summary-icon" />
                                </span>
                              </div>
                              <strong>{structuredFactValue(currentStructuredSublineage.facts.languages)}</strong>
                            </div>
                          ) : null}
                        </div>
                      </section>
                      {currentStructuredSublineage.features.length ? (
                        <>
                          <div className="creator-inline-divider" aria-hidden="true" />
                          <section className="identity-block-section">
                            <div className="identity-detail-head compact">
                              <span className="mini-heading creator-section-label">Sublineage Traits</span>
                            </div>
                            <div className="class-feature-layout">
                              <div className="class-feature-list">
                                {currentStructuredSublineage.features.map((feature) => (
                                  <button
                                    key={feature.id}
                                    type="button"
                                    className={selectedStructuredSublineageFeature?.id === feature.id ? "class-feature-card active" : "class-feature-card"}
                                    onClick={() => setSelectedStructuredSublineageFeatureId(feature.id)}
                                  >
                                    <strong>{feature.name}</strong>
                                  </button>
                                ))}
                              </div>
                              {selectedStructuredSublineageFeature ? (
                                <article className="identity-trait-item class-feature-detail creator-subpanel-flat">
                                  <strong>{selectedStructuredSublineageFeature.name}</strong>
                                  <div className="class-feature-detail-body">
                                    <p>{structuredFeatureSummary(selectedStructuredSublineageFeature)}</p>
                                  </div>
                                </article>
                              ) : null}
                            </div>
                          </section>
                        </>
                      ) : null}
                    </>
                  ) : currentSubraceEntry && speciesMeta ? (
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
                )}
              </div>
            </div>
          ) : null}

          {creatorStep === 0 && creatorBrowser === "lineage-choices" ? (
            <div className="creator-stack">
              <section className="creator-section-block">
                {currentStructuredChoiceGroups.length ? (
                  <div className="creator-stack">
                    {currentStructuredRootChoiceGroups.map((group) => renderLineageChoiceGroup(group))}
                  </div>
                ) : (
                  <div className="list-row">
                    <strong>No lineage choices</strong>
                    <span>This lineage has no extra selections right now.</span>
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {!fighterJourneyActive && (creatorStep === 1 || (creatorStep === 0 && (creatorBrowser === "background" || creatorBrowser === "inventory")) || (creatorStep === 2 && (creatorBrowser === "skills" || creatorBrowser === "fighter-asi"))) ? (
            <div className="creator-stack">
                <div
                  className={
                    creatorBrowser === "class" || creatorBrowser === "class-features" || creatorBrowser === "subclass-features" || creatorBrowser === "ranger-choices" || creatorBrowser === "fighter-fighting-style" || creatorBrowser === "fighter-asi" || creatorBrowser === "background" || creatorBrowser === "skill-spells" || creatorBrowser === "skills" || creatorBrowser === "spells"
                      ? "creator-panel creator-panel-wide creator-stage-panel creator-stage-panel-flat"
                      : "creator-panel creator-panel-wide creator-stage-panel"
                  }
                >
                {creatorBrowser === "class" ? (
                <section className="creator-section-block">
                    <div className="fighter-journey-scene-head compact">
                      <h3>Class</h3>
                      <p>Choose the class you want to build, then review its core identity and progression before moving deeper into specialization.</p>
                    </div>
                    <div className="fighter-journey-scene-divider" aria-hidden="true" />
                    <div className="class-grid">
                      {content.classes.map((item) => {
                        return (
                          <button
                            type="button"
                            key={item.id}
                            className={draft.classId === item.id ? "lineage-grid-card active class-grid-card" : "lineage-grid-card class-grid-card"}
                            onClick={() => {
                              updateDraft((current) => ({
                                ...current,
                                classId: item.id,
                                multiclassIds: current.multiclassIds.filter((entry) => entry !== item.id),
                                selectedSubclassOptions: [],
                                spellIds: [],
                              }));
                              if (item.id === "fighter") {
                                setFighterJourneyDirection(1);
                                moveCreatorStep(1);
                                setCreatorBrowser("class");
                              }
                            }}
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

                      <div className="fighter-class-stat-row class-overview-stat-row">
                        <div className="fighter-class-stat-card">
                          <span>Base HP</span>
                          <strong>{currentCuratedClass?.hitPoints["Hit Points at 1st Level"] || `${currentClass.hitDie} + CON modifier`}</strong>
                        </div>
                        <div className="fighter-class-stat-card">
                          <span>Hit Dice</span>
                          <strong>{currentCuratedClass?.hitPoints["Hit Dice"] || `1d${currentClass.hitDie} per level`}</strong>
                        </div>
                      </div>

                      <div className="class-overview-highlights">
                        {classOverviewHighlights.map((item) => (
                          <article key={item.id} className="class-overview-highlight">
                            <strong>{item.title}</strong>
                            <p>{item.body}</p>
                          </article>
                        ))}
                      </div>

                      {currentCuratedClass?.spellcastingTable.rows.length ? (
                        <div className="class-table-card creator-subpanel-flat creator-subsection-divider journey-modern">
                          <div className="identity-detail-head compact">
                            <span className="mini-heading creator-section-label class-section-label">Progression</span>
                          </div>
                          <div className="class-progression-scroll journey-modern">
                            <table className="class-progression-table journey-modern">
                              <thead>
                                {classProgressionHeaderRow.length ? (
                                  <tr>
                                    {classProgressionHeaderRow.map((cell, cellIndex) => (
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
                        </div>
                      ) : null}

                    </article>
                  </section>
                ) : null}

                {creatorBrowser === "class-features" ? (
                <section className="creator-section-block">
                  {currentCuratedClass?.classFeatures.length ? (
                    <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel">
                      <div className="identity-detail-head">
                        <span className="mini-heading creator-section-label class-section-label">Class Features</span>
                        <h4>{currentCuratedClass.name}</h4>
                      </div>
                      <div className="feature-browser-layout">
                        <div className="feature-browser-list">
                          {currentCuratedClass.classFeatures.map((feature) => {
                            const featureState = classFeatureUnlockState.get(feature.id);
                            const featureMilestoneText = feature.milestones.length
                              ? `Levels ${feature.milestones.map((milestone) => milestone.level).join(", ")}`
                              : null;
                            const isAcquired = Boolean(featureState?.acquired);

                            return (
                              <button
                                key={feature.id}
                                type="button"
                                className={
                                  [
                                    "feature-browser-item",
                                    selectedClassFeature?.id === feature.id ? "active" : "",
                                    isAcquired ? "acquired" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")
                                }
                                onClick={() => setSelectedClassFeatureId(feature.id)}
                              >
                                <strong>{feature.name}</strong>
                                {isAcquired ? (
                                  <span className="feature-browser-status" aria-hidden="true">
                                    ✓
                                  </span>
                                ) : null}
                                {feature.tags.length ? (
                                  <div className="feature-tag-row">
                                    {feature.tags.map((tag) => (
                                      <span key={`${feature.id}-tag-${tag}`} className="feature-tag-pill">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {featureState?.selectionSummary ? <span>{featureState.selectionSummary}</span> : null}
                                {featureState?.acquired ? (
                                  <>
                                    {featureState.currentSummary ? <span>{featureState.currentSummary}</span> : null}
                                    {featureState.nextSummary ? <span>{featureState.nextSummary}</span> : null}
                                  </>
                                ) : featureState?.unlockLabel ? (
                                  <span>{`Unlocks at ${featureState.unlockLabel}`}</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        {selectedClassFeature ? (
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat feature-browser-detail">
                            <div className="feature-detail-stack">
                              <div className="feature-detail-block feature-detail-block-header">
                                <strong>{selectedClassFeature.name}</strong>
                                {selectedClassFeature.tags.length ? (
                                  <div className="feature-tag-row">
                                    {selectedClassFeature.tags.map((tag) => (
                                      <span key={`${selectedClassFeature.id}-detail-tag-${tag}`} className="feature-tag-pill">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {(() => {
                                const featureState = classFeatureUnlockState.get(selectedClassFeature.id);
                                if (!featureState) {
                                  return null;
                                }

                                return (
                                  <div className="feature-detail-block">
                                    <span className="feature-detail-label">Overview</span>
                                    <div className="feature-progress-stack">
                                      {featureState.selectionSummary ? <span className="feature-browser-level">{featureState.selectionSummary}</span> : null}
                                      {featureState.acquired ? (
                                        <>
                                          {featureState.currentSummary ? <span className="feature-browser-level">{featureState.currentSummary}</span> : null}
                                          {featureState.nextSummary ? <span className="feature-browser-level">{featureState.nextSummary}</span> : null}
                                        </>
                                      ) : featureState.unlockLabel ? (
                                        <span className="feature-browser-level">{`Unlocks at ${featureState.unlockLabel}`}</span>
                                      ) : null}
                                      {selectedClassFeatureMilestoneText ? <span className="feature-browser-level">{selectedClassFeatureMilestoneText}</span> : null}
                                    </div>
                                  </div>
                                );
                              })()}
                              {selectedClassFeatureKeyFacts.length ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Key Facts</span>
                                  <div className="feature-key-facts-list structured">
                                    {selectedClassFeatureKeyFacts.map((fact, index) => (
                                      <div key={`${selectedClassFeature.id}-key-fact-${index}`} className="feature-key-fact-row">
                                        <span className="feature-key-fact-dot" aria-hidden="true" />
                                        <span>{fact}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              <div className="feature-detail-block">
                                <span className="feature-detail-label">Full Rules</span>
                                {selectedClassDocSection ? (
                                  <RangerDocBlocksView blocks={selectedClassDocSection.blocks} />
                                ) : (
                                  <div className="class-feature-detail-body">
                                    {selectedClassFeatureParagraphs.map((paragraph, index) => (
                                      <p key={`${selectedClassFeature.id}-paragraph-${index}`}>{paragraph}</p>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {selectedClassDocSection?.tables.length ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Reference Tables</span>
                                  <RangerDocTablesView tables={selectedClassDocSection.tables} />
                                </div>
                              ) : null}
                            </div>
                          </article>
                        ) : null}
                      </div>
                    </article>
                  ) : (
                    <div className="list-row">
                      <strong>No class features found</strong>
                      <span>This class does not have curated feature explanations yet.</span>
                    </div>
                  )}
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

                {creatorBrowser === "subclass-features" ? (
                <section className="creator-section-block">
                  {!subclassUnlocked ? (
                    <div className="list-row"><strong>Subclass henüz kilitli</strong><span>Bu creator akışında Subclass seçimi Level {subclassUnlockLevel} ile açılır. Şu an Level {draft.level} görünüyorsun.</span></div>
                  ) : currentVisibleSubclass?.features.length ? (
                    <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel">
                      <div className="identity-detail-head">
                        <span className="mini-heading creator-section-label class-section-label">Subclass Features</span>
                        <h4>{currentVisibleSubclass.name}</h4>
                      </div>
                        <div className="feature-browser-layout">
                          <div className="feature-browser-list">
                          {currentVisibleSubclass.features.map((feature) => {
                            const featureTags = "tags" in feature ? feature.tags ?? [] : [];
                            const featureState = subclassFeatureUnlockState.get(feature.id);
                            const isAcquired = Boolean(featureState?.acquired);
                            return (
                              <button
                                key={feature.id}
                                type="button"
                                className={
                                  [
                                    "feature-browser-item",
                                    selectedSubclassFeature?.id === feature.id ? "active" : "",
                                    isAcquired ? "acquired" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")
                                }
                                onClick={() => setSelectedSubclassFeatureId(feature.id)}
                              >
                                <strong>{feature.name}</strong>
                                {isAcquired ? (
                                  <span className="feature-browser-status" aria-hidden="true">
                                    ✓
                                  </span>
                                ) : null}
                                {featureTags.length ? (
                                  <div className="feature-tag-row">
                                    {featureTags.map((tag) => (
                                      <span key={`${feature.id}-subclass-tag-${tag}`} className="feature-tag-pill">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {featureState?.acquired ? (
                                  <>
                                    {featureState.currentSummary ? <span>{featureState.currentSummary}</span> : null}
                                    {featureState.nextSummary ? <span>{featureState.nextSummary}</span> : null}
                                  </>
                                ) : featureState?.unlockLabel ? (
                                  <span>{`Unlocks at ${featureState.unlockLabel}`}</span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                        {selectedSubclassFeature ? (
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat feature-browser-detail">
                            <div className="feature-detail-stack">
                              <div className="feature-detail-block feature-detail-block-header">
                                <strong>{selectedSubclassFeature.name}</strong>
                                {selectedSubclassFeatureTags.length ? (
                                  <div className="feature-tag-row">
                                    {selectedSubclassFeatureTags.map((tag) => (
                                      <span key={`${selectedSubclassFeature.id}-subclass-detail-tag-${tag}`} className="feature-tag-pill">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              {selectedSubclassFeatureUnlockState ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Overview</span>
                                  <div className="feature-progress-stack">
                                    {selectedSubclassFeatureUnlockState.acquired ? (
                                      <>
                                        {selectedSubclassFeatureUnlockState.currentSummary ? (
                                          <span className="feature-browser-level">{selectedSubclassFeatureUnlockState.currentSummary}</span>
                                        ) : null}
                                        {selectedSubclassFeatureUnlockState.nextSummary ? (
                                          <span className="feature-browser-level">{selectedSubclassFeatureUnlockState.nextSummary}</span>
                                        ) : null}
                                      </>
                                    ) : selectedSubclassFeatureUnlockState.unlockLabel ? (
                                      <span className="feature-browser-level">{`Unlocks at ${selectedSubclassFeatureUnlockState.unlockLabel}`}</span>
                                    ) : null}
                                    {selectedSubclassFeatureUnlockState.acquired && selectedSubclassFeatureLevelText ? (
                                      <span className="feature-browser-level">{selectedSubclassFeatureLevelText}</span>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                              {selectedSubclassFeatureKeyFacts.length ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Key Facts</span>
                                  <div className="feature-key-facts-list structured">
                                    {selectedSubclassFeatureKeyFacts.map((fact, index) => (
                                      <div key={`${selectedSubclassFeature.id}-key-fact-${index}`} className="feature-key-fact-row">
                                        <span className="feature-key-fact-dot" aria-hidden="true" />
                                        <span>{fact}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                              {isVisibleEldritchKnight && selectedSubclassFeature.id === "spellcasting" ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Spell Stats</span>
                                  <p className="identity-detail-copy accent">
                                    Intelligence drives your Eldritch Knight spellcasting, powering both your spell save DC and your spell attack modifier.
                                  </p>
                                  <div className="lineage-detail-meta-grid">
                                    <div className="lineage-detail-meta-item">
                                      <div className="lineage-detail-meta-head">
                                        <span className="summary-icon-wrap">
                                          <AppIcon name="spark" className="summary-icon" />
                                        </span>
                                      </div>
                                      <strong>Spellcasting Ability</strong>
                                      <span>{`${eldritchKnightSpellcastingConfig?.ability ?? "Intelligence"} (${intelligenceModifier >= 0 ? "+" : ""}${intelligenceModifier})`}</span>
                                    </div>
                                    <div className="lineage-detail-meta-item">
                                      <div className="lineage-detail-meta-head">
                                        <span className="summary-icon-wrap">
                                          <AppIcon name="shield" className="summary-icon" />
                                        </span>
                                      </div>
                                      <strong>Spell Save DC</strong>
                                      <span>{`${eldritchKnightSpellcastingConfig?.saveDcFormula ?? "8 + proficiency bonus + Intelligence modifier"} = ${8 + draft.proficiencyBonus + intelligenceModifier}`}</span>
                                    </div>
                                    <div className="lineage-detail-meta-item">
                                      <div className="lineage-detail-meta-head">
                                        <span className="summary-icon-wrap">
                                          <AppIcon name="skill" className="summary-icon" />
                                        </span>
                                      </div>
                                      <strong>Spell Attack Modifier</strong>
                                      <span>{`${eldritchKnightSpellcastingConfig?.attackModifierFormula ?? "proficiency bonus + Intelligence modifier"} = ${draft.proficiencyBonus + intelligenceModifier >= 0 ? "+" : ""}${draft.proficiencyBonus + intelligenceModifier}`}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                              <div className="feature-detail-block">
                                <span className="feature-detail-label">Full Rules</span>
                                <div className="class-feature-detail-body">
                                  {selectedSubclassFeatureSections.length ? (
                                    <div className="feature-section-stack">
                                      {selectedSubclassFeatureSections.map((section, index) => (
                                        <div key={`${selectedSubclassFeature.id}-section-${index}`} className="feature-section-block">
                                          {section.heading ? <strong className="feature-section-heading">{section.heading}</strong> : null}
                                          {section.body.map((paragraph, paragraphIndex) => (
                                            <p key={`${selectedSubclassFeature.id}-section-${index}-paragraph-${paragraphIndex}`}>{paragraph}</p>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    selectedSubclassFeatureParagraphs.map((paragraph, index) => (
                                      <p key={`${selectedSubclassFeature.id}-paragraph-${index}`}>{paragraph}</p>
                                    ))
                                  )}
                                </div>
                              </div>
                              {isVisibleEldritchKnight && selectedSubclassFeature?.id === "spellcasting" && eldritchKnightProgressionBands.length ? (
                                <div className="feature-detail-block">
                                  <span className="feature-detail-label">Progression</span>
                                  <div className="spell-access-card creator-subpanel-flat">
                                    <div className="spell-access-head">
                                      <strong>Spellcasting Progression</strong>
                                      <span>Grouped persistent progression data</span>
                                    </div>
                                    <div className="class-progression-scroll">
                                      <table className="class-progression-table">
                                        <thead>
                                          <tr>
                                            <th>Levels</th>
                                            <th>Cantrips</th>
                                            <th>Known</th>
                                            <th>1st</th>
                                            <th>2nd</th>
                                            <th>3rd</th>
                                            <th>4th</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {eldritchKnightProgressionBands.map((entry) => (
                                            <tr key={entry.id}>
                                              <td>{entry.levelRange}</td>
                                              <td>{entry.cantripsKnown}</td>
                                              <td>{entry.spellsKnown}</td>
                                              <td>{spellSlotValue(entry.spellSlotsRaw, 1)}</td>
                                              <td>{spellSlotValue(entry.spellSlotsRaw, 2)}</td>
                                              <td>{spellSlotValue(entry.spellSlotsRaw, 3)}</td>
                                              <td>{spellSlotValue(entry.spellSlotsRaw, 4)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              ) : selectedSubclassTables.length ? (
                              <RangerDocTablesView tables={selectedSubclassTables} />
                              ) : null}
                            </div>
                          </article>
                        ) : null}
                      </div>
                    </article>
                  ) : (
                    <div className="list-row"><strong>No subclass features found</strong><span>This subclass does not have curated feature explanations yet.</span></div>
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
                    ) : isVisibleEldritchKnight ? (
                      <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel ranger-choice-shell">
                        <div className="identity-detail-head">
                          <span className="mini-heading creator-section-label class-section-label">Subclass Feature Choices</span>
                          <h4>{currentVisibleSubclass?.name ?? "Subclass Choices"}</h4>
                        </div>

                        <div className="ranger-choice-stack">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>Spellcasting Choices</strong>
                            <p className="fighter-choice-intro">
                              Eldritch Knight spell picks are managed in <strong>Spells</strong>. This panel shows the current rules and your selected wizard spells.
                            </p>
                            <button type="button" className="sheet-button secondary" onClick={() => setCreatorBrowser("spells")}>
                              Open Spells
                            </button>
                            <div className="creator-inline-list">
                              {eldritchKnightChoiceRows.map((row) => (
                                <div key={row.id} className="list-row">
                                  <strong>{row.label}</strong>
                                  <span>{row.value}</span>
                                  <span>{row.note}</span>
                                </div>
                              ))}
                            </div>
                          </article>

                          <div className="creator-inline-divider" aria-hidden="true" />

                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>Spellcasting Progression</strong>
                            {eldritchKnightProgressionBands.length ? (
                              <div className="class-progression-scroll">
                                <table className="class-progression-table">
                                  <thead>
                                    <tr>
                                      <th>Levels</th>
                                      <th>Cantrips</th>
                                      <th>Known</th>
                                      <th>1st</th>
                                      <th>2nd</th>
                                      <th>3rd</th>
                                      <th>4th</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {eldritchKnightProgressionBands.map((entry) => (
                                      <tr key={`choice-${entry.id}`}>
                                        <td>{entry.levelRange}</td>
                                        <td>{entry.cantripsKnown}</td>
                                        <td>{entry.spellsKnown}</td>
                                        <td>{spellSlotValue(entry.spellSlotsRaw, 1)}</td>
                                        <td>{spellSlotValue(entry.spellSlotsRaw, 2)}</td>
                                        <td>{spellSlotValue(entry.spellSlotsRaw, 3)}</td>
                                        <td>{spellSlotValue(entry.spellSlotsRaw, 4)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : eldritchKnightSpellcastingTable ? <RangerDocTablesView tables={[eldritchKnightSpellcastingTable]} /> : null}
                          </article>
                        </div>
                      </article>
                    ) : (
                      <div className="list-row"><strong>Bu subclass için seçimli bir panel yok</strong><span>Seçimli subclass feature verisi docs içinde bulunursa burada görünecek.</span></div>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "fighter-fighting-style" ? (
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
                            <strong>{fighterFightingStyleGroup?.name ?? "Fighting Style"}</strong>
                            {fighterFightingStyleGroup?.summary ? (
                              <p className="fighter-choice-intro">{fighterFightingStyleGroup.summary}</p>
                            ) : null}
                            <div className="fighter-choice-split">
                              <div className="feature-detail-block fighter-choice-list-block">
                                <span className="feature-detail-label">Style List</span>
                                <div className="fighter-choice-toolbar">
                                  <div className="fighter-choice-toolbar-summary">
                                    <span className="fighter-choice-toolbar-label">Current Style</span>
                                    <strong className="fighter-choice-overview-value">{selectedFighterFightingStyle?.name ?? "None"}</strong>
                                  </div>
                                  <button
                                    type="button"
                                    className="fighter-choice-clear"
                                    onClick={() => setFighterFightingStyle("")}
                                  >
                                    Clear selection
                                  </button>
                                </div>
                                <div className="creator-inline-divider" aria-hidden="true" />
                                <div className="fighter-choice-list compact">
                                  {fighterFightingStyleOptions.map((option) => (
                                    <button
                                      key={option.id}
                                      type="button"
                                      className={draft.fighterChoices?.fightingStyleId === option.id ? "lineage-choice-row active" : "lineage-choice-row"}
                                      onClick={() => setFighterFightingStyle(option.id)}
                                    >
                                      <span className="lineage-choice-row-copy">
                                        <strong>{option.name}</strong>
                                        <span>{option.shortLabel ?? option.summary}</span>
                                      </span>
                                      <span className="lineage-choice-row-state">
                                        {draft.fighterChoices?.fightingStyleId === option.id ? "Selected" : "Choose"}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="feature-detail-block fighter-choice-detail-block">
                                <span className="feature-detail-label">Detail</span>
                                <div className="fighter-choice-detail-stack">
                                  <article className="identity-trait-item class-feature-detail creator-subpanel-flat fighter-choice-detail">
                                    <strong>{selectedFighterFightingStyle?.name ?? "No Fighting Style Selected"}</strong>
                                    {selectedFighterFightingStyle?.keyFacts?.length ? (
                                      <div className="feature-key-facts-list structured">
                                        {selectedFighterFightingStyle.keyFacts.map((fact, index) => (
                                          <div key={`${selectedFighterFightingStyle.id}-key-fact-${index}`} className="feature-key-fact-row">
                                            <span className="feature-key-fact-dot" aria-hidden="true" />
                                            <span>{fact}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div className="class-feature-detail-body">
                                      <p>{selectedFighterFightingStyle?.summary ?? "Choose a fighting style to review its full rules here."}</p>
                                    </div>
                                  </article>
                                  {selectedFighterFightingStyle?.id === "superior-technique" ? (
                                    <article className="identity-trait-item class-feature-detail creator-subpanel-flat fighter-choice-detail">
                                      <strong>{fighterBattleMasterManeuverGroup?.name ?? "Battle Master Maneuver"}</strong>
                                      {fighterBattleMasterManeuverGroup?.summary ? (
                                        <p>{fighterBattleMasterManeuverGroup.summary}</p>
                                      ) : null}
                                      <div className="lineage-choice-list compact">
                                        <button
                                          type="button"
                                          className={!draft.fighterChoices?.superiorTechniqueManeuverId ? "lineage-choice-row active" : "lineage-choice-row"}
                                          onClick={() => setSuperiorTechniqueManeuver("")}
                                        >
                                          <span className="lineage-choice-row-copy">
                                            <strong>None</strong>
                                            <span className="lineage-choice-option-copy">Leave the maneuver unselected for now.</span>
                                          </span>
                                          <span className="lineage-choice-row-state">
                                            {!draft.fighterChoices?.superiorTechniqueManeuverId ? "Selected" : "Skip"}
                                          </span>
                                        </button>
                                        {fighterBattleMasterManeuverOptions.map((option) => (
                                          <button
                                            key={option.id}
                                            type="button"
                                            className={draft.fighterChoices?.superiorTechniqueManeuverId === option.id ? "lineage-choice-row active" : "lineage-choice-row"}
                                            onClick={() => setSuperiorTechniqueManeuver(option.id)}
                                          >
                                            <span className="lineage-choice-row-copy">
                                              <strong>{option.name}</strong>
                                              <span>{option.shortLabel ?? option.summary}</span>
                                            </span>
                                            <span className="lineage-choice-row-state">
                                              {draft.fighterChoices?.superiorTechniqueManeuverId === option.id ? "Selected" : "Choose"}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                      <div className="creator-inline-divider" aria-hidden="true" />
                                      <div className="class-feature-detail-body">
                                        <strong>{selectedSuperiorTechniqueManeuver?.name ?? "No Maneuver Selected"}</strong>
                                        {selectedSuperiorTechniqueManeuver?.keyFacts?.length ? (
                                          <div className="feature-key-facts-list structured">
                                            {selectedSuperiorTechniqueManeuver.keyFacts.map((fact, index) => (
                                              <div key={`${selectedSuperiorTechniqueManeuver.id}-key-fact-${index}`} className="feature-key-fact-row">
                                                <span className="feature-key-fact-dot" aria-hidden="true" />
                                                <span>{fact}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                        <p>{selectedSuperiorTechniqueManeuver?.summary ?? "Choose a maneuver to review its full rules here."}</p>
                                      </div>
                                    </article>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </article>
                        </div>
                      </article>
                    )}
                </section>
                ) : null}

                {creatorBrowser === "fighter-asi" ? (
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
                          <h4>{`${fighterAsiFeature?.name ?? "Ability Score Improvement"} Choice`}</h4>
                        </div>

                        <div className="ranger-choice-stack">
                          <article className="identity-trait-item class-feature-detail creator-subpanel-flat ranger-choice-panel">
                            <strong>{fighterAsiFeature?.name ?? "Ability Score Improvement"}</strong>
                            {fighterAsiFeature?.summary ? (
                              <p className="fighter-choice-intro">{fighterAsiFeature.summary}</p>
                            ) : null}
                            <div className="fighter-asi-stack">
                              {unlockedFighterAsiLevels.length ? unlockedFighterAsiLevels.map((level) => {
                                const choice = fighterAsiChoices[level];
                                const selectedMode = choice?.mode ?? null;
                                const isSplit = selectedMode === "split";
                                const plusTwoAbilityId = choice?.plusTwoAbilityId ?? null;
                                const plusOneAbilityIds = choice?.plusOneAbilityIds ?? [];
                                const selectedFeatId = choice?.featId ?? "";

                                return (
                                  <article key={`fighter-asi-${level}`} className="fighter-asi-card">
                                    <div className="fighter-asi-card-head">
                                      <div>
                                        <span className="mini-heading">Level {level}</span>
                                        <strong>{fighterAsiFeature?.milestones.find((milestone) => milestone.level === level)?.label ?? "+2 or +1 / +1"}</strong>
                                      </div>
                                      <button
                                        type="button"
                                        className="fighter-choice-clear"
                                        onClick={() => clearFighterAsiChoice(level)}
                                      >
                                        Clear
                                      </button>
                                    </div>
                                    <div className="fighter-asi-mode-row">
                                      <button
                                        type="button"
                                        className={selectedMode === "plus-two" ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                                        onClick={() =>
                                          updateFighterAsiChoice(level, () => ({
                                            mode: "plus-two",
                                            plusTwoAbilityId: null,
                                            plusOneAbilityIds: [],
                                            featId: null,
                                          }))
                                        }
                                      >
                                        +2 to one ability
                                      </button>
                                      <button
                                        type="button"
                                        className={selectedMode === "split" ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                                        onClick={() =>
                                          updateFighterAsiChoice(level, () => ({
                                            mode: "split",
                                            plusTwoAbilityId: null,
                                            plusOneAbilityIds: [],
                                            featId: null,
                                          }))
                                        }
                                      >
                                        +1 / +1 split
                                      </button>
                                      <button
                                        type="button"
                                        className={selectedMode === "feat" ? "ability-flex-pick active" : "ability-flex-pick"}
                                        onClick={() =>
                                          updateFighterAsiChoice(level, () => ({
                                            mode: "feat",
                                            plusTwoAbilityId: null,
                                            plusOneAbilityIds: [],
                                            featId: selectedFeatId || null,
                                          }))
                                        }
                                      >
                                        Feat
                                      </button>
                                    </div>
                                    {selectedMode === "feat" ? (
                                      <div className="equipment-picker-card fighter-asi-feat-picker">
                                        <strong>Choose a feat</strong>
                                        <select
                                          className="equipment-picker-select"
                                          value={selectedFeatId}
                                          onChange={(event) => setFighterAsiFeatChoice(level, event.target.value)}
                                        >
                                          <option value="" disabled>
                                            Choose feat
                                          </option>
                                          {content.feats.map((feat) => (
                                            <option key={`fighter-asi-feat-${level}-${feat.id}`} value={feat.id}>
                                              {feat.name}
                                            </option>
                                          ))}
                                        </select>
                                        {selectedFeatId ? (
                                          <span>{content.feats.find((feat) => feat.id === selectedFeatId)?.summary ?? "Feat selected."}</span>
                                        ) : (
                                          <span>Pick one feat instead of ability score bonuses.</span>
                                        )}
                                      </div>
                                    ) : (
                                    <div className="ability-flex-assignment-grid fighter-asi-grid">
                                      {draft.abilities.map((ability) => {
                                        const projectedScore = fighterAsiProjectedScore(ability.id, level);
                                        const canTakePlusTwo = projectedScore <= 18;
                                        const canTakePlusOne =
                                          projectedScore <= 19 ||
                                          plusOneAbilityIds.includes(ability.id);
                                        const splitLocked =
                                          !plusOneAbilityIds.includes(ability.id) &&
                                          plusOneAbilityIds.length >= 2;

                                        return (
                                          <div className="ability-flex-assignment-row fighter-asi-row" key={`fighter-asi-${level}-${ability.id}`}>
                                            <strong className={abilityAccentClass(ability.id)}>{ability.id}</strong>
                                            <div className="fighter-asi-row-meta">
                                              <span>{ability.label}</span>
                                              <span>{`Current ${previewAbilities.find((entry) => entry.id === ability.id)?.previewScore ?? ability.score}`}</span>
                                            </div>
                                            <div className="ability-flex-picks prominent">
                                              <button
                                                type="button"
                                                className={plusTwoAbilityId === ability.id ? "ability-flex-pick active plus-two" : "ability-flex-pick plus-two"}
                                                disabled={selectedMode !== "plus-two" || !canTakePlusTwo}
                                                onClick={() =>
                                                  updateFighterAsiChoice(level, (current) => ({
                                                    mode: "plus-two",
                                                    plusTwoAbilityId: current?.plusTwoAbilityId === ability.id ? null : ability.id,
                                                    plusOneAbilityIds: [],
                                                    featId: null,
                                                  }))
                                                }
                                              >
                                                +2
                                              </button>
                                              <button
                                                type="button"
                                                className={plusOneAbilityIds.includes(ability.id) ? "ability-flex-pick active plus-one" : "ability-flex-pick plus-one"}
                                                disabled={selectedMode !== "split" || !canTakePlusOne || splitLocked}
                                                onClick={() =>
                                                  updateFighterAsiChoice(level, (current) => {
                                                    const currentIds = current?.plusOneAbilityIds ?? [];
                                                    return {
                                                      mode: "split",
                                                      plusTwoAbilityId: null,
                                                      plusOneAbilityIds: currentIds.includes(ability.id)
                                                        ? currentIds.filter((entry) => entry !== ability.id)
                                                        : [...currentIds, ability.id].slice(0, 2),
                                                      featId: null,
                                                    };
                                                  })
                                                }
                                              >
                                                +1
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    )}
                                  </article>
                                );
                              }) : (
                                <div className="list-row">
                                  <strong>No ASI unlocked yet</strong>
                                  <span>Fighters gain their first Ability Score Improvement at 4th level.</span>
                                </div>
                              )}
                            </div>
                          </article>
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
                        onClick={() => selectBackground(item.id)}
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
                        ? backgroundMetaDescription(content, selectedBackground).map((meta) => (
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

                {creatorStep === 1 && creatorBrowser === "inventory" ? (
                <section className="creator-section-block">
                  {currentClass.id === "fighter" ? (
                    <>
                      <article className="fighter-equipment-section">
                        <div className="equipment-choice-stack">
                          {fighterStartingEquipment.map((group) => renderEquipmentChoiceGroup(group, "general"))}
                        </div>
                      </article>
                      <div className="creator-inline-divider" aria-hidden="true" />
                    </>
                  ) : null}
                  <article className="fighter-equipment-section">
                    <div className="fighter-equipment-source-row">
                      <span className="fighter-equipment-source-label">Background</span>
                      {hasSelectedBackgroundToolData ? (
                        <div className="fighter-feature-grid compact fighter-equipment-source-grid">
                          {renderBackgroundToolCards("background-tool-general")}
                        </div>
                      ) : (
                        <div className="list-row">
                          <strong>No background tools</strong>
                          <span>This background does not grant tool proficiencies.</span>
                        </div>
                      )}
                    </div>
                  </article>
                </section>
                ) : null}

                {creatorBrowser === "skill-spells" || creatorBrowser === "skills" || creatorBrowser === "spells" ? (
                <section className="creator-section-block">
                  <div className="skill-spell-layout skill-spell-layout-flat">
                      {creatorBrowser !== "spells" ? (
                      <section className="skill-spell-section">
                        <div className="identity-detail-head compact">
                          <span className="mini-heading creator-section-label class-section-label">Skills</span>
                        </div>
                        <div className="creator-inline-list">
                          <div className="list-row">
                            <strong>{`Choose ${skillChoiceCount} class skill${skillChoiceCount === 1 ? "" : "s"}`}</strong>
                            <span>
                              {remainingClassSkillChoices > 0
                                ? `${remainingClassSkillChoices} choice${remainingClassSkillChoices === 1 ? "" : "s"} remaining.`
                                : "All class skill choices selected."}
                            </span>
                          </div>
                          {backgroundSkillLabels.length ? (
                            <div className="skill-source-card">
                              <strong>Background Proficiencies</strong>
                              <div className="skill-source-chip-row">
                                {backgroundSkillLabels.map((label) => (
                                  <span key={`background-skill-${label}`} className="skill-source-chip">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="creator-inline-divider" aria-hidden="true" />
                        <div className="skill-choice-grid">
                        {skillChoiceOptions.map((skillId) => {
                          const skillEntry = draft.skills.find((skill) => skill.id === skillId);
                          const skillCopy = skillDescription(skillId, skillEntry?.description);
                          const isSelected = draft.selectedSkillIds.includes(skillId);
                          const isPretrained = Boolean(skillEntry?.proficient && !isSelected);
                          return (
                            <label className={isSelected ? "selection-card choice-card skill-spell-card active" : `selection-card choice-card skill-spell-card${isPretrained ? " disabled" : ""}`} key={skillId}>
                              <input
                                type="checkbox"
                                className="visually-hidden"
                                checked={isSelected}
                                disabled={isPretrained}
                                onChange={() => {
                                  if (isPretrained) {
                                    return;
                                  }
                                  toggleSkillSelection(skillId);
                                }}
                              />
                              <div className="skill-spell-card-head">
                                <strong className="skill-spell-card-title">
                                  {skillLabel(skillId)}
                                  {(isPretrained || isSelected) ? <span className="skill-proficiency-star" aria-hidden="true">★</span> : null}
                                </strong>
                              </div>
                              {skillCopy ? (
                                <p className="skill-spell-card-description">{skillCopy}</p>
                              ) : null}
                              <div className="skill-spell-card-meta">
                                {isPretrained ? <span>Already proficient</span> : null}
                                {isSelected ? <span>Selected for class proficiency</span> : null}
                                {skillEntry?.breakdown && !skillEntry.breakdown.toLowerCase().includes("modifier")
                                  ? <span>{skillEntry.breakdown}</span>
                                  : null}
                              </div>
                            </label>
                          );
                        })}
                        </div>
                      </section>
                      ) : null}
                      {creatorBrowser === "skill-spells" ? <div className="creator-inline-divider" aria-hidden="true" /> : null}
                      {creatorBrowser !== "skills" ? (
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
                        {isVisibleEldritchKnight && eldritchKnightSpellcastingConfig ? (
                          <div className="spell-access-card creator-subpanel-flat">
                            <div className="spell-access-head">
                              <strong>Eldritch Knight Rules</strong>
                              <span>{`${currentVisibleSubclass?.name ?? "Eldritch Knight"} • Level ${draft.level}`}</span>
                            </div>
                            <div className="lineage-detail-meta-grid spell-rules-grid">
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="spark" className="summary-icon" />
                                  </span>
                                </div>
                                <strong>Spellcasting Ability</strong>
                                <span>{eldritchKnightSpellcastingConfig.ability}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="shield" className="summary-icon" />
                                  </span>
                                </div>
                                <strong>Spell Save DC</strong>
                                <span>{8 + draft.proficiencyBonus + intelligenceModifier}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="skill" className="summary-icon" />
                                  </span>
                                </div>
                                <strong>Spell Attack Modifier</strong>
                                <span>{`${draft.proficiencyBonus + intelligenceModifier >= 0 ? "+" : ""}${draft.proficiencyBonus + intelligenceModifier}`}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="book" className="summary-icon" />
                                  </span>
                                </div>
                                <strong>Allowed Schools</strong>
                                <span>{eldritchKnightSchoolFocusLabel}</span>
                              </div>
                              <div className="lineage-detail-meta-item">
                                <div className="lineage-detail-meta-head">
                                  <span className="summary-icon-wrap">
                                    <AppIcon name="shield" className="summary-icon" />
                                  </span>
                                </div>
                                <strong>Any-School Picks</strong>
                                <span>{`${eldritchKnightFlexibleSchoolAllowance}`}</span>
                              </div>
                            </div>
                            <div className="creator-inline-list spell-rules-notes">
                              <div className="list-row">
                                <strong>Any-School Unlocks</strong>
                                <span>{eldritchKnightUnrestrictedLevels.map((level) => levelOrdinal(level)).join(", ")}</span>
                              </div>
                            </div>
                          </div>
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
                                <span>
                                  {currentClass.id === "warlock"
                                    ? "Rule / Slots"
                                    : isVisibleEldritchKnight
                                      ? "Current"
                                      : spellTableLabel(currentClass.id)}
                                </span>
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
                              <button type="button" className={openWarlockGroup === "invocations" ? "warlock-stage-tab active" : "warlock-stage-tab"} onClick={() => setOpenWarlockGroup("invocations")}>
                                <span className="warlock-flow-step">2</span>
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
                                          <div className="spell-selection-row auto patron-auto" key={`${currentVisibleSubclass.id}-${entry.unlockLevel}-${entry.name}`}>
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
                                                    meta: [`Unlocked at Warlock ${entry.unlockLevel}`, currentVisibleSubclass.name, "Auto Added"],
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
                                        <div
                                          className={draft.spellIds.includes(spell.id) ? `spell-selection-row active${isUnlocked ? "" : " disabled"}` : `spell-selection-row${isUnlocked ? "" : " disabled"}`}
                                          key={`${spell.id}-${spell.level}-${spellIndex}`}
                                          role="checkbox"
                                          aria-checked={draft.spellIds.includes(spell.id)}
                                          aria-disabled={!isUnlocked}
                                          tabIndex={isUnlocked ? 0 : -1}
                                          onClick={() => {
                                            if (!isUnlocked) {
                                              return;
                                            }
                                            toggleSelection("spellIds", spell.id);
                                          }}
                                          onKeyDown={(event) => {
                                            if (!isUnlocked) {
                                              return;
                                            }
                                            if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              toggleSelection("spellIds", spell.id);
                                            }
                                          }}
                                        >
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
                                        </div>
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
                                  <div
                                    className={draft.spellIds.includes(spell.id) ? `spell-selection-row active${isUnlocked ? "" : " disabled"}` : `spell-selection-row${isUnlocked ? "" : " disabled"}`}
                                    key={`${spell.id}-${spell.level}-${spellIndex}`}
                                    role="checkbox"
                                    aria-checked={draft.spellIds.includes(spell.id)}
                                    aria-disabled={!isUnlocked}
                                    tabIndex={isUnlocked ? 0 : -1}
                                    onClick={() => {
                                      if (!isUnlocked) {
                                        return;
                                      }
                                      toggleSelection("spellIds", spell.id);
                                    }}
                                    onKeyDown={(event) => {
                                      if (!isUnlocked) {
                                        return;
                                      }
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        toggleSelection("spellIds", spell.id);
                                      }
                                    }}
                                  >
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
                                  </div>
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
                      ) : null}
                    </div>
                </section>
                ) : null}
              </div>
            </div>
          ) : null}

          {creatorStep === 2 && creatorBrowser === "abilities" ? (
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
                          </div>
                          <strong className={abilityAccentClass(ability.id)}>{ability.label}</strong>
                        </div>
                        <div className="ability-pointbuy-statblock">
                          <button
                            type="button"
                            className="ability-pointbuy-spin"
                            disabled={!canDecrease}
                            onClick={() => updateAbility(ability.id, ability.score - 1)}
                            aria-label={`Decrease ${ability.label}`}
                          >
                            -
                          </button>
                          <div className="ability-pointbuy-core">
                            <div className="ability-pointbuy-base">
                              <span className="mini-heading">Score</span>
                              <strong>{ability.previewScore}</strong>
                            </div>
                            <div className="ability-pointbuy-total">
                              <span className="mini-heading">Modifier</span>
                              <strong>{ability.previewModifier >= 0 ? `+${ability.previewModifier}` : ability.previewModifier}</strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="ability-pointbuy-spin"
                            disabled={!canIncrease}
                            onClick={() => updateAbility(ability.id, ability.score + 1)}
                            aria-label={`Increase ${ability.label}`}
                          >
                            +
                          </button>
                        </div>
                        <div className="ability-pointbuy-controls">
                          <span>{`${pointBuyCost(ability.score)} pts`}</span>
                        </div>
                        {(ability.racialBonus > 0 || ability.flexibleBonus > 0 || ability.classBonus > 0) ? (
                          <div className="ability-pointbuy-meta">
                            {ability.racialBonus > 0 ? (
                              <span className="ability-bonus-badge">{`Racial Bonus +${ability.racialBonus}`}</span>
                            ) : null}
                            {ability.flexibleBonus > 0 ? (
                              <span className="ability-bonus-badge secondary">{`Flexible Bonus +${ability.flexibleBonus}`}</span>
                            ) : null}
                            {ability.classBonus > 0 ? (
                              <span className="ability-bonus-badge secondary">{`Class Bonus +${ability.classBonus}`}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
                {flexibleAbilityBonusSource ? (
                  <div className="flexible-bonus-panel compact ability-bonus-assignment-panel">
                    <div className="list-row">
                      <strong>Assign Flexible Bonuses</strong>
                      <span>Choose which abilities receive the +2 and +1 bonuses.</span>
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
              </div>
            </div>
          ) : null}
        </div>
        </div>

        <aside className="creator-preview-sidebar">
          <article className="sheet-card creator-preview-card">
            <div className="lineage-preview-head">
              <span className="mini-heading">Preview</span>
              <h4>{draft.name || currentClass.name}</h4>
              <p>{`Level ${draft.level} ${currentClass.name}${selectedJourneySubclass ? ` • ${selectedJourneySubclass.name}` : ""}`}</p>
            </div>

            <div className="lineage-ability-board">
              <div className="lineage-ability-row labels">
                {previewPanelAbilities.map((ability) => (
                  <span key={ability.id} className={abilityAccentClass(ability.id)}>{ability.id}</span>
                ))}
              </div>
              <div className="lineage-ability-row values">
                {previewPanelAbilities.map((ability) => (
                  <strong key={ability.id}>{ability.value}</strong>
                ))}
              </div>
            </div>

            <div className="lineage-preview-section">
              <div className="lineage-preview-list">
                {previewPanelStats.map((stat) => (
                  <div key={stat.label} className="list-row lineage-preview-stat-row">
                    <div className="lineage-preview-stat-head">
                      <span className="summary-icon-wrap">
                        <AppIcon name={iconForLineageStat(stat.label)} className="summary-icon" />
                      </span>
                      <strong>{stat.label}</strong>
                    </div>
                    <span>{stat.value}</span>
                  </div>
                ))}
                <AnimatePresence initial={false}>
                  {fighterJourneySubclassId === "eldritch-knight"
                    ? previewPanelArcaneStats.map((stat) => (
                        <motion.div
                          key={stat.label}
                          className="list-row lineage-preview-stat-row lineage-preview-arcane-row"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                        >
                          <div className="lineage-preview-stat-head">
                            <span className="summary-icon-wrap">
                              <AppIcon name="book" className="summary-icon" />
                            </span>
                            <strong>{stat.label}</strong>
                          </div>
                          <span>{stat.value}</span>
                        </motion.div>
                      ))
                    : null}
                </AnimatePresence>
              </div>
            </div>

            {fighterJourneySubclassId === "eldritch-knight" ? (
              <div className="lineage-preview-section">
                <span className="mini-heading">Spellbook</span>
                <div className="lineage-preview-list">
                  <div className="list-row">
                    <strong>Known Spells</strong>
                    <span>{`${eldritchKnightLeveledSelections.length}/${eldritchKnightSpellsKnownLimit}`}</span>
                  </div>
                  <div className="list-row">
                    <strong>Cantrips</strong>
                    <span>{`${eldritchKnightCantripSelections.length}/${eldritchKnightCantripLimit}`}</span>
                  </div>
                  <div className="list-row">
                    <strong>Any-School Picks</strong>
                    <span>{`${eldritchKnightOffSchoolSelections.length}/${eldritchKnightFlexibleSchoolAllowance}`}</span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="lineage-preview-section">
              <span className="mini-heading">Proficiencies</span>
              <div className="lineage-preview-list">
                {previewPanelProficiencies.map((item) => (
                  <div key={item.label} className="list-row">
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </aside>

      </div>

      <AnimatePresence>
        {fighterProgressionOpen ? (
          <motion.div className="journey-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="journey-overlay-backdrop" onClick={() => setFighterProgressionOpen(false)} />
            <motion.article
              className="journey-modal"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <div className="journey-modal-head">
                <div>
                  <span className="mini-heading creator-section-label">Progression Tree</span>
                  <h3>Fighter Progression</h3>
                </div>
                <button type="button" className="sheet-button secondary" onClick={() => setFighterProgressionOpen(false)}>
                  Close
                </button>
              </div>
              <div className="journey-modal-body">
                <section className="journey-modal-section">
                  <span className="feature-detail-label">Fighter Features</span>
                  <div className="class-progression-scroll">
                    <table className="class-progression-table">
                      <tbody>
                        {currentCuratedClass?.spellcastingTable.rows.map((row, rowIndex) => (
                          <tr key={`fighter-progression-row-${rowIndex}`}>
                            {row.map((cell, cellIndex) =>
                              rowIndex < 2 ? (
                                <th key={`fighter-progression-cell-${rowIndex}-${cellIndex}`}>{cell}</th>
                              ) : (
                                <td key={`fighter-progression-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                {fighterJourneySubclassId === "eldritch-knight" && eldritchKnightProgressionBands.length ? (
                  <section className="journey-modal-section">
                    <span className="feature-detail-label">Eldritch Knight Spellcasting</span>
                    <div className="class-progression-scroll">
                      <table className="class-progression-table">
                        <thead>
                          <tr>
                            <th>Levels</th>
                            <th>Cantrips</th>
                            <th>Known</th>
                            <th>1st</th>
                            <th>2nd</th>
                            <th>3rd</th>
                            <th>4th</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eldritchKnightProgressionBands.map((band) => (
                            <tr key={band.id}>
                              <td>{band.levelRange}</td>
                              <td>{band.cantripsKnown}</td>
                              <td>{band.spellsKnown}</td>
                              <td>{spellSlotValue(band.spellSlotsRaw, 1)}</td>
                              <td>{spellSlotValue(band.spellSlotsRaw, 2)}</td>
                              <td>{spellSlotValue(band.spellSlotsRaw, 3)}</td>
                              <td>{spellSlotValue(band.spellSlotsRaw, 4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}
              </div>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
