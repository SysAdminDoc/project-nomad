export type SearchSource = 'kiwix' | 'kolibri' | 'flatnotes' | 'qdrant'

export type FederatedSearchResult = {
  id: string
  source: SearchSource
  title: string
  snippet: string
  url?: string
  score: number
  metadata?: Record<string, unknown>
}

export type FederatedSearchSourceStatus = {
  source: SearchSource
  label: string
  available: boolean
  resultCount: number
  durationMs: number
  error?: string
}

export type FederatedSearchResponse = {
  query: string
  results: FederatedSearchResult[]
  sources: FederatedSearchSourceStatus[]
  tookMs: number
}
