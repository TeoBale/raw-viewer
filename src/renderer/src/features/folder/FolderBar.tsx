import type { RawStatus } from '../../../../shared/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

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
  selectedCount: number
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
  selectedCount,
  progressLabel
}: FolderBarProps): React.JSX.Element {
  const directionIcon = defaultDirection === 'horizontal' ? '↔' : '↕'
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
      </div>

      <div className="rv-right">
        <div className="rv-control">
          <span className="rv-control-label">Filter</span>
          <Select
            onValueChange={(value) => onFilterStatus(value as RawStatus | 'all')}
            value={filterStatus}
          >
            <SelectTrigger className="rv-filter-select" size="sm">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unrated">Unrated</SelectItem>
              <SelectItem value="keep">Keep</SelectItem>
              <SelectItem value="reject">Reject</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          aria-label={directionTitle}
          onClick={onDefaultDirectionToggle}
          size="sm"
          title={directionTitle}
          type="button"
          variant="outline"
        >
          {directionIcon}
        </Button>
        <Button disabled={isBusy} onClick={onSyncXmp} size="sm" type="button" variant="outline">
          Sync XMP
        </Button>
        <Button
          disabled={isBusy}
          onClick={onMoveRejected}
          size="sm"
          type="button"
          variant="outline"
        >
          Move Rejected
        </Button>
        <Badge className="rv-pill" variant="secondary">
          {total} files
        </Badge>
        <Badge className="rv-pill" variant="secondary">
          {selectedCount} selected
        </Badge>
        <Badge className="rv-pill is-progress" variant="outline">
          {progressLabel}
        </Badge>
      </div>
    </header>
  )
}
