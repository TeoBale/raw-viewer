# raw-viewer

macOS-first RAW culling app built with Electron + React + TypeScript.

## Current Status

The starter template has been replaced with a working culling MVP featuring:

- folder indexing and SQLite catalog persistence,
- virtualized gallery with fast cached thumbnails,
- preview-first RAW viewing with optional full decode fallback,
- keep/reject/unrated workflows,
- reject move operation to `_rejected`,
- XMP sidecar sync,
- rotation/orientation controls,
- trackpad pinch zoom + pan interactions in viewer.

## Documentation

- [Implementation Log](docs/implementation-log.md)
- [Architecture](docs/architecture.md)
- [Usage Guide](docs/usage-guide.md)

## Tech Stack

- Electron
- React
- TypeScript
- Tailwind CSS + shadcn/ui (base primitives)
- better-sqlite3
- exiftool-vendored
- sharp
- react-window

## Quick Start

### Install

```bash
bun install
```

### Run in development

```bash
bun run dev
```

### Typecheck

```bash
bun run typecheck
```

### Lint

```bash
bun run lint
```

### Build

```bash
bun run build
```

### Platform packaging

```bash
bun run build:mac
bun run build:win
bun run build:linux
```

## Keyboard Shortcuts

- `Arrow keys`: navigate images
- `1`: keep
- `X`: reject
- `0`: unrated
- `R`: rotate selection/active image
- `Z`: toggle fit / zoomed mode
- `D`: toggle light/dark theme

## Notes

- This project is currently optimized for macOS workflow and trackpad interaction.
- Full RAW decode support depends on codec/backend support; embedded preview fallback is intentional when full decode is unavailable.
