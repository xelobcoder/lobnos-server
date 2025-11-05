"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.schema.createTable('encryption_keys', (table) => {
        table.increments('id').primary();
        table.string('key_id').notNullable().unique();
        table.text('encrypted_key').notNullable(); // The actual encrypted key data
        table.string('algorithm').notNullable().defaultTo('aes-256-cbc');
        table.date('expires_at').nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.date('deactivated_at').nullable();
        table.string('created_by').nullable();
        table.timestamps(true, true); // Creates created_at and updated_at as timestamps
    });
    // Create index on key_id for faster lookups
    await knex.schema.raw('CREATE INDEX idx_encryption_keys_key_id ON encryption_keys(key_id)');
    await knex.schema.raw('CREATE INDEX idx_encryption_keys_active ON encryption_keys(is_active)');
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTable('encryption_keys');
}
exports.down = down;
