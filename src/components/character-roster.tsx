"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { emptyDraft } from "@/lib/character/demo-sheet";
import {
  buildExport,
  createCharacter,
  deleteCharacter,
  downloadJson,
  duplicateCharacter,
  importCharacters,
  parseImport,
  readRoster,
  safeFileName,
  setActiveCharacter,
  type Roster,
} from "@/lib/character/roster";

/** Karakter listesi: olustur, kopyala, sil, sec; toplu JSON import/export. */
export function CharacterRoster() {
  const router = useRouter();
  // Roster sadece tarayicida okunur; version artinca yeniden okunur.
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [rosterVersion, setRosterVersion] = useState(0);
  const roster = useMemo<Roster | null>(() => (isClient && rosterVersion >= 0 ? readRoster() : null), [isClient, rosterVersion]);
  const reloadRoster = () => setRosterVersion((value) => value + 1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const refresh = reloadRoster;

  if (!roster) {
    return null;
  }

  const open = (id: string, target: "creator" | "sheet") => {
    setActiveCharacter(id);
    router.push(`/campaign/${target}`);
  };

  const exportCharacters = (ids: string[]) => {
    const entries = roster.characters.filter((entry) => ids.includes(entry.id));
    if (!entries.length) {
      return;
    }
    const fileName = entries.length === 1 ? `${safeFileName(entries[0].draft.name)}.json` : `party-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJson(fileName, buildExport(entries.map((entry) => entry.draft)));
  };

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    let added = 0;
    const failed: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const drafts = parseImport(await file.text());
        if (!drafts.length) {
          failed.push(file.name);
          continue;
        }
        importCharacters(drafts);
        added += drafts.length;
      } catch {
        failed.push(file.name);
      }
    }
    refresh();
    setMessage(
      `${added} character${added === 1 ? "" : "s"} imported.${failed.length ? ` Could not read: ${failed.join(", ")}.` : ""}`,
    );
  };

  const allSelected = roster.characters.length > 0 && selectedIds.length === roster.characters.length;

  return (
    <section className="sheet-card roster-card">
      <div className="roster-toolbar">
        <div>
          <h2>Characters</h2>
          <p>Saved in this browser. Import a JSON with the same character name to update it.</p>
        </div>
        <div className="roster-toolbar-actions">
          <button
            type="button"
            className="sheet-button"
            onClick={() => {
              createCharacter({ ...structuredClone(emptyDraft), name: "New Character" });
              router.push("/campaign/creator");
            }}
          >
            New Character
          </button>
          <button type="button" className="sheet-button secondary" onClick={() => importRef.current?.click()}>
            Import JSON
          </button>
          <button
            type="button"
            className="sheet-button secondary"
            disabled={!selectedIds.length}
            onClick={() => exportCharacters(selectedIds)}
          >
            {`Export selected (${selectedIds.length})`}
          </button>
          <button
            type="button"
            className="sheet-button secondary"
            disabled={!roster.characters.length}
            onClick={() => exportCharacters(roster.characters.map((entry) => entry.id))}
          >
            Export all
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            multiple
            className="visually-hidden"
            onChange={async (event) => {
              await importFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      {message ? <p className="roster-message">{message}</p> : null}

      {roster.characters.length ? (
        <>
          <label className="roster-select-all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelectedIds(allSelected ? [] : roster.characters.map((entry) => entry.id))}
            />
            <span>Select all</span>
          </label>
          <div className="roster-list">
            {roster.characters.map((entry) => {
              const active = entry.id === roster.activeId;
              const selected = selectedIds.includes(entry.id);
              return (
                <article key={entry.id} className={active ? "roster-item active" : "roster-item"}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${entry.draft.name || "character"}`}
                    checked={selected}
                    onChange={() =>
                      setSelectedIds((current) => (selected ? current.filter((id) => id !== entry.id) : [...current, entry.id]))
                    }
                  />
                  <div className="roster-item-main">
                    <strong>{entry.draft.name || "Unnamed"}</strong>
                    <span>
                      {[entry.draft.ancestry, entry.draft.classLine].filter(Boolean).join(" · ") || "Not built yet"}
                    </span>
                    <span className="roster-item-meta">
                      {active ? "Active · " : ""}
                      {`Updated ${new Date(entry.updatedAt).toLocaleString()}`}
                    </span>
                  </div>
                  <div className="roster-item-actions">
                    <button type="button" className="sheet-button secondary" onClick={() => open(entry.id, "creator")}>
                      Creator
                    </button>
                    <button type="button" className="sheet-button secondary" onClick={() => open(entry.id, "sheet")}>
                      Sheet
                    </button>
                    <button
                      type="button"
                      className="sheet-button secondary"
                      onClick={() => {
                        duplicateCharacter(entry.id);
                        refresh();
                      }}
                    >
                      Duplicate
                    </button>
                    <button type="button" className="sheet-button secondary" onClick={() => exportCharacters([entry.id])}>
                      Export
                    </button>
                    {pendingDeleteId === entry.id ? (
                      <>
                        <button
                          type="button"
                          className="sheet-button danger"
                          onClick={() => {
                            deleteCharacter(entry.id);
                            setPendingDeleteId(null);
                            setSelectedIds((current) => current.filter((id) => id !== entry.id));
                            refresh();
                          }}
                        >
                          Confirm delete
                        </button>
                        <button type="button" className="sheet-button secondary" onClick={() => setPendingDeleteId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="sheet-button secondary" onClick={() => setPendingDeleteId(entry.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="list-row">
          <strong>No characters yet</strong>
          <span>Create one, or import a JSON file from a player.</span>
        </div>
      )}
    </section>
  );
}
