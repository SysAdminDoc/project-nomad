import { Head } from '@inertiajs/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledButton from '~/components/StyledButton'
import Alert from '~/components/Alert'
import { useNotifications } from '~/context/NotificationContext'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import type { BackupArchiveInfo, BackupStatus, BackupTarget } from '../../../types/backup'

function ArchiveList({
  title,
  archives,
  target,
  onRestore,
  restoring,
}: {
  title: string
  archives: BackupArchiveInfo[]
  target: BackupTarget
  onRestore: (target: BackupTarget, filename: string) => void
  restoring: boolean
}) {
  return (
    <section className="bg-surface-primary rounded-lg border border-border-subtle p-6">
      <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
      {archives.length === 0 ? (
        <p className="text-sm text-text-muted mt-4">No backup archives found.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {archives.map((archive) => (
            <div
              key={`${target}-${archive.filename}`}
              className="flex flex-col gap-3 rounded-md border border-border-subtle p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm text-text-primary break-all">{archive.filename}</p>
                <p className="text-xs text-text-muted mt-1">
                  {archive.size_bytes > 0 ? `${formatBytes(archive.size_bytes, 1)} · ` : ''}
                  {archive.created_at
                    ? new Date(archive.created_at).toLocaleString()
                    : 'Remote archive'}
                </p>
              </div>
              <StyledButton
                size="sm"
                variant="outline"
                icon="IconRefresh"
                onClick={() => onRestore(target, archive.filename)}
                loading={restoring}
                disabled={restoring}
              >
                Restore
              </StyledButton>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function BackupsPage() {
  const { addNotification } = useNotifications()
  const queryClient = useQueryClient()
  const statusQuery = useQuery<BackupStatus | undefined>({
    queryKey: ['backup-status'],
    queryFn: () => api.getBackupStatus(),
    refetchInterval: 30000,
  })

  const createMutation = useMutation({
    mutationFn: (target: BackupTarget) => api.createBackup(target),
    onSuccess: (result) => {
      if (result?.success) {
        addNotification({ type: 'success', message: result.message })
        queryClient.invalidateQueries({ queryKey: ['backup-status'] })
      } else {
        addNotification({ type: 'error', message: result?.message || 'Backup creation failed' })
      }
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ target, filename }: { target: BackupTarget; filename: string }) =>
      api.restoreBackup(target, filename, 'RESTORE'),
    onSuccess: (result) => {
      if (result?.success) {
        addNotification({ type: 'success', message: result.message, duration: 10000 })
        queryClient.invalidateQueries({ queryKey: ['backup-status'] })
      } else {
        addNotification({ type: 'error', message: result?.message || 'Restore failed' })
      }
    },
  })

  const restoreArchive = (target: BackupTarget, filename: string) => {
    const confirmation = window.prompt(
      `Restore ${filename}? This replaces Nomad's storage and database. Type RESTORE to continue.`
    )
    if (confirmation !== 'RESTORE') {
      return
    }
    restoreMutation.mutate({ target, filename })
  }

  const status = statusQuery.data
  const localDisabled = !status?.local.writable || createMutation.isPending
  const rcloneDisabled =
    !status?.rclone.configured || !status.rclone.available || createMutation.isPending

  return (
    <SettingsLayout>
      <Head title="Backup & Restore" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold">Backup &amp; Restore</h1>
            <p className="text-text-muted mt-1 max-w-4xl">
              Protect downloaded content, maps, settings, and chat history with a compressed archive
              on a second disk or an rclone remote.
            </p>
          </div>

          <Alert
            type="warning"
            variant="bordered"
            title="Restore replaces current data"
            message="A restore replaces the Nomad storage directory and imports the archive's MySQL database. A temporary rollback copy is made before the operation starts."
          />

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="bg-surface-primary rounded-lg border border-border-subtle p-6">
              <h2 className="text-xl font-semibold text-text-primary">Local second-disk backup</h2>
              <p className="text-sm text-text-secondary mt-2">
                Destination:{' '}
                <code className="text-text-primary">{status?.local.path || 'Loading…'}</code>
              </p>
              {status?.local.error && (
                <p className="text-sm text-desert-orange mt-3">{status.local.error}</p>
              )}
              <StyledButton
                className="mt-6"
                icon="IconDownload"
                onClick={() => createMutation.mutate('local')}
                loading={createMutation.isPending && createMutation.variables === 'local'}
                disabled={localDisabled}
              >
                Create local backup
              </StyledButton>
            </div>

            <div className="bg-surface-primary rounded-lg border border-border-subtle p-6">
              <h2 className="text-xl font-semibold text-text-primary">rclone remote</h2>
              <p className="text-sm text-text-secondary mt-2">
                {status?.rclone.remote ? (
                  <>
                    Remote: <code className="text-text-primary">{status.rclone.remote}</code>
                  </>
                ) : (
                  'Set NOMAD_RCLONE_REMOTE and provide an rclone.conf file to enable this destination.'
                )}
              </p>
              {status?.rclone.error && (
                <p className="text-sm text-desert-orange mt-3">{status.rclone.error}</p>
              )}
              <StyledButton
                className="mt-6"
                icon="IconCloudUpload"
                variant="secondary"
                onClick={() => createMutation.mutate('rclone')}
                loading={createMutation.isPending && createMutation.variables === 'rclone'}
                disabled={rcloneDisabled}
              >
                Create and upload backup
              </StyledButton>
            </div>
          </section>

          <div className="mt-8 space-y-6">
            <ArchiveList
              title="Local archives"
              archives={status?.local.archives || []}
              target="local"
              onRestore={restoreArchive}
              restoring={restoreMutation.isPending}
            />
            {status?.rclone.configured && (
              <ArchiveList
                title="Remote archives"
                archives={status.rclone.archives}
                target="rclone"
                onRestore={restoreArchive}
                restoring={restoreMutation.isPending}
              />
            )}
          </div>

          <p className="text-xs text-text-muted mt-6 max-w-4xl">
            Archives include the mounted Nomad storage and MySQL data. Redis queues/cache state,
            container images, host compose files, and environment secrets remain outside the archive
            and are recreated or configured separately on a new installation. Protect backup files
            because application data and database settings may contain sensitive values.
          </p>
        </main>
      </div>
    </SettingsLayout>
  )
}
