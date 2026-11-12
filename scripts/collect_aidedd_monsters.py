from __future__ import annotations

import argparse
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen


INDEX_URL = "https://www.aidedd.org/dnd-filters/monsters.php"
DETAIL_BASE_URL = "https://www.aidedd.org/dnd/monstres.php"
OUTPUT_ROOT = Path("content/raw/aidedd-monsters")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
)
KNOWN_SOURCES = [
    "Monster Manual",
    "Fizban´s Treasury of Dragons",
    "FizbanÂ´s Treasury of Dragons",
    "Monsters of the Multiverse",
    "Glory of the Giants",
    "Rules",
    "Adventures",
    "Extra (miscellaneous)",
]
CR_TOKENS = [
    "1/8",
    "1/4",
    "1/2",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
    "14",
    "15",
    "16",
    "17",
    "18",
    "19",
    "20",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
    "30",
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "monster"


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


def fetch_html(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": "https://www.aidedd.org/",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", errors="replace")


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
    SKIP_TAGS = {"style", "script", "head", "title", "noscript"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.SKIP_TAGS:
            self._skip_depth += 1
            return
        if self._skip_depth:
            return
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = clean_text(data)
        if text:
            self.parts.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1
            return
        if self._skip_depth:
            return
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def text(self) -> str:
        return re.sub(r"\n{3,}", "\n\n", "".join(self.parts)).strip()


def parse_links(html: str) -> list[dict[str, str]]:
    parser = LinkCollector()
    parser.feed(html)
    return parser.links


def parse_text(html: str) -> str:
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()


def monster_url_from_href(href: str) -> str | None:
    parsed = urlparse(urljoin(DETAIL_BASE_URL, href))
    if not parsed.path.endswith("/monstres.php"):
        return None
    query = parse_qs(parsed.query)
    if "vo" not in query:
        return None
    vo = query["vo"][0].strip()
    if not vo:
        return None
    return f"{DETAIL_BASE_URL}?{urlencode({'vo': vo})}"


def extract_monster_urls_from_html(html: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()

    for link in parse_links(html):
        url = monster_url_from_href(link["href"])
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    for match in re.finditer(
        r"(?:href=)?[\"']?([^\"'>\s]*monstres\.php\?[^\"'>\s]*\bvo=[^\"'&>\s]+)",
        html,
        flags=re.I,
    ):
        candidate = match.group(1)
        url = monster_url_from_href(candidate)
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    for match in re.finditer(r"\bvo=([a-z0-9\-]+)\b", html, flags=re.I):
        vo = match.group(1).strip()
        if not vo:
            continue
        url = f"{DETAIL_BASE_URL}?{urlencode({'vo': vo})}"
        if url not in seen:
            seen.add(url)
            urls.append(url)

    return urls


def extract_name_from_index_line(line: str) -> str:
    trimmed = line
    for source in KNOWN_SOURCES:
        if source in trimmed:
            trimmed = trimmed.split(source, 1)[0].strip()
            break

    for token in sorted(CR_TOKENS, key=len, reverse=True):
        marker = f"{token} "
        position = trimmed.find(marker)
        if position > 0:
            return clean_text(trimmed[:position])
        tight_marker = token + "Humanoid"
        position = trimmed.find(tight_marker)
        if position > 0:
            return clean_text(trimmed[:position])

    return ""


def extract_source_from_index_line(line: str) -> str:
    if not line:
        return ""
    for source in KNOWN_SOURCES:
        if source in line:
            return source
    return ""


def extract_index_records_from_visible_text(html: str) -> list[dict[str, str]]:
    text = parse_text(html)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    records: list[dict[str, str]] = []
    seen: set[str] = set()

    for line in lines:
        if not any(source in line for source in KNOWN_SOURCES):
            continue
        if line.startswith("Creature CR Type"):
            continue
        if line.startswith("Monsters 5e"):
            continue

        name = extract_name_from_index_line(line)
        if not name:
            continue

        slug = slugify(name)
        url = f"{DETAIL_BASE_URL}?{urlencode({'vo': slug})}"
        if url in seen:
            continue
        seen.add(url)
        records.append(
            {
                "id": slug,
                "slug": slug,
                "name": name,
                "url": url,
            }
        )

    return records


def extract_index_records(html: str) -> list[dict[str, object]]:
    links = parse_links(html)
    link_text_by_url: dict[str, str] = {}
    for link in links:
        url = monster_url_from_href(link["href"])
        if url and link["text"] and url not in link_text_by_url:
            link_text_by_url[url] = link["text"]

    monster_links: list[dict[str, str]] = []
    for url in extract_monster_urls_from_html(html):
        vo = parse_qs(urlparse(url).query)["vo"][0]
        monster_links.append(
            {
                "id": slugify(vo),
                "slug": vo,
                "name": link_text_by_url.get(url, vo.replace("-", " ").title()),
                "url": url,
            }
        )

    if not monster_links:
        monster_links = extract_index_records_from_visible_text(html)

    text = parse_text(html)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    line_by_name: dict[str, str] = {}

    for record in monster_links:
        name = str(record["name"])
        matched_line = ""
        for line in lines:
            if line.startswith(name):
                matched_line = line
                break
        line_by_name[name] = matched_line

    records: list[dict[str, object]] = []
    for record in monster_links:
        line = line_by_name.get(str(record["name"]), "")
        records.append(
            {
                **record,
                "indexLine": line,
                "legendary": "Legendary" in line,
                "source": extract_source_from_index_line(line),
            }
        )
    return records


def extract_line_value(text: str, label: str) -> str:
    match = re.search(rf"(?mi)^{re.escape(label)}\s+(.+)$", text)
    return clean_text(match.group(1)) if match else ""


def extract_ability_scores(text: str) -> dict[str, str]:
    pattern = (
        r"STR\s+([0-9]+ \([^)]+\))\s+DEX\s+([0-9]+ \([^)]+\))\s+CON\s+([0-9]+ \([^)]+\))\s+"
        r"INT\s+([0-9]+ \([^)]+\))\s+WIS\s+([0-9]+ \([^)]+\))\s+CHA\s+([0-9]+ \([^)]+\))"
    )
    match = re.search(pattern, text, flags=re.S)
    if not match:
        return {}
    return {
        "STR": clean_text(match.group(1)),
        "DEX": clean_text(match.group(2)),
        "CON": clean_text(match.group(3)),
        "INT": clean_text(match.group(4)),
        "WIS": clean_text(match.group(5)),
        "CHA": clean_text(match.group(6)),
    }


def extract_sections(text: str) -> dict[str, list[str]]:
    section_names = [
        "Actions",
        "Bonus Actions",
        "Reactions",
        "Legendary Actions",
        "Mythic Actions",
        "Lair Actions",
    ]
    locations: list[tuple[str, int]] = []
    for name in section_names:
        match = re.search(rf"(?m)^{re.escape(name)}$", text)
        if match:
            locations.append((name, match.start()))
    locations.sort(key=lambda item: item[1])

    sections: dict[str, list[str]] = {}
    for index, (name, start) in enumerate(locations):
        end = locations[index + 1][1] if index + 1 < len(locations) else len(text)
        chunk = text[start + len(name) : end].strip()
        lines = [line.strip() for line in chunk.splitlines() if line.strip()]
        sections[name] = lines
    return sections


def extract_traits(text: str) -> list[str]:
    start = re.search(r"(?m)^Challenge\s+.+$", text)
    if not start:
        return []
    section_names = [
        "Actions",
        "Bonus Actions",
        "Reactions",
        "Legendary Actions",
        "Mythic Actions",
        "Lair Actions",
    ]
    ends = [re.search(rf"(?m)^{re.escape(name)}$", text) for name in section_names]
    valid_ends = [match.start() for match in ends if match]
    end_index = min(valid_ends) if valid_ends else len(text)
    chunk = text[start.end() : end_index].strip()
    return [line.strip() for line in chunk.splitlines() if line.strip()]


def extract_lore(text: str) -> str:
    section_names = [
        "Legendary Actions",
        "Mythic Actions",
        "Lair Actions",
        "Reactions",
        "Bonus Actions",
        "Actions",
    ]
    last_end = 0
    for name in section_names:
        matches = list(re.finditer(rf"(?m)^{re.escape(name)}$", text))
        if not matches:
            continue
        match = matches[-1]
        last_end = max(last_end, match.end())
    if last_end == 0:
        return ""
    lore = text[last_end:].strip()
    lines = [line.strip() for line in lore.splitlines() if line.strip()]
    return " ".join(lines)


def parse_monster_detail(record: dict[str, object], html: str) -> dict[str, object]:
    text = parse_text(html)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    subtitle = lines[1] if len(lines) > 1 else ""
    sections = extract_sections(text)

    return {
        **record,
        "title": lines[0] if lines else record["name"],
        "subtitle": subtitle,
        "armorClass": extract_line_value(text, "Armor Class"),
        "hitPoints": extract_line_value(text, "Hit Points"),
        "speed": extract_line_value(text, "Speed"),
        "savingThrows": extract_line_value(text, "Saving Throws"),
        "skills": extract_line_value(text, "Skills"),
        "damageVulnerabilities": extract_line_value(text, "Damage Vulnerabilities"),
        "damageResistances": extract_line_value(text, "Damage Resistances"),
        "damageImmunities": extract_line_value(text, "Damage Immunities"),
        "conditionImmunities": extract_line_value(text, "Condition Immunities"),
        "senses": extract_line_value(text, "Senses"),
        "languages": extract_line_value(text, "Languages"),
        "challenge": extract_line_value(text, "Challenge"),
        "proficiencyBonus": extract_line_value(text, "Proficiency Bonus"),
        "abilityScores": extract_ability_scores(text),
        "traits": extract_traits(text),
        "actions": sections.get("Actions", []),
        "bonusActions": sections.get("Bonus Actions", []),
        "reactions": sections.get("Reactions", []),
        "legendaryActions": sections.get("Legendary Actions", []),
        "mythicActions": sections.get("Mythic Actions", []),
        "lairActions": sections.get("Lair Actions", []),
        "lore": extract_lore(text),
        "rawText": text,
    }


def scrape_monsters(pause_seconds: float) -> dict[str, object]:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    details_root = OUTPUT_ROOT / "details"
    details_root.mkdir(parents=True, exist_ok=True)

    started_at = time.perf_counter()
    print("[aidedd-monsters] Basladi | index cekiliyor", flush=True)
    index_html = fetch_html(INDEX_URL)
    index_records = extract_index_records(index_html)
    total = len(index_records)

    if total == 0:
        (OUTPUT_ROOT / "index-response.html").write_text(index_html, encoding="utf-8")
        manifest = {
            "source": DETAIL_BASE_URL,
            "indexSource": INDEX_URL,
            "entryCount": 0,
            "fetchedCount": 0,
            "errorCount": 1,
            "durationSeconds": round(time.perf_counter() - started_at, 2),
            "error": "No monster links were discovered on the index page. Inspect index HTML or update parser.",
            "debugHtml": str((OUTPUT_ROOT / "index-response.html")).replace("\\", "/"),
        }
        (OUTPUT_ROOT / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print("[aidedd-monsters] Hata | index parse 0 monster dondu", flush=True)
        return manifest

    (OUTPUT_ROOT / "index.json").write_text(
        json.dumps(index_records, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[aidedd-monsters] Index hazir | bulundu: {total}", flush=True)

    records: list[dict[str, object]] = []
    success_count = 0
    error_count = 0

    for index, record in enumerate(index_records, start=1):
        try:
            html = fetch_html(str(record["url"]))
            detailed = parse_monster_detail(record, html)
            (details_root / f"{record['id']}.json").write_text(
                json.dumps(detailed, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            records.append(detailed)
            success_count += 1
        except (HTTPError, URLError, TimeoutError) as error:
            records.append({**record, "error": str(error)})
            error_count += 1

        elapsed = time.perf_counter() - started_at
        percent = (index / total * 100) if total else 100
        print(
            f"[aidedd-monsters] {index}/{total} tamamlandi ({percent:5.1f}%) | "
            f"basarili: {success_count} | hatali: {error_count} | sure: {format_seconds(elapsed)} | "
            f"son: {record['name']}",
            flush=True,
        )

        if pause_seconds and index < total:
            time.sleep(pause_seconds)

    all_path = OUTPUT_ROOT / "all.json"
    all_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "source": DETAIL_BASE_URL,
        "indexSource": INDEX_URL,
        "entryCount": total,
        "fetchedCount": success_count,
        "errorCount": error_count,
        "durationSeconds": round(time.perf_counter() - started_at, 2),
        "artifacts": {
            "index": str((OUTPUT_ROOT / "index.json")).replace("\\", "/"),
            "all": str(all_path).replace("\\", "/"),
            "details": str(details_root).replace("\\", "/"),
        },
    }
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"[aidedd-monsters] Bitti | cekilen: {success_count}/{total} | "
        f"hatali: {error_count} | sure: {format_seconds(time.perf_counter() - started_at)}",
        flush=True,
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Collect all monsters from aidedd.org with progress output.")
    parser.add_argument(
        "--pause",
        type=float,
        default=0.15,
        help="Delay in seconds between monster detail requests.",
    )
    args = parser.parse_args()

    manifest = scrape_monsters(args.pause)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
