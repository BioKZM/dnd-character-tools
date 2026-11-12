from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "content" / "raw" / "aidedd-monsters" / "all.json"
OUTPUT_PATH = ROOT / "content" / "normalized" / "monsters.json"

SIZE_WORDS = {"Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"}
SECTION_NAMES = [
    "Actions",
    "Bonus Actions",
    "Reactions",
    "Legendary Actions",
    "Mythic Actions",
    "Lair Actions",
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def load_raw_records() -> list[dict[str, object]]:
    return json.loads(RAW_PATH.read_text(encoding="utf-8"))


def strip_noise(raw_text: str, name: str) -> str:
    text = raw_text.replace("\r", "")
    start = text.find(name)
    if start >= 0:
        text = text[start:]
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def find_subtitle(text: str, name: str) -> str:
    for line in split_lines(text):
        cleaned = clean_text(line)
        if cleaned == name:
            continue
        if cleaned.startswith("[") and cleaned.endswith("]"):
            continue
        if any(cleaned.startswith(size) for size in SIZE_WORDS):
            return cleaned
    return name


def get_line(text: str, label: str) -> str:
    match = re.search(rf"(?im)^{re.escape(label)}\s*(.+)$", text)
    return clean_text(match.group(1)) if match else ""


def parse_numeric_prefix(value: str) -> int:
    match = re.search(r"(\d+)", value)
    return int(match.group(1)) if match else 0


def parse_subtitle(subtitle: str) -> tuple[str, str, str]:
    cleaned = clean_text(subtitle)
    alignment = ""
    descriptor = cleaned
    if "," in cleaned:
        descriptor, alignment = [part.strip() for part in cleaned.split(",", 1)]

    parts = descriptor.split()
    size = parts[0] if parts and parts[0] in SIZE_WORDS else ""
    type_part = descriptor[len(size) :].strip() if size else descriptor

    return size, type_part.title(), alignment


def normalize_languages(value: str) -> list[str]:
    cleaned = clean_text(value)
    if not cleaned or cleaned in {"-", "â€”", "—"}:
        return []
    return [part.strip() for part in cleaned.split(",") if part.strip()]


def trait_names_from_lines(lines: list[str]) -> list[str]:
    names: list[str] = []
    for line in lines:
        match = re.match(r"([^.:]+)[.:]", line)
        if match:
            names.append(clean_text(match.group(1)))
        elif clean_text(line):
            names.append(clean_text(line))
    return names


def action_names_from_lines(lines: list[str]) -> list[str]:
    names: list[str] = []
    for line in lines:
        match = re.match(r"([^.:]+)[.:]", line)
        if match:
            names.append(clean_text(match.group(1)))
        elif clean_text(line):
            names.append(clean_text(line))
    return names


def clean_section_lines(lines: list[str]) -> list[str]:
    cleaned_lines: list[str] = []
    for line in lines:
        cleaned = clean_text(line)
        if not cleaned:
            continue
        if cleaned.startswith("Monster Manual"):
            continue
        if cleaned.startswith("DnD 5e Monsters"):
            continue
        if cleaned == "Legendary actions":
            continue
        if cleaned.startswith("The ") and "can take 3 legendary actions" in cleaned:
            continue
        cleaned_lines.append(cleaned)
    return cleaned_lines


def extract_trait_lines(text: str) -> list[str]:
    start = re.search(r"(?im)^Challenge\s*.+$", text)
    if not start:
        return []

    end = len(text)
    for name in SECTION_NAMES:
        match = re.search(rf"(?im)^{re.escape(name)}\s*$", text)
        if match:
            end = min(end, match.start())

    chunk = text[start.end() : end].strip()
    return clean_section_lines(split_lines(chunk))


def extract_lore_text(text: str) -> str:
    lines = clean_section_lines(split_lines(text))
    lore_candidates: list[str] = []
    for line in lines:
        if any(line.startswith(section) for section in SECTION_NAMES):
            continue
        if re.match(r"^(Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|STR|DEX|CON|INT|WIS|CHA)\b", line):
            continue
        if "." in line and not re.match(r"^[A-Z][A-Za-z'() -]+[.:]", line):
            lore_candidates.append(line)
    return " ".join(lore_candidates[-2:])


def infer_role(type_name: str, actions: list[str], traits: list[str], cr: str) -> str:
    joined = " ".join(actions + traits).lower()
    if "spellcasting" in joined:
        return "Caster"
    if "legendary" in joined or (cr and "/" not in cr and int(cr) >= 10):
        return "Boss"
    if "fly" in joined or "ranged" in joined:
        return "Skirmisher"
    if any(keyword in type_name.lower() for keyword in ["dragon", "giant", "construct", "monstrosity"]):
        return "Bruiser"
    return "Generalist"


def infer_environment(type_name: str, alignment: str, traits: list[str], actions: list[str]) -> list[str]:
    blob = f"{type_name} {alignment} {' '.join(traits)} {' '.join(actions)}".lower()
    environments: list[str] = []
    mapping = [
        ("swim", "Coast"),
        ("water", "Coast"),
        ("forest", "Forest"),
        ("underdark", "Underdark"),
        ("burrow", "Underdark"),
        ("undead", "Dungeon"),
        ("fiend", "Hellscape"),
        ("dragon", "Mountain"),
        ("fey", "Forest"),
        ("desert", "Desert"),
        ("arctic", "Arctic"),
        ("swamp", "Swamp"),
    ]
    for needle, label in mapping:
        if needle in blob and label not in environments:
            environments.append(label)
    return environments or ["Any"]


def normalize_record(record: dict[str, object]) -> dict[str, object]:
    name = str(record.get("name", "")).strip()
    raw_text = strip_noise(str(record.get("rawText", "")), name)
    subtitle = find_subtitle(raw_text, name)

    armor_class = get_line(raw_text, "Armor Class") or str(record.get("armorClass", ""))
    hit_points = get_line(raw_text, "Hit Points") or str(record.get("hitPoints", ""))
    speed = get_line(raw_text, "Speed") or str(record.get("speed", ""))
    senses = get_line(raw_text, "Senses") or str(record.get("senses", ""))
    languages = get_line(raw_text, "Languages") or str(record.get("languages", ""))
    challenge = get_line(raw_text, "Challenge") or str(record.get("challenge", ""))

    size, type_name, alignment = parse_subtitle(subtitle)

    raw_traits = clean_section_lines(extract_trait_lines(raw_text) or list(record.get("traits", [])))
    raw_actions = clean_section_lines(list(record.get("actions", [])))
    raw_bonus_actions = clean_section_lines(list(record.get("bonusActions", [])))
    raw_reactions = clean_section_lines(list(record.get("reactions", [])))
    raw_legendary_actions = clean_section_lines(list(record.get("legendaryActions", [])))

    notes = clean_text(str(record.get("lore", "")))
    if not notes:
        notes = extract_lore_text(raw_text)

    actions = action_names_from_lines(
        [str(item) for item in raw_actions + raw_bonus_actions + raw_legendary_actions]
    )
    traits = trait_names_from_lines([str(item) for item in raw_traits])

    environment = infer_environment(type_name, alignment, traits, actions)
    role = infer_role(type_name, actions, traits, challenge.split()[0] if challenge else "")

    return {
        "id": record["id"],
        "name": name,
        "source": str(record.get("source", "Aidedd")),
        "cr": (challenge.split()[0] if challenge else "0"),
        "type": type_name or "Creature",
        "environment": environment,
        "ac": parse_numeric_prefix(armor_class),
        "hp": parse_numeric_prefix(hit_points),
        "speed": speed,
        "role": role,
        "senses": senses,
        "languages": normalize_languages(languages),
        "traits": traits,
        "actions": actions,
        "notes": notes or f"{name} imported from Aidedd.",
        "size": size,
        "alignment": alignment,
        "subtitle": subtitle,
        "savingThrows": get_line(raw_text, "Saving Throws"),
        "skills": get_line(raw_text, "Skills"),
        "damageVulnerabilities": get_line(raw_text, "Damage Vulnerabilities"),
        "damageResistances": get_line(raw_text, "Damage Resistances"),
        "damageImmunities": get_line(raw_text, "Damage Immunities"),
        "conditionImmunities": get_line(raw_text, "Condition Immunities"),
        "legendary": bool(record.get("legendary")),
        "rawSections": {
            "traits": [str(item) for item in raw_traits],
            "actions": [str(item) for item in raw_actions],
            "bonusActions": [str(item) for item in raw_bonus_actions],
            "reactions": [str(item) for item in raw_reactions],
            "legendaryActions": [str(item) for item in raw_legendary_actions],
        },
    }


def main() -> None:
    raw_records = load_raw_records()
    normalized = [normalize_record(record) for record in raw_records if "error" not in record]
    normalized.sort(key=lambda record: record["name"])
    OUTPUT_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "source": str(RAW_PATH),
                "output": str(OUTPUT_PATH),
                "count": len(normalized),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
