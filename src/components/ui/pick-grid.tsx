"use client";

import { useState, type ReactNode } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import type { GameIconName } from "@/lib/ui/game-icons";

// Creator'in ortak secim kalibi: ikon + isim ızgarasi, sagda tek inceleme paneli.

export type PickTile = {
  id: string;
  name: string;
  sub?: string;
  icon: GameIconName;
  selected?: boolean;
  /** Secilemez; nedeni lockReason. */
  locked?: boolean;
  lockReason?: string;
  /** Zaten sende (sadece gosterim, secim yok). */
  owned?: boolean;
  /** Soluk gosterilir ama tiklanabilir (or. ileride acilacak). */
  dim?: boolean;
};

export function PickGrid({
  items,
  columns = 4,
  onPick,
  onInspect,
  inspectedId,
  label,
  size = "md",
  pageSize,
}: {
  items: PickTile[];
  columns?: number;
  onPick?: (id: string) => void;
  onInspect?: (id: string) => void;
  inspectedId?: string | null;
  label: string;
  size?: "sm" | "md";
  /** Verilirse uzun listeler sayfalanir (sayfa basina bu kadar kart). */
  pageSize?: number;
}) {
  const [rawPage, setPage] = useState(0);
  const pageCount = pageSize ? Math.max(1, Math.ceil(items.length / pageSize)) : 1;
  const page = Math.min(rawPage, pageCount - 1);
  const shown = pageSize ? items.slice(page * pageSize, page * pageSize + pageSize) : items;
  return (
    <div className="pick-grid-wrap">
    <div className={`pick-grid pick-grid-${size}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }} aria-label={label} role="group">
      {shown.map((item) => {
        const classes = [
          "pick-tile",
          item.selected ? "selected" : "",
          item.locked ? "locked" : "",
          item.owned ? "owned" : "",
          item.dim ? "dim" : "",
          inspectedId === item.id ? "inspected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={item.id}
            type="button"
            className={classes}
            aria-pressed={onPick && !item.owned ? Boolean(item.selected) : undefined}
            aria-disabled={item.locked || undefined}
            title={item.locked && item.lockReason ? item.lockReason : undefined}
            onClick={() => {
              onInspect?.(item.id);
              if (!item.locked && !item.owned) {
                onPick?.(item.id);
              }
            }}
          >
            {item.locked ? <GameIcon name="padlock" className="pick-tile-lock" /> : null}
            {item.selected ? <GameIcon name="check-mark" className="pick-tile-check" /> : null}
            <span className="pick-tile-icon">
              <GameIcon name={item.icon} />
            </span>
            <span className="pick-tile-name">{item.name}</span>
            {item.locked && item.lockReason ? (
              <span className="pick-tile-sub lock">{item.lockReason}</span>
            ) : item.sub ? (
              <span className="pick-tile-sub">{item.sub}</span>
            ) : null}
          </button>
        );
      })}
    </div>
    {pageCount > 1 ? (
      <nav className="pick-pager" aria-label={`${label} pages`}>
        <button type="button" className="pick-filter" disabled={page === 0} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span className="pick-pager-dots">
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={`${label}-page-${index}`}
              type="button"
              className={index === page ? "pick-pager-dot active" : "pick-pager-dot"}
              aria-label={`Page ${index + 1}`}
              aria-current={index === page ? "page" : undefined}
              onClick={() => setPage(index)}
            >
              {pageCount <= 12 ? index + 1 : ""}
            </button>
          ))}
        </span>
        <span className="pick-pager-count">{`${page * (pageSize ?? 0) + 1}-${Math.min(items.length, (page + 1) * (pageSize ?? 0))} of ${items.length}`}</span>
        <button type="button" className="pick-filter" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </nav>
    ) : null}
    </div>
  );
}

export function PickSection({
  title,
  meta,
  picked,
  total,
  children,
  actions,
}: {
  title: string;
  meta?: string;
  picked?: number;
  total?: number;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const left = total !== undefined && picked !== undefined ? Math.max(0, total - picked) : null;
  return (
    <section className="pick-section">
      <div className="pick-section-head">
        <span className="pick-section-title">
          <strong>{title}</strong>
          {meta ? <span>{meta}</span> : null}
        </span>
        <span className="pick-section-side">
          {actions}
          {left !== null ? (
            <span className={left ? "pick-counter pending" : "pick-counter done"}>
              {left ? `Pick ${left}` : total ? "Done" : ""}
            </span>
          ) : null}
        </span>
      </div>
      {children}
    </section>
  );
}

export type InspectRow = { label: string; value: ReactNode };

export function InspectPanel({
  icon,
  kicker,
  title,
  summary,
  rows = [],
  warning,
  fullText,
  children,
  action,
}: {
  icon: GameIconName;
  kicker?: string;
  title: string;
  summary?: string | null;
  rows?: InspectRow[];
  warning?: string | null;
  fullText?: string | null;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const showFull = Boolean(fullText && fullText.trim() && fullText.trim() !== (summary ?? "").trim());
  return (
    <aside className="inspect-panel" aria-label={`${title} details`}>
      <div className="inspect-head">
        <span className="inspect-icon">
          <GameIcon name={icon} />
        </span>
        <span className="inspect-title">
          {kicker ? <span>{kicker}</span> : null}
          <strong>{title}</strong>
        </span>
      </div>
      {summary ? (
        <p className="inspect-summary">
          <Keywordize>{summary}</Keywordize>
        </p>
      ) : null}
      {warning ? <p className="inspect-warning">{warning}</p> : null}
      {rows.length ? (
        <dl className="inspect-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{typeof row.value === "string" ? <Keywordize>{row.value}</Keywordize> : row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {children}
      {showFull ? (
        <div className="inspect-full">
          <button type="button" className="inspect-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide full rules" : "Show full rules"}
          </button>
          {open ? (
            <p>
              <Keywordize>{fullText ?? ""}</Keywordize>
            </p>
          ) : null}
        </div>
      ) : null}
      {action ? <div className="inspect-action">{action}</div> : null}
    </aside>
  );
}

/** Izgara + inceleme paneli yan yana. */
export function PickLayout({ children, inspect }: { children: ReactNode; inspect: ReactNode }) {
  return (
    <div className="pick-layout">
      <div className="pick-layout-main">{children}</div>
      <div className="pick-layout-side">{inspect}</div>
    </div>
  );
}
