export type ZimResourceIdentity = {
  resourceId: string
  version: string
}

export function getZimResourceIdentity(filename: string): ZimResourceIdentity {
  const name = filename.replace(/\.zim$/i, '')
  const versionMatch = name.match(/^(.+?)[_-](\d{4}-\d{2})$/)

  return {
    resourceId: versionMatch?.[1] ?? name,
    version: versionMatch?.[2] ?? '',
  }
}

function releaseNumber(version: string): number | null {
  const match = version.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null
  return Number(match[1]) * 100 + Number(match[2])
}

export function isNewerZimRelease(
  currentFilename: string,
  latestFilename: string,
  latestUpdated?: string
): boolean {
  if (currentFilename === latestFilename) return false

  const current = getZimResourceIdentity(currentFilename)
  const latest = getZimResourceIdentity(latestFilename)
  if (current.resourceId !== latest.resourceId) return false

  const currentRelease = releaseNumber(current.version)
  const latestRelease = releaseNumber(latest.version)
  if (currentRelease !== null && latestRelease !== null) {
    return latestRelease > currentRelease
  }

  return latestUpdated ? Number.isFinite(Date.parse(latestUpdated)) : true
}
