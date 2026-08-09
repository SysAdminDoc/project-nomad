import { BaseSchema } from '@adonisjs/lucid/schema'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import { getVoiceServiceDefinitions } from '../../app/utils/voice_services.js'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    const storagePath = process.env.NOMAD_STORAGE_PATH || '/opt/project-nomad/storage'
    const now = new Date()
    const services = getVoiceServiceDefinitions(storagePath).map((service) => ({
      ...service,
      created_at: now,
      updated_at: now,
    }))

    for (const service of services) {
      const existing = await this.db
        .from(this.tableName)
        .where('service_name', service.service_name)
        .first()

      if (!existing) {
        await this.db.table(this.tableName).insert(service)
      }
    }
  }

  async down() {
    await this.db
      .from(this.tableName)
      .whereIn('service_name', [SERVICE_NAMES.WHISPER, SERVICE_NAMES.PIPER])
      .delete()
  }
}
