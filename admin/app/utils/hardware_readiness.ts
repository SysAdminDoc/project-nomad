import type { SystemInformationResponse } from '../../types/system.js'

const GIGABYTE = 1024 ** 3

export type HardwareReadinessStatus = 'ready' | 'caution' | 'attention' | 'unknown'

export type HardwareReadinessCheck = {
  id: 'storage' | 'memory' | 'gpu'
  label: string
  status: HardwareReadinessStatus
  score: number | null
  value: string
  detail: string
  recommendation?: string
}

export type HardwareReadiness = {
  score: number | null
  status: HardwareReadinessStatus
  checks: HardwareReadinessCheck[]
  suggestions: string[]
}

export type HardwareReadinessOptions = {
  projectedStorageBytes?: number
  remoteOllamaConfigured?: boolean
}

type ReadinessSystemInfo = Pick<SystemInformationResponse, 'mem' | 'disk' | 'fsSize' | 'graphics'> &
  Pick<SystemInformationResponse, 'gpuHealth'>

function finiteNumber(value: unknown): number | null {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function round(value: number): number {
  return Math.round(value)
}

function formatGigabytes(bytes: number): string {
  return `${(bytes / GIGABYTE).toFixed(bytes >= 10 * GIGABYTE ? 0 : 1)} GB`
}

function getStorageCandidate(systemInfo: ReadinessSystemInfo) {
  const disks = (systemInfo.disk || []).filter((disk) => disk.totalSize > 0)
  if (disks.length > 0) {
    return (
      disks.find((disk) =>
        disk.filesystems.some(
          (filesystem) => filesystem.mount === '/storage' || filesystem.mount === '/'
        )
      ) || disks.reduce((largest, disk) => (disk.totalSize > largest.totalSize ? disk : largest))
    )
  }

  const filesystems = (systemInfo.fsSize || []).filter(
    (filesystem) => filesystem.size > 0 && filesystem.fs.startsWith('/dev/')
  )
  if (filesystems.length === 0) return null

  const filesystem =
    filesystems.find((candidate) => candidate.mount === '/storage' || candidate.mount === '/') ||
    filesystems.reduce((largest, candidate) =>
      candidate.size > largest.size ? candidate : largest
    )

  return {
    name: filesystem.fs,
    model: 'Filesystem',
    rota: false,
    tran: '',
    totalSize: filesystem.size,
    totalUsed: filesystem.used,
    percentUsed: filesystem.use,
    filesystems: [],
  }
}

function buildStorageCheck(
  systemInfo: ReadinessSystemInfo,
  options: HardwareReadinessOptions,
  suggestions: string[]
): HardwareReadinessCheck {
  const disk = getStorageCandidate(systemInfo)
  if (!disk) {
    suggestions.push(
      'Storage details are not available yet. Recheck the system page after the disk collector reports in.'
    )
    return {
      id: 'storage',
      label: 'SSD / storage',
      status: 'unknown',
      score: null,
      value: 'Not detected',
      detail: 'The host storage collector has not provided a usable disk yet.',
    }
  }

  const projectedBytes = Math.max(0, options.projectedStorageBytes || 0)
  const projectedPercent =
    disk.totalSize > 0
      ? ((disk.totalUsed + projectedBytes) / disk.totalSize) * 100
      : disk.percentUsed
  const isSsd = disk.rota === false || disk.tran.toLowerCase() === 'nvme'
  const health = 'health' in disk ? disk.health : undefined
  let score = health?.status === 'failed' ? 0 : health?.status === 'passed' ? 100 : 65
  let status: HardwareReadinessStatus =
    health?.status === 'failed' ? 'attention' : health?.status === 'passed' ? 'ready' : 'unknown'
  let detail =
    health?.status === 'failed'
      ? 'SMART reported a drive health failure.'
      : health?.status === 'passed'
        ? 'SMART reports that the drive is healthy.'
        : 'SMART health is unavailable from the current container.'

  if (projectedPercent >= 95) {
    score = Math.min(score, 20)
    status = 'attention'
    detail += ` Selected content would use ${round(projectedPercent)}% of this disk.`
    suggestions.push(
      'Reduce the selected downloads or move NOMAD storage to a larger disk before starting setup.'
    )
  } else if (projectedPercent >= 85) {
    score = Math.min(score, 55)
    if (status !== 'attention') status = 'caution'
    detail += ` Selected content would use ${round(projectedPercent)}% of this disk.`
    suggestions.push('Keep additional free space available for updates and temporary downloads.')
  }

  if (health?.status === 'failed') {
    suggestions.push(
      'Back up important data and replace the storage device before installing large content collections.'
    )
  } else if (health?.status !== 'passed') {
    suggestions.push(
      'SMART health could not be read; verify the SSD in Settings → System or with the host smartctl tool.'
    )
  }

  if (!isSsd) {
    score = Math.max(0, score - 10)
    if (status === 'ready') status = 'caution'
    detail += ' The primary device appears to be rotational storage.'
    suggestions.push(
      'An SSD will make map browsing, ZIM indexing, and local AI model loading more responsive.'
    )
  }

  return {
    id: 'storage',
    label: 'SSD / storage',
    status,
    score,
    value: `${formatGigabytes(disk.totalSize - disk.totalUsed)} free${isSsd ? ' · SSD/NVMe' : ' · HDD'}`,
    detail,
  }
}

function buildMemoryCheck(
  systemInfo: ReadinessSystemInfo,
  suggestions: string[]
): HardwareReadinessCheck {
  const total = finiteNumber(systemInfo.mem?.total)
  if (!total || total <= 0) {
    suggestions.push(
      'RAM capacity is not available yet; use smaller services until the system check completes.'
    )
    return {
      id: 'memory',
      label: 'Memory',
      status: 'unknown',
      score: null,
      value: 'Not detected',
      detail: 'The system did not report total RAM.',
    }
  }

  const totalGb = total / GIGABYTE
  const available = finiteNumber(systemInfo.mem.available)
  const score =
    totalGb >= 32
      ? 100
      : totalGb >= 16
        ? 90
        : totalGb >= 8
          ? 75
          : totalGb >= 4
            ? 55
            : totalGb >= 2
              ? 35
              : 15
  let status: HardwareReadinessStatus =
    totalGb >= 8 ? 'ready' : totalGb >= 4 ? 'caution' : 'attention'
  let detail = 'Enough memory for the core offline services.'
  let recommendation: string | undefined

  if (totalGb < 8) {
    recommendation = 'Prefer compact AI models and install content in smaller batches.'
    suggestions.push(recommendation)
    detail =
      totalGb < 4
        ? 'Limited RAM may cause local AI and content indexing to compete for memory.'
        : 'Core services should work, but simultaneous AI and content indexing may be slow.'
  }

  if (available !== null && available < GIGABYTE) {
    status = 'attention'
    detail += ' Less than 1 GB is currently available.'
    suggestions.push(
      'Close other workloads or restart the device before starting large downloads or indexing jobs.'
    )
  }

  return {
    id: 'memory',
    label: 'RAM',
    status,
    score,
    value: formatGigabytes(total),
    detail,
    recommendation,
  }
}

function buildGpuCheck(
  systemInfo: ReadinessSystemInfo,
  options: HardwareReadinessOptions,
  suggestions: string[]
): HardwareReadinessCheck {
  if (options.remoteOllamaConfigured) {
    return {
      id: 'gpu',
      label: 'GPU / AI acceleration',
      status: 'ready',
      score: 80,
      value: 'Remote AI host',
      detail: 'AI inference is configured for a remote Ollama host; its GPU is not visible here.',
    }
  }

  const controllers = systemInfo.graphics?.controllers || []
  const maxVramMb = Math.max(
    ...controllers.map((controller) => finiteNumber(controller.vram) || 0),
    0
  )
  const gpuHealth = systemInfo.gpuHealth

  if (gpuHealth?.status === 'passthrough_failed') {
    suggestions.push(
      'Reinstall the AI Assistant from Settings → Apps to restore NVIDIA GPU passthrough, or use smaller CPU models.'
    )
    return {
      id: 'gpu',
      label: 'GPU / AI acceleration',
      status: 'attention',
      score: 15,
      value: 'GPU not accessible',
      detail: 'An NVIDIA runtime was detected, but the AI container cannot access the GPU.',
    }
  }

  if (controllers.length === 0) {
    suggestions.push(
      'No GPU was detected. Local AI will use the CPU; choose a compact model or configure remote Ollama.'
    )
    return {
      id: 'gpu',
      label: 'GPU / AI acceleration',
      status: 'caution',
      score: 35,
      value: 'CPU inference',
      detail: 'NOMAD can run without a GPU, but local AI responses may be slower.',
    }
  }

  if (maxVramMb <= 0) {
    suggestions.push(
      'GPU model detected, but VRAM could not be read. Start with a compact model and verify GPU access after installing AI.'
    )
    return {
      id: 'gpu',
      label: 'GPU / AI acceleration',
      status: 'unknown',
      score: 50,
      value: 'VRAM unavailable',
      detail: 'The graphics controller is visible but did not report dedicated VRAM.',
    }
  }

  const vramGb = maxVramMb / 1024
  const score = vramGb >= 16 ? 100 : vramGb >= 12 ? 90 : vramGb >= 8 ? 80 : vramGb >= 4 ? 60 : 40
  const status: HardwareReadinessStatus = vramGb >= 4 ? 'ready' : 'caution'
  const recommendation =
    vramGb < 8 ? 'Use a smaller quantized model to keep inference responsive.' : undefined
  if (recommendation) suggestions.push(recommendation)

  return {
    id: 'gpu',
    label: 'GPU / AI acceleration',
    status,
    score,
    value: `${formatGigabytes(maxVramMb * 1024 ** 2)} VRAM`,
    detail: `${controllers[0].model || 'GPU'} is available for local AI acceleration.`,
    recommendation,
  }
}

export function buildHardwareReadiness(
  systemInfo?: ReadinessSystemInfo,
  options: HardwareReadinessOptions = {}
): HardwareReadiness {
  const suggestions: string[] = []
  if (!systemInfo) {
    return {
      score: null,
      status: 'unknown',
      checks: [],
      suggestions: [
        'System hardware is still being detected. Keep this page open while the first check completes.',
      ],
    }
  }

  const checks = [
    buildStorageCheck(systemInfo, options, suggestions),
    buildMemoryCheck(systemInfo, suggestions),
    buildGpuCheck(systemInfo, options, suggestions),
  ]
  const scoredChecks = checks.filter((check) => check.score !== null) as Array<
    HardwareReadinessCheck & { score: number }
  >
  const score =
    scoredChecks.length > 0
      ? round(scoredChecks.reduce((sum, check) => sum + check.score, 0) / scoredChecks.length)
      : null
  const status = checks.some((check) => check.status === 'attention')
    ? 'attention'
    : checks.some((check) => check.status === 'caution' || check.status === 'unknown')
      ? 'caution'
      : score === null
        ? 'unknown'
        : 'ready'

  if (score !== null && score >= 75 && suggestions.length === 0) {
    suggestions.push(
      'This hardware is a good fit for the core NOMAD services. You can add larger collections later.'
    )
  }

  return {
    score,
    status,
    checks,
    suggestions: [...new Set(suggestions)],
  }
}
