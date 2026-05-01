import { appendFile, mkdir, rename, stat } from 'node:fs/promises'
import { join, dirname, relative, extname, basename } from 'node:path'
import type {
  MoveRejectedRequest,
  MoveRejectedResult,
  RawStatus,
  SetImageStatusRequest,
  SetImageStatusResult
} from '../../../shared/contracts'
import { CatalogDb } from '../catalog/catalog-db'

export class SelectionService {
  constructor(
    private readonly db: CatalogDb,
    private readonly appDataPath: string
  ) {}

  setImageStatus(input: SetImageStatusRequest): SetImageStatusResult {
    const updated = this.db.setImageStatuses(input.imageIds, input.status)
    return { updated }
  }

  async moveRejected(input: MoveRejectedRequest): Promise<MoveRejectedResult> {
    const strategy = input.strategy ?? 'sibling_rejected'
    const destinationRoot =
      strategy === 'sibling_rejected'
        ? join(input.folderPath, '_rejected')
        : join(input.folderPath, '_rejected')

    const rejected = this.db.getRejectedImages(input.folderPath)
    const errors: string[] = []
    let moved = 0

    for (const image of rejected) {
      const rel = relative(input.folderPath, image.filePath)
      const targetBase = join(destinationRoot, rel)

      try {
        const targetPath = await this.resolveCollision(targetBase)
        await mkdir(dirname(targetPath), { recursive: true })
        await rename(image.filePath, targetPath)
        const stats = await stat(targetPath)
        this.db.updateImagePath(image.id, targetPath, stats.size, stats.mtimeMs)
        await this.appendMoveLog({
          imageId: image.id,
          source: image.filePath,
          destination: targetPath,
          timestamp: Date.now()
        })
        moved += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_move_error'
        errors.push(`${image.filePath}: ${message}`)
      }
    }

    return { moved, destinationRoot, errors }
  }

  private async resolveCollision(targetPath: string): Promise<string> {
    const extension = extname(targetPath)
    const fileName = basename(targetPath, extension)
    const dir = dirname(targetPath)

    let candidate = targetPath
    let index = 1
    while (await this.exists(candidate)) {
      candidate = join(dir, `${fileName}_${index}${extension}`)
      index += 1
    }
    return candidate
  }

  private async exists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath)
      return true
    } catch {
      return false
    }
  }

  private async appendMoveLog(entry: {
    imageId: string
    source: string
    destination: string
    timestamp: number
  }): Promise<void> {
    const logsDir = join(this.appDataPath, 'logs')
    await mkdir(logsDir, { recursive: true })
    const filePath = join(logsDir, 'move-rejected.log.jsonl')
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
  }
}

export function mapStatusToRating(status: RawStatus): number {
  if (status === 'reject') return -1
  if (status === 'keep') return 1
  return 0
}
