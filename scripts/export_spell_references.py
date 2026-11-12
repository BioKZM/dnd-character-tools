from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPELLS_DIR = ROOT / "src" / "app" / "docs" / "spells"
OUTPUT_PATH = ROOT / "content" / "manual" / "spell_references.generated.json"


def clean_text(value: str) -> str:
    return (
        value.replace("\r\n", "\n")
        .replace("\u00a0", " ")
        .replace("[", "[")
        .replace("]", "]")
        .strip()
    )


def strip_markdown(value: str) -> str:
    return (
        re.sub(r"\*\*_?At Higher Levels\._?\*\*\s*", "", value, flags=re.I)
        .replace("**", "")
        .replace("_", "")
        .strip()
    )


def slugify(value: str) -> str:
    return re.sub(r"^-|-?$", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def parse_spell_block(name: str, body: str) -> dict:
    chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n+", clean_text(body)) if chunk.strip()]
    entry = {
        "id": slugify(name),
        "name": name.strip(),
        "source": None,
        "subtitle": None,
        "castingTime": None,
        "range": None,
        "components": None,
        "duration": None,
        "summary": [],
        "detailLines": [],
        "detailTables": [],
        "atHigherLevels": None,
        "spellLists": [],
    }

    for chunk in chunks:
        lines = [line.strip() for line in chunk.split("\n") if line.strip()]
        if not lines:
            continue

        first = strip_markdown(lines[0])

        if first.lower().startswith("source:"):
            entry["source"] = first.split(":", 1)[1].strip()
            continue

        if re.match(r"^_.+_$", lines[0]):
            entry["subtitle"] = strip_markdown(lines[0])
            continue

        metadata_lines = [
            strip_markdown(line)
            for line in lines
            if re.match(r"^(\*\*)?(Casting Time|Range|Components|Duration):", strip_markdown(line), re.I)
        ]
        if len(metadata_lines) == len(lines):
            for line in metadata_lines:
                lower = line.lower()
                if lower.startswith("casting time:"):
                    entry["castingTime"] = line.split(":", 1)[1].strip()
                elif lower.startswith("range:"):
                    entry["range"] = line.split(":", 1)[1].strip()
                elif lower.startswith("components:"):
                    entry["components"] = line.split(":", 1)[1].strip()
                elif lower.startswith("duration:"):
                    entry["duration"] = line.split(":", 1)[1].strip()
            continue

        if re.match(r"^\*\*_?At Higher Levels\._?\*\*", lines[0], re.I):
            entry["atHigherLevels"] = strip_markdown(" ".join(lines))
            continue

        if re.match(r"^\*\*_?Spell Lists\._?\*\*", lines[0], re.I):
            raw = strip_markdown(" ".join(lines))
            _, values = raw.split(".", 1) if "." in raw else ("", raw)
            entry["spellLists"] = [part.strip() for part in values.split(",") if part.strip()]
            continue

        if all(re.match(r"^[-*]\s+|^\d+\.\s+", line) for line in lines):
            for line in lines:
                entry["detailLines"].append(strip_markdown(re.sub(r"^[-*]\s+|^\d+\.\s+", "", line)))
            continue

        if all(re.match(r"^\|.+\|$", line) for line in lines):
            rows = []
            for line in lines:
                cells = [strip_markdown(cell.strip()) for cell in line.split("|") if cell.strip()]
                if len(cells) > 1:
                    rows.append(cells)
            if len(rows) >= 2:
                entry["detailTables"].append({"headers": rows[0], "rows": rows[1:]})
            continue

        entry["summary"].append(strip_markdown(" ".join(lines)))

    return entry


def main() -> None:
    collection: dict[str, dict] = {}
    spell_paths = sorted(SPELLS_DIR.glob("spells*.md"))
    cantrip_path = SPELLS_DIR / "cantrips.md"
    if cantrip_path.exists():
        spell_paths = [cantrip_path, *spell_paths]

    for path in spell_paths:
        text = path.read_text(encoding="utf-8")
        for match in re.finditer(r"^===\s*(.+?)\s*===\s*\n([\s\S]*?)(?=^===\s*.+?\s*===\s*\n?|\Z)", text, re.M):
            name, body = match.group(1), match.group(2)
            entry = parse_spell_block(name, body)
            collection[entry["id"]] = entry

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(collection)} spell references to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
