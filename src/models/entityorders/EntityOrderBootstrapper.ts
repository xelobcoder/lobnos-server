import KnexConnection from '../../database/KnexConnections';

/**
 * Entity Orders module.
 *
 * Holds laboratory orders created by a referring clinician or an organization
 * (the "clinician billing strategy" flow). Orders are drafted against a pricing
 * snapshot resolved from the entity's billing strategy (or general pricing when
 * the entity has none), then reviewed by the center. Only on CONVERSION does the
 * module create real billing + dboservices rows through the shared billing engine.
 */
export async function bootstrapEntityOrderTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!await connection.schema.hasTable('entity_orders')) {
          await connection.schema.createTable('entity_orders', (table) => {
               table.increments('id').primary();
               table.integer('patient_id').unsigned().notNullable();
               table.integer('consultation_id').unsigned().nullable();
               table.integer('ordered_by_employee_id').unsigned().notNullable();
               table.enum('entity_type', ['clinician', 'organization', 'general']).notNullable().defaultTo('general');
               table.integer('entity_id').unsigned().nullable();
               table.integer('billing_source').unsigned().notNullable().defaultTo(1); // 1=general,2=organization,6=clinician
               table.integer('strategy_id').unsigned().nullable();
               table.enum('status', ['DRAFT', 'PENDING', 'ON_HOLD', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED']).notNullable().defaultTo('DRAFT');
               table.integer('revision').unsigned().notNullable().defaultTo(1);
               table.integer('billing_id').unsigned().nullable();
               table.integer('decided_by').unsigned().nullable();
               table.timestamp('decided_at').nullable();
               table.text('decision_reason').nullable();
               table.integer('converted_by').unsigned().nullable();
               table.timestamp('converted_at').nullable();
               table.enum('sample_location', ['center', 'referrer']).nullable().defaultTo('center');
               table.text('notes').nullable();
               table.integer('branch_id').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['patient_id', 'status'], 'idx_entity_orders_patient');
               table.index(['entity_type', 'entity_id'], 'idx_entity_orders_entity');
               table.index(['status'], 'idx_entity_orders_status');
          });
     } else if (!await connection.schema.hasColumn('entity_orders', 'sample_location')) {
          await connection.schema.alterTable('entity_orders', (table) => {
               table.enum('sample_location', ['center', 'referrer']).nullable().defaultTo('center');
          });
     }

     if (!await connection.schema.hasTable('entity_order_lines')) {
          await connection.schema.createTable('entity_order_lines', (table) => {
               table.increments('id').primary();
               table.integer('order_id').unsigned().notNullable();
               table.integer('test_id').unsigned().notNullable();
               table.string('test_name', 255).notNullable();
               table.decimal('unit_price', 14, 2).notNullable();          // resolved (strategy or general) snapshot
               table.integer('strategy_priced').notNullable().defaultTo(0); // 1 when price came from entity strategy
               table.integer('quantity').unsigned().notNullable().defaultTo(1);
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['order_id'], 'idx_entity_order_lines_order');
          });
     }

     if (!await connection.schema.hasTable('entity_order_decisions')) {
          await connection.schema.createTable('entity_order_decisions', (table) => {
               table.increments('id').primary();
               table.integer('order_id').unsigned().notNullable();
               table.integer('revision').unsigned().notNullable();
               table.enum('action', ['submit', 'approve', 'hold', 'reject', 'convert', 'cancel', 'edit']).notNullable();
               table.text('reason').nullable();
               table.integer('actor_id').unsigned().notNullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['order_id', 'revision'], 'idx_entity_order_decisions_order');
          });
     }
}
