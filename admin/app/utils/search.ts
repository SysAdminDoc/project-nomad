import * as cheerio from 'cheerio'

export type ExternalSearchCandidate = {
  title: string
  snippet: string
  url?: string
  id?: string
  score?: number
  metadata?: Record<string, unknown>
}

const TITLE_FIELDS = ['title', 'name', 'label', 'caption', 'article_title']
const SNIPPET_FIELDS = ['snippet', 'description', 'summary', 'content', 'text', 'body']
const URL_FIELDS = ['url', 'href', 'link', 'path', 'uri']
const COLLECTION_FIELDS = ['results', 'items', 'entries', 'articles', 'notes', 'objects', 'data']

export function normalizeSearchText(value: unknown): string {
  if (typeof value !== 'string') return ''

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function firstString(record: Record<string, unknown>, fields: string[]): string {
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string' && value.trim()) return normalizeSearchText(value)
  }

  return ''
}

function normalizeUrl(value: unknown, baseUrl: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined

  try {
    const url = new URL(value, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
    return url.href
  } catch {
    return undefined
  }
}

function normalizeCandidate(value: unknown, baseUrl: string): ExternalSearchCandidate | null {
  const record = asRecord(value)
  if (!record) return null

  const title = firstString(record, TITLE_FIELDS)
  const snippet = firstString(record, SNIPPET_FIELDS)
  const url = normalizeUrl(URL_FIELDS.map((field) => record[field]).find(Boolean), baseUrl)
  const rawScore = record.score ?? record.similarity ?? record.rank
  const score =
    typeof rawScore === 'number' && Number.isFinite(rawScore)
      ? Math.max(0, Math.min(1, rawScore))
      : undefined

  if (!title && !snippet && !url) return null

  return {
    title: title || snippet.slice(0, 100) || 'Search result',
    snippet: snippet || title,
    url,
    id:
      typeof record.id === 'string' || typeof record.id === 'number'
        ? String(record.id)
        : undefined,
    score,
    metadata: record,
  }
}

function collectStructuredCandidates(
  value: unknown,
  baseUrl: string,
  output: ExternalSearchCandidate[]
): void {
  if (output.length >= 50) return

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = normalizeCandidate(item, baseUrl)
      if (candidate) output.push(candidate)
      else collectStructuredCandidates(item, baseUrl, output)
      if (output.length >= 50) return
    }
    return
  }

  const record = asRecord(value)
  if (!record) return

  const candidate = normalizeCandidate(record, baseUrl)
  if (candidate) output.push(candidate)

  for (const field of COLLECTION_FIELDS) {
    if (field in record) collectStructuredCandidates(record[field], baseUrl, output)
    if (output.length >= 50) return
  }
}

function parseJsonString(value: string): unknown | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function parseStructuredSearchResults(
  payload: unknown,
  baseUrl: string,
  limit = 8
): ExternalSearchCandidate[] {
  const parsed = typeof payload === 'string' ? parseJsonString(payload) : payload
  if (parsed === null) return []

  const candidates: ExternalSearchCandidate[] = []
  collectStructuredCandidates(parsed, baseUrl, candidates)

  const seen = new Set<string>()
  return candidates
    .filter((candidate) => {
      const key = `${candidate.title.toLowerCase()}|${candidate.url ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

function isLikelySearchLink(href: string, containerClass: string): boolean {
  const path = href.toLowerCase()
  const context = containerClass.toLowerCase()
  return (
    /search|result|article|content|topic|learn|note|book|page|item|channel/.test(path) ||
    /search|result|article|content|topic|learn|note/.test(context)
  )
}

export function parseHtmlSearchResults(
  html: string,
  baseUrl: string,
  limit = 8
): ExternalSearchCandidate[] {
  if (!html.trim()) return []

  const $ = cheerio.load(html)
  const candidates: ExternalSearchCandidate[] = []
  const seen = new Set<string>()

  $('article, [data-search-result], .search-result, .result, li').each((_index, element) => {
    if (candidates.length >= limit) return false

    const container = $(element)
    const link = container.is('a') ? container : container.find('a[href]').first()
    const href = link.attr('href')
    if (!href || !isLikelySearchLink(href, container.attr('class') || '')) return

    const title = normalizeSearchText(
      container.find('h1, h2, h3, h4, .title, [data-title]').first().text() || link.text()
    )
    const fullText = normalizeSearchText(container.text())
    const snippet = fullText.startsWith(title) ? fullText.slice(title.length).trim() : fullText
    const url = normalizeUrl(href, baseUrl)
    if (!title || !url) return

    const key = `${title.toLowerCase()}|${url}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push({
      title,
      snippet: snippet || title,
      url,
    })
  })

  if (candidates.length < limit) {
    $('a[href]').each((_index, element) => {
      if (candidates.length >= limit) return false

      const link = $(element)
      const href = link.attr('href')
      const title = normalizeSearchText(link.text())
      if (
        !href ||
        !title ||
        title.length < 2 ||
        !isLikelySearchLink(href, link.attr('class') || '')
      )
        return

      const url = normalizeUrl(href, baseUrl)
      if (!url) return
      const key = `${title.toLowerCase()}|${url}`
      if (seen.has(key)) return
      seen.add(key)
      candidates.push({ title, snippet: title, url })
    })
  }

  return candidates.slice(0, limit)
}
