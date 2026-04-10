This folder stores normalized and raw source-book content for the private campaign app.

- `raw/` keeps extracted text and page manifests generated from local PDFs
- `normalized/` is where reviewed JSON records for spells, feats, classes, and subclasses should live

The pipeline is intentionally split in two stages:

1. extract PDF text into machine-friendly raw files
2. review and normalize those raw files into typed game content
