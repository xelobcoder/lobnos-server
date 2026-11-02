import { Knex } from 'knex';

export async function ensurePharmacySourceModule(db: Knex): Promise<void> {
     if (!String(db.client.config.client).includes('mysql')) return;
     const column = await db('information_schema.COLUMNS').whereRaw('TABLE_SCHEMA = DATABASE()')
          .where({ TABLE_NAME: 'acc_journal_entries', COLUMN_NAME: 'source_module' }).select('COLUMN_TYPE as column_type').first();
     if (!column) throw new Error('Initialize the shared accounting journal schema before the pharmacy migration');
     const definition = String(column.column_type);
     if (/^(varchar|char)\(\d+\)$/i.test(definition)) return;
     if (!/^enum\('[A-Za-z0-9_-]+'(?:,'[A-Za-z0-9_-]+')*\)$/i.test(definition)) throw new Error('Review the shared source-module column definition before upgrading pharmacy accounting');
     const additions = ['manual', 'pharmacy'].filter(value => !definition.includes(`'${value}'`));
     if (additions.length) await db.raw(`ALTER TABLE acc_journal_entries MODIFY COLUMN source_module ${definition.slice(0, -1)},${additions.map(value => `'${value}'`).join(',')}) NOT NULL`);
}

export async function ensurePharmacyAttributionColumns(db: Knex): Promise<void> {
     if (await db.schema.hasTable('acc_journal_lines')) {
          for (const [name, length] of [['party_type', 30], ['party_ref', 64], ['party_name', 160], ['document_ref', 128]] as const) {
               if (!await db.schema.hasColumn('acc_journal_lines', name)) await db.schema.alterTable('acc_journal_lines', table => table.string(name, length).nullable());
          }
     }
     if (await db.schema.hasTable('pharmacy_journal_lines') && !await db.schema.hasColumn('pharmacy_journal_lines', 'document_ref')) {
          await db.schema.alterTable('pharmacy_journal_lines', table => table.string('document_ref', 128).nullable());
     }
}
