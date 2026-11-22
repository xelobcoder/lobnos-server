import type { Knex } from 'knex';

export async function isDatabaseEmpty(db: Knex): Promise<boolean> {
     const row = await db('information_schema.tables')
          .whereRaw('table_schema = DATABASE()')
          .count({ tableCount: 'table_name' })
          .first();
     const count = Number(row?.tableCount);
     if (!Number.isSafeInteger(count) || count < 0) {
          throw new Error('Unable to determine whether the tenant database is empty');
     }
     return count === 0;
}
