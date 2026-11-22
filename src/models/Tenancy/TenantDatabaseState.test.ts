import { describe, expect, it, vi } from 'vitest';
import { isDatabaseEmpty } from './TenantDatabaseState';

function databaseWithTableCount(tableCount: unknown) {
     const query: any = {
          whereRaw: vi.fn(() => query),
          count: vi.fn(() => query),
          first: vi.fn().mockResolvedValue({ tableCount }),
     };
     return vi.fn(() => query);
}

describe('tenant database state', () => {
     it('detects an empty schema', async () => {
          await expect(isDatabaseEmpty(databaseWithTableCount('0') as any)).resolves.toBe(true);
     });

     it('treats a database with any table or view as non-empty', async () => {
          await expect(isDatabaseEmpty(databaseWithTableCount(1) as any)).resolves.toBe(false);
     });

     it('fails explicitly when the table count cannot be read', async () => {
          await expect(isDatabaseEmpty(databaseWithTableCount(undefined) as any))
               .rejects.toThrow('Unable to determine');
     });
});
