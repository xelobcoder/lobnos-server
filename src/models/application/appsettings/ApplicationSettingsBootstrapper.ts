import KnexConnection from '../../../database/KnexConnections';
import { up as migrateWorkspaceLayout } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_layout';
import { up as migrateWorkspaceRibbon } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_ribbon';
import { up as migrateWorkspacePortal } from '../../../cron/command-line-tool-database/migrations/20261018_workspace_portal';
import { up as migrateRegistrationPrompts } from '../../../cron/command-line-tool-database/migrations/20261018_registration_prompt_settings';
import { up as migrateStaffPinSecurity } from '../../../cron/command-line-tool-database/migrations/20261018_staff_pin_security';
import { up as migrateBillingLayout } from '../../../cron/command-line-tool-database/migrations/20261025_billing_layout';
import RegionsDistrictsRepository from './repositories/regions-districts-repo';
import { DEFAULT_BILLING_SETTINGS } from './billingSettingsDefaults';
import { ensureGeographyColumns, seedWestAfricaRegions } from '../../geography/FacilityLocation';

// Region/district pickers and the applicationsettings codes depend on these catalogs; converted databases may lack them.
async function ensureRegionsAndDistricts(tenantId: number): Promise<void> {
     const repo = new RegionsDistrictsRepository();
     if (!(await repo.hasRegionsAndDistrictsTables(tenantId))) await repo.createRegionsAndDistrictsTables(tenantId);
     if (!(await repo.regionsAndDistrictsHaveData(tenantId))) await repo.seedRegionsAndDistricts(tenantId);
     const connection = await KnexConnection(tenantId);
     await ensureGeographyColumns(connection, String(tenantId));
     await seedWestAfricaRegions(connection);
}

export async function bootstrapApplicationSettings(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     await ensureRegionsAndDistricts(tenantId);
     await migrateWorkspaceLayout(connection);
     await migrateWorkspaceRibbon(connection);
     await migrateWorkspacePortal(connection);
     await migrateRegistrationPrompts(connection);
     await migrateStaffPinSecurity(connection);
     await migrateBillingLayout(connection);

     if (await connection.schema.hasTable('applicationsettings')) {
          const columns: Array<{ name: string; add: (table: any) => void }> = [
               { name: 'allowCrmToPrintResult', add: (table) => table.boolean('allowCrmToPrintResult').notNullable().defaultTo(false) },
               { name: 'headerColor', add: (table) => table.string('headerColor', 32).nullable() },
               { name: 'sidebarColor', add: (table) => table.string('sidebarColor', 32).nullable() },
               { name: 'pageBackgroundColor', add: (table) => table.string('pageBackgroundColor', 32).nullable() },
               { name: 'headerTextColor', add: (table) => table.string('headerTextColor', 32).nullable() },
               { name: 'sidebarTextColor', add: (table) => table.string('sidebarTextColor', 32).nullable() },
               { name: 'primaryColor', add: (table) => table.string('primaryColor', 32).nullable() },
               { name: 'secondaryColor', add: (table) => table.string('secondaryColor', 32).nullable() },
               { name: 'ageVariationLimits', add: (table) => table.json('ageVariationLimits').nullable() },
               { name: 'commissionRecipientPolicy', add: (table) => table.enu('commissionRecipientPolicy', ['clinician', 'organization']).notNullable().defaultTo('clinician') },
               { name: 'moduleConfiguration', add: (table) => table.text('moduleConfiguration', 'longtext').nullable() },
               { name: 'emailModuleActivated', add: (table) => table.boolean('emailModuleActivated').notNullable().defaultTo(false) },
               { name: 'country_code', add: (table) => table.string('country_code', 2).nullable() },
          ];

          for (const column of columns) {
               if (!(await connection.schema.hasColumn('applicationsettings', column.name))) {
                    await connection.schema.alterTable('applicationsettings', column.add);
               }
          }

          // A database converted to a tenant may have the table but no row; settings writers require keyid 1.
          // regioncode/districtcode store regions.id/districts.id, so they must point at rows that exist.
          const existing = await connection('applicationsettings').where({ keyid: 1 }).first('keyid', 'regioncode', 'districtcode');
          const resolves = existing
               && await connection('regions').where({ id: existing.regioncode }).first('id')
               && await connection('districts').where({ id: existing.districtcode, regionid: existing.regioncode }).first('id');
          if (!resolves) {
               const region = await connection('regions').where({ regioncode: 'NR' }).first('id');
               const district = region && await connection('districts').where({ regionid: region.id, name: 'Tamale' }).first('id');
               if (region && district) {
                    if (existing) {
                         await connection('applicationsettings').where({ keyid: 1 }).update({ regioncode: region.id, districtcode: district.id });
                    } else {
                         try {
                              await connection('applicationsettings').insert({
                                   keyid: 1,
                                   smsSettings: JSON.stringify({ result: 'No', registration: 'Yes', sample: 'No', birthday: 'No' }),
                                   billingsettings: JSON.stringify(DEFAULT_BILLING_SETTINGS),
                                   regioncode: region.id,
                                   districtcode: district.id,
                              });
                         } catch (error: any) {
                              if (error?.code !== 'ER_DUP_ENTRY' || !await connection('applicationsettings').where({ keyid: 1 }).first('keyid')) throw error;
                         }
                    }
               }
          }
     }
}
