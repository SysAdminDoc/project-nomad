import Service from '#models/service'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { inject } from '@adonisjs/core'
import { DockerService } from './docker_service.js'
import type { DeveloperCache } from '../../types/caches.js'
import { CACHE_DEFINITIONS } from '../utils/developer_caches.js'

export { CACHE_DEFINITIONS } from '../utils/developer_caches.js'

const STORAGE_ROOT = process.env.NOMAD_STORAGE_PATH || '/opt/project-nomad/storage'

async function getDirectorySize(directory: string): Promise<number> {
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const sizes = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = join(directory, entry.name)
        if (entry.isDirectory()) return getDirectorySize(entryPath)
        try {
          const entryStats = await stat(entryPath)
          return entryStats.size
        } catch {
          return 0
        }
      })
    )
    return sizes.reduce((total, size) => total + size, 0)
  } catch {
    return 0
  }
}

@inject()
export class DeveloperCacheService {
  constructor(private dockerService: DockerService) {}

  async list(): Promise<DeveloperCache[]> {
    const [services, statuses] = await Promise.all([
      Service.query().whereIn(
        'service_name',
        CACHE_DEFINITIONS.map((cache) => cache.service_name)
      ),
      this.dockerService.getServicesStatus(),
    ])
    const statusMap = new Map(statuses.map((status) => [status.service_name, status.status]))

    return Promise.all(
      CACHE_DEFINITIONS.map(async (definition) => {
        const service = services.find(
          (candidate) => candidate.service_name === definition.service_name
        )
        return {
          ...definition,
          container_image: service?.container_image ?? '',
          installed: service?.installed ?? false,
          installation_status: service?.installation_status ?? 'idle',
          status: statusMap.get(definition.service_name) ?? 'not-created',
          size_bytes: await getDirectorySize(join(STORAGE_ROOT, definition.storage_path)),
        }
      })
    )
  }
}
