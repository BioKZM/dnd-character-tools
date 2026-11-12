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


DEFAULT_OUTPUT_ROOT = Path("content/class-options-curated/warlock")
LOCAL_CLASS_DATA = Path("content/classes-curated/warlock/data.json")

SKIP_OPTION_TOKENS = (
    "unearthed arcana",
    "(ua)",
    "archived unearthed arcana",
)

PACT_OPTION_PATTERN = re.compile(
    r"(Pact of the [A-Za-z' -]+)\s+(.*?)(?=(?:Pact of the [A-Za-z' -]+)\s+|$)",
    re.DOTALL,
)


def log(message: str) -> None:
    print(f"[warlock-options] {message}", flush=True)


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


def parse_pact_boons(text: str) -> list[dict[str, str]]:
    options: list[dict[str, str]] = []
    for name, body in PACT_OPTION_PATTERN.findall(text):
        cleaned_name = clean_text(name)
        cleaned_body = clean_text(body)
        lowered = f"{cleaned_name} {cleaned_body}".lower()
        if any(token in lowered for token in SKIP_OPTION_TOKENS):
          continue
        options.append(
            {
                "id": slugify(cleaned_name),
                "name": cleaned_name,
                "summary": cleaned_body,
            }
        )
    return options


def read_local_warlock_data() -> dict[str, object] | None:
    if not LOCAL_CLASS_DATA.exists():
        return None
    try:
        return json.loads(LOCAL_CLASS_DATA.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def pact_boon_text_from_local() -> str:
    payload = read_local_warlock_data()
    if not payload:
        return ""
    for feature in payload.get("classFeatures", []):
        if feature.get("id") == "pact-boon":
            return clean_text(str(feature.get("summary", "")))
    return ""


def invocation_summary_from_local() -> str:
    payload = read_local_warlock_data()
    if not payload:
        return ""
    for feature in payload.get("classFeatures", []):
        if feature.get("id") == "eldritch-invocations":
            return clean_text(str(feature.get("summary", "")))
    return ""


def strip_html(value: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", value)
    return clean_text(
        no_tags.replace("&nbsp;", " ")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .replace("&ndash;", "-")
        .replace("&mdash;", "-")
    )


def parse_invocations_from_html(html: str) -> list[dict[str, str]]:
    toc_match = re.search(r'<div id="toc-list">(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
    if not toc_match:
        return []

    toc_html = toc_match.group(1)
    toc_entries = re.findall(r'<a href="#(toc\d+)">([^<]+)</a>', toc_html)
    options: list[dict[str, str]] = []

    for anchor, raw_name in toc_entries:
        name = strip_html(raw_name)
        lowered_name = name.lower()
        if not name or any(token in lowered_name for token in SKIP_OPTION_TOKENS):
            break

        section_match = re.search(
            rf'<h2 id="{re.escape(anchor)}".*?</h2>(.*?)(?=<h2 id="toc\d+"|<h1 id="toc\d+"|</div>\s*</div>\s*</div>)',
            html,
            re.DOTALL,
        )
        if not section_match:
            continue

        summary = strip_html(section_match.group(1))
        lowered = f"{name} {summary}".lower()
        if any(token in lowered for token in SKIP_OPTION_TOKENS):
            break

        options.append(
            {
                "id": slugify(name),
                "name": name,
                "summary": summary,
            }
        )

    return options


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect curated Warlock-specific option data from Wikidot.")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--pause", type=float, default=0.2)
    args = parser.parse_args()

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()

    log("fetching base warlock page")
    warlock_url, warlock_html = fetch_first(["/warlock"])
    if not warlock_html or not warlock_url:
        raise SystemExit("Could not fetch /warlock")

    warlock_blocks = parse_page_content(warlock_html)

    pact_blocks = blocks_under_heading(warlock_blocks, "Pact Boon")
    pact_text = joined_text(pact_blocks) or pact_boon_text_from_local()
    pact_options = parse_pact_boons(pact_text)

    (output_root / "pact-boon").mkdir(parents=True, exist_ok=True)
    write_json(
        output_root / "pact-boon" / "data.json",
        {
            "id": "pact-boon",
            "name": "Pact Boon",
            "sourceUrl": warlock_url,
            "optionCount": len(pact_options),
            "options": pact_options,
        },
    )
    (output_root / "pact-boon" / "page.html").write_text(warlock_html, encoding="utf-8")

    time.sleep(args.pause)

    log("fetching eldritch invocations page")
    invocation_url, invocation_html = fetch_first(
        [
            "/warlock:eldritch-invocations",
            "/eldritch-invocations",
            "/warlock-invocations",
        ]
    )

    invocation_options: list[dict[str, str]] = []
    if invocation_html and invocation_url:
        invocation_options = parse_invocations_from_html(invocation_html)
        (output_root / "eldritch-invocations").mkdir(parents=True, exist_ok=True)
        write_json(
            output_root / "eldritch-invocations" / "data.json",
            {
                "id": "eldritch-invocations",
                "name": "Eldritch Invocations",
                "sourceUrl": invocation_url,
                "optionCount": len(invocation_options),
                "options": invocation_options,
                "summary": invocation_summary_from_local(),
            },
        )
        (output_root / "eldritch-invocations" / "page.html").write_text(invocation_html, encoding="utf-8")
    else:
        write_json(
            output_root / "eldritch-invocations" / "data.json",
            {
                "id": "eldritch-invocations",
                "name": "Eldritch Invocations",
                "sourceUrl": None,
                "optionCount": 0,
                "options": [],
                "summary": invocation_summary_from_local(),
                "notes": [
                    "No dedicated invocation page was fetched.",
                    "Base class page still contains invocation progression and summary.",
                ],
            },
        )

    manifest = {
        "classId": "warlock",
        "durationSeconds": round(time.perf_counter() - started, 2),
        "sources": {
            "warlock": warlock_url,
            "invocations": invocation_url,
        },
        "counts": {
            "pactBoonOptions": len(pact_options),
            "invocations": len(invocation_options),
        },
    }
    write_json(output_root / "manifest.json", manifest)
    log(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
