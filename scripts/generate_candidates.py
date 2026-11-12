from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent.parent
RAW_MANIFEST_PATH = ROOT / "content" / "raw" / "books" / "index.json"
OUTPUT_DIR = ROOT / "content" / "normalized" / "candidates"

SPELL_SCHOOLS = [
    "abjuration",
    "conjuration",
    "divination",
    "enchantment",
    "evocation",
    "illusion",
    "necromancy",
    "transmutation",
]

NOISE_PREFIXES = {
    "chapter",
    "appendix",
    "contents",
    "credits",
    "introduction",
    "using this book",
    "spell descriptions",
}

SPELL_BLOCKLIST = {
    "bonus cantrip",
    "druid level circle spells",
    "signature spells",
    "spell mastery",
    "spellbook",
}

FEAT_BLOCKLIST = {
    "charisma",
    "constitution",
    "class features",
    "dash",
    "bonus cantrip",
    "bonus proficiencies",
    "bonus proficiency",
    "dark one's blessing",
    "beast speech",
    "beguiling influence",
    "bewitching whispers",
}


@dataclass
class Candidate:
    id: str
    name: str
    bookId: str
    sourceTitle: str
    page: int
    snippet: str
    category: str
    confidence: str


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def clean_line(value: str) -> str:
    value = collapse_whitespace(value)
    value = value.replace("’", "'").replace("“", '"').replace("”", '"')
    return value.strip(" -:\t")


def is_title_case_candidate(line: str) -> bool:
    if not line or len(line) > 48:
        return False
    if line.lower() in NOISE_PREFIXES:
        return False
    if line == line.upper():
        return False
    if not re.match(r"^[A-Za-z][A-Za-z' -]+$", line):
        return False

    words = [part for part in line.split(" ") if part]
    capitalized = [word for word in words if word[0].isupper()]
    return len(capitalized) == len(words)


def spell_context(lines: list[str], index: int) -> tuple[bool, str]:
    window = " ".join(lines[index + 1 : index + 5]).lower()
    has_level = re.search(r"\b(cantrip|\d+(st|nd|rd|th)-level)\b", window)
    has_school = any(school in window for school in SPELL_SCHOOLS)
    if has_level and has_school:
        return True, "high"
    if has_level or has_school:
        return True, "medium"
    return False, "low"


def feat_context(lines: list[str], index: int) -> tuple[bool, str]:
    window = " ".join(lines[index + 1 : index + 6]).lower()
    if "prerequisite" in window:
        return True, "high"
    if any(token in window for token in ["increase", "you learn one spell", "you gain the following benefits"]):
        return True, "medium"
    return False, "low"


def build_snippet(lines: list[str], index: int, size: int = 4) -> str:
    return collapse_whitespace(" ".join(lines[index : index + size]))[:280]


def dedupe(candidates: list[Candidate]) -> list[Candidate]:
    seen: dict[tuple[str, str], Candidate] = {}
    for candidate in candidates:
      key = (candidate.category, candidate.id)
      current = seen.get(key)
      if current is None:
          seen[key] = candidate
          continue
      rank = {"high": 3, "medium": 2, "low": 1}
      if rank[candidate.confidence] > rank[current.confidence]:
          seen[key] = candidate
    return sorted(seen.values(), key=lambda item: (item.category, item.name, item.bookId, item.page))


def extract_spell_candidates(book: dict[str, object], pages: list[str]) -> list[Candidate]:
    candidates: list[Candidate] = []
    hint_pages = {
        item["page"]
        for item in book.get("detectedSections", {}).get("spellCandidatePages", [])
        if isinstance(item, dict) and "page" in item
    }

    for page_number in hint_pages:
        page_text = pages[page_number - 1]
        lines = [clean_line(line) for line in page_text.splitlines()]
        lines = [line for line in lines if line]

        for index, line in enumerate(lines):
            if not is_title_case_candidate(line):
                continue
            if line.lower() in SPELL_BLOCKLIST or "spell" in line.lower():
                continue
            ok, confidence = spell_context(lines, index)
            if not ok:
                continue
            candidates.append(
                Candidate(
                    id=slugify(line),
                    name=line,
                    bookId=book["id"],
                    sourceTitle=book["title"],
                    page=page_number,
                    snippet=build_snippet(lines, index),
                    category="spell",
                    confidence=confidence,
                )
            )

    return candidates


def extract_feat_candidates(book: dict[str, object], pages: list[str]) -> list[Candidate]:
    candidates: list[Candidate] = []

    for page_number, page_text in enumerate(pages, start=1):
        lines = [clean_line(line) for line in page_text.splitlines()]
        lines = [line for line in lines if line]
        page_blob = " ".join(lines).lower()

        if not re.search(r"\bfeats?\b", page_blob):
            continue

        for index, line in enumerate(lines):
            if not is_title_case_candidate(line):
                continue
            if line.lower() in FEAT_BLOCKLIST:
                continue
            ok, confidence = feat_context(lines, index)
            if not ok:
                continue
            candidates.append(
                Candidate(
                    id=slugify(line),
                    name=line,
                    bookId=book["id"],
                    sourceTitle=book["title"],
                    page=page_number,
                    snippet=build_snippet(lines, index, size=5),
                    category="feat",
                    confidence=confidence,
                )
            )

    return candidates


def main() -> None:
    started_at = time.perf_counter()
    manifest = json.loads(RAW_MANIFEST_PATH.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    spells: list[Candidate] = []
    feats: list[Candidate] = []

    for book in manifest["books"]:
        if book.get("status") != "extracted":
            continue
        book_started_at = time.perf_counter()
        print(f"[{book['id']}] Candidate extraction basladi: {book['title']}")
        reader = PdfReader(str(book["sourcePath"]))
        pages = [(page.extract_text() or "") for page in reader.pages]
        before_spells = len(spells)
        before_feats = len(feats)
        spells.extend(extract_spell_candidates(book, pages))
        feats.extend(extract_feat_candidates(book, pages))
        elapsed = time.perf_counter() - book_started_at
        print(
            f"[{book['id']}] Bitti | yeni spell adaylari: {len(spells) - before_spells} | "
            f"yeni feat adaylari: {len(feats) - before_feats} | sure: {format_seconds(elapsed)}"
        )

    deduped_spells = dedupe(spells)
    deduped_feats = dedupe(feats)

    (OUTPUT_DIR / "spells.json").write_text(
        json.dumps([asdict(item) for item in deduped_spells], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (OUTPUT_DIR / "feats.json").write_text(
        json.dumps([asdict(item) for item in deduped_feats], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (OUTPUT_DIR / "summary.json").write_text(
        json.dumps(
            {
                "spellCount": len(deduped_spells),
                "featCount": len(deduped_feats),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    elapsed = time.perf_counter() - started_at
    print(f"Wrote {len(deduped_spells)} spell candidates and {len(deduped_feats)} feat candidates.")
    print(f"Candidate generation bitti | sure: {format_seconds(elapsed)}")


if __name__ == "__main__":
    main()
