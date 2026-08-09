import type { RAGCitation } from '../../types/rag.js'

type CitationDocument = {
  text: string
  score: number
  metadata?: Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function sourceFilename(source: string | undefined): string | undefined {
  if (!source) return undefined

  const filename = source.replaceAll('\\', '/').split('/').pop()
  return filename && filename !== source ? filename : filename || source
}

/**
 * Kiwix derives the public ZIM name from the filename rather than the absolute
 * path stored in the RAG payload. Keep this conversion in one place so links
 * work for both existing and newly indexed documents.
 */
export function getKiwixZimName(source: string | undefined): string | undefined {
  const filename = sourceFilename(source)
  if (!filename || !/\.zim$/i.test(filename)) return undefined

  return filename
    .replace(/\.zim$/i, '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\+/g, 'plus')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

function encodeKiwixPath(path: string): string {
  return path
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function buildKiwixCitationUrl(
  baseUrl: string | undefined,
  source: string | undefined,
  articlePath: string | undefined,
  sectionAnchor?: string
): string | undefined {
  const zimName = getKiwixZimName(source)
  const encodedPath = articlePath ? encodeKiwixPath(articlePath) : ''
  if (!baseUrl || !zimName || !encodedPath) return undefined

  try {
    const base = new URL(baseUrl)
    const url = new URL(`/content/${encodeURIComponent(zimName)}/${encodedPath}`, `${base.origin}/`)
    const anchor = asString(sectionAnchor)?.replace(/^#/, '')
    if (anchor) url.hash = anchor
    return url.href
  } catch {
    return undefined
  }
}

function citationKey(citation: RAGCitation): string {
  return citation.url || `${citation.source || ''}:${citation.title}:${citation.section || ''}`
}

/**
 * Convert retrieved RAG chunks to safe, display-ready citations. ZIM chunks
 * receive a direct Kiwix page URL; other knowledge-base files remain visible
 * as plain sources without exposing an internal filesystem path as a link.
 */
export function buildRagCitations(
  documents: CitationDocument[],
  kiwixBaseUrl?: string
): RAGCitation[] {
  const seen = new Set<string>()
  const citations: RAGCitation[] = []

  for (const document of documents) {
    const metadata = document.metadata || {}
    const source = asString(metadata.source)
    const articleTitle = asString(metadata.article_title)
    const fullTitle = asString(metadata.full_title)
    const section = asString(metadata.section_title)
    const articlePath = asString(metadata.article_path)
    const isZim = metadata.content_type === 'zim_article' || Boolean(getKiwixZimName(source))
    const title = articleTitle || fullTitle || sourceFilename(source) || 'Knowledge base source'
    const sourceLabel = asString(metadata.archive_title) || sourceFilename(source)
    const url = isZim
      ? buildKiwixCitationUrl(kiwixBaseUrl, source, articlePath, asString(metadata.section_anchor))
      : undefined

    const citation: RAGCitation = {
      id: url || `${source || 'knowledge-base'}:${articlePath || title}`,
      title,
      ...(section && section !== title ? { section } : {}),
      ...(sourceLabel ? { source: sourceLabel } : {}),
      ...(url ? { url } : {}),
      score: Math.max(0, Math.min(1, Number(document.score) || 0)),
    }

    const key = citationKey(citation)
    if (seen.has(key)) continue
    seen.add(key)
    citations.push(citation)
  }

  return citations
}
