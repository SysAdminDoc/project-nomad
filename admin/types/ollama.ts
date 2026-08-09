import type { RAGCitation } from './rag.js'

export type NomadOllamaModel = {
  id: string
  name: string
  description: string
  estimated_pulls: string
  model_last_updated: string
  first_seen: string
  tags: NomadOllamaModelTag[]
  recommended?: boolean
}

export type NomadOllamaModelTag = {
  name: string
  size: string
  context: string
  input: string
  cloud: boolean
  thinking: boolean
  recommendation?: NomadModelRecommendation
}

export type ModelHardwareProfile =
  | 'raspberry-pi-5'
  | 'jetson'
  | 'x86-nvidia'
  | 'x86'
  | 'arm64'
  | 'unknown'
  | 'remote'

export type ModelCatalogHardware = {
  profile: ModelHardwareProfile
  label: string
  cpuModel: string
  gpuModel: string
  ramGb: number
  vramGb: number
}

export type NomadModelRecommendation = {
  tier: 'recommended' | 'possible' | 'not-recommended' | 'unknown'
  recommended: boolean
  score: number
  label: string
  reason: string
  estimatedMemoryGb: number
  parameterBillions: number | null
}

export type NomadAvailableModelsResponse = {
  models: NomadOllamaModel[]
  recommendedModels: NomadOllamaModel[]
  hasMore: boolean
  hardware: ModelCatalogHardware
}

export type NomadOllamaModelAPIResponse = {
  success: boolean
  message: string
  models: NomadOllamaModel[]
}

export type OllamaChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type OllamaChatRequest = {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
  sessionId?: number
}

export type OllamaChatResponse = {
  model: string
  created_at: string
  message: {
    role: string
    content: string
  }
  done: boolean
}

export type NomadInstalledModel = {
  name: string
  size: number
  digest?: string
  details?: Record<string, any>
}

export type NomadChatResponse = {
  message: { content: string; thinking?: string }
  done: boolean
  model: string
  citations?: RAGCitation[]
}
