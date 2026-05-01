export type RawStatus = 'unrated' | 'keep' | 'reject'

export type PreviewLevel = 'thumb' | 'preview' | 'full'

export type DecodeSupport = 'unknown' | 'supported' | 'fallback' | 'decoding'

export interface ImageItem {
  id: string
  filePath: string
  fileName: string
  ext: string
  fileSize: number
  mtimeMs: number
  captureDate: string | null
  cameraModel: string | null
  lens: string | null
  iso: number | null
  shutter: string | null
  aperture: number | null
  width: number | null
  height: number | null
  orientation: number | null
  status: RawStatus
  rating: number
  label: string | null
  thumbPath: string | null
  previewPath: string | null
  fullPath: string | null
  decodeSupport: DecodeSupport
}

export interface IndexFolderRequest {
  folderPath: string
  recursive: boolean
}

export interface IndexFolderResult {
  folderPath: string
  scanned: number
  indexed: number
  skipped: number
  durationMs: number
}

export type SortField = 'captureDate' | 'fileName' | 'mtimeMs' | 'rating'
export type SortDirection = 'asc' | 'desc'

export interface ImagesSort {
  field: SortField
  direction: SortDirection
}

export interface ImagesFilter {
  status?: RawStatus | 'all'
}

export interface GetImagesPageRequest {
  folderPath: string
  offset: number
  limit: number
  sort?: ImagesSort
  filter?: ImagesFilter
}

export interface GetImagesPageResult {
  items: ImageItem[]
  total: number
  offset: number
  limit: number
}

export interface GetImageSourceRequest {
  imageId: string
  level: PreviewLevel
}

export interface GetImageSourceResult {
  imageId: string
  level: PreviewLevel
  sourcePath: string | null
  decodeSupport: DecodeSupport
}

export interface SetImageStatusRequest {
  imageIds: string[]
  status: RawStatus
}

export interface SetImageStatusResult {
  updated: number
}

export type MoveRejectedStrategy = 'sibling_rejected'

export interface MoveRejectedRequest {
  folderPath: string
  strategy?: MoveRejectedStrategy
}

export interface MoveRejectedResult {
  moved: number
  destinationRoot: string
  errors: string[]
}

export interface SyncXmpRequest {
  folderPath: string
  imageIds?: string[]
}

export interface SyncXmpResult {
  written: number
  adoptedFromSidecar: number
  conflicts: number
  errors: string[]
}

export interface IndexProgressEvent {
  folderPath: string
  scanned: number
  total: number
  indexed: number
  skipped: number
  phase: 'scanning' | 'indexing' | 'done'
}

export interface DecodeProgressEvent {
  imageId: string
  phase: 'queued' | 'decoding' | 'done' | 'error'
  fullPath?: string
  message?: string
}

export interface RawViewerApi {
  pickFolder: () => Promise<string | null>
  indexFolder: (input: IndexFolderRequest) => Promise<IndexFolderResult>
  getImagesPage: (input: GetImagesPageRequest) => Promise<GetImagesPageResult>
  getImageSource: (input: GetImageSourceRequest) => Promise<GetImageSourceResult>
  setImageStatus: (input: SetImageStatusRequest) => Promise<SetImageStatusResult>
  moveRejected: (input: MoveRejectedRequest) => Promise<MoveRejectedResult>
  syncXmp: (input: SyncXmpRequest) => Promise<SyncXmpResult>
  onIndexProgress: (callback: (event: IndexProgressEvent) => void) => () => void
  onDecodeProgress: (callback: (event: DecodeProgressEvent) => void) => () => void
}

export const IPC_CHANNELS = {
  pickFolder: 'raw:pick-folder',
  indexFolder: 'raw:index-folder',
  getImagesPage: 'raw:get-images-page',
  getImageSource: 'raw:get-image-source',
  setImageStatus: 'raw:set-image-status',
  moveRejected: 'raw:move-rejected',
  syncXmp: 'raw:sync-xmp',
  indexProgress: 'raw:index-progress',
  decodeProgress: 'raw:decode-progress'
} as const
