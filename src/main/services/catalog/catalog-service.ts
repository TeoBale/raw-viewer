import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { exiftool } from 'exiftool-vendored'
import type {
  GetImagesPageRequest,
  GetImagesPageResult,
  ImageItem,
  IndexFolderRequest,
  IndexFolderResult,
  IndexProgressEvent
} from '../../../shared/contracts'
import { CatalogDb } from './catalog-db'
import { getFileExtension, isRawFile } from './raw-extensions'

interface IndexCandidate {
  filePath: string
  fileName: string
  ext: string
  size: number
  mtimeMs: number
}

export class CatalogService {
  private activeIndexToken = 0

  constructor(
    private readonly db: CatalogDb,
    private readonly emitIndexProgress: (event: IndexProgressEvent) => void
  ) {}

  async indexFolder(input: IndexFolderRequest): Promise<IndexFolderResult> {
    this.activeIndexToken += 1
    const token = this.activeIndexToken

    const start = Date.now()
    const candidates = await this.scanRawFiles(input.folderPath, input.recursive, token)

    let scanned = 0
    let indexed = 0
    let skipped = 0

    for (const candidate of candidates) {
      if (token !== this.activeIndexToken) {
        break
      }

      scanned += 1
      const known = this.db.getKnownFileState(candidate.filePath)
      if (
        known &&
        known.fileSize === candidate.size &&
        Math.floor(known.mtimeMs) === Math.floor(candidate.mtimeMs)
      ) {
        skipped += 1
        this.emitIndexProgress({
          folderPath: input.folderPath,
          scanned,
          total: candidates.length,
          indexed,
          skipped,
          phase: 'indexing'
        })
        continue
      }

      const metadata = await this.readMetadata(candidate.filePath)
      const id = this.buildImageId(candidate.filePath)

      this.db.upsertImage({
        id,
        folderPath: input.folderPath,
        filePath: candidate.filePath,
        fileName: candidate.fileName,
        ext: candidate.ext,
        fileSize: candidate.size,
        mtimeMs: candidate.mtimeMs,
        captureDate: metadata.captureDate,
        cameraModel: metadata.cameraModel,
        lens: metadata.lens,
        iso: metadata.iso,
        shutter: metadata.shutter,
        aperture: metadata.aperture,
        width: metadata.width,
        height: metadata.height,
        orientation: metadata.orientation,
        decodeSupport: 'unknown'
      })
      indexed += 1

      this.emitIndexProgress({
        folderPath: input.folderPath,
        scanned,
        total: candidates.length,
        indexed,
        skipped,
        phase: 'indexing'
      })
    }

    this.emitIndexProgress({
      folderPath: input.folderPath,
      scanned,
      total: candidates.length,
      indexed,
      skipped,
      phase: 'done'
    })

    return {
      folderPath: input.folderPath,
      scanned,
      indexed,
      skipped,
      durationMs: Date.now() - start
    }
  }

  getImagesPage(input: GetImagesPageRequest): GetImagesPageResult {
    const result = this.db.queryImages({
      folderPath: input.folderPath,
      offset: input.offset,
      limit: input.limit,
      sortField: input.sort?.field ?? 'captureDate',
      sortDirection: input.sort?.direction ?? 'desc',
      status: input.filter?.status ?? 'all'
    })

    return {
      items: result.items,
      total: result.total,
      offset: input.offset,
      limit: input.limit
    }
  }

  getImageById(imageId: string): ImageItem | null {
    return this.db.getImageById(imageId)
  }

  private async scanRawFiles(
    folderPath: string,
    recursive: boolean,
    token: number
  ): Promise<IndexCandidate[]> {
    const queue: string[] = [folderPath]
    const files: IndexCandidate[] = []

    while (queue.length > 0) {
      if (token !== this.activeIndexToken) {
        break
      }

      const current = queue.shift()
      if (!current) {
        continue
      }

      let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = []
      try {
        const dirents = await readdir(current, { withFileTypes: true })
        entries = dirents.map((entry) => ({
          name: String(entry.name),
          isDirectory: () => entry.isDirectory(),
          isFile: () => entry.isFile()
        }))
      } catch {
        continue
      }

      for (const entry of entries) {
        if (token !== this.activeIndexToken) {
          break
        }

        const fullPath = join(current, entry.name)
        if (entry.isDirectory()) {
          if (recursive) {
            queue.push(fullPath)
          }
          continue
        }

        if (!entry.isFile() || !isRawFile(entry.name)) {
          continue
        }

        const fileStats = await stat(fullPath)
        files.push({
          filePath: fullPath,
          fileName: basename(fullPath),
          ext: getFileExtension(entry.name),
          size: fileStats.size,
          mtimeMs: fileStats.mtimeMs
        })

        this.emitIndexProgress({
          folderPath,
          scanned: files.length,
          total: 0,
          indexed: 0,
          skipped: 0,
          phase: 'scanning'
        })
      }
    }

    files.sort((a, b) => a.fileName.localeCompare(b.fileName))
    return files
  }

  private async readMetadata(filePath: string): Promise<{
    captureDate: string | null
    cameraModel: string | null
    lens: string | null
    iso: number | null
    shutter: string | null
    aperture: number | null
    width: number | null
    height: number | null
    orientation: number | null
  }> {
    try {
      const tags = await exiftool.read(filePath)
      return {
        captureDate:
          typeof tags.DateTimeOriginal === 'string'
            ? tags.DateTimeOriginal
            : (tags.DateTimeOriginal?.toISOString() ?? null),
        cameraModel: this.toStringOrNull(tags.Model),
        lens: this.toStringOrNull(tags.LensModel ?? tags.LensID),
        iso: this.toNumberOrNull(tags.ISO),
        shutter: this.toStringOrNull(tags.ShutterSpeed),
        aperture: this.toNumberOrNull(tags.FNumber),
        width: this.toNumberOrNull(tags.ImageWidth),
        height: this.toNumberOrNull(tags.ImageHeight),
        orientation: this.toNumberOrNull(tags.Orientation)
      }
    } catch {
      return {
        captureDate: null,
        cameraModel: null,
        lens: null,
        iso: null,
        shutter: null,
        aperture: null,
        width: null,
        height: null,
        orientation: null
      }
    }
  }

  private buildImageId(filePath: string): string {
    return createHash('sha1').update(filePath).digest('hex')
  }

  private toStringOrNull(value: unknown): string | null {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }

    if (typeof value === 'number') {
      return `${value}`
    }

    return null
  }

  private toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    return null
  }
}
