import { Knex } from 'knex';
import { applyFacilityCatalogSeeds, loadFacilityCatalogSeeds } from './FacilityCatalogSeeds';

/**
 * Explicit allowlist of the existing source-controlled reference seeds.
 * Never run 01_employee (published default passwords) or 01_branch (legacy destructive reset).
 * These modules resolve to .js in dist and .ts under ts-node/vitest.
 */
const referenceSeeds = [
     require('../../cron/command-line-tool-database/Seeds/01_regions'),
     require('../../cron/command-line-tool-database/Seeds/01_sample_containers'),
     require('../../cron/command-line-tool-database/Seeds/02_application_settings'),
     require('../../cron/command-line-tool-database/Seeds/05_payment_modes'),
     require('../../cron/command-line-tool-database/Seeds/08_sampletypes'),
     require('../../cron/command-line-tool-database/Seeds/districts'),
     require('../../cron/command-line-tool-database/Seeds/registrationfields'),
     require('../../cron/command-line-tool-database/Seeds/shifts'),
];

export async function seedFacilityReferences(db: Knex, catalog: ReturnType<typeof loadFacilityCatalogSeeds>, adminName: string): Promise<void> {
     for (const module of referenceSeeds) await module.seed(db);
     // Reuse department definitions, but never insert the legacy seed's hardcoded staff names.
     const departments = require('../../cron/command-line-tool-database/Seeds/07_departments');
     await departments.seed((table: string) => {
          if (table !== 'departments') throw new Error('Unexpected department seed table');
          return { insert: (rows: Array<{ department: string }>) =>
               db(table).insert(rows.map(row => ({ department: row.department, departmentManager: adminName, employeeid: 1 }))) };
     });
     await applyFacilityCatalogSeeds(db, catalog, adminName);
}
