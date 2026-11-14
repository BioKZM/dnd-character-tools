"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

/** Subclass karsilastirmasi: her yol bir sutun, satirlar subclass level'lari (yukaridan asagi). Feature'a tikla: sagda okunur. */
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
  const columns = `56px repeat(${paths.length}, minmax(168px, 1fr))`;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const selectedId = paths.find((path) => path.selected)?.id ?? null;
  // Secili yol gorunur alanda degilse yatayda ona kaydir (sayfayi dikeyde oynatmadan).
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) {
      return;
    }
    const place = () => {
      const target = box.querySelector<HTMLElement>(".stv-path.selected");
      const right = target ? target.offsetLeft + target.offsetWidth : 0;
      box.scrollLeft = right > box.clientWidth ? right - box.clientWidth + 8 : 0;
    };
    place();
    // Panel genisligi ilk boyamadan sonra oturuyor; o an bir kez daha yerlestir.
    const observer = new ResizeObserver(place);
    observer.observe(box);
    const stop = window.setTimeout(() => observer.disconnect(), 1500);
    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, [selectedId]);
  return (
    <div className="subclass-tree vertical" role="group" aria-label="Subclass paths">
      <div className="stv-scroll" ref={scrollRef}>
        <div className="stv-grid" style={{ gridTemplateColumns: columns, width: `max(100%, ${64 + paths.length * 176}px)` }}>
          <span className="stv-corner">{heading}</span>
          {paths.map((path) => (
            <div key={`head-${path.id}`} className={path.selected ? "stv-path selected" : "stv-path"}>
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
          ))}
          {levels.map((lv) => (
            <div key={`row-${lv}`} className="stv-row" style={{ display: "contents" }}>
              <span className={lv <= level ? "stv-level reached" : "stv-level"}>
                <small>Lv</small>
                {lv}
              </span>
              {paths.map((path) => (
                <div key={`${path.id}-${lv}`} className={`stv-cell${lv <= level ? " reached" : ""}${path.selected ? " selected" : ""}`}>
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
      </div>
      {paths.length > 5 ? <p className="stv-hint">{`${paths.length} paths · scroll sideways to see them all`}</p> : null}
    </div>
  );
}
