"use client";

import { useState } from "react";
import type { ContentBundle } from "@/lib/content/schema";
import type { ItemState } from "@/lib/engine/armor-class";

type Currency = { cp: number; sp: number; ep: number; gp: number; pp: number };

const COINS: (keyof Currency)[] = ["pp", "gp", "ep", "sp", "cp"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Sheet Inventory sekmesi: kusanili / cantada, adet, para, esya ekle-cikar, Mage Armor. */
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
  const armorByName = new Map(
    content.armors.flatMap((armor) => [armor.name, ...armor.aliases].map((name) => [normalize(name), armor] as const)),
  );
  const weaponNames = new Set(content.weapons.map((weapon) => normalize(weapon.name)));
  const suggestions = [...new Set([...content.armors.map((a) => a.name), ...content.weapons.map((w) => w.name), ...content.items.map((i) => i.name)])].sort();

  const kindOf = (item: string) => {
    const armor = armorByName.get(normalize(item));
    if (armor) {
      return armor.category === "shield" ? "Shield" : `${armor.category.charAt(0).toUpperCase()}${armor.category.slice(1)} Armor`;
    }
    return weaponNames.has(normalize(item)) ? "Weapon" : "Gear";
  };

  const submit = () => {
    const value = newItem.trim();
    if (value) {
      onAdd(value);
      setNewItem("");
    }
  };

  return (
    <div className="tab-body inventory-tab-body">
      <div className="currency-row">
        {COINS.map((coin) => (
          <label key={coin} className="currency-field">
            <span>{coin.toUpperCase()}</span>
            <input
              type="number"
              min={0}
              value={currency[coin] ?? 0}
              onChange={(event) => onCurrency(coin, Math.max(0, Number(event.target.value) || 0))}
            />
          </label>
        ))}
      </div>

      {mageArmorAvailable ? (
        <div className="list-row inventory-row">
          <strong>Mage Armor</strong>
          <span className="inventory-row-actions">
            <span>13 + DEX while you wear no armor</span>
            <button type="button" className={mageArmorActive ? "tab-button active" : "tab-button"} onClick={onToggleMageArmor}>
              {mageArmorActive ? "Active" : "Off"}
            </button>
          </span>
        </div>
      ) : null}

      {inventory.length ? (
        inventory.map((item) => {
          const kind = kindOf(item);
          const equippable = kind !== "Gear";
          const equipped = itemState[item]?.equipped !== false;
          const quantity = itemState[item]?.quantity ?? 1;
          return (
            <div className="list-row inventory-row" key={item}>
              <strong>{item}</strong>
              <span className="inventory-row-actions">
                <span className="spell-tooltip-chip tone-utility">{kind}</span>
                {equippable ? (
                  <button type="button" className={equipped ? "tab-button active" : "tab-button"} onClick={() => onToggleEquipped(item)}>
                    {equipped ? "Equipped" : "Carried"}
                  </button>
                ) : null}
                <span className="quantity-control">
                  <button type="button" className="tab-button" aria-label={`Fewer ${item}`} onClick={() => onQuantity(item, Math.max(1, quantity - 1))}>
                    −
                  </button>
                  <span>{quantity}</span>
                  <button type="button" className="tab-button" aria-label={`More ${item}`} onClick={() => onQuantity(item, quantity + 1)}>
                    +
                  </button>
                </span>
                <button type="button" className="tab-button" aria-label={`Remove ${item}`} onClick={() => onRemove(item)}>
                  Remove
                </button>
              </span>
            </div>
          );
        })
      ) : (
        <div className="list-row">
          <strong>Empty inventory</strong>
          <span>Pick a starting kit in the creator or add items below.</span>
        </div>
      )}

      <div className="inventory-add-row">
        <input
          type="text"
          list="inventory-item-suggestions"
          placeholder="Add an item (e.g. Shield, Potion of Healing)"
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
        <button type="button" className="sheet-button secondary" onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
