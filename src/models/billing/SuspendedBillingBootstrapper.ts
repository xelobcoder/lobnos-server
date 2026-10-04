import KnexConnection from '../../database/KnexConnections';

export async function bootstrapSuspendedBillingTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     if (await connection.schema.hasTable('suspended_billing_transactions')) {
          const patientColumn = await connection('suspended_billing_transactions').columnInfo('patientid');
          const patientIsNotNullable = patientColumn?.nullable === false || String(patientColumn?.nullable).toLowerCase() === 'no';
          if (patientIsNotNullable) {
               await connection.schema.alterTable('suspended_billing_transactions', (table) => {
                    table.integer('patientid').unsigned().nullable().alter();
               });
          }
          return;
     }

     await connection.schema.createTable('suspended_billing_transactions', (table) => {
          table.bigIncrements('id').primary().unsigned();
          table.integer('patientid').unsigned().nullable();
          table.integer('branchid').unsigned().notNullable();
          table.integer('billing_source').unsigned().notNullable();
          table.string('entity_type', 32).nullable();
          table.integer('entity_id').unsigned().nullable();
          table.json('draft_data').notNullable();
          table.text('notes').nullable();
          table.enum('status', ['suspended', 'finalized', 'cancelled']).notNullable().defaultTo('suspended');
          table.integer('created_by').unsigned().notNullable();
          table.integer('updated_by').unsigned().notNullable();
          table.integer('finalized_billingid').unsigned().nullable();
          table.integer('finalized_by').unsigned().nullable();
          table.datetime('finalized_at').nullable();
          table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
          table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
          table.index(['branchid', 'status', 'updated_at'], 'idx_suspended_billing_branch_status');
          table.index(['patientid', 'status'], 'idx_suspended_billing_patient_status');
          table.unique(['finalized_billingid'], 'uq_suspended_billing_finalized_billing');
     });
}
