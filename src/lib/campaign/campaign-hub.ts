import { readNormalizedMonsters } from "@/lib/campaign/monster-content";

export type CampaignCharacter = {
  id: string;
  name: string;
  playerName: string;
  classLine: string;
  species: string;
  level: number;
  currentHp: number;
  maxHp: number;
  passivePerception: number;
  spellSlots: string;
  conditions: string[];
  sourceFile: string;
  lastSync: string;
};

export type SessionNote = {
  id: string;
  title: string;
  detail: string;
  type: "alert" | "reminder" | "secret";
};

export type MonsterEntry = {
  id: string;
  name: string;
  cr: string;
  type: string;
  environment: string;
  ac: number;
  hp: number;
  speed: string;
  role: string;
  notes: string;
};

export type TravelLeg = {
  id: string;
  title: string;
  distance: string;
  risk: "Low" | "Moderate" | "High";
  encounterHook: string;
  weather: string;
};

export type SceneToken = {
  id: string;
  label: string;
  kind: "pc" | "npc" | "monster" | "objective";
  position: string;
  state: string;
};

export type CampaignHubData = {
  campaignName: string;
  sessionTitle: string;
  characters: CampaignCharacter[];
  notes: SessionNote[];
  monsters: MonsterEntry[];
  travelPlan: TravelLeg[];
  tokens: SceneToken[];
};

export function getCampaignHubData(): CampaignHubData {
  const monsters = readNormalizedMonsters();

  return {
    campaignName: "Ashes of the Amber Road",
    sessionTitle: "Session 12 - The Observatory Below",
    characters: [
      {
        id: "elira-voss",
        name: "Elira Voss",
        playerName: "Kingo",
        classLine: "Wizard 3",
        species: "High Elf",
        level: 3,
        currentHp: 17,
        maxHp: 20,
        passivePerception: 13,
        spellSlots: "4 / 2",
        conditions: ["Concentrating"],
        sourceFile: "elira-voss.pdf",
        lastSync: "2 min ago",
      },
      {
        id: "tharok-stonehand",
        name: "Tharok Stonehand",
        playerName: "Mert",
        classLine: "Paladin 3",
        species: "Mountain Dwarf",
        level: 3,
        currentHp: 25,
        maxHp: 28,
        passivePerception: 11,
        spellSlots: "3 / 0",
        conditions: [],
        sourceFile: "tharok-stonehand.pdf",
        lastSync: "5 min ago",
      },
      {
        id: "lyra-fen",
        name: "Lyra Fen",
        playerName: "Selin",
        classLine: "Rogue 3",
        species: "Lightfoot Halfling",
        level: 3,
        currentHp: 18,
        maxHp: 18,
        passivePerception: 15,
        spellSlots: "-",
        conditions: ["Hidden"],
        sourceFile: "lyra-fen.pdf",
        lastSync: "1 min ago",
      },
    ],
    notes: [
      {
        id: "amber-seal",
        title: "Amber Seal is weakening",
        detail: "If the party delays another long rest, the vault guardians wake before the eclipse.",
        type: "alert",
      },
      {
        id: "cleric-list",
        title: "Hidden spell list reminder",
        detail: "Divine Soul and domain spell overrides should be visible in the DM live spell inspector.",
        type: "reminder",
      },
      {
        id: "npc-secret",
        title: "Archivist Vael knows the map is false",
        detail: "Keep this note DM-only until the party reaches the flooded bridge.",
        type: "secret",
      },
    ],
    monsters: monsters.map((monster) => ({
      id: monster.id,
      name: monster.name,
      cr: monster.cr,
      type: monster.type,
      environment: monster.environment.join(", "),
      ac: monster.ac,
      hp: monster.hp,
      speed: monster.speed,
      role: monster.role,
      notes: monster.notes,
    })),
    travelPlan: [
      {
        id: "old-bridge",
        title: "Amber Road to the Old Bridge",
        distance: "18 miles",
        risk: "Moderate",
        encounterHook: "Bandit scouts tail supply wagons near dusk.",
        weather: "Cold wind, patchy rain",
      },
      {
        id: "mire-cut",
        title: "Mire Cut Crossing",
        distance: "7 miles",
        risk: "High",
        encounterHook: "Sinkholes and swamp gas hide a buried shrine entrance.",
        weather: "Dense fog at sunrise",
      },
      {
        id: "vault-approach",
        title: "Approach to the Observatory",
        distance: "3 miles",
        risk: "High",
        encounterHook: "Living wards test the party before the final descent.",
        weather: "Static-charged air",
      },
    ],
    tokens: [
      { id: "pc-elira", label: "Elira", kind: "pc", position: "B4", state: "Backline, concentrating" },
      { id: "pc-tharok", label: "Tharok", kind: "pc", position: "C3", state: "Frontline" },
      { id: "pc-lyra", label: "Lyra", kind: "pc", position: "A5", state: "Hidden near pillar" },
      { id: "obj-crystal", label: "Amber Focus", kind: "objective", position: "F4", state: "Objective: unstable" },
      { id: "mon-hulk", label: "Umber Hulk", kind: "monster", position: "E3", state: "Burrowed emergence" },
    ],
  };
}
