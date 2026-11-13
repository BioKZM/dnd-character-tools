"use client";

import { useState } from "react";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import type { GearInfo } from "@/lib/content/item-info";

/** Tek esya: ikon, isim, kisa satir; tiklayinca hasar/menzil/ozellik satirlari acilir. */
export function GearCard({ info, defaultOpen = false }: { info: GearInfo; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={open ? "gear-card open" : "gear-card"}>
      <button type="button" className="gear-card-head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="gear-card-icon">
          <GameIcon name={info.icon} />
        </span>
        <span className="gear-card-title">
          <strong>{info.name}</strong>
          <span>{info.sub}</span>
        </span>
        <span className="gear-card-toggle" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="gear-card-body">
          <p>
            <Keywordize>{info.summary}</Keywordize>
          </p>
          {info.rows.length ? (
            <dl className="inspect-rows">
              {info.rows.map((row, index) => (
                <div key={`${info.id}-${row.label}-${index}`}>
                  <dt>{row.label}</dt>
                  <dd>
                    <Keywordize>{row.value}</Keywordize>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Bir secenegin icindeki esyalar ("Ne alirsin"). */
export function GearList({ infos, title, openFirst = false }: { infos: GearInfo[]; title?: string; openFirst?: boolean }) {
  if (!infos.length) {
    return null;
  }
  return (
    <div className="gear-list">
      {title ? <span className="gear-list-title">{title}</span> : null}
      {infos.map((info, index) => (
        <GearCard key={`${info.kind}-${info.id}`} info={info} defaultOpen={openFirst && index === 0} />
      ))}
    </div>
  );
}
