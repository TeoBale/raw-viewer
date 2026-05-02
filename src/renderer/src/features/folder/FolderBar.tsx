import type { RawStatus } from '../../../../shared/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ListFilter,
  RectangleHorizontal,
  RectangleVertical,
  ArrowUpDown,
  RefreshCcw
} from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

type PreviewDirection = 'horizontal' | 'vertical'

interface FolderBarProps {
  folderPath: string | null
  filterStatus: RawStatus | 'all'
  defaultDirection: PreviewDirection
  onPickFolder: () => void
  onFilterStatus: (status: RawStatus | 'all') => void
  onDefaultDirectionToggle: () => void
  onMoveRejected: () => void
  onSyncXmp: () => void
  isBusy: boolean
  total: number
  progressLabel: string
}

export function FolderBar({
  folderPath,
  filterStatus,
  defaultDirection,
  onPickFolder,
  onFilterStatus,
  onDefaultDirectionToggle,
  onMoveRejected,
  onSyncXmp,
  isBusy,
  total,
  progressLabel
}: FolderBarProps): React.JSX.Element {
  const DirectionIcon = defaultDirection === 'horizontal' ? RectangleHorizontal : RectangleVertical
  const directionTitle =
    defaultDirection === 'horizontal'
      ? 'Default direction: Horizontal (click to switch to Vertical)'
      : 'Default direction: Vertical (click to switch to Horizontal)'

  return (
    <header className="rv-topbar">
      <div className="rv-left">
        <Button onClick={onPickFolder} size="sm" type="button" variant="secondary">
          {folderPath ? 'Change Folder' : 'Pick Folder'}
        </Button>
        <span className="rv-folder-path">{folderPath ?? 'No folder selected'}</span>
        <Badge className="rv-pill" variant="secondary">
          {total} files
        </Badge>
      </div>

      <div className="rv-right" title={progressLabel}>
        <Select
          onValueChange={(value) => onFilterStatus(value as RawStatus | 'all')}
          value={filterStatus}
        >
          <SelectTrigger
            aria-label={`Filter: ${filterStatus}`}
            className="rv-filter-trigger"
            showIndicator={false}
            variant="ghost"
            size="icon-sm"
            title={`Filter: ${filterStatus}`}
          >
            <ListFilter size={14} />
          </SelectTrigger>
          <SelectContent align="end" className="p-1">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unrated">Unrated</SelectItem>
            <SelectItem value="keep">Keep</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
          </SelectContent>
        </Select>
        <Button
          aria-label={directionTitle}
          onClick={onDefaultDirectionToggle}
          size="icon-sm"
          title={directionTitle}
          type="button"
          variant="ghost"
        >
          <DirectionIcon size={14} />
        </Button>
        <Button disabled={isBusy} onClick={onSyncXmp} size="sm" type="button" variant="outline">
          <RefreshCcw />
          Sync XMP
        </Button>
        <Button
          disabled={isBusy}
          onClick={onMoveRejected}
          size="sm"
          type="button"
          variant="outline"
        >
          <ArrowUpDown />
          Move Rejected
        </Button>
      </div>
    </header>
  )
}
