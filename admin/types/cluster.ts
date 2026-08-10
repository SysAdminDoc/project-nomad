export type ClusterResourceType = 'zim' | 'map'

export type ClusterResource = {
  resource_id: string
  resource_type: ClusterResourceType
  version: string
  collection_ref: string | null
  filename: string
  size_bytes: number
  installed_at: string
}

export type ClusterManifest = {
  node_name: string
  generated_at: string
  resources: ClusterResource[]
}

export type ClusterStatus = {
  local: {
    node_name: string
    sharing_enabled: boolean
    resource_count: number
  }
  remote: {
    configured: boolean
    url: string | null
    reachable: boolean
    node_name: string | null
    resources: ClusterResource[]
    error?: string
  }
}

export type ClusterConfig = {
  remote_url: string
  token: string
  node_name: string
}

export type ClusterConfigResult = {
  success: boolean
  message: string
  token_configured: boolean
}

export type ClusterTokenResult = {
  token: string
}

export type ClusterSyncResult = {
  success: boolean
  message: string
  results: Array<{
    resource_id: string
    resource_type: ClusterResourceType
    success: boolean
    message: string
  }>
}
