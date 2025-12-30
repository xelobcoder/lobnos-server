"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Drop the existing foreign key constraint
    await knex.schema.alterTable('access_windows', (table) => {
        table.dropForeign('employeeid');
    });
    // Add a new check constraint that allows employeeid = 0 for global records
    // and requires valid employeeid for individual records
    await knex.raw(`
          ALTER TABLE access_windows
          ADD CONSTRAINT check_employeeid_global
          CHECK (
               (category = 'global' AND employeeid = 0) OR
               (category = 'individual' AND employeeid > 0)
          )
     `);
    // Re-add the foreign key constraint but only for individual records
    // This is a bit complex in MySQL, so we'll use a trigger approach or modify the application logic
    // For now, we'll rely on application-level validation
}
exports.up = up;
async function down(knex) {
    // Remove the check constraint
    await knex.raw(`ALTER TABLE access_windows DROP CONSTRAINT check_employeeid_global`);
    // Re-add the original foreign key constraint
    await knex.schema.alterTable('access_windows', (table) => {
        table.foreign('employeeid').references('employeeid').inTable('roles').onDelete('CASCADE').onUpdate('CASCADE');
    });
}
exports.down = down;
