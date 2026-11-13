"use client";

import { Keywordize, highlightKeywords } from "@/components/ui/keyword-text";
import { FactChips } from "@/components/ui/feature-rules";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { CharacterDraft, AbilityId } from "@/lib/character/demo-sheet";
import { eldritchKnightProgression, getEldritchKnightProgression } from "@/lib/character/eldritch-knight";
import type { LineageCatalog, LineageChoiceGroup, LineageChoiceOption, LineageEntry as StructuredLineageEntry, LineageFeature as StructuredLineageFeature, Sublineage as StructuredSublineage } from "@/lib/data/lineages/schema";
import type { AvailableChoice, LanguageChoice } from "@/lib/engine/collect";
import { LanguageChoicePanel } from "@/components/language-choice-panel";
import { flexibleBonusAmounts } from "@/lib/data/lineages/ability-rules";
import type { DerivedStatDisplay } from "@/lib/character/build-sheet";
import { OptionChoicePanel } from "@/components/option-choice-panel";
import { clearCreatorJump, readCreatorJump, type LevelUpTask } from "@/components/level-up-dialog";
import { CreatorFlowFooter, CreatorFlowNav, type CreatorFlowScreen, type CreatorFlowStep } from "@/components/creator-flow-nav";
import type { EngineCatalog } from "@/lib/engine/collect";
import { asiAbilityBonuses, featEligibility, featSlots, type FeatCheckContext } from "@/lib/engine/feats";
import type { ClassDocBlock, ClassDocCollection, ClassDocSection, ClassDocTable } from "@/lib/content/class-docs";

// TODO(creator split): class doc verisi artik yok; asagidaki classDocs dallari olu kod, creator bolunurken silinecek.
const classDocs: ClassDocCollection = {};
import type { ClassCuratedCollection, ClassCuratedFeature, ClassJourneyStage, ClassStartingEquipmentGroup } from "@/lib/content/class-curated-schema";
import type { ClassOptionCollection } from "@/lib/content/class-options-schema";
import type { CreatorOptions } from "@/lib/content/creator-options";
import type { LineageCollection, ResolvedLineageEntry, SubraceEntry } from "@/lib/content/lineage-schema";
import type { ContentBundle } from "@/lib/content/schema";
import type { SpellReferenceCollection, SpellReferenceEntry } from "@/lib/content/spell-reference";
import { AppIcon } from "@/components/ui/app-icon";
import { InspectPanel, PickGrid, PickLayout, PickSection, type PickTile } from "@/components/ui/pick-grid";
import { GearList } from "@/components/ui/gear-info";
import { findGearInfo, gearInfosFor } from "@/lib/content/item-info";
import { backgroundIcon, classIcon, featIcon, featureIcon, pactIcon, raceIcon, schoolIcon, skillIcon, styleIcon } from "@/lib/ui/game-icons";
import { ClassPortrait } from "@/components/ui/class-portrait";
import {
  parseWarlockInvocationSummary,
  warlockInvocationMeetsPrerequisite,
} from "@/lib/character/warlock-invocations";

type CreatorStep = 0 | 1 | 2 | 3;
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
  | "warlock-invocations"
  | "background"
  | "custom-background-tools"
  | "custom-background-languages"
  | "custom-background-equipment"
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
  | "warlock-pact"
  | "warlock-invocations";

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
  "warlock-invocations",
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
  monk: [
    {
      id: "combat-role",
      title: "Combat Role",
      body: "Fast, unarmored skirmisher who strikes several times a turn, slips in and out of melee, and locks down single targets.",
    },
    {
      id: "core-resources",
      title: "Core Resources",
      body: "Martial Arts powers unarmed strikes and monk weapons, Ki fuels Flurry of Blows, Patient Defense, Step of the Wind and Stunning Strike, and Unarmored Defense uses DEX + WIS.",
    },
    {
      id: "level-rhythm",
      title: "Level Rhythm",
      body: "Ki arrives at 2, your Monastic Tradition at 3, Extra Attack and Stunning Strike at 5, Evasion at 7, and the Martial Arts die grows at 5, 11 and 17.",
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

function toolTooltipContent(tool: ContentBundle["tools"][number] | undefined, label: string, category: string) {
  const contents: Record<string, string> = {
    "alchemists-supplies": "glass beakers, mixing rods, chemicals, and small burners",
    "brewers-supplies": "jugs, hops, siphons, tubing, and flavoring ingredients",
    "calligraphers-supplies": "ink, quills, parchment, and careful lettering tools",
    "carpenters-tools": "saw, hammer, nails, hatchet, square, and measuring tools",
    "cartographers-tools": "quills, parchment, compasses, calipers, and rulers",
    "cobblers-tools": "awl, knife, hammer, thread, leather scraps, and shoe forms",
    "cooks-utensils": "pots, knives, ladles, cleavers, and cooking implements",
    "glassblowers-tools": "blowpipe, shaping blocks, tweezers, and glassworking tools",
    "jewelers-tools": "small saws, files, pliers, polishing tools, and a loupe",
    "leatherworkers-tools": "knife, mallet, edger, punch, thread, and leather scraps",
    "masons-tools": "trowel, hammer, chisels, brushes, and measuring square",
    "painters-supplies": "easel, canvas, brushes, charcoal, palette, and paints",
    "potters-tools": "potter's needles, ribs, scrapers, knives, and calipers",
    "smiths-tools": "hammers, tongs, charcoal, rags, and sharpening tools",
    "tinkers-tools": "small hand tools, thread, needles, glue, cloth, and metal scraps",
    "weavers-tools": "thread, needles, cloth scraps, and weaving implements",
    "woodcarvers-tools": "knives, gouges, small saws, and carving tools",
    "dice-set": "dice used for games of chance",
    "dragonchess-set": "dragonchess board and pieces",
    "playing-card-set": "marked or ordinary cards for card games",
    "three-dragon-ante-set": "cards for Three-Dragon Ante",
    "disguise-kit": "cosmetics, hair dye, small props, and costume pieces",
    "forgery-kit": "inks, papers, pens, seals, sealing wax, and scraping tools",
    "herbalism-kit": "pouches, clippers, mortar and pestle, jars, and herbal supplies",
    "navigators-tools": "charts, compass, calipers, rulers, and navigation instruments",
    "poisoners-kit": "vials, chemicals, stirring tools, and poison preparation gear",
    "thieves-tools": "lock picks, files, small mirror, scissors, and pliers",
  };

  return (
    <span className="spell-tooltip-block">
      <span className="spell-tooltip-head">
        <strong>{tool?.name ?? label}</strong>
        <span>{category}</span>
      </span>
      <span className="spell-tooltip-meta">
        {tool?.cost ? <span>{tool.cost}</span> : null}
        {tool?.weight ? <span>{tool.weight}</span> : null}
      </span>
      {tool?.id && contents[tool.id] ? (
        <span className="spell-tooltip-copy">{`Includes: ${contents[tool.id]}.`}</span>
      ) : null}
      <span className="spell-tooltip-copy">
        {`Tool proficiency lets you add your proficiency bonus when a check uses ${tool?.name ?? label}.`}
      </span>
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
  const mounted = typeof document !== "undefined";
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
              <Keywordize>{content}</Keywordize>
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

  if (browser === "warlock-invocations") {
    return "warlock-invocations";
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
      {feature.short ? <span className="feature-tooltip-short">{feature.short}</span> : null}
      <FactChips facts={feature.facts} hidePassive />
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

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

function pointBuyStepCost(currentScore: number, nextScore: number) {
  return pointBuyCost(nextScore) - pointBuyCost(currentScore);
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

function signedNumber(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
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

function isCustomBackground(backgroundId: string) {
  return backgroundId === "custom-background";
}

function backgroundFeatureOptions(content: ContentBundle) {
  return content.backgrounds.filter((background) => !isCustomBackground(background.id));
}

function customBackgroundProficiencyOptions(content: ContentBundle) {
  return [
    ...content.tools.map((tool) => ({
      id: `tool:${tool.id}`,
      label: tool.name,
      kind: "Tool" as const,
      meta: tool.category,
    })),
    ...content.languages.map((language) => ({
      id: `language:${language.id}`,
      label: language.name,
      kind: "Language" as const,
      meta: language.category,
    })),
  ];
}

function customBackgroundProficiencyLabel(content: ContentBundle, value: string) {
  const [kind, id] = value.split(":");
  if (kind === "tool") {
    return content.tools.find((tool) => tool.id === id)?.name ?? id;
  }
  if (kind === "language") {
    return content.languages.find((language) => language.id === id)?.name ?? id;
  }
  return value;
}

function featPrimaryDetail(feat: ContentBundle["feats"][number]) {
  return feat.detailParagraphs?.find((paragraph) => !paragraph.startsWith("Option:")) ?? feat.summary;
}

function featTableArtifactKeys(feat: ContentBundle["feats"][number]) {
  return new Set(
    (feat.detailTables ?? []).flatMap((table) => [
      table.title,
      table.columns.join(""),
      ...table.rows.map((row) => row.join("")),
    ]).map((value) => cleanImportedText(value).toLowerCase().replace(/[^a-z0-9]+/g, "")),
  );
}

function featBenefitParagraphs(feat: ContentBundle["feats"][number]) {
  const sourceSummary = cleanImportedText(feat.summary);
  const tableArtifacts = featTableArtifactKeys(feat);
  const details = (feat.detailParagraphs ?? [])
    .map(cleanImportedText)
    .map((paragraph) => {
      const tableTitle = (feat.detailTables ?? []).find((table) => paragraph.endsWith(` ${table.title}`))?.title;
      return tableTitle ? paragraph.slice(0, -tableTitle.length).trim() : paragraph;
    })
    .filter(Boolean)
    .filter((paragraph) => paragraph !== sourceSummary)
    .filter((paragraph) => !tableArtifacts.has(paragraph.toLowerCase().replace(/[^a-z0-9]+/g, "")))
    .filter((paragraph) => !paragraph.startsWith("Option: Greater"));

  return details.length ? details : [sourceSummary].filter(Boolean);
}

function featSearchText(feat: ContentBundle["feats"][number]) {
  return [
    feat.name,
    feat.source,
    feat.prerequisite,
    feat.summary,
    ...(feat.detailParagraphs ?? []),
  ].filter(Boolean).join(" ").toLowerCase();
}

function featTags(feat: ContentBundle["feats"][number]) {
  const text = featSearchText(feat);
  const tags = [
    feat.prerequisite ? "Prerequisite" : null,
    text.includes("increase your") || text.includes("ability score increase") ? "ASI +1" : null,
    text.includes("spell") || text.includes("cantrip") ? "Magic" : null,
    text.includes("reaction") ? "Reaction" : null,
    text.includes("bonus action") ? "Bonus Action" : null,
    text.includes("proficiency") ? "Proficiency" : null,
    text.includes("long rest") || text.includes("short rest") ? "Rest Recharge" : null,
  ].filter((tag): tag is string => Boolean(tag));

  return [...new Set(tags)].slice(0, 4);
}

function featSourceShort(source: string | undefined) {
  if (!source) {
    return "Unknown Source";
  }

  return source
    .replace("Player's Handbook", "PHB")
    .replace("Tasha's Cauldron of Everything", "Tasha")
    .replace("Bigby Presents - Glory of the Giants", "Bigby")
    .replace("Fizban's Treasury of Dragons", "Fizban")
    .replace("Planescape - Adventures in the Multiverse", "Planescape")
    .replace("Dragonlance: Shadow of the Dragon Queen", "Dragonlance");
}

function firstSentence(text: string | null | undefined) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) {
    return null;
  }
  const match = value.match(/^(.{20,220}?[.!?])(\s|$)/);
  return match ? match[1] : value.length > 220 ? `${value.slice(0, 217)}...` : value;
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
    case 3:
      return "custom-background-tools";
    default:
      return null;
  }
}

function isOriginCarouselStep(step: CreatorStep): boolean {
  return step === 0;
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
    case "eladrin":
      return "leaf";
    case "human":
      return "person";
    case "tabaxi":
      return "paw";
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
    case "custom-background-tools":
    case "custom-background-languages":
    case "custom-background-equipment":
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
    case 3:
      return "Tool, language ve equipment kararlarını ayrı bir çalışma alanında toparla.";
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
    case "custom-background-tools":
      return "Tools";
    case "custom-background-languages":
      return "Languages";
    case "custom-background-equipment":
      return "Background Equipment";
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
      return "Class seviyelerinden gelen Ability Score Improvement seçimlerini burada yönet.";
    case "background":
      return "Macera öncesi hayatını ve hangi alışkanlıklarla geldiğini tanımla.";
    case "custom-background-tools":
      return "Custom Background için tool proficiency seçeneklerini burada yönet.";
    case "custom-background-languages":
      return "Custom Background için language seçeneklerini burada yönet.";
    case "custom-background-equipment":
      return "Bir background equipment paketi kullan ya da gear için coin harca.";
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
  spellReferenceCollection,
  currentClassRules,
  classOptions,
  multiclassChoices,
  availableSubclassOptions,
  availableSpells,
  availableFeats,
  engineCatalog,
  featContext,
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
  optionChoices,
  toggleOptionChoice,
  previewDraft,
  previewStats,
  languageChoices,
  toggleLanguageChoice,
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
  pendingTasks = [],
}: {
  pendingTasks?: LevelUpTask[];
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
  engineCatalog: EngineCatalog;
  featContext: FeatCheckContext;
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
  optionChoices: AvailableChoice[];
  /** Sheet ile ayni hesaptan gelen taslak; onizleme panelindeki sayilar buradan okunur. */
  previewDraft: CharacterDraft;
  languageChoices: LanguageChoice[];
  toggleLanguageChoice: (choiceId: string, language: string) => void;
  previewStats: { armorClass: DerivedStatDisplay; walkingSpeed: DerivedStatDisplay; extraMovementModes: DerivedStatDisplay[] };
  toggleOptionChoice: (choiceId: string, value: string) => void;
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
  // Level up'tan gelinirse ilgili sayfa acilir (sessionStorage'daki atlama bir kez kullanilir).
  const [inspectState, setInspectState] = useState<{ key: string; id: string } | null>(null);
  const [creatorBrowser, setCreatorBrowser] = useState<CreatorBrowser>(() => (readCreatorJump()?.browser as CreatorBrowser | undefined) ?? "lineage");
  useEffect(() => {
    clearCreatorJump();
  }, []);
  const initialLineageGroup = lineageGroupForSpecies(lineageGroups, draft.speciesId) ?? lineageGroups[0];
  const initialSubrace = initialLineageGroup?.subraces.find((subrace) => subrace.id === draft.speciesId) ?? initialLineageGroup?.subraces[0] ?? null;
  const [selectedLineageId, setSelectedLineageId] = useState(initialLineageGroup?.id ?? "");
  const [selectedSubraceId, setSelectedSubraceId] = useState(initialSubrace?.id ?? "");
  const [lineagePage, setLineagePage] = useState(0);
  const [backgroundPage, setBackgroundPage] = useState(0);
  const [backgroundQuery, setBackgroundQuery] = useState("");
  const [backgroundShowAll, setBackgroundShowAll] = useState(false);
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
  const [featSearchQuery, setFeatSearchQuery] = useState("");
  const [selectedFeatId, setSelectedFeatId] = useState<string | null>(null);
  const [featFilter, setFeatFilter] = useState<"fits" | "locked" | "all">("fits");
  const [originCarouselDirection, setOriginCarouselDirection] = useState(1);
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
    if (group.id === "half-elf-skill-choice" || group.id === "variant-human-skill-choice") {
      return {
        ...group,
        options: Object.keys(skillAbilities).map((skillId) => ({
          id: skillId,
          label: skillLabel(skillId),
          summary: skillDescription(skillId, draft.skills.find((entry) => entry.id === skillId)?.description),
          details: [],
          grants: [{ type: "skill_proficiency", values: [skillId] }],
          childChoiceGroupIds: [],
        })),
      };
    }

    if (group.id.endsWith("-feat-choice")) {
      // 1. level'da alinabilecek feat'ler: irk feat'leri ve level on kosullu feat'ler haric.
      return {
        ...group,
        options: content.feats
          .filter((feat) => {
            const current = draft.lineageChoices?.[group.id] ?? [];
            return current.includes(feat.id) || checkFeat(feat.id, current[0] ?? null).eligible;
          })
          .map((feat) => ({
            id: feat.id,
            label: feat.name,
            summary: feat.prerequisite ? `Prerequisite: ${feat.prerequisite}` : cleanImportedText(feat.summary),
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
  const originRaceChoiceGroups = [
    ...currentStructuredRootChoiceGroups.map((group) => ({ group, map: currentStructuredChoiceGroupMap })),
    ...currentStructuredSublineageRootChoiceGroups.map((group) => ({ group, map: currentStructuredSublineageChoiceGroupMap })),
  ].filter(({ group }) => !group.id.includes("language"));
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
  // Esnek bonus slot miktarlari: Tabaxi/Eladrin +2/+1, Variant Human +1/+1.
  const [firstFlexAmount, secondFlexAmount] = flexibleBonusAmounts(currentStructuredLineage, currentStructuredSublineage);
  const firstFlexLabel = `+${firstFlexAmount}`;
  const secondFlexLabel = `+${secondFlexAmount}`;
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
          ? { ability: draft.flexibleAbilityBonuses.plusTwo, amount: firstFlexAmount }
          : null,
        draft.flexibleAbilityBonuses.plusOne
          ? { ability: draft.flexibleAbilityBonuses.plusOne, amount: secondFlexAmount }
          : null,
      ].filter((entry): entry is { ability: AbilityId; amount: number } => Boolean(entry))
    : [];
  const fighterAsiChoices = draft.fighterChoices?.abilityScoreImprovements ?? {};
  const fighterAsiBonuses = asiAbilityBonuses(engineCatalog, draft);
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
  // Ability yontemi: Point Buy (27 puan, 8-15), Standard Array (15,14,13,12,10,8) ya da Manual (zar / DM).
  const pointBuyValid = pointBuyRemaining >= 0 && draft.abilities.every((ability) => ability.score >= 8 && ability.score <= 15);
  const standardArrayValid =
    [...draft.abilities.map((ability) => ability.score)].sort((left, right) => right - left).join(",") === STANDARD_ARRAY.join(",");
  const abilityMethod = draft.abilityMethod ?? (pointBuyValid ? "point-buy" : "manual");
  const setAbilityMethod = (method: "point-buy" | "standard-array" | "manual") => {
    updateDraft((current) => {
      const scores = current.abilities.map((ability) => ability.score);
      const keepsPointBuy = scores.every((score) => score >= 8 && score <= 15) && scores.reduce((total, score) => total + pointBuyCost(score), 0) <= 27;
      const keepsArray = [...scores].sort((left, right) => right - left).join(",") === STANDARD_ARRAY.join(",");
      return {
        ...current,
        abilityMethod: method,
        abilities:
          method === "point-buy" && !keepsPointBuy
            ? current.abilities.map((ability) => ({ ...ability, score: 8 }))
            : method === "standard-array" && !keepsArray
              ? current.abilities.map((ability, index) => ({ ...ability, score: STANDARD_ARRAY[index] ?? 8 }))
              : current.abilities,
      };
    });
  };
  // Standard Array'de bir degeri baska bir yetenege verince ikisi yer degistirir.
  const assignStandardArrayValue = (abilityId: AbilityId, value: number) => {
    updateDraft((current) => {
      const previousValue = current.abilities.find((ability) => ability.id === abilityId)?.score ?? value;
      return {
        ...current,
        abilities: current.abilities.map((ability) =>
          ability.id === abilityId ? { ...ability, score: value } : ability.score === value ? { ...ability, score: previousValue } : ability,
        ),
      };
    });
  };
  const lineagePageSize = 15;
  const lineagePageCount = Math.max(1, Math.ceil(lineageCards.length / lineagePageSize));
  const backgroundPageSize = 16;
  const backgroundPageCount = Math.max(1, Math.ceil(content.backgrounds.length / backgroundPageSize));
  const selectedBackground =
    content.backgrounds.find((item) => item.id === draft.backgroundId) ??
    currentBackground ??
    content.backgrounds[0];
  const customBackgroundActive = Boolean(selectedBackground && isCustomBackground(selectedBackground.id));
  const customBackgroundFeatureOptions = useMemo(() => backgroundFeatureOptions(content), [content]);
  const customBackgroundProficiencyChoices = useMemo(() => customBackgroundProficiencyOptions(content), [content]);
  const selectedCustomFeatureBackground =
    customBackgroundFeatureOptions.find((item) => item.id === draft.customBackground?.featureBackgroundId) ??
    customBackgroundFeatureOptions[0] ??
    null;
  const selectedCustomProficiencyLabels = (draft.customBackground?.proficiencyIds ?? []).map((entry) =>
    customBackgroundProficiencyLabel(content, entry),
  );
  const normalFeats = useMemo(
    // Irk feat'leri de listede; uygun olmayanlar on kosul kontrolunde kilitli gorunur.
    () => content.feats,
    [content.feats],
  );
  const visibleNormalFeats = useMemo(() => {
    const query = featSearchQuery.trim().toLowerCase();
    return normalFeats.filter((feat) => (query ? featSearchText(feat).includes(query) : true));
  }, [featSearchQuery, normalFeats]);
  const selectedFeat =
    normalFeats.find((feat) => feat.id === selectedFeatId) ??
    normalFeats.find((feat) => featContext.featIds.includes(feat.id)) ??
    normalFeats[0] ??
    null;
  const hasSelectedBackgroundToolData = Boolean(
    selectedBackground?.toolProficiencies.fixed.length || selectedBackground?.toolProficiencies.choices.length,
  );
  const allBackgroundEquipment = useMemo(
    () => content.backgrounds.flatMap((item) => item.equipment ?? []),
    [content.backgrounds],
  );
  const currentCuratedClass = curatedClassMap.get(draft.classId) ?? null;
  // Inceleme paneli secimi ekrana bagli: ekran degisince kendiliginden sifirlanir.
  const inspectKey = `${creatorStep}:${creatorBrowser}`;
  const inspectId = inspectState?.key === inspectKey ? inspectState.id : null;
  const setInspectId = (id: string | null) => setInspectState(id ? { key: inspectKey, id } : null);
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

    // Data'daki soyut secenekler ("simple-weapon", "two-martial"...) her class icin ayni sekilde acilir.
    const isMelee = (option: { id: string }) => {
      const weaponId = option.id.replace(/^(simple|martial)-/, "");
      return content.weapons.some((weapon) => weapon.id === weaponId && weapon.attackType === "melee");
    };
    const expand = (option: ClassStartingEquipmentGroup["options"][number]): ClassStartingEquipmentGroup["options"] => {
      switch (option.id) {
        case "simple-weapon":
          return simpleWeaponOptions;
        case "simple-melee-weapon":
          return simpleMeleeWeaponOptions;
        case "martial-weapon":
          return martialWeaponOptions;
        case "martial-melee-weapon":
          return martialWeaponOptions.filter(isMelee);
        case "leather-simple-daggers":
          return simpleWeaponOptions.map((weaponOption) => ({
            id: `leather-${weaponOption.id}-daggers`,
            label: `Leather Armor, ${weaponOption.label}, and Two Daggers`,
            items: ["Leather Armor", weaponOption.label, "2x Daggers"],
          }));
        case "weapon-shield":
          return martialWeaponOptions.map((weaponOption) => ({
            id: `martial-shield-${weaponOption.id}`,
            label: `${weaponOption.label} and Shield`,
            items: [weaponOption.label, "Shield"],
          }));
        case "two-martial":
          return martialWeaponOptions.flatMap((firstWeapon) =>
            martialWeaponOptions.map((secondWeapon) => ({
              id: `two-martial-${firstWeapon.id}-${secondWeapon.id}`,
              label: "Two Martial Weapons",
              items: [firstWeapon.label, secondWeapon.label],
            })),
          );
        case "two-simple-melee":
          return simpleMeleeWeaponOptions.flatMap((firstWeapon) =>
            simpleMeleeWeaponOptions.map((secondWeapon) => ({
              id: `two-simple-melee-${firstWeapon.id}-${secondWeapon.id}`,
              label: "Two Simple Melee Weapons",
              items: [firstWeapon.label, secondWeapon.label],
            })),
          );
        default:
          return [option];
      }
    };
    return baseEquipment.map((group) => ({ ...group, options: group.options.flatMap(expand) }));
  }, [content.weapons, currentCuratedClass?.id, currentCuratedClass?.startingEquipment, martialWeaponOptions, simpleMeleeWeaponOptions, simpleWeaponOptions]);
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
    currentClass.id === "warlock" ? "Added to your spell list (pick them as known spells)" : "Auto added from subclass magic";
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
  // Magical Secrets gibi "spells known'a sayilan" secimler class listesinden secilebilecek sayidan duser.
  const knownSpellsFromChoices = optionChoices
    .filter((entry) => entry.choice.id.startsWith("magical-secrets"))
    .reduce((total, entry) => total + entry.selectedIds.length, 0);
  const classKnownSpellLimit = Math.max(
    0,
    (spellSelectionRules.totalKnownLimit || Number(currentWarlockSpellsKnown || 0) || 0) - knownSpellsFromChoices,
  );
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
      const parsed = parseWarlockInvocationSummary(option);
      return warlockInvocationMeetsPrerequisite(parsed.requirement, {
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
    const parsed = parseWarlockInvocationSummary(option);
    const isUnlocked = warlockInvocationMeetsPrerequisite(parsed.requirement, {
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
    (currentCuratedClass?.highlights.length
      ? currentCuratedClass.highlights.map((item, index) => ({ id: `highlight-${index}`, title: item.title, body: item.body }))
      : null) ??
    classOverviewHighlightsByClass[currentClass.id as keyof typeof classOverviewHighlightsByClass] ??
    // Yazilmamis bir class icin baska class'in metni gosterilmez; kartlar class verisinden kurulur.
    [
      { id: "combat-role", title: "Overview", body: currentCuratedClass?.summary ?? currentClass.name },
      {
        id: "core-resources",
        title: "Core Features",
        body: (currentCuratedClass?.classFeatures ?? [])
          .filter((feature) => (feature.unlockLevel ?? 1) <= 2)
          .map((feature) => feature.name)
          .join(", ") || "See Class Features.",
      },
      { id: "level-rhythm", title: "Hit Dice", body: `d${currentClass.hitDie} per level` },
    ];
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
  const fighterAsiFeature = currentCuratedClass?.classFeatures.find((feature) => feature.id === "ability-score-improvement") ?? null;
  const fighterAsiLevels = fighterAsiFeature?.milestones.map((milestone) => milestone.level) ?? [];
  const unlockedFighterAsiLevels = fighterAsiLevels.filter((level) => draft.level >= level);
  const skillChoiceOptions = currentClass.id === "bard" ? Object.keys(skillAbilities) : currentClassRules?.skillChoices ?? [];
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
    { id: 3 as CreatorStep, label: "Tools & Gear" },
  ];
  const creatorMenuDescriptions: Record<CreatorStep, string> = {
    0: "Identity, race, subrace, and background setup.",
    1: "Class path, equipment, subclass, and spellcasting choices.",
    2: "Ability scores and skill proficiency setup.",
    3: "Tools, languages, and equipment packages.",
  };
  const fighterJourneyBrowsers: CreatorBrowser[] = [
    "class",
    "class-features",
    "inventory",
    "fighter-fighting-style",
    "warlock-pact",
    "warlock-invocations",
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
        id: "subclass",
        label: "Subclass",
        browser: "subclass",
        minLevel: 3,
        summary: `Choose your ${currentCuratedClass?.subclassHeading ?? "subclass"}.`,
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
      {
        id: "spells",
        label: currentClass.id === "warlock" ? "Spells" : "Spellcasting",
        browser: "spells",
        summary: "Choose spells and class magic options.",
      },
    ];
    const baseStages = currentCuratedClass?.journeyStages.length ? currentCuratedClass.journeyStages : fallbackStages;
    // Ekipman adimi artik Class akisinda (eskiden filtreleniyordu ve sadece Tools & Gear'dan aciliyordu).
    const normalizedBaseStages = baseStages;
    const subclassStages = selectedJourneySubclass?.journeyStages ?? [];
    const stageOrder = ["class", "class-features", "inventory", "fighter-fighting-style", "fighter-asi", "subclass", "subclass-features", "subclass-choices", "warlock-pact", "warlock-invocations", "spells"];
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
  }, [currentClass.id, currentCuratedClass?.journeyStages, currentCuratedClass?.subclassHeading, selectedJourneySubclass?.journeyStages, draft.level, fighterJourneySubclassId, fighterAsiFeature]);
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
      ...(fighterAsiFeature
        ? [{ type: "item", id: "fighter-asi", label: "ASI", step: 2 } as const]
        : []),
      { type: "item", id: "feats", label: "Feats", step: 2 },
      { type: "divider", id: "ability-skills", label: "Skill Setup" },
      { type: "item", id: "skills", label: "Skills", step: 2 },
    ],
    [fighterAsiFeature],
  );
  const gearSubmenuItems = useMemo<SidebarNavEntry[]>(
    () => [
      { type: "divider", id: "gear-proficiencies", label: "Proficiencies" },
      { type: "item", id: "custom-background-tools", label: "Tools", step: 3 },
      { type: "item", id: "custom-background-languages", label: "Languages", step: 3 },
      { type: "divider", id: "gear-equipment", label: "Equipment" },
      { type: "item", id: "custom-background-equipment", label: "Equipment", step: 3 },
    ],
    [],
  );
  const activeSidebarItems = creatorStep === 0 ? classSubmenuItems : creatorStep === 1 ? subclassSubmenuItems : creatorStep === 2 ? abilitySubmenuItems : gearSubmenuItems;
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
  const originPageOrder = ["identity", "lineage", "background"] as const;
  const isOriginPage = (value: CreatorBrowser): value is (typeof originPageOrder)[number] =>
    (originPageOrder as readonly CreatorBrowser[]).includes(value);
  const originCarouselActive = isOriginCarouselStep(creatorStep);
  const activeOriginPage = isOriginPage(creatorBrowser) ? creatorBrowser : "lineage";
  const activeOriginPageIndex = originPageOrder.indexOf(activeOriginPage);
  const navigateOriginPage = (page: (typeof originPageOrder)[number]) => {
    const nextIndex = originPageOrder.indexOf(page);
    setOriginCarouselDirection(nextIndex >= activeOriginPageIndex ? 1 : -1);
    setCreatorBrowser(page);
  };
  const shiftOriginPage = (direction: 1 | -1) => {
    const nextIndex = Math.min(originPageOrder.length - 1, Math.max(0, activeOriginPageIndex + direction));
    setOriginCarouselDirection(direction);
    setCreatorBrowser(originPageOrder[nextIndex]);
  };

  useEffect(() => {
    const currentMenuItem = creatorMenu.find((item) => item.id === creatorStep);
    const currentSubmenuItem = findSidebarNavItem(classSubmenuItems, creatorBrowser);
    const currentSubclassSubmenuItem = findSidebarNavItem(subclassSubmenuItems, creatorBrowser);
    const currentAbilitySubmenuItem = findSidebarNavItem(abilitySubmenuItems, creatorBrowser);
    const currentGearSubmenuItem = findSidebarNavItem(gearSubmenuItems, creatorBrowser);
    if (currentMenuItem || currentSubmenuItem?.step === creatorStep || currentSubclassSubmenuItem?.step === creatorStep || currentAbilitySubmenuItem?.step === creatorStep || currentGearSubmenuItem?.step === creatorStep) {
      return;
    }

    setCreatorBrowser(defaultBrowserForStep(creatorStep));
  }, [abilitySubmenuItems, classSubmenuItems, gearSubmenuItems, subclassSubmenuItems, creatorBrowser, creatorStep]);

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
    if (!selectedFeatId && selectedFeat) {
      setSelectedFeatId(selectedFeat.id);
    }
  }, [selectedFeat, selectedFeatId]);

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

    if (creatorBrowser === "fighter-asi" && !fighterAsiFeature) {
      setCreatorBrowser("class");
    }
  }, [creatorBrowser, currentClass.id, fighterAsiFeature]);

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

  }, [creatorBrowser, customBackgroundActive, shouldShowSubraceNav, structuredLineageChoicesAvailable]);

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
      const customFeatureBackgroundId =
        current.customBackground?.featureBackgroundId ??
        customBackgroundFeatureOptions[0]?.id ??
        null;
      const customEquipmentBackgroundId =
        current.customBackground?.equipmentBackgroundId ??
        customFeatureBackgroundId;
      const customEquipment = nextBackground && isCustomBackground(nextBackground.id)
        ? current.customBackground?.equipmentMode === "coin"
          ? []
          : content.backgrounds.find((item) => item.id === customEquipmentBackgroundId)?.equipment ?? []
        : nextEquipment;

      return {
        ...current,
        backgroundId,
        backgroundToolChoiceIds: {},
        customBackground: {
          featureBackgroundId: customFeatureBackgroundId,
          skillIds: current.customBackground?.skillIds ?? [],
          proficiencyIds: current.customBackground?.proficiencyIds ?? [],
          equipmentMode: current.customBackground?.equipmentMode ?? "package",
          equipmentBackgroundId: customEquipmentBackgroundId,
        },
        inventory: [
          ...baseInventory,
          ...customEquipment.filter((item) => !baseInventory.includes(item)),
        ],
      };
    });
  };

  const updateCustomBackgroundFeature = (backgroundId: string) => {
    updateDraft((current) => ({
      ...current,
      customBackground: {
        ...(current.customBackground ?? {
          featureBackgroundId: null,
          skillIds: [],
          proficiencyIds: [],
          equipmentMode: "package" as const,
          equipmentBackgroundId: null,
        }),
        featureBackgroundId: backgroundId,
      },
    }));
  };

  const toggleCustomBackgroundSkill = (skillId: string) => {
    updateDraft((current) => {
      const currentSkills = current.customBackground?.skillIds ?? [];
      const nextSkills = currentSkills.includes(skillId)
        ? currentSkills.filter((entry) => entry !== skillId)
        : [...currentSkills, skillId].slice(-2);

      return {
        ...current,
        customBackground: {
          ...(current.customBackground ?? {
            featureBackgroundId: customBackgroundFeatureOptions[0]?.id ?? null,
            skillIds: [],
            proficiencyIds: [],
            equipmentMode: "package" as const,
            equipmentBackgroundId: customBackgroundFeatureOptions[0]?.id ?? null,
          }),
          skillIds: nextSkills,
        },
      };
    });
  };

  const toggleCustomBackgroundProficiency = (proficiencyId: string) => {
    updateDraft((current) => {
      const currentProficiencies = current.customBackground?.proficiencyIds ?? [];
      const nextProficiencies = currentProficiencies.includes(proficiencyId)
        ? currentProficiencies.filter((entry) => entry !== proficiencyId)
        : [...currentProficiencies, proficiencyId].slice(-2);

      return {
        ...current,
        customBackground: {
          ...(current.customBackground ?? {
            featureBackgroundId: customBackgroundFeatureOptions[0]?.id ?? null,
            skillIds: [],
            proficiencyIds: [],
            equipmentMode: "package" as const,
            equipmentBackgroundId: customBackgroundFeatureOptions[0]?.id ?? null,
          }),
          proficiencyIds: nextProficiencies,
        },
      };
    });
  };

  const renderBackgroundToolCards = (keyPrefix: string) => {
    if (!selectedBackground) {
      return null;
    }

    return (
      <>
        {selectedBackground.toolProficiencies.fixed.map((toolName) => {
          const toolId = toolIdFromValue(content, toolName);
          const tool = content.tools.find((entry) => entry.id === toolId);
          return (
            <article key={`${keyPrefix}-fixed-${toolName}`} className="fighter-feature-card compact unlocked tool-choice-card">
              <span className="fighter-journey-card-label">{tool?.category ?? "tool"}</span>
              <strong>
                <HoverTooltip
                  label={tool?.name ?? toolName}
                  content={toolTooltipContent(tool, toolName, tool?.category ?? "tool")}
                />
              </strong>
              <span className="fighter-feature-check" aria-hidden="true">✓</span>
            </article>
          );
        })}
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
                      <span className="fighter-journey-card-label">{tool?.category ?? optionId}</span>
                      <strong>
                        <HoverTooltip
                          label={label}
                          content={toolTooltipContent(tool, label, tool?.category ?? optionId)}
                        />
                      </strong>
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
        <div className="pick-section-head">
          <span className="pick-section-title">
            <strong>{group.prompt}</strong>
          </span>
          <span className={selectedOptionId ? "pick-counter done" : "pick-counter pending"}>{selectedOptionId ? "Done" : "Pick 1"}</span>
        </div>
        {directOptions.length ? (
          <PickGrid
            label={group.prompt}
            pageSize={8}
            columns={Math.min(4, Math.max(2, directOptions.length))}
            size="sm"
            items={directOptions.map((option) => {
              const infos = gearInfosFor(content, option.label, option.items);
              return {
                id: option.id,
                name: option.label,
                sub: infos.map((info) => info.sub).slice(0, 2).join(" · ") || undefined,
                icon: infos[0]?.icon ?? "knapsack",
                selected: selectedOptionId === option.id,
              };
            })}
            onPick={(id) => setFighterEquipmentChoice(group.id, id)}
          />
        ) : null}
        <div className="fighter-journey-grid equipment-choice-grid">
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
        {(() => {
          const chosen = group.options.find((option) => option.id === selectedOptionId) ?? null;
          return chosen ? (
            <GearList title="What you get" infos={gearInfosFor(content, chosen.label, chosen.items)} />
          ) : (
            <p className="pick-note">Pick one to see what is inside.</p>
          );
        })()}
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

  // Feat on kosullari ve slotlari ortak motordan (src/lib/engine/feats.ts).
  const checkFeat = (featId: string, ownFeatId: string | null = null) =>
    featEligibility(featId, engineCatalog, draft, {
      ...featContext,
      featIds: featContext.featIds.filter((id) => id !== ownFeatId),
    });
  const currentFeatSlots = featSlots(engineCatalog, draft);
  const openFeatSlot =
    currentFeatSlots.find((slot) => slot.kind === "lineage" && !slot.featId) ??
    currentFeatSlots.find((slot) => slot.kind === "asi" && (!slot.mode || (slot.mode === "feat" && !slot.featId))) ??
    null;
  const usedFeatSlotCount = currentFeatSlots.filter((slot) => slot.featId).length;
  const assignFeatToSlot = (featId: string) => {
    if (!openFeatSlot) {
      return;
    }
    if (openFeatSlot.kind === "asi" && openFeatSlot.level) {
      setFighterAsiFeatChoice(openFeatSlot.level, featId);
      return;
    }
    if (openFeatSlot.groupId) {
      const groupId = openFeatSlot.groupId;
      updateDraft((current) => ({ ...current, lineageChoices: { ...(current.lineageChoices ?? {}), [groupId]: [featId] } }));
    }
  };
  const removeFeatFromSlot = (featId: string) => {
    const slot = currentFeatSlots.find((entry) => entry.featId === featId);
    if (slot?.kind === "asi" && slot.level) {
      clearFighterAsiChoice(slot.level);
    } else if (slot?.groupId) {
      const groupId = slot.groupId;
      updateDraft((current) => ({ ...current, lineageChoices: { ...(current.lineageChoices ?? {}), [groupId]: [] } }));
    }
  };
  const renderFeatRequirementNotes = (featId: string, ownFeatId: string | null) => {
    const check = checkFeat(featId, ownFeatId);
    if (!check.unmet.length && !check.dmNotes.length) {
      return null;
    }
    return (
      <span className="feat-requirement-notes">
        {check.unmet.length ? <span className="feat-requirement-unmet">{`Missing: ${check.unmet.join(", ")}`}</span> : null}
        {check.dmNotes.length ? <span className="feat-requirement-dm">{`DM approval: ${check.dmNotes.join(", ")}`}</span> : null}
      </span>
    );
  };
  const renderAsiFeatPicker = (level: number, selectedFeatId: string) => {
    const eligibleFeats = content.feats.filter((feat) => feat.id === selectedFeatId || checkFeat(feat.id, selectedFeatId || null).eligible);
    const lockedCount = content.feats.length - eligibleFeats.length;
    return (
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
          {eligibleFeats.map((feat) => (
            <option key={`asi-feat-${level}-${feat.id}`} value={feat.id}>
              {feat.name}
            </option>
          ))}
        </select>
        {selectedFeatId ? (
          <span>{content.feats.find((feat) => feat.id === selectedFeatId)?.summary ?? "Feat selected."}</span>
        ) : (
          <span>Pick one feat instead of ability score bonuses.</span>
        )}
        {selectedFeatId ? renderFeatRequirementNotes(selectedFeatId, selectedFeatId) : null}
        {lockedCount ? <span className="feat-requirement-hint">{`${lockedCount} feats hidden: prerequisites not met.`}</span> : null}
      </div>
    );
  };

  // Tek ASI karti: mod secimi (+2 / +1+1 / feat), sonra ability veya feat izgarasi.
  const renderAsiLevelCard = (level: number) => {
    const choice = fighterAsiChoices[level];
    const mode = choice?.mode ?? null;
    const plusTwo = choice?.plusTwoAbilityId ?? null;
    const plusOnes = choice?.plusOneAbilityIds ?? [];
    const featId = choice?.featId ?? "";
    const done = mode === "plus-two" ? Boolean(plusTwo) : mode === "split" ? plusOnes.length === 2 : mode === "feat" ? Boolean(featId) : false;
    const setMode = (next: "plus-two" | "split" | "feat") =>
      next === "feat"
        ? setFighterAsiFeatChoice(level, featId)
        : updateFighterAsiChoice(level, () => ({ mode: next, plusTwoAbilityId: null, plusOneAbilityIds: [], featId: null }));
    const eligibleFeats = content.feats.filter((feat) => feat.id === featId || checkFeat(feat.id, featId || null).eligible);
    const chosenFeat = content.feats.find((feat) => feat.id === featId) ?? null;
    return (
      <PickSection
        key={`asi-card-${level}`}
        title={`Level ${level}`}
        meta="Ability Score Improvement"
        picked={done ? 1 : 0}
        total={1}
        actions={
          mode ? (
            <button type="button" className="pick-filter" onClick={() => clearFighterAsiChoice(level)}>
              Clear
            </button>
          ) : null
        }
      >
        <PickGrid
          label={`Level ${level} improvement type`}
          columns={3}
          size="sm"
          items={[
            { id: "plus-two", name: "+2 to one ability", sub: "Best for your main stat", icon: "stars-stack", selected: mode === "plus-two" },
            { id: "split", name: "+1 to two abilities", sub: "Round two odd scores up", icon: "skills", selected: mode === "split" },
            { id: "feat", name: "Take a feat", sub: "A new ability instead", icon: "laurels", selected: mode === "feat" },
          ]}
          onPick={(id) => setMode(id as "plus-two" | "split" | "feat")}
        />
        {mode === "plus-two" || mode === "split" ? (
          <div className="asi-ability-row">
            {draft.abilities.map((ability) => {
              const projected = fighterAsiProjectedScore(ability.id, level);
              const active = mode === "plus-two" ? plusTwo === ability.id : plusOnes.includes(ability.id);
              const gain = mode === "plus-two" ? 2 : 1;
              const capped = projected + gain > 20;
              const full = mode === "split" && !active && plusOnes.length >= 2;
              return (
                <button
                  key={`asi-${level}-${ability.id}`}
                  type="button"
                  className={`asi-ability ${abilityAccentClass(ability.id)}${active ? " selected" : ""}`}
                  disabled={!active && (capped || full)}
                  title={capped ? "Can't go above 20" : undefined}
                  onClick={() =>
                    updateFighterAsiChoice(level, (current) =>
                      mode === "plus-two"
                        ? { mode: "plus-two", plusTwoAbilityId: current?.plusTwoAbilityId === ability.id ? null : ability.id, plusOneAbilityIds: [], featId: null }
                        : {
                            mode: "split",
                            plusTwoAbilityId: null,
                            plusOneAbilityIds: (current?.plusOneAbilityIds ?? []).includes(ability.id)
                              ? (current?.plusOneAbilityIds ?? []).filter((entry) => entry !== ability.id)
                              : [...(current?.plusOneAbilityIds ?? []), ability.id].slice(0, 2),
                            featId: null,
                          },
                    )
                  }
                >
                  <span>{ability.id}</span>
                  <strong>{active ? `${projected} → ${projected + gain}` : projected}</strong>
                  <small>{capped && !active ? "max 20" : `+${gain}`}</small>
                </button>
              );
            })}
          </div>
        ) : null}
        {mode === "feat" ? (
          <>
            <PickGrid
              label={`Level ${level} feat`}
                                  pageSize={12}
              columns={4}
              size="sm"
              items={eligibleFeats.map((feat) => ({
                id: feat.id,
                name: feat.name,
                sub: featSourceShort(feat.source),
                icon: featIcon(feat.name),
                selected: feat.id === featId,
              }))}
              onPick={(id) => setFighterAsiFeatChoice(level, id === featId ? "" : id)}
            />
            {chosenFeat ? (
              <p className="pick-note">
                <strong>{`${chosenFeat.name}: `}</strong>
                {firstSentence(featBenefitParagraphs(chosenFeat)[0] ?? chosenFeat.summary)}
                {" More in the Feats tab."}
              </p>
            ) : (
              <p className="pick-note">{`Only feats you qualify for are shown (${content.feats.length - eligibleFeats.length} hidden). The Feats tab shows all of them with reasons.`}</p>
            )}
          </>
        ) : null}
      </PickSection>
    );
  };

  const fighterAsiProjectedScore = (abilityId: AbilityId, level: number) => {
    const baseScore = draft.abilities.find((ability) => ability.id === abilityId)?.score ?? 8;
    const racialBonus = previewAbilityBonuses
      .filter((entry) => entry.ability === abilityId)
      .reduce((total, entry) => total + entry.amount, 0);
    const flexibleBonus = flexiblePreviewBonuses
      .filter((entry) => entry.ability === abilityId)
      .reduce((total, entry) => total + entry.amount, 0);
    const existingAsiBonus = asiAbilityBonuses(engineCatalog, draft, level).get(abilityId) ?? 0;
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
  // Onizleme sayilari sheet ile ayni hesaptan (previewDraft / previewStats) gelir; ikisi asla farkli gostermez.
  const dexterityModifier = previewDraft.abilities.find((ability) => ability.id === "DEX")?.modifier ?? 0;
  const constitutionModifier = previewDraft.abilities.find((ability) => ability.id === "CON")?.modifier ?? 0;
  const averageHitDieValue = Math.floor(currentClass.hitDie / 2) + 1;
  const initiativeBonusFromGrants = previewDraft.initiative - dexterityModifier;
  const previewPanelStats = [
    {
      label: "Armor Class",
      value: previewStats.armorClass.displayValue,
      breakdown: previewStats.armorClass.breakdown,
    },
    {
      label: "Initiative",
      value: signedNumber(previewDraft.initiative),
      breakdown: [
        `DEX modifier: ${signedNumber(dexterityModifier)}.`,
        ...(initiativeBonusFromGrants ? [`Other bonuses (feats, features): ${signedNumber(initiativeBonusFromGrants)}.`] : []),
      ],
    },
    {
      label: "Speed",
      value: previewStats.walkingSpeed.displayValue,
      breakdown: [
        ...previewStats.walkingSpeed.breakdown,
        ...previewStats.extraMovementModes.map((speed) => `${speed.label}: ${speed.displayValue}`),
      ],
    },
    {
      label: "Hit Points",
      value: String(previewDraft.maxHp),
      breakdown: [
        `Level 1: ${currentClass.hitDie} + CON ${signedNumber(constitutionModifier)}.`,
        `Later levels: ${Math.max(0, draft.level - 1)} × (${averageHitDieValue} + CON ${signedNumber(constitutionModifier)}).`,
        `Current maximum: ${previewDraft.maxHp}.`,
      ],
    },
  ];
  const previewPanelArcaneStats = [
    { label: "Spell Save DC", value: String(8 + draft.proficiencyBonus + intelligenceModifier) },
    {
      label: "Spell Attack",
      value: `${draft.proficiencyBonus + intelligenceModifier >= 0 ? "+" : ""}${draft.proficiencyBonus + intelligenceModifier}`,
    },
  ] as const;
  const previewSkillEntries = previewDraft.skills
    .filter((skill) => skill.proficient || draft.selectedSkillIds.includes(skill.id) || backgroundSkillIds.includes(skill.id))
    .map((skill) => ({
      label: skill.label,
      breakdown: skill.breakdown,
    }));
  const previewPanelProficiencies = [
    { label: "Weapons", value: compactPreviewValue(previewDraft.proficiencies.weapons.join(", ") || "None", 2) },
    { label: "Armor", value: compactPreviewValue(previewDraft.proficiencies.armor.join(", ") || "None", 2) },
    {
      label: "Skills",
      value: compactPreviewValue(previewSkillEntries.map((skill) => skill.label).join(", ") || "None", 3),
      tooltip: previewSkillEntries.length ? (
        <span className="spell-tooltip-block">
          <span className="spell-tooltip-head">
            <strong>Skill Proficiencies</strong>
            <span>Live draft data</span>
          </span>
          <span className="spell-tooltip-line-list">
            {previewSkillEntries.map((skill) => (
              <span key={`preview-skill-${skill.label}`} className="spell-tooltip-line-item">
                <span className="spell-tooltip-line-dot" aria-hidden="true" />
                <span>{`${skill.label}: ${skill.breakdown}`}</span>
              </span>
            ))}
          </span>
        </span>
      ) : null,
    },
  ];
  // Tek navigasyon: adimlar + ekranlar. Bekleyen secimler level-up gorevlerinden (pendingTasks) sayilir.
  const pendingFor = (browser: string) => {
    const fromTasks = pendingTasks.filter((task) => task.jump.browser === browser).length;
    if (browser === "skills") {
      return fromTasks + remainingClassSkillChoices;
    }
    if (browser === "abilities") {
      return fromTasks + (abilityMethod === "point-buy" && pointBuyRemaining > 0 ? 1 : abilityMethod === "standard-array" && !standardArrayValid ? 1 : 0);
    }
    if (browser === "custom-background-languages") {
      return fromTasks + languageChoices.reduce((total, choice) => total + Math.max(0, choice.count - choice.selectedNames.length), 0);
    }
    return fromTasks;
  };
  const originScreenLabels: Record<(typeof originPageOrder)[number], string> = {
    identity: "Name & Level",
    lineage: "Race",
    background: "Background",
  };
  const creatorFlowSteps: CreatorFlowStep[] = [
    {
      id: 0,
      label: "Origin",
      screens: originPageOrder.map((page) => ({ step: 0, browser: page, label: originScreenLabels[page], pending: pendingFor(page) })),
    },
    {
      id: 1,
      label: "Class",
      screens: fighterJourneyStageItems
        .filter((item) => item.browser)
        .map((item) => ({ step: 1, browser: item.browser as string, label: item.label, pending: pendingFor(item.browser as string) })),
    },
    {
      id: 2,
      label: "Abilities",
      screens: abilitySubmenuItems
        .filter((entry): entry is Extract<SidebarNavEntry, { type: "item" }> => entry.type === "item")
        .map((entry) => ({ step: 2, browser: entry.id as string, label: entry.label, pending: pendingFor(entry.id as string) })),
    },
    {
      id: 3,
      label: "Tools & Gear",
      screens: gearSubmenuItems
        .filter((entry): entry is Extract<SidebarNavEntry, { type: "item" }> => entry.type === "item")
        .map((entry) => ({ step: 3, browser: entry.id as string, label: entry.label, pending: pendingFor(entry.id as string) })),
    },
  ];
  const creatorFlowOrder = creatorFlowSteps.flatMap((step) => step.screens);
  const creatorFlowIndex = (() => {
    const exact = creatorFlowOrder.findIndex((screen) => screen.step === creatorStep && screen.browser === creatorBrowser);
    if (exact >= 0) {
      return exact;
    }
    if (creatorStep === 0) {
      return creatorFlowOrder.findIndex((screen) => screen.step === 0 && screen.browser === activeOriginPage);
    }
    return creatorFlowOrder.findIndex((screen) => screen.step === creatorStep);
  })();
  const creatorFlowCurrent = creatorFlowIndex >= 0 ? creatorFlowOrder[creatorFlowIndex] : null;
  const creatorFlowPrevious = creatorFlowIndex > 0 ? creatorFlowOrder[creatorFlowIndex - 1] : null;
  const creatorFlowNext =
    creatorFlowIndex >= 0 && creatorFlowIndex < creatorFlowOrder.length - 1 ? creatorFlowOrder[creatorFlowIndex + 1] : null;
  const goToCreatorScreen = (screen: CreatorFlowScreen) => {
    const browser = screen.browser as CreatorBrowser;
    if (screen.step === 0 && isOriginPage(browser)) {
      moveCreatorStep(0);
      navigateOriginPage(browser);
    } else if (screen.step === 1) {
      navigateFighterJourney(browser);
    } else {
      moveCreatorStep(screen.step as CreatorStep);
      setCreatorBrowser(browser);
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const creatorFlowSubtitle = [
    currentStructuredLineage?.name ?? currentLineageGroup.name,
    `${currentClass.name} ${draft.level}`,
    selectedJourneySubclass?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  const creatorFlowStats = [
    { label: "AC", value: previewStats.armorClass.displayValue },
    { label: "HP", value: String(previewDraft.maxHp) },
    { label: "Speed", value: previewStats.walkingSpeed.displayValue },
    ...previewPanelAbilities.map((ability) => ({ label: ability.id, value: String(ability.value) })),
  ];

  return (
    <div className="creator-layout">
      <div className="creator-ambient creator-ambient-left" aria-hidden="true" />
      <div className="creator-ambient creator-ambient-right" aria-hidden="true" />

      <div className="creator-workbench creator-workbench-navigation creator-workbench-flat">
        <div className="creator-stage-column">
          <CreatorFlowNav
            steps={creatorFlowSteps}
            activeStep={creatorStep}
            activeBrowser={creatorFlowCurrent?.browser ?? null}
            onNavigate={goToCreatorScreen}
            title={draft.name.trim() || "Unnamed character"}
            subtitle={creatorFlowSubtitle}
            stats={creatorFlowStats}
          />
          <div className={originCarouselActive ? "creator-main-panel creator-main-panel-clean creator-main-panel-flat origin-carousel-main" : "creator-main-panel creator-main-panel-clean creator-main-panel-flat"}>
          {originCarouselActive ? (
            <section className="origin-carousel-shell" aria-label="Origin setup">
              <div className="origin-carousel-window">
                <AnimatePresence mode="wait" custom={originCarouselDirection}>
                  <motion.section
                    key={activeOriginPage}
                    className="origin-carousel-page"
                    custom={originCarouselDirection}
                    initial={{ x: originCarouselDirection > 0 ? 90 : -90, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: originCarouselDirection > 0 ? -90 : 90, opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                  >
                    {activeOriginPage === "identity" ? (
                      <div className="origin-focus-card origin-pick-page">
                        <div className="fighter-journey-scene-head compact">
                          <h3>Name & Level</h3>
                          <p>Start with who you are and how far along your adventure is. You can change both later.</p>
                        </div>
                        <PickLayout
                          inspect={
                            <InspectPanel
                              icon="stars-stack"
                              kicker="Level"
                              title={`Level ${draft.level}`}
                              summary="Your level decides your hit points, proficiency bonus and which class features you have."
                              rows={[
                                { label: "Proficiency", value: signedNumber(draft.proficiencyBonus) },
                                { label: "Hit points", value: `${previewDraft.maxHp} with your current CON` },
                                { label: "Features", value: `${visibleClassFeatures.filter((feature) => classFeatureUnlockState.get(feature.id)?.acquired ?? true).length} ${currentClass.name.toLowerCase()} features unlocked` },
                                { label: "Tip", value: "Ask your DM which level the campaign starts at." },
                              ]}
                            />
                          }
                        >
                          <PickSection title="Character name">
                            <input
                              type="text"
                              className="pick-search identity-name-input"
                              value={draft.name}
                              placeholder="Enter character name"
                              aria-label="Character name"
                              onChange={(event) =>
                                updateDraft((current) => ({
                                  ...current,
                                  name: event.target.value,
                                }))
                              }
                            />
                          </PickSection>
                          <PickSection title="Level" meta={`proficiency bonus ${signedNumber(draft.proficiencyBonus)}`}>
                            <div className="identity-level-grid" role="group" aria-label="Character level">
                              {Array.from({ length: 20 }, (_, index) => index + 1).map((level) => (
                                <button
                                  key={`origin-level-${level}`}
                                  type="button"
                                  aria-pressed={draft.level === level}
                                  className={draft.level === level ? "pick-filter active" : "pick-filter"}
                                  onClick={() => applyLevelChange(level)}
                                >
                                  {level}
                                </button>
                              ))}
                            </div>
                          </PickSection>
                        </PickLayout>
                      </div>
                    ) : null}

                    {activeOriginPage === "lineage" ? (
                      <div className="origin-focus-card origin-selection-card origin-pick-page">
                        <PickLayout
                          inspect={
                            <InspectPanel
                              icon={raceIcon(currentStructuredLineage?.name ?? currentLineageGroup.name)}
                              kicker={currentStructuredSublineage?.name ?? currentSubraceEntry?.name ?? "Race"}
                              title={currentStructuredLineage?.name ?? currentLineageGroup.name}
                              summary={firstSentence(currentStructuredLineage?.summary ?? currentLineageGroup.summary)}
                              rows={[
                                ...(currentStructuredLineage?.facts.size ? [{ label: "Size", value: structuredFactValue(currentStructuredLineage.facts.size) }] : []),
                                ...(currentStructuredLineage?.facts.speed ? [{ label: "Speed", value: structuredFactValue(currentStructuredLineage.facts.speed) }] : []),
                                ...(currentStructuredLineage?.facts.languages.values.length
                                  ? [{ label: "Languages", value: structuredFactValue(currentStructuredLineage.facts.languages) }]
                                  : []),
                                ...(currentStructuredLineage?.features ?? []).map((feature) => ({
                                  label: feature.name,
                                  value: firstSentence(feature.summary),
                                })),
                              ]}
                              fullText={currentStructuredLineage?.summary ?? currentLineageGroup.summary}
                            />
                          }
                        >
                          <PickSection title="Race" picked={1} total={1}>
                            <PickGrid
                              label="Races"
                              columns={4}
                              items={lineageCards.map((group) => ({
                                id: group.id,
                                name: group.name,
                                icon: raceIcon(group.name),
                                selected: draft.speciesId === group.subraceId || (!group.subraceId && currentLineageGroup.id === group.lineageId),
                              }))}
                              onPick={(id) => {
                                const group = lineageCards.find((entry) => entry.id === id);
                                if (group) {
                                  selectLineageCard(group);
                                }
                              }}
                            />
                          </PickSection>
                          {visibleSubraceOptions.length ? (
                            <PickSection title="Subrace">
                              <PickGrid
                                label="Subraces"
                                columns={4}
                                size="sm"
                                items={visibleSubraceOptions.map((item) => ({
                                  id: item.id,
                                  name: item.id === "__none__" ? "None" : item.name,
                                  icon: raceIcon(item.name),
                                  selected:
                                    item.id === "__none__"
                                      ? !currentStructuredSublineage && !currentSubraceEntry
                                      : (currentStructuredSublineage?.id ?? currentSubraceEntry?.id) === item.id,
                                }))}
                                onPick={(id) => selectSubrace(id)}
                              />
                            </PickSection>
                          ) : null}
                        {/* Irk / alt irk secimleri (Variant Human skill + feat, High Elf cantrip). Dil secimleri Tools & Gear > Languages'ta. */}
                        {originRaceChoiceGroups.length ? (
                          <div className="creator-stack">
                            {originRaceChoiceGroups.map(({ group, map }) => renderLineageChoiceGroup(group, false, map))}
                          </div>
                        ) : null}
                        </PickLayout>
                      </div>
                    ) : null}

                    {activeOriginPage === "background" ? (
                      <div className="origin-focus-card origin-selection-card origin-pick-page">
                        {(() => {
                          const needle = backgroundQuery.trim().toLowerCase();
                          const core = content.backgrounds.filter(
                            (item) => item.id === draft.backgroundId || (item.source ?? "").startsWith("Player") || item.id.startsWith("custom"),
                          );
                          const list = needle
                            ? content.backgrounds.filter((item) => item.name.toLowerCase().includes(needle) || item.skillProficiencies.join(" ").toLowerCase().includes(needle))
                            : backgroundShowAll
                              ? content.backgrounds
                              : core;
                          const focus = content.backgrounds.find((item) => item.id === inspectId) ?? selectedBackground ?? null;
                          return (
                            <PickLayout
                              inspect={
                                focus ? (
                                  <InspectPanel
                                    icon={backgroundIcon(focus.name)}
                                    kicker={focus.source ?? "Background"}
                                    title={focus.name}
                                    summary={firstSentence(backgroundDescription(focus))}
                                    rows={backgroundMetaDescription(content, focus).map((meta) => ({
                                      label: meta.split(":")[0].replace(" Proficiencies", ""),
                                      value: meta.includes(":") ? meta.split(":").slice(1).join(":").trim() : meta,
                                    }))}
                                    fullText={backgroundDescription(focus)}
                                  >
                                    <GearList
                                      infos={gearInfosFor(content, "", [...backgroundToolSummary(content, focus), ...backgroundLanguageSummary(content, focus)])}
                                    />
                                  </InspectPanel>
                                ) : (
                                  <InspectPanel icon="open-book" title="Background" summary="Who you were before adventuring. Gives two skills and a tool or languages." />
                                )
                              }
                            >
                              <PickSection
                                title="Background"
                                meta={needle ? `${list.length} found` : backgroundShowAll ? `all ${content.backgrounds.length}` : "Player's Handbook"}
                                picked={draft.backgroundId ? 1 : 0}
                                total={1}
                                actions={
                                  <input
                                    type="search"
                                    className="pick-search"
                                    placeholder={`Search ${content.backgrounds.length} backgrounds`}
                                    aria-label="Search backgrounds"
                                    value={backgroundQuery}
                                    onChange={(event) => setBackgroundQuery(event.target.value)}
                                  />
                                }
                              >
                                <PickGrid
                                  label="Backgrounds"
                                  pageSize={16}
                                  key={`bg-${backgroundQuery}-${backgroundShowAll}`}
                                  columns={4}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={list.map((item) => ({
                                    id: item.id,
                                    name: item.name,
                                    sub: item.skillProficiencies.join(", ") || undefined,
                                    icon: backgroundIcon(item.name),
                                    selected: draft.backgroundId === item.id,
                                  }))}
                                  onPick={(id) => selectBackground(id)}
                                />
                                {!needle ? (
                                  <button type="button" className="inspect-toggle" onClick={() => setBackgroundShowAll((value) => !value)}>
                                    {backgroundShowAll ? "Show only Player's Handbook" : `Show all ${content.backgrounds.length} backgrounds`}
                                  </button>
                                ) : null}
                              </PickSection>
                              {customBackgroundActive ? (
                                <p className="pick-note">Custom background: pick its skills, tools, languages and gear in the Tools & Gear step.</p>
                              ) : null}
                            </PickLayout>
                          );
                        })()}
                      </div>
                    ) : null}
                  </motion.section>
                </AnimatePresence>
              </div>


            </section>
          ) : null}
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
                      fighterJourneyScene === "fighter-features" || fighterJourneyScene === "fighter-style" || fighterJourneyScene === "fighter-asi" || fighterJourneyScene === "fighter-class" || fighterJourneyScene === "fighter-eldritch" || fighterJourneyScene === "warlock-pact" || fighterJourneyScene === "warlock-invocations" || fighterJourneyScene === "fighter-equipment" || fighterJourneyScene === "warlock-spells"
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
                        <p>How you fight and what you do best. Pick one to see what it is about.</p>
                      </div>
                      <PickLayout
                        inspect={
                          <InspectPanel
                            icon={classIcon(currentClass.id)}
                            kicker="Class"
                            title={currentCuratedClass?.name ?? currentClass.name}
                            summary={classOverviewHighlights[0]?.body ?? null}
                            rows={[
                              { label: "Hit die", value: `d${currentClass.hitDie}` },
                              { label: "HP at 1st", value: currentCuratedClass?.hitPoints["Hit Points at 1st Level"] || `${currentClass.hitDie} + CON modifier` },
                              ...classOverviewHighlights.slice(1).map((item) => ({ label: item.title, value: item.body })),
                            ]}
                            fullText={currentCuratedClass?.summary ?? classDescription(currentClass)}
                          />
                        }
                      >
                        <PickGrid
                          label="Classes"
                          columns={4}
                          items={content.classes.map((item) => ({
                            id: item.id,
                            name: item.name,
                            sub: `d${item.hitDie}`,
                            icon: classIcon(item.id),
                            selected: draft.classId === item.id,
                          }))}
                          onPick={(classId) => {
                            if (classId === draft.classId) {
                              return;
                            }
                            updateDraft((current) => ({
                              ...current,
                              classId,
                              multiclassIds: current.multiclassIds.filter((entry) => entry !== classId),
                              selectedSubclassOptions: [],
                              spellIds: [],
                            }));
                            moveCreatorStep(1);
                            setCreatorBrowser("class");
                          }}
                        />
                        {currentCuratedClass?.spellcastingTable.rows.length ? (
                          <details className="pick-details">
                            <summary>{`${currentCuratedClass.name} level table`}</summary>
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
                                    <tr key={`${currentCuratedClass.id}-row-${rowIndex}`} className={rowIndex + 1 === draft.level ? "current-level" : undefined}>
                                      {row.map((cell, cellIndex) => (
                                        <td key={`${currentCuratedClass.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </details>
                        ) : null}
                      </PickLayout>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-features" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Class Features</h3>
                        <p>
                          {optionChoices.some((entry) => entry.sourceKind !== "feat" && (entry.choice.from.kind === "option" || entry.choice.from.kind === "language"))
                            ? `What a level ${draft.level} ${currentClass.name.toLowerCase()} can do. Click a feature to read it; make your picks below the list.`
                            : `What a level ${draft.level} ${currentClass.name.toLowerCase()} can do. Nothing to pick here; click a feature to read it.`}
                        </p>
                      </div>
                      {(() => {
                        const featureLevel = (feature: (typeof visibleClassFeatures)[number]) => {
                          const unlockState = classFeatureUnlockState.get(feature.id);
                          return typeof unlockState?.unlockLevel === "number"
                            ? unlockState.unlockLevel
                            : typeof feature.unlockLevel === "number"
                              ? feature.unlockLevel
                              : feature.milestones?.[0]?.level ?? 1;
                        };
                        const owned = visibleClassFeatures.filter((feature) => classFeatureUnlockState.get(feature.id)?.acquired ?? true);
                        const later = visibleClassFeatures.filter((feature) => !(classFeatureUnlockState.get(feature.id)?.acquired ?? true));
                        const focus = owned.find((feature) => feature.id === inspectId) ?? owned[0] ?? null;
                        const focusState = focus ? classFeatureUnlockState.get(focus.id) : null;
                        const laterByLevel = later.reduce<Map<number, string[]>>((map, feature) => {
                          const level = featureLevel(feature);
                          map.set(level, [...(map.get(level) ?? []), feature.name]);
                          return map;
                        }, new Map());
                        return (
                          <PickLayout
                            inspect={
                              focus ? (
                                <InspectPanel
                                  icon={featureIcon(focus.name)}
                                  kicker={`Level ${featureLevel(focus)}`}
                                  title={focus.name}
                                  summary={focus.short ?? focus.keyFacts?.[0] ?? null}
                                  rows={[
                                    ...(focusState?.currentSummary && focusState.currentSummary !== "Unlocked"
                                      ? [{ label: "Now", value: focusState.currentSummary.replace(/^Current:\s*/, "") }]
                                      : []),
                                    ...(focusState?.nextSummary ? [{ label: "Grows", value: focusState.nextSummary.replace(/^Next:\s*/, "") }] : []),
                                    ...(focus.keyFacts ?? []).slice(focus.short ? 0 : 1, 3).map((fact, index) => ({ label: index === 0 ? "Rules" : " ", value: fact })),
                                  ]}
                                >
                                  {focus.facts ? <FactChips facts={focus.facts} /> : null}
                                </InspectPanel>
                              ) : (
                                <InspectPanel icon={classIcon(currentClass.id)} title={currentClass.name} summary="No features yet at this level." />
                              )
                            }
                          >
                            <PickSection title="You have" meta={`level 1 to ${draft.level}`}>
                              <PickGrid
                                label="Unlocked features"
                                columns={4}
                                size="sm"
                                inspectedId={focus?.id ?? null}
                                onInspect={setInspectId}
                                items={owned.map((feature) => ({
                                  id: feature.id,
                                  name: feature.name.replace(/\s*\(Optional\)/, ""),
                                  sub: feature.name.includes("(Optional)") ? "Optional rule" : `Level ${featureLevel(feature)}`,
                                  icon: featureIcon(feature.name),
                                  owned: true,
                                }))}
                              />
                            </PickSection>
                            <OptionChoicePanel
                              content={content}
                              choices={optionChoices.filter((entry) => entry.sourceKind !== "feat" && (entry.choice.from.kind === "option" || entry.choice.from.kind === "language"))}
                              onToggle={toggleOptionChoice}
                            />
                            {laterByLevel.size ? (
                              <p className="pick-later">
                                <strong>Coming later: </strong>
                                {[...laterByLevel.entries()]
                                  .sort((left, right) => left[0] - right[0])
                                  .map(([level, names]) => `Level ${level}: ${names.join(", ")}`)
                                  .join(" · ")}
                              </p>
                            ) : null}
                          </PickLayout>
                        );
                      })()}
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

                  {fighterJourneyScene === "fighter-style" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Fighting Style</h3>
                        <p>{`A permanent combat edge. Pick the one that fits how your ${currentClass.name.toLowerCase()} fights.`}</p>
                      </div>
                      {(() => {
                        type StyleOption = (typeof classFightingStyleOptions)[number];
                        const shortOf = (option: StyleOption) =>
                          "shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : firstSentence(option.summary) ?? "";
                        const factsOf = (option: StyleOption) =>
                          "keyFacts" in option && Array.isArray(option.keyFacts) ? (option.keyFacts as string[]) : [];
                        const focus =
                          classFightingStyleOptions.find((option) => option.id === inspectId) ??
                          classFightingStyleOptions.find((option) => option.id === selectedClassFightingStyleId) ??
                          null;
                        const pickStyle = (id: string) => (currentClass.id === "ranger" ? setRangerFightingStyle(id) : chooseFighterStyleJourney(id));
                        const maneuverFocus =
                          fighterBattleMasterManeuverOptions.find((option) => option.id === inspectId) ?? null;
                        const inspectTarget = maneuverFocus ?? focus;
                        return (
                          <PickLayout
                            inspect={
                              inspectTarget ? (
                                <InspectPanel
                                  icon={maneuverFocus ? "stars-stack" : styleIcon(inspectTarget.name)}
                                  kicker={maneuverFocus ? "Maneuver" : "Fighting Style"}
                                  title={inspectTarget.name}
                                  summary={shortOf(inspectTarget as StyleOption)}
                                  rows={factsOf(inspectTarget as StyleOption).map((fact, index) => ({ label: index === 0 ? "Rules" : " ", value: fact }))}
                                  fullText={inspectTarget.summary}
                                  action={
                                    !maneuverFocus && focus && focus.id !== selectedClassFightingStyleId ? (
                                      <button type="button" className="sheet-button primary" onClick={() => pickStyle(focus.id)}>
                                        Choose this style
                                      </button>
                                    ) : null
                                  }
                                />
                              ) : (
                                <InspectPanel icon="crossed-swords" title="Fighting Style" summary="Click a style to read it. You can change it until the game starts." />
                              )
                            }
                          >
                            <PickSection title="Fighting Style" picked={selectedClassFightingStyleId ? 1 : 0} total={1}>
                              <PickGrid
                                label="Fighting styles"
                                columns={4}
                                size="sm"
                                inspectedId={inspectId}
                                onInspect={setInspectId}
                                items={classFightingStyleOptions.map((option) => ({
                                  id: option.id,
                                  name: option.name,
                                  sub: shortOf(option),
                                  icon: styleIcon(option.name),
                                  selected: selectedClassFightingStyleId === option.id,
                                }))}
                                onPick={(id) => pickStyle(selectedClassFightingStyleId === id ? "" : id)}
                              />
                            </PickSection>
                            {currentClass.id === "fighter" && selectedFighterFightingStyle?.id === "superior-technique" ? (
                              <PickSection title="Maneuver" meta="Superior Technique gives one Battle Master maneuver" picked={draft.fighterChoices?.superiorTechniqueManeuverId ? 1 : 0} total={1}>
                                <PickGrid
                                  label="Maneuvers"
                                  columns={4}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={fighterBattleMasterManeuverOptions.map((option) => ({
                                    id: option.id,
                                    name: option.name,
                                    sub: "shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : undefined,
                                    icon: "stars-stack",
                                    selected: draft.fighterChoices?.superiorTechniqueManeuverId === option.id,
                                  }))}
                                  onPick={(id) => setSuperiorTechniqueManeuver(id)}
                                />
                              </PickSection>
                            ) : null}
                          </PickLayout>
                        );
                      })()}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-asi" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Ability Score Improvements</h3>
                        <p>At these levels you raise your abilities or take a feat instead. Scores can&apos;t go above 20.</p>
                      </div>
                      {unlockedFighterAsiLevels.length ? (
                        <div className="option-choice-stack">{unlockedFighterAsiLevels.map((level) => renderAsiLevelCard(level))}</div>
                      ) : (
                        <p className="pick-note">Your first Ability Score Improvement comes at level 4.</p>
                      )}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-subclass" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>{visibleSubclassHeading}</h3>
                        <p>{`Pick your ${visibleSubclassHeading.toLowerCase()} first. Its choices open right below it.`}</p>
                      </div>
                      {(() => {
                        const focus =
                          fighterJourneySubclasses.find((entry) => entry.id === inspectId) ?? selectedJourneySubclass ?? fighterJourneySubclasses[0] ?? null;
                        const subclassChoices = optionChoices.filter((entry) => entry.sourceKind !== "feat" && (entry.choice.from.kind === "weapon" || entry.choice.from.kind === "tool"));
                        return (
                          <PickLayout
                            inspect={
                              focus ? (
                                <InspectPanel
                                  icon={featureIcon(focus.name)}
                                  kicker={focus.source || visibleSubclassHeading}
                                  title={focus.name}
                                  summary={(focus.summary ?? "").split(/(?<=\.)\s/)[0] || null}
                                  rows={(focus.features ?? []).map((feature) => {
                                    const unlockState = subclassFeatureUnlockState.get(feature.id);
                                    const level = unlockState?.unlockLevel ?? feature.unlockLevel ?? null;
                                    const owned = focus.id === selectedJourneySubclass?.id && (unlockState?.acquired ?? true);
                                    return {
                                      label: level ? `Level ${level}` : "Feature",
                                      value: `${feature.name}${owned ? " ✓" : ""}${feature.short ? `: ${feature.short}` : ""}`,
                                    };
                                  })}
                                  fullText={focus.summary}
                                />
                              ) : (
                                <InspectPanel icon={classIcon(currentClass.id)} title={visibleSubclassHeading} summary="No options are enabled for this class yet." />
                              )
                            }
                          >
                            <PickSection
                              title={visibleSubclassHeading}
                              picked={draft.selectedSubclassOptions.length ? 1 : 0}
                              total={1}
                            >
                              <PickGrid
                                label={visibleSubclassHeading}
                                columns={3}
                                inspectedId={inspectId}
                                onInspect={setInspectId}
                                items={fighterJourneySubclasses.map((entry) => ({
                                  id: entry.id,
                                  name: entry.name,
                                  sub: entry.source,
                                  icon: featureIcon(entry.name),
                                  selected: draft.selectedSubclassOptions.includes(entry.id),
                                }))}
                                onPick={(subclassId) => {
                                  if (!draft.selectedSubclassOptions.includes(subclassId)) {
                                    chooseFighterSubclassJourney(subclassId);
                                  }
                                }}
                              />
                            </PickSection>
                            {selectedJourneySubclass && subclassChoices.length ? (
                              <OptionChoicePanel content={content} choices={subclassChoices} onToggle={toggleOptionChoice} />
                            ) : null}
                          </PickLayout>
                        );
                      })()}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-equipment" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <span className="mini-heading creator-section-label">Equipment</span>
                        <h3>Starting Equipment</h3>
                        <p>{`Choose the ${currentClass.name.toLowerCase()} kit you start with. Items land in the sheet's Inventory, where you can equip, add or remove them.`}</p>
                      </div>
                      <div className="fighter-journey-scene-divider" aria-hidden="true" />
                      <article className="fighter-equipment-section">
                        <div className="equipment-choice-stack">
                          {classStartingEquipment.length ? classStartingEquipment.map((group) => renderEquipmentChoiceGroup(group, "journey-gear")) : (
                            <div className="list-row">
                              <strong>No class equipment choices</strong>
                              <span>This class does not have curated starting equipment yet.</span>
                            </div>
                          )}
                        </div>
                      </article>
                    </div>
                  ) : null}

                  {fighterJourneyScene === "warlock-invocations" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Eldritch Invocations</h3>
                        <p>Secrets your patron teaches you. Locked ones need a higher level, a Pact Boon or a spell, and say which.</p>
                      </div>
                      {draft.level < 2 ? (
                        <p className="pick-note">Eldritch Invocations open at warlock level 2.</p>
                      ) : (
                        (() => {
                          const cards = visibleInvocationCards.map((option) => {
                            const parsed = parseWarlockInvocationSummary(option);
                            const unlocked = warlockInvocationMeetsPrerequisite(parsed.requirement, {
                              level: draft.level,
                              pactBoonId: draft.pactBoonId,
                              spellIds: draft.spellIds,
                            });
                            return { option, parsed, unlocked, selected: draft.selectedInvocationIds.includes(option.id) };
                          });
                          const focus = cards.find((card) => card.option.id === inspectId) ?? cards.find((card) => card.selected) ?? null;
                          return (
                            <PickLayout
                              inspect={
                                focus ? (
                                  <InspectPanel
                                    icon={featureIcon(focus.option.name)}
                                    kicker="Invocation"
                                    title={focus.option.name}
                                    summary={firstSentence(focus.parsed.description)}
                                    warning={!focus.unlocked && !focus.selected ? `Needs ${focus.parsed.prerequisite ?? "a prerequisite"}` : null}
                                    rows={[
                                      { label: "Needs", value: focus.parsed.prerequisite || "Nothing" },
                                      ...(focus.parsed.source ? [{ label: "Source", value: focus.parsed.source }] : []),
                                    ]}
                                    fullText={focus.parsed.description}
                                    action={
                                      focus.unlocked || focus.selected ? (
                                        <button
                                          type="button"
                                          className={focus.selected ? "sheet-button secondary" : "sheet-button primary"}
                                          onClick={() => toggleInvocationSelection(focus.option.id)}
                                        >
                                          {focus.selected ? "Remove" : "Learn"}
                                        </button>
                                      ) : null
                                    }
                                  />
                                ) : (
                                  <InspectPanel icon="evil-eyes" title="Eldritch Invocations" summary="Click an invocation to read it. Click again to learn it." />
                                )
                              }
                            >
                              <PickSection
                                title="Invocations"
                                meta={`${visibleSelectedInvocationCount} / ${warlockInvocationLimit || 0} known`}
                                picked={visibleSelectedInvocationCount}
                                total={warlockInvocationLimit || 0}
                                actions={
                                  <button type="button" className={showUnavailableOptions ? "pick-filter active" : "pick-filter"} onClick={() => setShowUnavailableOptions((current) => !current)}>
                                    {showUnavailableOptions ? "Hide locked" : "Show locked"}
                                  </button>
                                }
                              >
                                {cards.length ? (
                                  <PickGrid
                                    label="Invocations"
                                  pageSize={16}
                                  key={`inv-${showUnavailableOptions}`}
                                    columns={4}
                                    size="sm"
                                    inspectedId={focus?.option.id ?? null}
                                    onInspect={setInspectId}
                                    items={cards.map((card) => ({
                                      id: card.option.id,
                                      name: card.option.name,
                                      sub: card.parsed.prerequisite ? card.parsed.prerequisite : "No prerequisite",
                                      icon: featureIcon(card.option.name),
                                      selected: card.selected,
                                      locked: !card.unlocked && !card.selected,
                                      lockReason: !card.unlocked ? card.parsed.prerequisite ?? undefined : undefined,
                                    }))}
                                    onPick={(id) => toggleInvocationSelection(id)}
                                  />
                                ) : (
                                  <p className="pick-note">Nothing unlocked yet at your level, Pact Boon and spells.</p>
                                )}
                              </PickSection>
                              <OptionChoicePanel content={content} choices={optionChoices.filter((entry) => entry.sourceKind !== "feat" && entry.choice.from.kind === "spell")} onToggle={toggleOptionChoice} />
                            </PickLayout>
                          );
                        })()
                      )}
                    </div>
                  ) : null}
                  {fighterJourneyScene === "warlock-pact" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Pact Boon</h3>
                        <p>Your patron&apos;s gift at level 3. It also decides which pact invocations you can learn later.</p>
                      </div>
                      {draft.level < 3 ? (
                        <p className="pick-note">Pact Boon opens at warlock level 3.</p>
                      ) : (
                        (() => {
                          type PactOption = (typeof warlockPactBoonOptions)[number];
                          const shortOf = (option: PactOption) =>
                            "shortLabel" in option && typeof option.shortLabel === "string" ? option.shortLabel : firstSentence(option.summary) ?? "";
                          const factsOf = (option: PactOption) =>
                            "keyFacts" in option && Array.isArray(option.keyFacts) ? (option.keyFacts as string[]) : [];
                          const cantripFocus = pactTomeCantripPool.find((spell) => spell.id === inspectId) ?? null;
                          const focus = warlockPactBoonOptions.find((option) => option.id === inspectId) ?? selectedPactBoon ?? null;
                          const tomeCount = draft.selectedPactCantripIds.length;
                          return (
                            <PickLayout
                              inspect={
                                cantripFocus ? (
                                  <InspectPanel
                                    icon={schoolIcon(cantripFocus.school)}
                                    kicker={`Cantrip · ${cantripFocus.school}`}
                                    title={cantripFocus.name}
                                    summary={firstSentence(cantripFocus.summary)}
                                    rows={spellMetaLines(cantripFocus)
                                      .filter((line) => !line.startsWith("Source"))
                                      .map((line) => ({ label: line.split(":")[0].replace("Casting Time", "Cast"), value: line.split(":").slice(1).join(":").trim() }))}
                                    fullText={cantripFocus.summary}
                                  />
                                ) : focus ? (
                                  <InspectPanel
                                    icon={pactIcon(focus.name)}
                                    kicker="Pact Boon"
                                    title={focus.name}
                                    summary={shortOf(focus)}
                                    rows={factsOf(focus).map((fact, index) => ({ label: index === 0 ? "Rules" : " ", value: fact }))}
                                    fullText={focus.summary}
                                    action={
                                      focus.id !== draft.pactBoonId ? (
                                        <button type="button" className="sheet-button primary" onClick={() => setPactBoon(focus.id)}>
                                          Choose this pact
                                        </button>
                                      ) : null
                                    }
                                  />
                                ) : (
                                  <InspectPanel icon="evil-eyes" title="Pact Boon" summary="Click a pact to read it." />
                                )
                              }
                            >
                              <PickSection title="Pact Boon" picked={draft.pactBoonId ? 1 : 0} total={1}>
                                <PickGrid
                                  label="Pact boons"
                                  columns={4}
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={warlockPactBoonOptions.map((option) => ({
                                    id: option.id,
                                    name: option.name,
                                    sub: shortOf(option),
                                    icon: pactIcon(option.name),
                                    selected: draft.pactBoonId === option.id,
                                  }))}
                                  onPick={(id) => setPactBoon(id)}
                                />
                              </PickSection>
                              {draft.pactBoonId === "pact-of-the-tome" ? (
                                <PickSection title="Book of Shadows cantrips" meta="three cantrips from any class" picked={tomeCount} total={3}>
                                  <PickGrid
                                    label="Book of Shadows cantrips"
                                  pageSize={15}
                                    columns={5}
                                    size="sm"
                                    inspectedId={inspectId}
                                    onInspect={setInspectId}
                                    items={pactTomeCantripPool.map((spell) => ({
                                      id: spell.id,
                                      name: spell.name,
                                      sub: spell.school,
                                      icon: schoolIcon(spell.school),
                                      selected: draft.selectedPactCantripIds.includes(spell.id),
                                      dim: !draft.selectedPactCantripIds.includes(spell.id) && tomeCount >= 3,
                                    }))}
                                    onPick={(id) => {
                                      if (draft.selectedPactCantripIds.includes(id) || tomeCount < 3) {
                                        togglePactCantripSelection(id);
                                      }
                                    }}
                                  />
                                </PickSection>
                              ) : null}
                            </PickLayout>
                          );
                        })()
                      )}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "warlock-spells" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Spells</h3>
                        <p>
                          {currentCuratedClass?.spellPreparation
                            ? `Choose the ${currentClass.name.toLowerCase()} spells you have prepared today (${currentCuratedClass.spellPreparation.divisor > 1 ? "half your level" : "your level"} + ${currentCuratedClass.spellPreparation.ability}). You can change them after a long rest. Locked ones say why.`
                            : `Pick the ${currentClass.name.toLowerCase()} spells you know. Locked ones say why. Click any spell to read it.`}
                        </p>
                      </div>
                      {(() => {
                        type SpellRow = ContentBundle["spells"][number];
                        const spellLabel = (spell: SpellRow) => (spell.level === 0 ? `Cantrip · ${spell.school}` : `Level ${spell.level} · ${spell.school}`);
                        const granted: Array<{ id: string; name: string; sub: string; school: string; spell: SpellRow | null; note: string }> = [
                          ...(currentClass.id === "ranger" && currentVisibleSubclass
                            ? rangerSubclassMagicEntries.map((entry) => ({
                                id: `granted-sub-${entry.name}`,
                                name: entry.name,
                                sub: `From ${currentVisibleSubclass.name}`,
                                school: entry.spell?.school ?? "",
                                spell: entry.spell ?? null,
                                note: `Always known from ${currentVisibleSubclass.name} (ranger ${entry.unlockLevel}). Doesn't count against spells known.`,
                              }))
                            : []),
                          ...(currentClass.id === "ranger"
                            ? rangerPrimalAwarenessEntries.map((entry) => ({
                                id: `granted-primal-${entry.name}`,
                                name: entry.name,
                                sub: rangerPrimalAwarenessLabel,
                                school: entry.spell?.school ?? "",
                                spell: entry.spell ?? null,
                                note: `Granted by ${rangerPrimalAwarenessLabel} (ranger ${entry.unlockLevel}). Doesn't count against spells known.`,
                              }))
                            : []),
                          ...(currentClass.id === "warlock" && currentVisibleSubclass
                            ? subclassSpellEntries.map((entry) => ({
                                id: `granted-patron-${entry.name}`,
                                name: entry.name,
                                sub: "On your list",
                                school: entry.spell?.school ?? "",
                                spell: entry.spell ?? null,
                                note: `${currentVisibleSubclass.name} adds this to your warlock list. Learn it from the grid below.`,
                              }))
                            : []),
                          // Diger class'larin subclass buyuleri (Paladin oath, Cleric domain vb.): her zaman hazir.
                          ...(currentClass.id !== "warlock" && currentClass.id !== "ranger" && currentVisibleSubclass
                            ? currentVisibleSubclass.expandedSpells
                                .filter((entry) => draft.level >= entry.unlockLevel)
                                .flatMap((entry) =>
                                  entry.spells.map((spellName) => {
                                    const spell = content.spells.find((row) => row.name.toLowerCase() === spellName.toLowerCase()) ?? null;
                                    return {
                                      id: `granted-subclass-${spellName}`,
                                      name: spellName,
                                      sub: `From ${currentVisibleSubclass.name}`,
                                      school: spell?.school ?? "",
                                      spell,
                                      note: `Always prepared from ${currentVisibleSubclass.name} (${currentClass.name.toLowerCase()} ${entry.unlockLevel}). Doesn't count against your prepared spells.`,
                                    };
                                  }),
                                )
                            : []),
                          ...(currentClass.id === "warlock" && draft.pactBoonId === "pact-of-the-tome"
                            ? selectedPactCantripSpells.map((spell) => ({
                                id: `granted-tome-${spell.id}`,
                                name: spell.name,
                                sub: "Book of Shadows",
                                school: spell.school,
                                spell,
                                note: "Cantrip from your Pact of the Tome Book of Shadows.",
                              }))
                            : []),
                        ];
                        const grantedFocus = granted.find((entry) => entry.id === inspectId) ?? null;
                        const allSpells = [...content.spells];
                        const focusSpell: SpellRow | null = grantedFocus
                          ? grantedFocus.spell
                          : allSpells.find((spell) => spell.id === inspectId) ??
                            activeSpellPool.find((spell) => draft.spellIds.includes(spell.id)) ??
                            null;
                        const focusReason = focusSpell && !grantedFocus ? classSpellUnavailableReason(focusSpell) : null;
                        const focusKnown = Boolean(focusSpell && draft.spellIds.includes(focusSpell.id));
                        const counterMeta = [
                          classCantripLimit ? `Cantrips ${classSelectedCantrips.length}/${classCantripLimit}` : null,
                          classKnownSpellLimit ? `Spells ${classSelectedLeveledSpells.length}/${classKnownSpellLimit}` : null,
                          spellSelectionRules.maxSpellLevel ? `up to level ${spellSelectionRules.maxSpellLevel}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        const leftToPick =
                          Math.max(0, (classCantripLimit || 0) - classSelectedCantrips.length) +
                          Math.max(0, (classKnownSpellLimit || 0) - classSelectedLeveledSpells.length);
                        return (
                          <PickLayout
                            inspect={
                              focusSpell ? (
                                <InspectPanel
                                  icon={schoolIcon(focusSpell.school)}
                                  kicker={spellLabel(focusSpell)}
                                  title={focusSpell.name}
                                  summary={firstSentence(focusSpell.summary)}
                                  warning={grantedFocus ? null : focusReason}
                                  rows={spellMetaLines(focusSpell)
                                    .filter((line) => !line.startsWith("Source"))
                                    .map((line) => ({ label: line.split(":")[0].replace("Casting Time", "Cast"), value: line.split(":").slice(1).join(":").trim() }))}
                                  fullText={focusSpell.summary}
                                  action={
                                    grantedFocus ? (
                                      <span className="pick-note">{grantedFocus.note}</span>
                                    ) : !focusReason || focusKnown ? (
                                      <button
                                        type="button"
                                        className={focusKnown ? "sheet-button secondary" : "sheet-button primary"}
                                        onClick={() => toggleSelection("spellIds", focusSpell.id)}
                                      >
                                        {focusKnown ? "Forget" : "Learn"}
                                      </button>
                                    ) : null
                                  }
                                />
                              ) : (
                                <InspectPanel
                                  icon="spell-book"
                                  kicker="Spells"
                                  title={`${currentClass.name} spells`}
                                  summary="Click a spell to read it. Click again to learn or forget it."
                                  rows={counterMeta ? [{ label: "Known", value: counterMeta }] : []}
                                />
                              )
                            }
                          >
                            {granted.length ? (
                              <PickSection title="Granted" meta="always yours, no pick needed">
                                <PickGrid
                                  label="Granted spells"
                                  columns={5}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={granted.map((entry) => ({ id: entry.id, name: entry.name, sub: entry.sub, icon: schoolIcon(entry.school), owned: true }))}
                                />
                              </PickSection>
                            ) : null}
                            {currentStructuredSublineage?.id === "high-elf" ? (
                              <PickSection title="High Elf cantrip" meta="one wizard cantrip, uses INT" picked={selectedHighElfCantripId ? 1 : 0} total={1}>
                                <PickGrid
                                  label="High Elf cantrip"
                                  pageSize={15}
                                  columns={5}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={highElfCantripPool.map((spell) => ({
                                    id: spell.id,
                                    name: spell.name,
                                    sub: spell.school,
                                    icon: schoolIcon(spell.school),
                                    selected: spell.id === selectedHighElfCantripId,
                                  }))}
                                  onPick={(spellId) => setHighElfCantripChoice(spellId)}
                                />
                              </PickSection>
                            ) : null}
                            {currentClass.id !== "warlock" ? (
                              <OptionChoicePanel content={content} choices={optionChoices.filter((entry) => entry.sourceKind !== "feat" && entry.choice.from.kind === "spell")} onToggle={toggleOptionChoice} />
                            ) : null}
                            <PickSection
                              title={`${currentClass.name} spells`}
                              meta={counterMeta}
                              picked={leftToPick ? 0 : 1}
                              total={leftToPick ? leftToPick : 1}
                              actions={
                                <input
                                  type="search"
                                  className="pick-search"
                                  value={spellSearchQuery}
                                  onChange={(event) => setSpellSearchQuery(event.target.value)}
                                  placeholder="Search spells"
                                  aria-label="Search spells"
                                />
                              }
                            >
                              {spellLevelPages.length ? (
                                <div className="pick-filters" role="group" aria-label="Spell level">
                                  <button type="button" className={activeSpellFilter === "all" ? "pick-filter active" : "pick-filter"} onClick={() => setActiveSpellFilter("all")}>
                                    All
                                  </button>
                                  {spellLevelPages.map((level) => (
                                    <button
                                      type="button"
                                      key={`spell-level-filter-${level}`}
                                      className={activeSpellFilter === level ? "pick-filter active" : "pick-filter"}
                                      onClick={() => setActiveSpellFilter(level)}
                                    >
                                      {level === 0 ? "Cantrips" : `Level ${level}`}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className={showUnavailableOptions ? "pick-filter active" : "pick-filter"}
                                    onClick={() => setShowUnavailableOptions((value) => !value)}
                                  >
                                    {showUnavailableOptions ? "Hide locked" : "Show locked"}
                                  </button>
                                </div>
                              ) : null}
                              {activeSpellPool.length ? (
                                <PickGrid
                                  label="Spell list"
                                  pageSize={16}
                                  key={`spells-${activeSpellFilter}-${spellSearchQuery}-${showUnavailableOptions}`}
                                  columns={4}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={activeSpellPool.map((spell) => {
                                    const reason = classSpellUnavailableReason(spell);
                                    const known = draft.spellIds.includes(spell.id);
                                    return {
                                      id: spell.id,
                                      name: spell.name,
                                      sub: spellLabel(spell),
                                      icon: schoolIcon(spell.school),
                                      selected: known,
                                      locked: Boolean(reason) && !known,
                                      lockReason: reason ?? undefined,
                                    };
                                  })}
                                  onPick={(spellId) => toggleSelection("spellIds", spellId)}
                                />
                              ) : (
                                <p className="pick-note">No spells match this filter or search.</p>
                              )}
                            </PickSection>
                            {currentClass.id === "warlock" && mysticArcanumOptions.length ? (
                              <PickSection title="Mystic Arcanum" meta="one spell per level, once per long rest">
                                {mysticArcanumOptions.map((entry) => (
                                  <PickSection
                                    key={`arcanum-${entry.spellLevel}`}
                                    title={`Level ${entry.spellLevel}`}
                                    meta={`warlock ${entry.unlockLevel}`}
                                    picked={entry.selectedSpellId ? 1 : 0}
                                    total={1}
                                  >
                                    <PickGrid
                                      label={`Mystic Arcanum level ${entry.spellLevel}`}
                                  pageSize={15}
                                      columns={5}
                                      size="sm"
                                      inspectedId={inspectId}
                                      onInspect={setInspectId}
                                      items={entry.spells.map((spell) => ({
                                        id: spell.id,
                                        name: spell.name,
                                        sub: spell.school,
                                        icon: schoolIcon(spell.school),
                                        selected: entry.selectedSpellId === spell.id,
                                      }))}
                                      onPick={(spellId) => setMysticArcanumSpell(entry.spellLevel, spellId)}
                                    />
                                  </PickSection>
                                ))}
                              </PickSection>
                            ) : null}
                          </PickLayout>
                        );
                      })()}
                    </div>
                  ) : null}

                  {fighterJourneyScene === "fighter-eldritch" ? (
                    <div className="fighter-journey-scene">
                      <div className="fighter-journey-scene-head compact">
                        <h3>Eldritch Knight spells</h3>
                        <p>{`Wizard spells, mostly ${eldritchKnightSchoolFocusLabel.toLowerCase()}. You also get ${eldritchKnightFlexibleSchoolAllowance} pick${eldritchKnightFlexibleSchoolAllowance === 1 ? "" : "s"} from any school.`}</p>
                      </div>
                      {fighterJourneySubclassId !== "eldritch-knight" ? (
                        <p className="pick-note">Choose the Eldritch Knight archetype first to unlock spellcasting.</p>
                      ) : (
                        (() => {
                          const focus =
                            fighterJourneyFilteredSpellPool.find((spell) => spell.id === inspectId) ??
                            fighterJourneySpellPool.find((spell) => spell.id === inspectId) ??
                            fighterJourneyFilteredSpellPool.find((spell) => draft.spellIds.includes(spell.id)) ??
                            null;
                          const focusReason = focus ? eldritchKnightSpellUnavailableReason(focus) : null;
                          const focusKnown = Boolean(focus && draft.spellIds.includes(focus.id));
                          const meta = `Cantrips ${eldritchKnightCantripSelections.length}/${eldritchKnightCantripLimit} · Spells ${eldritchKnightLeveledSelections.length}/${eldritchKnightSpellsKnownLimit} · Any school ${eldritchKnightOffSchoolSelections.length}/${eldritchKnightFlexibleSchoolAllowance}`;
                          const left =
                            Math.max(0, eldritchKnightCantripLimit - eldritchKnightCantripSelections.length) +
                            Math.max(0, eldritchKnightSpellsKnownLimit - eldritchKnightLeveledSelections.length);
                          return (
                            <PickLayout
                              inspect={
                                focus ? (
                                  <InspectPanel
                                    icon={schoolIcon(focus.school)}
                                    kicker={focus.level === 0 ? `Cantrip · ${focus.school}` : `Level ${focus.level} · ${focus.school}`}
                                    title={focus.name}
                                    summary={firstSentence(focus.summary)}
                                    warning={focusKnown ? null : focusReason}
                                    rows={spellMetaLines(focus)
                                      .filter((line) => !line.startsWith("Source"))
                                      .map((line) => ({ label: line.split(":")[0].replace("Casting Time", "Cast"), value: line.split(":").slice(1).join(":").trim() }))}
                                    fullText={focus.summary}
                                    action={
                                      !focusReason || focusKnown ? (
                                        <button
                                          type="button"
                                          className={focusKnown ? "sheet-button secondary" : "sheet-button primary"}
                                          onClick={() => toggleSelection("spellIds", focus.id)}
                                        >
                                          {focusKnown ? "Forget" : "Learn"}
                                        </button>
                                      ) : null
                                    }
                                  />
                                ) : (
                                  <InspectPanel icon="spell-book" kicker="Spells" title="Eldritch Knight" summary="Click a spell to read it. Click again to learn or forget it." rows={[{ label: "Known", value: meta }]} />
                                )
                              }
                            >
                              <PickSection title="Wizard spells" meta={meta} picked={left ? 0 : 1} total={left || 1}>
                                <div className="pick-filters" role="group" aria-label="Spell level">
                                  <button type="button" className={fighterSpellLevelFilter === "all" ? "pick-filter active" : "pick-filter"} onClick={() => setFighterSpellLevelFilter("all")}>
                                    All
                                  </button>
                                  <button type="button" className={fighterSpellLevelFilter === "cantrip" ? "pick-filter active" : "pick-filter"} onClick={() => setFighterSpellLevelFilter("cantrip")}>
                                    Cantrips
                                  </button>
                                  {fighterJourneySpellLevelOptions.filter((level) => level > 0).map((level) => (
                                    <button
                                      key={`ek-level-filter-${level}`}
                                      type="button"
                                      className={fighterSpellLevelFilter === level ? "pick-filter active" : "pick-filter"}
                                      onClick={() => setFighterSpellLevelFilter(level)}
                                    >
                                      {`Level ${level}`}
                                    </button>
                                  ))}
                                </div>
                                <PickGrid
                                  label="Eldritch Knight spells"
                                  pageSize={16}
                                  key={`ek-${fighterSpellLevelFilter}`}
                                  columns={4}
                                  size="sm"
                                  inspectedId={inspectId}
                                  onInspect={setInspectId}
                                  items={fighterJourneyFilteredSpellPool.map((spell) => {
                                    const reason = eldritchKnightSpellUnavailableReason(spell);
                                    const known = draft.spellIds.includes(spell.id);
                                    return {
                                      id: spell.id,
                                      name: spell.name,
                                      sub: spell.level === 0 ? `Cantrip · ${spell.school}` : `Level ${spell.level} · ${spell.school}`,
                                      icon: schoolIcon(spell.school),
                                      selected: known,
                                      locked: Boolean(reason) && !known,
                                      lockReason: reason ?? undefined,
                                    };
                                  })}
                                  onPick={(spellId) => toggleSelection("spellIds", spellId)}
                                />
                              </PickSection>
                            </PickLayout>
                          );
                        })()
                      )}
                    </div>
                  ) : null}
                </motion.section>
              </AnimatePresence>
            </div>
          ) : null}

          {!originCarouselActive && !fighterJourneyActive && creatorStep === 0 && creatorBrowser === "identity" ? (
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

          {!originCarouselActive && creatorStep === 0 && creatorBrowser === "lineage" ? (
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

          {!originCarouselActive && creatorStep === 0 && creatorBrowser === "subrace" ? (
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
                          Standard Human keeps the base Human traits and skips Variant Human&apos;s optional skill and feat package.
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

          {!originCarouselActive && creatorStep === 0 && creatorBrowser === "lineage-choices" ? (
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

          {!fighterJourneyActive && (creatorStep === 1 || (!originCarouselActive && creatorStep === 0 && creatorBrowser === "background") || (creatorStep === 2 && (creatorBrowser === "skills" || creatorBrowser === "fighter-asi" || creatorBrowser === "feats")) || (creatorStep === 3 && (creatorBrowser === "custom-background-tools" || creatorBrowser === "custom-background-languages" || creatorBrowser === "custom-background-equipment"))) ? (
            <div className="creator-stack">
                <div
                  className={
                    creatorBrowser === "class" || creatorBrowser === "class-features" || creatorBrowser === "subclass-features" || creatorBrowser === "ranger-choices" || creatorBrowser === "fighter-fighting-style" || creatorBrowser === "fighter-asi" || creatorBrowser === "background" || creatorBrowser === "custom-background-tools" || creatorBrowser === "custom-background-languages" || creatorBrowser === "custom-background-equipment" || creatorBrowser === "skill-spells" || creatorBrowser === "skills" || creatorBrowser === "feats" || creatorBrowser === "spells"
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
                              <strong>Nature&apos;s Veil</strong>
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
                                <strong>Ranger&apos;s Companion</strong>
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
                    {currentClass.id !== "fighter" && currentClass.id !== "ranger" ? (
                      <div className="list-row">
                        <strong>No fighting style panel</strong>
                        <span>This submenu only appears for classes with Fighting Style choices.</span>
                      </div>
                    ) : (
                      <article className="creator-panel identity-detail-panel creator-subpanel-flat class-overview-panel ranger-choice-shell">
                        <div className="identity-detail-head">
                          <span className="mini-heading creator-section-label class-section-label">Class Feature Choices</span>
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
                  <div className="fighter-journey-scene">
                    <div className="fighter-journey-scene-head compact">
                      <h3>Ability Score Improvements</h3>
                      <p>At these levels you raise your abilities or take a feat instead. Scores can&apos;t go above 20.</p>
                    </div>
                    {unlockedFighterAsiLevels.length ? (
                      <div className="option-choice-stack">{unlockedFighterAsiLevels.map((level) => renderAsiLevelCard(level))}</div>
                    ) : (
                      <p className="pick-note">Your first Ability Score Improvement comes at level 4.</p>
                    )}
                  </div>
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
                    {customBackgroundActive ? (
                      <div className="equipment-picker-card background-custom-feature-card">
                        <strong>Background feature source</strong>
                        <select
                          className="equipment-picker-select"
                          value={draft.customBackground?.featureBackgroundId ?? selectedCustomFeatureBackground?.id ?? ""}
                          onChange={(event) => updateCustomBackgroundFeature(event.target.value)}
                        >
                          {customBackgroundFeatureOptions.map((background) => (
                            <option key={`custom-feature-${background.id}`} value={background.id}>
                              {background.name}
                            </option>
                          ))}
                        </select>
                        {selectedCustomFeatureBackground ? (
                          <span>{backgroundDescription(selectedCustomFeatureBackground)}</span>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </section>
                ) : null}

                {creatorBrowser === "custom-background-tools" || creatorBrowser === "custom-background-languages" ? (
                <section className="creator-section-block">
                  {(() => {
                    const isTools = creatorBrowser === "custom-background-tools";
                    const kind = isTools ? "Tool" : "Language";
                    const customOptions = customBackgroundProficiencyChoices.filter((option) => option.kind === kind);
                    const pickedCustom = draft.customBackground?.proficiencyIds ?? [];
                    const infoForOption = (optionId: string) => {
                      const [, id] = optionId.split(":");
                      const tool = content.tools.find((entry) => entry.id === id);
                      const language = content.languages.find((entry) => entry.id === id);
                      return isTools ? (tool ? findGearInfo(content, tool.name) : null) : language ? findGearInfo(content, language.name) : null;
                    };
                    const grantedNames = selectedBackground
                      ? isTools
                        ? backgroundToolSummary(content, selectedBackground)
                        : backgroundLanguageSummary(content, selectedBackground)
                      : [];
                    const grantedInfos = gearInfosFor(content, "", grantedNames);
                    const focusInfo =
                      (inspectId ? infoForOption(inspectId) ?? findGearInfo(content, inspectId) : null) ??
                      (pickedCustom.find((id) => id.startsWith(isTools ? "tool:" : "language:")) ? infoForOption(pickedCustom.find((id) => id.startsWith(isTools ? "tool:" : "language:")) as string) : null) ??
                      grantedInfos[0] ??
                      null;
                    return (
                      <>
                        <div className="fighter-journey-scene-head compact">
                          <h3>{isTools ? "Tools" : "Languages"}</h3>
                          <p>
                            {isTools
                              ? "Tools let you add your proficiency bonus when you use them. Click one to see what it is good for."
                              : "Languages you can speak, read and write. Click one to see who speaks it."}
                          </p>
                        </div>
                        <PickLayout
                          inspect={
                            focusInfo ? (
                              <InspectPanel icon={focusInfo.icon} kicker={focusInfo.kicker} title={focusInfo.name} summary={focusInfo.summary} rows={focusInfo.rows} />
                            ) : (
                              <InspectPanel icon={isTools ? "toolbox" : "talk"} title={isTools ? "Tools" : "Languages"} summary="Click one to read about it." />
                            )
                          }
                        >
                          {customBackgroundActive ? (
                            <PickSection
                              title={`Custom background ${isTools ? "tools" : "languages"}`}
                              meta="any mix of two tools or languages"
                              picked={pickedCustom.length}
                              total={2}
                            >
                              <PickGrid
                                label={isTools ? "Tools" : "Languages"}
                                columns={4}
                                size="sm"
                                inspectedId={inspectId}
                                onInspect={setInspectId}
                                items={customOptions.map((option) => {
                                  const info = infoForOption(option.id);
                                  const selected = pickedCustom.includes(option.id);
                                  return {
                                    id: option.id,
                                    name: option.label,
                                    sub: info?.sub,
                                    icon: info?.icon ?? (isTools ? "toolbox" : "talk"),
                                    selected,
                                    dim: !selected && pickedCustom.length >= 2,
                                  };
                                })}
                                onPick={(id) => {
                                  if (pickedCustom.includes(id) || pickedCustom.length < 2) {
                                    toggleCustomBackgroundProficiency(id);
                                  }
                                }}
                              />
                            </PickSection>
                          ) : (
                            <PickSection title={`From ${selectedBackground?.name ?? "your background"}`}>
                              {grantedInfos.length ? (
                                <PickGrid
                                  label={`Background ${isTools ? "tools" : "languages"}`}
                                  columns={4}
                                  size="sm"
                                  inspectedId={focusInfo?.name ?? null}
                                  onInspect={setInspectId}
                                  items={grantedInfos.map((info) => ({ id: info.name, name: info.name, sub: info.sub, icon: info.icon, owned: true }))}
                                />
                              ) : (
                                <p className="pick-note">{grantedNames.length ? grantedNames.join(", ") : `Your background gives no ${isTools ? "tools" : "languages"}.`}</p>
                              )}
                              {isTools && hasSelectedBackgroundToolData && selectedBackground?.toolProficiencies.choices.length ? (
                                <div className="fighter-feature-grid compact fighter-equipment-source-grid">{renderBackgroundToolCards("background-tool-gear-section")}</div>
                              ) : null}
                            </PickSection>
                          )}
                          {!isTools ? (
                            <LanguageChoicePanel choices={languageChoices} onToggle={toggleLanguageChoice} content={content} onInspect={setInspectId} inspectedId={inspectId} knownLanguages={previewDraft.proficiencies.languages} />
                          ) : null}
                        </PickLayout>
                      </>
                    );
                  })()}
                </section>
                ) : null}

                {creatorBrowser === "custom-background-equipment" ? (
                <section className="creator-section-block">
                  <div className="fighter-journey-scene">
                    <div className="fighter-journey-scene-head compact">
                      <h3>Equipment</h3>
                      <p>{`Choose the ${currentClass.name.toLowerCase()} kit you start with.`}</p>
                    </div>
                    <div className="fighter-journey-scene-divider" aria-hidden="true" />
                    <article className="fighter-equipment-section">
                      <div className="equipment-choice-stack">
                        {classStartingEquipment.length ? classStartingEquipment.map((group) => renderEquipmentChoiceGroup(group, "gear")) : (
                          <div className="list-row">
                            <strong>No class equipment choices</strong>
                            <span>This class does not have curated starting equipment yet.</span>
                          </div>
                        )}
                      </div>
                    </article>
                  </div>
                </section>
                ) : null}

                {creatorBrowser === "feats" ? (
                <section className="creator-section-block">
                  <div className="fighter-journey-scene-head compact">
                    <h3>Feats</h3>
                    <p>
                      {currentFeatSlots.length
                        ? `You have ${currentFeatSlots.length} feat ${currentFeatSlots.length === 1 ? "slot" : "slots"}: ${currentFeatSlots.map((slot) => slot.label).join(", ")}. Feats you can't take yet are under Locked, with the reason.`
                        : "Feats come from Ability Score Improvements (level 4, 8, 12...) or a race that grants one. You can still browse them."}
                    </p>
                  </div>
                  {(() => {
                    const rows = visibleNormalFeats.map((feat) => {
                      const selected = featContext.featIds.includes(feat.id);
                      const check = checkFeat(feat.id);
                      return { feat, selected, check, locked: !selected && !check.eligible };
                    });
                    const fits = rows.filter((row) => !row.locked);
                    const locked = rows.filter((row) => row.locked);
                    const shown = featFilter === "fits" ? fits : featFilter === "locked" ? locked : rows;
                    const focus =
                      (selectedFeatId ? normalFeats.find((feat) => feat.id === selectedFeatId) : null) ??
                      normalFeats.find((feat) => featContext.featIds.includes(feat.id)) ??
                      shown[0]?.feat ??
                      null;
                    const focusSlot = focus ? currentFeatSlots.find((entry) => entry.featId === focus.id) : null;
                    const focusCheck = focus ? checkFeat(focus.id, focusSlot ? focus.id : null) : null;
                    const paragraphs = focus ? featBenefitParagraphs(focus) : [];
                    return (
                      <PickLayout
                        inspect={
                          focus ? (
                            <InspectPanel
                              icon={featIcon(focus.name)}
                              kicker={featSourceShort(focus.source)}
                              title={focus.name}
                              summary={firstSentence(paragraphs[0] ?? focus.summary)}
                              warning={focusCheck && !focusCheck.eligible && !focusSlot ? `Missing: ${focusCheck.unmet.join(", ")}` : null}
                              rows={[
                                { label: "Needs", value: focus.prerequisite || "Nothing" },
                                ...(featTags(focus).filter((tag) => tag !== "Prerequisite").length
                                  ? [{ label: "Gives", value: featTags(focus).filter((tag) => tag !== "Prerequisite").join(", ") }]
                                  : []),
                                ...(focusCheck?.dmNotes.length ? [{ label: "DM", value: focusCheck.dmNotes.join(" ") }] : []),
                              ]}
                              fullText={paragraphs.join("\n\n")}
                              action={(() => {
                                if (focusSlot) {
                                  return (
                                    <button type="button" className="sheet-button secondary" onClick={() => removeFeatFromSlot(focus.id)}>
                                      {`Remove from ${focusSlot.label}`}
                                    </button>
                                  );
                                }
                                if (featContext.featIds.includes(focus.id)) {
                                  return <span className="pick-note">Granted automatically.</span>;
                                }
                                if (!focusCheck?.eligible) {
                                  return null;
                                }
                                return openFeatSlot ? (
                                  <button type="button" className="sheet-button primary" onClick={() => assignFeatToSlot(focus.id)}>
                                    {`Take it (${openFeatSlot.label})`}
                                  </button>
                                ) : (
                                  <span className="pick-note">No free feat slot right now.</span>
                                );
                              })()}
                            />
                          ) : (
                            <InspectPanel icon="laurels" title="Feats" summary="Pick a feat to read it." />
                          )
                        }
                      >
                        <PickSection
                          title="Feat library"
                          meta={`${usedFeatSlotCount} / ${currentFeatSlots.length} slots used`}
                          actions={
                            <input
                              type="search"
                              className="pick-search"
                              value={featSearchQuery}
                              onChange={(event) => setFeatSearchQuery(event.target.value)}
                              placeholder="Search feats"
                              aria-label="Search feats"
                            />
                          }
                        >
                          <div className="pick-filters" role="group" aria-label="Feat filter">
                            {([
                              ["fits", `You can take (${fits.length})`],
                              ["locked", `Locked (${locked.length})`],
                              ["all", `All (${rows.length})`],
                            ] as const).map(([id, label]) => (
                              <button key={`feat-filter-${id}`} type="button" className={featFilter === id ? "pick-filter active" : "pick-filter"} onClick={() => setFeatFilter(id)}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {shown.length ? (
                            <PickGrid
                              label="Feats"
                                  pageSize={16}
                                  key={`feats-${featFilter}-${featSearchQuery}`}
                              columns={4}
                              size="sm"
                              inspectedId={focus?.id ?? null}
                              onInspect={setSelectedFeatId}
                              items={shown.map((row) => ({
                                id: row.feat.id,
                                name: row.feat.name,
                                sub: row.selected ? "Taken" : featSourceShort(row.feat.source),
                                icon: featIcon(row.feat.name),
                                selected: row.selected,
                                locked: row.locked,
                                lockReason: row.locked ? `Needs ${row.check.unmet[0] ?? "a prerequisite"}` : undefined,
                              }))}
                            />
                          ) : (
                            <p className="pick-note">No feats here. Try another filter or search.</p>
                          )}
                        </PickSection>
                        {optionChoices.some((entry) => entry.sourceKind === "feat") ? (
                          <div className="option-choice-stack feat-choice-stack">
                            <span className="gear-list-title">Choices from your feats</span>
                            <OptionChoicePanel content={content} choices={optionChoices.filter((entry) => entry.sourceKind === "feat")} onToggle={toggleOptionChoice} />
                          </div>
                        ) : null}
                      </PickLayout>
                    );
                  })()}
                </section>
                ) : null}

                {creatorBrowser === "skill-spells" || creatorBrowser === "skills" || creatorBrowser === "spells" ? (
                <section className="creator-section-block">
                  <div className="skill-spell-layout skill-spell-layout-flat">
                      {creatorBrowser !== "spells" ? (
                      <section className="skill-spell-section">
                        <div className="fighter-journey-scene-head compact">
                          <h3>Skills</h3>
                          <p>{`Skills sit under the ability they use. Lit ones are trained. Your class lets you pick ${skillChoiceCount}; your background already gave ${backgroundSkillLabels.length || "none"}.`}</p>
                        </div>
                        {(() => {
                          const abilityOrder: AbilityId[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
                          const abilityNames: Record<AbilityId, string> = { STR: "Strength", DEX: "Dexterity", CON: "Constitution", INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma" };
                          const focusId = inspectId ?? draft.selectedSkillIds[0] ?? skillChoiceOptions[0] ?? null;
                          const focusEntry = previewDraft.skills.find((skill) => skill.id === focusId) ?? null;
                          const focusFromBackground = Boolean(focusId && backgroundSkillIds.includes(focusId));
                          const focusSelected = Boolean(focusId && draft.selectedSkillIds.includes(focusId));
                          const focusOption = Boolean(focusId && skillChoiceOptions.includes(focusId));
                          return (
                            <PickLayout
                              inspect={
                                focusId ? (
                                  <InspectPanel
                                    icon={skillIcon(focusId)}
                                    kicker={abilityNames[skillAbilities[focusId] ?? "DEX"]}
                                    title={skillLabel(focusId)}
                                    summary={skillDescription(focusId, focusEntry?.description) || null}
                                    rows={[
                                      { label: "Bonus", value: focusEntry ? signedNumber(focusEntry.bonus) : "-" },
                                      { label: "Trained", value: focusFromBackground ? "Yes, from your background" : focusSelected ? "Yes, class pick" : focusEntry?.proficient ? "Yes" : "No" },
                                      ...(focusEntry?.breakdown ? [{ label: "Math", value: focusEntry.breakdown }] : []),
                                    ]}
                                    warning={!focusOption && !focusFromBackground && !focusEntry?.proficient ? `Not on the ${currentClass.name.toLowerCase()} skill list.` : null}
                                  />
                                ) : (
                                  <InspectPanel icon="skills" title="Skills" summary="Click a skill to read it." />
                                )
                              }
                            >
                              <OptionChoicePanel content={content} choices={optionChoices.filter((entry) => entry.sourceKind !== "feat" && entry.choice.from.kind === "skill")} onToggle={toggleOptionChoice} />
                              <PickSection title={`${currentClass.name} skills`} meta={`choose ${skillChoiceCount}`} picked={selectedClassSkillCount} total={skillChoiceCount}>
                                <div className="skill-ability-columns">
                                  {abilityOrder.map((abilityId) => {
                                    const ids = Object.keys(skillAbilities).filter((skillId) => skillAbilities[skillId] === abilityId);
                                    const ability = previewDraft.abilities.find((entry) => entry.id === abilityId);
                                    return (
                                      <div key={`skill-col-${abilityId}`} className={`skill-ability-column ${abilityAccentClass(abilityId)}`}>
                                        <div className="skill-ability-head">
                                          <span>{abilityId}</span>
                                          <strong>{ability ? signedNumber(ability.modifier) : "+0"}</strong>
                                        </div>
                                        {ids.length ? (
                                          <PickGrid
                                            label={`${abilityNames[abilityId]} skills`}
                                            columns={1}
                                            size="sm"
                                            inspectedId={inspectId}
                                            onInspect={setInspectId}
                                            items={ids.map((skillId) => {
                                              const entry = previewDraft.skills.find((skill) => skill.id === skillId);
                                              const fromBackground = backgroundSkillIds.includes(skillId);
                                              const selected = draft.selectedSkillIds.includes(skillId);
                                              const option = skillChoiceOptions.includes(skillId);
                                              const trained = Boolean(entry?.proficient) || fromBackground || selected;
                                              return {
                                                id: skillId,
                                                name: skillLabel(skillId),
                                                sub: `${entry ? signedNumber(entry.bonus) : ""}${fromBackground ? " · background" : selected ? " · class" : ""}`,
                                                icon: skillIcon(skillId),
                                                selected,
                                                owned: !selected && trained,
                                                locked: !trained && !option,
                                                dim: !trained && option && remainingClassSkillChoices === 0,
                                              };
                                            })}
                                            onPick={(skillId) => toggleSkillSelection(skillId)}
                                          />
                                        ) : (
                                          <p className="pick-note">No skills. CON powers your hit points.</p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </PickSection>
                              {customBackgroundActive ? (
                                <PickSection title="Custom background skills" picked={draft.customBackground?.skillIds.length ?? 0} total={2}>
                                  <PickGrid
                                    label="Custom background skills"
                                    columns={6}
                                    size="sm"
                                    items={Object.keys(skillAbilities).map((skillId) => ({
                                      id: skillId,
                                      name: skillLabel(skillId),
                                      icon: skillIcon(skillId),
                                      selected: draft.customBackground?.skillIds.includes(skillId) ?? false,
                                    }))}
                                    onPick={(skillId) => toggleCustomBackgroundSkill(skillId)}
                                  />
                                </PickSection>
                              ) : null}
                            </PickLayout>
                          );
                        })()}
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
                                                      `${entry.name} is added to your warlock spell list by your patron. Pick it in the spell list to learn it.`,
                                                    spellLevel: entry.spell?.level,
                                                    meta: [`Unlocked at Warlock ${entry.unlockLevel}`, currentVisibleSubclass.name, "Patron List"],
                                                  })}
                                                />
                                              </strong>
                                              <div className="spell-selection-tags important">
                                                <span className="spell-tooltip-chip tone-support">
                                                  <AppIcon name="book" className="spell-tooltip-chip-icon" />
                                                  Patron List
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
                                        const parsed = parseWarlockInvocationSummary(option);
                                        const isUnlocked = warlockInvocationMeetsPrerequisite(parsed.requirement, {
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
                              {openWarlockGroup === "invocations" ? (
                                <OptionChoicePanel content={content} choices={optionChoices.filter((entry) => entry.sourceKind !== "feat" && entry.choice.from.kind === "spell")} onToggle={toggleOptionChoice} />
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
            <div className="creator-stack ability-screen">
              <div className="fighter-journey-scene-head compact">
                <h3>Ability Scores</h3>
                <p>Six numbers that power everything else. The big number is your final score; the small one is what you set here. Race and level bonuses are added on top.</p>
              </div>
              {(() => {
                const keyAbilities: Record<string, AbilityId[]> = {
                  artificer: ["INT"], barbarian: ["STR", "CON"], bard: ["CHA"], cleric: ["WIS"], druid: ["WIS"], fighter: ["STR", "DEX"],
                  monk: ["DEX", "WIS"], paladin: ["STR", "CHA"], ranger: ["DEX", "WIS"], rogue: ["DEX"], sorcerer: ["CHA"], warlock: ["CHA"], wizard: ["INT"],
                };
                const abilityUses: Record<AbilityId, string> = {
                  STR: "Melee attacks with heavy weapons, Athletics, jumping and how much you can carry.",
                  DEX: "Ranged and finesse attacks, AC in light or no armor, initiative, Acrobatics and Stealth.",
                  CON: "Hit points every level and keeping concentration on spells when you get hit.",
                  INT: "Arcana, History, Investigation, Nature, Religion; wizard and artificer spells.",
                  WIS: "Perception, Insight, Survival, Medicine; cleric, druid and ranger spells; monk AC and ki.",
                  CHA: "Persuasion, Deception, Intimidation, Performance; bard, sorcerer, warlock and paladin spells.",
                };
                const keys = keyAbilities[currentClass.id] ?? [];
                const focus = previewAbilities.find((ability) => ability.id === inspectId) ?? previewAbilities.find((ability) => keys.includes(ability.id as AbilityId)) ?? previewAbilities[0];
                return (
                  <PickLayout
                    inspect={
                      <InspectPanel
                        icon="stars-stack"
                        kicker={keys.includes(focus.id as AbilityId) ? `Key ability for ${currentClass.name}` : "Ability"}
                        title={focus.label}
                        summary={abilityUses[focus.id as AbilityId]}
                        rows={[
                          { label: "Final", value: `${focus.previewScore} (${signedNumber(focus.previewModifier)})` },
                          { label: "Set here", value: abilityMethod === "point-buy" ? `${focus.score} (${pointBuyCost(focus.score)} points)` : String(focus.score) },
                          ...(focus.racialBonus ? [{ label: "Race", value: `+${focus.racialBonus}` }] : []),
                          ...(focus.flexibleBonus ? [{ label: "Flexible", value: `+${focus.flexibleBonus}` }] : []),
                          ...(focus.classBonus ? [{ label: "Level ups", value: `+${focus.classBonus}` }] : []),
                          { label: "Modifier", value: "Score 10-11 is +0; every 2 points above adds +1, below subtracts 1." },
                        ]}
                      />
                    }
                  >
                    <PickSection
                      title="Method"
                      meta={
                        abilityMethod === "point-buy"
                          ? "spend 27 points, scores 8 to 15"
                          : abilityMethod === "standard-array"
                            ? "use 15, 14, 13, 12, 10, 8 once each"
                            : "type rolled or DM-approved scores"
                      }
                      actions={
                        abilityMethod === "point-buy" ? (
                          <span className={pointBuyRemaining === 0 ? "pick-counter done" : "pick-counter pending"}>
                            {pointBuyRemaining < 0 ? `${-pointBuyRemaining} points over` : `${pointBuyRemaining} points left`}
                          </span>
                        ) : abilityMethod === "standard-array" ? (
                          <span className={standardArrayValid ? "pick-counter done" : "pick-counter pending"}>{standardArrayValid ? "Done" : "Use each value once"}</span>
                        ) : null
                      }
                    >
                      <div className="pick-filters" role="tablist" aria-label="Ability score method">
                        {([
                          ["point-buy", "Point Buy"],
                          ["standard-array", "Standard Array"],
                          ["manual", "Manual / Rolled"],
                        ] as const).map(([method, label]) => (
                          <button
                            key={`ability-method-${method}`}
                            type="button"
                            role="tab"
                            aria-selected={abilityMethod === method}
                            className={abilityMethod === method ? "pick-filter active" : "pick-filter"}
                            onClick={() => setAbilityMethod(method)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </PickSection>
                    {flexibleAbilityBonusSource ? (
                      <p className="pick-note">{`${flexibleAbilityBonusSource}: put ${firstFlexLabel} on one ability and ${secondFlexLabel} on another with the small buttons under each score.`}</p>
                    ) : null}
                    <div className="ability-tiles">
                      {previewAbilities.map((ability) => {
                        const canDecrease = abilityMethod === "point-buy" ? ability.score > 8 : abilityMethod === "manual" ? ability.score > 3 : false;
                        const canIncrease =
                          abilityMethod === "point-buy"
                            ? ability.score < 15 && pointBuyStepCost(ability.score, ability.score + 1) <= pointBuyRemaining
                            : abilityMethod === "manual"
                              ? ability.score < 18
                              : false;
                        const isKey = keys.includes(ability.id as AbilityId);
                        const bonuses = [
                          ability.racialBonus ? `+${ability.racialBonus} race` : null,
                          ability.flexibleBonus ? `+${ability.flexibleBonus} flexible` : null,
                          ability.classBonus ? `+${ability.classBonus} level` : null,
                        ].filter(Boolean);
                        return (
                          <div key={ability.id} className={`ability-tile ${abilityAccentClass(ability.id)}${focus.id === ability.id ? " inspected" : ""}${isKey ? " key" : ""}`}>
                            <button type="button" className="ability-tile-main" onClick={() => setInspectId(ability.id)}>
                              <span className="ability-tile-id">{ability.id}</span>
                              <strong className="ability-tile-score">{ability.previewScore}</strong>
                              <span className="ability-tile-mod">{signedNumber(ability.previewModifier)}</span>
                              {isKey ? <span className="ability-tile-key">Key</span> : null}
                            </button>
                            {abilityMethod === "standard-array" ? (
                              <select
                                className="equipment-picker-select ability-array-select"
                                value={ability.score}
                                aria-label={`${ability.label} standard array value`}
                                onChange={(event) => assignStandardArrayValue(ability.id, Number(event.target.value))}
                              >
                                {STANDARD_ARRAY.map((value) => (
                                  <option key={`array-${ability.id}-${value}`} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="ability-tile-stepper">
                                <button type="button" disabled={!canDecrease} onClick={() => updateAbility(ability.id, ability.score - 1)} aria-label={`Lower ${ability.label}`}>
                                  −
                                </button>
                                <span>{ability.score}</span>
                                <button type="button" disabled={!canIncrease} onClick={() => updateAbility(ability.id, ability.score + 1)} aria-label={`Raise ${ability.label}`}>
                                  +
                                </button>
                              </div>
                            )}
                            <span className="ability-tile-note">{bonuses.length ? bonuses.join(" · ") : abilityMethod === "point-buy" ? `${pointBuyCost(ability.score)} pts` : "no bonus"}</span>
                            {flexibleAbilityBonusSource ? (
                              <div className="ability-tile-flex">
                                <button
                                  type="button"
                                  className={draft.flexibleAbilityBonuses.plusTwo === ability.id ? "pick-filter active" : "pick-filter"}
                                  aria-pressed={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                                  disabled={draft.flexibleAbilityBonuses.plusOne === ability.id}
                                  onClick={() => updateFlexibleAbilityBonus("plusTwo", draft.flexibleAbilityBonuses.plusTwo === ability.id ? "" : ability.id)}
                                >
                                  {firstFlexLabel}
                                </button>
                                <button
                                  type="button"
                                  className={draft.flexibleAbilityBonuses.plusOne === ability.id ? "pick-filter active" : "pick-filter"}
                                  aria-pressed={draft.flexibleAbilityBonuses.plusOne === ability.id}
                                  disabled={draft.flexibleAbilityBonuses.plusTwo === ability.id}
                                  onClick={() => updateFlexibleAbilityBonus("plusOne", draft.flexibleAbilityBonuses.plusOne === ability.id ? "" : ability.id)}
                                >
                                  {secondFlexLabel}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </PickLayout>
                );
              })()}
            </div>
          ) : null}
          <CreatorFlowFooter
            previous={creatorFlowPrevious}
            next={creatorFlowNext}
            pendingHere={creatorFlowCurrent?.pending ?? 0}
            onNavigate={goToCreatorScreen}
          />
        </div>
        </div>
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
