# Codex of Echoes

Private DnD Beyond-style prototype for a home campaign group.

## What is in this first pass

- Next.js App Router + TypeScript scaffold
- Typed content schema for books, classes, spells, feats, and backgrounds
- Sample builder data seeded from a local content bundle
- Realtime party room prototype using Server-Sent Events
- Shared room actions for dice rolls, spells, and feats

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

That is enough for local prototyping. The next step is replacing the in-memory room store with:

1. PostgreSQL for persistent room and character state
2. WebSockets for low-latency bidirectional sync
3. Auth/session support for campaign membership
