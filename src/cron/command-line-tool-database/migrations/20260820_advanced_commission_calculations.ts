import { Knex } from 'knex';

const commissionTypes = "'percentage','fixed','tiered','hybrid','sliding_scale','volume','quota','accelerating'";

export async function up(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('commission_configs')) {
          await knex.raw(`ALTER TABLE commission_configs MODIFY COLUMN commission_type ENUM(${commissionTypes}) NOT NULL`);

          if (!(await knex.schema.hasColumn('commission_configs', 'quota_target'))) {
               await knex.schema.alterTable('commission_configs', (table) => {
                    table.decimal('quota_target', 12, 2).nullable();
               });
          }

          if (!(await knex.schema.hasColumn('commission_configs', 'volume_period'))) {
               await knex.schema.alterTable('commission_configs', (table) => {
                    table.string('volume_period', 16).nullable();
               });
          }
     }

     if (await knex.schema.hasTable('commission_tracking')) {
          await knex.raw(`ALTER TABLE commission_tracking MODIFY COLUMN commission_type ENUM(${commissionTypes}) NOT NULL`);
     }
}

export async function down(knex: Knex): Promise<void> {
     if (await knex.schema.hasTable('commission_tracking')) {
          await knex.raw("ALTER TABLE commission_tracking MODIFY COLUMN commission_type ENUM('percentage','fixed','tiered','hybrid','sliding_scale') NOT NULL");
     }

     if (await knex.schema.hasTable('commission_configs')) {
          await knex.raw("ALTER TABLE commission_configs MODIFY COLUMN commission_type ENUM('percentage','fixed','tiered','hybrid','sliding_scale') NOT NULL");

          const columnsToDrop: string[] = [];
          if (await knex.schema.hasColumn('commission_configs', 'quota_target')) {
               columnsToDrop.push('quota_target');
          }
          if (await knex.schema.hasColumn('commission_configs', 'volume_period')) {
               columnsToDrop.push('volume_period');
          }

          if (columnsToDrop.length > 0) {
               await knex.schema.alterTable('commission_configs', (table) => {
                    for (const column of columnsToDrop) {
                         table.dropColumn(column);
                    }
               });
          }
     }
}
