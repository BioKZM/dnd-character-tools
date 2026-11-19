"use client";

import { useState } from "react";
import type { ContentBundle } from "@/lib/content/schema";
import { findGearInfo } from "@/lib/content/item-info";
import { GameIcon } from "@/components/ui/game-icon";
import { Keywordize } from "@/components/ui/keyword-text";
import type { ItemState } from "@/lib/engine/armor-class";
import type { GameIconName } from "@/lib/ui/game-icons";

type Currency = { cp: number; sp: number; ep: number; gp: number; pp: number };

const COINS: Array<{ id: keyof Currency; label: string; name: string }> = [
  { id: "gp", label: "GP", name: "Gold" },
  { id: "sp", label: "SP", name: "Silver" },
  { id: "cp", label: "CP", name: "Copper" },
  { id: "ep", label: "EP", name: "Electrum" },
  { id: "pp", label: "PP", name: "Platinum" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

type Row = {
  item: string;
  icon: GameIconName;
  sub: string | null;
  equippable: boolean;
  equipped: boolean;
  quantity: number;
  info: ReturnType<typeof findGearInfo>;
};

/**
 * Sheet Inventory (stil v2): ustte para seridi, altinda uc grup.
 * Kusanilanlar (silah/zirh/kalkan), yanindakiler (kusanilmamis silah/zirh) ve cantadakiler (esya).
 * Tur rozeti yok: grup zaten soyluyor. Satira tiklayinca detay acilir.
 */
export function SheetInventoryPanel({
  content,
  inventory,
  itemState,
  currency,
  mageArmorAvailable,
  mageArmorActive,
  onToggleEquipped,
  onQuantity,
  onRemove,
  onAdd,
  onCurrency,
  onToggleMageArmor,
}: {
  content: ContentBundle;
  inventory: string[];
  itemState: Record<string, ItemState>;
  currency: Currency;
  mageArmorAvailable: boolean;
  mageArmorActive: boolean;
  onToggleEquipped: (item: string) => void;
  onQuantity: (item: string, quantity: number) => void;
  onRemove: (item: string) => void;
  onAdd: (item: string) => void;
  onCurrency: (coin: keyof Currency, value: number) => void;
  onToggleMageArmor: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const armorNames = new Set(content.armors.flatMap((armor) => [armor.name, ...armor.aliases].map(normalize)));
  const weaponNames = new Set(content.weapons.map((weapon) => normalize(weapon.name)));
  const suggestions = [...new Set([...content.armors.map((a) => a.name), ...content.weapons.map((w) => w.name), ...content.items.map((i) => i.name)])].sort();

  const rows: Row[] = inventory.map((item) => {
    const info = findGearInfo(content, item);
    // "10 Darts" gibi adetli isimler de silah sayilsin.
    const equippable = armorNames.has(normalize(item)) || weaponNames.has(normalize(item)) || info?.kind === "weapon" || info?.kind === "armor";
    return {
      item,
      info,
      icon: info?.icon ?? "swap-bag",
      sub: info?.sub ?? null,
      equippable,
      equipped: equippable && itemState[item]?.equipped !== false,
      quantity: itemState[item]?.quantity ?? 1,
    };
  });
  const groups: Array<{ id: string; title: string; rows: Row[]; empty?: string }> = [
    { id: "equipped", title: "Equipped", rows: rows.filter((row) => row.equipped) },
    { id: "carried", title: "Carried", rows: rows.filter((row) => row.equippable && !row.equipped) },
    { id: "pack", title: "In your pack", rows: rows.filter((row) => !row.equippable) },
  ];

  const submit = () => {
    const value = newItem.trim();
    if (value) {
      onAdd(value);
      setNewItem("");
    }
  };

  const renderRow = (row: Row) => {
    const open = openItem === row.item;
    return (
      <li key={row.item} className={`inv-row${open ? " open" : ""}${row.equipped ? " equipped" : ""}`}>
        <div className="inv-row-main">
          <button
            type="button"
            className="inv-row-name"
            aria-expanded={row.info ? open : undefined}
            disabled={!row.info}
            onClick={() => setOpenItem(open ? null : row.item)}
          >
            <span className="inv-row-icon" aria-hidden="true">
              <GameIcon name={row.icon} />
            </span>
            <span className="inv-row-text">
              <strong>{row.item}</strong>
              {row.sub ? <small>{row.sub}</small> : null}
            </span>
          </button>
          <span className="inv-qty" aria-label={`${row.item} quantity`}>
            <button type="button" aria-label={`Fewer ${row.item}`} disabled={row.quantity <= 1} onClick={() => onQuantity(row.item, Math.max(1, row.quantity - 1))}>
              −
            </button>
            <span>{row.quantity}</span>
            <button type="button" aria-label={`More ${row.item}`} onClick={() => onQuantity(row.item, row.quantity + 1)}>
              +
            </button>
          </span>
          {row.equippable ? (
            <button type="button" className={row.equipped ? "inv-equip on" : "inv-equip"} aria-pressed={row.equipped} onClick={() => onToggleEquipped(row.item)}>
              {row.equipped ? "Unequip" : "Equip"}
            </button>
          ) : (
            <span className="inv-equip-spacer" aria-hidden="true" />
          )}
          <button type="button" className="inv-remove" aria-label={`Remove ${row.item}`} title="Remove" onClick={() => onRemove(row.item)}>
            ×
          </button>
        </div>
        {open && row.info ? (
          <div className="inv-detail">
            <p>
              <Keywordize>{row.info.summary}</Keywordize>
            </p>
            {row.info.rows.length ? (
              <dl>
                {row.info.rows.map((entry, index) => (
                  <div key={`${row.item}-${entry.label}-${index}`}>
                    <dt>{entry.label}</dt>
                    <dd>
                      <Keywordize>{entry.value}</Keywordize>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="tab-body inventory-tab-body inv-v2">
      <div className="inv-coins" role="group" aria-label="Coins">
        {COINS.map((coin) => (
          <label key={coin.id} className={`inv-coin coin-${coin.id}`} title={coin.name}>
            <i aria-hidden="true" />
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label={`${coin.name} pieces`}
              value={currency[coin.id] ?? 0}
              onChange={(event) => onCurrency(coin.id, Math.max(0, Number(event.target.value) || 0))}
            />
            <span>{coin.label}</span>
          </label>
        ))}
      </div>

      {mageArmorAvailable ? (
        <div className={mageArmorActive ? "inv-effect on" : "inv-effect"}>
          <span className="inv-row-icon" aria-hidden="true">
            <GameIcon name="magic-shield" />
          </span>
          <span className="inv-row-text">
            <strong>Mage Armor</strong>
            <small>AC 13 + DEX while you wear no armor</small>
          </span>
          <button type="button" className={mageArmorActive ? "inv-equip on" : "inv-equip"} aria-pressed={mageArmorActive} onClick={onToggleMageArmor}>
            {mageArmorActive ? "Active" : "Cast"}
          </button>
        </div>
      ) : null}

      {inventory.length ? (
        groups
          .filter((group) => group.rows.length)
          .map((group) => (
            <section key={group.id} className="inv-group" aria-label={group.title}>
              <h3>
                {group.title}
                <span>{group.rows.length}</span>
              </h3>
              <ul>{group.rows.map(renderRow)}</ul>
            </section>
          ))
      ) : (
        <div className="inv-empty">
          <GameIcon name="knapsack" />
          <p>Your pack is empty. Pick a starting kit in the creator or add something below.</p>
        </div>
      )}

      <div className="inv-add">
        <input
          type="text"
          list="inventory-item-suggestions"
          placeholder="Add an item: Shield, Potion of Healing…"
          aria-label="Add an item"
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              submit();
            }
          }}
        />
        <datalist id="inventory-item-suggestions">
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <button type="button" className="inv-add-button" disabled={!newItem.trim()} onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
