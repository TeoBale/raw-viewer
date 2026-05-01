# Usage Guide

## What the App Does

`raw-viewer` is a local-first culling tool for RAW photo folders.
It is designed around speed:

- fast folder indexing,
- immediate grid browsing,
- embedded preview-first viewing,
- quick keep/reject decisions,
- optional full decode for deeper zoom.

## Quick Start

1. Launch app.
2. Click `Pick Folder` / `Change Folder`.
3. Wait for indexing to complete (progress shown in top-right).
4. Scroll gallery, select images, and apply decisions.
5. Use `Move Rejected` to move rejects into `_rejected`.
6. Use `Sync XMP` to write sidecars.

## Top Bar Controls

- `Pick/Change Folder`: Select working folder.
- `Filter`: Show `All`, `Unrated`, `Keep`, or `Reject`.
- `Direction` icon:
  - `↔` horizontal default orientation
  - `↕` vertical default orientation
- `Sync XMP`: Write decision sidecars.
- `Move Rejected`: Move rejected files to `_rejected`.
- Pills:
  - total files
  - selected count
  - current progress/status message

## Gallery

- Virtualized tile grid for large folders.
- Status badge per tile (`unrated`, `keep`, `reject`).
- Selection behavior:
  - Click: single select
  - `Shift + Click`: range select
  - `Cmd/Ctrl + Click`: toggle select

## Viewer

- Shows selected image metadata.
- Decode mode indicator:
  - `Preview`
  - `Decoding full image...`
  - `Full decode ready`
  - `Embedded RAW preview`

## Keyboard Shortcuts

- `Arrow Left/Right/Up/Down`: move active image
- `1`: mark keep
- `X`: mark reject
- `0`: mark unrated
- `R`: rotate active image or current selection
- `Z`: toggle fit / zoomed state

## Zoom and Pan

### Trackpad pinch zoom

- Pinch over the viewer area to zoom in/out.
- Zoom is cursor-anchored (keeps focus near pointer).

### Pan

- Two-finger pan: native scroll in viewer.
- One-finger pan: click-drag while zoomed.

## Decision Persistence

- Decisions are stored in SQLite (`decisions` table).
- `Sync XMP` writes sidecar ratings per RAW file.
- If sidecar is newer than DB, sidecar can be adopted during sync.

## Rejected Files Behavior

- Rejected files are moved, not deleted.
- Destination: `<selected-folder>/_rejected`
- Relative subfolder structure is preserved.
- Name collisions are automatically resolved.

## Performance Notes

- Thumbnails/previews are cached on disk in app data.
- Reopening indexed folders is much faster due to cache and re-index skip checks.
- Full decode is on-demand and format-dependent.

## Troubleshooting

## Thumbnails don’t appear

- Ensure folder contains supported RAW formats.
- Re-index folder.
- If needed, restart app to reset transient decode/index state.

## Decode shows fallback

- This usually means full RAW decode is not available for that format.
- Embedded preview mode is expected and usable.

## Zoom feels odd

- Ensure you are pinching over the viewer pane.
- If behavior is stale after updates, fully restart the app process.
