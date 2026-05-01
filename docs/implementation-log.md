# Implementation Log

This document records the work completed to transform the Electron + React starter into a macOS-first RAW culling application.

## 1. Project Foundation

### What was done

- Removed starter/demo IPC (`ping`) behavior and replaced it with domain-specific IPC handlers.
- Added shared contracts so main, preload, and renderer all use the same request/response and event types.
- Introduced service-oriented structure in the main process.
- Introduced feature-oriented structure in the renderer.

### Added structure

- `src/shared/contracts.ts`
- `src/main/services/`
  - `catalog/`
  - `preview/`
  - `decoder/`
  - `selection/`
  - `xmp/`
  - `common/`
- `src/renderer/src/features/`
  - `folder/`
  - `gallery/`
  - `viewer/`
  - `selection/`

## 2. Shared Contracts and IPC API

### Shared model

Implemented:

- `RawStatus = 'unrated' | 'keep' | 'reject'`
- `PreviewLevel = 'thumb' | 'preview' | 'full'`
- `DecodeSupport = 'unknown' | 'supported' | 'fallback' | 'decoding'`
- `ImageItem` with file identity, EXIF-derived metadata, decision state, and cache path fields.

### IPC endpoints implemented

- `pickFolder()`
- `indexFolder({ folderPath, recursive })`
- `getImagesPage({ folderPath, offset, limit, sort, filter })`
- `getImageSource({ imageId, level })`
- `setImageStatus({ imageIds, status })`
- `moveRejected({ folderPath, strategy })`
- `syncXmp({ folderPath, imageIds? })`
- Event subscriptions:
  - `onIndexProgress(callback)`
  - `onDecodeProgress(callback)`

### Wiring

- Main process: `ipcMain.handle(...)` in `src/main/index.ts`
- Preload bridge: `contextBridge.exposeInMainWorld('api', api)` in `src/preload/index.ts`

## 3. Catalog Indexing and Metadata

### RAW discovery

- Implemented supported RAW extension filtering (`cr2`, `cr3`, `nef`, `nrw`, `arw`, `raf`, `rw2`, `orf`, `dng`, `pef`, `srw`, `3fr`, `iiq`, etc.).
- Implemented recursive scan option.
- Implemented progressive scan/index progress events.

### Re-index strategy

- File identity checks by `(path, size, mtimeMs)`.
- Unchanged files are skipped.
- Changed/new files are re-read and upserted.

### Metadata extraction

- Uses `exiftool-vendored` for capture date and camera metadata.
- Graceful fallback to null fields if metadata extraction fails.

## 4. SQLite Persistence

### Database engine

- Added `better-sqlite3`.
- DB path: `<appData>/catalog/catalog.sqlite`.

### Schema

- `images`: file identity + metadata + decode support.
- `cache_assets`: `thumb_path`, `preview_path`, `full_path`.
- `decisions`: `status`, `rating`, `label`, `updated_at`.

### DB behavior

- WAL mode + normal sync for practical local performance.
- Upsert logic for images.
- Query API with sort/filter/pagination.
- Decision updates (single/batch).

## 5. Preview Pipeline

### Implemented strategy

Preview extraction chain per image:

1. `PreviewImage`
2. fallback `JpgFromRaw`
3. fallback `ThumbnailImage`

### Image processing

- Uses `sharp` to normalize orientation (`rotate()`).
- Generates:
  - preview JPEG in cache
  - thumbnail JPEG in cache
- Cache key: sha1(path:size:mtime).

### Queueing/concurrency

- Added a reusable `TaskQueue` with bounded concurrency.
- Preview queue sized from CPU count.

## 6. On-Demand Full Decode

### Behavior

- Viewer requests `full` source when zoom mode requires detail.
- Attempt decode via `sharp` from RAW input.
- Cache decoded JPEG at `<appData>/cache/full`.
- Reuses existing full cache to avoid repeated decode.

### Decode support state

- `supported`: full decode available.
- `fallback`: full decode failed; viewer stays on embedded preview.
- `decoding`: in-progress state during decode.

## 7. Selection and Reject Move Workflow

### Status workflow

- Implemented status updates for `keep`, `reject`, `unrated`.
- Mapped to rating values (`1`, `-1`, `0`).
- Supports batch operations based on current selection.

### Reject move operation

- Implemented `moveRejected` with default strategy:
  - `<selected-folder>/_rejected`
  - preserves relative structure
  - collision-safe rename (`_1`, `_2`, ...)
- Writes transaction log entries to:
  - `<appData>/logs/move-rejected.log.jsonl`

## 8. XMP Sidecar Sync

### Implemented behavior

- Writes/updates `.xmp` sidecar near RAW files.
- Stores rating in XMP.
- Supports full-folder or selected subset sync.

### Conflict behavior

- If sidecar is newer than DB decision, sidecar rating is adopted.
- Conflict counters are returned in sync result.

## 9. Renderer UI (Gallery + Viewer)

### Gallery

- Virtualized grid using `react-window`.
- Fast thumbnail loading with async source fetch.
- Selection visuals and status overlays.

### Selection model

- Single select.
- Shift range select.
- Cmd/Ctrl toggle select.
- Keyboard navigation with arrows.

### Viewer

- Displays metadata and decode mode state.
- Preview/full source switching through IPC.
- Rotation support + zoom/pan interactions.

## 10. Keyboard and Actions

Implemented shortcuts:

- `Arrow` keys: navigate active image.
- `1`: Keep.
- `X`: Reject.
- `0`: Unrate.
- `Z`: toggle fit / zoom mode.
- `R`: rotate selection or active image.

## 11. Orientation and Rotation Enhancements

### Global default direction

- Added global direction mode:
  - horizontal (`↔`)
  - vertical (`↕`)
- Replaced selector dropdown with icon toggle button.
- Fixed default conversion direction so horizontal->vertical rotates 90° counterclockwise.

### Per-image rotation

- Added per-image rotation override.
- Rotation persists in local storage.
- Rotation is cumulative (no reverse animation jump when wrapping full turns).

## 12. Asset Loading and Protocol Fix

### Problem solved

- `file://` resources were blocked by renderer policy/CSP in this app setup.

### Fix

- Added custom protocol in main process: `raw-cache://`.
- Renderer now resolves cached image paths to `raw-cache://local/...`.
- CSP updated to allow `img-src ... raw-cache:`.

## 13. Layout and Rendering Fixes

### Problems solved

- Grid tiles overlapping viewer region.
- Incorrect measurements causing virtualized layout drift.
- Ambiguous active/selected visual state.

### Fixes

- Applied strict clipping and min-width constraints.
- Added container `ResizeObserver` for accurate grid dimensions.
- Separated active vs selected border styling.

## 14. Zoom and Trackpad Interaction Rework

### Goals

- Natural macOS-style usage for image zoom/pan.
- Pinch-to-zoom on trackpad.
- Pan with two-finger scroll and one-finger drag.

### Implemented

- Disabled Chromium page visual zoom in the window (`setVisualZoomLevelLimits(1,1)`).
- Added non-passive wheel listener to capture pinch (`ctrlKey` wheel path).
- Added cursor-anchored zoom behavior using rendered image geometry.
- Added pointer-drag panning when zoomed.
- Added grab/grabbing cursor states.

### Why this changed multiple times

- Early versions anchored using scroll math only, which caused drift/jitter and a first-step jump at 100%.
- Final method anchors on normalized point inside rendered image rect, then corrects scroll after scale update.

## 15. UX Messaging Improvements

- Reworded decode fallback messaging to avoid alarming “error” tone for expected RAW behavior.
- Current viewer status labels:
  - `Preview`
  - `Decoding full image...`
  - `Full decode ready`
  - `Embedded RAW preview`

## 16. Tooling and Quality Checks

### Dependencies added

- `better-sqlite3`
- `exiftool-vendored`
- `sharp`
- `react-window`

### Verification routinely run during implementation

- `bun run typecheck`
- `bun run lint`
- `bun run build`

All key milestones above were integrated with passing type and lint checks at each step.
