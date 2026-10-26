import KnexConnection from '../../database/KnexConnections';
export const qcDefaults = { warningLimit: 2, actionLimit: 3, revision: 0 };
export function validateQcDefaults(input: any) {
    const { warningLimit, actionLimit, revision } = input || {};
    if (typeof warningLimit !== 'number' || typeof actionLimit !== 'number' || !Number.isFinite(warningLimit) || !Number.isFinite(actionLimit) || warningLimit <= 0 || actionLimit <= warningLimit || actionLimit > 100 || !Number.isSafeInteger(revision) || revision < 0) throw new Error('Use positive SD limits with action greater than warning, and reload the settings revision.');
    if ([warningLimit, actionLimit].some(value => Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001)) throw new Error('Use no more than four decimal places for SD limits.');
    return { warningLimit, actionLimit, revision };
}
export class QCSettingsRepository {
    constructor(private tenantId: number) {}
    private async connection() {
        const db = await KnexConnection(this.tenantId);
        if (!await db.schema.hasTable('qc_configuration')) {
            try { await db.schema.createTable('qc_configuration', table => {
                table.integer('id').primary(); table.decimal('warningLimit', 10, 4).notNullable(); table.decimal('actionLimit', 10, 4).notNullable();
                table.integer('revision').notNullable().defaultTo(0); table.integer('updatedby').nullable(); table.timestamp('updatedAt').nullable();
            }); } catch (error) { if (!await db.schema.hasTable('qc_configuration')) throw error; }
        }
        return db;
    }
    async get() {
        const db = await this.connection(), row = await db('qc_configuration').where({ id: 1 }).first();
        return row ? { warningLimit: Number(row.warningLimit), actionLimit: Number(row.actionLimit), revision: Number(row.revision), updatedAt: row.updatedAt } : { ...qcDefaults };
    }
    async save(input: any, employeeid: number) {
        const values = validateQcDefaults(input), db = await this.connection();
        await db.transaction(async trx => {
            await trx('qc_configuration').insert({ id: 1, ...qcDefaults }).onConflict('id').ignore();
            const row = await trx('qc_configuration').where({ id: 1 }).forUpdate().first();
            if (Number(row.revision) !== values.revision) throw new Error('QC settings changed. Reload before saving.');
            await trx('qc_configuration').where({ id: 1 }).update({ ...values, revision: values.revision + 1, updatedby: employeeid, updatedAt: new Date() });
        });
        return this.get();
    }
}
