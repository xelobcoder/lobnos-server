import { describe, expect, it, vi } from 'vitest';
import knex, { Knex } from 'knex';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { ensurePharmacyAttributionColumns, ensurePharmacySourceModule } from './pharmacyAttributionSchema';

describe('additive pharmacy accounting schema', () => {
     it('preserves posted rows and upgrades attribution columns idempotently', async () => {
          const fixture = accountingSqlDatabase();
          try {
               fixture.native.exec('CREATE TABLE acc_journal_lines(id INTEGER PRIMARY KEY,amount NUMERIC); CREATE TABLE pharmacy_journal_lines(id INTEGER PRIMARY KEY,debit NUMERIC); INSERT INTO acc_journal_lines VALUES (1,123.45); INSERT INTO pharmacy_journal_lines VALUES (1,123.45);');
               await ensurePharmacyAttributionColumns(fixture.db);
               await ensurePharmacyAttributionColumns(fixture.db);
               expect(await fixture.db('acc_journal_lines').first()).toMatchObject({ amount: 123.45, party_ref: null, document_ref: null });
               expect(await fixture.db('pharmacy_journal_lines').first()).toMatchObject({ debit: 123.45, document_ref: null });
          } finally { await fixture.db.destroy(); }
     });
     it.each([
          ["enum('billing','custom_module')", "enum('billing','custom_module','manual','pharmacy')"],
          ["enum('billing','manual','pharmacy')", null],
          ['varchar(30)', null],
     ])('extends only missing source values for %s without replacing existing modules', async (definition, expected) => {
          const db = knex({ client: 'mysql2' }), queries: string[] = [];
          vi.spyOn(db.client, 'runner').mockImplementation(((builder: Knex.QueryBuilder | Knex.Raw) => ({
               run: async () => {
                    const query = builder.toSQL();
                    if (Array.isArray(query)) throw new Error('Unexpected schema query batch');
                    queries.push(query.sql);
                    return query.method === 'first' ? { column_type: definition } : [];
               },
          })) as never);
          try {
               await ensurePharmacySourceModule(db);
               const alters = queries.filter(query => query.startsWith('ALTER TABLE'));
               if (expected) { expect(alters).toHaveLength(1); expect(alters[0]).toContain(expected); }
               else expect(alters).toEqual([]);
          } finally { await db.destroy(); }
     });
});
