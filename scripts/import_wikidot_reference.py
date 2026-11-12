from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RAW_ROOT = ROOT / "content" / "raw" / "wikidot-reference"
NORMALIZED_ROOT = ROOT / "content" / "normalized"

SPELL_PATH = RAW_ROOT / "spells" / "published.json"
RACE_PATH = RAW_ROOT / "races" / "published.json"
CLASS_PATH = RAW_ROOT / "classes" / "published.json"
BACKGROUND_PATH = RAW_ROOT / "backgrounds" / "published.json"
FEAT_PATH = RAW_ROOT / "feats" / "published.json"


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def clean_text(value: str) -> str:
    value = value.replace("â€™", "'").replace("â€œ", '"').replace("â€", '"')
    return re.sub(r"\s+", " ", value).strip()


def clean_core_text(text: str) -> str:
    cleaned = text
    if "community wiki" in cleaned:
        cleaned = cleaned.split("community wiki", 1)[-1]
    if "Create accountorSign in" in cleaned:
        cleaned = cleaned.split("Create accountorSign in", 1)[-1]
    if "window['nitroAds'].createAd('wad-dnd5e-below-sidebar'" in cleaned:
        cleaned = cleaned.split("window['nitroAds'].createAd('wad-dnd5e-below-sidebar'", 1)[-1]
    if "FoldUnfold" in cleaned:
        cleaned = cleaned.split("FoldUnfold", 1)[-1]
    if "Source:" in cleaned and cleaned.index("Source:") < 4000:
        cleaned = cleaned[cleaned.index("Source:") :]
    elif "\n\nPlayer's Handbook\n\n" in cleaned:
        cleaned = cleaned.split("\n\nPlayer's Handbook\n\n", 1)[-1]
    elif "\n\nSource:" in cleaned:
        cleaned = cleaned.split("\n\nSource:", 1)[-1]
    if "Source:" in cleaned:
        cleaned = cleaned[cleaned.index("Source:") :]
    if "Help|Terms of Service" in cleaned:
        cleaned = cleaned.split("Help|Terms of Service", 1)[0]
    return cleaned.strip()


def extract_field(text: str, label: str) -> str:
    patterns = [
        rf"{re.escape(label)}:\s*([^\n]+)",
        rf"{re.escape(label)}\.\s*([^\n]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return clean_text(match.group(1))
    return ""


def extract_first_paragraph(text: str, excluded_prefixes: tuple[str, ...] = ()) -> str:
    paragraphs = [clean_text(part) for part in re.split(r"\n\s*\n", text) if clean_text(part)]
    for paragraph in paragraphs:
        lowered = paragraph.lower()
        if lowered.startswith("source:"):
            continue
        if "casting time:" in lowered or "range:" in lowered or "components:" in lowered or "duration:" in lowered:
            continue
        if lowered.startswith("spell lists"):
            continue
        if lowered.startswith("at higher levels"):
            continue
        if any(lowered.startswith(prefix) for prefix in excluded_prefixes):
            continue
        if len(paragraph) < 30:
            continue
        return paragraph
    return ""


def looks_like_scrape_noise(value: str) -> bool:
    lowered = value.lower().strip()
    noise_markers = (
        "wikidot.com",
        "var url_host",
        "ozone.",
        "require.config",
        "nitroads",
        "community wiki",
        "refreshtime",
        "rendervisibleonly",
        "create accountorsign in",
    )
    return (
        not lowered
        or any(marker in lowered for marker in noise_markers)
        or lowered.startswith(", {")
        or ("." not in lowered and len(lowered) < 90)
        or len(lowered) < 24
    )


def extract_race_summary(raw_text: str, race_name: str) -> str:
    paragraphs = [clean_text(part) for part in re.split(r"\n\s*\n", raw_text) if clean_text(part)]
    start_index = 0

    for index, paragraph in enumerate(paragraphs):
        if paragraph.strip().lower() == race_name.lower():
            start_index = index + 1
            break

    skip_exact = {
        "dnd 5th edition",
        "community wiki",
        "create accountorsign in",
        "foldunfold",
        "table of contents",
    }
    skip_prefixes = (
        "source:",
        "ability score increase.",
        "creature type.",
        "size.",
        "speed.",
        "age.",
        "alignment.",
        "darkvision.",
        "languages.",
    )

    for paragraph in paragraphs[start_index:]:
        lowered = paragraph.lower().strip()
        if lowered in skip_exact:
            continue
        if looks_like_scrape_noise(paragraph):
            continue
        if lowered.startswith(skip_prefixes):
            continue
        if paragraph == race_name:
            continue
        if paragraph.endswith("Features") or paragraph.endswith("Traits"):
            continue
        if re.fullmatch(r"[A-Z][A-Za-z' :&-]{0,80}", paragraph) and "." not in paragraph:
            continue
        if len(paragraph) < 60:
            continue
        return paragraph

    return ""


def title_case_list(value: str) -> list[str]:
    if not value:
        return []
    parts = [clean_text(part) for part in re.split(r",|/|;|\|", value) if clean_text(part)]
    return sorted(dict.fromkeys(parts))


def spell_level_from_header(text: str) -> int:
    lowered = text.lower()
    if "cantrip" in lowered:
        return 0
    match = re.search(r"(\d+)(st|nd|rd|th)-level", lowered)
    return int(match.group(1)) if match else 0


def import_spells() -> list[dict[str, object]]:
    raw_spells = read_json(SPELL_PATH)
    imported: list[dict[str, object]] = []

    for spell in raw_spells:
        text = clean_core_text(spell["text"])
        classes = title_case_list(extract_field(text, "Spell Lists"))
        subclass_options = title_case_list(extract_field(text, "Expanded Spell Lists"))
        summary = extract_first_paragraph(text)
        imported.append(
            {
                "id": spell["id"],
                "name": spell["name"],
                "level": spell_level_from_header(text),
                "school": extract_field(text, "School") or spell.get("school") or "",
                "castingTime": extract_field(text, "Casting Time"),
                "range": extract_field(text, "Range"),
                "duration": extract_field(text, "Duration"),
                "summary": summary or f"{spell['name']} imported from Wikidot reference data.",
                "source": spell.get("source", ""),
                "classes": classes,
                "subclassOptions": subclass_options,
            }
        )

    imported.sort(key=lambda item: (item["level"], item["name"]))
    write_json(NORMALIZED_ROOT / "spells.json", imported)
    return imported


BACKGROUND_BLOCKLIST = {
    "optional-features",
    "sword-coast-heroic-chronicle",
    "wildemount-heroic-chronicle",
}


def import_backgrounds() -> list[dict[str, object]]:
    raw_backgrounds = read_json(BACKGROUND_PATH)
    imported: list[dict[str, object]] = []

    for background in raw_backgrounds:
        background_id = background["id"]
        if background_id.endswith("-toc1") or background_id in BACKGROUND_BLOCKLIST:
            continue
        text = clean_core_text(background["text"])
        summary = extract_first_paragraph(
            text,
            excluded_prefixes=("skill proficiencies", "tool proficiencies", "languages", "equipment"),
        )
        imported.append(
            {
                "id": background_id,
                "name": background["name"],
                "summary": summary or f"{background['name']} imported from Wikidot reference data.",
                "source": background.get("source", ""),
                "skillProficiencies": background.get("skillProficiencies", ""),
                "toolProficiencies": background.get("toolProficiencies", ""),
                "languages": background.get("languages", ""),
            }
        )

    imported.sort(key=lambda item: item["name"])
    write_json(NORMALIZED_ROOT / "backgrounds.json", imported)
    return imported


def import_feats() -> list[dict[str, object]]:
    raw_feats = read_json(FEAT_PATH)
    imported = [
        {
            "id": feat["id"],
            "name": feat["name"],
            "summary": extract_first_paragraph(clean_core_text(feat["text"]))
            or f"{feat['name']} imported from Wikidot reference data.",
            "source": feat.get("source", ""),
            "prerequisite": feat.get("prerequisite", ""),
            "isRacialFeat": bool(feat.get("isRacialFeat")),
        }
        for feat in raw_feats
    ]
    imported.sort(key=lambda item: item["name"])
    write_json(NORMALIZED_ROOT / "feats.json", imported)
    return imported


def race_to_species_entry(race: dict[str, object]) -> dict[str, object]:
    raw_text = str(race["text"])
    text = clean_core_text(raw_text)
    summary = extract_race_summary(raw_text, str(race["name"])) or extract_first_paragraph(text)
    source = clean_text(str(race.get("source", "")))
    if looks_like_scrape_noise(summary) or summary == source:
        summary = (
            f"{race['name']} lineage reference imported from {source}."
            if source
            else f"{race['name']} lineage reference imported from Wikidot data."
        )
    return {
        "id": race["id"] if race["id"] != "custom" else "custom-lineage",
        "name": race["name"] if race["name"] != "Custom" else "Custom Lineage",
        "traits": [
            {
                "id": "overview",
                "name": "Overview",
                "summary": summary or f"{race['name']} imported from Wikidot reference data.",
            }
        ],
        "source": race.get("source", ""),
    }


def import_species() -> list[dict[str, object]]:
    existing_species = read_json(NORMALIZED_ROOT / "species.json")
    raw_races = read_json(RACE_PATH)

    merged = {species["id"]: species for species in existing_species}
    for race in raw_races:
        species_entry = race_to_species_entry(race)
        merged[species_entry["id"]] = species_entry

    imported = sorted(merged.values(), key=lambda item: item["name"])
    write_json(NORMALIZED_ROOT / "species.json", imported)
    return imported


CLASS_HIT_DICE = {
    "artificer": 8,
    "barbarian": 12,
    "bard": 8,
    "cleric": 8,
    "druid": 8,
    "fighter": 10,
    "monk": 8,
    "paladin": 10,
    "ranger": 10,
    "rogue": 8,
    "sorcerer": 6,
    "warlock": 8,
    "wizard": 6,
}


def import_classes() -> list[dict[str, object]]:
    existing_classes = read_json(NORMALIZED_ROOT / "classes.json")
    raw_classes = {item["id"]: item for item in read_json(CLASS_PATH)}
    imported: list[dict[str, object]] = []

    for item in existing_classes:
        raw = raw_classes.get(item["id"], {})
        imported.append(
            {
                **item,
                "source": raw.get("source", item.get("source", "")),
                "multiclassRequirement": raw.get("multiclassRequirement", ""),
                "hitDie": CLASS_HIT_DICE.get(item["id"], item["hitDie"]),
            }
        )

    imported.sort(key=lambda item: item["name"])
    write_json(NORMALIZED_ROOT / "classes.json", imported)
    return imported


def main() -> None:
    spells = import_spells()
    species = import_species()
    backgrounds = import_backgrounds()
    feats = import_feats()
    classes = import_classes()

    summary = {
        "spells": len(spells),
        "species": len(species),
        "backgrounds": len(backgrounds),
        "feats": len(feats),
        "classes": len(classes),
    }
    write_json(NORMALIZED_ROOT / "wikidot-import-summary.json", summary)
    print(
        "Imported Wikidot reference data | "
        + " | ".join(f"{key}: {value}" for key, value in summary.items())
    )


if __name__ == "__main__":
    main()
