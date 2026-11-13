// Esya / silah / zirh / tool / dil icin oyuncuya okunur aciklama: tek cumle ozet + birkac satir.
import type { ContentBundle } from "@/lib/content/schema";
import { toolIcon, weaponIcon, type GameIconName } from "@/lib/ui/game-icons";

export type GearInfo = {
  kind: "weapon" | "armor" | "tool" | "item" | "language";
  id: string;
  name: string;
  icon: GameIconName;
  kicker: string;
  summary: string;
  /** Kartta isim altina sigacak kisa satir (or. "1d8 slashing · one or two hands"). */
  sub: string;
  rows: Array<{ label: string; value: string }>;
};

type Weapon = ContentBundle["weapons"][number];
type Armor = ContentBundle["armors"][number];
type Tool = ContentBundle["tools"][number];
type Item = ContentBundle["items"][number];
type Language = ContentBundle["languages"][number];

const capitalize = (value: string) => (value ? value[0].toUpperCase() + value.slice(1) : value);

function reachOf(weapon: Weapon) {
  return weapon.properties.includes("reach") ? 10 : 5;
}

/** Silah ozelligi icin oyuncu dilinde tek satir. */
export function weaponPropertyLine(property: string, weapon: Weapon): string {
  switch (property) {
    case "finesse":
      return "Finesse: attack with STR or DEX, whichever is better.";
    case "light":
      return "Light: small enough to fight with one in each hand.";
    case "heavy":
      return "Heavy: Small creatures attack with it at disadvantage.";
    case "two-handed":
      return "Two-handed: you need both hands to attack with it.";
    case "versatile":
      return `Versatile: one hand ${weapon.damage ?? ""}, two hands ${weapon.versatileDamage ?? ""}.`.replace(/\s+\./, ".");
    case "reach":
      return "Reach: hits creatures up to 10 ft. away instead of 5 ft.";
    case "thrown":
      return `Thrown: you can throw it${weapon.range ? ` (${weapon.range})` : ""}, using the same ability as a melee attack.`;
    case "ammunition":
      return "Ammunition: needs arrows, bolts or bullets; you can recover half after a fight.";
    case "loading":
      return "Loading: only one shot per action, bonus action or reaction, even with Extra Attack.";
    case "special":
      return `Special: ${weapon.specialDescription ?? "has its own rules, see the full text."}`;
    default:
      return capitalize(property);
  }
}

function handsOf(weapon: Weapon) {
  if (weapon.properties.includes("two-handed")) {
    return "Two hands";
  }
  if (weapon.properties.includes("versatile")) {
    return "One or two hands";
  }
  return "One hand";
}

export function weaponInfo(weapon: Weapon): GearInfo {
  if (weapon.proficiency === "ammunition" || weapon.attackType === "ammunition") {
    const forWhat = /bolt/i.test(weapon.name)
      ? "crossbows"
      : /bullet/i.test(weapon.name)
        ? "slings"
        : /needle/i.test(weapon.name)
          ? "blowguns"
          : "bows";
    return {
      kind: "weapon",
      id: weapon.id,
      name: weapon.name,
      icon: weaponIcon(weapon.name),
      kicker: "Ammunition",
      summary: `Ammunition for ${forWhat}. Each shot uses one; after a fight you can recover half by searching for a minute.`,
      sub: `Ammo for ${forWhat}`,
      rows: [{ label: "Weight", value: `${weapon.weight} · ${weapon.cost}` }],
    };
  }
  const damage = weapon.damage ? `${weapon.damage} ${weapon.damageType ?? ""}`.trim() : "No damage";
  const twoHanded = weapon.versatileDamage ? `${damage}, ${weapon.versatileDamage} with two hands` : damage;
  const ranged = weapon.attackType === "ranged";
  const range = ranged
    ? `${weapon.range ?? "?"} (normal / long; long range attacks have disadvantage)`
    : weapon.properties.includes("thrown")
      ? `Melee ${reachOf(weapon)} ft., thrown ${weapon.range ?? ""}`.trim()
      : `Melee, ${reachOf(weapon)} ft.`;
  const kind = `${capitalize(weapon.proficiency)} ${ranged ? "ranged" : "melee"} weapon`;
  const hands = handsOf(weapon);
  return {
    kind: "weapon",
    id: weapon.id,
    name: weapon.name,
    icon: weaponIcon(weapon.name),
    kicker: kind,
    summary: `${kind}. ${hands === "One or two hands" ? "Use it in one hand, or both for more damage." : hands === "Two hands" ? "Needs both hands." : "Held in one hand."}`,
    sub: `${damage} · ${hands.toLowerCase()}`,
    rows: [
      { label: "Damage", value: twoHanded },
      { label: "Hands", value: hands },
      { label: "Range", value: range },
      ...weapon.properties.map((property) => ({ label: "Property", value: weaponPropertyLine(property, weapon) })),
      { label: "Weight", value: `${weapon.weight} · ${weapon.cost}` },
    ],
  };
}

export function armorInfo(armor: Armor): GearInfo {
  if (armor.category === "shield") {
    return {
      kind: "armor",
      id: armor.id,
      name: armor.name,
      icon: "round-shield",
      kicker: "Shield",
      summary: `Carry it in one hand for +${armor.acBonus ?? 2} AC. That hand can't hold a weapon or focus.`,
      sub: `+${armor.acBonus ?? 2} AC · one hand`,
      rows: [
        { label: "AC", value: `+${armor.acBonus ?? 2}` },
        { label: "Weight", value: `${armor.weight} · ${armor.cost}` },
      ],
    };
  }
  const dex = armor.dexBonus ? (armor.maxDexBonus ? ` + DEX (max ${armor.maxDexBonus})` : " + DEX") : "";
  const ac = `${armor.baseAc ?? 10}${dex}`;
  const kind = `${capitalize(armor.category)} armor`;
  const feel =
    armor.category === "light"
      ? "Light: keeps your full DEX bonus."
      : armor.category === "medium"
        ? "Medium: adds at most +2 from DEX."
        : "Heavy: ignores DEX entirely.";
  return {
    kind: "armor",
    id: armor.id,
    name: armor.name,
    icon: "breastplate",
    kicker: kind,
    summary: `${feel}${armor.stealthDisadvantage ? " Noisy: disadvantage on Stealth." : ""}`,
    sub: `AC ${ac}`,
    rows: [
      { label: "AC", value: ac },
      ...(armor.strengthRequirement
        ? [{ label: "Strength", value: `Needs STR ${armor.strengthRequirement}, otherwise your speed drops by 10 ft.` }]
        : []),
      { label: "Stealth", value: armor.stealthDisadvantage ? "Disadvantage on Stealth checks" : "No penalty" },
      { label: "Weight", value: `${armor.weight} · ${armor.cost}` },
    ],
  };
}

const TOOL_CATEGORY: Record<Tool["category"], string> = {
  "artisan-tools": "Artisan's tools",
  "gaming-sets": "Gaming set",
  "musical-instruments": "Musical instrument",
  vehicles: "Vehicles",
  kits: "Kit",
};

export function toolInfo(tool: Tool): GearInfo {
  return {
    kind: "tool",
    id: tool.id,
    name: tool.name,
    icon: toolIcon(tool.name),
    kicker: TOOL_CATEGORY[tool.category] ?? "Tool",
    summary: tool.summary ?? "A set of tools for a trade or hobby.",
    sub: TOOL_CATEGORY[tool.category] ?? "Tool",
    rows: [
      { label: "Proficient", value: "Add your proficiency bonus to ability checks made with it." },
      ...(tool.weight || tool.cost ? [{ label: "Weight", value: [tool.weight, tool.cost].filter(Boolean).join(" · ") }] : []),
    ],
  };
}

const ITEM_ICON: Partial<Record<Item["category"], GameIconName>> = {
  "equipment-pack": "knapsack",
  container: "swap-bag",
  clothes: "leather-armor",
  "arcane-focus": "crystal-ball",
  "druidic-focus": "oak-leaf",
  "holy-symbol": "holy-symbol",
};

export function itemInfo(item: Item): GearInfo {
  const description = item.summary ?? item.description?.join(" ") ?? "";
  const summary = item.contents?.length
    ? `A ready-made bundle of adventuring gear.${description ? ` ${description}` : ""}`
    : description || "Adventuring gear.";
  return {
    kind: "item",
    id: item.id,
    name: item.name,
    icon: ITEM_ICON[item.category] ?? "knapsack",
    kicker: capitalize(item.category.replace(/-/g, " ")),
    summary,
    sub: item.contents?.length ? `${item.contents.length} items inside` : capitalize(item.category.replace(/-/g, " ")),
    rows: [
      ...(item.contents?.length ? [{ label: "Contains", value: item.contents.join(", ") }] : []),
      ...(item.capacity ? [{ label: "Holds", value: item.capacity }] : []),
      ...(item.weight || item.cost ? [{ label: "Weight", value: [item.weight, item.cost].filter(Boolean).join(" · ") }] : []),
    ],
  };
}

export function languageInfo(language: Language): GearInfo {
  const rarity = language.category === "standard" ? "Common language" : language.category === "exotic" ? "Exotic language" : "Setting language";
  return {
    kind: "language",
    id: language.id,
    name: language.name,
    icon: "talk",
    kicker: rarity,
    summary: language.speakers ? `Spoken by ${language.speakers.charAt(0).toLowerCase()}${language.speakers.slice(1)}.` : rarity,
    sub: language.speakers ?? rarity,
    rows: [
      ...(language.script ? [{ label: "Script", value: language.script }] : []),
      ...(language.variants.length ? [{ label: "Dialects", value: language.variants.join(", ") }] : []),
      { label: "Rarity", value: rarity },
    ],
  };
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/^\s*(\d+|an?|two|three|four|five|ten|twenty)\s*x?\s+/, "")
    .replace(/^\s*\d+x\s*/, "")
    .replace(/[’']/g, "'")
    .replace(/[^a-z' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variantsOf(value: string) {
  const base = normalize(value);
  const set = new Set([base]);
  if (base.endsWith("es")) {
    set.add(base.slice(0, -2));
  }
  if (base.endsWith("s")) {
    set.add(base.slice(0, -1));
  }
  set.add(base.replace(/ armor$/, ""));
  return set;
}

/** Data'da tek bir esya olmayan genel kalemler ("Arcane Focus", "Musical Instrument"...). */
const GENERIC_GEAR: Array<{ match: RegExp; info: Omit<GearInfo, "name"> }> = [
  {
    match: /^arcane focus$/,
    info: {
      kind: "item",
      id: "generic-arcane-focus",
      icon: "crystal-ball",
      kicker: "Spellcasting focus",
      summary: "A crystal, orb, rod, staff or wand you hold while casting. It replaces material components that have no gold cost.",
      sub: "Cast spells through it",
      rows: [
        { label: "Used by", value: "Sorcerers, warlocks and wizards" },
        { label: "Pick one", value: "Crystal, Orb, Rod, Staff or Wand. A staff also works as a quarterstaff." },
        { label: "How", value: "Hold it in a hand when you cast. Spells with a gold-cost component still need that item." },
      ],
    },
  },
  {
    match: /^druidic focus$/,
    info: {
      kind: "item",
      id: "generic-druidic-focus",
      icon: "oak-leaf",
      kicker: "Spellcasting focus",
      summary: "A sprig of mistletoe, totem, wooden staff or yew wand. Druids cast spells through it instead of using material components.",
      sub: "Cast druid spells through it",
      rows: [
        { label: "Used by", value: "Druids" },
        { label: "Pick one", value: "Sprig of Mistletoe, Totem, Wooden Staff or Yew Wand" },
      ],
    },
  },
  {
    match: /^holy symbol$/,
    info: {
      kind: "item",
      id: "generic-holy-symbol",
      icon: "holy-symbol",
      kicker: "Spellcasting focus",
      summary: "An amulet, emblem or reliquary of your god. Clerics and paladins cast spells through it instead of using material components.",
      sub: "Cast cleric / paladin spells through it",
      rows: [
        { label: "Used by", value: "Clerics and paladins" },
        { label: "Tip", value: "An emblem painted on your shield works while you hold the shield, so your other hand stays free." },
      ],
    },
  },
  {
    match: /^component pouch$/,
    info: {
      kind: "item",
      id: "generic-component-pouch",
      icon: "swap-bag",
      kicker: "Spellcasting kit",
      summary: "A belt pouch with all the small material components your spells need. Works like a focus: no need to track bat guano or pinches of sand.",
      sub: "Covers material components",
      rows: [{ label: "Limit", value: "Components with a gold cost (like a 300 gp diamond) are not inside; buy those separately." }],
    },
  },
  {
    match: /^spellbook$/,
    info: {
      kind: "item",
      id: "generic-spellbook",
      icon: "spell-book",
      kicker: "Wizard gear",
      summary: "Your wizard spells live here. You prepare spells from it after a long rest; losing it means losing those spells until you rebuild it.",
      sub: "Holds your wizard spells",
      rows: [{ label: "Pages", value: "100 vellum pages; copying a new spell costs time and gold." }],
    },
  },
  {
    match: /^musical instrument$/,
    info: {
      kind: "tool",
      id: "generic-musical-instrument",
      icon: "pan-flute",
      kicker: "Musical instrument",
      summary: "Any instrument you like: lute, flute, drum, horn, lyre, viol... Bards can cast spells through it.",
      sub: "Your choice of instrument",
      rows: [{ label: "Bards", value: "Works as a spellcasting focus for bard spells." }],
    },
  },
  {
    match: /^(simple|martial)( melee)? weapons?$/,
    info: {
      kind: "weapon",
      id: "generic-weapon",
      icon: "sword-clash",
      kicker: "Weapon of your choice",
      summary: "Pick any weapon of this kind in the list above. Your pick replaces this line.",
      sub: "Your choice",
      rows: [],
    },
  },
];

/** Isimden (or. "20 Arrows", "2x Handaxes", "Leather Armor") esya bilgisi bulur. */
export function findGearInfo(content: ContentBundle, name: string): GearInfo | null {
  const normalized = normalize(name);
  const generic = GENERIC_GEAR.find((entry) => entry.match.test(normalized));
  if (generic) {
    return { ...generic.info, name: name.replace(/^\s*\d+x?\s+/i, "") };
  }
  const variants = variantsOf(name);
  const has = (candidate: string) => [...variantsOf(candidate)].some((entry) => variants.has(entry));
  const weapon = content.weapons.find((entry) => [entry.name, ...(entry.aliases ?? [])].some(has));
  if (weapon) {
    return weaponInfo(weapon);
  }
  const armor = content.armors.find((entry) => [entry.name, ...(entry.aliases ?? [])].some(has));
  if (armor) {
    return armorInfo(armor);
  }
  const tool = content.tools.find((entry) => has(entry.name));
  if (tool) {
    return toolInfo(tool);
  }
  const item = content.items.find((entry) => has(entry.name));
  if (item) {
    return itemInfo(item);
  }
  const language = content.languages.find((entry) => has(entry.name));
  return language ? languageInfo(language) : null;
}

/** Bir paket/secenek etiketini ("Leather Armor, Longbow, and 20 Arrows") parcalara ayirip bilgileri dondurur. */
export function gearInfosFor(content: ContentBundle, label: string, items: string[] = []): GearInfo[] {
  const parts = (items.length ? items : [label]).flatMap((entry) =>
    entry
      .split(/\s*,\s*|\s+and\s+/i)
      .map((part) => part.trim())
      .filter(Boolean),
  );
  const seen = new Set<string>();
  return parts
    .map((part) => findGearInfo(content, part))
    .filter((info): info is GearInfo => {
      if (!info || seen.has(`${info.kind}-${info.id}`)) {
        return false;
      }
      seen.add(`${info.kind}-${info.id}`);
      return true;
    });
}
