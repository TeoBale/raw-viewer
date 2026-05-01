import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { DecodeSupport, ImageItem, RawStatus } from '../../../shared/contracts'

export interface PersistedImage {
  id: string
  folderPath: string
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
  decodeSupport: DecodeSupport
}

export interface QueryOptions {
  folderPath: string
  offset: number
  limit: number
  sortField: 'captureDate' | 'fileName' | 'mtimeMs' | 'rating'
  sortDirection: 'asc' | 'desc'
  status: RawStatus | 'all'
}

interface ImageRow {
  id: string
  file_path: string
  file_name: string
  ext: string
  file_size: number
  mtime_ms: number
  capture_date: string | null
  camera_model: string | null
  lens: string | null
  iso: number | null
  shutter: string | null
  aperture: number | null
  width: number | null
  height: number | null
  orientation: number | null
  status: RawStatus | null
  rating: number | null
  label: string | null
  thumb_path: string | null
  preview_path: string | null
  full_path: string | null
  decode_support: DecodeSupport | null
}

export class CatalogDb {
  private readonly db: Database.Database

  constructor(dbFilePath: string) {
    mkdirSync(dirname(dbFilePath), { recursive: true })
    this.db = new Database(dbFilePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        folder_path TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        ext TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mtime_ms INTEGER NOT NULL,
        capture_date TEXT,
        camera_model TEXT,
        lens TEXT,
        iso INTEGER,
        shutter TEXT,
        aperture REAL,
        width INTEGER,
        height INTEGER,
        orientation INTEGER,
        decode_support TEXT NOT NULL DEFAULT 'unknown',
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cache_assets (
        image_id TEXT PRIMARY KEY,
        thumb_path TEXT,
        preview_path TEXT,
        full_path TEXT,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS decisions (
        image_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'unrated',
        rating INTEGER NOT NULL DEFAULT 0,
        label TEXT,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(image_id) REFERENCES images(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_images_folder_path ON images(folder_path);
      CREATE INDEX IF NOT EXISTS idx_images_file_name ON images(file_name);
      CREATE INDEX IF NOT EXISTS idx_images_capture_date ON images(capture_date);
      CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
    `)
  }

  close(): void {
    this.db.close()
  }

  upsertImage(image: PersistedImage): void {
    const now = Date.now()
    const stmt = this.db.prepare(`
      INSERT INTO images (
        id, folder_path, file_path, file_name, ext, file_size, mtime_ms,
        capture_date, camera_model, lens, iso, shutter, aperture,
        width, height, orientation, decode_support, updated_at
      ) VALUES (
        @id, @folderPath, @filePath, @fileName, @ext, @fileSize, @mtimeMs,
        @captureDate, @cameraModel, @lens, @iso, @shutter, @aperture,
        @width, @height, @orientation, @decodeSupport, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        folder_path=excluded.folder_path,
        file_path=excluded.file_path,
        file_name=excluded.file_name,
        ext=excluded.ext,
        file_size=excluded.file_size,
        mtime_ms=excluded.mtime_ms,
        capture_date=excluded.capture_date,
        camera_model=excluded.camera_model,
        lens=excluded.lens,
        iso=excluded.iso,
        shutter=excluded.shutter,
        aperture=excluded.aperture,
        width=excluded.width,
        height=excluded.height,
        orientation=excluded.orientation,
        decode_support=excluded.decode_support,
        updated_at=excluded.updated_at
    `)

    stmt.run({ ...image, updatedAt: now })

    this.db
      .prepare(
        `INSERT INTO decisions (image_id, status, rating, updated_at)
         VALUES (?, 'unrated', 0, ?)
         ON CONFLICT(image_id) DO NOTHING`
      )
      .run(image.id, now)
  }

  getKnownFileState(filePath: string): { fileSize: number; mtimeMs: number } | null {
    const row = this.db
      .prepare('SELECT file_size, mtime_ms FROM images WHERE file_path = ?')
      .get(filePath) as { file_size: number; mtime_ms: number } | undefined

    if (!row) {
      return null
    }

    return { fileSize: row.file_size, mtimeMs: row.mtime_ms }
  }

  updateCachePaths(
    imageId: string,
    paths: { thumbPath?: string | null; previewPath?: string | null; fullPath?: string | null }
  ): void {
    const now = Date.now()
    const existing = this.db
      .prepare(
        'SELECT image_id, thumb_path, preview_path, full_path FROM cache_assets WHERE image_id = ?'
      )
      .get(imageId) as
      | {
          image_id: string
          thumb_path: string | null
          preview_path: string | null
          full_path: string | null
        }
      | undefined

    const payload = {
      imageId,
      thumbPath: paths.thumbPath ?? existing?.thumb_path ?? null,
      previewPath: paths.previewPath ?? existing?.preview_path ?? null,
      fullPath: paths.fullPath ?? existing?.full_path ?? null,
      updatedAt: now
    }

    this.db
      .prepare(
        `INSERT INTO cache_assets (image_id, thumb_path, preview_path, full_path, updated_at)
         VALUES (@imageId, @thumbPath, @previewPath, @fullPath, @updatedAt)
         ON CONFLICT(image_id) DO UPDATE SET
          thumb_path=excluded.thumb_path,
          preview_path=excluded.preview_path,
          full_path=excluded.full_path,
          updated_at=excluded.updated_at`
      )
      .run(payload)
  }

  setDecodeSupport(imageId: string, decodeSupport: DecodeSupport): void {
    this.db
      .prepare('UPDATE images SET decode_support = ?, updated_at = ? WHERE id = ?')
      .run(decodeSupport, Date.now(), imageId)
  }

  getImageById(imageId: string): ImageItem | null {
    const row = this.db
      .prepare(
        `SELECT
          i.id,
          i.file_path,
          i.file_name,
          i.ext,
          i.file_size,
          i.mtime_ms,
          i.capture_date,
          i.camera_model,
          i.lens,
          i.iso,
          i.shutter,
          i.aperture,
          i.width,
          i.height,
          i.orientation,
          i.decode_support,
          d.status,
          d.rating,
          d.label,
          c.thumb_path,
          c.preview_path,
          c.full_path
        FROM images i
        LEFT JOIN decisions d ON d.image_id = i.id
        LEFT JOIN cache_assets c ON c.image_id = i.id
        WHERE i.id = ?`
      )
      .get(imageId) as ImageRow | undefined

    return row ? this.mapImageRow(row) : null
  }

  queryImages(options: QueryOptions): { total: number; items: ImageItem[] } {
    const sortFieldMap: Record<QueryOptions['sortField'], string> = {
      captureDate: 'i.capture_date',
      fileName: 'i.file_name',
      mtimeMs: 'i.mtime_ms',
      rating: 'd.rating'
    }

    const sortField = sortFieldMap[options.sortField]
    const sortDirection = options.sortDirection.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const whereClauses: string[] = ['i.folder_path = @folderPath']
    if (options.status !== 'all') {
      whereClauses.push('d.status = @status')
    }

    const whereSql = whereClauses.join(' AND ')

    const totalRow = this.db
      .prepare(
        `SELECT COUNT(1) AS total
         FROM images i
         LEFT JOIN decisions d ON d.image_id = i.id
         WHERE ${whereSql}`
      )
      .get(options) as { total: number }

    const rows = this.db
      .prepare(
        `SELECT
          i.id,
          i.file_path,
          i.file_name,
          i.ext,
          i.file_size,
          i.mtime_ms,
          i.capture_date,
          i.camera_model,
          i.lens,
          i.iso,
          i.shutter,
          i.aperture,
          i.width,
          i.height,
          i.orientation,
          i.decode_support,
          d.status,
          d.rating,
          d.label,
          c.thumb_path,
          c.preview_path,
          c.full_path
         FROM images i
         LEFT JOIN decisions d ON d.image_id = i.id
         LEFT JOIN cache_assets c ON c.image_id = i.id
         WHERE ${whereSql}
         ORDER BY ${sortField} ${sortDirection}, i.file_name ASC
         LIMIT @limit OFFSET @offset`
      )
      .all(options) as ImageRow[]

    return {
      total: totalRow.total,
      items: rows.map((row) => this.mapImageRow(row))
    }
  }

  setImageStatuses(imageIds: string[], status: RawStatus): number {
    if (imageIds.length === 0) {
      return 0
    }

    const rating = status === 'reject' ? -1 : status === 'keep' ? 1 : 0
    const now = Date.now()
    const stmt = this.db.prepare(
      `INSERT INTO decisions (image_id, status, rating, updated_at)
       VALUES (@imageId, @status, @rating, @updatedAt)
       ON CONFLICT(image_id) DO UPDATE SET
        status=excluded.status,
        rating=excluded.rating,
        updated_at=excluded.updated_at`
    )

    const tx = this.db.transaction((ids: string[]) => {
      for (const imageId of ids) {
        stmt.run({ imageId, status, rating, updatedAt: now })
      }
    })

    tx(imageIds)
    return imageIds.length
  }

  getRejectedImages(folderPath: string): Array<{ id: string; filePath: string; fileName: string }> {
    const rows = this.db
      .prepare(
        `SELECT i.id, i.file_path, i.file_name
         FROM images i
         INNER JOIN decisions d ON d.image_id = i.id
         WHERE i.folder_path = ? AND d.status = 'reject'
         ORDER BY i.file_name ASC`
      )
      .all(folderPath) as Array<{ id: string; file_path: string; file_name: string }>

    return rows.map((row) => ({ id: row.id, filePath: row.file_path, fileName: row.file_name }))
  }

  updateImagePath(imageId: string, nextPath: string, fileSize: number, mtimeMs: number): void {
    const fileName = nextPath.split(/[\\/]/).pop() ?? nextPath
    const ext = fileName.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.') + 1).toLowerCase()
      : ''

    this.db
      .prepare(
        `UPDATE images
         SET file_path = ?, file_name = ?, ext = ?, file_size = ?, mtime_ms = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(nextPath, fileName, ext, fileSize, mtimeMs, Date.now(), imageId)
  }

  getDecisionRows(
    folderPath: string,
    imageIds?: string[]
  ): Array<{
    imageId: string
    filePath: string
    status: RawStatus
    rating: number
    updatedAt: number
  }> {
    const hasIds = Boolean(imageIds?.length)
    const placeholders = hasIds
      ? ` AND i.id IN (${new Array(imageIds!.length).fill('?').join(',')})`
      : ''

    const stmt = this.db.prepare(
      `SELECT i.id AS image_id, i.file_path, d.status, d.rating, d.updated_at
       FROM images i
       INNER JOIN decisions d ON d.image_id = i.id
       WHERE i.folder_path = ?${placeholders}`
    )

    const rows = (
      hasIds ? stmt.all(folderPath, ...(imageIds ?? [])) : stmt.all(folderPath)
    ) as Array<{
      image_id: string
      file_path: string
      status: RawStatus
      rating: number
      updated_at: number
    }>

    return rows.map((row) => ({
      imageId: row.image_id,
      filePath: row.file_path,
      status: row.status,
      rating: row.rating,
      updatedAt: row.updated_at
    }))
  }

  setDecisionFromRating(imageId: string, rating: number): void {
    const status: RawStatus = rating < 0 ? 'reject' : rating > 0 ? 'keep' : 'unrated'
    this.db
      .prepare(
        `INSERT INTO decisions (image_id, status, rating, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(image_id) DO UPDATE SET
           status=excluded.status,
           rating=excluded.rating,
           updated_at=excluded.updated_at`
      )
      .run(imageId, status, rating, Date.now())
  }

  private mapImageRow(row: ImageRow): ImageItem {
    return {
      id: row.id,
      filePath: row.file_path,
      fileName: row.file_name,
      ext: row.ext,
      fileSize: row.file_size,
      mtimeMs: row.mtime_ms,
      captureDate: row.capture_date,
      cameraModel: row.camera_model,
      lens: row.lens,
      iso: row.iso,
      shutter: row.shutter,
      aperture: row.aperture,
      width: row.width,
      height: row.height,
      orientation: row.orientation,
      status: row.status ?? 'unrated',
      rating: row.rating ?? 0,
      label: row.label,
      thumbPath: row.thumb_path,
      previewPath: row.preview_path,
      fullPath: row.full_path,
      decodeSupport: row.decode_support ?? 'unknown'
    }
  }
}
