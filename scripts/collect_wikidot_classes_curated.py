from __future__ import annotations

import argparse
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen


BASE_URL = "https://dnd5e.wikidot.com"
DEFAULT_OUTPUT_ROOT = Path("content/classes-curated")
USER_AGENT = "DNDBeyond-Class-Curated-Scraper/1.0 (+https://dnd5e.wikidot.com)"

CLASS_PAGES = {
    "artificer": {"name": "Artificer", "path": "/artificer", "subclassHeading": "Artificer Specialist"},
    "barbarian": {"name": "Barbarian", "path": "/barbarian", "subclassHeading": "Primal Path"},
    "bard": {"name": "Bard", "path": "/bard", "subclassHeading": "Bard College"},
    "cleric": {"name": "Cleric", "path": "/cleric", "subclassHeading": "Divine Domain"},
    "druid": {"name": "Druid", "path": "/druid", "subclassHeading": "Druid Circle"},
    "fighter": {"name": "Fighter", "path": "/fighter", "subclassHeading": "Martial Archetype"},
    "monk": {"name": "Monk", "path": "/monk", "subclassHeading": "Monastic Tradition"},
    "paladin": {"name": "Paladin", "path": "/paladin", "subclassHeading": "Sacred Oath"},
    "ranger": {"name": "Ranger", "path": "/ranger", "subclassHeading": "Ranger Archetype"},
    "rogue": {"name": "Rogue", "path": "/rogue", "subclassHeading": "Roguish Archetype"},
    "sorcerer": {"name": "Sorcerer", "path": "/sorcerer", "subclassHeading": "Sorcerous Origin"},
    "warlock": {"name": "Warlock", "path": "/warlock", "subclassHeading": "Otherworldly Patron"},
    "wizard": {"name": "Wizard", "path": "/wizard", "subclassHeading": "Arcane Tradition"},
}

SKIP_TOKENS = {
    "you should be logged in to clone a site",
    "window['nitroads']",
    "window['nitroads']",
}

UA_TOKENS = {
    "unearthed arcana",
    "archived unearthed arcana",
    "ua ",
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def contains_skip_token(value: str) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in SKIP_TOKENS)


def is_ua_text(value: str) -> bool:
    lowered = value.lower()
    return any(token in lowered for token in UA_TOKENS)


class PageContentParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_page_content = False
        self.page_depth = 0
        self.in_script = False
        self.in_style = False

        self.current_block: dict[str, object] | None = None
        self.current_text: list[str] = []
        self.current_table: list[list[str]] | None = None
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None
        self.blocks: list[dict[str, object]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = dict(attrs)

        if tag in {"script", "style"}:
            if tag == "script":
                self.in_script = True
            else:
                self.in_style = True
            return

        if not self.in_page_content and tag == "div" and attrs_map.get("id") == "page-content":
            self.in_page_content = True
            self.page_depth = 1
            return

        if not self.in_page_content or self.in_script or self.in_style:
            return

        if tag == "div":
            self.page_depth += 1
            return

        if tag in {"h1", "h2", "h3", "h4", "p", "li"}:
            self.current_block = {"type": tag}
            self.current_text = []
            return

        if tag == "table":
            self.current_table = []
            return

        if self.current_table is not None and tag == "tr":
            self.current_row = []
            return

        if self.current_table is not None and tag in {"th", "td"}:
            self.current_cell = []
            return

    def handle_data(self, data: str) -> None:
        if self.in_script or self.in_style:
            return
        if self.current_cell is not None:
            self.current_cell.append(data)
            return
        if self.current_block is not None:
            self.current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script":
            self.in_script = False
            return
        if tag == "style":
            self.in_style = False
            return

        if not self.in_page_content:
            return

        if tag == "div":
            self.page_depth -= 1
            if self.page_depth <= 0:
                self.in_page_content = False
            return

        if self.current_table is not None and tag in {"th", "td"} and self.current_cell is not None:
            value = clean_text("".join(self.current_cell))
            self.current_row = self.current_row or []
            self.current_row.append(value)
            self.current_cell = None
            return

        if self.current_table is not None and tag == "tr":
            if self.current_row:
                self.current_table.append(self.current_row)
            self.current_row = None
            return

        if self.current_table is not None and tag == "table":
            self.blocks.append({"type": "table", "rows": self.current_table})
            self.current_table = None
            return

        if self.current_block is not None and tag == self.current_block["type"]:
            text = clean_text("".join(self.current_text))
            if text and not contains_skip_token(text):
                self.blocks.append({"type": self.current_block["type"], "text": text})
            self.current_block = None
            self.current_text = []


def parse_page_content(html: str) -> list[dict[str, object]]:
    parser = PageContentParser()
    parser.feed(html)
    return parser.blocks


def heading_level(block: dict[str, object]) -> int:
    block_type = str(block.get("type", ""))
    if block_type.startswith("h") and len(block_type) == 2 and block_type[1].isdigit():
        return int(block_type[1])
    return 99


def find_heading_index(blocks: list[dict[str, object]], heading_name: str) -> int:
    for index, block in enumerate(blocks):
        if block["type"] in {"h1", "h2", "h3", "h4"} and str(block["text"]) == heading_name:
            return index
    return -1


def blocks_under_heading(blocks: list[dict[str, object]], heading_name: str) -> list[dict[str, object]]:
    start_index = find_heading_index(blocks, heading_name)
    if start_index < 0:
        return []

    start_level = heading_level(blocks[start_index])
    result: list[dict[str, object]] = []
    for block in blocks[start_index + 1 :]:
        if block["type"] in {"h1", "h2", "h3", "h4"} and heading_level(block) <= start_level:
            break
        result.append(block)
    return result


def first_summary(blocks: list[dict[str, object]]) -> str:
    for block in blocks:
        if block["type"] == "p":
            text = str(block["text"])
            if len(text) > 80 and not is_ua_text(text):
                return text
    return ""


def extract_multiclass_requirement(blocks: list[dict[str, object]]) -> str:
    for block in blocks:
      text = str(block.get("text", ""))
      if "multiclass" in text.lower() and "score of 13" in text.lower():
          return text
    return ""


def extract_hit_die(blocks: list[dict[str, object]]) -> str:
    for block in blocks_under_heading(blocks, "Hit Points"):
        if block["type"] not in {"li", "p"}:
            continue
        text = str(block.get("text", ""))
        if text.startswith("Hit Dice:"):
            match = re.search(r"1d\d+", text)
            return match.group(0) if match else text
    return ""


def extract_hit_points(blocks: list[dict[str, object]]) -> dict[str, str]:
    result = {
        "Hit Dice": "",
        "Hit Points at 1st Level": "",
        "Hit Points at Higher Levels": "",
    }

    for block in blocks_under_heading(blocks, "Hit Points"):
        if block["type"] not in {"li", "p"}:
            continue
        text = str(block.get("text", ""))
        for key in result:
            if text.startswith(f"{key}:"):
                result[key] = clean_text(text.split(":", 1)[1])

    return result


def extract_proficiencies(blocks: list[dict[str, object]]) -> dict[str, str]:
    result = {
        "Armor": "",
        "Weapons": "",
        "Tools": "",
        "Saving Throws": "",
        "Skills": "",
    }

    for block in blocks_under_heading(blocks, "Proficiencies"):
        if block["type"] not in {"li", "p"}:
            continue
        text = str(block.get("text", ""))
        for key in result:
            if text.startswith(f"{key}:"):
                result[key] = clean_text(text.split(":", 1)[1])

    return result


def extract_spellcasting_table(blocks: list[dict[str, object]], class_name: str) -> dict[str, object]:
    class_features_index = find_heading_index(blocks, "Class Features")
    title = ""
    rows: list[list[str]] = []

    search_blocks = blocks[:class_features_index] if class_features_index >= 0 else blocks
    for index, block in enumerate(search_blocks):
        if block["type"] == "table":
            rows = block["rows"]  # type: ignore[assignment]
            for back_index in range(index - 1, -1, -1):
                previous = search_blocks[back_index]
                if previous["type"] in {"p", "h1", "h2", "h3", "h4"}:
                    title = str(previous.get("text", ""))
                    break
            break

    return {
        "title": title or f"The {class_name}",
        "rows": rows,
    }


def extract_feature_sections(blocks: list[dict[str, object]], subclass_heading: str) -> list[dict[str, str]]:
    start_index = find_heading_index(blocks, "Class Features")
    if start_index < 0:
        return []

    ignored_headings = {
        "Class Features",
        "Hit Points",
        "Proficiencies",
        "Equipment",
        subclass_heading,
    }
    features: list[dict[str, str]] = []
    current_feature: dict[str, str] | None = None

    for block in blocks[start_index + 1 :]:
        if block["type"] in {"h1", "h2", "h3", "h4"}:
            heading = str(block["text"])
            if heading in ignored_headings:
                if heading == subclass_heading:
                    current_feature = None
                continue
            if is_ua_text(heading):
                current_feature = None
                continue
            current_feature = {
                "id": slugify(heading),
                "name": heading,
                "summary": "",
            }
            features.append(current_feature)
            continue

        if current_feature and block["type"] in {"p", "li"}:
            text = str(block.get("text", ""))
            if not text or contains_skip_token(text) or is_ua_text(text):
                continue
            if current_feature["summary"]:
                current_feature["summary"] += f" {text}"
            else:
                current_feature["summary"] = text

    return [feature for feature in features if feature["summary"]]


def extract_spellcasting_notes(blocks: list[dict[str, object]]) -> list[str]:
    notes: list[str] = []
    for block in blocks_under_heading(blocks, "Spellcasting"):
        if block["type"] not in {"p", "li"}:
            continue
        text = str(block.get("text", ""))
        if text and not contains_skip_token(text):
            notes.append(text)
    return notes[:8]


def extract_subclass_features(blocks: list[dict[str, object]]) -> list[dict[str, str]]:
    features: list[dict[str, str]] = []
    current_feature: dict[str, str] | None = None

    for block in blocks[1:]:
        if block["type"] in {"h1", "h2", "h3", "h4"}:
            heading = str(block["text"])
            if is_ua_text(heading):
                current_feature = None
                continue
            current_feature = {
                "id": slugify(heading),
                "name": heading,
                "summary": "",
            }
            features.append(current_feature)
            continue

        if current_feature and block["type"] in {"p", "li"}:
            text = str(block.get("text", ""))
            if not text or contains_skip_token(text):
                continue
            if current_feature["summary"]:
                current_feature["summary"] += f" {text}"
            else:
                current_feature["summary"] = text

    return [feature for feature in features if feature["summary"]]


def scrape_subclass_detail(class_id: str, subclass: dict[str, str]) -> dict[str, object]:
    url = f"{BASE_URL}/{class_id}:{subclass['id']}"
    try:
        html = fetch_html(url)
        blocks = parse_page_content(html)
        summary = first_summary(blocks)
        features = extract_subclass_features(blocks)
        return {
            **subclass,
            "sourceUrl": url,
            "summary": summary,
            "features": features,
            "notes": ["details collected from subclass page"],
            "pageHtml": html,
        }
    except Exception:
        return {
            **subclass,
            "sourceUrl": url,
            "summary": "",
            "features": [],
            "notes": ["subclass detail page could not be fetched"],
        }


def find_subclass_table(blocks: list[dict[str, object]], heading_name: str) -> list[list[str]]:
    for index, block in enumerate(blocks):
        if block["type"] in {"h1", "h2", "h3", "h4"} and str(block["text"]) == heading_name:
            for candidate in blocks[index + 1 :]:
                if candidate["type"] == "table":
                    return candidate["rows"]  # type: ignore[return-value]
                if candidate["type"] in {"h1", "h2", "h3", "h4"}:
                    break
    return []


def parse_subclasses(rows: list[list[str]]) -> list[dict[str, str]]:
    if not rows:
        return []

    subclasses: list[dict[str, str]] = []
    for row in rows[1:]:
        if len(row) < 2:
            continue

        name = clean_text(row[0])
        source = clean_text(row[1])
        if not name or not source:
            continue
        if is_ua_text(name) or is_ua_text(source):
            continue
        if "source" in name.lower():
            continue

        subclasses.append(
            {
                "id": slugify(name),
                "name": name,
                "source": source,
            }
        )

    unique: dict[str, dict[str, str]] = {}
    for subclass in subclasses:
        unique[subclass["id"]] = subclass
    return list(unique.values())


def scrape_class(class_id: str, config: dict[str, str], pause_seconds: float, output_root: Path) -> dict[str, object]:
    started_at = time.perf_counter()
    class_dir = output_root / class_id
    url = f"{BASE_URL}{config['path']}"
    html = fetch_html(url)
    blocks = parse_page_content(html)

    summary = first_summary(blocks)
    multiclass_requirement = extract_multiclass_requirement(blocks)
    hit_die = extract_hit_die(blocks)
    hit_points = extract_hit_points(blocks)
    proficiencies = extract_proficiencies(blocks)
    spellcasting_table = extract_spellcasting_table(blocks, config["name"])
    spellcasting_notes = extract_spellcasting_notes(blocks)
    class_features = extract_feature_sections(blocks, config["subclassHeading"])
    subclass_rows = find_subclass_table(blocks, config["subclassHeading"])
    subclasses = parse_subclasses(subclass_rows)

    root_payload = {
        "id": class_id,
        "name": config["name"],
        "sourceUrl": url,
        "summary": summary,
        "multiclassRequirement": multiclass_requirement,
        "hitDie": hit_die,
        "hitPoints": hit_points,
        "proficiencies": proficiencies,
        "spellcastingTable": spellcasting_table,
        "spellcastingNotes": spellcasting_notes,
        "classFeatures": class_features,
        "subclassHeading": config["subclassHeading"],
        "subclasses": [entry["id"] for entry in subclasses],
        "notes": [
            "unearthed arcana rows were skipped",
            "subclasses were collected from the class-specific subclass table",
        ],
    }

    write_json(class_dir / "data.json", root_payload)
    (class_dir / "page.html").write_text(html, encoding="utf-8")

    for subclass in subclasses:
        subclass_detail = scrape_subclass_detail(class_id, subclass)
        write_json(
            class_dir / subclass["id"] / "data.json",
            {key: value for key, value in subclass_detail.items() if key != "pageHtml"},
        )
        if "pageHtml" in subclass_detail:
            (class_dir / subclass["id"] / "page.html").write_text(str(subclass_detail["pageHtml"]), encoding="utf-8")

    elapsed = time.perf_counter() - started_at
    print(f"[classes-curated] {config['name']} | subclass: {len(subclasses)} | sure: {format_seconds(elapsed)}")
    if pause_seconds:
        time.sleep(pause_seconds)

    return {
        "id": class_id,
        "name": config["name"],
        "url": url,
        "subclassCount": len(subclasses),
        "path": str((class_dir / 'data.json')).replace("\\", "/"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect curated Wikidot class and subclass data without UA entries.")
    parser.add_argument("--pause", type=float, default=0.25, help="Delay between requests in seconds.")
    parser.add_argument("--only", nargs="*", default=[], help="Optional class ids to fetch, e.g. artificer wizard")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT), help="Output directory.")
    args = parser.parse_args()

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    selected_ids = [class_id for class_id in CLASS_PAGES if not args.only or class_id in set(args.only)]

    started_at = time.perf_counter()
    print(f"[classes-curated] Basladi | class sayisi: {len(selected_ids)}")
    manifest_entries: list[dict[str, object]] = []

    for index, class_id in enumerate(selected_ids, start=1):
        record = scrape_class(class_id, CLASS_PAGES[class_id], args.pause, output_root)
        manifest_entries.append(record)
        percent = (index / len(selected_ids) * 100) if selected_ids else 100
        elapsed = time.perf_counter() - started_at
        print(
            f"[classes-curated] Ilerleme {index}/{len(selected_ids)} "
            f"({percent:5.1f}%) | sure: {format_seconds(elapsed)} | son: {CLASS_PAGES[class_id]['name']}"
        )

    write_json(
        output_root / "manifest.json",
        {
            "source": BASE_URL,
            "entryCount": len(manifest_entries),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "entries": manifest_entries,
        },
    )

    total_elapsed = time.perf_counter() - started_at
    print(f"[classes-curated] Bitti | toplam: {len(manifest_entries)} | sure: {format_seconds(total_elapsed)}")


if __name__ == "__main__":
    main()
