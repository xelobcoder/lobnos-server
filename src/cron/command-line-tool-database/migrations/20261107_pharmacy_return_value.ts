import { Knex } from 'knex';
export async function up(db: Knex): Promise<void> {
    if (await db.schema.hasTable('pharmacy_quarantine_lots') && !await db.schema.hasColumn('pharmacy_quarantine_lots', 'restoration_value'))
        await db.schema.alterTable('pharmacy_quarantine_lots', t => t.decimal('restoration_value', 14, 2).nullable());
}
export async function down(_db: Knex): Promise<void> { /* Preserve historic return cost snapshots. */ }
