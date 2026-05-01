# Architecture

## Overview

`raw-viewer` is an Electron desktop app built with:

- Main process: Node/Electron services for filesystem, indexing, decode, persistence, and IPC.
- Preload bridge: typed safe API surface exposed to renderer.
- Renderer: React UI (gallery + viewer) with virtualization and keyboard/gesture controls.

The current implementation is macOS-first and optimized for fast culling via embedded RAW previews.

## Main Process Design

## Entry and Window

- File: `src/main/index.ts`
- Responsibilities:
  - Create BrowserWindow
  - Register app-local image protocol (`raw-cache://`)
  - Disable Chromium page visual zoom so pinch is handled by app logic
  - Register all IPC handlers
  - Broadcast index/decode progress events to renderer

## Service Composition

- File: `src/main/services/app-services.ts`
- Composes:
  - `CatalogService`
  - `PreviewService`
  - `DecoderService`
  - `SelectionService`
  - `XmpService`

Uses a single `CatalogDb` instance (SQLite) and app data/cache paths.

## Catalog Service

- Files:
  - `src/main/services/catalog/catalog-service.ts`
  - `src/main/services/catalog/raw-extensions.ts`
- Responsibilities:
  - Discover RAW files (recursive optional)
  - Skip unchanged files by `(path,size,mtimeMs)`
  - Extract metadata via ExifTool
  - Emit progressive indexing events
  - Provide paginated/sorted/filtered gallery data

## Preview Service

- File: `src/main/services/preview/preview-service.ts`
- Responsibilities:
  - Generate reusable preview and thumbnail assets on demand
  - Fallback chain:
    - `extractPreview`
    - `extractJpgFromRaw`
    - `extractThumbnail`
  - Normalize orientation and output JPEG cache via Sharp

## Decoder Service

- File: `src/main/services/decoder/decoder-service.ts`
- Responsibilities:
  - Attempt high-quality full decode for deep zoom
  - Cache full-resolution JPEG output
  - Report decode progress states and fallback outcomes

## Selection Service

- File: `src/main/services/selection/selection-service.ts`
- Responsibilities:
  - Batch status updates
  - Move rejected files to `_rejected`
  - Preserve relative structure
  - Resolve naming collisions safely
  - Write move transaction log

## XMP Service

- File: `src/main/services/xmp/xmp-service.ts`
- Responsibilities:
  - Write `.xmp` sidecar rating from DB decisions
  - Read sidecar rating when sidecar is newer than DB row
  - Report conflicts and adoption counts

## Persistence Layer

## SQLite DB

- File: `src/main/services/catalog/catalog-db.ts`
- Tables:
  - `images`
  - `cache_assets`
  - `decisions`

## Storage locations

- DB: `<appData>/catalog/catalog.sqlite`
- Cache:
  - `<appData>/cache/thumb`
  - `<appData>/cache/preview`
  - `<appData>/cache/full`
- Move log: `<appData>/logs/move-rejected.log.jsonl`

## Preload and IPC Contracts

## Contracts

- File: `src/shared/contracts.ts`
- Defines:
  - Domain types (`ImageItem`, statuses, decode state)
  - IPC request/response types
  - Event payload types
  - Channel constants

## Preload bridge

- File: `src/preload/index.ts`
- Exposes `window.api` with typed methods and progress subscriptions.

## Renderer Design

## App State Orchestration

- File: `src/renderer/src/App.tsx`
- Responsibilities:
  - Folder selection and indexing workflow
  - Page loading and filter state
  - Selection model integration
  - Keyboard shortcuts
  - Decode/index progress message handling
  - Rotation/orientation state persistence
  - Zoom state and viewer integration

## Feature Components

- Folder bar: `features/folder/FolderBar.tsx`
- Gallery grid: `features/gallery/GalleryGrid.tsx`
- Viewer pane: `features/viewer/ViewerPane.tsx`
- Selection helpers: `features/selection/useSelection.ts`

## Rendering and Image Source Flow

1. User opens folder -> renderer calls `indexFolder`.
2. Main scans/indexes and emits progress events.
3. Renderer requests `getImagesPage`.
4. For visible items, renderer requests `getImageSource(level='thumb')`.
5. PreviewService generates/exposes cached thumb+preview.
6. Viewer requests preview or full source based on zoom mode.
7. If full decode fails, viewer remains on embedded preview and UI shows fallback mode.

## Interaction Model

## Culling

- Keep/reject/unrate via keyboard and buttons.
- Multi-select supports range and toggle selection.

## Orientation and Rotation

- Global direction toggle affects base orientation.
- Per-image rotation override applies on top.

## Zoom/Pan (macOS-focused)

- Pinch-to-zoom captured via non-passive wheel listener in viewer.
- Cursor-anchored zoom correction keeps focus under pointer.
- Two-finger pan uses native scroll behavior.
- One-finger drag pan enabled while zoomed.

## Security and Resource Loading

- Direct `file://` image URLs are not used in renderer.
- Main process serves local cached images through `raw-cache://` protocol.
- CSP allows `raw-cache:` in `img-src`.

## Known Current Constraints

- Full RAW decode coverage depends on `sharp/libvips` codec support.
- On unsupported formats, full decode falls back to embedded preview (intentional behavior).
- Advanced zoom gestures are implemented in-app but still rely on Chromium wheel gesture mapping for trackpad pinch.
