from __future__ import annotations

import argparse
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


BASE_URL = "https://dnd5e.wikidot.com"
INDEX_URL = f"{BASE_URL}/lineage"
OUTPUT_ROOT = Path("content/lineages")
USER_AGENT = "DNDBeyond-Lineage-Scraper/1.0 (+https://dnd5e.wikidot.com)"
ALLOWED_SECTIONS = {
    "Standard Lineages",
    "Custom Lineage",
    "Exotic Lineages",
    "Monstrous Lineages",
    "Dragonlance",
    "Eberron",
    "Plane Shift",
    "Ravenloft",
    "Ravnica",
    "Spelljammer",
    "Theros",
}
SKIPPED_SECTIONS = {"Unearthed Arcana", "Archived Unearthed Arcana", "Homebrew"}
KNOWN_SOURCE_LABELS = {
    "Player's Handbook",
    "Eberron: Rising from the Last War",
    "Plane Shift: Kaladesh",
    "Explorer's Guide to Wildemount",
    "Guildmaster's Guide to Ravnica",
    "Van Richten's Guide to Ravenloft",
    "Mythic Odysseys of Theros",
    "Spelljammer: Adventures in Space - Astral Adventurer's Guide",
    "Astral Adventurer's Guide",
    "Mordenkainen Presents: Monsters of the Multiverse",
    "Sword Coast Adventurer's Guide",
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


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


class EventParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[tuple[str, str, str]] = []
        self._current_tag: str | None = None
        self._current_href: str | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h1", "h2", "h3", "h4", "a"}:
            self._current_tag = tag
            self._buffer = []
            if tag == "a":
                self._current_href = dict(attrs).get("href")

    def handle_data(self, data: str) -> None:
        if self._current_tag:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != self._current_tag:
            return
        text = clean_text("".join(self._buffer))
        if not text:
            self._current_tag = None
            self._current_href = None
            self._buffer = []
            return
        if tag == "a" and self._current_href:
            self.events.append(("link", self._current_href, text))
        else:
            self.events.append(("heading", tag, text))
        self._current_tag = None
        self._current_href = None
        self._buffer = []


class TextExtractor(HTMLParser):
    BLOCK_TAGS = {"br", "p", "div", "section", "article", "li", "tr", "table", "h1", "h2", "h3", "h4", "h5", "h6"}

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


def parse_index_links(index_html: str) -> list[dict[str, str]]:
    parser = EventParser()
    parser.feed(index_html)

    current_section: str | None = None
    discovered: list[dict[str, str]] = []
    seen_urls: set[str] = set()

    for kind, value, text in parser.events:
        if kind == "heading":
            if text in ALLOWED_SECTIONS:
                current_section = text
            elif text in SKIPPED_SECTIONS:
                current_section = None
            continue

        href = value
        if current_section not in ALLOWED_SECTIONS:
            continue
        if "/lineage:" not in href and not href.startswith("lineage:"):
            continue
        url = urljoin(BASE_URL, href if href.startswith("/") else f"/{href}")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        discovered.append(
            {
                "section": current_section,
                "name": text,
                "href": href,
                "url": url,
                "id": slugify(href.split(":")[-1]),
            }
        )

    return discovered


def parse_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def clean_page_text(text: str) -> str:
    cleaned = text
    if "FoldUnfold" in cleaned:
        cleaned = cleaned.split("FoldUnfold", 1)[-1]
    if "Help|Terms of Service" in cleaned:
        cleaned = cleaned.split("Help|Terms of Service", 1)[0]
    return cleaned.strip()


def paragraphs(text: str) -> list[str]:
    return [clean_text(part) for part in re.split(r"\n\s*\n", text) if clean_text(part)]


def first_meaningful_paragraph(parts: list[str], lineage_name: str) -> str:
    for part in parts:
        lowered = part.lower()
        if part == lineage_name:
            continue
        if lowered == "table of contents":
            continue
        if part in KNOWN_SOURCE_LABELS:
            continue
        if len(part) < 60:
            continue
        if lowered.startswith("ability score increase."):
            continue
        return part
    return ""


def parse_core_blocks(parts: list[str], lineage_name: str) -> tuple[list[str], list[dict[str, str]], list[str]]:
    stats: list[dict[str, str]] = []
    bonuses: list[str] = []
    traits: list[dict[str, str]] = []

    stat_prefixes = ("size.", "speed.", "languages.", "ability score increase.")

    for part in parts:
        lowered = part.lower()
        if part == lineage_name or part in KNOWN_SOURCE_LABELS:
            continue
        if lowered.startswith(stat_prefixes):
            label, value = part.split(".", 1)
            stats.append({"label": label.strip(), "value": value.strip()})
            bonuses.append(part)
            continue
        if "." in part and len(part) > 35:
            name, summary = part.split(".", 1)
            if len(name) < 40:
                traits.append(
                    {
                        "id": slugify(name),
                        "name": clean_text(name),
                        "summary": clean_text(summary),
                    }
                )

    return bonuses[:8], traits[:10], stats[:6]


def detect_subrace_headings(parts: list[str], lineage_name: str) -> list[str]:
    candidates: list[str] = []
    for part in parts:
        if part == lineage_name:
            continue
        if part in KNOWN_SOURCE_LABELS or part == "Table of Contents":
            continue
        if len(part) > 40 or "." in part:
            continue
        if re.fullmatch(r"[A-Z][A-Za-z'()\- ]+", part):
            candidates.append(part)
    return list(dict.fromkeys(candidates))


def extract_subrace_sections(parts: list[str], headings: list[str]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    indexes = {heading: parts.index(heading) for heading in headings if heading in parts}
    ordered = sorted(indexes.items(), key=lambda item: item[1])

    for position, (heading, start_index) in enumerate(ordered):
        end_index = ordered[position + 1][1] if position + 1 < len(ordered) else len(parts)
        section_parts = parts[start_index + 1 : end_index]
        section_summary = next((part for part in section_parts if len(part) > 50), "")
        bonuses = [part for part in section_parts if part.lower().startswith("ability score increase.") or len(part) < 220][:6]
        traits = []
        stats = []
        for part in section_parts:
            lowered = part.lower()
            if lowered.startswith(("ability score increase.", "size.", "speed.", "languages.")):
                label, value = part.split(".", 1)
                stats.append({"label": label.strip(), "value": value.strip()})
            elif "." in part and len(part) > 30:
                name, summary = part.split(".", 1)
                if len(name) < 40:
                    traits.append({"id": slugify(name), "name": clean_text(name), "summary": clean_text(summary)})
        result.append(
            {
                "id": slugify(heading),
                "name": heading,
                "summary": section_summary,
                "bonuses": bonuses,
                "traits": traits[:8],
                "stats": stats[:4],
            }
        )

    filtered: list[dict[str, object]] = []
    for entry in result:
        name = str(entry["name"])
        if name in KNOWN_SOURCE_LABELS:
            continue
        if not entry["summary"] and not entry["bonuses"]:
            continue
        filtered.append(entry)
    return filtered


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def scrape_lineage(entry: dict[str, str], pause_seconds: float) -> dict[str, object]:
    started_at = time.perf_counter()
    lineage_dir = OUTPUT_ROOT / entry["id"]
    html = fetch_html(entry["url"])
    text = clean_page_text(parse_text(html))
    parts = paragraphs(text)
    summary = first_meaningful_paragraph(parts, entry["name"])
    core_bonuses, core_traits, stats = parse_core_blocks(parts, entry["name"])
    subrace_candidates = [heading for heading in detect_subrace_headings(parts, entry["name"]) if heading != entry["name"]]
    subraces = extract_subrace_sections(parts, subrace_candidates)

    root_payload = {
        "id": entry["id"],
        "name": entry["name"],
        "sourceUrl": entry["url"],
        "sourceLabel": entry["section"],
        "summary": summary,
        "stats": stats,
        "coreBonuses": core_bonuses,
        "coreTraits": core_traits,
        "subraces": [subrace["id"] for subrace in subraces],
        "notes": [
            "raw text is preserved in page.txt for manual inspection",
            "subrace extraction is heuristic; inspect outputs for edge cases",
        ],
    }

    write_json(lineage_dir / "data.json", root_payload)
    (lineage_dir / "page.txt").write_text(text, encoding="utf-8")
    (lineage_dir / "page.html").write_text(html, encoding="utf-8")

    for subrace in subraces:
        write_json(lineage_dir / str(subrace["id"]) / "data.json", subrace)

    elapsed = time.perf_counter() - started_at
    print(
        f"[lineages] {entry['name']} | subrace: {len(subraces)} | "
        f"sure: {format_seconds(elapsed)}"
    )
    if pause_seconds:
        time.sleep(pause_seconds)

    return {
        "id": entry["id"],
        "name": entry["name"],
        "url": entry["url"],
        "section": entry["section"],
        "subraceCount": len(subraces),
        "path": str((lineage_dir / 'data.json')).replace("\\", "/"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect Wikidot lineage pages into content/lineages/<race>/data.json")
    parser.add_argument("--pause", type=float, default=0.25, help="Delay between requests in seconds.")
    parser.add_argument("--only", nargs="*", default=[], help="Optional lineage ids to fetch, e.g. dwarf elf")
    args = parser.parse_args()

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    started_at = time.perf_counter()
    print(f"[lineages] Basladi | index: {INDEX_URL}")
    index_html = fetch_html(INDEX_URL)
    entries = parse_index_links(index_html)
    only = {slugify(item) for item in args.only}
    if only:
      entries = [entry for entry in entries if entry["id"] in only]

    print(f"[lineages] Index tamam | bulunan lineage: {len(entries)}")
    manifests: list[dict[str, object]] = []
    total = len(entries)

    for index, entry in enumerate(entries, start=1):
        manifests.append(scrape_lineage(entry, args.pause))
        percent = (index / total * 100) if total else 100
        elapsed = time.perf_counter() - started_at
        print(
            f"[lineages] Ilerleme {index}/{total} "
            f"({percent:5.1f}%) | sure: {format_seconds(elapsed)} | son: {entry['name']}"
        )

    write_json(
        OUTPUT_ROOT / "manifest.json",
        {
            "source": INDEX_URL,
            "entryCount": len(entries),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "entries": manifests,
        },
    )

    total_elapsed = time.perf_counter() - started_at
    print(f"[lineages] Bitti | toplam: {len(entries)} | sure: {format_seconds(total_elapsed)}")


if __name__ == "__main__":
    main()
