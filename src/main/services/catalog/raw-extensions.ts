export const RAW_EXTENSIONS = new Set([
  'cr2',
  'cr3',
  'nef',
  'nrw',
  'arw',
  'raf',
  'rw2',
  'orf',
  'dng',
  'pef',
  'srw',
  '3fr',
  'iiq',
  'kdc',
  'mos',
  'mef',
  'mrw',
  'rwl',
  'x3f',
  'erf',
  'raw'
])

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  if (index < 0 || index === fileName.length - 1) {
    return ''
  }

  return fileName.slice(index + 1).toLowerCase()
}

export function isRawFile(fileName: string): boolean {
  return RAW_EXTENSIONS.has(getFileExtension(fileName))
}
