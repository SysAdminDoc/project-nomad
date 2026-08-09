import vine from '@vinejs/vine'

export const listRemoteZimValidator = vine.compile(
  vine.object({
    start: vine.number().min(0).optional(),
    count: vine.number().min(1).max(100).optional(),
    query: vine.string().optional(),
  })
)

export const applyZimUpdateValidator = vine.compile(
  vine.object({
    current_filename: vine.string().trim().minLength(1).maxLength(255),
    download_url: vine.string().url({ require_tld: false }).trim(),
  })
)
