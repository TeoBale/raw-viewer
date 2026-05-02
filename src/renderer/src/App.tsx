import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DecodeSupport, ImageItem, RawStatus } from '../../shared/contracts'
import { Button } from '@/components/ui/button'
import { FolderBar } from './features/folder/FolderBar'
import { GalleryGrid } from './features/gallery/GalleryGrid'
import { useSelection } from './features/selection/useSelection'
import { ViewerPane } from './features/viewer/ViewerPane'

const PAGE_LIMIT = 5000
const DEFAULT_DIRECTION_KEY = 'raw-viewer:default-direction'
const IMAGE_ROTATIONS_KEY = 'raw-viewer:image-rotations'
const THEME_MODE_KEY = 'raw-viewer:theme-mode'
const FULL_ROTATION_TURNS = 4

type PreviewDirection = 'horizontal' | 'vertical'

function updateItemsStatus(items: ImageItem[], ids: Set<string>, status: RawStatus): ImageItem[] {
  return items.map((item) => {
    if (!ids.has(item.id)) {
      return item
    }

    return {
      ...item,
      status,
      rating: status === 'reject' ? -1 : status === 'keep' ? 1 : 0
    }
  })
}

function replaceItem(items: ImageItem[], nextItem: ImageItem): ImageItem[] {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}

function computeBaseTurns(item: ImageItem, defaultDirection: PreviewDirection): number {
  if (!item.width || !item.height) {
    return 0
  }

  const isLandscape = item.width >= item.height
  const wantsLandscape = defaultDirection === 'horizontal'
  if (isLandscape === wantsLandscape) {
    return 0
  }

  return wantsLandscape ? 1 : -1
}

function normalizeTurns(turns: number): number {
  const normalized = turns % FULL_ROTATION_TURNS
  return normalized < 0 ? normalized + FULL_ROTATION_TURNS : normalized
}

function getOverrideTurns(rotationMap: Record<string, number>, imageId: string): number {
  return rotationMap[imageId] ?? 0
}

function App(): React.JSX.Element {
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [items, setItems] = useState<ImageItem[]>([])
  const [total, setTotal] = useState(0)
  const [filterStatus, setFilterStatus] = useState<RawStatus | 'all'>('all')
  const [isBusy, setIsBusy] = useState(false)
  const [progressLabel, setProgressLabel] = useState('Idle')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [viewerSourcePath, setViewerSourcePath] = useState<string | null>(null)
  const [viewerDecodeSupport, setViewerDecodeSupport] = useState<DecodeSupport>('unknown')
  const [zoomScale, setZoomScale] = useState(1)
  const [gridColumnCount, setGridColumnCount] = useState(1)
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    return window.localStorage.getItem(THEME_MODE_KEY) === 'dark'
  })
  const [defaultDirection, setDefaultDirection] = useState<PreviewDirection>(() => {
    const stored = window.localStorage.getItem(DEFAULT_DIRECTION_KEY)
    return stored === 'vertical' ? 'vertical' : 'horizontal'
  })
  const [imageRotations, setImageRotations] = useState<Record<string, number>>(() => {
    const stored = window.localStorage.getItem(IMAGE_ROTATIONS_KEY)
    if (!stored) {
      return {}
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, number>
      const normalized: Record<string, number> = {}
      for (const [imageId, turns] of Object.entries(parsed)) {
        if (typeof turns !== 'number' || Number.isNaN(turns)) {
          continue
        }
        const nextTurns = normalizeTurns(turns)
        if (nextTurns !== 0) {
          normalized[imageId] = nextTurns
        }
      }
      return normalized
    } catch {
      return {}
    }
  })
  const [imageRotationAnimationTurns, setImageRotationAnimationTurns] = useState<
    Record<string, number>
  >(() => {
    const stored = window.localStorage.getItem(IMAGE_ROTATIONS_KEY)
    if (!stored) {
      return {}
    }

    try {
      const parsed = JSON.parse(stored) as Record<string, number>
      const normalized: Record<string, number> = {}
      for (const [imageId, turns] of Object.entries(parsed)) {
        if (typeof turns !== 'number' || Number.isNaN(turns)) {
          continue
        }
        const nextTurns = normalizeTurns(turns)
        if (nextTurns !== 0) {
          normalized[imageId] = nextTurns
        }
      }
      return normalized
    } catch {
      return {}
    }
  })
  const pendingXmpSyncRef = useRef<number | null>(null)

  const ids = useMemo(() => items.map((item) => item.id), [items])
  const {
    selectedIds,
    selectedSet,
    resetSelection,
    selectOnly,
    toggleSelection,
    selectRange,
    ensureSelection
  } = useSelection(ids)

  const activeIndex = useMemo(
    () => items.findIndex((item) => item.id === activeId),
    [items, activeId]
  )
  const activeItem = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId]
  )
  const getRotationTurns = useCallback(
    (item: ImageItem): number => {
      const baseTurns = computeBaseTurns(item, defaultDirection)
      const overrideTurns = getOverrideTurns(imageRotations, item.id)
      return normalizeTurns(baseTurns + overrideTurns)
    },
    [defaultDirection, imageRotations]
  )
  const activeRotationTurns = useMemo(() => {
    if (!activeItem) {
      return 0
    }
    const baseTurns = computeBaseTurns(activeItem, defaultDirection)
    const overrideTurns = getOverrideTurns(imageRotationAnimationTurns, activeItem.id)
    return baseTurns + overrideTurns
  }, [activeItem, defaultDirection, imageRotationAnimationTurns])
  const zoomed = zoomScale > 1.01
  const toggleDefaultDirection = useCallback(() => {
    setDefaultDirection((current) => (current === 'horizontal' ? 'vertical' : 'horizontal'))
  }, [])

  const loadPage = useCallback(
    async (overrideFolderPath?: string) => {
      const targetFolderPath = overrideFolderPath ?? folderPath
      if (!targetFolderPath) {
        return
      }

      setIsBusy(true)
      try {
        const response = await window.api.getImagesPage({
          folderPath: targetFolderPath,
          offset: 0,
          limit: PAGE_LIMIT,
          sort: { field: 'captureDate', direction: 'desc' },
          filter: { status: filterStatus }
        })
        setItems(response.items)
        setTotal(response.total)

        if (response.items.length > 0) {
          setActiveId((current) => current ?? response.items[0].id)
        } else {
          setActiveId(null)
          setViewerSourcePath(null)
        }
      } finally {
        setIsBusy(false)
      }
    },
    [folderPath, filterStatus]
  )

  const queueThumbs = useCallback(async (records: ImageItem[]) => {
    const concurrency = 6
    const queue = [...records]

    const workers = Array.from({ length: concurrency }).map(async () => {
      while (queue.length > 0) {
        const item = queue.shift()
        if (!item || item.thumbPath) {
          continue
        }

        try {
          const source = await window.api.getImageSource({ imageId: item.id, level: 'thumb' })
          if (!source.sourcePath) {
            continue
          }

          setItems((current) => {
            const existing = current.find((image) => image.id === item.id)
            if (!existing || existing.thumbPath === source.sourcePath) {
              return current
            }
            return replaceItem(current, { ...existing, thumbPath: source.sourcePath })
          })
        } catch {
          // non-fatal thumbnail failure
        }
      }
    })

    await Promise.all(workers)
  }, [])

  const loadViewerSource = useCallback(
    async (imageId: string, level: 'preview' | 'full') => {
      const source = await window.api.getImageSource({ imageId, level })
      setViewerDecodeSupport(source.decodeSupport)
      if (source.sourcePath && activeId === imageId) {
        setViewerSourcePath(source.sourcePath)
      }
    },
    [activeId]
  )

  const runIndex = useCallback(
    async (nextFolderPath: string) => {
      setIsBusy(true)
      setProgressLabel('Indexing...')
      try {
        await window.api.indexFolder({ folderPath: nextFolderPath, recursive: true })
        await loadPage(nextFolderPath)
      } finally {
        setIsBusy(false)
      }
    },
    [loadPage]
  )

  const pickFolder = useCallback(async () => {
    const picked = await window.api.pickFolder()
    if (!picked) {
      return
    }

    setFolderPath(picked)
    resetSelection()
    setActiveId(null)
    setViewerSourcePath(null)
    setViewerDecodeSupport('unknown')
    void runIndex(picked)
  }, [resetSelection, runIndex])

  const applyStatus = useCallback(
    async (status: RawStatus) => {
      const targetIds = selectedIds.length > 0 ? selectedIds : activeId ? [activeId] : []
      if (targetIds.length === 0) {
        return
      }

      const idSet = new Set(targetIds)
      setItems((current) => updateItemsStatus(current, idSet, status))
      await window.api.setImageStatus({ imageIds: targetIds, status })

      if (folderPath) {
        if (pendingXmpSyncRef.current) {
          window.clearTimeout(pendingXmpSyncRef.current)
        }

        pendingXmpSyncRef.current = window.setTimeout(() => {
          void window.api.syncXmp({ folderPath, imageIds: targetIds })
        }, 500)
      }
    },
    [selectedIds, activeId, folderPath]
  )

  const rotateSelection = useCallback(() => {
    const targetIds = selectedIds.length > 0 ? selectedIds : activeId ? [activeId] : []
    if (targetIds.length === 0) {
      return
    }

    setImageRotations((current) => {
      const next = { ...current }
      for (const imageId of targetIds) {
        const turns = normalizeTurns((next[imageId] ?? 0) + 1)
        if (turns === 0) {
          delete next[imageId]
        } else {
          next[imageId] = turns
        }
      }
      return next
    })
    setImageRotationAnimationTurns((current) => {
      const next = { ...current }
      for (const imageId of targetIds) {
        next[imageId] = (next[imageId] ?? 0) + 1
      }
      return next
    })
  }, [selectedIds, activeId])

  const moveRejected = useCallback(async () => {
    if (!folderPath) return

    const rejectedCount = items.filter((item) => item.status === 'reject').length
    const destination = `${folderPath}/_rejected`
    const confirmed = window.confirm(
      `Move ${rejectedCount} rejected files to:\n${destination}\n\nThis only moves files and can be reverted manually.`
    )
    if (!confirmed) {
      return
    }

    setIsBusy(true)
    try {
      const result = await window.api.moveRejected({ folderPath, strategy: 'sibling_rejected' })
      setProgressLabel(`Moved ${result.moved} rejected (${result.errors.length} errors)`)
      await loadPage()
    } finally {
      setIsBusy(false)
    }
  }, [folderPath, items, loadPage])

  const syncXmp = useCallback(async () => {
    if (!folderPath) return

    setIsBusy(true)
    try {
      const result = await window.api.syncXmp({ folderPath })
      setProgressLabel(`XMP sync: ${result.written} written, ${result.conflicts} sidecar conflicts`)
      await loadPage()
    } finally {
      setIsBusy(false)
    }
  }, [folderPath, loadPage])

  const activateItem = useCallback(
    (id: string, index: number, event: React.MouseEvent<HTMLButtonElement>) => {
      setActiveId(id)
      const isRange = event.shiftKey
      const isToggle = event.metaKey || event.ctrlKey

      if (isRange) {
        selectRange(index)
      } else if (isToggle) {
        toggleSelection(id, index)
      } else {
        selectOnly(id, index)
      }
    },
    [selectOnly, selectRange, toggleSelection]
  )

  useEffect(() => {
    if (!folderPath) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPage()
  }, [folderPath, filterStatus, loadPage])

  useEffect(() => {
    void queueThumbs(items.slice(0, 300))
  }, [items, queueThumbs])

  useEffect(() => {
    if (!activeId) {
      return
    }

    ensureSelection(activeId, activeIndex < 0 ? 0 : activeIndex)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadViewerSource(activeId, zoomed ? 'full' : 'preview')
  }, [activeId, zoomed, loadViewerSource, ensureSelection, activeIndex])

  useEffect(() => {
    window.localStorage.setItem(DEFAULT_DIRECTION_KEY, defaultDirection)
  }, [defaultDirection])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkTheme)
    window.localStorage.setItem(THEME_MODE_KEY, isDarkTheme ? 'dark' : 'light')
  }, [isDarkTheme])

  useEffect(() => {
    window.localStorage.setItem(IMAGE_ROTATIONS_KEY, JSON.stringify(imageRotations))
  }, [imageRotations])

  useEffect(() => {
    const offIndex = window.api.onIndexProgress((event) => {
      if (event.phase === 'scanning') {
        setProgressLabel(`Scanning ${event.scanned} files...`)
      } else if (event.phase === 'indexing') {
        setProgressLabel(
          `Index ${event.scanned}/${event.total} · +${event.indexed} new · ${event.skipped} cached`
        )
      } else {
        setProgressLabel(`Index complete · ${event.indexed} updated`)
      }
    })

    const offDecode = window.api.onDecodeProgress((event) => {
      if (event.phase === 'decoding') {
        setProgressLabel(`Decoding full image...`)
      }

      if (event.phase === 'done' && event.imageId === activeId && event.fullPath) {
        setViewerSourcePath(event.fullPath)
        setViewerDecodeSupport('supported')
        setProgressLabel('Full decode ready')
      }

      if (event.phase === 'error' && event.imageId === activeId) {
        setViewerDecodeSupport('fallback')
        setProgressLabel('Using embedded RAW preview')
      }
    })

    return () => {
      offIndex()
      offDecode()
    }
  }, [activeId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        const nextIndex = activeIndex + 1
        if (nextIndex < items.length) {
          const next = items[nextIndex]
          setActiveId(next.id)
          selectOnly(next.id, nextIndex)
        }
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        const nextIndex = activeIndex - 1
        if (nextIndex >= 0) {
          const next = items[nextIndex]
          setActiveId(next.id)
          selectOnly(next.id, nextIndex)
        }
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = Math.min(items.length - 1, activeIndex + gridColumnCount)
        if (nextIndex >= 0 && nextIndex < items.length) {
          const next = items[nextIndex]
          setActiveId(next.id)
          selectOnly(next.id, nextIndex)
        }
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const nextIndex = activeIndex - gridColumnCount
        if (nextIndex >= 0) {
          const next = items[nextIndex]
          setActiveId(next.id)
          selectOnly(next.id, nextIndex)
        }
        return
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        setZoomScale((current) => (current > 1.01 ? 1 : 2))
        return
      }

      if (event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setIsDarkTheme((current) => !current)
        return
      }

      if (event.key === '1') {
        event.preventDefault()
        void applyStatus('keep')
        return
      }

      if (event.key.toLowerCase() === 'x') {
        event.preventDefault()
        void applyStatus('reject')
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        void applyStatus('unrated')
        return
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        rotateSelection()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, items, selectOnly, applyStatus, rotateSelection, gridColumnCount])

  return (
    <div className="rv-shell">
      <FolderBar
        defaultDirection={defaultDirection}
        filterStatus={filterStatus}
        folderPath={folderPath}
        isBusy={isBusy}
        onDefaultDirectionToggle={toggleDefaultDirection}
        onFilterStatus={setFilterStatus}
        onMoveRejected={moveRejected}
        onPickFolder={pickFolder}
        onSyncXmp={syncXmp}
        progressLabel={progressLabel}
        total={total}
      />

      <main className="rv-main">
        <section className="rv-gallery-panel">
          <div className="rv-quick-actions">
            <Button
              disabled={!activeItem}
              onClick={() => void applyStatus('keep')}
              size="sm"
              type="button"
            >
              Keep (1)
            </Button>
            <Button
              disabled={!activeItem}
              onClick={() => void applyStatus('reject')}
              size="sm"
              type="button"
              variant="destructive"
            >
              Reject (X)
            </Button>
            <Button
              disabled={!activeItem}
              onClick={() => void applyStatus('unrated')}
              size="sm"
              type="button"
              variant="secondary"
            >
              Unrate (0)
            </Button>
            <Button
              disabled={!activeItem}
              onClick={rotateSelection}
              size="sm"
              type="button"
              variant="outline"
            >
              Rotate (R)
            </Button>
          </div>
          <GalleryGrid
            activeId={activeId}
            getRotationTurns={getRotationTurns}
            items={items}
            onColumnCountChange={setGridColumnCount}
            onActivate={activateItem}
            selectedIds={selectedSet}
          />
        </section>

        <ViewerPane
          decodeSupport={viewerDecodeSupport}
          image={activeItem}
          onToggleZoom={() => setZoomScale((current) => (current > 1.01 ? 1 : 2))}
          onZoomScaleChange={setZoomScale}
          rotationTurns={activeRotationTurns}
          sourcePath={viewerSourcePath}
          zoomScale={zoomScale}
          zoomed={zoomed}
        />
      </main>
    </div>
  )
}

export default App
