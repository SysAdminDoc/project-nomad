import { BackupService } from '#services/backup_service'
import { backupTargetValidator, restoreBackupValidator } from '#validators/backup'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'

@inject()
export default class BackupController {
  constructor(private backupService: BackupService) {}

  async index({ inertia }: HttpContext) {
    return inertia.render('settings/backups')
  }

  async status({ response }: HttpContext) {
    try {
      return response.send(await this.backupService.getStatus())
    } catch (error) {
      return response.status(503).send({
        message: error instanceof Error ? error.message : 'Backup status unavailable',
      })
    }
  }

  async create({ request, response }: HttpContext) {
    const payload = await request.validateUsing(backupTargetValidator)
    try {
      const result = await this.backupService.createBackup(payload.target)
      return response.status(result.success ? 200 : 503).send(result)
    } catch (error) {
      return response.status(503).send({
        success: false,
        message: error instanceof Error ? error.message : 'Backup creation failed',
      })
    }
  }

  async restore({ request, response }: HttpContext) {
    const payload = await request.validateUsing(restoreBackupValidator)
    try {
      const result = await this.backupService.restoreBackup(
        payload.target,
        payload.filename,
        payload.confirmation
      )
      return response.status(result.success ? 200 : 400).send(result)
    } catch (error) {
      return response.status(400).send({
        success: false,
        message: error instanceof Error ? error.message : 'Restore failed',
      })
    }
  }
}
