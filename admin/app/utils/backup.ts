import { basename, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, type BackupManifest } from '../../types/backup.js'

const BACKUP_FILENAME_PATTERN = /^nomad-backup-\d{8}T\d{6}Z-[a-f0-9]{8}\.tar\.gz$/

export function buildBackupFilename(date = new Date(), id: string = randomUUID()): string {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
  return `nomad-backup-${timestamp}-${id.replace(/-/g, '').slice(0, 8)}.tar.gz`
}

export function isSafeBackupFilename(filename: string): boolean {
  return basename(filename) === filename && BACKUP_FILENAME_PATTERN.test(filename)
}

/**
 * Tar entries are always POSIX paths, even when the archive was created on
 * Windows. Reject absolute paths, traversal, drive prefixes, and control
 * characters before an archive is extracted to disk.
 */
export function isSafeArchiveEntry(entry: string): boolean {
  if (
    !entry ||
    [...entry].some((character) => {
      const code = character.charCodeAt(0)
      return code <= 0x1f || code === 0x7f
    })
  ) {
    return false
  }

  const normalized = entry.replace(/\\/g, '/')
  if (
    normalized.replace(/\/+$/, '') === '.' ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    return false
  }

  const segments = normalized.split('/')
  return segments.every((segment) => segment !== '..')
}

export function resolveInside(root: string, entry: string): string | null {
  if (!isSafeArchiveEntry(entry)) return null

  const resolvedRoot = resolve(root)
  const resolvedEntry = resolve(resolvedRoot, entry)
  const pathFromRoot = relative(resolvedRoot, resolvedEntry)

  if (pathFromRoot && !pathFromRoot.startsWith(`..${sep}`)) {
    return resolvedEntry
  }

  return null
}

export function createBackupManifest(input: {
  createdAt: Date
  appVersion: string
  storageEntry: string
  databaseEntry: string
}): BackupManifest {
  return {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    created_at: input.createdAt.toISOString(),
    app_version: input.appVersion,
    storage_entry: input.storageEntry,
    database_entry: input.databaseEntry,
    included: ['storage', 'mysql'],
    excluded: ['redis-queue-and-cache-state', 'container-images-and-host-config'],
  }
}

export function parseBackupManifest(value: unknown): BackupManifest {
  if (!value || typeof value !== 'object') {
    throw new Error('Backup manifest is missing or invalid')
  }

  const manifest = value as Partial<BackupManifest>
  if (
    manifest.format !== BACKUP_FORMAT ||
    manifest.format_version !== BACKUP_FORMAT_VERSION ||
    typeof manifest.created_at !== 'string' ||
    typeof manifest.app_version !== 'string' ||
    !isSafeArchiveEntry(manifest.storage_entry || '') ||
    !isSafeArchiveEntry(manifest.database_entry || '') ||
    manifest.storage_entry === manifest.database_entry ||
    JSON.stringify(manifest.included) !== JSON.stringify(['storage', 'mysql'])
  ) {
    throw new Error('Backup manifest is not a supported Project N.O.M.A.D. backup')
  }

  return manifest as BackupManifest
}
