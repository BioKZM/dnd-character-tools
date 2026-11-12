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
OUTPUT_ROOT = Path("content/raw/wikidot")
USER_AGENT = "DNDBeyond-Codex-Scraper/1.0 (+https://dnd5e.wikidot.com)"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "entry"


def wikidot_url(href: str) -> str:
    if href.startswith("http://") or href.startswith("https://"):
        return href
    if href.startswith("/"):
        return urljoin(BASE_URL, href)
    return f"{BASE_URL}/{href}"


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[dict[str, str]] = []
        self._current_href: str | None = None
        self._current_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        attribute_map = dict(attrs)
        href = attribute_map.get("href")
        if href:
            self._current_href = href
            self._current_text = []

    def handle_data(self, data: str) -> None:
        if self._current_href is not None:
            self._current_text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._current_href is None:
            return
        self.links.append(
            {
                "href": self._current_href,
                "text": clean_text("".join(self._current_text)),
            }
        )
        self._current_href = None
        self._current_text = []


class TextExtractor(HTMLParser):
    BLOCK_TAGS = {
        "br",
        "p",
        "div",
        "section",
        "article",
        "li",
        "tr",
        "table",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
    }

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
class Category:
    id: str
    index_paths: tuple[str, ...]
    matcher: Callable[[str], bool]


CATEGORIES = [
    Category("spells", ("/spells",), lambda href: "/spell:" in href or href.startswith("spell:")),
    Category("species", ("/lineage",), lambda href: "/lineage:" in href or href.startswith("lineage:")),
    Category("feats", ("/feats", "/feat"), lambda href: "/feat:" in href or href.startswith("feat:")),
    Category(
        "backgrounds",
        ("/backgrounds", "/background"),
        lambda href: "/background:" in href or href.startswith("background:"),
    ),
]


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


def fetch_first_index(category: Category) -> tuple[str, str]:
    last_error: Exception | None = None
    for candidate in category.index_paths:
        index_url = wikidot_url(candidate)
        try:
            return index_url, fetch_html(index_url)
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
    if last_error is not None:
        raise last_error
    raise RuntimeError(f"No index URL candidates configured for {category.id}")


def parse_links(html: str) -> list[dict[str, str]]:
    parser = LinkCollector()
    parser.feed(html)
    return parser.links


def parse_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def unique_entries(entries: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    result: list[dict[str, str]] = []
    for entry in entries:
        url = entry["url"]
        if url in seen:
            continue
        seen.add(url)
        result.append(entry)
    return result


def scrape_category(category: Category, pause_seconds: float) -> dict[str, object]:
    started_at = time.perf_counter()
    print(f"[{category.id}] Index aranıyor: {', '.join(category.index_paths)}")
    index_url, index_html = fetch_first_index(category)
    index_links = parse_links(index_html)

    entries = []
    for link in index_links:
        href = link["href"]
        if not category.matcher(href):
            continue
        entries.append(
            {
                "name": link["text"] or href.split(":")[-1].replace("-", " ").title(),
                "href": href,
                "url": wikidot_url(href),
            }
        )

    entries = unique_entries(entries)
    print(f"[{category.id}] {len(entries)} kayıt bulundu. Index: {index_url}")
    category_dir = OUTPUT_ROOT / category.id
    details_dir = category_dir / "details"
    category_dir.mkdir(parents=True, exist_ok=True)
    details_dir.mkdir(parents=True, exist_ok=True)

    (category_dir / "index.html").write_text(index_html, encoding="utf-8")
    (category_dir / "index.json").write_text(
        json.dumps(
            {
                "category": category.id,
                "indexUrl": index_url,
                "entryCount": len(entries),
                "entries": entries,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    details = []
    success_count = 0
    error_count = 0
    progress_every = 10

    for index, entry in enumerate(entries, start=1):
        try:
            html = fetch_html(entry["url"])
            text = parse_text(html)
            detail = {
                "id": slugify(entry["href"].split(":")[-1]),
                "name": entry["name"],
                "href": entry["href"],
                "url": entry["url"],
                "text": text,
            }
            detail_path = details_dir / f"{detail['id']}.json"
            detail_path.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
            details.append(
                {
                    "id": detail["id"],
                    "name": detail["name"],
                    "url": detail["url"],
                    "detailPath": str(detail_path).replace("\\", "/"),
                }
            )
            success_count += 1
        except (HTTPError, URLError, TimeoutError) as error:
            details.append(
                {
                    "id": slugify(entry["href"].split(":")[-1]),
                    "name": entry["name"],
                    "url": entry["url"],
                    "error": str(error),
                }
            )
            error_count += 1

        should_print = index == 1 or index == len(entries) or index % progress_every == 0
        if should_print:
            elapsed = time.perf_counter() - started_at
            percent = (index / len(entries) * 100) if entries else 100
            print(
                f"[{category.id}] {index}/{len(entries)} tamamlandi "
                f"({percent:5.1f}%) | basarili: {success_count} | hatali: {error_count} | "
                f"sure: {format_seconds(elapsed)} | son: {entry['name']}"
            )
        if pause_seconds and index < len(entries):
            time.sleep(pause_seconds)

    manifest = {
        "category": category.id,
        "indexUrl": index_url,
        "entryCount": len(entries),
        "fetchedCount": sum(1 for item in details if "detailPath" in item),
        "details": details,
    }
    (category_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    total_elapsed = time.perf_counter() - started_at
    print(
        f"[{category.id}] Bitti | cekilen: {manifest['fetchedCount']}/{manifest['entryCount']} "
        f"| hatali: {error_count} | toplam sure: {format_seconds(total_elapsed)}"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape raw D&D 5e Wikidot data to JSON files.")
    parser.add_argument(
        "--categories",
        nargs="*",
        default=[category.id for category in CATEGORIES],
        help="Subset of categories to scrape.",
    )
    parser.add_argument(
        "--pause",
        type=float,
        default=0.35,
        help="Delay in seconds between detail page requests.",
    )
    args = parser.parse_args()

    selected = [category for category in CATEGORIES if category.id in set(args.categories)]
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    manifests = [scrape_category(category, args.pause) for category in selected]
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps({"generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "categories": manifests}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    for manifest in manifests:
        print(f"{manifest['category']}: {manifest['fetchedCount']}/{manifest['entryCount']} fetched")


if __name__ == "__main__":
    main()
