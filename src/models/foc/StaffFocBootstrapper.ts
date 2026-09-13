import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';

export async function bootstrapStaffFocTables(tenantId = 1): Promise<void> {
     try {
          const connection = await KnexConnection(tenantId);

          // 1. staff_foc_policy
          if (!(await connection.schema.hasTable('staff_foc_policy'))) {
               await connection.schema.createTable('staff_foc_policy', (table) => {
                    table.increments('id').primary();
                    table.string('name', 100).notNullable();
                    table.decimal('limit_amount', 12, 2).notNullable().defaultTo(1000.00);
                    table.enum('period_type', ['YEARLY', 'MONTHLY', 'CUSTOM']).notNullable().defaultTo('YEARLY');
                    table.boolean('requires_approval').notNullable().defaultTo(false);
                    table.boolean('allow_partial_foc').notNullable().defaultTo(true);
                    table.boolean('allow_override').notNullable().defaultTo(false);
                    table.boolean('active').notNullable().defaultTo(true);
                    table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
                    table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               });

               await connection('staff_foc_policy').insert({
                    name: 'Standard Staff Medical Benefit',
                    limit_amount: 1000.00,
                    period_type: 'YEARLY',
                    requires_approval: false,
                    allow_partial_foc: true,
                    allow_override: false,
                    active: true,
               });
               logger.info('[Bootstrap] Created staff_foc_policy table with default policy');
          }

          // 2. staff_foc_account
          if (!(await connection.schema.hasTable('staff_foc_account'))) {
               await connection.schema.createTable('staff_foc_account', (table) => {
                    table.increments('id').primary();
                    table.integer('employeeid').unsigned().notNullable();
                    table.integer('policy_id').unsigned().nullable();
                    table.integer('period_year').notNullable();
                    table.date('period_start').notNullable();
                    table.date('period_end').notNullable();
                    table.decimal('limit_amount', 12, 2).notNullable().defaultTo(1000.00);
                    table.decimal('used_amount', 12, 2).notNullable().defaultTo(0.00);
                    table.decimal('remaining_amount', 12, 2).notNullable().defaultTo(1000.00);
                    table.boolean('active').notNullable().defaultTo(true);
                    table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
                    table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());

                    table.unique(['employeeid', 'period_year'], { indexName: 'idx_staff_foc_account_emp_year' });
                    table.index(['active'], 'idx_staff_foc_account_active');
               });
               logger.info('[Bootstrap] Created staff_foc_account table');
          }

          // 3. staff_foc_transaction
          if (!(await connection.schema.hasTable('staff_foc_transaction'))) {
               await connection.schema.createTable('staff_foc_transaction', (table) => {
                    table.increments('id').primary();
                    table.integer('foc_account_id').unsigned().notNullable();
                    table.integer('employeeid').unsigned().notNullable();
                    table.integer('patientid').unsigned().notNullable();
                    table.integer('billingid').unsigned().notNullable();
                    table.integer('branchid').unsigned().notNullable().defaultTo(1);
                    table.decimal('gross_amount', 12, 2).notNullable();
                    table.decimal('foc_amount', 12, 2).notNullable();
                    table.decimal('payable_amount', 12, 2).notNullable().defaultTo(0.00);
                    table.enum('status', ['pending', 'approved', 'rejected', 'reversed']).notNullable().defaultTo('approved');
                    table.text('reason').nullable();
                    table.integer('requested_by').unsigned().notNullable();
                    table.integer('approved_by').unsigned().nullable();
                    table.datetime('approved_on').nullable();
                    table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());

                    table.index(['employeeid'], 'idx_foc_tx_emp');
                    table.index(['patientid'], 'idx_foc_tx_patient');
                    table.index(['billingid'], 'idx_foc_tx_billing');
                    table.index(['status'], 'idx_foc_tx_status');
               });
               logger.info('[Bootstrap] Created staff_foc_transaction table');
          }

          // Automatically initialize current year FOC accounts for all active staff in roles table if missing
          const currentYear = new Date().getFullYear();
          const periodStart = `${currentYear}-01-01`;
          const periodEnd = `${currentYear}-12-31`;

          if (await connection.schema.hasTable('roles')) {
               const activeStaff = await connection('roles')
                    .select('employeeid')
                    .where({ activation: 1 });

               for (const staff of activeStaff) {
                    const empId = Number(staff.employeeid);
                    const existingAccount = await connection('staff_foc_account')
                         .where({ employeeid: empId, period_year: currentYear })
                         .first();

                    if (!existingAccount) {
                         await connection('staff_foc_account').insert({
                              employeeid: empId,
                              period_year: currentYear,
                              period_start: periodStart,
                              period_end: periodEnd,
                              limit_amount: 1000.00,
                              used_amount: 0.00,
                              remaining_amount: 1000.00,
                              active: true,
                         });
                    }
               }
          }
     } catch (error) {
          logger.error('[Bootstrap] Failed to bootstrap staff FOC tables:', error);
     }
}
