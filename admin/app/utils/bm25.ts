export type BM25Document = {
  id: string
  text: string
  title?: string
  metadata?: Record<string, unknown>
}

export type BM25Result = BM25Document & {
  score: number
}

const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

export function tokenizeBM25(value: string): string[] {
  return value.toLocaleLowerCase().normalize('NFKD').match(TOKEN_PATTERN) ?? []
}

/**
 * Rank a document set using Okapi BM25. The caller can use a separate index
 * to narrow the candidate set before calling this function; all scoring and
 * corpus statistics are still calculated from the candidates supplied here.
 */
export function rankBM25(
  documents: BM25Document[],
  query: string,
  limit = documents.length,
  options: { k1?: number; b?: number } = {}
): BM25Result[] {
  const usableDocuments = documents.filter(
    (document) => document.text.trim() || document.title?.trim()
  )
  if (usableDocuments.length === 0) return []

  const k1 = options.k1 ?? 1.2
  const b = options.b ?? 0.75
  const queryTerms = [...new Set(tokenizeBM25(query))]
  if (queryTerms.length === 0) return []

  const tokenizedDocuments = usableDocuments.map((document) => {
    const titleTokens = tokenizeBM25(document.title ?? '')
    const bodyTokens = tokenizeBM25(document.text)
    // Repeating title terms gives article titles a useful, bounded boost.
    const tokens = [...titleTokens, ...titleTokens, ...bodyTokens]
    return { document, tokens }
  })
  const averageDocumentLength =
    tokenizedDocuments.reduce((total, item) => total + item.tokens.length, 0) /
    tokenizedDocuments.length
  const documentFrequency = new Map<string, number>()

  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      tokenizedDocuments.filter((item) => item.tokens.includes(term)).length
    )
  }

  const documentCount = tokenizedDocuments.length
  const ranked = tokenizedDocuments.map(({ document, tokens }) => {
    const frequencies = new Map<string, number>()
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1)

    const documentLength = tokens.length
    const score = queryTerms.reduce((total, term) => {
      const termFrequency = frequencies.get(term) ?? 0
      const termDocumentFrequency = documentFrequency.get(term) ?? 0
      if (termFrequency === 0 || termDocumentFrequency === 0) return total

      const inverseDocumentFrequency = Math.log(
        1 + (documentCount - termDocumentFrequency + 0.5) / (termDocumentFrequency + 0.5)
      )
      const normalization =
        termFrequency + k1 * (1 - b + b * (documentLength / Math.max(averageDocumentLength, 1)))
      return total + inverseDocumentFrequency * ((termFrequency * (k1 + 1)) / normalization)
    }, 0)

    return { ...document, score }
  })

  return ranked
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(0, limit))
}
