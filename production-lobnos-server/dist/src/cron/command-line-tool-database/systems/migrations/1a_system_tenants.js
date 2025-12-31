"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    if (!(await knex.schema.hasTable("system_tenants"))) {
        await knex.schema.createTable("system_tenants", (table) => {
            table.increments("tenantid").primary();
            table.string("name", 100).notNullable();
            table.date("createdon").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
            table.boolean("isActive").notNullable().defaultTo(true);
            table.dateTime("updatedOn", { precision: 6 }).notNullable();
            table.string("referedid", 20).notNullable();
            table.dateTime("expirydate", { precision: 6 }).notNullable();
        });
    }
}
exports.up = up;
async function down(knex) {
    await knex.schema.dropTableIfExists("system_tenants");
}
exports.down = down;
