export const BACKUP_FORMAT = 'project-nomad-backup'
export const BACKUP_FORMAT_VERSION = 1

export type BackupTarget = 'local' | 'rclone'

export type BackupManifest = {
  format: typeof BACKUP_FORMAT
  format_version: typeof BACKUP_FORMAT_VERSION
  created_at: string
  app_version: string
  storage_entry: string
  database_entry: string
  included: ['storage', 'mysql']
  excluded: ['redis-queue-and-cache-state', 'container-images-and-host-config']
}

export type BackupArchiveInfo = {
  filename: string
  size_bytes: number
  created_at: string
  target: BackupTarget
}

export type BackupStatus = {
  local: {
    path: string
    writable: boolean
    archives: BackupArchiveInfo[]
    error?: string
  }
  rclone: {
    configured: boolean
    available: boolean
    remote: string | null
    archives: BackupArchiveInfo[]
    error?: string
  }
}

export type BackupOperationResult = {
  success: boolean
  message: string
  filename?: string
  target?: BackupTarget
}
