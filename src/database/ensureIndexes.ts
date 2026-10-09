import { Knex } from 'knex';

interface IndexDefinition {
     name: string;
     columns: string[];
     unique?: boolean;
}

export async function ensureIndexes(db: Knex, tableName: string, definitions: IndexDefinition[], obsolete: string[] = []): Promise<void> {
     const [rows] = await db.raw<[Array<{ Key_name: string; Column_name: string; Seq_in_index: number; Non_unique: number }>, unknown]>(
          'SHOW INDEX FROM ??', [tableName],
     );
     for (const definition of definitions) {
          const existing = rows.filter(row => row.Key_name === definition.name).sort((a, b) => a.Seq_in_index - b.Seq_in_index);
          if (existing.length) {
               if (existing.map(row => row.Column_name).join(',') !== definition.columns.join(',') ||
                    (Number(existing[0].Non_unique) === 0) !== Boolean(definition.unique)) {
                    throw new Error(`Unexpected index definition: ${tableName}.${definition.name}`);
               }
               continue;
          }
          await db.schema.alterTable(tableName, table => {
               if (definition.unique) table.unique(definition.columns, { indexName: definition.name });
               else table.index(definition.columns, definition.name);
          });
     }
     // Install the replacement constraint before removing a legacy one.
     for (const name of obsolete) {
          if (rows.some(row => row.Key_name === name)) await db.raw('ALTER TABLE ?? DROP INDEX ??', [tableName, name]);
     }
}
