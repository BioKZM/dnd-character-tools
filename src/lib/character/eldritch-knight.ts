export type EldritchKnightProgressionRow = {
  level: number;
  cantripsKnown: number;
  spellsKnown: number;
  slots: {
    1: number;
    2: number;
    3: number;
    4: number;
  };
};

export const eldritchKnightProgression: EldritchKnightProgressionRow[] = [
  { level: 3, cantripsKnown: 2, spellsKnown: 3, slots: { 1: 2, 2: 0, 3: 0, 4: 0 } },
  { level: 4, cantripsKnown: 2, spellsKnown: 4, slots: { 1: 3, 2: 0, 3: 0, 4: 0 } },
  { level: 5, cantripsKnown: 2, spellsKnown: 4, slots: { 1: 3, 2: 0, 3: 0, 4: 0 } },
  { level: 6, cantripsKnown: 2, spellsKnown: 4, slots: { 1: 3, 2: 0, 3: 0, 4: 0 } },
  { level: 7, cantripsKnown: 2, spellsKnown: 5, slots: { 1: 4, 2: 2, 3: 0, 4: 0 } },
  { level: 8, cantripsKnown: 2, spellsKnown: 6, slots: { 1: 4, 2: 2, 3: 0, 4: 0 } },
  { level: 9, cantripsKnown: 2, spellsKnown: 6, slots: { 1: 4, 2: 2, 3: 0, 4: 0 } },
  { level: 10, cantripsKnown: 3, spellsKnown: 7, slots: { 1: 4, 2: 3, 3: 0, 4: 0 } },
  { level: 11, cantripsKnown: 3, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 0, 4: 0 } },
  { level: 12, cantripsKnown: 3, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 0, 4: 0 } },
  { level: 13, cantripsKnown: 3, spellsKnown: 9, slots: { 1: 4, 2: 3, 3: 2, 4: 0 } },
  { level: 14, cantripsKnown: 3, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 2, 4: 0 } },
  { level: 15, cantripsKnown: 3, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 2, 4: 0 } },
  { level: 16, cantripsKnown: 3, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 0 } },
  { level: 17, cantripsKnown: 3, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 0 } },
  { level: 18, cantripsKnown: 3, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 0 } },
  { level: 19, cantripsKnown: 3, spellsKnown: 12, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
  { level: 20, cantripsKnown: 3, spellsKnown: 13, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
];

export function getEldritchKnightProgression(level: number) {
  return eldritchKnightProgression.find((entry) => entry.level === level) ?? null;
}
