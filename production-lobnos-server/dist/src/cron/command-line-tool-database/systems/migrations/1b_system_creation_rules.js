"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create test_panels table first (referenced by other tables)
    if (!(await knex.schema.hasTable("test_panels"))) {
        await knex.schema.createTable("test_panels", (table) => {
            table.increments("prim_key").primary();
            table.string("name", 255).notNullable().unique();
            table.integer("category").notNullable();
            table.integer("price").notNullable();
            table.dateTime("created_on", { precision: 6 }).notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP(6)"));
            table.integer("sample").notNullable();
            table.text("description").nullable();
            table.integer("sample_container").notNullable();
            table.string("unit", 10).notNullable();
            table.string("qty_required", 100).nullable();
            table.string("shorttext", 15).nullable();
            table.boolean("iscustom").notNullable().defaultTo(false);
            table.integer("id").unsigned().notNullable().index();
            table.index(["name", "id"]);
        });
    }
    // Create testdetailcategory table
    if (!(await knex.schema.hasTable("testdetailcategory"))) {
        await knex.schema.createTable("testdetailcategory", (table) => {
            table.increments("categoryid").primary();
            table.string("categoryname", 255).notNullable();
            table.integer("testid").unsigned().notNullable().index();
            table.string("createdby", 255).notNullable();
            table.string("updatedby", 255).nullable();
            table.timestamp("created_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
            table.timestamp("updated_at").notNullable().defaultTo(knex.raw("CURRENT_TIMESTAMP"));
            table.boolean("deleted").nullable().defaultTo(false);
            table.unique(["categoryname", "testid"]);
            table.foreign("testid").references("id").inTable("test_panels").onDelete("CASCADE").onUpdate("CASCADE");
        });
    }
    // Create testcreationrules table
    if (!(await knex.schema.hasTable("testcreationrules"))) {
        await knex.schema.createTable("testcreationrules", (table) => {
            table.increments("id").primary();
            table.integer("testid").unsigned().notNullable();
            table.string("name", 255).notNullable();
            table.string("field", 255).nullable();
            table.text("value").nullable();
            table.boolean("hasunits").nullable().defaultTo(false);
            table.string("units", 50).nullable();
            table.enum("plan", ["input", "textReference", "options", "plain", "limits", "greaterLess"]).notNullable();
            table.text("plain").nullable();
            table.integer("ordering").nullable();
            table.boolean("isValueTracked").nullable().defaultTo(false);
            table.text("textReference").nullable();
            table.string("upperlimit", 50).nullable();
            table.string("lowerlimit", 50).nullable();
            table.string("category", 255).nullable();
            table.text("options").nullable();
            table.boolean("undercategory").nullable().defaultTo(false);
            table.integer("categoryid").unsigned().nullable().index();
            table.string("valueAlert", 255).nullable();
            table.string("alert", 50).nullable();
            table.unique(["testid", "name"]);
            table.foreign("testid").references("id").inTable("test_panels").onDelete("CASCADE").onUpdate("CASCADE");
            table.foreign("categoryid").references("categoryid").inTable("testdetailcategory").onDelete("CASCADE").onUpdate("CASCADE");
        });
    }
    // Create testdetails table
    if (!(await knex.schema.hasTable("testdetails"))) {
        await knex.schema.createTable("testdetails", (table) => {
            table.increments("id").primary();
            table.integer("testid").unsigned().nullable().unique();
            table.integer("testcost").nullable();
            table.integer("hasManual").nullable();
            table.string("procedureCode", 10).nullable();
            table.integer("pre_Tat").nullable();
            table.integer("tat").nullable();
            table.integer("post_Tat").nullable();
            table.integer("tatCount").nullable();
            table.dateTime("updatedon", { precision: 6 }).nullable();
            table.integer("updatedby").notNullable();
            table.boolean("isoutsourced").notNullable().defaultTo(false);
            table.boolean("showtrend").notNullable().defaultTo(false);
            table.integer("testprice").nullable();
            table.boolean("hasGenderVariation").notNullable().defaultTo(false);
            table.boolean("hasChildrenLimit").notNullable().defaultTo(false);
            table.string("childrenlimit", 10).notNullable();
            table.boolean("useLiterature").nullable().defaultTo(false);
            table.boolean("hasDrugs").notNullable().defaultTo(false);
            table.string("outSourcingList", 20).nullable();
            table.enum("post_TatEvaluation", ["min", "seconds", "hour"]).notNullable().defaultTo("min");
            table.enum("pre_TatEvaluation", ["min", "seconds", "hour"]).notNullable().defaultTo("min");
            table.enum("tatEvaluation", ["min", "seconds", "hour"]).notNullable().defaultTo("min");
            table.text("deviceInterfaceMapping").nullable();
            table.string("reportitle", 300).nullable();
            table.string("method", 300).nullable();
            table.string("instrumentation", 300).notNullable();
            table.foreign("testid").references("id").inTable("test_panels").onDelete("CASCADE").onUpdate("CASCADE");
        });
    }
}
exports.up = up;
async function down(knex) {
    // Drop in reverse creation order. Use dropTableIfExists for idempotence.
    await knex.schema.dropTableIfExists("test_ascension");
    await knex.schema.dropTableIfExists("testdetails");
    await knex.schema.dropTableIfExists("testcreationrules");
    await knex.schema.dropTableIfExists("testdetailcategory");
    await knex.schema.dropTableIfExists("test_panels");
}
exports.down = down;
