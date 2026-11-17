"use client";

import type { CSSProperties, ReactNode } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import type { GameIconName } from "@/lib/ui/game-icons";

// Stil v2: "doldurulacak slot" + "liste + detay" secici.
// Bir irkin / feat'in verdigi her secim bir slot satiri; satira tiklayinca altinda
// aranabilir liste (solda) ve secilen seyin detayi (sagda) acilir. Sayfalama yok.

export function ChoiceSlot({
  icon,
  kind,
  value,
  missing,
  open,
  auto,
  action,
  onClick,
}: {
  icon?: GameIconName | null;
  kind: string;
  value: string;
  missing?: boolean;
  open?: boolean;
  /** Burada secilmeyen, otomatik ya da baska adimda ayarlanan satir. */
  auto?: boolean;
  action?: string;
  onClick?: () => void;
}) {
  const className = `choice-slot${open ? " open" : ""}${auto ? " auto" : ""}${missing ? " missing" : ""}`;
  const body = (
    <>
      <span className={icon ? "choice-slot-icon" : "choice-slot-icon empty"} aria-hidden="true">
        {icon ? <GameIcon name={icon} /> : null}
      </span>
      <span className="choice-slot-text">
        <small>{kind}</small>
        <strong>{value}</strong>
      </span>
      {action ? <span className="choice-slot-action">{action}</span> : null}
    </>
  );
  if (auto || !onClick) {
    return <div className={className}>{body}</div>;
  }
  return (
    <button type="button" className={className} aria-expanded={open} onClick={onClick}>
      {body}
    </button>
  );
}

export type ChoiceRow = {
  id: string;
  name: string;
  icon: GameIconName;
  /** Sagdaki kisa etiket: "+5 init", "DEX", "Evocation". */
  tag?: string | null;
  tagStyle?: CSSProperties;
  /** Bu slot icin secilmis. */
  mine?: boolean;
  /** Zaten baska yerden var (or. background skill'i); secilemez. */
  owned?: boolean;
  locked?: boolean;
};

export function ChoicePicker({
  label,
  rows,
  lockedRows = [],
  lockedTitle = "Not available",
  focusId,
  onFocus,
  query,
  onQuery,
  searchPlaceholder,
  detail,
}: {
  label: string;
  rows: ChoiceRow[];
  lockedRows?: ChoiceRow[];
  lockedTitle?: string;
  focusId: string | null;
  onFocus: (id: string) => void;
  query?: string;
  onQuery?: (value: string) => void;
  searchPlaceholder?: string;
  detail: ReactNode;
}) {
  const renderRow = (row: ChoiceRow) => (
    <button
      key={row.id}
      type="button"
      role="option"
      aria-selected={row.id === focusId}
      className={`choice-row${row.id === focusId ? " focused" : ""}${row.mine ? " mine" : ""}${row.owned ? " owned" : ""}${row.locked ? " locked" : ""}`}
      onClick={() => onFocus(row.id)}
    >
      <span className="choice-row-icon" aria-hidden="true">
        <GameIcon name={row.locked ? "padlock" : row.icon} />
      </span>
      <span className="choice-row-name">{row.name}</span>
      {row.mine ? (
        <GameIcon name="check-mark" className="choice-row-check" />
      ) : row.tag ? (
        <span className="choice-row-tag" style={row.tagStyle}>
          {row.tag}
        </span>
      ) : null}
    </button>
  );
  return (
    <div className="choice-picker">
      <div className="choice-picker-list">
        {onQuery ? (
          <input
            type="search"
            className="choice-picker-search"
            value={query ?? ""}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={searchPlaceholder ?? "Search"}
            aria-label={searchPlaceholder ?? "Search"}
          />
        ) : null}
        <div className="choice-picker-scroll" role="listbox" aria-label={label}>
          {rows.map(renderRow)}
          {lockedRows.length ? (
            <>
              <span className="choice-picker-group">{lockedTitle}</span>
              {lockedRows.map(renderRow)}
            </>
          ) : null}
          {!rows.length && !lockedRows.length ? <p className="choice-picker-empty">Nothing matches.</p> : null}
        </div>
      </div>
      <div className="choice-picker-detail">{detail}</div>
    </div>
  );
}

/** Secicinin sag tarafi: ikon, ad, kaynak, tek cumle, karaktere etkisi, kapali kural metni, aksiyon. */
export function ChoiceDetail({
  icon,
  name,
  source,
  pitch,
  forTitle,
  forLines = [],
  facts = [],
  warning,
  rules,
  action,
}: {
  icon: GameIconName;
  name: string;
  source?: string | null;
  pitch?: ReactNode;
  forTitle?: string;
  forLines?: string[];
  facts?: Array<{ label: string; value: string }>;
  warning?: string | null;
  rules?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="choice-detail">
      <div className="choice-detail-head">
        <span className="choice-detail-icon" aria-hidden="true">
          <GameIcon name={icon} />
        </span>
        <span className="choice-detail-title">
          <strong>{name}</strong>
          {source ? <small>{source}</small> : null}
        </span>
      </div>
      {pitch ? <p className="choice-detail-pitch">{pitch}</p> : null}
      {warning ? <p className="choice-detail-warning">{warning}</p> : null}
      {forLines.length ? (
        <div className="choice-detail-for">
          {forTitle ? <span>{forTitle}</span> : null}
          <ul>
            {forLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {facts.length ? (
        <dl className="choice-detail-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rules ? (
        <details className="choice-detail-rules">
          <summary>Full rules</summary>
          {rules}
        </details>
      ) : null}
      {action ? <div className="choice-detail-action">{action}</div> : null}
    </div>
  );
}
