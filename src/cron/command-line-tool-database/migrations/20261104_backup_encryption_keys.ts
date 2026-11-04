import { Knex } from 'knex';

export async function up(db: Knex): Promise<void> {
     if (!(await db.schema.hasTable('encryption_keys'))) {
          try {
               await db.schema.createTable('encryption_keys', table => {
                    table.increments('id').primary();
                    table.string('key_id', 100).notNullable().unique();
                    table.text('encrypted_key').notNullable();
                    table.string('algorithm', 50).notNullable();
                    table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
                    table.dateTime('expires_at').nullable();
                    table.boolean('is_active').notNullable().defaultTo(true);
                    table.dateTime('deactivated_at').nullable();
                    table.string('created_by', 100).nullable();
               });
          } catch (error: any) {
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
     }
     if (await db.schema.hasTable('backup_logs') && !(await db.schema.hasColumn('backup_logs', 'encryption_key_id'))) {
          try {
               await db.schema.alterTable('backup_logs', table => table.string('encryption_key_id', 100).nullable());
          } catch (error: any) {
               if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
          }
     }
}

// Key history is retained for restoring older backups even after an application rollback.
export async function down(): Promise<void> {}
