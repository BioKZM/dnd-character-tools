"use client";

import { UsageDots } from "@/components/sheet-usage-tracker";

export type SheetResource = {
  id: string;
  name: string;
  total: number;
  recharge: "short_rest" | "long_rest";
  source: string;
};

/** Sinirli kullanimli yetenekler (Second Wind, Action Surge, Bardic Inspiration...). */
export function SheetResourcesPanel({
  resources,
  usedResources,
  onChange,
  saveDcs = [],
  martialArtsDie = null,
}: {
  resources: SheetResource[];
  usedResources: Record<string, number>;
  onChange: (resourceId: string, used: number) => void;
  /** Ki gibi ozel save DC'leri. */
  saveDcs?: { name: string; ability: string; value: number }[];
  martialArtsDie?: string | null;
}) {
  if (!resources.length && !saveDcs.length && !martialArtsDie) {
    return null;
  }

  return (
    <div className="resource-list">
      <div className="action-header">
        <span>Limited Uses</span>
        <span>Short / Long Rest refill these</span>
      </div>
      {saveDcs.length || martialArtsDie ? (
        <div className="resource-stat-row">
          {martialArtsDie ? <span className="dm-pill">{`Martial Arts ${martialArtsDie}`}</span> : null}
          {saveDcs.map((entry) => (
            <span key={entry.name} className="dm-pill">{`${entry.name} save DC ${entry.value} (${entry.ability})`}</span>
          ))}
        </div>
      ) : null}
      {resources.map((resource) => {
        const used = Math.min(usedResources[resource.id] ?? 0, resource.total);
        return (
          <div className="list-row spell-slot-row" key={resource.id}>
            <strong>{resource.name}</strong>
            <span className="spell-slot-meta">
              <UsageDots total={resource.total} used={used} label={resource.name} onChange={(next) => onChange(resource.id, next)} />
              <span>{`${resource.total - used} / ${resource.total} · ${resource.recharge === "short_rest" ? "short rest" : "long rest"} · ${resource.source}`}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
