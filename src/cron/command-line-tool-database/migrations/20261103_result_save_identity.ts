import type { Knex } from 'knex';

export async function assertResultSaveIdentities(db: Knex): Promise<void> {
    const duplicates = await db('test_results').select('ascensionid', 'testid', 'fieldid')
        .groupBy('ascensionid', 'testid', 'fieldid').havingRaw('COUNT(*) > 1').first();
    const unidentified = await db('test_results').where(function () {
        this.whereNull('ascensionid').orWhereNull('testid').orWhereNull('fieldid')
            .orWhere('ascensionid', '<=', 0).orWhere('testid', '<=', 0).orWhere('fieldid', '<=', 0);
    }).first();
    if (duplicates || unidentified) throw new Error(
        'Result identity migration blocked: duplicate or unidentified current parameters require reviewed, non-destructive repair. No rows were removed.');
}

/** Shared by tenant startup and migration runners. Never repair clinical rows automatically. */
export async function up(db: Knex): Promise<void> {
    await assertResultSaveIdentities(db);
    const [indexes] = await db.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', ['test_results', 'uq_result_current_parameter']);
    if (!indexes.length) await db.schema.alterTable('test_results', table => {
        table.unique(['ascensionid', 'testid', 'fieldid'], 'uq_result_current_parameter');
    });
    if (!(await db.schema.hasTable('lab_result_save_requests'))) await db.schema.createTable('lab_result_save_requests', table => {
        table.bigIncrements('id').primary();
        table.integer('ascensionid').unsigned().notNullable();
        table.specificType('request_id', 'varchar(80) CHARACTER SET ascii COLLATE ascii_bin').notNullable();
        table.integer('employeeid').unsigned().notNullable();
        table.string('request_hash', 64).notNullable();
        table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
        table.unique(['ascensionid', 'request_id'], 'uq_result_save_request');
    });
}

export async function down(): Promise<void> {
    // Retain retry receipts and uniqueness. Roll back application code, not clinical safety/history.
}
