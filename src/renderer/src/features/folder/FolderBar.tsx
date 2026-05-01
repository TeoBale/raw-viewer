import type { RawStatus } from '../../../../shared/contracts'

interface FolderBarProps {
  folderPath: string | null
  filterStatus: RawStatus | 'all'
  onPickFolder: () => void
  onFilterStatus: (status: RawStatus | 'all') => void
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
  onPickFolder,
  onFilterStatus,
  onMoveRejected,
  onSyncXmp,
  isBusy,
  total,
  selectedCount,
  progressLabel
}: FolderBarProps): React.JSX.Element {
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
