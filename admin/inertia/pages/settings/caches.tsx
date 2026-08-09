import { Head } from '@inertiajs/react'
import { useState } from 'react'
import SettingsLayout from '~/layouts/SettingsLayout'
import StyledButton from '~/components/StyledButton'
import useInternetStatus from '~/hooks/useInternetStatus'
import api from '~/lib/api'
import { formatBytes } from '~/lib/util'
import type { DeveloperCache } from '../../../types/caches'

export default function DeveloperCachesPage(props: { caches: DeveloperCache[] }) {
  const { isOnline } = useInternetStatus()
  const [installing, setInstalling] = useState<string | null>(null)

  const installCache = async (cache: DeveloperCache) => {
    if (!isOnline) return
    setInstalling(cache.service_name)
    const result = await api.installService(cache.service_name)
    if (result?.success) {
      window.setTimeout(() => window.location.reload(), 3000)
    } else {
      setInstalling(null)
    }
  }

  return (
    <SettingsLayout>
      <Head title="Developer Caches" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold">Developer Caches</h1>
            <p className="text-text-muted mt-1 max-w-4xl">
              Cache npm, PyPI, and Docker Hub artifacts on this device for faster installs and
              air-gapped development. Caches fill on demand while online and serve previously
              fetched artifacts after the internet is disconnected.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {props.caches.map((cache) => {
              const ready = cache.installed && cache.status === 'running'
              return (
                <section
                  key={cache.id}
                  className="bg-surface-primary rounded-lg border border-border-subtle p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-text-primary">{cache.name}</h2>
                      <p className="text-sm text-text-secondary mt-2">{cache.description}</p>
                    </div>
                    <span
                      className={ready ? 'text-desert-green text-sm' : 'text-text-muted text-sm'}
                    >
                      {ready ? 'Ready' : cache.installed ? cache.status : 'Not installed'}
                    </span>
                  </div>

                  <dl className="mt-6 space-y-3 text-sm">
                    <div>
                      <dt className="text-text-muted">Endpoint</dt>
                      <dd className="font-mono text-text-primary break-all">{cache.endpoint}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">Cached data</dt>
                      <dd className="text-text-primary">{formatBytes(cache.size_bytes, 1)}</dd>
                    </div>
                  </dl>

                  <div className="mt-6">
                    <p className="text-xs text-text-muted mb-1">Configure a client</p>
                    <code className="block bg-surface-secondary rounded p-3 text-xs text-text-primary break-all">
                      {cache.setup_command}
                    </code>
                  </div>

                  {!cache.installed && (
                    <StyledButton
                      className="mt-6"
                      icon="IconDownload"
                      variant="primary"
                      onClick={() => installCache(cache)}
                      disabled={!isOnline || installing !== null}
                      loading={installing === cache.service_name}
                    >
                      Install cache
                    </StyledButton>
                  )}
                </section>
              )
            })}
          </div>
        </main>
      </div>
    </SettingsLayout>
  )
}
