import { it, expect, vi } from 'vitest';
import { Knex } from 'knex';
import { verifyLocalForeignKeys, migrateLocalInstallation } from './standalonePipeline';

const key = { TABLE_NAME: 'testconditiondefinitions', COLUMN_NAME: 'createdBy', CONSTRAINT_NAME: 'author',
     REFERENCED_TABLE_SCHEMA: 'primelabsys', REFERENCED_TABLE_NAME: 'roles', REFERENCED_COLUMN_NAME: 'employeeid' };
it('checks seeded foreign keys including Windows-normalized schemas using bound identifiers', async () => {
     const raw = vi.fn().mockResolvedValueOnce([[key]]).mockResolvedValueOnce([[]]);
     await verifyLocalForeignKeys({ raw } as unknown as Knex, 'Primelabsys');
     expect(raw.mock.calls[1][0]).toContain('LEFT JOIN ??.??');
     expect(raw.mock.calls[1][1]).toContain('roles');
});
it('refuses dangling catalog rows and cross-database/invalid identifier dependencies', async () => {
     const raw = vi.fn().mockResolvedValueOnce([[key]]).mockResolvedValueOnce([[{ exists: 1 }]]);
     await expect(verifyLocalForeignKeys({ raw } as unknown as Knex, 'Primelabsys')).rejects.toThrow('unresolved foreign keys');
     for (const bad of [{ ...key, REFERENCED_TABLE_SCHEMA: 'another_tenant' }, { ...key, COLUMN_NAME: 'id; DROP TABLE' }]) {
          const raw = vi.fn().mockResolvedValue([[bad]]);
          await expect(verifyLocalForeignKeys({ raw } as unknown as Knex, 'Primelabsys')).rejects.toThrow();
          expect(raw).toHaveBeenCalledOnce();
     }
});
it('uses a private migration checkpoint and up-only guarded migrations, propagating failures', async () => {
     const latest = vi.fn().mockResolvedValue(undefined);
     await migrateLocalInstallation({ migrate: { latest } } as unknown as Knex);
     expect(latest.mock.calls[0][0]).toMatchObject({ tableName: 'pls_local_migrations', disableTransactions: true, loadExtensions: ['.js'] });
     latest.mockRejectedValue(new Error('fixture migration failure'));
     await expect(migrateLocalInstallation({ migrate: { latest } } as unknown as Knex)).rejects.toThrow('fixture migration failure');
});
