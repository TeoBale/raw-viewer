import type { RawStatus } from '../../../../shared/contracts'

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
        <button onClick={onPickFolder} type="button">
          {folderPath ? 'Change Folder' : 'Pick Folder'}
        </button>
        <span className="rv-folder-path">{folderPath ?? 'No folder selected'}</span>
      </div>

      <div className="rv-right">
        <label>
          Filter
          <select
            onChange={(event) => onFilterStatus(event.target.value as RawStatus | 'all')}
            value={filterStatus}
          >
            <option value="all">All</option>
            <option value="unrated">Unrated</option>
            <option value="keep">Keep</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        <label>
          Direction
          <button onClick={onDefaultDirectionToggle} title={directionTitle} type="button">
            {directionIcon}
          </button>
        </label>
        <button disabled={isBusy} onClick={onSyncXmp} type="button">
          Sync XMP
        </button>
        <button disabled={isBusy} onClick={onMoveRejected} type="button">
          Move Rejected
        </button>
        <span className="rv-pill">{total} files</span>
        <span className="rv-pill">{selectedCount} selected</span>
        <span className="rv-pill is-progress">{progressLabel}</span>
      </div>
    </header>
  )
}
