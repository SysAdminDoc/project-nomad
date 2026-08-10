import { basename } from 'node:path'

export function normalizeClusterUrl(value: string): string {
  const parsed = new URL(value.trim())
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Cluster URL must be an HTTP or HTTPS URL without embedded credentials')
  }
  if (!parsed.hostname) throw new Error('Cluster URL must include a hostname')
  parsed.hash = ''
  parsed.search = ''
  return parsed.toString().replace(/\/$/, '')
}

export function isSafeClusterFilename(filename: string): boolean {
  if (!filename || filename === '.' || filename === '..' || basename(filename) !== filename) {
    return false
  }
  return ![...filename].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

export function buildClusterResourceKey(resourceId: string, resourceType: string): string {
  return `${resourceType}:${resourceId}`
}
