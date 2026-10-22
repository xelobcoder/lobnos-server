import { Knex } from 'knex';

const SAMPLES = 'physical_samples';
const POSITIONS = 'specimen_storage_positions';
const upgradesInProgress = new WeakMap<Knex, Promise<void>>();

async function ensureIndex(connection: Knex, tableName: string, columns: string[], name: string, unique = false): Promise<void> {
     const [rows] = await connection.raw(
          'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
          [tableName, name]
     );
     if (Array.isArray(rows) && rows.length) return;
     await connection.schema.alterTable(tableName, (table) => {
          if (unique) table.unique(columns, name);
          else table.index(columns, name);
     });
}

async function ensureForeignKey(connection: Knex, column: string, referencedTable: string, name: string): Promise<void> {
     const [rows] = await connection.raw(
          'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = ? LIMIT 1',
          [SAMPLES, name, 'FOREIGN KEY']
     );
     if (Array.isArray(rows) && rows.length) return;
     await connection.schema.alterTable(SAMPLES, (table) => {
          table.foreign(column, name).references('id').inTable(referencedTable).onDelete('RESTRICT').onUpdate('CASCADE');
     });
}

async function upgrade(connection: Knex): Promise<void> {
     if (!(await connection.schema.hasTable(SAMPLES))) {
          throw new Error('Physical sample tables must be bootstrapped before specimen lifecycle storage');
     }

     if (!(await connection.schema.hasTable(POSITIONS))) {
          await connection.schema.createTable(POSITIONS, (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.string('freezer', 100).notNullable();
               table.string('rack', 100).notNullable();
               table.string('position', 100).notNullable();
               table.decimal('temperature_c', 6, 2).nullable();
               table.text('notes').nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().notNullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['freezer', 'rack', 'position'], 'uq_specimen_storage_location');
          });
     }

     // Each additive operation can be retried after an interrupted MySQL DDL upgrade.
     // Acceptance/collection status remains independent of storage and disposal state.
     const columns: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
          ['storage_state', table => { table.string('storage_state', 20).notNullable().defaultTo('available'); }],
          ['parent_sample_id', table => { table.bigInteger('parent_sample_id').unsigned().nullable(); }],
          ['remaining_quantity', table => { table.decimal('remaining_quantity', 10, 2).nullable(); }],
          ['storage_position_id', table => { table.bigInteger('storage_position_id').unsigned().nullable(); }],
          ['retention_until', table => { table.datetime('retention_until').nullable(); }],
          ['disposed_at', table => { table.datetime('disposed_at').nullable(); }],
          ['disposed_by', table => { table.integer('disposed_by').unsigned().nullable(); }],
          ['disposal_method', table => { table.string('disposal_method', 120).nullable(); }],
          ['disposal_reason', table => { table.text('disposal_reason').nullable(); }],
          ['disposal_witness_employeeid', table => { table.integer('disposal_witness_employeeid').unsigned().nullable(); }],
     ];
     for (const [name, addColumn] of columns) {
          if (!(await connection.schema.hasColumn(SAMPLES, name))) {
               await connection.schema.alterTable(SAMPLES, addColumn);
          }
     }

     await ensureIndex(connection, POSITIONS, ['freezer', 'rack', 'position'], 'uq_specimen_storage_location', true);
     await ensureIndex(connection, SAMPLES, ['parent_sample_id'], 'idx_physical_sample_parent');
     await ensureIndex(connection, SAMPLES, ['storage_state', 'retention_until'], 'idx_physical_sample_retention');
     // MySQL allows multiple NULL values, while an occupied position holds exactly one specimen.
     await ensureIndex(connection, SAMPLES, ['storage_position_id'], 'uq_physical_sample_storage_position', true);
     await ensureForeignKey(connection, 'parent_sample_id', SAMPLES, 'fk_physical_sample_parent');
     await ensureForeignKey(connection, 'storage_position_id', POSITIONS, 'fk_physical_sample_storage_position');
}

/** Additive per-tenant upgrade. Quantity is resolved lazily; existing sample records are never rewritten. */
export async function bootstrapSpecimenLifecycleTables(connection: Knex): Promise<void> {
     let pending = upgradesInProgress.get(connection);
     if (!pending) {
          pending = upgrade(connection).finally(() => { upgradesInProgress.delete(connection); });
          upgradesInProgress.set(connection, pending);
     }
     await pending;
}
