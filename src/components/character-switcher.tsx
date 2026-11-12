"use client";

import { useEffect, useState } from "react";
import { readRoster, setActiveCharacter, type Roster } from "@/lib/character/roster";

/** Creator ve Sheet ust barinda: aktif karakteri degistirir. */
export function CharacterSwitcher() {
  const [roster, setRoster] = useState<Roster | null>(null);

  useEffect(() => {
    const refresh = () => setRoster(readRoster());
    refresh();
    // Dashboard karakteri kaydettikce isim degisebilir; ara ara ve sekme odaklaninca yenile.
    const timer = window.setInterval(refresh, 2000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  if (!roster || roster.characters.length < 2) {
    return null;
  }

  return (
    <div className="character-switcher">
      <select
        className="equipment-picker-select"
        aria-label="Active character"
        value={roster.activeId ?? ""}
        onChange={(event) => {
          setActiveCharacter(event.target.value);
          window.location.reload();
        }}
      >
        {roster.characters.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.draft.name || "Unnamed"}
          </option>
        ))}
      </select>
    </div>
  );
}
