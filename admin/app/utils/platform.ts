export type NomadArchitecture = 'amd64' | 'arm64' | 'arm' | string

/**
 * Normalize Linux, Docker, and Node architecture spellings to OCI names.
 * Docker registry manifests use amd64/arm64/arm, while Node and dpkg expose
 * several equivalent aliases.
 */
export function normalizeArchitecture(value: string | undefined | null): NomadArchitecture {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return 'unknown'

  if (['amd64', 'x86_64', 'x64', 'x86-64'].includes(normalized)) return 'amd64'
  if (['arm64', 'aarch64', 'armv8', 'armv8l', 'arm64v8'].includes(normalized)) return 'arm64'
  if (['arm', 'armhf', 'armv7', 'armv7l', 'arm32'].includes(normalized)) return 'arm'
  return normalized
}

export function getRuntimeArchitecture(): NomadArchitecture {
  return normalizeArchitecture(process.arch)
}

export function isSupportedNomadArchitecture(architecture: string): boolean {
  return ['amd64', 'arm64'].includes(normalizeArchitecture(architecture))
}

export function architectureLabel(architecture: string): string {
  switch (normalizeArchitecture(architecture)) {
    case 'amd64':
      return '64-bit x86 (amd64)'
    case 'arm64':
      return '64-bit ARM (ARM64)'
    case 'arm':
      return '32-bit ARM'
    default:
      return architecture || 'Unknown architecture'
  }
}
