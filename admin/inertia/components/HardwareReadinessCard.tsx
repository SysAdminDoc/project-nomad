import { useMemo } from 'react'
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconComponents,
  IconDatabase,
  IconInfoCircle,
  IconServer,
  IconXboxX,
} from '@tabler/icons-react'
import type { SystemInformationResponse } from '../../types/system'
import {
  buildHardwareReadiness,
  type HardwareReadinessCheck,
  type HardwareReadinessStatus,
} from '../../app/utils/hardware_readiness'

type HardwareReadinessCardProps = {
  systemInfo?: SystemInformationResponse
  projectedStorageBytes?: number
  remoteOllamaConfigured?: boolean
}

const statusStyles: Record<
  HardwareReadinessStatus,
  { border: string; text: string; badge: string; label: string }
> = {
  ready: {
    border: 'border-desert-olive-light',
    text: 'text-desert-olive-dark',
    badge: 'bg-desert-olive-lighter text-desert-olive-dark',
    label: 'Ready',
  },
  caution: {
    border: 'border-desert-orange-light',
    text: 'text-desert-orange-dark',
    badge: 'bg-desert-orange-lighter text-desert-orange-dark',
    label: 'Review suggestions',
  },
  attention: {
    border: 'border-desert-red-light',
    text: 'text-desert-red-dark',
    badge: 'bg-desert-red-lighter text-desert-red-dark',
    label: 'Needs attention',
  },
  unknown: {
    border: 'border-desert-stone-light',
    text: 'text-desert-stone-dark',
    badge: 'bg-desert-stone-lighter text-desert-stone-dark',
    label: 'Still checking',
  },
}

function checkIcon(check: HardwareReadinessCheck) {
  const Icon =
    check.id === 'storage' ? IconServer : check.id === 'memory' ? IconDatabase : IconComponents
  return <Icon className="size-5" aria-hidden="true" />
}

function statusIcon(status: HardwareReadinessStatus) {
  if (status === 'ready') return <IconCircleCheck className="size-5" aria-hidden="true" />
  if (status === 'attention') return <IconXboxX className="size-5" aria-hidden="true" />
  if (status === 'caution') return <IconAlertTriangle className="size-5" aria-hidden="true" />
  return <IconInfoCircle className="size-5" aria-hidden="true" />
}

export default function HardwareReadinessCard({
  systemInfo,
  projectedStorageBytes = 0,
  remoteOllamaConfigured = false,
}: HardwareReadinessCardProps) {
  const readiness = useMemo(
    () => buildHardwareReadiness(systemInfo, { projectedStorageBytes, remoteOllamaConfigured }),
    [systemInfo, projectedStorageBytes, remoteOllamaConfigured]
  )
  const styles = statusStyles[readiness.status]

  return (
    <section
      className={`rounded-lg border-2 bg-surface-primary p-5 ${styles.border}`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-text-primary">Hardware readiness</h3>
          <p className="mt-1 text-sm text-text-secondary">
            A quick first-boot check for storage health, RAM, and local AI acceleration.
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${styles.badge}`}
        >
          {statusIcon(readiness.status)}
          <span>{styles.label}</span>
          {readiness.score !== null && <span className="font-mono">{readiness.score}/100</span>}
        </div>
      </div>

      {readiness.checks.length === 0 ? (
        <p className="mt-5 rounded-md bg-surface-secondary px-4 py-3 text-sm text-text-secondary">
          System hardware is still being detected. The wizard will update this check automatically.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
            {readiness.checks.map((check) => {
              const checkStyles = statusStyles[check.status]
              return (
                <div key={check.id} className={`rounded-md border p-4 ${checkStyles.border}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-text-primary">
                      {checkIcon(check)}
                      <span className="font-medium">{check.label}</span>
                    </div>
                    <span className={checkStyles.text}>{statusIcon(check.status)}</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold text-text-primary">{check.value}</div>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">{check.detail}</p>
                </div>
              )
            })}
          </div>

          {readiness.suggestions.length > 0 && (
            <div className="mt-5 rounded-md bg-surface-secondary p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <IconInfoCircle className="size-5 text-desert-green" aria-hidden="true" />
                <span>Setup suggestions</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-text-secondary">
                {readiness.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
