import { BaseSchema } from '@adonisjs/lucid/schema'
import { SERVICE_NAMES } from '../../constants/service_names.js'
import { getTranslationServiceDefinition } from '../../app/utils/translation_services.js'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    const storagePath = process.env.NOMAD_STORAGE_PATH || '/opt/project-nomad/storage'
    const service = getTranslationServiceDefinition(storagePath)
    const existing = await this.db
      .from(this.tableName)
      .where('service_name', SERVICE_NAMES.TRANSLATION)
      .first()

    if (!existing) {
      const now = new Date()
      await this.db.table(this.tableName).insert({
        ...service,
        created_at: now,
        updated_at: now,
      })
    }
  }

  async down() {
    await this.db.from(this.tableName).where('service_name', SERVICE_NAMES.TRANSLATION).delete()
  }
}
