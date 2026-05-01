import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

export function useSelection(ids: string[]): {
  selectedIds: string[]
  selectedSet: Set<string>
  setSelectedIds: Dispatch<SetStateAction<string[]>>
  resetSelection: () => void
  selectOnly: (id: string, index: number) => void
  toggleSelection: (id: string, index: number) => void
  selectRange: (index: number) => void
  ensureSelection: (id: string, index: number) => void
} {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [anchorIndex, setAnchorIndex] = useState<number | null>(null)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const resetSelection = useCallback(() => {
    setSelectedIds([])
    setAnchorIndex(null)
  }, [])

  const selectOnly = useCallback((id: string, index: number) => {
    setSelectedIds([id])
    setAnchorIndex(index)
  }, [])

  const toggleSelection = useCallback((id: string, index: number) => {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id)
      }
      return [...current, id]
    })
    setAnchorIndex(index)
  }, [])

  const selectRange = useCallback(
    (index: number) => {
      if (anchorIndex === null) {
        const id = ids[index]
        if (id) {
          setSelectedIds([id])
          setAnchorIndex(index)
        }
        return
      }

      const start = Math.min(anchorIndex, index)
      const end = Math.max(anchorIndex, index)
      const range = ids.slice(start, end + 1)
      setSelectedIds(range)
    },
    [anchorIndex, ids]
  )

  const ensureSelection = useCallback(
    (id: string, index: number) => {
      if (!selectedSet.has(id)) {
        selectOnly(id, index)
      }
    },
    [selectedSet, selectOnly]
  )

  return {
    selectedIds,
    selectedSet,
    setSelectedIds,
    resetSelection,
    selectOnly,
    toggleSelection,
    selectRange,
    ensureSelection
  }
}
