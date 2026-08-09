import type { SystemInformationResponse } from '../../types/system.js'
import type {
  ModelCatalogHardware,
  ModelHardwareProfile,
  NomadModelRecommendation,
  NomadOllamaModel,
  NomadOllamaModelTag,
} from '../../types/ollama.js'

export type ModelHardwareSnapshot = {
  cpuModel?: string | null
  architecture?: string | null
  ramBytes?: number | null
  gpuModels?: Array<{
    model?: string | null
    vendor?: string | null
    vramMb?: number | null
  }>
}

const PROFILE_LABELS: Record<ModelHardwareProfile, string> = {
  'raspberry-pi-5': 'Raspberry Pi 5',
  'jetson': 'NVIDIA Jetson',
  'x86-nvidia': 'x86 + NVIDIA GPU',
  'x86': 'x86 system',
  'arm64': 'ARM64 system',
  'unknown': 'Unknown device',
  'remote': 'Remote AI host',
}

function normalize(value: string | null | undefined): string {
  return value?.trim() || ''
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function parseModelParameterBillions(modelName: string): number | null {
  const match = modelName.match(/(?:^|[:\-_])([0-9]+(?:\.[0-9]+)?)\s*b(?:$|[^a-z])/i)
  return match ? Number.parseFloat(match[1]) : null
}

export function parseModelSizeGb(size: string): number | null {
  const match = size.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(KB|MB|GB|TB)$/i)
  if (!match) return null

  const value = Number.parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers: Record<string, number> = {
    KB: 1 / 1_000_000,
    MB: 1 / 1_000,
    GB: 1,
    TB: 1_000,
  }

  return value * multipliers[unit]
}

export function detectModelHardwareProfile(snapshot: ModelHardwareSnapshot): ModelHardwareProfile {
  const cpu = normalize(snapshot.cpuModel).toLowerCase()
  const architecture = normalize(snapshot.architecture).toLowerCase()
  const gpu = (snapshot.gpuModels || [])
    .map((controller) => `${normalize(controller.vendor)} ${normalize(controller.model)}`)
    .join(' ')
    .toLowerCase()

  if (/(raspberry\s*pi|bcm2712)/i.test(`${cpu} ${gpu}`)) {
    return 'raspberry-pi-5'
  }

  if (/(jetson|tegra|orin|carmel|grace)/i.test(`${cpu} ${gpu}`)) {
    return 'jetson'
  }

  const isX86 = /(x86_64|amd64|x64|intel|amd|xeon|ryzen|core\s)/i.test(`${architecture} ${cpu}`)
  const hasNvidiaGpu = /(nvidia|geforce|rtx|quadro|tesla)/i.test(gpu)

  if (isX86 && hasNvidiaGpu) return 'x86-nvidia'
  if (isX86) return 'x86'
  if (/(aarch64|arm64|armv8|arm)/i.test(architecture)) return 'arm64'
  return 'unknown'
}

export function buildModelCatalogHardware(
  systemInfo?: Pick<SystemInformationResponse, 'cpu' | 'os' | 'mem' | 'graphics'>,
  remote = false
): ModelCatalogHardware {
  if (remote) {
    return {
      profile: 'remote',
      label: PROFILE_LABELS.remote,
      cpuModel: '',
      gpuModel: '',
      ramGb: 0,
      vramGb: 0,
    }
  }

  const gpuModels = (systemInfo?.graphics?.controllers || []).map((controller) => ({
    model: controller.model,
    vendor: controller.vendor,
    vramMb: Number(controller.vram) || 0,
  }))
  const snapshot: ModelHardwareSnapshot = {
    cpuModel: systemInfo?.cpu?.brand,
    architecture: systemInfo?.os?.arch,
    ramBytes: systemInfo?.mem?.total,
    gpuModels,
  }
  const profile = detectModelHardwareProfile(snapshot)
  const ramGb = round((Number(snapshot.ramBytes) || 0) / 1024 ** 3)
  const vramMb = Math.max(...gpuModels.map((controller) => controller.vramMb || 0), 0)
  const gpuModel = gpuModels
    .map((controller) => normalize(controller.model))
    .filter(Boolean)
    .join(', ')

  return {
    profile,
    label: PROFILE_LABELS[profile],
    cpuModel: normalize(snapshot.cpuModel),
    gpuModel,
    ramGb,
    vramGb: round(vramMb / 1024),
  }
}

function profileLimits(hardware: ModelCatalogHardware): {
  recommendedParams: number
  possibleParams: number
  memoryBudgetGb: number
} {
  const ram = hardware.ramGb || 0
  const vram = hardware.vramGb || 0

  switch (hardware.profile) {
    case 'raspberry-pi-5':
      return {
        recommendedParams: 4,
        possibleParams: 8,
        memoryBudgetGb: Math.max(1.5, ram * 0.55),
      }
    case 'jetson':
      return {
        recommendedParams: vram >= 8 || ram >= 16 ? 14 : 8,
        possibleParams: vram >= 8 || ram >= 16 ? 24 : 14,
        memoryBudgetGb: Math.max(2, (vram || ram) * 0.7),
      }
    case 'x86-nvidia':
      return {
        recommendedParams: vram >= 16 ? 32 : vram >= 12 ? 14 : vram >= 8 ? 8 : 7,
        possibleParams: vram >= 16 ? 70 : vram >= 12 ? 32 : vram >= 8 ? 14 : 8,
        memoryBudgetGb: Math.max(3, (vram || ram * 0.5) * 0.9),
      }
    case 'x86':
      return {
        recommendedParams: ram >= 32 ? 14 : ram >= 16 ? 8 : 4,
        possibleParams: ram >= 32 ? 32 : ram >= 16 ? 14 : 8,
        memoryBudgetGb: Math.max(2, ram * 0.5),
      }
    case 'arm64':
      return {
        recommendedParams: ram >= 16 ? 8 : 4,
        possibleParams: ram >= 16 ? 14 : 8,
        memoryBudgetGb: Math.max(1.5, ram * 0.5),
      }
    case 'remote':
      return { recommendedParams: 0, possibleParams: 0, memoryBudgetGb: 0 }
    default:
      return { recommendedParams: 4, possibleParams: 8, memoryBudgetGb: 4 }
  }
}

function estimateModelMemoryGb(tag: NomadOllamaModelTag): {
  estimatedMemoryGb: number
  parameterBillions: number | null
} {
  const parameterBillions = parseModelParameterBillions(tag.name)
  const diskSizeGb = parseModelSizeGb(tag.size)
  const parameterEstimate = parameterBillions ? parameterBillions * 0.55 + 0.7 : 0
  const sizeEstimate = diskSizeGb ? diskSizeGb * 1.25 + 0.7 : 0
  const estimatedMemoryGb = Math.max(parameterEstimate, sizeEstimate, 1)

  return {
    estimatedMemoryGb: round(estimatedMemoryGb),
    parameterBillions,
  }
}

export function recommendModelTag(
  tag: NomadOllamaModelTag,
  hardware: ModelCatalogHardware
): NomadModelRecommendation {
  const { estimatedMemoryGb, parameterBillions } = estimateModelMemoryGb(tag)

  if (hardware.profile === 'remote') {
    return {
      tier: 'unknown',
      recommended: false,
      score: 0,
      label: 'Check remote host',
      reason:
        'The model will run on the configured remote AI host, whose hardware is not visible here.',
      estimatedMemoryGb,
      parameterBillions,
    }
  }

  const limits = profileLimits(hardware)
  const fitsMemory = estimatedMemoryGb <= limits.memoryBudgetGb
  const fitsRecommendedParams =
    parameterBillions === null || parameterBillions <= limits.recommendedParams
  const fitsPossibleParams =
    parameterBillions === null || parameterBillions <= limits.possibleParams

  if (fitsMemory && fitsRecommendedParams) {
    const memoryScore = limits.memoryBudgetGb
      ? Math.max(0, 100 - (estimatedMemoryGb / limits.memoryBudgetGb) * 40)
      : 70
    return {
      tier: 'recommended',
      recommended: true,
      score: Math.round(memoryScore),
      label: `Recommended for ${hardware.label}`,
      reason: `Estimated ${estimatedMemoryGb} GB runtime memory fits this device's available budget.`,
      estimatedMemoryGb,
      parameterBillions,
    }
  }

  if (fitsPossibleParams && estimatedMemoryGb <= limits.memoryBudgetGb * 1.5) {
    return {
      tier: 'possible',
      recommended: false,
      score: 45,
      label: `Possible on ${hardware.label}`,
      reason: `This model may run, but it could be slow or use CPU/shared memory.`,
      estimatedMemoryGb,
      parameterBillions,
    }
  }

  return {
    tier: 'not-recommended',
    recommended: false,
    score: 0,
    label: `Too large for ${hardware.label}`,
    reason: `Estimated ${estimatedMemoryGb} GB runtime memory exceeds the recommended capacity for this device.`,
    estimatedMemoryGb,
    parameterBillions,
  }
}

export function annotateModelRecommendations(
  models: NomadOllamaModel[],
  hardware: ModelCatalogHardware
): NomadOllamaModel[] {
  return models.map((model) => {
    const tags = model.tags
      .map((tag) => ({
        ...tag,
        recommendation: recommendModelTag(tag, hardware),
      }))
      .sort((left, right) => (right.recommendation?.score || 0) - (left.recommendation?.score || 0))

    return {
      ...model,
      recommended: tags.some((tag) => tag.recommendation?.recommended),
      tags,
    }
  })
}

export function selectRecommendedModels(models: NomadOllamaModel[], limit = 3): NomadOllamaModel[] {
  const candidates = models
    .map((model) => {
      const recommendedTag = model.tags.find((tag) => tag.recommendation?.recommended)
      const fallbackTag = model.tags[0]
      return {
        model,
        tag: recommendedTag || fallbackTag,
      }
    })
    .filter(({ tag }) => Boolean(tag))
    .sort((left, right) => {
      const leftScore = left.tag?.recommendation?.score || 0
      const rightScore = right.tag?.recommendation?.score || 0
      return rightScore - leftScore
    })

  return candidates.slice(0, limit).map(({ model, tag }) => ({
    ...model,
    tags: tag ? [tag] : [],
  }))
}
