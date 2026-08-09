import vine from '@vinejs/vine'

export const translationRequestValidator = vine.compile(
  vine.object({
    text: vine.string().trim().minLength(1).maxLength(20000),
    source: vine.string().trim().minLength(2).maxLength(10),
    target: vine.string().trim().minLength(2).maxLength(10),
    format: vine.enum(['text', 'html'] as const).optional(),
  })
)
