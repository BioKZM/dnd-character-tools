from __future__ import annotations

import json
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = Path(r"C:\Users\qRnt\Downloads\540812744-DND-Monster-Manual-5e.pdf")
OUTPUT_DIR = ROOT / "content" / "raw" / "monster-manual"
SAMPLED_PAGES = [1, 50, 100, 150, 200, 250, 300, 350]


def progress(label: str) -> None:
    print(label, flush=True)


def main() -> None:
    started_at = time.perf_counter()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        sys.path.insert(0, str(ROOT / ".pythonlibs"))
        from pypdf import PdfReader
    except Exception as error:  # pragma: no cover - environment bootstrap
        manifest = {
            "status": "error",
            "sourcePath": str(PDF_PATH),
            "message": f"Could not import pypdf: {error}",
        }
        (OUTPUT_DIR / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        progress(manifest["message"])
        return

    progress(f"Monster Manual scan starting | source: {PDF_PATH}")
    reader = PdfReader(str(PDF_PATH))
    page_lengths: list[dict[str, int]] = []
    sample_previews: list[dict[str, int | str]] = []
    nonempty_pages = 0
    total_pages = len(reader.pages)

    for index, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        page_lengths.append({"page": index, "characters": len(text)})
        if text.strip():
            nonempty_pages += 1
        if index in SAMPLED_PAGES:
            preview = " ".join(text.split())[:220]
            sample_previews.append(
                {
                    "page": index,
                    "preview": preview,
                    "characters": len(text),
                }
            )
        percent = (index / total_pages) * 100
        progress(
            f"[monster-manual] {index}/{total_pages} scanned ({percent:5.1f}%) | "
            f"text pages: {nonempty_pages} | last chars: {len(text)}"
        )

    manifest = {
        "status": "scanned-pdf" if nonempty_pages == 0 else "text-layer-detected",
        "sourcePath": str(PDF_PATH),
        "pageCount": total_pages,
        "nonemptyTextPages": nonempty_pages,
        "sampledPages": SAMPLED_PAGES,
        "samplePreviews": sample_previews,
        "note": (
            "This PDF appears to have no extractable text layer. OCR is required before full monster parsing."
            if nonempty_pages == 0
            else "Extractable text exists; OCR-free parsing may be possible."
        ),
        "durationSeconds": round(time.perf_counter() - started_at, 2),
    }

    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (OUTPUT_DIR / "page-lengths.json").write_text(
        json.dumps(page_lengths, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"Monster Manual scan check complete | pages: {manifest['pageCount']} | "
        f"text pages: {manifest['nonemptyTextPages']} | status: {manifest['status']}"
    )


if __name__ == "__main__":
    main()
