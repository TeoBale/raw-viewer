import { useEffect, useMemo, useRef, useState } from 'react'
import { Grid, type CellComponentProps } from 'react-window'
import type { ImageItem } from '../../../../shared/contracts'
import { toRawCacheUrl } from '../../utils/asset-url'

const GAP = 10
const TILE_SIZE = 180

interface GalleryGridProps {
  items: ImageItem[]
  selectedIds: Set<string>
  activeId: string | null
  getRotationTurns: (item: ImageItem) => number
  onColumnCountChange: (value: number) => void
  onActivate: (id: string, index: number, event: React.MouseEvent<HTMLButtonElement>) => void
}

interface GalleryCellProps {
  items: ImageItem[]
  columnCount: number
  selectedIds: Set<string>
  activeId: string | null
  getRotationTurns: (item: ImageItem) => number
  onActivate: (id: string, index: number, event: React.MouseEvent<HTMLButtonElement>) => void
}

function GalleryCell({
  columnIndex,
  rowIndex,
  style,
  items,
  columnCount,
  selectedIds,
  activeId,
  getRotationTurns,
  onActivate
}: CellComponentProps<GalleryCellProps>): React.JSX.Element {
  const index = rowIndex * columnCount + columnIndex
  const item = items[index]

  if (!item) {
    return <div style={style} />
  }

  const isSelected = selectedIds.has(item.id)
  const isActive = activeId === item.id
  const rotationTurns = getRotationTurns(item)
  const rotationDeg = rotationTurns * 90

  return (
    <div style={{ ...style, padding: GAP / 2 }}>
      <button
        className={`rv-tile ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
        onClick={(event) => onActivate(item.id, index, event)}
        title={item.fileName}
        type="button"
      >
        {item.thumbPath ? (
          <div className="rv-tile-media">
            <img
              alt={item.fileName}
              loading="lazy"
              src={toRawCacheUrl(item.thumbPath)}
              style={{ transform: `rotate(${rotationDeg}deg)` }}
            />
          </div>
        ) : (
          <div className="rv-tile-empty">RAW</div>
        )}
        <div className="rv-tile-meta">
          <span className={`rv-status ${item.status}`}>{item.status}</span>
          <span>{item.fileName}</span>
        </div>
      </button>
    </div>
  )
}

export function GalleryGrid({
  items,
  selectedIds,
  activeId,
  getRotationTurns,
  onColumnCountChange,
  onActivate
}: GalleryGridProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(640)
  const [height, setHeight] = useState(560)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect()
      setWidth(Math.max(360, Math.floor(rect.width)))
      setHeight(Math.max(220, Math.floor(rect.height)))
    }

    updateSize()
    const observer = new ResizeObserver(() => updateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const columnCount = Math.max(1, Math.floor(width / (TILE_SIZE + GAP)))
  const rowCount = Math.ceil(items.length / columnCount)

  useEffect(() => {
    onColumnCountChange(columnCount)
  }, [columnCount, onColumnCountChange])

  const cellProps = useMemo(
    () => ({ items, columnCount, selectedIds, activeId, getRotationTurns, onActivate }),
    [items, columnCount, selectedIds, activeId, getRotationTurns, onActivate]
  )

  return (
    <div className="rv-grid" ref={containerRef}>
      <Grid
        cellComponent={GalleryCell}
        cellProps={cellProps}
        columnCount={columnCount}
        columnWidth={Math.floor(width / columnCount)}
        defaultHeight={560}
        defaultWidth={960}
        overscanCount={2}
        rowCount={rowCount}
        rowHeight={TILE_SIZE + GAP}
        style={{ height, width }}
      />
    </div>
  )
}
