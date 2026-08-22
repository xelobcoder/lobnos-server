import KnexConnection from '../../../../database/KnexConnections';
import { up as applyAdvancedCommissionMigration } from '../../../../cron/command-line-tool-database/migrations/20260820_advanced_commission_calculations';

const commissionTypes = [
     'percentage',
     'fixed',
     'tiered',
     'hybrid',
     'sliding_scale',
     'volume',
     'quota',
     'accelerating',
] as const;

export async function bootstrapCommissionTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('commission_configs'))) {
          await connection.schema.createTable('commission_configs', (table) => {
               table.increments('id').primary();
               table.string('name', 255).notNullable();
               table.text('description').nullable();
               table.enu('commission_type', [...commissionTypes]).notNullable();
               table.decimal('percentage_rate', 5, 2).nullable();
               table.decimal('sliding_max_percentage', 5, 2).nullable();
               table.decimal('fixed_component', 10, 2).nullable();
               table.decimal('min_commission', 10, 2).nullable();
               table.decimal('max_commission', 10, 2).nullable();
               table.decimal('period_cap', 10, 2).nullable();
               table.enu('period_cap_reset', ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']).nullable();
               table.decimal('quota_target', 12, 2).nullable();
               table.string('volume_period', 16).nullable();
               table.date('effective_from').notNullable();
               table.date('effective_to').nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.timestamp('updated_at').defaultTo(connection.fn.now());
               table.unique(['name', 'effective_from'], 'uk_commission_config_name_effective');
               table.index(['is_active', 'effective_from', 'effective_to'], 'idx_commission_config_active_dates');
          });
     }

     if (!(await connection.schema.hasTable('commission_tiers'))) {
          await connection.schema.createTable('commission_tiers', (table) => {
               table.increments('id').primary();
               table.integer('commission_config_id').unsigned().notNullable();
               table.decimal('min_amount_inclusive', 12, 2).notNullable();
               table.decimal('max_amount_exclusive', 12, 2).nullable();
               table.enu('tier_type', ['fixed', 'percentage']).notNullable();
               table.decimal('tier_value', 12, 4).notNullable();
               table.integer('sort_order').notNullable();
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.unique(['commission_config_id', 'min_amount_inclusive'], 'uk_commission_tier_bounds');
               table.index(['commission_config_id', 'sort_order'], 'idx_commission_tier_config_sort');
          });
     }

     if (!(await connection.schema.hasTable('commission_assignments'))) {
          await connection.schema.createTable('commission_assignments', (table) => {
               table.increments('id').primary();
               table.integer('commission_config_id').unsigned().notNullable();
               table.enu('scope_type', ['system', 'organization', 'clinician']).notNullable();
               table.integer('scope_id').unsigned().nullable();
               table.integer('service_id').unsigned().nullable();
               table.string('service_category', 100).nullable();
               table.integer('priority').notNullable().defaultTo(1);
               table.date('assigned_from').notNullable();
               table.date('assigned_to').nullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.index(['is_active', 'scope_type', 'scope_id', 'service_id', 'assigned_from'], 'idx_commission_assignment_resolution');
               table.index(['priority', 'assigned_from'], 'idx_commission_assignment_priority');
          });
     }

     if (!(await connection.schema.hasTable('commission_tracking'))) {
          await connection.schema.createTable('commission_tracking', (table) => {
               table.increments('id').primary();
               table.integer('service_id').unsigned().notNullable();
               table.decimal('service_amount', 12, 2).notNullable();
               table.enu('commission_type', [...commissionTypes]).notNullable();
               table.decimal('percentage_rate_applied', 5, 2).nullable();
               table.decimal('fixed_amount_applied', 10, 2).nullable();
               table.integer('tier_id').unsigned().nullable();
               table.decimal('commission_due', 12, 2).notNullable();
               table.decimal('min_cap_adjustment', 12, 2).notNullable().defaultTo(0);
               table.decimal('max_cap_adjustment', 12, 2).notNullable().defaultTo(0);
               table.decimal('period_cap_adjustment', 12, 2).notNullable().defaultTo(0);
               table.decimal('final_commission', 12, 2).notNullable();
               table.integer('config_id').unsigned().nullable();
               table.integer('assignment_id').unsigned().nullable();
               table.enu('recipient_type', ['clinician', 'organization']).notNullable();
               table.integer('recipient_id').unsigned().notNullable();
               table.date('cap_period_reference').nullable();
               table.dateTime('calculated_at').notNullable();
               table.string('currency', 3).notNullable().defaultTo('GHS');
               table.enu('status', ['pending', 'approved', 'paid', 'voided', 'adjusted']).notNullable().defaultTo('pending');
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.timestamp('updated_at').defaultTo(connection.fn.now());
               table.index(['service_id'], 'idx_commission_tracking_service');
               table.index(['recipient_type', 'recipient_id'], 'idx_commission_tracking_recipient');
               table.index(['cap_period_reference', 'recipient_type', 'recipient_id', 'status'], 'idx_commission_tracking_period');
               table.index(['status', 'calculated_at'], 'idx_commission_tracking_status');
          });
     }

     if (!(await connection.schema.hasTable('commission_default'))) {
          await connection.schema.createTable('commission_default', (table) => {
               table.increments('id').primary();
               table.enu('recipient_type', ['clinician', 'organization']).notNullable();
               table.integer('commission_config_id').unsigned().notNullable();
               table.boolean('is_active').notNullable().defaultTo(true);
               table.timestamp('created_at').defaultTo(connection.fn.now());
               table.index(['recipient_type', 'is_active'], 'idx_commission_default_type_active');
          });
     }

     if (!(await connection.schema.hasTable('commission_defaults'))) {
          await connection.schema.createTable('commission_defaults', (table) => {
               table.increments('id').primary();
               table.enu('target_type', ['GLOBAL', 'CLINICIAN', 'ORGANIZATION']).notNullable();
               table.enu('commission_type', ['PERCENTAGE', 'FIXED']).notNullable();
               table.decimal('commission_value', 12, 2).notNullable().defaultTo(0);
               table.timestamp('created_on').defaultTo(connection.fn.now());
               table.timestamp('updated_on').defaultTo(connection.fn.now());
               table.unique(['target_type'], 'uk_commission_defaults_target_type');
          });
     }

     await applyAdvancedCommissionMigration(connection);
}
