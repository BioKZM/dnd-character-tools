# Codex of Echoes

Private DnD Beyond-style prototype for a home campaign group.

## What is in this first pass

- Next.js App Router + TypeScript scaffold
- Typed content schema for books, classes, spells, feats, and backgrounds
- Sample builder data seeded from a local content bundle


## Commands

```bash
npm run dev
npm run lint
```

## Important prototype note

The current room sync layer is intentionally simple:

- state is kept in memory
- rooms disappear when the server restarts
- sync works only while clients are connected to the same app instance

