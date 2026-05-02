import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { DecodeSupport, ImageItem } from '../../../../shared/contracts'
import { PreviewCard } from '@base-ui/react/preview-card'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { toRawCacheUrl } from '../../utils/asset-url'

interface ViewerPaneProps {
  image: ImageItem | null
  sourcePath: string | null
  decodeSupport: DecodeSupport
  rotationTurns: number
  zoomScale: number
  zoomed: boolean
  onZoomScaleChange: (value: number) => void
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
  zoomScale,
  zoomed,
  onZoomScaleChange,
  onToggleZoom
}: ViewerPaneProps): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const zoomScaleRef = useRef(zoomScale)
  const onZoomScaleChangeRef = useRef(onZoomScaleChange)
  const zoomAnchorRef = useRef<{
    cursorX: number
    cursorY: number
    anchorU: number
    anchorV: number
  } | null>(null)
  const dragStartRef = useRef<{
    pointerId: number
    x: number
    y: number
    scrollLeft: number
    scrollTop: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const title = useMemo(() => {
    if (!image) {
      return 'No image selected'
    }

    return `${image.fileName} · ${image.cameraModel ?? 'Unknown camera'} · ISO ${image.iso ?? '-'}`
  }, [image])

  useEffect(() => {
    zoomScaleRef.current = zoomScale
    onZoomScaleChangeRef.current = onZoomScaleChange
  }, [zoomScale, onZoomScaleChange])

  const syncViewportScroll = useCallback((): void => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    if (zoomScaleRef.current <= 1.001) {
      viewport.scrollLeft = 0
      viewport.scrollTop = 0
      if (dragStartRef.current) {
        dragStartRef.current = null
        setIsDragging(false)
      }
      return
    }

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
    const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
    viewport.scrollLeft = Math.min(maxScrollLeft, Math.max(0, viewport.scrollLeft))
    viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, viewport.scrollTop))
  }, [])

  useEffect(() => {
    syncViewportScroll()
  }, [zoomScale, image?.id, sourcePath, rotationTurns, syncViewportScroll])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const observer = new ResizeObserver(() => syncViewportScroll())
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [syncViewportScroll])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) {
        return
      }

      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const cursorX = event.clientX - rect.left
      const cursorY = event.clientY - rect.top
      const imageEl = viewport.querySelector('img')
      if (!imageEl) {
        return
      }

      const imageRect = imageEl.getBoundingClientRect()
      const currentScale = zoomScaleRef.current
      const nextScale = Math.min(8, Math.max(1, currentScale * Math.exp(-event.deltaY * 0.01)))
      if (Math.abs(nextScale - currentScale) < 0.0001) {
        return
      }

      const localX = event.clientX - imageRect.left
      const localY = event.clientY - imageRect.top
      const anchorU = imageRect.width > 0 ? localX / imageRect.width : 0.5
      const anchorV = imageRect.height > 0 ? localY / imageRect.height : 0.5

      zoomAnchorRef.current = {
        cursorX,
        cursorY,
        anchorU: Math.min(1, Math.max(0, anchorU)),
        anchorV: Math.min(1, Math.max(0, anchorV))
      }
      zoomScaleRef.current = nextScale
      onZoomScaleChangeRef.current(nextScale)
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const anchor = zoomAnchorRef.current
    if (!viewport || !anchor) {
      return
    }

    const imageEl = viewport.querySelector('img')
    if (!imageEl) {
      zoomAnchorRef.current = null
      return
    }

    const viewportRect = viewport.getBoundingClientRect()
    const imageRect = imageEl.getBoundingClientRect()
    const pointClientX = imageRect.left + imageRect.width * anchor.anchorU
    const pointClientY = imageRect.top + imageRect.height * anchor.anchorV
    const targetClientX = viewportRect.left + anchor.cursorX
    const targetClientY = viewportRect.top + anchor.cursorY

    viewport.scrollLeft += pointClientX - targetClientX
    viewport.scrollTop += pointClientY - targetClientY
    zoomAnchorRef.current = null
  }, [zoomScale])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (zoomScale <= 1.001 || event.button !== 0) {
      return
    }

    const viewport = viewportRef.current
    if (!viewport) {
      return
    }

    dragStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop
    }
    viewport.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragStartRef.current
    const viewport = viewportRef.current
    if (!drag || !viewport || event.pointerId !== drag.pointerId) {
      return
    }

    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    viewport.scrollLeft = drag.scrollLeft - dx
    viewport.scrollTop = drag.scrollTop - dy
  }

  const onPointerUpOrCancel = (event: React.PointerEvent<HTMLDivElement>): void => {
    const drag = dragStartRef.current
    const viewport = viewportRef.current
    if (!drag || event.pointerId !== drag.pointerId) {
      return
    }

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }
    dragStartRef.current = null
    setIsDragging(false)
  }

  return (
    <section className="rv-viewer">
      <header className="rv-viewer-head">
        <div>
          <div className="rv-viewer-title-row">
            <h2>{title}</h2>
            <PreviewCard.Root>
              <PreviewCard.Trigger
                aria-label="Decode information"
                className="rv-viewer-info-trigger"
                closeDelay={120}
                delay={150}
                render={<button type="button" />}
              >
                <Info size={14} />
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner align="start" side="right" sideOffset={8}>
                  <PreviewCard.Popup className="rv-viewer-info-card">
                    <strong>Decode</strong>
                    <p>{formatDecodeSupport(decodeSupport)}</p>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
          <p>
            {image
              ? `${formatCaptureDate(image.captureDate)} · f/${image.aperture ?? '-'} · ${image.shutter ?? '-'}`
              : 'Select from gallery'}
          </p>
        </div>
        <div className="rv-viewer-meta">
          <Button onClick={onToggleZoom} size="sm" type="button" variant="outline">
            {zoomed ? `Fit (${Math.round(zoomScale * 100)}%)` : 'Zoom 100% (Z)'}
          </Button>
        </div>
      </header>

      <div
        className={`rv-viewport ${zoomed ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
        onPointerCancel={onPointerUpOrCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUpOrCancel}
        ref={viewportRef}
      >
        {image && sourcePath ? (
          <img
            alt={image.fileName}
            className={rotationTurns % 2 === 0 ? '' : 'is-rotated'}
            key={image.id}
            src={toRawCacheUrl(sourcePath)}
            style={
              {
                transform: `rotate(${rotationTurns * 90}deg)`,
                zoom: zoomScale
              } as React.CSSProperties & { zoom: number }
            }
          />
        ) : (
          <div className="rv-viewer-empty">Open a folder to start culling.</div>
        )}
      </div>
    </section>
  )
}
