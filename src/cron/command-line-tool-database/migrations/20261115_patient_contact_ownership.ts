import type { Knex } from 'knex';

export async function up(db: Knex) {
     for (const [column, length] of [['contact_relationship', 32], ['backup_phone', 20], ['backup_contact_name', 150], ['backup_relationship', 32]] as const) {
          if (!await db.schema.hasColumn('new_patients', column)) {
               await db.schema.alterTable('new_patients', table => table.string(column, length).nullable());
          }
     }
}
