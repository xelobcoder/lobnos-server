import KnexConnection from '../../database/KnexConnections';

export async function bootstrapExpenseWorkflow(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     if (!(await connection.schema.hasTable('expensesrecord'))) return;

     const amountColumn = await connection('expensesrecord').columnInfo('amount');
     if (!String(amountColumn?.type || '').toLowerCase().includes('decimal')) {
          await connection.schema.alterTable('expensesrecord', (table) => {
               table.decimal('amount', 14, 2).unsigned().notNullable().alter();
          });
     }

     const addedWorkflowStatus = !(await connection.schema.hasColumn('expensesrecord', 'workflow_status'));
     if (addedWorkflowStatus) {
          await connection.schema.alterTable('expensesrecord', (table) => {
               table.string('workflow_status', 32).notNullable().defaultTo('pending_approval');
               table.integer('workflow_version').unsigned().notNullable().defaultTo(1);
               table.integer('submitted_by').unsigned().nullable();
               table.datetime('submitted_at').nullable();
               table.integer('rejected_by').unsigned().nullable();
               table.datetime('rejected_at').nullable();
               table.integer('cancelled_by').unsigned().nullable();
               table.datetime('cancelled_at').nullable();
               table.text('cancellation_reason').nullable();
               table.integer('reversed_by').unsigned().nullable();
               table.datetime('reversed_at').nullable();
               table.text('reversal_reason').nullable();
               table.index(['workflow_status', 'branchid'], 'idx_expense_workflow_branch');
          });

          await connection('expensesrecord').where({ approved: 1 }).update({ workflow_status: 'approved' });
          await connection('expensesrecord').where({ approved: 2 }).update({ workflow_status: 'rejected' });
          await connection('expensesrecord')
               .whereExists(function () {
                    this.select(connection.raw('1'))
                         .from('expense_payments as payment')
                         .whereRaw('payment.expense_id = expensesrecord.id')
                         .where('payment.status', 'Paid')
                         .where('payment.is_reversed', false);
               })
               .update({ workflow_status: 'paid' });
     }

     if (!(await connection.schema.hasColumn('expensesrecord', 'paid_by'))) {
          await connection.schema.alterTable('expensesrecord', (table) => {
               table.integer('paid_by').unsigned().nullable();
               table.datetime('paid_at').nullable();
          });
     }

     if (!(await connection.schema.hasTable('expense_control_settings'))) {
          await connection.schema.createTable('expense_control_settings', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('branchid').unsigned().nullable();
               table.boolean('allow_self_approval').notNullable().defaultTo(false);
               table.boolean('require_separate_payer').notNullable().defaultTo(true);
               table.boolean('allow_approval_override').notNullable().defaultTo(false);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['branchid'], 'uq_expense_control_branch');
          });
     }

     if (!(await connection.schema.hasTable('expense_approval_actions'))) {
          await connection.schema.createTable('expense_approval_actions', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.integer('expense_id').unsigned().notNullable();
               table.string('action', 32).notNullable();
               table.string('from_status', 32).notNullable();
               table.string('to_status', 32).notNullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.integer('actor_branchid').unsigned().nullable();
               table.decimal('amount', 14, 2).notNullable();
               table.text('reason').nullable();
               table.integer('authority_delegation_id').unsigned().nullable();
               table.string('authority_source', 20).notNullable();
               table.integer('workflow_version').unsigned().notNullable();
               table.json('metadata').nullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['expense_id', 'created_at'], 'idx_expense_action_history');
               table.index(['actor_employeeid', 'created_at'], 'idx_expense_action_actor');
          });
     }

     if (!(await connection.schema.hasTable('payment_accounts'))) {
          await connection.schema.createTable('payment_accounts', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 120).notNullable();
               table.enum('account_type', ['cash', 'bank', 'mobile_money', 'other']).notNullable();
               table.string('currency', 3).notNullable().defaultTo('GHS');
               table.integer('branchid').unsigned().nullable();
               table.string('gl_account_code', 20).notNullable();
               table.integer('bank_account_id').unsigned().nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.integer('created_by').unsigned().nullable();
               table.integer('updated_by').unsigned().nullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['name', 'branchid'], 'uq_payment_account_name_branch');
               table.index(['branchid', 'is_active'], 'idx_payment_account_branch');
          });

     }

     const mainCash = await connection('payment_accounts').where({ name: 'Main Cash', branchid: null }).first();
     if (!mainCash) await connection('payment_accounts').insert({
          name: 'Main Cash',
          account_type: 'cash',
          currency: 'GHS',
          branchid: null,
          gl_account_code: 'acc-1000',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
     });

     if (!(await connection.schema.hasTable('payment_account_users'))) {
          await connection.schema.createTable('payment_account_users', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('payment_account_id').unsigned().notNullable();
               table.integer('employeeid').unsigned().notNullable();
               table.boolean('can_pay').notNullable().defaultTo(false);
               table.boolean('can_view').notNullable().defaultTo(true);
               table.boolean('can_reconcile').notNullable().defaultTo(false);
               table.integer('granted_by').unsigned().nullable();
               table.datetime('granted_at').notNullable().defaultTo(connection.fn.now());
               table.integer('revoked_by').unsigned().nullable();
               table.datetime('revoked_at').nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.unique(['payment_account_id', 'employeeid'], 'uq_payment_account_user');
               table.index(['employeeid', 'can_pay', 'is_active'], 'idx_payment_account_user_pay');
          });
     }

     if (await connection.schema.hasTable('expense_payments')) {
          if (!(await connection.schema.hasColumn('expense_payments', 'payment_account_id'))) {
               await connection.schema.alterTable('expense_payments', (table) => {
                    table.integer('payment_account_id').unsigned().nullable();
                    table.string('payment_reference', 120).nullable();
                    table.string('currency', 3).notNullable().defaultTo('GHS');
                    table.integer('recorded_by').unsigned().nullable();
                    table.integer('executed_by').unsigned().nullable();
                    table.integer('branchid').unsigned().nullable();
                    table.string('supporting_document', 255).nullable();
                    table.string('idempotency_key', 120).nullable().unique('uq_expense_payment_idempotency');
                    table.index(['payment_account_id', 'payment_date'], 'idx_expense_payment_account_date');
               });
          }
     }
}
