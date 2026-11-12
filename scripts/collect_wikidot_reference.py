from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


BASE_URL = "https://dnd5e.wikidot.com"
OUTPUT_ROOT = Path("content/raw/wikidot-reference")
USER_AGENT = "DNDBeyond-Codex-Collector/1.0 (+https://dnd5e.wikidot.com)"
SPELL_SCHOOLS = [
    "Abjuration",
    "Conjuration",
    "Divination",
    "Enchantment",
    "Evocation",
    "Illusion",
    "Necromancy",
    "Transmutation",
]
RACIAL_KEYWORDS = [
    "aarakocra",
    "aasimar",
    "bugbear",
    "centaur",
    "changeling",
    "dragonborn",
    "dwarf",
    "duergar",
    "elf",
    "firbolg",
    "genasi",
    "gith",
    "gnome",
    "goblin",
    "goliath",
    "grung",
    "half-elf",
    "half-orc",
    "halfling",
    "harengon",
    "hobgoblin",
    "human",
    "kenku",
    "kobold",
    "leonin",
    "lizardfolk",
    "orc",
    "satyr",
    "shifter",
    "tabaxi",
    "tiefling",
    "tortle",
    "triton",
    "yuan-ti",
]
EXCLUDE_MARKERS = ("unearthed arcana", "homebrew", "(ua)")
CLASS_SLUGS = [
    "artificer",
    "barbarian",
    "bard",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "entry"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


def ensure_url(href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        return urljoin(BASE_URL, href)
    return f"{BASE_URL}/{href}"


def split_csvish(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r",|/|;|\|", value)
    return [clean_text(part) for part in parts if clean_text(part)]


def extract_line_field(text: str, label: str) -> str:
    match = re.search(rf"(?mi)^{re.escape(label)}:\s*(.+)$", text)
    return clean_text(match.group(1)) if match else ""


def extract_first_school(text: str) -> str:
    for school in SPELL_SCHOOLS:
        if re.search(rf"(?i)\b{re.escape(school)}\b", text):
            return school
    return ""


def is_excluded(name: str, source: str, text: str) -> bool:
    blob = f"{name}\n{source}\n{text[:1000]}".lower()
    return any(marker in blob for marker in EXCLUDE_MARKERS)


def prerequisite_is_racial(prerequisite: str) -> bool:
    normalized = prerequisite.lower()
    return any(keyword in normalized for keyword in RACIAL_KEYWORDS)


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self._href = href
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._href is None:
            return
        self.links.append({"href": self._href, "text": clean_text("".join(self._text))})
        self._href = None
        self._text = []


class TextExtractor(HTMLParser):
    BLOCK_TAGS = {"br", "p", "div", "section", "article", "li", "tr", "table", "h1", "h2", "h3", "h4"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        text = clean_text(data)
        if text:
            self.parts.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def text(self) -> str:
        return re.sub(r"\n{3,}", "\n\n", "".join(self.parts)).strip()


@dataclass(frozen=True)
class Collection:
    id: str
    index_paths: tuple[str, ...]
    matcher: Callable[[str], bool]


TARGET_COLLECTIONS: dict[str, list[Collection]] = {
    "spells": [
        Collection("spells", ("/spells",), lambda href: "/spell:" in href),
    ],
    "races": [
        Collection("races", ("/lineage",), lambda href: "/lineage:" in href),
    ],
    "classes": [
        Collection(
            "classes",
            ("/", "/classes"),
            lambda href: href in {f"/{slug}" for slug in CLASS_SLUGS},
        ),
    ],
    "backgrounds": [
        Collection(
            "backgrounds",
            ("/", "/backgrounds", "/background"),
            lambda href: "/background:" in href,
        ),
    ],
    "feats": [
        Collection(
            "feats",
            ("/", "/feats", "/feat"),
            lambda href: "/feat:" in href,
        ),
    ],
    "items": [
        Collection("weapons", ("/weapons",), lambda href: "/weapon:" in href),
        Collection("armor", ("/armor",), lambda href: "/armor:" in href),
        Collection("adventuring-gear", ("/adventuring-gear",), lambda href: "/adventuring-gear:" in href),
        Collection("tools", ("/tools",), lambda href: "/tools:" in href),
        Collection("wondrous-items", ("/wondrous-items",), lambda href: "/wondrous-items:" in href),
        Collection("rings", ("/rings",), lambda href: "/rings:" in href),
        Collection("rods", ("/rods",), lambda href: "/rods:" in href),
        Collection("potions", ("/potions",), lambda href: "/potions:" in href),
        Collection("wands", ("/wands",), lambda href: "/wands:" in href),
        Collection("scrolls", ("/scrolls",), lambda href: "/scrolls:" in href),
    ],
}


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def try_fetch_index(collection: Collection) -> tuple[str, str]:
    last_error: Exception | None = None
    for candidate in collection.index_paths:
        url = ensure_url(candidate)
        try:
            return url, fetch_html(url)
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"No index path configured for {collection.id}")


def parse_links(html: str) -> list[dict[str, str]]:
    parser = LinkCollector()
    parser.feed(html)
    return parser.links


def parse_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def dedupe_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    result: list[dict[str, str]] = []
    for entry in entries:
        if entry["url"] in seen:
            continue
        seen.add(entry["url"])
        result.append(entry)
    return result


def collect_index_entries(collection: Collection) -> tuple[str, list[dict[str, str]]]:
    index_url, html = try_fetch_index(collection)
    entries = []
    for link in parse_links(html):
        href = link["href"]
        if not collection.matcher(href):
            continue
        entries.append(
            {
                "id": slugify(href.split(":")[-1]),
                "name": link["text"] or href.split(":")[-1].replace("-", " ").title(),
                "href": href,
                "url": ensure_url(href),
                "collection": collection.id,
                "indexUrl": index_url,
            }
        )
    return index_url, dedupe_entries(entries)


def parse_spell_metadata(name: str, text: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    classes = split_csvish(extract_line_field(text, "Classes"))
    school = extract_first_school(text)

    subclass_labels = [
        "Subclasses",
        "Archetypes",
        "Domains",
        "Circles",
        "Patrons",
        "Oaths",
        "Expanded Spell Lists",
        "Additional Spell Lists",
    ]
    subclass_options: list[str] = []
    for label in subclass_labels:
        subclass_options.extend(split_csvish(extract_line_field(text, label)))

    return {
        "source": source,
        "school": school,
        "classes": sorted(set(classes)),
        "subclassOptions": sorted(set(subclass_options)),
        "excluded": is_excluded(name, source, text),
    }


def parse_race_metadata(name: str, text: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    return {
        "source": source,
        "excluded": is_excluded(name, source, text),
    }


def parse_background_metadata(name: str, text: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    skill_proficiencies = extract_line_field(text, "Skill Proficiencies")
    tool_proficiencies = extract_line_field(text, "Tool Proficiencies")
    languages = extract_line_field(text, "Languages")
    return {
        "source": source,
        "skillProficiencies": skill_proficiencies,
        "toolProficiencies": tool_proficiencies,
        "languages": languages,
        "excluded": is_excluded(name, source, text),
    }


def parse_class_metadata(name: str, text: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    multiclass_requirement = ""
    multiclass_match = re.search(
        r"(?i)must have an? ([^.]+?) score of 13 or higher to multiclass",
        text,
    )
    if multiclass_match:
        multiclass_requirement = clean_text(multiclass_match.group(1))

    return {
        "source": source,
        "multiclassRequirement": multiclass_requirement,
        "excluded": is_excluded(name, source, text),
    }


def parse_feat_metadata(name: str, text: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    prerequisite = extract_line_field(text, "Prerequisite")
    return {
        "source": source,
        "prerequisite": prerequisite,
        "isRacialFeat": prerequisite_is_racial(prerequisite),
        "excluded": is_excluded(name, source, text),
    }


def parse_item_metadata(name: str, text: str, collection_id: str) -> dict[str, object]:
    source = extract_line_field(text, "Source")
    text_lines = [line for line in text.splitlines() if line]
    subtitle = text_lines[1] if len(text_lines) > 1 else ""
    return {
        "source": source,
        "itemType": collection_id,
        "subtitle": subtitle,
        "excluded": is_excluded(name, source, text),
    }


def metadata_for_target(target: str, entry: dict[str, str], text: str) -> dict[str, object]:
    if target == "spells":
        return parse_spell_metadata(entry["name"], text)
    if target == "races":
        return parse_race_metadata(entry["name"], text)
    if target == "classes":
        return parse_class_metadata(entry["name"], text)
    if target == "backgrounds":
        return parse_background_metadata(entry["name"], text)
    if target == "feats":
        return parse_feat_metadata(entry["name"], text)
    if target == "items":
        return parse_item_metadata(entry["name"], text, entry["collection"])
    return {"excluded": False}


def scrape_target(target: str, pause_seconds: float) -> dict[str, object]:
    target_root = OUTPUT_ROOT / target
    details_root = target_root / "details"
    target_root.mkdir(parents=True, exist_ok=True)
    details_root.mkdir(parents=True, exist_ok=True)

    started_at = time.perf_counter()
    collections = TARGET_COLLECTIONS[target]
    print(f"[{target}] Basladi | koleksiyon sayisi: {len(collections)}")

    all_entries: list[dict[str, str]] = []
    collection_reports: list[dict[str, object]] = []

    for collection in collections:
        try:
            index_url, entries = collect_index_entries(collection)
            all_entries.extend(entries)
            collection_reports.append(
                {
                    "collection": collection.id,
                    "indexUrl": index_url,
                    "entryCount": len(entries),
                    "status": "ok",
                }
            )
            print(f"[{target}] Koleksiyon: {collection.id} | bulundu: {len(entries)} | index: {index_url}")
        except (HTTPError, URLError, TimeoutError) as error:
            collection_reports.append(
                {
                    "collection": collection.id,
                    "status": "error",
                    "error": str(error),
                }
            )
            print(f"[{target}] Koleksiyon hatasi: {collection.id} | {error}")

    entries = dedupe_entries(all_entries)
    progress_every = 10
    success_count = 0
    error_count = 0
    records: list[dict[str, object]] = []

    for index, entry in enumerate(entries, start=1):
        try:
            html = fetch_html(entry["url"])
            text = parse_text(html)
            metadata = metadata_for_target(target, entry, text)
            record = {
                **entry,
                **metadata,
                "text": text,
            }
            detail_path = details_root / f"{entry['id']}.json"
            detail_path.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
            records.append(record)
            success_count += 1
        except (HTTPError, URLError, TimeoutError) as error:
            records.append({**entry, "error": str(error)})
            error_count += 1

        should_print = index == 1 or index == len(entries) or index % progress_every == 0
        if should_print:
            elapsed = time.perf_counter() - started_at
            percent = (index / len(entries) * 100) if entries else 100
            print(
                f"[{target}] {index}/{len(entries)} tamamlandi ({percent:5.1f}%) | "
                f"basarili: {success_count} | hatali: {error_count} | sure: {format_seconds(elapsed)} | "
                f"son: {entry['name']}"
            )

        if pause_seconds and index < len(entries):
            time.sleep(pause_seconds)

    all_path = target_root / "all.json"
    all_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    published = [record for record in records if not record.get("excluded") and "error" not in record]
    (target_root / "published.json").write_text(
        json.dumps(published, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    if target == "spells":
        by_class_root = target_root / "by-class"
        by_school_root = target_root / "by-school"
        by_class_root.mkdir(parents=True, exist_ok=True)
        by_school_root.mkdir(parents=True, exist_ok=True)

        class_map: dict[str, list[dict[str, object]]] = {}
        school_map: dict[str, list[dict[str, object]]] = {}

        for spell in published:
            for class_name in spell.get("classes", []):
                class_map.setdefault(class_name, []).append(spell)
            school = str(spell.get("school", "")).strip()
            if school:
                school_map.setdefault(school, []).append(spell)

        for class_name, class_spells in class_map.items():
            (by_class_root / f"{slugify(class_name)}.json").write_text(
                json.dumps(class_spells, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        for school_name, school_spells in school_map.items():
            (by_school_root / f"{slugify(school_name)}.json").write_text(
                json.dumps(school_spells, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

    if target == "feats":
        racial = [record for record in published if record.get("isRacialFeat")]
        (target_root / "racial-feats.json").write_text(
            json.dumps(racial, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    elapsed = time.perf_counter() - started_at
    manifest = {
        "target": target,
        "entryCount": len(entries),
        "fetchedCount": success_count,
        "errorCount": error_count,
        "publishedCount": len(published),
        "collections": collection_reports,
        "durationSeconds": round(elapsed, 2),
        "artifacts": {
            "all": str(all_path).replace("\\", "/"),
            "published": str((target_root / "published.json")).replace("\\", "/"),
        },
    }
    (target_root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"[{target}] Bitti | cekilen: {success_count}/{len(entries)} | "
        f"yayinda kalan: {len(published)} | hatali: {error_count} | sure: {format_seconds(elapsed)}"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect filtered Wikidot reference data by target.")
    parser.add_argument(
        "--targets",
        nargs="*",
        default=["spells", "races", "classes", "backgrounds", "feats", "items"],
        choices=["spells", "races", "classes", "backgrounds", "feats", "items"],
        help="Targets to collect.",
    )
    parser.add_argument(
        "--pause",
        type=float,
        default=0.2,
        help="Delay in seconds between detail page requests.",
    )
    args = parser.parse_args()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    started_at = time.perf_counter()
    manifests = [scrape_target(target, args.pause) for target in args.targets]
    elapsed = time.perf_counter() - started_at

    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "targets": manifests,
                "durationSeconds": round(elapsed, 2),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Tum collection bitti | target: {len(manifests)} | sure: {format_seconds(elapsed)}")


if __name__ == "__main__":
    main()
