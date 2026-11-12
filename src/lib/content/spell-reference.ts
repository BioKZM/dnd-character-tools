import { readSpellDataCatalog } from "@/lib/data/spells/content";

export type SpellReferenceEntry = {
  id: string;
  name: string;
  level: number;
  school: string;
  source?: string;
  subtitle?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  summary: string[];
  detailLines: string[];
  detailTables: { headers: string[]; rows: string[][] }[];
  atHigherLevels?: string;
  tags: string[];
  classes: string[];
  subclassOptions: string[];
};

export type SpellReferenceCollection = Record<string, SpellReferenceEntry>;

export function readSpellReferenceCollection(): SpellReferenceCollection {
  const catalog = readSpellDataCatalog();
  return Object.fromEntries(catalog.entries.map((entry) => [entry.id, entry]));
}
