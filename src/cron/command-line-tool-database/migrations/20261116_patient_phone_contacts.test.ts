import { describe, expect, it, vi } from 'vitest';
import type { Knex } from 'knex';
import { up } from './20261116_patient_phone_contacts';

function createDb(options: { failFirstBackfill?: boolean } = {}) {
     const transactionStatements: string[] = [];
     let migrationApplied = false;
     let shouldFailBackfill = options.failFirstBackfill === true;
     const trx = {
          raw: vi.fn(async (sql: string) => {
               transactionStatements.push(sql);
               if (sql.startsWith('INSERT IGNORE INTO app_startup_migrations')) {
                    if (migrationApplied) return [{ affectedRows: 0 }, []];
                    migrationApplied = true;
                    return [{ affectedRows: 1 }, []];
               }
               if (shouldFailBackfill && sql.includes('FROM new_patients')) {
                    shouldFailBackfill = false;
                    throw new Error('Backfill failed');
               }
               return [[], []];
          }),
     };
     const db = {
          schema: {
               hasTable: vi.fn(async () => true),
          },
          raw: vi.fn(async () => [[], []]),
          transaction: vi.fn(async (callback: (transaction: typeof trx) => Promise<void>) => {
               const wasApplied = migrationApplied;
               try {
                    return await callback(trx);
               } catch (error) {
                    migrationApplied = wasApplied;
                    throw error;
               }
          }),
     } as unknown as Knex;

     return { db, trx, transactionStatements };
}

describe('patient phone contacts startup migration', () => {
     it('backfills legacy contacts once and skips the scans on later startups', async () => {
          const { db, trx, transactionStatements } = createDb();

          await up(db);
          await up(db);

          expect(db.transaction).toHaveBeenCalledTimes(2);
          expect(trx.raw).toHaveBeenCalledTimes(4);
          expect(transactionStatements.filter(sql => sql.includes('FROM new_patients'))).toHaveLength(2);
     });

     it('retries the backfill after a failed transaction', async () => {
          const { db, transactionStatements } = createDb({ failFirstBackfill: true });

          await expect(up(db)).rejects.toThrow('Backfill failed');
          await up(db);
          await up(db);

          expect(transactionStatements.filter(sql => sql.includes('FROM new_patients'))).toHaveLength(3);
     });
});
