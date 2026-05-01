import { cpus } from 'node:os'
import { mkdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { basename, extname, join, dirname } from 'node:path'
import { exiftool } from 'exiftool-vendored'
import sharp from 'sharp'
import type { ImageItem } from '../../../shared/contracts'
import { TaskQueue } from '../common/task-queue'
import { CatalogDb } from '../catalog/catalog-db'

interface PreviewAssets {
  thumbPath: string
  previewPath: string
}

export class PreviewService {
  private readonly previewDir: string
  private readonly thumbDir: string
  private readonly queue: TaskQueue
  private readonly db: CatalogDb

  constructor(cacheRoot: string, db: CatalogDb) {
    this.previewDir = join(cacheRoot, 'preview')
    this.thumbDir = join(cacheRoot, 'thumb')
    this.queue = new TaskQueue(Math.max(2, Math.floor(cpus().length / 2)))
    this.db = db
  }

  async ensurePreviewAssets(image: ImageItem): Promise<PreviewAssets> {
    return this.queue.enqueue(async () => {
      if (image.thumbPath && image.previewPath) {
        const [thumbOk, previewOk] = await Promise.all([
          this.exists(image.thumbPath),
          this.exists(image.previewPath)
        ])
        if (thumbOk && previewOk) {
          return { thumbPath: image.thumbPath, previewPath: image.previewPath }
        }
      }

      await Promise.all([
        mkdir(this.previewDir, { recursive: true }),
        mkdir(this.thumbDir, { recursive: true })
      ])

      const key = this.buildCacheKey(image.filePath, image.fileSize, image.mtimeMs)
      const previewPath = join(this.previewDir, `${key}.jpg`)
      const thumbPath = join(this.thumbDir, `${key}.jpg`)

      if (!(await this.exists(previewPath))) {
        await this.extractPreviewChain(image.filePath, previewPath)
      }

      if (!(await this.exists(thumbPath))) {
        await sharp(previewPath)
          .rotate()
          .resize({ width: 380, height: 380, fit: 'inside' })
          .jpeg({ quality: 82 })
          .toFile(thumbPath)
      }

      this.db.updateCachePaths(image.id, { thumbPath, previewPath })

      return { thumbPath, previewPath }
    })
  }

  private async extractPreviewChain(imagePath: string, previewPath: string): Promise<void> {
    const tmpPreview = `${previewPath}.tmp`
    const tmpJpgRaw = `${previewPath}.jpgraw.tmp`
    const tmpThumb = `${previewPath}.thumb.tmp`

    try {
      await exiftool.extractPreview(imagePath, tmpPreview)
      await mkdir(dirname(previewPath), { recursive: true })
      await sharp(tmpPreview).rotate().jpeg({ quality: 92 }).toFile(previewPath)
      return
    } catch {
      // Keep chaining fallbacks
    }

    try {
      await exiftool.extractJpgFromRaw(imagePath, tmpJpgRaw)
      await sharp(tmpJpgRaw).rotate().jpeg({ quality: 92 }).toFile(previewPath)
      return
    } catch {
      // Keep chaining fallbacks
    }

    await exiftool.extractThumbnail(imagePath, tmpThumb)
    await sharp(tmpThumb)
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toFile(previewPath)
  }

  private buildCacheKey(filePath: string, size: number, mtimeMs: number): string {
    return createHash('sha1').update(`${filePath}:${size}:${mtimeMs}`).digest('hex')
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }

  makeFallbackThumbLabel(filePath: string): string {
    const name = basename(filePath, extname(filePath))
    return name.slice(0, 3).toUpperCase()
  }
}
