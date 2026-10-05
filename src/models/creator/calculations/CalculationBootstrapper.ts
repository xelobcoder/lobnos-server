import KnexConnection from '../../../database/KnexConnections';

export async function bootstrapCalculationAndQcTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     for (const tableName of ['test_results', 'test_results_audit_log']) {
          if (await connection.schema.hasTable(tableName) && await connection.schema.hasColumn(tableName, 'entrymode')) {
               await connection.schema.alterTable(tableName, (table) => {
                    table.string('entrymode', 20).nullable().defaultTo('manual').alter();
               });
          }
     }

     if (await connection.schema.hasTable('test_panels') && !(await connection.schema.hasColumn('test_panels', 'requires_qc'))) {
          await connection.schema.alterTable('test_panels', (table) => {
               table.boolean('requires_qc').notNullable().defaultTo(false);
          });
     }

     if (!(await connection.schema.hasTable('calculated_parameter_formulas'))) {
          await connection.schema.createTable('calculated_parameter_formulas', (table) => {
               table.increments('id').primary();
               table.integer('testid').unsigned().notNullable();
               table.integer('output_field_id').unsigned().notNullable();
               table.text('expression').notNullable();
               table.json('input_parameters').notNullable();
               table.string('unit', 64).nullable();
               table.integer('decimal_precision').unsigned().notNullable().defaultTo(2);
               table.json('conditions').nullable();
               table.integer('version').unsigned().notNullable();
               table.date('effective_from').notNullable();
               table.date('effective_to').nullable();
               table.boolean('active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['testid', 'output_field_id', 'version'], 'uq_calculated_formula_version');
               table.index(['testid', 'output_field_id', 'active'], 'idx_calculated_formula_active');
          });
     }

     if (!(await connection.schema.hasTable('calculated_parameter_audit'))) {
          await connection.schema.createTable('calculated_parameter_audit', (table) => {
               table.increments('id').primary();
               table.integer('formula_id').unsigned().notNullable();
               table.integer('formula_version').unsigned().notNullable();
               table.integer('testid').unsigned().notNullable();
               table.integer('fieldid').unsigned().notNullable();
               table.integer('billingid').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.integer('ascensionid').unsigned().notNullable();
               table.string('result_value', 255).notNullable();
               table.json('input_values').notNullable();
               table.integer('employeeid').unsigned().nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['ascensionid', 'testid', 'fieldid'], 'idx_calculated_result_audit');
          });
     }

     if (!(await connection.schema.hasTable('qc_session_review_audit'))) {
          await connection.schema.createTable('qc_session_review_audit', (table) => {
               table.increments('id').primary();
               table.string('session_id', 36).notNullable();
               table.integer('testid').unsigned().notNullable();
               table.date('working_date').notNullable();
               table.enum('decision', ['accepted', 'bypassed']).notNullable();
               table.text('reason').nullable();
               table.integer('employeeid').unsigned().notNullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['testid', 'working_date', 'decision'], 'idx_qc_daily_acceptance');
               table.index(['session_id'], 'idx_qc_review_session');
          });
     }
}