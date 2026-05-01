import { useMemo } from 'react'
import type { DecodeSupport, ImageItem } from '../../../../shared/contracts'
import { toRawCacheUrl } from '../../utils/asset-url'

interface ViewerPaneProps {
  image: ImageItem | null
  sourcePath: string | null
  decodeSupport: DecodeSupport
  rotationTurns: number
  zoomed: boolean
  onToggleZoom: () => void
}

function formatDecodeSupport(value: DecodeSupport): string {
  if (value === 'supported') return 'Full decode ready'
  if (value === 'decoding') return 'Decoding full image...'
  if (value === 'fallback') return 'Embedded RAW preview'
  return 'Preview'
}

function formatCaptureDate(value: string | null): string {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export function ViewerPane({
  image,
  sourcePath,
  decodeSupport,
  rotationTurns,
  zoomed,
  onToggleZoom
}: ViewerPaneProps): React.JSX.Element {
  const title = useMemo(() => {
    if (!image) {
      return 'No image selected'
    }

    return `${image.fileName} · ${image.cameraModel ?? 'Unknown camera'} · ISO ${image.iso ?? '-'}`
  }, [image])

  return (
    <section className="rv-viewer">
      <header className="rv-viewer-head">
        <div>
          <h2>{title}</h2>
          <p>
            {image
              ? `${formatCaptureDate(image.captureDate)} · f/${image.aperture ?? '-'} · ${image.shutter ?? '-'}`
              : 'Select from gallery'}
          </p>
        </div>
        <div className="rv-viewer-meta">
          <span>Decode: {formatDecodeSupport(decodeSupport)}</span>
          <button onClick={onToggleZoom} type="button">
            {zoomed ? 'Fit (Z)' : 'Zoom 100% (Z)'}
          </button>
        </div>
      </header>

      <div className={`rv-viewport ${zoomed ? 'is-zoomed' : ''}`}>
        {image && sourcePath ? (
          <img
            alt={image.fileName}
            className={rotationTurns % 2 === 0 ? '' : 'is-rotated'}
            src={toRawCacheUrl(sourcePath)}
            style={{ transform: `rotate(${rotationTurns * 90}deg)` }}
          />
        ) : (
          <div className="rv-viewer-empty">Open a folder to start culling.</div>
        )}
      </div>
    </section>
  )
}
