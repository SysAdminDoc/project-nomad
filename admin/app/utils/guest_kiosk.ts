import { SERVICE_NAMES } from '../../constants/service_names.js'

export const GUEST_KIOSK_TOOL_IDS = [
  'chat',
  'maps',
  'docs',
  'kiwix',
  'kolibri',
  'cyberchef',
  'flatnotes',
] as const

export type GuestKioskToolId = (typeof GUEST_KIOSK_TOOL_IDS)[number]

export type GuestKioskConfig = {
  enabled: boolean
  tools: GuestKioskToolId[]
}

export type GuestKioskTool = {
  id: GuestKioskToolId
  label: string
  description: string
  href: string
  target: '_self' | '_blank'
  icon: string
}

type KioskService = {
  service_name: string
  friendly_name: string | null
  description: string | null
  icon: string | null
  ui_location: string | null
}

const DEFAULT_GUEST_KIOSK_TOOLS: GuestKioskToolId[] = ['chat', 'maps', 'docs']

const BUILT_IN_TOOLS: Record<
  Extract<GuestKioskToolId, 'chat' | 'maps' | 'docs'>,
  Omit<GuestKioskTool, 'id'>
> = {
  chat: {
    label: 'AI Assistant',
    description: 'Ask questions using the local language model.',
    href: '/chat',
    target: '_self',
    icon: 'IconWand',
  },
  maps: {
    label: 'Offline Maps',
    description: 'Explore installed maps without an internet connection.',
    href: '/maps',
    target: '_self',
    icon: 'IconMap',
  },
  docs: {
    label: 'Command Center Docs',
    description: 'Read the local manuals and classroom guides.',
    href: '/docs/home',
    target: '_self',
    icon: 'IconBooks',
  },
}

const SERVICE_TOOL_IDS: Record<string, Exclude<GuestKioskToolId, 'chat' | 'maps' | 'docs'>> = {
  [SERVICE_NAMES.KIWIX]: 'kiwix',
  [SERVICE_NAMES.KOLIBRI]: 'kolibri',
  [SERVICE_NAMES.CYBERCHEF]: 'cyberchef',
  [SERVICE_NAMES.FLATNOTES]: 'flatnotes',
}

function isGuestKioskToolId(value: string): value is GuestKioskToolId {
  return (GUEST_KIOSK_TOOL_IDS as readonly string[]).includes(value)
}

export function parseGuestKioskTools(raw: string | undefined): GuestKioskToolId[] {
  const requested = raw
    ?.split(',')
    .map((tool) => tool.trim().toLowerCase())
    .filter(Boolean)

  if (!requested || requested.length === 0) return [...DEFAULT_GUEST_KIOSK_TOOLS]

  const configured = [...new Set(requested.filter(isGuestKioskToolId))]
  return configured.length > 0 ? configured : [...DEFAULT_GUEST_KIOSK_TOOLS]
}

export function buildGuestKioskConfig(
  rawEnabled: boolean | string | undefined,
  rawTools?: string
): GuestKioskConfig {
  const enabled =
    rawEnabled === true ||
    (typeof rawEnabled === 'string' &&
      ['1', 'true', 'yes', 'on'].includes(rawEnabled.toLowerCase()))

  return { enabled, tools: parseGuestKioskTools(rawTools) }
}

export function buildGuestKioskTools(
  enabledTools: GuestKioskToolId[],
  services: KioskService[]
): GuestKioskTool[] {
  const tools: GuestKioskTool[] = []

  for (const id of enabledTools) {
    if (id in BUILT_IN_TOOLS) {
      tools.push({ id, ...BUILT_IN_TOOLS[id as keyof typeof BUILT_IN_TOOLS] })
      continue
    }

    const service = services.find((candidate) => SERVICE_TOOL_IDS[candidate.service_name] === id)
    if (!service?.ui_location) continue

    tools.push({
      id,
      label: service.friendly_name || id,
      description: service.description || `Open ${service.friendly_name || id}.`,
      href: service.ui_location,
      target: service.ui_location.startsWith('/') ? '_self' : '_blank',
      icon: service.icon || 'IconTool',
    })
  }

  return tools
}

export function isGuestKioskRouteAllowed(
  pathname: string,
  method: string,
  enabledTools: GuestKioskToolId[]
): boolean {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/'
  const normalizedMethod = method.toUpperCase()
  const has = (tool: GuestKioskToolId) => enabledTools.includes(tool)

  if (path === '/kiosk' || (path === '/api/health' && normalizedMethod === 'GET')) return true

  if (has('chat')) {
    if (path === '/chat') return true
    if (
      path.startsWith('/api/chat/') ||
      path === '/api/chat' ||
      path === '/api/ollama/chat' ||
      path === '/api/ollama/installed-models' ||
      path === '/api/chat/suggestions'
    ) {
      return true
    }
  }

  if (has('maps')) {
    if (path === '/maps') return true
    if (
      path === '/api/maps/styles' ||
      path === '/api/maps/regions' ||
      path === '/api/maps/markers' ||
      path.startsWith('/api/maps/markers/')
    ) {
      return true
    }
  }

  if (has('docs')) {
    if (path === '/docs' || path.startsWith('/docs/') || path === '/api/docs/list') return true
  }

  // The search bar is part of the public tool shell and does not expose management actions.
  if (path === '/api/search' && (has('chat') || has('maps') || has('docs'))) return true

  return false
}

export function isGuestKioskStaticPathAllowed(
  pathname: string,
  enabledTools: GuestKioskToolId[]
): boolean {
  const path = pathname.split('?')[0]
  if (
    path.startsWith('/assets/') ||
    path === '/project_nomad_logo.webp' ||
    path === '/favicon.ico' ||
    path.startsWith('/favicon-') ||
    path === '/manifest.webmanifest' ||
    path === '/sw.js' ||
    path === '/robots.txt'
  ) {
    return true
  }

  if (enabledTools.includes('maps')) {
    return (
      path.startsWith('/pmtiles/') ||
      path.startsWith('/basemaps-assets/') ||
      path.startsWith('/storage/maps/')
    )
  }

  return false
}
