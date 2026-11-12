from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError

from collect_wikidot_classes_curated import (
    BASE_URL,
    blocks_under_heading,
    clean_text,
    fetch_html,
    parse_page_content,
    slugify,
    write_json,
)


DEFAULT_OUTPUT_ROOT = Path("content/class-options-curated/sorcerer")
LOCAL_CLASS_DATA = Path("content/classes-curated/sorcerer/data.json")

METAMAGIC_OPTION_PATTERN = re.compile(
    r"([A-Z][A-Za-z' -]+ Spell(?: \(UA\))?)\.\s+(.*?)(?=(?:[A-Z][A-Za-z' -]+ Spell(?: \(UA\))?\.)|$)",
    re.DOTALL,
)


def log(message: str) -> None:
    print(f"[sorcerer-options] {message}", flush=True)


def fetch_first(paths: list[str]) -> tuple[str | None, str | None]:
    for path in paths:
        url = f"{BASE_URL}{path}"
        try:
            return url, fetch_html(url)
        except (HTTPError, URLError):
            continue
    return None, None


def joined_text(blocks: list[dict[str, object]]) -> str:
    parts: list[str] = []
    for block in blocks:
        if "text" in block:
            parts.append(str(block["text"]))
    return clean_text("\n".join(parts))


def read_local_sorcerer_data() -> dict[str, object] | None:
    if not LOCAL_CLASS_DATA.exists():
        return None
    try:
        return json.loads(LOCAL_CLASS_DATA.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def feature_summary_from_local(feature_id: str) -> str:
    payload = read_local_sorcerer_data()
    if not payload:
        return ""
    for feature in payload.get("classFeatures", []):
        if feature.get("id") == feature_id:
            return clean_text(str(feature.get("summary", "")))
    return ""


def parse_metamagic_options(text: str) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    for name, body in METAMAGIC_OPTION_PATTERN.findall(text):
        cleaned_name = clean_text(name)
        cleaned_body = clean_text(body)
        if "(UA)" in cleaned_name:
            continue
        options.append(
            {
                "id": slugify(cleaned_name),
                "name": cleaned_name,
                "summary": cleaned_body,
            }
        )
    return options


def font_of_magic_notes(text: str) -> list[str]:
    notes: list[str] = []
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        cleaned = clean_text(sentence)
        if cleaned:
            notes.append(cleaned)
    return notes


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect curated Sorcerer-specific option data from Wikidot.")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--pause", type=float, default=0.2)
    args = parser.parse_args()

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()

    log("fetching sorcerer page")
    sorcerer_url, sorcerer_html = fetch_first(["/sorcerer"])
    if not sorcerer_html or not sorcerer_url:
        raise SystemExit("Could not fetch /sorcerer")

    sorcerer_blocks = parse_page_content(sorcerer_html)

    font_blocks = blocks_under_heading(sorcerer_blocks, "Font of Magic")
    font_text = joined_text(font_blocks) or feature_summary_from_local("font-of-magic")
    (output_root / "font-of-magic").mkdir(parents=True, exist_ok=True)
    write_json(
        output_root / "font-of-magic" / "data.json",
        {
            "id": "font-of-magic",
            "name": "Font of Magic",
            "sourceUrl": sorcerer_url,
            "summary": font_text,
            "notes": font_of_magic_notes(font_text),
        },
    )
    (output_root / "font-of-magic" / "page.html").write_text(sorcerer_html, encoding="utf-8")

    time.sleep(args.pause)

    metamagic_blocks = blocks_under_heading(sorcerer_blocks, "Metamagic")
    metamagic_text = joined_text(metamagic_blocks) or feature_summary_from_local("metamagic")
    metamagic_options = parse_metamagic_options(metamagic_text)
    (output_root / "metamagic").mkdir(parents=True, exist_ok=True)
    write_json(
        output_root / "metamagic" / "data.json",
        {
            "id": "metamagic",
            "name": "Metamagic",
            "sourceUrl": sorcerer_url,
            "optionCount": len(metamagic_options),
            "options": metamagic_options,
            "summary": metamagic_text,
        },
    )
    (output_root / "metamagic" / "page.html").write_text(sorcerer_html, encoding="utf-8")

    manifest = {
        "classId": "sorcerer",
        "durationSeconds": round(time.perf_counter() - started, 2),
        "sources": {
            "sorcerer": sorcerer_url,
        },
        "counts": {
            "fontOfMagicNotes": len(font_of_magic_notes(font_text)),
            "metamagicOptions": len(metamagic_options),
        },
    }
    write_json(output_root / "manifest.json", manifest)
    log(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
