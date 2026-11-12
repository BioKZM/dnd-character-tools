from __future__ import annotations

import argparse
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen


BASE_URL = "https://dnd5e.wikidot.com"
INDEX_URL = f"{BASE_URL}/lineage"
DEFAULT_OUTPUT_ROOT = Path("content/lineages-curated")
USER_AGENT = "DNDBeyond-Lineage-Curated-Scraper/2.0 (+https://dnd5e.wikidot.com)"

INCLUDED_SECTIONS = {
    "Standard Lineages": "Player's Handbook",
    "Exotic Lineages": "Mordenkainen Presents: Monsters of the Multiverse",
    "Monstrous Lineages": "Mordenkainen Presents: Monsters of the Multiverse",
}

SOURCE_ALIASES = {
    "Player's Handbook": {"Player's Handbook"},
    "Mordenkainen Presents: Monsters of the Multiverse": {
        "Mordenkainen Presents: Monsters of the Multiverse",
        "Monsters of the Multiverse",
    },
}

SKIP_TOKENS = {
    "window-nitroads",
    "you-should-be-logged-in-to-clone-a-site",
}

STAT_LABELS = {"Ability Score Increase", "Size", "Speed", "Languages"}
FLEXIBLE_ABILITY_SCORE_TEXT = (
    "When determining your character’s ability scores, increase one score by 2 "
    "and increase a different score by 1, or increase three different scores by 1. "
    "You can't raise any of your scores above 20."
)


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


class IndexParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.events: list[tuple[str, str, str]] = []
        self._tag: str | None = None
        self._href: str | None = None
        self._buffer: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"h1", "h2", "h3", "h4", "a"}:
            self._tag = tag
            self._buffer = []
            if tag == "a":
                self._href = dict(attrs).get("href")

    def handle_data(self, data: str) -> None:
        if self._tag:
            self._buffer.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != self._tag:
            return
        text = clean_text("".join(self._buffer))
        if text:
            if tag == "a" and self._href:
                self.events.append(("link", self._href, text))
            else:
                self.events.append(("heading", tag, text))
        self._tag = None
        self._href = None
        self._buffer = []


def parse_index_links(index_html: str) -> list[dict[str, str]]:
    parser = IndexParser()
    parser.feed(index_html)

    current_section: str | None = None
    seen_urls: set[str] = set()
    results: list[dict[str, str]] = []

    for kind, value, text in parser.events:
        if kind == "heading":
            current_section = text if text in INCLUDED_SECTIONS else None
            continue
        if current_section not in INCLUDED_SECTIONS:
            continue
        if "/lineage:" not in value and not value.startswith("lineage:"):
            continue

        url = urljoin(BASE_URL, value if value.startswith("/") else f"/{value}")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        results.append(
            {
                "section": current_section,
                "name": text,
                "url": url,
                "id": slugify(value.split(":")[-1]),
            }
        )

    return results


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_page_content = False
        self.page_depth = 0
        self.in_toc = False
        self.toc_depth = 0
        self.in_script = False
        self.in_style = False

        self.current_toc_level = 0
        self.current_toc_href: str | None = None
        self.current_toc_text: list[str] = []
        self.toc_entries: list[dict[str, object]] = []

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
            if attrs_map.get("id") == "toc":
                self.in_toc = True
                self.toc_depth = 1
                return
            if self.in_toc:
                self.toc_depth += 1
                style = attrs_map.get("style") or ""
                match = re.search(r"margin-left:\s*([0-9.]+)em", style)
                if match:
                    margin = float(match.group(1))
                    self.current_toc_level = 1 if margin < 1.5 else 2
            return

        if self.in_toc:
            if tag == "a":
                self.current_toc_href = attrs_map.get("href")
                self.current_toc_text = []
            return

        if tag in {"h1", "h2", "p", "li"}:
            self.current_block = {"type": tag, "id": attrs_map.get("id")}
            self.current_text = []
            return

        if tag == "table":
            self.current_block = {"type": "table"}
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
        if self.in_toc and self.current_toc_href is not None:
            self.current_toc_text.append(data)
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
            if self.in_toc:
                self.toc_depth -= 1
                if self.toc_depth <= 0:
                    self.in_toc = False
                    self.current_toc_level = 0
            self.page_depth -= 1
            if self.page_depth <= 0:
                self.in_page_content = False
            return

        if self.in_toc:
            if tag == "a" and self.current_toc_href:
                text = clean_text("".join(self.current_toc_text))
                if text:
                    self.toc_entries.append(
                        {
                            "title": text,
                            "href": self.current_toc_href,
                            "level": self.current_toc_level or 1,
                        }
                    )
                self.current_toc_href = None
                self.current_toc_text = []
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
            self.current_block = None
            return

        if self.current_block is not None and tag == self.current_block["type"]:
            text = clean_text("".join(self.current_text))
            if text and not contains_skip_token(text):
                block = dict(self.current_block)
                block["text"] = text
                self.blocks.append(block)
            self.current_block = None
            self.current_text = []


def parse_page(html: str) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    parser = PageParser()
    parser.feed(html)
    return parser.toc_entries, parser.blocks


def normalize_toc_title(value: str) -> str:
    return clean_text(value)


def extract_stat(text: str) -> dict[str, str] | None:
    if "." not in text:
        return None
    label, value = text.split(".", 1)
    label = clean_text(label)
    value = clean_text(value)
    if label in STAT_LABELS and value:
        return {"label": label, "value": value}
    return None


def extract_trait(text: str) -> dict[str, str] | None:
    if "." not in text:
        return None
    name, summary = text.split(".", 1)
    name = clean_text(name)
    summary = clean_text(summary)
    if not name or not summary or name in STAT_LABELS or contains_skip_token(name) or contains_skip_token(summary):
        return None
    return {"id": slugify(name), "name": name, "summary": summary}


def has_flexible_ability_score_rule(stats: list[dict[str, str]]) -> bool:
    normalized_target = clean_text(FLEXIBLE_ABILITY_SCORE_TEXT).lower().replace("’", "'")
    for stat in stats:
      if stat["label"] != "Ability Score Increase":
          continue
      normalized_value = clean_text(stat["value"]).lower().replace("’", "'")
      if normalized_target in normalized_value:
          return True
    return False


def block_index_by_anchor(blocks: list[dict[str, object]]) -> dict[str, int]:
    result: dict[str, int] = {}
    for index, block in enumerate(blocks):
        block_id = block.get("id")
        if isinstance(block_id, str) and block_id:
            result[block_id] = index
    return result


def collect_source_slice(
    entry: dict[str, str],
    toc_entries: list[dict[str, object]],
    blocks: list[dict[str, object]],
) -> tuple[str, list[dict[str, object]], list[dict[str, object]]]:
    target_source = INCLUDED_SECTIONS[entry["section"]]
    aliases = SOURCE_ALIASES[target_source]

    source_entry = next(
        (
            item
            for item in toc_entries
            if int(item["level"]) == 1 and normalize_toc_title(str(item["title"])) in aliases
        ),
        None,
    )
    if source_entry is None:
        raise ValueError("Target source was not found in table of contents.")

    top_level_entries = [item for item in toc_entries if int(item["level"]) == 1]
    source_position = top_level_entries.index(source_entry)
    next_source_entry = top_level_entries[source_position + 1] if source_position + 1 < len(top_level_entries) else None

    block_map = block_index_by_anchor(blocks)
    source_anchor = str(source_entry["href"]).lstrip("#")
    if source_anchor not in block_map:
        raise ValueError("Target source anchor was not found in page content.")

    start_index = block_map[source_anchor]
    end_index = block_map[str(next_source_entry["href"]).lstrip("#")] if next_source_entry else len(blocks)
    selected_blocks = blocks[start_index:end_index]

    subrace_entries = []
    source_toc_index = toc_entries.index(source_entry)
    for item in toc_entries[source_toc_index + 1 :]:
        if int(item["level"]) == 1:
            break
        if int(item["level"]) == 2:
            subrace_entries.append(item)

    return target_source, selected_blocks, subrace_entries


def summarize_source_blocks(blocks: list[dict[str, object]]) -> tuple[str, list[dict[str, str]], list[dict[str, str]]]:
    summary = ""
    stats: list[dict[str, str]] = []
    traits: list[dict[str, str]] = []

    for block in blocks:
        if block["type"] == "h2":
            break
        if block["type"] == "p" and not summary:
            summary = str(block["text"])
        if block["type"] == "li":
            text = str(block["text"])
            stat = extract_stat(text)
            if stat:
                stats.append(stat)
                continue
            trait = extract_trait(text)
            if trait:
                traits.append(trait)

    return summary, stats, traits


def subrace_slice(
    blocks: list[dict[str, object]],
    subrace_anchor: str,
    next_anchor: str | None,
) -> list[dict[str, object]]:
    block_map = block_index_by_anchor(blocks)
    if subrace_anchor not in block_map:
        return []
    start_index = block_map[subrace_anchor]
    end_index = block_map[next_anchor] if next_anchor and next_anchor in block_map else len(blocks)
    return blocks[start_index:end_index]


def summarize_subrace_blocks(blocks: list[dict[str, object]], fallback_name: str) -> dict[str, object]:
    summary = ""
    stats: list[dict[str, str]] = []
    traits: list[dict[str, str]] = []
    bonuses: list[str] = []
    tables: list[dict[str, object]] = []

    for block in blocks[1:]:
        if block["type"] == "p" and not summary:
            summary = str(block["text"])
        elif block["type"] == "li":
            text = str(block["text"])
            stat = extract_stat(text)
            if stat:
                stats.append(stat)
                bonuses.append(text)
                continue
            trait = extract_trait(text)
            if trait:
                traits.append(trait)
                bonuses.append(text)
        elif block["type"] == "table":
            tables.append({"rows": block["rows"]})

    return {
        "id": slugify(fallback_name),
        "name": fallback_name,
        "summary": summary,
        "bonuses": bonuses,
        "traits": traits,
        "stats": stats,
        "flexibleAbilityScoreIncrease": has_flexible_ability_score_rule(stats),
        "tables": tables,
    }


def scrape_lineage(entry: dict[str, str], pause_seconds: float, output_root: Path) -> dict[str, object] | None:
    started_at = time.perf_counter()
    lineage_dir = output_root / entry["id"]
    html = fetch_html(entry["url"])
    toc_entries, blocks = parse_page(html)

    try:
        matched_source, source_blocks, subrace_toc_entries = collect_source_slice(entry, toc_entries, blocks)
    except ValueError:
        print(f"[lineages-curated] Skip | {entry['name']} | source mismatch")
        return None

    summary, stats, traits = summarize_source_blocks(source_blocks)
    subraces: list[dict[str, object]] = []

    for index, toc_entry in enumerate(subrace_toc_entries):
        current_anchor = str(toc_entry["href"]).lstrip("#")
        next_anchor = (
            str(subrace_toc_entries[index + 1]["href"]).lstrip("#")
            if index + 1 < len(subrace_toc_entries)
            else None
        )
        blocks_for_subrace = subrace_slice(source_blocks, current_anchor, next_anchor)
        if not blocks_for_subrace:
            continue
        subrace = summarize_subrace_blocks(blocks_for_subrace, str(toc_entry["title"]))
        subraces.append(subrace)

    root_payload = {
        "id": entry["id"],
        "name": entry["name"],
        "sourceUrl": entry["url"],
        "sourceLabel": entry["section"],
        "sourceBook": matched_source,
        "summary": summary,
        "stats": stats,
        "coreBonuses": [],
        "coreTraits": traits,
        "flexibleAbilityScoreIncrease": has_flexible_ability_score_rule(stats),
        "subraces": [subrace["id"] for subrace in subraces],
        "notes": [
            "source isolated from page-content and table of contents",
            "raw text is preserved in page.html for manual inspection",
        ],
    }

    write_json(lineage_dir / "data.json", root_payload)
    (lineage_dir / "page.html").write_text(html, encoding="utf-8")

    for subrace in subraces:
        write_json(lineage_dir / str(subrace["id"]) / "data.json", subrace)

    elapsed = time.perf_counter() - started_at
    print(f"[lineages-curated] {entry['name']} | subrace: {len(subraces)} | sure: {format_seconds(elapsed)}")
    if pause_seconds:
        time.sleep(pause_seconds)

    return {
        "id": entry["id"],
        "name": entry["name"],
        "url": entry["url"],
        "section": entry["section"],
        "sourceBook": matched_source,
        "subraceCount": len(subraces),
        "path": str((lineage_dir / "data.json")).replace("\\", "/"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect curated Wikidot lineage pages using TOC + page-content parsing.")
    parser.add_argument("--pause", type=float, default=0.25, help="Delay between requests in seconds.")
    parser.add_argument("--only", nargs="*", default=[], help="Optional lineage ids to fetch, e.g. dwarf elf")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT), help="Output directory.")
    args = parser.parse_args()

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    started_at = time.perf_counter()
    print(f"[lineages-curated] Basladi | index: {INDEX_URL}")
    index_html = fetch_html(INDEX_URL)
    entries = parse_index_links(index_html)
    only = {slugify(item) for item in args.only}
    if only:
        entries = [entry for entry in entries if entry["id"] in only]

    print(f"[lineages-curated] Index tamam | aday lineage: {len(entries)}")
    manifests: list[dict[str, object]] = []
    total = len(entries)

    for index, entry in enumerate(entries, start=1):
        record = scrape_lineage(entry, args.pause, output_root)
        if record:
            manifests.append(record)
        percent = (index / total * 100) if total else 100
        elapsed = time.perf_counter() - started_at
        print(
            f"[lineages-curated] Ilerleme {index}/{total} "
            f"({percent:5.1f}%) | sure: {format_seconds(elapsed)} | son: {entry['name']}"
        )

    write_json(
        output_root / "manifest.json",
        {
            "source": INDEX_URL,
            "entryCount": len(manifests),
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "entries": manifests,
        },
    )

    total_elapsed = time.perf_counter() - started_at
    print(f"[lineages-curated] Bitti | toplam: {len(manifests)} | sure: {format_seconds(total_elapsed)}")


if __name__ == "__main__":
    main()
