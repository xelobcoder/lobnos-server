"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create samplecontainer table first (needed by test_panels)
    // Create patient_clinical_history_ultrasound table
    await knex.schema.createTableIfNotExists('patient_clinical_history_ultrasound', (table) => {
        table.increments('id').primary();
        table.integer('ascensionid', 10).unsigned().notNullable();
        table.text('clinical_history').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.unique('ascensionid');
        table.index('ascensionid');
    });
    // Add foreign key constraints for test tables
    await knex.raw(`
    ALTER TABLE testdetailcategory
    ADD CONSTRAINT testdetailcategory_ibfk_1 FOREIGN KEY (testid) REFERENCES test_panels (prim_key) ON DELETE CASCADE ON UPDATE CASCADE
  `);
}
exports.up = up;
async function down(knex) {
    // Drop foreign key constraints
    await knex.raw(`ALTER TABLE testdetailcategory DROP FOREIGN KEY testdetailcategory_ibfk_1`);
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'patient_clinical_history_ultrasound',
        'clinician_packages',
        'clinicianscredentials',
        'clinicianpaymentinfo',
        'clinicianbasicinfo',
        'package_tests',
        'packages',
        'test_panels',
        'testdetailcategory',
        'samplecontainer'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
