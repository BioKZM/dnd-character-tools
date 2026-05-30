import fs from "node:fs";
import path from "node:path";
import { creatorOptionsSchema, type CreatorOptions } from "@/lib/content/creator-options";
import { readLineageCollection } from "@/lib/content/lineage-content";
import { classCuratedEntrySchema } from "@/lib/content/class-curated-schema";
import { contentBundleSchema, type ContentBundle } from "@/lib/content/schema";
import { readSpellDataCatalog } from "@/lib/data/spells/content";

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.join(process.cwd(), "data", relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as T;
}

type RawFeatReference = {
  id: string;
  text?: string;
};

type FeatDetailTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

function cleanWikidotText(value: string) {
  return value
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€�/g, "\"")
    .replace(/â€“|â€”/g, "-")
    .replace(/Â/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\b(the|a|an)([A-Z][a-z]+ spell list)/g, "$1 $2")
    .replace(/([a-z])([A-Z][a-z]+ spell list)/g, "$1 $2")
    .replace(/([a-z])([A-Z][a-z]+)(school of magic)/g, "$1 $2 $3")
    .replace(/([a-z])([A-Z][a-z]+)(feat)/g, "$1 $2 $3")
    .replace(/([a-z])\.([A-Z])/g, "$1. $2")
    .replace(/([a-z])([A-Z][a-z]+)\./g, "$1. $2.")
    .replace(/\s+\./g, ".")
    .trim();
}

function parseFeatDetailTables(featId: string): FeatDetailTable[] {
  const tables: Record<string, FeatDetailTable[]> = {
    "aberrant-dragonmark": [
      {
        title: "Aberrant Dragonmark Flaws",
        columns: ["d8", "Flaw"],
        rows: [
          ["1", "Your mark is a source of constant physical pain."],
          ["2", "Your mark whispers to you. Its meaning can be unclear."],
          ["3", "When you're stressed, the mark hisses audibly."],
          ["4", "The skin around the mark is burned, scaly, or withered."],
          ["5", "Animals are uneasy around you."],
          ["6", "You have a mood swing any time you use your mark."],
          ["7", "Your looks change slightly whenever you use the mark."],
          ["8", "You have horrific nightmares after you use your mark."],
        ],
      },
    ],
    "rune-shaper": [
      {
        title: "Rune Spells",
        columns: ["Rune", "Spell"],
        rows: [
          ["Cloud", "Fog Cloud"],
          ["Death", "Inflict Wounds"],
          ["Dragon", "Chromatic Orb"],
          ["Enemy", "Disguise Self"],
          ["Fire", "Burning Hands"],
          ["Friend", "Speak with Animals"],
          ["Frost", "Armor of Agathys"],
          ["Hill", "Goodberry"],
          ["Journey", "Longstrider"],
          ["King", "Command"],
          ["Mountain", "Entangle"],
          ["Stone", "Sanctuary"],
          ["Storm", "Thunderwave"],
        ],
      },
    ],
    "cohort-of-chaos": [
      {
        title: "Chaotic Flares",
        columns: ["d4", "Flare"],
        rows: [
          ["1", "Battle Fury. A creature of your choice that you can see is filled with reckless fury. It has advantage on attack rolls and disadvantage on ability checks."],
          ["2", "Disruption Field. Waves of energy ripple around you. Every creature that starts its turn within 5 feet of you, or that moves into that area for the first time on a turn, takes 1d8 force damage."],
          ["3", "Unbound. When you move, you can use some or all of your walking speed to teleport yourself once, along with any equipment you're wearing or carrying, up to the distance used to an unoccupied space that you can see."],
          ["4", "Wailing Winds. Winds swirl in a 15-foot-radius sphere centered on you. You and any other creatures in that area have disadvantage on Wisdom saving throws."],
        ],
      },
    ],
    "scion-of-the-outer-planes": [
      {
        title: "Planar Infusion",
        columns: ["Plane", "Resistance", "Cantrip"],
        rows: [
          ["Chaotic Outer Plane", "Poison", "Minor Illusion"],
          ["Evil Outer Plane", "Necrotic", "Chill Touch"],
          ["Good Outer Plane", "Radiant", "Sacred Flame"],
          ["Lawful Outer Plane", "Force", "Guidance"],
          ["The Outlands", "Psychic", "Mage Hand"],
        ],
      },
    ],
    "strixhaven-initiate": [
      {
        title: "Strixhaven Spells",
        columns: ["College", "Cantrips", "1st-Level Spell"],
        rows: [
          ["Lorehold", "Choose two from Light, Sacred Flame, and Thaumaturgy.", "Choose one 1st-level Cleric or Wizard spell."],
          ["Prismari", "Choose two from Fire Bolt, Prestidigitation, and Ray of Frost.", "Choose one 1st-level Bard or Sorcerer spell."],
          ["Quandrix", "Choose two from Druidcraft, Guidance, and Mage Hand.", "Choose one 1st-level Druid or Wizard spell."],
          ["Silverquill", "Choose two from Sacred Flame, Thaumaturgy, and Vicious Mockery.", "Choose one 1st-level Bard or Cleric spell."],
          ["Witherbloom", "Choose two from Chill Touch, Druidcraft, and Spare the Dying.", "Choose one 1st-level Druid or Wizard spell."],
        ],
      },
    ],
    "divinely-favored": [
      {
        title: "Alignment Spells",
        columns: ["Alignment", "1st-Level Spells"],
        rows: [
          ["Evil", "Choose one 1st-level Warlock spell."],
          ["Good", "Choose one 1st-level Cleric spell."],
          ["Neutral", "Choose one 1st-level Druid spell."],
        ],
      },
    ],
    "initiate-of-high-sorcery": [
      {
        title: "Lunar Spells",
        columns: ["Moon", "1st-Level Spell"],
        rows: [
          ["Nuitari", "Choose two from Dissonant Whispers, False Life, Hex, and Ray of Sickness."],
          ["Lunitari", "Choose two from Color Spray, Disguise Self, Feather Fall, and Longstrider."],
          ["Solinari", "Choose two from Comprehend Languages, Detect Evil and Good, Protection from Evil and Good, and Shield."],
        ],
      },
    ],
  };

  return tables[featId] ?? [];
}

function extractFeatRulesText(rawText: string | undefined) {
  if (!rawText) {
    return "";
  }

  const sourceIndex = rawText.indexOf("Source:");
  if (sourceIndex === -1) {
    return "";
  }

  const adIndex = rawText.indexOf("window[", sourceIndex);
  return cleanWikidotText(rawText.slice(sourceIndex, adIndex === -1 ? undefined : adIndex));
}

function parseFeatDetailParagraphs(rawText: string | undefined) {
  const rulesText = extractFeatRulesText(rawText);
  if (!rulesText) {
    return [];
  }

  return rulesText
    .split(/\n\s*\n/)
    .map((paragraph) => cleanWikidotText(paragraph))
    .filter(Boolean)
    .filter((paragraph) => !paragraph.startsWith("Source:"))
    .filter((paragraph) => !paragraph.startsWith("Prerequisite:"));
}

function readRawFeatReferenceMap() {
  const publishedPath = path.join(process.cwd(), "content", "raw", "wikidot-reference", "feats", "published.json");
  const racialPath = path.join(process.cwd(), "content", "raw", "wikidot-reference", "feats", "racial-feats.json");
  const entries: RawFeatReference[] = [];

  [publishedPath, racialPath].forEach((absolutePath) => {
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    entries.push(...JSON.parse(fs.readFileSync(absolutePath, "utf-8")) as RawFeatReference[]);
  });

  return new Map(entries.map((entry) => [entry.id, entry]));
}

function enrichFeats(feats: ContentBundle["feats"]): ContentBundle["feats"] {
  const rawFeatMap = readRawFeatReferenceMap();

  return feats.map((feat) => {
    const rawFeat = rawFeatMap.get(feat.id);
    const detailParagraphs = parseFeatDetailParagraphs(rawFeat?.text);

    return {
      ...feat,
      summary: cleanWikidotText(feat.summary),
      source: feat.source ? cleanWikidotText(feat.source) : feat.source,
      prerequisite: feat.prerequisite ? cleanWikidotText(feat.prerequisite) : feat.prerequisite,
      detailParagraphs,
      detailTables: parseFeatDetailTables(feat.id),
    };
  });
}

function lineageTraitsAsSpeciesTraits(
  traits: { id: string; name: string; summary: string }[],
  stats: { label: string; value: string }[],
  bonuses?: string[],
) {
  return [
    ...traits.map((trait) => ({
      id: trait.id,
      name: trait.name,
      summary: trait.summary,
    })),
    ...stats.map((stat, index) => ({
      id: `stat-${index}-${stat.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: stat.label,
      summary: stat.value,
    })),
    ...(bonuses ?? []).map((bonus, index) => ({
      id: `bonus-${index}`,
      name: `Bonus ${index + 1}`,
      summary: bonus,
    })),
  ];
}

function mergeSpeciesWithLineages(species: ContentBundle["species"] = []): ContentBundle["species"] {
  const lineageCollection = readLineageCollection();
  const speciesMap = new Map(species.map((entry) => [entry.id, entry]));

  for (const lineage of lineageCollection.entries) {
    if (!speciesMap.has(lineage.id)) {
      speciesMap.set(lineage.id, {
        id: lineage.id,
        name: lineage.name,
        traits: lineageTraitsAsSpeciesTraits(lineage.coreTraits, lineage.stats),
        source: lineage.sourceLabel,
      });
    }

    for (const subrace of lineage.subraces) {
      if (speciesMap.has(subrace.id)) {
        continue;
      }

      speciesMap.set(subrace.id, {
        id: subrace.id,
        name: subrace.name,
        traits: lineageTraitsAsSpeciesTraits(subrace.traits, subrace.stats, subrace.bonuses),
        source: subrace.source ?? lineage.sourceLabel,
      });
    }
  }

  return Array.from(speciesMap.values());
}

function readGroupedClasses(): ContentBundle["classes"] {
  const root = path.join(process.cwd(), "data", "classes");
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, "data.json"))
    .filter((absolutePath) => fs.existsSync(absolutePath))
    .map((absolutePath) =>
      classCuratedEntrySchema.parse(JSON.parse(fs.readFileSync(absolutePath, "utf-8"))),
    )
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      hitDie: Number.parseInt(entry.hitDie.replace(/[^0-9]/g, ""), 10) || 0,
      primaryAbilities:
        entry.id === "bard"
          ? ["CHA"]
          : entry.id === "fighter"
            ? ["STR", "DEX"]
            : entry.id === "ranger"
              ? ["DEX", "WIS"]
              : entry.id === "warlock"
                ? ["CHA"]
                : [],
      savingThrows:
        entry.id === "bard"
          ? ["DEX", "CHA"]
          : entry.id === "fighter"
            ? ["STR", "CON"]
            : entry.id === "ranger"
              ? ["STR", "DEX"]
              : entry.id === "warlock"
                ? ["WIS", "CHA"]
                : [],
      featuresByLevel: entry.classFeatures.reduce<Record<string, { id: string; name: string; summary: string }[]>>(
        (accumulator, feature) => {
          const levelMatch = entry.spellcastingTable.rows.find((row) => row[2]?.includes(feature.name));
          const level = levelMatch?.[0]?.match(/^(\d+)/)?.[1] ?? "1";
          accumulator[level] ??= [];
          accumulator[level].push(feature);
          return accumulator;
        },
        {},
      ),
      source: "Player's Handbook",
      multiclassRequirement: entry.multiclassRequirement,
    }));
}

export function readNormalizedContent(): ContentBundle {
  const spellCatalog = readSpellDataCatalog();
  const bundle = {
    sourceBooks: readJsonFile("source-books.json"),
    classes: readGroupedClasses(),
    species: mergeSpeciesWithLineages(),
    backgrounds: readJsonFile("backgrounds.json"),
    languages: readJsonFile("languages.json"),
    tools: readJsonFile("tools.json"),
    items: readJsonFile("items.json"),
    armors: readJsonFile("armors.json"),
    weapons: readJsonFile("weapons.json"),
    weaponProperties: readJsonFile("weapon-properties.json"),
    feats: enrichFeats(readJsonFile("feats.json")),
    spells: spellCatalog.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      level: entry.level,
      school: entry.school,
      subtitle: entry.subtitle,
      castingTime: entry.castingTime ?? "",
      range: entry.range ?? "",
      components: entry.components,
      duration: entry.duration ?? "",
      summary: entry.summary.join("\n\n"),
      detailLines: entry.detailLines,
      detailTables: entry.detailTables,
      atHigherLevels: entry.atHigherLevels,
      tags: entry.tags,
      source: entry.source,
      classes: entry.classes,
      subclassOptions: entry.subclassOptions,
    })),
  };

  return contentBundleSchema.parse(bundle);
}

export function readCreatorOptions(): CreatorOptions {
  return creatorOptionsSchema.parse(readJsonFile("creator-options.json"));
}
