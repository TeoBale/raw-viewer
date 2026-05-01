import { cpus } from 'node:os'
import { createHash } from 'node:crypto'
import { mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import type { DecodeProgressEvent, ImageItem } from '../../../shared/contracts'
import { TaskQueue } from '../common/task-queue'
import { CatalogDb } from '../catalog/catalog-db'

export class DecoderService {
  private readonly fullDir: string
  private readonly queue: TaskQueue
  private readonly db: CatalogDb
  private readonly onProgress: (event: DecodeProgressEvent) => void

  constructor(cacheRoot: string, db: CatalogDb, onProgress: (event: DecodeProgressEvent) => void) {
    this.fullDir = join(cacheRoot, 'full')
    this.queue = new TaskQueue(Math.max(1, Math.floor(cpus().length / 3)))
    this.db = db
    this.onProgress = onProgress
  }

  queueFullDecode(image: ImageItem): Promise<string | null> {
    return this.queue.enqueue(async () => {
      if (image.fullPath && (await this.exists(image.fullPath))) {
        return image.fullPath
      }

      const key = createHash('sha1')
        .update(`${image.filePath}:${image.fileSize}:${image.mtimeMs}`)
        .digest('hex')
      await mkdir(this.fullDir, { recursive: true })
      const fullPath = join(this.fullDir, `${key}.jpg`)

      if (await this.exists(fullPath)) {
        this.db.updateCachePaths(image.id, { fullPath })
        this.db.setDecodeSupport(image.id, 'supported')
        return fullPath
      }

      this.onProgress({ imageId: image.id, phase: 'queued' })
      this.db.setDecodeSupport(image.id, 'decoding')

      try {
        this.onProgress({ imageId: image.id, phase: 'decoding' })
        await sharp(image.filePath, { limitInputPixels: false })
          .rotate()
          .jpeg({ quality: 96, mozjpeg: true })
          .toFile(fullPath)

        this.db.updateCachePaths(image.id, { fullPath })
        this.db.setDecodeSupport(image.id, 'supported')
        this.onProgress({ imageId: image.id, phase: 'done', fullPath })
        return fullPath
      } catch (error) {
        const message = error instanceof Error ? error.message : 'decode_failed'
        this.db.setDecodeSupport(image.id, 'fallback')
        this.onProgress({ imageId: image.id, phase: 'error', message })
        return null
      }
    })
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }
}
