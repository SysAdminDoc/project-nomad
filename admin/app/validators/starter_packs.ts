import vine from '@vinejs/vine'

export const downloadStarterPackValidator = vine.compile(
  vine.object({
    packId: vine.string().trim().minLength(1),
  })
)
