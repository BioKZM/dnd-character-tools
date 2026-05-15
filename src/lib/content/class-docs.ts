export type ClassDocOption = {
  id: string;
  name: string;
  summary: string;
};

export type ClassDocBlock = {
  heading: string | null;
  paragraphs: string[];
};

export type ClassDocTable = {
  title: string | null;
  groupedHeaders?: string[];
  headers: string[];
  rows: string[][];
};

export type ClassDocSpellGrant = {
  unlockLevel: number;
  spells: string[];
};

export type ClassDocSection = {
  id: string;
  name: string;
  summary: string;
  blocks: ClassDocBlock[];
  tables: ClassDocTable[];
  options: ClassDocOption[];
  level?: number;
};

export type ClassDocChoiceGroup = {
  id: string;
  name: string;
  source: "base" | "subclass";
  subclassId?: string;
  level?: number;
  summary: string;
  blocks: ClassDocBlock[];
  tables: ClassDocTable[];
  options: ClassDocOption[];
};

export type ClassSubclassDoc = {
  id: string;
  name: string;
  summary: string;
  source: string;
  sections: ClassDocSection[];
  grantedSpells: ClassDocSpellGrant[];
  choiceGroups: ClassDocChoiceGroup[];
};

export type ClassDocEntry = {
  classId: string;
  baseSections: Record<string, string>;
  baseSectionEntries: Record<string, ClassDocSection>;
  baseChoiceGroups: ClassDocChoiceGroup[];
  subclasses: ClassSubclassDoc[];
  baseGrantedSpells?: ClassDocSpellGrant[];
};

export type ClassDocCollection = Record<string, ClassDocEntry>;

export function readClassDocCollection(): ClassDocCollection {
  return {};
}
