"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { computeCharacterView, type CharacterCatalogProps } from "@/components/party-room-dashboard";
import { importCharacters, parseImport, readRoster, setActiveCharacter, type Roster } from "@/lib/character/roster";

const SLOT_LABELS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function signed(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Masadaki tum karakterlerin savas icin gereken degerleri tek ekranda. */
export function DmScreen(catalog: CharacterCatalogProps) {
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
  const [message, setMessage] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);


  const views = useMemo(
    () =>
      (roster?.characters ?? []).map((entry) => {
        try {
          return { entry, view: computeCharacterView(catalog, entry.draft), error: null as string | null };
        } catch (error) {
          return { entry, view: null, error: error instanceof Error ? error.message : "Could not build" };
        }
      }),
    [roster, catalog],
  );

  if (!roster) {
    return null;
  }

  const importFiles = async (files: FileList | null) => {
    if (!files?.length) {
      return;
    }
    let count = 0;
    for (const file of Array.from(files)) {
      try {
        const drafts = parseImport(await file.text());
        importCharacters(drafts);
        count += drafts.length;
      } catch {
        // okunamayan dosya atlanir
      }
    }
    reloadRoster();
    setMessage(`${count} character${count === 1 ? "" : "s"} imported or updated.`);
  };

  return (
    <section className="dm-screen">
      <div className="roster-toolbar">
        <div>
          <h2>DM Screen</h2>
          <p>Players send their JSON from the Sheet (Export JSON); import it here. Same name updates the existing card.</p>
        </div>
        <div className="roster-toolbar-actions">
          <button type="button" className="sheet-button secondary" onClick={() => importRef.current?.click()}>
            Import player JSON
          </button>
          <button type="button" className="sheet-button secondary" onClick={() => reloadRoster()}>
            Refresh
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

      {!views.length ? (
        <div className="list-row">
          <strong>No characters</strong>
          <span>Import your players&apos; JSON files to see them here.</span>
        </div>
      ) : null}

      <div className="dm-grid">
        {views.map(({ entry, view, error }) => {
          if (!view) {
            return (
              <article key={entry.id} className="dm-card">
                <strong>{entry.draft.name || "Unnamed"}</strong>
                <span className="feat-requirement-unmet">{error}</span>
              </article>
            );
          }
          const { sheetDraft, sheetContent, currentHp } = view;
          const passive = (id: string) => sheetDraft.senses.find((sense) => sense.id === id)?.value ?? 10;
          const caster = sheetContent.spellcasting.at(0) ?? null;
          const slots = sheetContent.spellcasting.flatMap((profile) => profile.slots);
          const usedSlots = sheetDraft.usedSlots ?? {};
          const usedResources = sheetDraft.usedResources ?? {};
          const hpRatio = sheetDraft.maxHp ? currentHp / sheetDraft.maxHp : 1;
          const tempHp = sheetDraft.tempHp ?? 0;
          const senses = sheetDraft.senses.filter((sense) => !["perception", "investigation", "insight"].includes(sense.id));
          return (
            <article key={entry.id} className="dm-card">
              <header className="dm-card-head">
                <button
                  type="button"
                  className="dm-card-name"
                  onClick={() => {
                    setActiveCharacter(entry.id);
                    router.push("/campaign/sheet");
                  }}
                >
                  {sheetDraft.name || "Unnamed"}
                </button>
                <span>{`${sheetContent.speciesName} ${sheetDraft.classLine}`}</span>
              </header>

              <div className="dm-card-vitals">
                <div className={hpRatio <= 0.25 ? "dm-stat danger" : hpRatio <= 0.5 ? "dm-stat warn" : "dm-stat"}>
                  <span>HP</span>
                  <strong>{`${currentHp}/${sheetDraft.maxHp}`}</strong>
                  {tempHp ? <small>{`+${tempHp} temp`}</small> : null}
                </div>
                <div className="dm-stat">
                  <span>AC</span>
                  <strong>{sheetDraft.armorClass}</strong>
                </div>
                <div className="dm-stat">
                  <span>Init</span>
                  <strong>{signed(sheetDraft.initiative)}</strong>
                </div>
                <div className="dm-stat">
                  <span>Speed</span>
                  <strong>{sheetContent.derivedStats.walkingSpeed.displayValue}</strong>
                </div>
              </div>

              <div className="dm-row">
                <span>{`Passive Perception ${passive("perception")}`}</span>
                <span>{`Insight ${passive("insight")}`}</span>
                <span>{`Investigation ${passive("investigation")}`}</span>
              </div>

              <div className="dm-saves">
                {sheetDraft.savingThrows.map((save) => (
                  <span key={save.ability} className={save.proficient ? "dm-save proficient" : "dm-save"}>
                    {`${save.ability} ${signed(save.bonus)}`}
                  </span>
                ))}
              </div>

              {sheetContent.saveDcs.length || sheetContent.martialArtsDie ? (
                <div className="dm-row">
                  {sheetContent.martialArtsDie ? <span>{`Martial Arts ${sheetContent.martialArtsDie}`}</span> : null}
                  {sheetContent.saveDcs.map((entry) => (
                    <span key={entry.name}>{`${entry.name} DC ${entry.value}`}</span>
                  ))}
                </div>
              ) : null}

              {caster ? (
                <div className="dm-row">
                  <span>{`Spell DC ${caster.saveDc}`}</span>
                  <span>{`Attack ${signed(caster.attackBonus)}`}</span>
                  <span>{caster.ability}</span>
                </div>
              ) : null}

              {slots.length ? (
                <div className="dm-row dm-slots">
                  {slots.map((slot) => {
                    const key = `${slot.kind}-${slot.level}`;
                    const left = Math.max(0, slot.total - (usedSlots[key] ?? 0));
                    return (
                      <span key={key} className={left === 0 ? "dm-pill empty" : "dm-pill"}>
                        {`${slot.kind === "pact" ? `Pact ${SLOT_LABELS[slot.level]}` : SLOT_LABELS[slot.level]} ${left}/${slot.total}`}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              {sheetContent.resources.length ? (
                <div className="dm-row dm-slots">
                  {sheetContent.resources.map((resource) => {
                    const left = Math.max(0, resource.total - (usedResources[resource.id] ?? 0));
                    return (
                      <span key={resource.id} className={left === 0 ? "dm-pill empty" : "dm-pill"}>
                        {`${resource.name} ${left}/${resource.total}`}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              {senses.length || sheetDraft.defenses.length || sheetDraft.conditions.length ? (
                <div className="dm-notes">
                  {senses.map((sense) => (
                    <span key={sense.id}>{`${sense.label} ${sense.value} ft.`}</span>
                  ))}
                  {sheetDraft.defenses.map((defense) => (
                    <span key={defense}>{defense}</span>
                  ))}
                  {sheetDraft.conditions.map((condition) => (
                    <span key={condition} className="feat-requirement-unmet">
                      {condition}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
