import axios, { AxiosResponse } from 'axios'
import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DockerService } from './docker_service.js'
import { RagService } from './rag_service.js'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import {
  normalizeSearchText,
  parseHtmlSearchResults,
  parseStructuredSearchResults,
  type ExternalSearchCandidate,
} from '../utils/search.js'
import type {
  FederatedSearchResponse,
  FederatedSearchResult,
  FederatedSearchSourceStatus,
  SearchSource,
} from '../../types/search.js'

const SEARCH_TIMEOUT_MS = 2500
const DEFAULT_LIMIT = 20
const MAX_QUERY_LENGTH = 200

const SOURCE_LABELS: Record<SearchSource, string> = {
  kiwix: 'Kiwix library',
  kolibri: 'Kolibri courses',
  flatnotes: 'FlatNotes',
  qdrant: 'Knowledge base',
}

type SourceSearchResult = {
  source: SearchSource
  results: FederatedSearchResult[]
}

type SourceRun = {
  status: FederatedSearchSourceStatus
  result: SourceSearchResult
}

@inject()
export class FederatedSearchService {
  constructor(
    private dockerService: DockerService,
    private ragService: RagService
  ) {}

  async search(query: string, limit = DEFAULT_LIMIT): Promise<FederatedSearchResponse> {
    const normalizedQuery = normalizeSearchText(query).slice(0, MAX_QUERY_LENGTH)
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || DEFAULT_LIMIT))
    const startedAt = Date.now()

    const runs = await Promise.all([
      this.runSource('kiwix', () => this.searchKiwix(normalizedQuery, safeLimit)),
      this.runSource('kolibri', () => this.searchKolibri(normalizedQuery, safeLimit)),
      this.runSource('flatnotes', () => this.searchFlatNotes(normalizedQuery, safeLimit)),
      this.runSource('qdrant', () => this.searchKnowledgeBase(normalizedQuery, safeLimit)),
    ])

    const results = runs
      .flatMap((run) => run.result.results)
      .sort((left, right) => right.score - left.score)
      .slice(0, safeLimit)

    return {
      query: normalizedQuery,
      results,
      sources: runs.map((run) => run.status),
      tookMs: Date.now() - startedAt,
    }
  }

  private async runSource(
    source: SearchSource,
    search: () => Promise<SourceSearchResult>
  ): Promise<SourceRun> {
    const startedAt = Date.now()

    try {
      const result = await search()
      return {
        result,
        status: {
          source,
          label: SOURCE_LABELS[source],
          available: true,
          resultCount: result.results.length,
          durationMs: Date.now() - startedAt,
        },
      }
    } catch (error) {
      logger.warn(
        `[FederatedSearch] ${source} search unavailable: ${error instanceof Error ? error.message : error}`
      )
      return {
        result: { source, results: [] },
        status: {
          source,
          label: SOURCE_LABELS[source],
          available: false,
          resultCount: 0,
          durationMs: Date.now() - startedAt,
          error: 'Service unavailable',
        },
      }
    }
  }

  private async getServiceUrl(serviceName: string): Promise<string> {
    const url = await this.dockerService.getServiceURL(serviceName)
    if (!url) throw new Error('Service is not installed or running')
    return url
  }

  private async getExternal(
    baseUrl: string,
    path: string,
    params: Record<string, string>
  ): Promise<AxiosResponse<unknown>> {
    const endpoint = new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
    return axios.get(endpoint.href, {
      params,
      responseType: 'text',
      timeout: SEARCH_TIMEOUT_MS,
      validateStatus: (status) => status >= 200 && status < 300,
    })
  }

  private async searchKiwix(query: string, limit: number): Promise<SourceSearchResult> {
    const baseUrl = await this.getServiceUrl(SERVICE_NAMES.KIWIX)
    const response = await this.getExternal(baseUrl, '/search', {
      pattern: query,
      content: 'all',
      format: 'json',
    })
    const structured = parseStructuredSearchResults(response.data, baseUrl, limit)
    const candidates =
      structured.length > 0
        ? structured
        : parseHtmlSearchResults(String(response.data), baseUrl, limit)

    return {
      source: 'kiwix',
      results: candidates.map((candidate, index) =>
        this.mapCandidate('kiwix', query, candidate, index)
      ),
    }
  }

  private async searchKolibri(query: string, limit: number): Promise<SourceSearchResult> {
    const baseUrl = await this.getServiceUrl(SERVICE_NAMES.KOLIBRI)
    const response = await this.getFirstSuccessfulEndpoint(
      baseUrl,
      ['/api/search/', '/api/search/v1/'],
      query
    )
    const candidates = parseStructuredSearchResults(response.data, baseUrl, limit)

    return {
      source: 'kolibri',
      results: candidates.map((candidate, index) =>
        this.mapCandidate('kolibri', query, candidate, index)
      ),
    }
  }

  private async searchFlatNotes(query: string, limit: number): Promise<SourceSearchResult> {
    const baseUrl = await this.getServiceUrl(SERVICE_NAMES.FLATNOTES)
    const response = await this.getFirstSuccessfulEndpoint(
      baseUrl,
      ['/api/notes', '/api/search'],
      query
    )
    const structured = parseStructuredSearchResults(response.data, baseUrl, limit)
    const candidates =
      structured.length > 0
        ? structured
        : parseHtmlSearchResults(String(response.data), baseUrl, limit)

    return {
      source: 'flatnotes',
      results: candidates.map((candidate, index) =>
        this.mapCandidate('flatnotes', query, candidate, index)
      ),
    }
  }

  private async searchKnowledgeBase(query: string, limit: number): Promise<SourceSearchResult> {
    await this.getServiceUrl(SERVICE_NAMES.QDRANT)
    const matches = await this.ragService.searchSimilarDocuments(query, limit)

    return {
      source: 'qdrant',
      results: matches.map((match, index) => {
        const metadata = match.metadata ?? {}
        const title = normalizeSearchText(
          metadata.article_title ||
            metadata.full_title ||
            metadata.source ||
            `Knowledge base match ${index + 1}`
        )

        return {
          id: `qdrant:${metadata.document_id || metadata.source || index}`,
          source: 'qdrant',
          title,
          snippet: normalizeSearchText(match.text).slice(0, 320),
          score: Math.max(0, Math.min(1, match.score)),
          metadata,
        }
      }),
    }
  }

  private async getFirstSuccessfulEndpoint(
    baseUrl: string,
    paths: string[],
    query: string
  ): Promise<AxiosResponse<unknown>> {
    let lastError: unknown

    for (const path of paths) {
      try {
        return await this.getExternal(baseUrl, path, { q: query, query })
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No search endpoint responded')
  }

  private mapCandidate(
    source: SearchSource,
    query: string,
    candidate: ExternalSearchCandidate,
    index: number
  ): FederatedSearchResult {
    const title = normalizeSearchText(candidate.title) || 'Search result'
    const snippet = normalizeSearchText(candidate.snippet || title).slice(0, 320)
    const score = candidate.score ?? this.scoreTextMatch(query, title, snippet, index)

    return {
      id: `${source}:${candidate.id || candidate.url || title}:${index}`,
      source,
      title,
      snippet,
      url: candidate.url,
      score,
      metadata: candidate.metadata,
    }
  }

  private scoreTextMatch(query: string, title: string, snippet: string, index: number): number {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const titleText = title.toLowerCase()
    const snippetText = snippet.toLowerCase()
    const titleMatches = terms.filter((term) => titleText.includes(term)).length
    const snippetMatches = terms.filter((term) => snippetText.includes(term)).length
    const exactTitle = titleText.includes(query.toLowerCase()) ? 0.25 : 0
    const score =
      0.35 +
      exactTitle +
      (titleMatches / Math.max(terms.length, 1)) * 0.3 +
      (snippetMatches / Math.max(terms.length, 1)) * 0.12 -
      index * 0.005

    return Math.max(0, Math.min(0.99, score))
  }
}
