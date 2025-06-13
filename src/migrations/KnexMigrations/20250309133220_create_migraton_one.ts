// migrations/20240309142701_create_additional_tables.js

exports.up = function (knex) {
     return knex.schema
          .createTable('billingtemporarytable', function (table) {
               table.increments('orderid').primary();
               table.integer('clinicianid').notNullable();
               table.integer('organizationid').notNullable();
               table.json('data').notNullable().defaultTo('{}');
               table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.tinyint('processed').notNullable().defaultTo(0);
               table.bigInteger('patientid').notNullable();
          })
          .createTable('branch', function (table) {
               table.increments('branchid').primary();
               table.string('name', 255).notNullable().unique();
               table.date('date').notNullable().defaultTo(knex.fn.now());
               table.tinyint('activation').notNullable().defaultTo(0);
               table.string('address', 200).notNullable();
               table.string('email', 100).nullable();
               table.integer('contact').notNullable();
               table.string('managerid', 10).notNullable();
          })
          .createTable('clinicianbasicinfo', function (table) {
               table.increments('id').primary();
               table.string('name', 255).notNullable();
               table.string('location', 100).nullable();
               table.string('address', 255).nullable();
               table.string('occupation', 100).nullable();
               table.integer('organization').nullable();
               table.date('updated_on').nullable();
               table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.string('phone', 10).notNullable();
               table.string('email', 100).nullable();
               table.string('identifier', 20).notNullable();
          });
};

exports.down = function (knex) {
     return knex.schema
          .dropTableIfExists('clinicianbasicinfo')
          .dropTableIfExists('branch')
          .dropTableIfExists('billingtemporarytable')
          .dropTableIfExists('appointments')
          .dropTableIfExists('billingtemporarytable')
          .dropTableIfExists('billingstrategy')
          .dropTableIfExists('billinghx')
          .dropTableIfExists('billing')
};