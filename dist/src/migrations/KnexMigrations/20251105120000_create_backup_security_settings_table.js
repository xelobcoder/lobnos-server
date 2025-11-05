"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('backup_security_settings', (table) => {
        table.increments('id').primary();
        table.boolean('encryption_enabled').notNullable().defaultTo(false);
        table.string('encryption_algorithm').notNullable().defaultTo('AES-256');
        table.integer('key_rotation_days').notNullable().defaultTo(90);
        table.boolean('secure_deletion_enabled').notNullable().defaultTo(false);
        table.integer('deletion_passes').notNullable().defaultTo(1);
        table.string('current_key_id').nullable();
        table.date('key_last_rotated').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamps(true, true);
    });
    // Insert default settings
    await knex('backup_security_settings').insert({
        encryption_enabled: true,
        encryption_algorithm: 'AES-256',
        key_rotation_days: 90,
        secure_deletion_enabled: true,
        deletion_passes: 3,
        current_key_id: 'KEY-2025-001',
        key_last_rotated: '2025-10-15',
        is_active: true,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
    });
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('backup_security_settings');
}
exports.down = down;
