import { ClusterService } from '#services/cluster_service'
import {
  clusterConfigValidator,
  clusterResourceValidator,
  clusterSyncValidator,
} from '#validators/cluster'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import { createReadStream } from 'node:fs'

@inject()
export default class ClusterController {
  constructor(private clusterService: ClusterService) {}

  async index({ inertia }: HttpContext) {
    return inertia.render('settings/cluster')
  }

  async status({ response }: HttpContext) {
    try {
      return response.send(await this.clusterService.getStatus())
    } catch (error) {
      return response.status(503).send({
        message: error instanceof Error ? error.message : 'Cluster status unavailable',
      })
    }
  }

  async generateToken({ response }: HttpContext) {
    return response.send(await this.clusterService.generateToken())
  }

  async configure({ request, response }: HttpContext) {
    const payload = await request.validateUsing(clusterConfigValidator)
    try {
      const result = await this.clusterService.configure(payload)
      return response.status(result.success ? 200 : 400).send(result)
    } catch (error) {
      return response.status(400).send({
        success: false,
        message: error instanceof Error ? error.message : 'Cluster configuration failed',
        token_configured: false,
      })
    }
  }

  async sync({ request, response }: HttpContext) {
    const payload = await request.validateUsing(clusterSyncValidator)
    try {
      const result = await this.clusterService.syncResources(payload.resource_keys)
      return response.status(result.success ? 200 : 409).send(result)
    } catch (error) {
      return response.status(503).send({
        success: false,
        message: error instanceof Error ? error.message : 'Cluster synchronization failed',
        results: [],
      })
    }
  }

  async manifest({ request, response }: HttpContext) {
    if (!(await this.authorize(request, response))) return
    return response.send(await this.clusterService.getLocalManifest())
  }

  async resource({ request, response }: HttpContext) {
    if (!(await this.authorize(request, response))) return
    const payload = await request.validateUsing(clusterResourceValidator)

    try {
      const resource = await this.clusterService.getResourceFile(
        payload.resource_id,
        payload.resource_type
      )
      response.header('Content-Type', 'application/octet-stream')
      response.header('Content-Length', String(resource.sizeBytes))
      response.header('Content-Disposition', `attachment; filename="${resource.filename}"`)
      return response.stream(createReadStream(resource.filePath))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message === 'resource_not_found' || message === 'resource_file_not_found') {
        return response.status(404).send({ message: 'Cluster resource not found' })
      }
      return response.status(500).send({ message: 'Cluster resource unavailable' })
    }
  }

  private async authorize(request: HttpContext['request'], response: HttpContext['response']) {
    const authorization = request.header('authorization') || ''
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
    const token = bearer || request.header('x-nomad-cluster-token')
    if (await this.clusterService.isTokenValid(token)) return true

    response.status(401).send({ message: 'Valid cluster pairing token required' })
    return false
  }
}
