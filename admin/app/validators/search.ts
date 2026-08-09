import vine from '@vinejs/vine'

export const searchQuerySchema = vine.compile(
  vine.object({
    query: vine.string().trim().minLength(2).maxLength(200),
    limit: vine.number().withoutDecimals().min(1).max(50).optional(),
  })
)
