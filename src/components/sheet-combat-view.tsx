"use client";

import { useState } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import { UsageDots } from "@/components/sheet-usage-tracker";
import type { SheetResource } from "@/components/sheet-resources-panel";
import type { SheetSpellEntry } from "@/components/sheet-spells-panel";
import type { SpellcastingProfile } from "@/lib/engine/spellcasting";
import { featureIcon, schoolIcon, weaponIcon, type GameIconName } from "@/lib/ui/game-icons";
import type { FeatureFacts } from "@/lib/content/schema";

// Savas gorunumu (canvas "Sheet: savas gorunumu" taslagi): eylemler kisayol cubugu gibi
// Action / Bonus Action / Reaction / On hit gruplarinda; sagda secili eylemin sayilari.

export type CombatAction = {
  id: string;
  name: string;
  category: "Attack" | "Action" | "Bonus Action" | "Reaction" | "Other";
  range: string;
  hit: string;
  damage: string;
  notes: string;
  description: string;
  source: string;
  classes?: string[];
  short?: string;
  facts?: FeatureFacts;
  formula?: { hit?: string; damage?: string };
};

export type CombatPassive = { id: string; name: string; short?: string; summary: string };

type GroupId = "action" | "bonus" | "reaction" | "onhit" | "other";

const GROUPS: Array<{ id: GroupId; title: string; hint: string; tone: string }> = [
  { id: "action", title: "Action", hint: "One per turn: attack, cast or dash", tone: "action" },
  { id: "bonus", title: "Bonus Action", hint: "One per turn, if something gives you one", tone: "bonus" },
  { id: "reaction", title: "Reaction", hint: "One per round, on someone else's turn too", tone: "reaction" },
  { id: "onhit", title: "On hit", hint: "Extra effects when an attack lands", tone: "onhit" },
  { id: "other", title: "Other", hint: "Longer casts and special timing", tone: "other" },
];

const isSpell = (action: CombatAction) => Array.isArray(action.classes);

function groupOf(action: CombatAction): GroupId {
  const text = `${action.short ?? ""} ${action.description}`;
  if (action.category !== "Attack" && !isSpell(action) && /\bon a hit\b|when you hit|hit (a creature|a target)? ?with a (melee )?weapon|on a melee hit/i.test(text)) {
    return "onhit";
  }
  if (action.category === "Attack" || action.category === "Action") {
    return "action";
  }
  if (action.category === "Bonus Action") {
    return "bonus";
  }
  if (action.category === "Reaction") {
    return "reaction";
  }
  return "other";
}

function iconOf(action: CombatAction): GameIconName {
  if (action.id === "unarmed-strike") {
    return "fist";
  }
  if (action.id.startsWith("weapon-")) {
    return weaponIcon(action.name);
  }
  if (isSpell(action)) {
    return schoolIcon(action.notes.split("|")[0]);
  }
  return featureIcon(action.name);
}

function costOf(action: CombatAction) {
  const cost = action.facts?.cost ?? "";
  const match = cost.match(/(\d+)\s*ki/i);
  if (match) {
    return `${match[1]} ki`;
  }
  if (isSpell(action)) {
    const level = action.notes.match(/level (\d)/i)?.[1];
    return level ? `L${level}` : null;
  }
  return cost && cost.length <= 8 ? cost : null;
}

function firstSentence(text: string) {
  const sentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return sentence.length > 220 ? `${sentence.slice(0, 217).trimEnd()}...` : sentence;
}

const ORDINAL = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

/** "increases by 1d8 for each slot level above 1st" gibi satirlardan upcast hasari. */
function upcastDamage(spell: SheetSpellEntry, castLevel: number) {
  if (castLevel <= spell.level || spell.damage === "-") {
    return spell.damage;
  }
  const step = `${spell.atHigherLevels ?? ""} ${spell.summary}`.match(/(\d+)d(\d+)\s+for each (?:spell )?slot level above/i);
  const base = spell.damage.match(/^(\d+)d(\d+)(.*)$/);
  if (!step || !base || step[2] !== base[2]) {
    return spell.damage;
  }
  const dice = Number(base[1]) + Number(step[1]) * (castLevel - spell.level);
  return `${dice}d${base[2]}${base[3]}`;
}

type FilterId = "all" | "weapons" | "spells" | "features";

export function SheetCombatView({
  actions: rawActions,
  resources,
  usedResources,
  onResourceChange,
  passives,
  stats,
  spells = [],
  slotProfiles = [],
  usedSlots = {},
  onSlotChange,
  concentration = null,
  onConcentration,
  onLog,
}: {
  actions: CombatAction[];
  resources: SheetResource[];
  usedResources: Record<string, number>;
  onResourceChange: (resourceId: string, used: number) => void;
  passives: CombatPassive[];
  stats: Array<{ label: string; value: string; hint?: string }>;
  spells?: SheetSpellEntry[];
  slotProfiles?: SpellcastingProfile[];
  usedSlots?: Record<string, number>;
  onSlotChange?: (slotKey: string, used: number) => void;
  concentration?: string | null;
  onConcentration?: (spellName: string | null) => void;
  onLog?: (message: string) => void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const spellByName = new Map(spells.map((spell) => [spell.name.toLowerCase(), spell]));
  const spellOf = (action: CombatAction) => (isSpell(action) ? spellByName.get(action.name.toLowerCase()) ?? null : null);
  // "Spellcasting" ozelligi bir eylem degil; buyuler zaten tek tek listede.
  const actions = rawActions
    .filter((action) => !/^spellcasting$/i.test(action.name))
    .filter((action) =>
      filter === "all"
        ? true
        : filter === "spells"
          ? isSpell(action)
          : filter === "weapons"
            ? action.category === "Attack" && !isSpell(action)
            : !isSpell(action) && action.category !== "Attack",
    );
  const slots = slotProfiles.flatMap((profile) => profile.slots.map((slot) => ({ ...slot, key: `${slot.kind}-${slot.level}` })));
  const slotsLeft = (key: string, total: number) => total - Math.min(usedSlots[key] ?? 0, total);
  /** Bu seviyede (veya ustunde) atilabilecek slot var mi; pact slotlari kendi seviyesinde sayilir. */
  const castableLevels = (spell: SheetSpellEntry) =>
    [...new Set(slots.filter((slot) => slot.level >= spell.level && slotsLeft(slot.key, slot.total) > 0).map((slot) => slot.level))].sort((left, right) => left - right);
  const [castLevelChoice, setCastLevelChoice] = useState<Record<string, number>>({});
  const [lastCast, setLastCast] = useState<{ key: string; used: number; concentration: string | null; name: string } | null>(null);
  const grouped = GROUPS.map((group) => ({ ...group, items: actions.filter((action) => groupOf(action) === group.id) })).filter((group) => group.items.length);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const picked = actions.find((action) => action.id === pickedId) ?? grouped[0]?.items[0] ?? null;
  const pickedSpell = picked ? spellOf(picked) : null;
  const pickedLevels = pickedSpell && pickedSpell.level > 0 ? castableLevels(pickedSpell) : [];
  const castLevel = pickedSpell ? (pickedLevels.includes(castLevelChoice[pickedSpell.id] ?? -1) ? castLevelChoice[pickedSpell.id] : pickedLevels[0] ?? pickedSpell.level) : 0;

  const cast = () => {
    if (!pickedSpell) {
      return;
    }
    if (pickedSpell.level > 0) {
      // Once normal slot, yoksa ayni seviyedeki pact slotu.
      const slot =
        slots.find((entry) => entry.kind !== "pact" && entry.level === castLevel && slotsLeft(entry.key, entry.total) > 0) ??
        slots.find((entry) => entry.level === castLevel && slotsLeft(entry.key, entry.total) > 0);
      if (!slot || !onSlotChange) {
        return;
      }
      const used = Math.min(usedSlots[slot.key] ?? 0, slot.total);
      setLastCast({ key: slot.key, used, concentration, name: pickedSpell.name });
      onSlotChange(slot.key, used + 1);
    } else {
      setLastCast(null);
    }
    if (pickedSpell.concentration) {
      onConcentration?.(pickedSpell.name);
    }
    onLog?.(`Cast ${pickedSpell.name}${pickedSpell.level > 0 ? ` (${ORDINAL[castLevel]} level slot)` : ""}`);
  };
  const undo = () => {
    if (!lastCast) {
      return;
    }
    onSlotChange?.(lastCast.key, lastCast.used);
    onConcentration?.(lastCast.concentration);
    onLog?.(`Undid ${lastCast.name}`);
    setLastCast(null);
  };
  const [passiveOpen, setPassiveOpen] = useState<string | null>(null);
  const passive = passives.find((entry) => entry.id === passiveOpen) ?? null;

  return (
    <section className="combat-view" aria-label="Combat view">
      <div className="combat-strip">
        <div className="combat-stats">
          {stats.map((stat) => (
            <span key={`combat-stat-${stat.label}`} className="combat-stat" title={stat.hint}>
              <small>{stat.label}</small>
              <b>{stat.value}</b>
            </span>
          ))}
        </div>
        {concentration ? (
          <div className="combat-concentration">
            <span>Concentrating</span>
            <strong>{concentration}</strong>
            <button type="button" onClick={() => onConcentration?.(null)}>
              End
            </button>
          </div>
        ) : null}
        {slots.length ? (
          <div className="combat-resources">
            {slots.map((slot) => {
              const used = Math.min(usedSlots[slot.key] ?? 0, slot.total);
              return (
                <div key={`combat-slot-pool-${slot.key}`} className="combat-resource spell">
                  <strong>{slot.kind === "pact" ? `Pact ${ORDINAL[slot.level]}` : `${ORDINAL[slot.level]} slots`}</strong>
                  <UsageDots total={slot.total} used={used} label={slot.key} onChange={(next) => onSlotChange?.(slot.key, next)} />
                </div>
              );
            })}
          </div>
        ) : null}
        {resources.length ? (
          <div className="combat-resources">
            {resources.map((resource) => {
              const used = Math.min(usedResources[resource.id] ?? 0, resource.total);
              return (
                <div key={`combat-res-${resource.id}`} className="combat-resource">
                  {(() => {
                    // Kaynagin geldigi ozellik (Sorcery Points -> Font of Magic): ada tiklayinca sagda aciklamasi acilir.
                    const owner = rawActions.find((action) => action.name.toLowerCase() === resource.source.toLowerCase() || action.name.toLowerCase() === resource.name.toLowerCase());
                    return owner ? (
                      <button
                        type="button"
                        className="combat-resource-name"
                        title={`What is ${owner.name}?`}
                        onClick={() => {
                          setFilter("all");
                          setPickedId(owner.id);
                        }}
                      >
                        {resource.name}
                        <span aria-hidden="true">?</span>
                      </button>
                    ) : (
                      <strong>{resource.name}</strong>
                    );
                  })()}
                  {resource.total <= 12 ? (
                    <UsageDots total={resource.total} used={used} label={resource.name} onChange={(next) => onResourceChange(resource.id, next)} />
                  ) : (
                    <span className="combat-resource-pool">
                      <button type="button" aria-label={`Spend 1 ${resource.name}`} onClick={() => onResourceChange(resource.id, Math.min(resource.total, used + 1))}>
                        −
                      </button>
                      <button type="button" aria-label={`Restore 1 ${resource.name}`} onClick={() => onResourceChange(resource.id, Math.max(0, used - 1))}>
                        +
                      </button>
                    </span>
                  )}
                  <span>{`${resource.total - used} / ${resource.total} · ${resource.recharge === "short_rest" ? "short rest" : "long rest"}`}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {passives.length ? (
        <div className="combat-passives">
          <span className="combat-label">Always on</span>
          {passives.map((entry) => (
            <button
              key={`combat-passive-${entry.id}`}
              type="button"
              className={passiveOpen === entry.id ? "combat-passive active" : "combat-passive"}
              onClick={() => setPassiveOpen(passiveOpen === entry.id ? null : entry.id)}
            >
              <GameIcon name={featureIcon(entry.name)} />
              {entry.name}
            </button>
          ))}
          {passive ? (
            <p className="combat-passive-detail">
              <strong>{`${passive.name}: `}</strong>
              <Keywordize>{passive.short ?? firstSentence(passive.summary)}</Keywordize>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="combat-main">
        <div className="combat-hotbar">
          <div className="pick-filters combat-filters" role="group" aria-label="Show">
            {(
              [
                ["all", "All"],
                ["weapons", "Weapons"],
                ["spells", "Spells"],
                ["features", "Features"],
              ] as const
            ).map(([id, label]) => (
              <button key={`combat-filter-${id}`} type="button" className={filter === id ? "pick-filter active" : "pick-filter"} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
          {grouped.map((group) => (
            <div key={`combat-group-${group.id}`} className={`combat-group tone-${group.tone}`}>
              <div className="combat-group-head">
                <span className="combat-group-dot" aria-hidden="true" />
                <strong>{group.title}</strong>
                <span>{group.hint}</span>
              </div>
              <div className="combat-slots">
                {group.items.map((action) => {
                  const spell = spellOf(action);
                  const cost = spell ? (spell.level === 0 ? "C" : String(spell.level)) : costOf(action);
                  const spent = Boolean(spell && spell.level > 0 && slots.length && !castableLevels(spell).length);
                  return (
                    <button
                      key={`combat-slot-${action.id}`}
                      type="button"
                      className={`combat-slot${picked?.id === action.id ? " picked" : ""}${spell ? " spell" : ""}${spent ? " spent" : ""}`}
                      title={spent ? "No spell slots left for this level" : undefined}
                      aria-label={spell ? `${action.name}, ${spell.level === 0 ? "cantrip" : `level ${spell.level}`}` : action.name}
                      aria-pressed={picked?.id === action.id}
                      onClick={() => {
                        setPickedId(action.id);
                        setShowFull(false);
                      }}
                    >
                      <span className="combat-slot-tile">
                        <GameIcon name={iconOf(action)} />
                        {cost ? <span className="combat-slot-cost">{cost}</span> : null}
                      </span>
                      <span className="combat-slot-name">{action.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!grouped.length ? <p className="pick-note">No actions yet. Add weapons to your inventory or learn spells.</p> : null}
        </div>

        {picked ? (
          <aside className="combat-detail" aria-label={`${picked.name} details`}>
            <div className="combat-detail-head">
              <span className="combat-detail-icon">
                <GameIcon name={iconOf(picked)} />
              </span>
              <span>
                <small>
                  {pickedSpell
                    ? `${pickedSpell.level === 0 ? "Cantrip" : `${ORDINAL[pickedSpell.level]} level`} ${pickedSpell.school.toLowerCase()} · ${pickedSpell.castingTime}`
                    : `${picked.category === "Attack" ? "Attack · Action" : picked.category} · ${picked.source}`}
                </small>
                <strong>{picked.name}</strong>
              </span>
            </div>
            <p className="combat-detail-short">
              <Keywordize>{picked.short ?? firstSentence(picked.description)}</Keywordize>
            </p>
            <div className="combat-detail-stats">
              {[
                { label: picked.hit.startsWith("DC") ? "Save" : "Hit", value: picked.hit },
                { label: "Damage", value: pickedSpell ? upcastDamage(pickedSpell, castLevel) : picked.damage },
                ...(pickedSpell ? [{ label: "Lasts", value: pickedSpell.duration.replace(/^concentration,\s*/i, "").replace(/^up to /i, "") }] : []),
                { label: "Range", value: picked.range },
                ...(picked.facts?.uses ? [{ label: "Uses", value: picked.facts.uses }] : []),
                ...(picked.facts?.cost ? [{ label: "Cost", value: picked.facts.cost }] : []),
                ...(picked.facts?.duration ? [{ label: "Lasts", value: picked.facts.duration }] : []),
              ]
                .filter((cell) => cell.value && cell.value !== "-")
                .slice(0, 6)
                .map((cell) => (
                  <span key={`combat-detail-${cell.label}`}>
                    <small>{cell.label}</small>
                    <b>{cell.value}</b>
                  </span>
                ))}
            </div>
            {pickedSpell ? (
              <div className="combat-cast">
                {pickedSpell.concentration || pickedSpell.ritual ? (
                  <div className="combat-detail-tags">
                    {pickedSpell.concentration ? <span className="conc">Concentration</span> : null}
                    {pickedSpell.ritual ? <span>Ritual</span> : null}
                  </div>
                ) : null}
                {pickedSpell.level > 0 && pickedLevels.length > 1 ? (
                  <div className="combat-cast-levels" role="group" aria-label="Cast at level">
                    <small>Cast with a</small>
                    {pickedLevels.map((level) => (
                      <button
                        key={`cast-level-${level}`}
                        type="button"
                        className={level === castLevel ? "pick-filter active" : "pick-filter"}
                        onClick={() => setCastLevelChoice((state) => ({ ...state, [pickedSpell.id]: level }))}
                      >
                        {`${ORDINAL[level]} slot`}
                      </button>
                    ))}
                  </div>
                ) : null}
                {pickedSpell.concentration && concentration && concentration !== pickedSpell.name ? (
                  <p className="inspect-warning">{`Casting this ends your concentration on ${concentration}.`}</p>
                ) : null}
                <div className="combat-cast-row">
                  <button
                    type="button"
                    className="combat-cast-button"
                    disabled={pickedSpell.level > 0 && slots.length > 0 && !pickedLevels.length}
                    onClick={cast}
                  >
                    {pickedSpell.level === 0 ? "Cast cantrip" : pickedLevels.length || !slots.length ? `Cast (${ORDINAL[castLevel]} slot)` : "No slots left"}
                  </button>
                  {lastCast ? (
                    <button type="button" className="combat-undo" onClick={undo}>
                      {`Undo ${lastCast.name}`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {picked.formula?.hit || picked.formula?.damage ? (
              <div className="combat-detail-formula">
                {picked.formula.hit ? <span>{`Hit: ${picked.formula.hit}`}</span> : null}
                {picked.formula.damage ? <span>{`Damage: ${picked.formula.damage}`}</span> : null}
              </div>
            ) : null}
            {picked.notes && picked.notes !== "-" && !isSpell(picked) && !picked.notes.includes("|") ? (
              <div className="combat-detail-tags">
                {picked.notes.split(/,\s*/).map((tag) => (
                  <span key={`combat-tag-${tag}`}>{tag}</span>
                ))}
              </div>
            ) : null}
            {picked.description && picked.description !== (picked.short ?? "") ? (
              <>
                <button type="button" className="inspect-toggle" aria-expanded={showFull} onClick={() => setShowFull((value) => !value)}>
                  {showFull ? "Hide full rules" : "Show full rules"}
                </button>
                {showFull ? (
                  <p className="combat-detail-full">
                    <Keywordize>{picked.description}</Keywordize>
                  </p>
                ) : null}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
