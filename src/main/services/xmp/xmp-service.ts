import { readFile, stat, writeFile } from 'node:fs/promises'
import type { SyncXmpRequest, SyncXmpResult } from '../../../shared/contracts'
import { CatalogDb } from '../catalog/catalog-db'

export class XmpService {
  constructor(private readonly db: CatalogDb) {}

  async sync(input: SyncXmpRequest): Promise<SyncXmpResult> {
    const decisionRows = this.db.getDecisionRows(input.folderPath, input.imageIds)
    const errors: string[] = []
    let written = 0
    let adoptedFromSidecar = 0
    let conflicts = 0

    for (const row of decisionRows) {
      const xmpPath = `${row.filePath}.xmp`

      try {
        const sidecarStats = await this.safeStat(xmpPath)
        if (sidecarStats && sidecarStats.mtimeMs > row.updatedAt) {
          const sidecarRating = await this.readXmpRating(xmpPath)
          if (sidecarRating !== null) {
            this.db.setDecisionFromRating(row.imageId, sidecarRating)
            adoptedFromSidecar += 1
            conflicts += 1
            continue
          }
        }

        await this.writeXmpRating(xmpPath, row.rating)
        written += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'sync_failed'
        errors.push(`${row.filePath}: ${message}`)
      }
    }

    return { written, adoptedFromSidecar, conflicts, errors }
  }

  private async readXmpRating(xmpPath: string): Promise<number | null> {
    const content = await readFile(xmpPath, 'utf8')

    const valueMatch = content.match(/<xmp:Rating>(-?\\d+)<\/xmp:Rating>/i)
    if (valueMatch?.[1]) {
      return Number.parseInt(valueMatch[1], 10)
    }

    const attrMatch = content.match(/xmp:Rating="(-?\\d+)"/i)
    if (attrMatch?.[1]) {
      return Number.parseInt(attrMatch[1], 10)
    }

    return null
  }

  private async writeXmpRating(xmpPath: string, rating: number): Promise<void> {
    const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmp:Rating="${rating}">
      <xmp:Rating>${rating}</xmp:Rating>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

    await writeFile(xmpPath, xmp, 'utf8')
  }

  private async safeStat(filePath: string): Promise<{ mtimeMs: number } | null> {
    try {
      const result = await stat(filePath)
      return { mtimeMs: result.mtimeMs }
    } catch {
      return null
    }
  }
}
