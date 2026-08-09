import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'chat_sessions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('owner_key', 64).nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('owner_key')
    })
  }
}
