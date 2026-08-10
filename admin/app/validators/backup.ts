import vine from '@vinejs/vine'

export const backupTargetValidator = vine.compile(
  vine.object({
    target: vine.enum(['local', 'rclone'] as const),
  })
)

export const restoreBackupValidator = vine.compile(
  vine.object({
    target: vine.enum(['local', 'rclone'] as const),
    filename: vine.string().trim().minLength(1).maxLength(160),
    confirmation: vine.string().trim(),
  })
)
