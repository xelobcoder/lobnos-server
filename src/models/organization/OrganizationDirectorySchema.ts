import type { Knex } from 'knex';
export async function ensureOrganizationDirectorySchema(db: Knex) {
    if (!(await db.schema.hasTable('organization_directory_lock'))) {
        await db.schema.createTable('organization_directory_lock', table => { table.integer('id').primary(); });
    }
    await db('organization_directory_lock').insert({ id: 1 }).onConflict('id').ignore();
}
