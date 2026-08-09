import { Job } from 'bullmq'
import KVStore from '#models/kv_store'
import { DockerService } from '#services/docker_service'
import { ZimService } from '#services/zim_service'
import { QueueService } from '#services/queue_service'
import logger from '@adonisjs/core/services/logger'

export class CheckZimUpdatesJob {
  static get queue() {
    return 'system'
  }

  static get key() {
    return 'check-zim-updates'
  }

  async handle(_job: Job) {
    const service = new ZimService(new DockerService())
    const result = await service.checkForUpdates()
    await KVStore.setValue('zim.libraryUpdates', JSON.stringify(result))
    logger.info(`[CheckZimUpdatesJob] Found ${result.updates.length} Kiwix update(s)`)
    return result
  }

  static async scheduleNightly() {
    const queue = new QueueService().getQueue(this.queue)
    await queue.upsertJobScheduler(
      'nightly-zim-update-check',
      { pattern: '30 2,14 * * *' },
      {
        name: this.key,
        opts: {
          removeOnComplete: { count: 7 },
          removeOnFail: { count: 5 },
        },
      }
    )
    logger.info('[CheckZimUpdatesJob] Update check scheduled with cron: 30 2,14 * * *')
  }
}
