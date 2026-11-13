"use client";

import { useState } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import { UsageDots } from "@/components/sheet-usage-tracker";
import type { SheetResource } from "@/components/sheet-resources-panel";
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

export function SheetCombatView({
  actions,
  resources,
  usedResources,
  onResourceChange,
  passives,
  stats,
}: {
  actions: CombatAction[];
  resources: SheetResource[];
  usedResources: Record<string, number>;
  onResourceChange: (resourceId: string, used: number) => void;
  passives: CombatPassive[];
  stats: Array<{ label: string; value: string; hint?: string }>;
}) {
  const grouped = GROUPS.map((group) => ({ ...group, items: actions.filter((action) => groupOf(action) === group.id) })).filter((group) => group.items.length);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const picked = actions.find((action) => action.id === pickedId) ?? grouped[0]?.items[0] ?? null;
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
        {resources.length ? (
          <div className="combat-resources">
            {resources.map((resource) => {
              const used = Math.min(usedResources[resource.id] ?? 0, resource.total);
              return (
                <div key={`combat-res-${resource.id}`} className="combat-resource">
                  <strong>{resource.name}</strong>
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
          {grouped.map((group) => (
            <div key={`combat-group-${group.id}`} className={`combat-group tone-${group.tone}`}>
              <div className="combat-group-head">
                <span className="combat-group-dot" aria-hidden="true" />
                <strong>{group.title}</strong>
                <span>{group.hint}</span>
              </div>
              <div className="combat-slots">
                {group.items.map((action) => {
                  const cost = costOf(action);
                  return (
                    <button
                      key={`combat-slot-${action.id}`}
                      type="button"
                      className={picked?.id === action.id ? "combat-slot picked" : "combat-slot"}
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
                <small>{`${picked.category === "Attack" ? "Attack · Action" : picked.category} · ${picked.source}`}</small>
                <strong>{picked.name}</strong>
              </span>
            </div>
            <p className="combat-detail-short">
              <Keywordize>{picked.short ?? firstSentence(picked.description)}</Keywordize>
            </p>
            <div className="combat-detail-stats">
              {[
                { label: picked.hit.startsWith("DC") ? "Save" : "Hit", value: picked.hit },
                { label: "Damage", value: picked.damage },
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
