from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

from pypdf import PdfReader


BOOKS = [
    {
        "id": "phb",
        "title": "Player's Handbook",
        "path": Path(r"C:\Users\qRnt\Downloads\DnD 5e Players Handbook (BnW OCR).pdf"),
        "tags": ["core", "classes", "spells", "species", "backgrounds"],
    },
    {
        "id": "xgte",
        "title": "Xanathar's Guide to Everything",
        "path": Path(r"C:\Users\qRnt\Downloads\D&D 5E - Xanathar's Guide to Everything.pdf"),
        "tags": ["expansion", "subclasses", "spells", "feats"],
    },
    {
        "id": "tcoe",
        "title": "Tasha's Cauldron of Everything",
        "path": Path(r"C:\Users\qRnt\Downloads\D&D 5E - Tashas Cauldron of Everything.pdf"),
        "tags": ["expansion", "optional-features", "subclasses", "spells", "feats"],
    },
]

SPELL_HEADINGS = [
    "spell descriptions",
    "wizard spells",
    "cleric spells",
    "druid spells",
    "bard spells",
    "sorcerer spells",
    "warlock spells",
    "paladin spells",
    "ranger spells",
    "artificer spells",
]

SUBCLASS_HINTS = [
    "primal path",
    "bard college",
    "divine domain",
    "druid circle",
    "martial archetype",
    "monastic tradition",
    "sacred oath",
    "ranger archetype",
    "roguish archetype",
    "sorcerous origin",
    "otherworldly patron",
    "arcane tradition",
]


@dataclass
class PagePreview:
    page: int
    characters: int
    preview: str


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def format_seconds(value: float) -> str:
    minutes = int(value // 60)
    seconds = value % 60
    if minutes:
        return f"{minutes}m {seconds:04.1f}s"
    return f"{seconds:0.1f}s"


def build_page_previews(pages: Iterable[str]) -> list[PagePreview]:
    previews: list[PagePreview] = []
    for index, text in enumerate(pages, start=1):
        cleaned = collapse_whitespace(text)
        previews.append(
            PagePreview(
                page=index,
                characters=len(text),
                preview=cleaned[:240],
            )
        )
    return previews


def detect_sections(full_text: str, pages: list[str]) -> dict[str, list[object]]:
    lowered = full_text.lower()
    lines = [collapse_whitespace(line) for line in full_text.splitlines()]
    lines = [line for line in lines if line]

    spells: list[str] = []
    subclasses: list[str] = []

    for heading in SPELL_HEADINGS:
        if heading in lowered:
            spells.append(heading.title())

    for hint in SUBCLASS_HINTS:
        if hint in lowered:
            subclasses.append(hint.title())

    candidate_headings = [
        line
        for line in lines
        if 3 <= len(line) <= 80 and line == line.upper() and any(char.isalpha() for char in line)
    ]

    spell_pages = []
    subclass_pages = []

    for index, page_text in enumerate(pages, start=1):
        page_lowered = page_text.lower()
        spell_hits = [heading.title() for heading in SPELL_HEADINGS if heading in page_lowered]
        subclass_hits = [hint.title() for hint in SUBCLASS_HINTS if hint in page_lowered]

        if spell_hits:
            spell_pages.append({"page": index, "hits": sorted(set(spell_hits))})

        if subclass_hits:
            subclass_pages.append({"page": index, "hits": sorted(set(subclass_hits))})

    return {
      "spellSectionHints": sorted(set(spells)),
      "subclassSectionHints": sorted(set(subclasses)),
      "spellCandidatePages": spell_pages[:40],
      "subclassCandidatePages": subclass_pages[:60],
      "ocrHeadings": candidate_headings[:80],
    }


def extract_book(book: dict[str, object], output_root: Path) -> dict[str, object]:
    started_at = time.perf_counter()
    book_id = str(book["id"])
    title = str(book["title"])
    pdf_path = Path(book["path"])

    print(f"[{book_id}] PDF isleniyor: {title}")

    book_root = output_root / book_id
    book_root.mkdir(parents=True, exist_ok=True)

    if not pdf_path.exists():
        print(f"[{book_id}] Dosya bulunamadi: {pdf_path}")
        return {
            "id": book_id,
            "title": title,
            "status": "missing",
            "sourcePath": str(pdf_path),
        }

    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    total_pages = len(reader.pages)

    for index, page in enumerate(reader.pages, start=1):
        pages.append(page.extract_text() or "")
        should_print = index == 1 or index == total_pages or index % 25 == 0
        if should_print:
            elapsed = time.perf_counter() - started_at
            percent = index / total_pages * 100 if total_pages else 100
            print(
                f"[{book_id}] {index}/{total_pages} sayfa ({percent:5.1f}%) | sure: {format_seconds(elapsed)}"
            )

    joined = "\n\n".join(pages)
    page_previews = build_page_previews(pages)
    detected_sections = detect_sections(joined, pages)

    text_path = book_root / "book.txt"
    pages_path = book_root / "pages.json"
    manifest_path = book_root / "manifest.json"

    text_path.write_text(joined, encoding="utf-8")
    pages_path.write_text(
        json.dumps([asdict(preview) for preview in page_previews], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    manifest = {
        "id": book_id,
        "slug": slugify(title),
        "title": title,
        "status": "extracted",
        "sourcePath": str(pdf_path),
        "pageCount": len(pages),
        "totalCharacters": len(joined),
        "tags": book["tags"],
        "artifacts": {
            "text": str(text_path.relative_to(output_root.parent.parent)),
            "pages": str(pages_path.relative_to(output_root.parent.parent)),
        },
        "detectedSections": detected_sections,
    }

    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    elapsed = time.perf_counter() - started_at
    print(
        f"[{book_id}] Bitti | sayfa: {len(pages)} | karakter: {len(joined)} | sure: {format_seconds(elapsed)}"
    )

    return manifest


def main() -> None:
    started_at = time.perf_counter()
    parser = argparse.ArgumentParser(description="Extract local DnD PDFs into raw text artifacts.")
    parser.add_argument(
        "--output",
        default="content/raw/books",
        help="Directory where extracted artifacts will be written.",
    )
    args = parser.parse_args()

    output_root = Path(args.output)
    output_root.mkdir(parents=True, exist_ok=True)

    manifest = {
        "generatedAt": datetime.now(UTC).isoformat(),
        "books": [extract_book(book, output_root) for book in BOOKS],
    }

    manifest_path = output_root / "index.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    elapsed = time.perf_counter() - started_at
    print(f"Wrote manifest to {manifest_path}")
    print(f"Tum extraction bitti | kitap: {len(manifest['books'])} | sure: {format_seconds(elapsed)}")


if __name__ == "__main__":
    main()
