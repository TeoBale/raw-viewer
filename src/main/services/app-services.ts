import { app } from 'electron'
import { join } from 'node:path'
import type {
  DecodeProgressEvent,
  GetImageSourceRequest,
  GetImageSourceResult,
  GetImagesPageRequest,
  GetImagesPageResult,
  ImageItem,
  IndexFolderRequest,
  IndexFolderResult,
  IndexProgressEvent,
  MoveRejectedRequest,
  MoveRejectedResult,
  SetImageStatusRequest,
  SetImageStatusResult,
  SyncXmpRequest,
  SyncXmpResult
} from '../../shared/contracts'
import { CatalogDb } from './catalog/catalog-db'
import { CatalogService } from './catalog/catalog-service'
import { PreviewService } from './preview/preview-service'
import { DecoderService } from './decoder/decoder-service'
import { SelectionService } from './selection/selection-service'
import { XmpService } from './xmp/xmp-service'

export class AppServices {
  private readonly db: CatalogDb
  private readonly catalogService: CatalogService
  private readonly previewService: PreviewService
  private readonly decoderService: DecoderService
  private readonly selectionService: SelectionService
  private readonly xmpService: XmpService

  constructor(
    emitIndexProgress: (event: IndexProgressEvent) => void,
    emitDecodeProgress: (event: DecodeProgressEvent) => void
  ) {
    const userData = app.getPath('userData')
    const dbPath = join(userData, 'catalog', 'catalog.sqlite')
    const cacheRoot = join(userData, 'cache')

    this.db = new CatalogDb(dbPath)
    this.catalogService = new CatalogService(this.db, emitIndexProgress)
    this.previewService = new PreviewService(cacheRoot, this.db)
    this.decoderService = new DecoderService(cacheRoot, this.db, emitDecodeProgress)
    this.selectionService = new SelectionService(this.db, userData)
    this.xmpService = new XmpService(this.db)
  }

  close(): void {
    this.db.close()
  }

  async indexFolder(input: IndexFolderRequest): Promise<IndexFolderResult> {
    return this.catalogService.indexFolder(input)
  }

  getImagesPage(input: GetImagesPageRequest): GetImagesPageResult {
    return this.catalogService.getImagesPage(input)
  }

  async getImageSource(input: GetImageSourceRequest): Promise<GetImageSourceResult> {
    const image = this.catalogService.getImageById(input.imageId)
    if (!image) {
      return {
        imageId: input.imageId,
        level: input.level,
        sourcePath: null,
        decodeSupport: 'fallback'
      }
    }

    if (input.level === 'thumb') {
      const assets = await this.previewService.ensurePreviewAssets(image)
      return {
        imageId: input.imageId,
        level: input.level,
        sourcePath: assets.thumbPath,
        decodeSupport: image.decodeSupport
      }
    }

    const previewAssets = await this.previewService.ensurePreviewAssets(image)

    if (input.level === 'preview') {
      return {
        imageId: input.imageId,
        level: input.level,
        sourcePath: previewAssets.previewPath,
        decodeSupport: image.decodeSupport
      }
    }

    const fullPath = await this.decoderService.queueFullDecode({
      ...image,
      thumbPath: image.thumbPath ?? previewAssets.thumbPath,
      previewPath: image.previewPath ?? previewAssets.previewPath
    } as ImageItem)

    return {
      imageId: input.imageId,
      level: input.level,
      sourcePath: fullPath ?? previewAssets.previewPath,
      decodeSupport: fullPath ? 'supported' : 'fallback'
    }
  }

  setImageStatus(input: SetImageStatusRequest): SetImageStatusResult {
    return this.selectionService.setImageStatus(input)
  }

  moveRejected(input: MoveRejectedRequest): Promise<MoveRejectedResult> {
    return this.selectionService.moveRejected(input)
  }

  syncXmp(input: SyncXmpRequest): Promise<SyncXmpResult> {
    return this.xmpService.sync(input)
  }
}
