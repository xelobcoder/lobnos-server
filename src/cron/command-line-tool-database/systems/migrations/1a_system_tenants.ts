import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
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

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists("system_tenants");
}