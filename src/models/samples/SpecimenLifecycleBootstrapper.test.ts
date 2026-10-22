import { describe, expect, it, vi } from 'vitest';
import knex, { Knex } from 'knex';
import { bootstrapSpecimenLifecycleTables } from './SpecimenLifecycleBootstrapper';

/** Compile real MySQL DDL against an in-memory schema catalogue; never open a database connection. */
function database(options: { physicalTable?: boolean; failConstraintOnce?: boolean } = {}) {
     const compiler = knex({ client: 'mysql2' });
     const columns = new Map<string, Set<string>>();
     if (options.physicalTable !== false) columns.set('physical_samples', new Set(['id', 'status', 'quantity', 'unit']));
     const indexes = new Set<string>();
     const constraints = new Set<string>();
     const statements: string[] = [];
     let failConstraint = options.failConstraintOnce;
     const connection = vi.fn(() => { throw new Error('Schema upgrade must not read or overwrite existing specimen rows'); });

     async function change(method: 'createTable' | 'alterTable', tableName: string, callback: (table: Knex.TableBuilder) => void) {
          const newColumns: string[] = [], newIndexes: string[] = [], newConstraints: string[] = [];
          const query = compiler.schema[method](tableName, (builder) => {
               const proxy = new Proxy(builder, {
                    get(target, property: string) {
                         const original = target[property];
                         if (typeof original !== 'function') return original;
                         return (...args: any[]) => {
                              if (['bigIncrements', 'bigInteger', 'integer', 'string', 'decimal', 'datetime', 'text', 'boolean'].includes(property)) {
                                   newColumns.push(args[0]);
                              }
                              if (['index', 'unique'].includes(property)) newIndexes.push(`${tableName}.${args[1]}`);
                              if (property === 'foreign') newConstraints.push(`${tableName}.${args[1]}`);
                              return original.apply(target, args);
                         };
                    },
               });
               callback(proxy);
          });
          const compiled = query.toSQL().map(statement => statement.sql);
          if (failConstraint && newConstraints.length) {
               failConstraint = false;
               throw new Error('Interrupted DDL');
          }
          if (!columns.has(tableName)) columns.set(tableName, new Set());
          for (const column of newColumns) {
               if (columns.get(tableName).has(column)) throw new Error(`Duplicate column ${tableName}.${column}`);
               columns.get(tableName).add(column);
          }
          for (const index of newIndexes) {
               if (indexes.has(index)) throw new Error(`Duplicate index ${index}`);
               indexes.add(index);
          }
          for (const constraint of newConstraints) {
               if (constraints.has(constraint)) throw new Error(`Duplicate constraint ${constraint}`);
               constraints.add(constraint);
          }
          statements.push(...compiled);
     }

     Object.assign(connection, {
          schema: {
               hasTable: async (table: string) => columns.has(table),
               hasColumn: async (table: string, column: string) => columns.get(table)?.has(column) ?? false,
               createTable: vi.fn((table: string, callback: (builder: Knex.TableBuilder) => void) => change('createTable', table, callback)),
               alterTable: vi.fn((table: string, callback: (builder: Knex.TableBuilder) => void) => change('alterTable', table, callback)),
          },
          fn: compiler.fn,
          raw: vi.fn(async (sql: string, [table, name]: string[]) => {
               if (sql.includes('information_schema.STATISTICS')) return [indexes.has(`${table}.${name}`) ? [{ 1: 1 }] : []];
               if (sql.includes('information_schema.TABLE_CONSTRAINTS')) return [constraints.has(`${table}.${name}`) ? [{ 1: 1 }] : []];
               throw new Error(`Unexpected query: ${sql}`);
          }),
     });
     return { connection: connection as unknown as Knex, statements, columns, indexes, constraints, close: () => compiler.destroy() };
}

describe('specimen lifecycle tenant schema upgrade', () => {
     it('adds lifecycle storage to an existing installation without rewriting specimen data or acceptance status', async () => {
          const db = database();
          try {
               await bootstrapSpecimenLifecycleTables(db.connection);
               const sql = db.statements.join('\n');
               expect(sql).toContain('create table `specimen_storage_positions`');
               expect(sql).toContain('`freezer` varchar(100) not null');
               expect(sql).toContain('`rack` varchar(100) not null');
               expect(sql).toContain('`position` varchar(100) not null');
               expect(sql).toContain('`temperature_c` decimal(6, 2) null');
               expect(sql).toContain('`is_active` boolean not null default \'1\'');
               expect(sql).toContain('`created_by` int unsigned not null');
               expect(sql).toContain('add `storage_state` varchar(20) not null default \'available\'');
               expect(sql).toContain('add `remaining_quantity` decimal(10, 2) null');
               expect(sql).toContain('add `parent_sample_id` bigint unsigned null');
               expect(sql).toContain('add `storage_position_id` bigint unsigned null');
               expect(sql).toContain('add `retention_until` datetime null');
               expect(sql).toContain('add `disposed_at` datetime null');
               expect(sql).toContain('add `disposed_by` int unsigned null');
               expect(sql).toContain('add `disposal_method` varchar(120) null');
               expect(sql).toContain('add `disposal_reason` text null');
               expect(sql).toContain('add `disposal_witness_employeeid` int unsigned null');
               expect(sql).not.toMatch(/drop|modify|\bupdate\b(?! cascade)/i);
               expect(sql).not.toContain('add `status`');
               expect(db.connection).not.toHaveBeenCalled();
          } finally { await db.close(); }
     });

     it('enforces unique occupied positions and location labels, with restricted parent and storage deletion', async () => {
          const db = database();
          try {
               await bootstrapSpecimenLifecycleTables(db.connection);
               const sql = db.statements.join('\n');
               expect(sql).toContain('unique `uq_specimen_storage_location`(`freezer`, `rack`, `position`)');
               expect(sql).toContain('unique `uq_physical_sample_storage_position`(`storage_position_id`)');
               expect(sql).toContain('index `idx_physical_sample_parent`(`parent_sample_id`)');
               expect(sql).toContain('index `idx_physical_sample_retention`(`storage_state`, `retention_until`)');
               expect(sql).toContain('foreign key (`parent_sample_id`) references `physical_samples` (`id`) on update CASCADE on delete RESTRICT');
               expect(sql).toContain('foreign key (`storage_position_id`) references `specimen_storage_positions` (`id`) on update CASCADE on delete RESTRICT');
          } finally { await db.close(); }
     });

     it('is a no-op on repeated startup and shares concurrent upgrades on the same tenant connection', async () => {
          const db = database();
          try {
               await Promise.all([bootstrapSpecimenLifecycleTables(db.connection), bootstrapSpecimenLifecycleTables(db.connection)]);
               const originalStatements = [...db.statements];
               await bootstrapSpecimenLifecycleTables(db.connection);
               expect(db.statements).toEqual(originalStatements);
               expect(db.constraints.size).toBe(2);
               expect(db.indexes.size).toBe(4);
          } finally { await db.close(); }
     });

     it('resumes after interrupted DDL without duplicating existing columns or indexes', async () => {
          const db = database({ failConstraintOnce: true });
          try {
               await expect(bootstrapSpecimenLifecycleTables(db.connection)).rejects.toThrow('Interrupted DDL');
               expect(db.columns.get('physical_samples').has('disposal_witness_employeeid')).toBe(true);
               const statementsBeforeRetry = db.statements.length;
               await bootstrapSpecimenLifecycleTables(db.connection);
               expect(db.statements.slice(statementsBeforeRetry)).toHaveLength(2);
               expect(db.constraints.size).toBe(2);
          } finally { await db.close(); }
     });

     it('upgrades each tenant connection independently', async () => {
          const first = database(), second = database();
          try {
               await Promise.all([bootstrapSpecimenLifecycleTables(first.connection), bootstrapSpecimenLifecycleTables(second.connection)]);
               expect(first.statements).toEqual(second.statements);
               expect(first.columns.get('physical_samples').has('storage_state')).toBe(true);
               expect(second.columns.get('physical_samples').has('storage_state')).toBe(true);
          } finally { await Promise.all([first.close(), second.close()]); }
     });

     it('requires physical specimens to exist before adding lifecycle tables', async () => {
          const db = database({ physicalTable: false });
          try {
               await expect(bootstrapSpecimenLifecycleTables(db.connection)).rejects.toThrow('Physical sample tables must be bootstrapped');
               expect(db.statements).toEqual([]);
          } finally { await db.close(); }
     });
});
