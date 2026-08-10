export type ContainerMemoryStats = {
  usage?: number
  limit?: number
  stats?: {
    cache?: number
  }
}

export type ContainerMemoryUsage = {
  memoryBytes: number
  memoryLimitBytes: number | null
  memoryPercent: number | null
}

/**
 * Docker's memory usage includes the filesystem cache on Linux. Subtract it
 * so the dashboard reflects memory pressure more closely than raw usage.
 */
export function calculateContainerMemoryUsage(
  memoryStats?: ContainerMemoryStats | null
): ContainerMemoryUsage {
  const usage = Number(memoryStats?.usage) || 0
  const cache = Number(memoryStats?.stats?.cache) || 0
  const memoryBytes = Math.max(0, usage - cache)
  const memoryLimit = Number(memoryStats?.limit) || 0

  return {
    memoryBytes,
    memoryLimitBytes: memoryLimit > 0 ? memoryLimit : null,
    memoryPercent: memoryLimit > 0 ? Math.round((memoryBytes / memoryLimit) * 1000) / 10 : null,
  }
}
