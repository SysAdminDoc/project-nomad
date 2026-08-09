import { Link } from '@inertiajs/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { IconArrowsExchange, IconLanguage } from '@tabler/icons-react'
import Alert from '~/components/Alert'
import StyledButton from '~/components/StyledButton'
import useServiceInstalledStatus from '~/hooks/useServiceInstalledStatus'
import api from '~/lib/api'
import { SERVICE_NAMES } from '../../constants/service_names'
import type { TranslationLanguage } from '../../types/translation'

type TranslationContext = 'maps' | 'wikis' | 'general'

const CONTEXT_COPY: Record<TranslationContext, { title: string; description: string }> = {
  maps: {
    title: 'Translate map text',
    description: 'Paste a place name, saved pin note, or copied map label to translate it offline.',
  },
  wikis: {
    title: 'Translate wiki text',
    description:
      'Paste text copied from a Kiwix or Wikipedia article to translate it on this device.',
  },
  general: {
    title: 'Translate text offline',
    description:
      'Use the locally installed Argos Translate models without sending text to a cloud API.',
  },
}

export default function TranslationPanel({
  context = 'general',
  className = '',
}: {
  context?: TranslationContext
  className?: string
}) {
  const { isInstalled, loading: serviceStatusLoading } = useServiceInstalledStatus(
    SERVICE_NAMES.TRANSLATION
  )
  const { title, description } = CONTEXT_COPY[context]
  const [text, setText] = useState('')
  const [source, setSource] = useState('auto')
  const [target, setTarget] = useState('es')
  const [translatedText, setTranslatedText] = useState('')

  const { data: languages = [], isLoading: languagesLoading } = useQuery<TranslationLanguage[]>({
    queryKey: ['translation-languages'],
    queryFn: async () => (await api.getTranslationLanguages()) || [],
    enabled: Boolean(isInstalled),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const availableTargets = useMemo(
    () => languages.filter((language) => language.code !== source),
    [languages, source]
  )

  useEffect(() => {
    if (availableTargets.length === 0) return
    if (!availableTargets.some((language) => language.code === target)) {
      const preferred = availableTargets.find((language) => language.code === 'es')
      setTarget((preferred || availableTargets[0]).code)
    }
  }, [availableTargets, target])

  const translateMutation = useMutation({
    mutationFn: () =>
      api.translateText({
        text: text.trim(),
        source,
        target,
      }),
    onSuccess: (result) => {
      setTranslatedText(result?.translatedText || '')
    },
  })

  if (!serviceStatusLoading && !isInstalled) {
    return (
      <Alert
        title="Offline translation is not installed"
        message="Install the optional translation service to translate map labels and wiki text locally."
        type="info"
        variant="bordered"
        icon="IconWorld"
        className={className}
      >
        <Link
          href="/settings/apps"
          className="text-sm text-desert-green font-semibold hover:underline"
        >
          Go to Settings → Apps
        </Link>
      </Alert>
    )
  }

  return (
    <section
      className={`rounded-lg border border-border-subtle bg-surface-primary p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-3">
        <IconLanguage className="mt-1 h-6 w-6 shrink-0 text-desert-green" />
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor={`${context}-translation-source`}
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            From
          </label>
          <select
            id={`${context}-translation-source`}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="w-full rounded border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            disabled={languagesLoading || languages.length === 0}
          >
            <option value="auto">Auto-detect</option>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name} ({language.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`${context}-translation-target`}
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            To
          </label>
          <select
            id={`${context}-translation-target`}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="w-full rounded border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary"
            disabled={languagesLoading || availableTargets.length === 0}
          >
            {availableTargets.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name} ({language.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor={`${context}-translation-input`}
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Text to translate
          </label>
          <textarea
            id={`${context}-translation-input`}
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 20000))}
            placeholder="Paste text from an offline map or wiki article…"
            className="min-h-48 w-full resize-y rounded border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
            maxLength={20000}
          />
          <p className="mt-1 text-right text-xs text-text-muted">
            {text.length.toLocaleString()} / 20,000
          </p>
        </div>
        <div>
          <label
            htmlFor={`${context}-translation-output`}
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Translation
          </label>
          <textarea
            id={`${context}-translation-output`}
            value={translatedText}
            readOnly
            placeholder="Your local translation will appear here."
            className="min-h-48 w-full resize-y rounded border border-border-subtle bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          Models run locally; first install downloads the selected language packs for offline use.
        </p>
        <StyledButton
          icon="IconLanguage"
          onClick={() => translateMutation.mutate()}
          disabled={!text.trim() || !target || languagesLoading || availableTargets.length === 0}
          loading={translateMutation.isPending}
        >
          Translate
        </StyledButton>
      </div>
      {translateMutation.isSuccess && translatedText && (
        <div className="mt-3 flex items-center gap-2 text-xs text-desert-olive">
          <IconArrowsExchange className="h-4 w-4" />
          Translated locally with the installed model packs.
        </div>
      )}
    </section>
  )
}
