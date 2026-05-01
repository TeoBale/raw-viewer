export function toRawCacheUrl(path: string | null): string {
  if (!path) return ''
  return `raw-cache://local/${encodeURIComponent(path)}`
}
