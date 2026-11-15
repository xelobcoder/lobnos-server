import knex, { type Knex } from 'knex';
import { expect, it } from 'vitest';
import { ensureAccountingPlanningSchema } from './AccountingPlanningSchema';

it('generates valid MySQL names for new accounting planning indexes', async () => {
     const mysql = knex({ client: 'mysql2' });
     try {
          const statements: string[] = [];
          const schema = {
               hasTable: async () => false,
               createTable(name: string, configure: (table: Knex.CreateTableBuilder) => void) {
                    statements.push(...mysql.schema.createTable(name, configure).toSQL().map(query => query.sql));
               },
          };
          await ensureAccountingPlanningSchema({ schema, fn: mysql.fn } as unknown as Knex);
          const indexNames = statements.flatMap(sql =>
               [...sql.matchAll(/(?:unique|add index) `([^`]+)`/gi)].map(match => match[1]),
          );
          expect(indexNames).toHaveLength(6);
          expect(indexNames.filter(name => name.length > 64)).toEqual([]);
     } finally {
          await mysql.destroy();
     }
});
