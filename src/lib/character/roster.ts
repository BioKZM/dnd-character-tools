import type { CharacterDraft } from "@/lib/character/demo-sheet";

/**
 * Tarayicida birden cok karakter. Hepsi tek bir localStorage anahtarinda durur:
 *   codex-roster = { version, activeId, characters: [{ id, updatedAt, draft }] }
 * Creator ve Sheet her zaman "aktif" karakteri acar. Eski tek-karakter anahtari
 * (codex-character-draft) ilk acilista roster'a tasinir ve aktif karakterin kopyasi olarak yazilmaya devam eder.
 */

export const ROSTER_KEY = "codex-roster";
export const LEGACY_DRAFT_KEY = "codex-character-draft";

export type RosterEntry = {
  id: string;
  updatedAt: string;
  draft: CharacterDraft;
};

export type Roster = {
  version: 1;
  activeId: string | null;
  characters: RosterEntry[];
};

/** Disari aktarilan dosya: tek karakter ya da tum roster ayni formatta. */
export type RosterExport = {
  kind: "codex-characters";
  version: 1;
  exportedAt: string;
  characters: CharacterDraft[];
};

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function newCharacterId() {
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function isDraftLike(value: unknown): value is CharacterDraft {
  return Boolean(value && typeof value === "object" && Array.isArray((value as CharacterDraft).abilities) && "classId" in (value as object));
}

export function readRoster(): Roster {
  const store = storage();
  const empty: Roster = { version: 1, activeId: null, characters: [] };
  if (!store) {
    return empty;
  }

  try {
    const raw = store.getItem(ROSTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Roster;
      if (Array.isArray(parsed.characters)) {
        const characters = parsed.characters.filter((entry) => entry && entry.id && isDraftLike(entry.draft));
        const activeId = characters.some((entry) => entry.id === parsed.activeId) ? parsed.activeId : characters[0]?.id ?? null;
        return { version: 1, activeId, characters };
      }
    }
  } catch {
    // bozuk kayit: asagida legacy anahtara dusulur
  }

  // Ilk acilis: eski tek karakteri roster'a tasi.
  try {
    const legacy = store.getItem(LEGACY_DRAFT_KEY);
    if (legacy) {
      const draft = JSON.parse(legacy) as CharacterDraft;
      if (isDraftLike(draft)) {
        const entry: RosterEntry = { id: newCharacterId(), updatedAt: new Date().toISOString(), draft };
        const roster: Roster = { version: 1, activeId: entry.id, characters: [entry] };
        writeRoster(roster);
        return roster;
      }
    }
  } catch {
    // yok say
  }
  return empty;
}

export function writeRoster(roster: Roster) {
  const store = storage();
  if (!store) {
    return;
  }
  try {
    store.setItem(ROSTER_KEY, JSON.stringify(roster));
    const active = roster.characters.find((entry) => entry.id === roster.activeId);
    if (active) {
      store.setItem(LEGACY_DRAFT_KEY, JSON.stringify(active.draft));
    } else {
      store.removeItem(LEGACY_DRAFT_KEY);
    }
  } catch {
    // kota dolu vb.: sessizce gec
  }
}

export function activeEntry(roster: Roster = readRoster()) {
  return roster.characters.find((entry) => entry.id === roster.activeId) ?? null;
}

/** Aktif karakteri kaydeder; aktif karakter yoksa yeni bir kayit acar. */
export function saveActiveDraft(draft: CharacterDraft) {
  const roster = readRoster();
  const now = new Date().toISOString();
  const index = roster.characters.findIndex((entry) => entry.id === roster.activeId);
  if (index >= 0) {
    roster.characters[index] = { ...roster.characters[index], draft, updatedAt: now };
  } else {
    const entry = { id: newCharacterId(), updatedAt: now, draft };
    roster.characters.push(entry);
    roster.activeId = entry.id;
  }
  writeRoster(roster);
}

export function setActiveCharacter(id: string) {
  const roster = readRoster();
  if (roster.characters.some((entry) => entry.id === id)) {
    writeRoster({ ...roster, activeId: id });
  }
}

/** Yeni bos karakter: aktif yapilir, creator bos taslakla acilir. */
export function createCharacter(draft: CharacterDraft) {
  const roster = readRoster();
  const entry: RosterEntry = { id: newCharacterId(), updatedAt: new Date().toISOString(), draft };
  writeRoster({ ...roster, activeId: entry.id, characters: [...roster.characters, entry] });
  return entry.id;
}

export function duplicateCharacter(id: string) {
  const roster = readRoster();
  const source = roster.characters.find((entry) => entry.id === id);
  if (!source) {
    return null;
  }
  const copy: RosterEntry = {
    id: newCharacterId(),
    updatedAt: new Date().toISOString(),
    draft: { ...structuredClone(source.draft), name: `${source.draft.name || "Character"} (copy)` },
  };
  const index = roster.characters.indexOf(source);
  const characters = [...roster.characters.slice(0, index + 1), copy, ...roster.characters.slice(index + 1)];
  writeRoster({ ...roster, characters });
  return copy.id;
}

export function deleteCharacter(id: string) {
  const roster = readRoster();
  const characters = roster.characters.filter((entry) => entry.id !== id);
  const activeId = roster.activeId === id ? characters[0]?.id ?? null : roster.activeId;
  writeRoster({ version: 1, activeId, characters });
}

export function buildExport(drafts: CharacterDraft[]): RosterExport {
  return { kind: "codex-characters", version: 1, exportedAt: new Date().toISOString(), characters: drafts };
}

/** Tek karakter JSON'u, roster export'u ya da karakter dizisi kabul eder. */
export function parseImport(text: string): CharacterDraft[] {
  const parsed = JSON.parse(text) as unknown;
  if (isDraftLike(parsed)) {
    return [parsed];
  }
  if (Array.isArray(parsed)) {
    return parsed.filter(isDraftLike);
  }
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as RosterExport).characters)) {
    return (parsed as RosterExport).characters.filter(isDraftLike);
  }
  return [];
}

/**
 * Iceri alinan karakterleri ekler. Ayni isimde karakter varsa onun yerine gecer
 * (oyuncu guncel JSON'unu tekrar gonderdiginde DM'de kopya birikmesin).
 * Donen id'ler iceri alinan karakterlerin sirasiyla id'leri.
 */
export function importCharacters(drafts: CharacterDraft[]) {
  const roster = readRoster();
  const now = new Date().toISOString();
  const characters = [...roster.characters];
  const ids = drafts.map((draft) => {
    const name = (draft.name || "").trim().toLowerCase();
    const index = name ? characters.findIndex((entry) => (entry.draft.name || "").trim().toLowerCase() === name) : -1;
    if (index >= 0) {
      characters[index] = { ...characters[index], draft, updatedAt: now };
      return characters[index].id;
    }
    const entry = { id: newCharacterId(), updatedAt: now, draft };
    characters.push(entry);
    return entry.id;
  });
  writeRoster({ version: 1, activeId: roster.activeId ?? ids[0] ?? null, characters });
  return ids;
}

export function downloadJson(fileName: string, data: unknown) {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function safeFileName(value: string) {
  return (value || "character").replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "character";
}
