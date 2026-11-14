"use client";

import type { ReactNode } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import type { GameIconName } from "@/lib/ui/game-icons";

// Canvas "Class yolu" taslagi, panele sigsin diye dikey: satirlar level, sutunlar seritler (Class / Choices / Path).
// Altin cerceve: sende var. Kesik: bir sonraki level. Gri: daha sonra. Elmas: senin yaptigin bir secim.

export type PathNode = {
  id: string;
  lane: string;
  level: number;
  name: string;
  icon: GameIconName;
  /** Secim (ASI, subclass, fighting style...): elmas seklinde. */
  diamond?: boolean;
  /** Var olan bir ozelligin guclenmesi (or. Rage 3 -> 4 kullanim): kucuk cizilir. */
  minor?: boolean;
  note?: string;
};

export type PathLane = { id: string; title: string; hint?: string };

export function LevelPath({
  level,
  lanes,
  nodes,
  inspectedId,
  onInspect,
  maxLevel = 20,
}: {
  level: number;
  lanes: PathLane[];
  nodes: PathNode[];
  inspectedId?: string | null;
  onInspect: (id: string) => void;
  maxLevel?: number;
}) {
  const levels = Array.from({ length: maxLevel }, (_, index) => index + 1);
  const columns = `44px repeat(${lanes.length}, minmax(0, 1fr))`;
  return (
    <div className="level-path" role="group" aria-label="Level path">
      <div className="lp-row lp-head" style={{ gridTemplateColumns: columns }}>
        <span className="lp-head-cell">Lv</span>
        {lanes.map((lane) => (
          <span key={`lane-${lane.id}`} className="lp-head-cell">
            <strong>{lane.title}</strong>
            {lane.hint ? <small>{lane.hint}</small> : null}
          </span>
        ))}
      </div>
      {levels.map((lv) => {
        const rowNodes = nodes.filter((node) => node.level === lv);
        const state = lv <= level ? "owned" : lv === level + 1 ? "next" : "future";
        return (
          <div key={`lp-${lv}`} className={`lp-row ${state}${rowNodes.length ? "" : " empty"}${lv === level ? " current" : ""}`} style={{ gridTemplateColumns: columns }}>
            <span className="lp-level">{lv}</span>
            {lanes.map((lane) => (
              <div key={`lp-${lv}-${lane.id}`} className="lp-cell">
                {rowNodes
                  .filter((node) => node.lane === lane.id)
                  .map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={`lp-node${node.diamond ? " diamond" : ""}${node.minor ? " minor" : ""}${inspectedId === node.id ? " picked" : ""}`}
                      onClick={() => onInspect(node.id)}
                    >
                      <span className="lp-rune">
                        <GameIcon name={node.icon} />
                      </span>
                      <span className="lp-name">
                        {node.name}
                        {node.note ? <small>{node.note}</small> : null}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        );
      })}
      <div className="lp-legend">
        <span>
          <i className="lp-key owned" /> You have it
        </span>
        <span>
          <i className="lp-key next" /> Next level
        </span>
        <span>
          <i className="lp-key future" /> Later
        </span>
        <span>
          <i className="lp-key minor" /> Gets stronger
        </span>
        <span>
          <i className="lp-key diamond" /> A choice you make
        </span>
      </div>
    </div>
  );
}

export type TreePath = {
  id: string;
  name: string;
  line?: string;
  icon: GameIconName;
  selected?: boolean;
  /** level -> o levelde acilan feature'lar */
  features: Array<{ id: string; level: number; name: string; icon: GameIconName }>;
};

/** Subclass karsilastirmasi: her yol bir satir, sutunlar subclass level'lari. Feature'a tikla: sagda okunur. */
export function SubclassTree({
  paths,
  levels,
  level,
  inspectedId,
  onInspect,
  onChoose,
  heading,
}: {
  paths: TreePath[];
  levels: number[];
  level: number;
  inspectedId?: string | null;
  onInspect: (id: string) => void;
  onChoose: (pathId: string) => void;
  heading: ReactNode;
}) {
  const columns = `minmax(150px, 0.9fr) repeat(${levels.length}, minmax(0, 1fr))`;
  return (
    <div className="subclass-tree" role="group" aria-label="Subclass paths">
      <div className="st-row st-head" style={{ gridTemplateColumns: columns }}>
        <span className="st-head-cell">{heading}</span>
        {levels.map((lv) => (
          <span key={`st-lv-${lv}`} className={lv <= level ? "st-head-cell reached" : "st-head-cell"}>{levels.length > 4 ? `Lv ${lv}` : `Level ${lv}`}</span>
        ))}
      </div>
      {paths.map((path) => (
        <div key={path.id} className={path.selected ? "st-row selected" : "st-row"} style={{ gridTemplateColumns: columns }}>
          <div className="st-path">
            <button type="button" className="st-path-head" onClick={() => onInspect(`path:${path.id}`)}>
              <span className="st-path-icon">
                <GameIcon name={path.icon} />
              </span>
              <span className="st-path-text">
                <strong>{path.name}</strong>
                {path.line ? <small>{path.line}</small> : null}
              </span>
            </button>
            <button type="button" className={path.selected ? "st-choose on" : "st-choose"} onClick={() => onChoose(path.id)} aria-pressed={Boolean(path.selected)}>
              {path.selected ? "✓ Your path" : "Choose"}
            </button>
          </div>
          {levels.map((lv) => (
            <div key={`${path.id}-${lv}`} className={lv <= level ? "st-cell reached" : "st-cell"}>
              {path.features
                .filter((feature) => feature.level === lv)
                .map((feature) => (
                  <button
                    key={feature.id}
                    type="button"
                    className={inspectedId === `${path.id}:${feature.id}` ? "st-node picked" : "st-node"}
                    onClick={() => onInspect(`${path.id}:${feature.id}`)}
                  >
                    <GameIcon name={feature.icon} />
                    <span>{feature.name}</span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
