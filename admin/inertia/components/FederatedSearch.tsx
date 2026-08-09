import { IconLoader2, IconSearch, IconX } from '@tabler/icons-react'
import { FormEvent, useState } from 'react'
import API from '~/lib/api'
import type { FederatedSearchResponse, FederatedSearchResult } from '../../types/search'

const sourceLabels: Record<FederatedSearchResult['source'], string> = {
  kiwix: 'Kiwix',
  kolibri: 'Kolibri',
  flatnotes: 'FlatNotes',
  qdrant: 'Knowledge base',
}

export default function FederatedSearch() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<FederatedSearchResponse | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 2) {
      setError('Enter at least two characters to search.')
      setIsOpen(true)
      return
    }

    setIsLoading(true)
    setError(null)
    setIsOpen(true)
    const result = await API.search(trimmedQuery)
    if (!result) {
      setError('Search is unavailable right now.')
    } else {
      setSearch(result)
    }
    setIsLoading(false)
  }

  const clear = () => {
    setQuery('')
    setSearch(null)
    setError(null)
    setIsOpen(false)
  }

  return (
    <div className="relative z-20 mx-auto w-full max-w-3xl">
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-lg border-2 border-desert-green bg-desert-white p-2 shadow-sm"
      >
        <IconSearch className="ml-2 text-desert-green" size={22} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => search && setIsOpen(true)}
          type="search"
          placeholder="Search your offline library, courses, notes, and knowledge base"
          aria-label="Search across Project N.O.M.A.D."
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-text-primary outline-none placeholder:text-text-muted"
        />
        {query && (
          <button
            type="button"
            onClick={clear}
            className="rounded p-1 text-text-muted hover:text-text-primary"
            aria-label="Clear search"
          >
            <IconX size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-md bg-desert-green px-4 py-2 font-semibold text-white transition hover:bg-btn-green-hover disabled:opacity-60"
        >
          {isLoading && <IconLoader2 size={17} className="animate-spin" />}
          Search
        </button>
      </form>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-[min(32rem,70vh)] overflow-y-auto rounded-lg border border-desert-green-light bg-desert-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-text-primary">
              {search
                ? `${search.results.length} result${search.results.length === 1 ? '' : 's'} for “${search.query}”`
                : 'Search results'}
            </p>
            {search && <span className="text-xs text-text-muted">{search.tookMs} ms</span>}
          </div>

          {error && (
            <p className="rounded bg-desert-red-lighter p-3 text-sm text-desert-red-dark">
              {error}
            </p>
          )}

          {search && search.sources.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Search sources">
              {search.sources.map((source) => (
                <span
                  key={source.source}
                  title={source.error}
                  className={`rounded-full px-2.5 py-1 text-xs ${source.available ? 'bg-desert-green-lighter text-desert-green-dark' : 'bg-desert-sand text-text-muted'}`}
                >
                  {source.label}: {source.available ? source.resultCount : 'unavailable'}
                </span>
              ))}
            </div>
          )}

          {search && search.results.length === 0 && !error && (
            <p className="py-4 text-center text-sm text-text-muted">
              No matches found in the installed sources.
            </p>
          )}

          <div className="space-y-2">
            {search?.results.map((result) => (
              <div
                key={result.id}
                className="rounded-md border border-desert-tan-lighter p-3 transition hover:border-desert-green-light"
              >
                <div className="flex items-start justify-between gap-3">
                  {result.url ? (
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-desert-green hover:underline"
                    >
                      {result.title}
                    </a>
                  ) : (
                    <p className="font-semibold text-text-primary">{result.title}</p>
                  )}
                  <span className="shrink-0 rounded bg-desert-sand px-2 py-0.5 text-xs text-text-muted">
                    {sourceLabels[result.source]}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-text-secondary">{result.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
