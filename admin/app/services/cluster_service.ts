import InstalledResource from '#models/installed_resource'
import KVStore from '#models/kv_store'
import logger from '@adonisjs/core/services/logger'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import { createWriteStream } from 'node:fs'
import { lstat, mkdir, rename, rm, stat } from 'node:fs/promises'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { hostname } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  ClusterConfig,
  ClusterConfigResult,
  ClusterManifest,
  ClusterResource,
  ClusterResourceType,
  ClusterStatus,
  ClusterSyncResult,
  ClusterTokenResult,
} from '../../types/cluster.js'
import {
  buildClusterResourceKey,
  isSafeClusterFilename,
  normalizeClusterUrl,
} from '../utils/cluster.js'

const CLUSTER_REQUEST_TIMEOUT_MS = 15_000
const CLUSTER_TRANSFER_TIMEOUT_MS = 6 * 60 * 60 * 1000
const CLUSTER_MAX_RESOURCES_PER_SYNC = 100

@inject()
export class ClusterService {
  private activeSync: Promise<ClusterSyncResult> | null = null

  async getStatus(): Promise<ClusterStatus> {
    const [nodeName, token, remoteUrl, localManifest] = await Promise.all([
      this.getNodeName(),
      KVStore.getValue('cluster.sharedToken'),
      KVStore.getValue('cluster.remoteUrl'),
      this.getLocalManifest(),
    ])

    const remote = {
      configured: Boolean(remoteUrl && token),
      url: remoteUrl || null,
      reachable: false,
      node_name: null as string | null,
      resources: [] as ClusterResource[],
      error: undefined as string | undefined,
    }

    if (remoteUrl && token) {
      try {
        const manifest = await this.fetchRemoteManifest(remoteUrl, token)
        remote.reachable = true
        remote.node_name = manifest.node_name
        remote.resources = manifest.resources
      } catch (error) {
        remote.error = this.errorMessage(error, 'The paired N.O.M.A.D. box could not be reached')
      }
    } else if (remoteUrl && !token) {
      remote.error = 'Save the shared token before connecting to the paired box.'
    }

    return {
      local: {
        node_name: nodeName,
        sharing_enabled: Boolean(token),
        resource_count: localManifest.resources.length,
      },
      remote,
    }
  }

  async generateToken(): Promise<ClusterTokenResult> {
    const token = randomBytes(24).toString('base64url')
    await KVStore.setValue('cluster.sharedToken', token)
    return { token }
  }

  async configure(config: ClusterConfig): Promise<ClusterConfigResult> {
    const token = config.token.trim() || (await KVStore.getValue('cluster.sharedToken')) || ''
    if (token.length < 16) {
      return {
        success: false,
        message: 'The shared token must be at least 16 characters long.',
        token_configured: false,
      }
    }

    let remoteUrl = ''
    if (config.remote_url.trim()) {
      remoteUrl = normalizeClusterUrl(config.remote_url)
    }

    const nodeName = (config.node_name.trim() || (await this.getNodeName())).slice(0, 80)
    await KVStore.setValue('cluster.nodeName', nodeName)
    await KVStore.setValue('cluster.sharedToken', token)
    if (remoteUrl) await KVStore.setValue('cluster.remoteUrl', remoteUrl)
    else await KVStore.clearValue('cluster.remoteUrl')

    return {
      success: true,
      message: remoteUrl ? 'Cluster pairing settings saved.' : 'Cluster sharing settings saved.',
      token_configured: true,
    }
  }

  async isTokenValid(candidate: string | undefined): Promise<boolean> {
    if (!candidate) return false
    const configured = await KVStore.getValue('cluster.sharedToken')
    if (!configured) return false

    const expectedBuffer = Buffer.from(configured)
    const candidateBuffer = Buffer.from(candidate)
    return (
      expectedBuffer.length === candidateBuffer.length &&
      timingSafeEqual(expectedBuffer, candidateBuffer)
    )
  }

  async getLocalManifest(): Promise<ClusterManifest> {
    const resources = await InstalledResource.query()
      .orderBy('resource_type')
      .orderBy('resource_id')
    const available: ClusterResource[] = []

    for (const resource of resources) {
      const resolvedPath = await this.resolveResourcePath(resource)
      if (!resolvedPath) continue

      const details = await stat(resolvedPath)
      available.push({
        resource_id: resource.resource_id,
        resource_type: resource.resource_type,
        version: resource.version,
        collection_ref: resource.collection_ref,
        filename: basename(resolvedPath),
        size_bytes: details.size,
        installed_at: resource.installed_at.toISO() || details.mtime.toISOString(),
      })
    }

    return {
      node_name: await this.getNodeName(),
      generated_at: new Date().toISOString(),
      resources: available,
    }
  }

  async getResourceFile(resourceId: string, resourceType: ClusterResourceType) {
    const resource = await InstalledResource.query()
      .where('resource_id', resourceId)
      .where('resource_type', resourceType)
      .first()
    if (!resource) throw new Error('resource_not_found')

    const filePath = await this.resolveResourcePath(resource)
    if (!filePath) throw new Error('resource_file_not_found')
    const details = await stat(filePath)

    return {
      filePath,
      filename: basename(filePath),
      sizeBytes: details.size,
    }
  }

  async syncResources(resourceKeys: string[]): Promise<ClusterSyncResult> {
    if (this.activeSync) {
      return {
        success: false,
        message: 'Another cluster sync is already running.',
        results: [],
      }
    }

    const operation = this.runSync(resourceKeys)
    this.activeSync = operation
    try {
      return await operation
    } finally {
      if (this.activeSync === operation) this.activeSync = null
    }
  }

  private async runSync(resourceKeys: string[]): Promise<ClusterSyncResult> {
    const remoteUrl = await KVStore.getValue('cluster.remoteUrl')
    const token = await KVStore.getValue('cluster.sharedToken')
    if (!remoteUrl || !token) {
      return { success: false, message: 'Configure a paired N.O.M.A.D. box first.', results: [] }
    }

    const manifest = await this.fetchRemoteManifest(remoteUrl, token)
    const remoteResources = new Map(
      manifest.resources.map((resource) => [
        buildClusterResourceKey(resource.resource_id, resource.resource_type),
        resource,
      ])
    )
    const requested = [...new Set(resourceKeys)].slice(0, CLUSTER_MAX_RESOURCES_PER_SYNC)
    const results: ClusterSyncResult['results'] = []

    for (const key of requested) {
      const separator = key.indexOf(':')
      const resourceType = key.slice(0, separator) as ClusterResourceType
      const resourceId = key.slice(separator + 1)
      const resource = remoteResources.get(key)

      if (separator < 1 || !resourceId || !['zim', 'map'].includes(resourceType) || !resource) {
        results.push({
          resource_id: resourceId || key,
          resource_type: ['zim', 'map'].includes(resourceType) ? resourceType : 'zim',
          success: false,
          message: 'Resource is no longer available on the paired box.',
        })
        continue
      }

      try {
        await this.syncResource(remoteUrl, token, resource)
        results.push({
          resource_id: resource.resource_id,
          resource_type: resource.resource_type,
          success: true,
          message: `${resource.filename} synchronized successfully.`,
        })
      } catch (error) {
        const message = this.errorMessage(error, `Failed to synchronize ${resource.filename}`)
        logger.error(`[ClusterService] ${message}`)
        results.push({
          resource_id: resource.resource_id,
          resource_type: resource.resource_type,
          success: false,
          message,
        })
      }
    }

    const succeeded = results.filter((result) => result.success).length
    const failed = results.length - succeeded
    return {
      success: results.length > 0 && failed === 0,
      message:
        failed === 0
          ? `${succeeded} resource${succeeded === 1 ? '' : 's'} synchronized.`
          : `${succeeded} synchronized; ${failed} failed.`,
      results,
    }
  }

  private async syncResource(
    remoteUrl: string,
    token: string,
    resource: ClusterResource
  ): Promise<void> {
    if (!isSafeClusterFilename(resource.filename)) {
      throw new Error(`Unsafe filename received for ${resource.resource_id}`)
    }

    const storageRoot = this.getStorageRoot()
    const destinationDirectory = join(
      storageRoot,
      resource.resource_type === 'zim' ? 'zim' : 'maps'
    )
    await mkdir(destinationDirectory, { recursive: true })
    const destinationPath = resolve(destinationDirectory, resource.filename)
    if (!this.isInside(storageRoot, destinationPath)) {
      throw new Error(`Unsafe destination for ${resource.filename}`)
    }

    const partialPath = join(destinationDirectory, `.cluster-${randomUUID()}.partial`)
    const oldPath = `${destinationPath}.cluster-old-${randomUUID()}`
    let previousPathMoved = false

    try {
      const endpoint = this.buildResourceUrl(remoteUrl, resource)
      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(CLUSTER_TRANSFER_TIMEOUT_MS),
      })
      if (!response.ok) {
        throw new Error(`Paired box returned HTTP ${response.status}`)
      }
      if (!response.body) throw new Error('Paired box returned an empty resource stream')

      await pipeline(
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
        createWriteStream(partialPath, { mode: 0o600 })
      )

      const downloaded = await stat(partialPath)
      if (downloaded.size !== resource.size_bytes) {
        throw new Error(
          `Size check failed for ${resource.filename}: expected ${resource.size_bytes} bytes, received ${downloaded.size}`
        )
      }

      if (await this.pathExists(destinationPath)) {
        await rename(destinationPath, oldPath)
        previousPathMoved = true
      }
      await rename(partialPath, destinationPath)

      try {
        await InstalledResource.updateOrCreate(
          { resource_id: resource.resource_id, resource_type: resource.resource_type },
          {
            collection_ref: resource.collection_ref,
            version: resource.version,
            url: remoteUrl,
            file_path: destinationPath,
            file_size_bytes: downloaded.size,
            installed_at: DateTime.now(),
          }
        )
      } catch (error) {
        await rm(destinationPath, { force: true }).catch(() => undefined)
        if (previousPathMoved) {
          await rename(oldPath, destinationPath)
          previousPathMoved = false
        }
        throw error
      }

      if (previousPathMoved) {
        await rm(oldPath, { force: true }).catch((error) => {
          logger.warn(
            `[ClusterService] New resource installed, but the previous copy could not be removed: ${this.errorMessage(error, 'unknown error')}`
          )
        })
        previousPathMoved = false
      }
    } catch (error) {
      if (previousPathMoved) {
        await rm(destinationPath, { force: true }).catch(() => undefined)
        await rename(oldPath, destinationPath).catch(() => undefined)
      }
      throw error
    } finally {
      await rm(partialPath, { force: true }).catch(() => undefined)
    }
  }

  private async fetchRemoteManifest(remoteUrl: string, token: string): Promise<ClusterManifest> {
    const response = await fetch(`${remoteUrl}/api/cluster/manifest`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(CLUSTER_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Paired box returned HTTP ${response.status}`)

    const payload = (await response.json()) as unknown
    return this.parseManifest(payload)
  }

  private parseManifest(payload: unknown): ClusterManifest {
    if (!payload || typeof payload !== 'object') throw new Error('Paired manifest is invalid')
    const candidate = payload as Partial<ClusterManifest>
    if (
      typeof candidate.node_name !== 'string' ||
      typeof candidate.generated_at !== 'string' ||
      !Array.isArray(candidate.resources)
    ) {
      throw new Error('Paired manifest is invalid')
    }

    const resources = candidate.resources.filter((resource): resource is ClusterResource => {
      if (!resource || typeof resource !== 'object') return false
      const item = resource as Partial<ClusterResource>
      return (
        typeof item.resource_id === 'string' &&
        ['zim', 'map'].includes(item.resource_type || '') &&
        typeof item.version === 'string' &&
        typeof item.filename === 'string' &&
        isSafeClusterFilename(item.filename) &&
        typeof item.size_bytes === 'number' &&
        Number.isSafeInteger(item.size_bytes) &&
        item.size_bytes >= 0 &&
        typeof item.installed_at === 'string'
      )
    })

    if (resources.length !== candidate.resources.length) {
      throw new Error('Paired manifest contains an invalid resource')
    }
    return { node_name: candidate.node_name, generated_at: candidate.generated_at, resources }
  }

  private buildResourceUrl(remoteUrl: string, resource: ClusterResource): string {
    const params = new URLSearchParams({
      resource_id: resource.resource_id,
      resource_type: resource.resource_type,
    })
    return `${remoteUrl}/api/cluster/resource?${params.toString()}`
  }

  private async resolveResourcePath(resource: InstalledResource): Promise<string | null> {
    const storageRoot = this.getStorageRoot()
    const rawPath = resource.file_path
    const directPath = resolve(rawPath)
    const candidates = [
      directPath,
      resolve(storageRoot, resource.resource_type === 'zim' ? 'zim' : 'maps', basename(rawPath)),
    ]

    for (const candidate of candidates) {
      if (!this.isInside(storageRoot, candidate)) continue
      try {
        const details = await lstat(candidate)
        if (details.isFile()) return candidate
      } catch {
        // Try the next normalized candidate.
      }
    }
    return null
  }

  private getStorageRoot(): string {
    return resolve(process.env.NOMAD_STORAGE_PATH || join(process.cwd(), 'storage'))
  }

  private async getNodeName(): Promise<string> {
    return (await KVStore.getValue('cluster.nodeName')) || hostname() || 'nomad-node'
  }

  private isInside(root: string, candidate: string): boolean {
    const resolvedRoot = resolve(root)
    const resolvedCandidate = resolve(candidate)
    return (
      resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${sep}`)
    )
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await lstat(path)
      return true
    } catch {
      return false
    }
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback
  }
}
