import { columnDefinition } from './LegacySchema';
import type { Knex } from 'knex';

/** Archive a retired structure without overwriting a previous migration's evidence. */
export async function archiveLegacyTable(db: Knex, source: string): Promise<void> {
    if (!await db.schema.hasTable(source)) return;
    const archive = `legacy_${source}`;
    if (await db.schema.hasTable(archive)) throw new Error(`Cannot retire ${source}: ${archive} already exists. Review both tables before continuing.`);
    await db.schema.renameTable(source, archive);
}

/** Preserve original refund evidence before normalizing or retiring witness columns. */
export async function archiveRefundWitnesses(db: Knex): Promise<void> {
    const source = 'dbobillingrefundtable', archive = 'legacy_refund_witnesses';
    await db.raw('CREATE TABLE IF NOT EXISTS ?? LIKE ??', [archive, source]);
    const sourceColumns = await db(source).columnInfo();
    const archiveColumns = await db(archive).columnInfo();
    const added = Object.keys(sourceColumns).filter(column => !Object.prototype.hasOwnProperty.call(archiveColumns, column));
    if (added.length) {
        const [rows] = await db.raw('SHOW CREATE TABLE ??', [source]);
        for (const column of added) {
            await db.raw(`ALTER TABLE ?? ADD COLUMN ${columnDefinition(rows[0]['Create Table'], column)}`, [archive]);
        }
    }
    const columns = Object.keys(sourceColumns);
    await db.raw('INSERT IGNORE INTO ?? (??) SELECT ?? FROM ??', [archive, columns, columns, source]);
    // Fill only evidence columns that this attempt added to a partial archive.
    for (const column of added) {
        await db.raw('UPDATE ?? a JOIN ?? s ON a.refundid = s.refundid SET a.?? = s.??', [archive, source, column, column]);
    }
    const missing = await db({ source }).leftJoin({ archive }, 'source.refundid', 'archive.refundid')
        .whereNull('archive.refundid').first('source.refundid');
    if (missing) throw new Error('Refund evidence archive is incomplete; witness columns were retained');
}
