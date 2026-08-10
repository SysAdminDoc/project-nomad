import vine from '@vinejs/vine'

export const clusterConfigValidator = vine.compile(
  vine.object({
    remote_url: vine.string().trim().maxLength(255),
    token: vine.string().trim().maxLength(256),
    node_name: vine.string().trim().maxLength(80),
  })
)

export const clusterSyncValidator = vine.compile(
  vine.object({
    resource_keys: vine.array(vine.string().trim().minLength(3)).minLength(1).maxLength(100),
  })
)

export const clusterResourceValidator = vine.compile(
  vine.object({
    resource_id: vine.string().trim().minLength(1).maxLength(255),
    resource_type: vine.enum(['zim', 'map'] as const),
  })
)
