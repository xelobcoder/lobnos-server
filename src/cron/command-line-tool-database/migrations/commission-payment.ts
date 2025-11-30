import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     if (!(await knex.schema.hasTable('commission_tracking'))) {
          await knex.schema.createTable('commission_tracking', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('serviceid').notNullable().unsigned().unique();
               table.decimal('commission_percentage', 5, 2).notNullable();
               table.decimal('commission_due', 10, 2).notNullable();
               table.enum("type", ["clinician", "organization"]).notNullable();
               table.integer('recipient_id').notNullable().unsigned();
               table.dateTime('calculated_at').notNullable().defaultTo(knex.fn.now()); 
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

               table.index('serviceid');
               table.index('type');
               table.index('recipient_id');

               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     if (!(await knex.schema.hasTable('commission_payment_transactions'))) {
          await knex.schema.createTable('commission_payment_transactions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('batch_payment_service_id').notNullable().unsigned();
               table.decimal('amount_paid', 10, 2).notNullable();
               table.integer('trackid').nullable().unsigned(); // Reference to payment tracking record
               table.integer("paymentmode").nullable().unsigned();
               table.integer('paid_by').nullable().unsigned();
               table.text('notes').nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

               table.index('batch_payment_service_id');
               table.index('trackid');
               table.index('paid_by');

               table.foreign('batch_payment_service_id').references('id').inTable('commission_batch_payment_services').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('paid_by').references('employeeid').inTable('roles').onUpdate('CASCADE');
               table.foreign('paymentmode').references('KeyID').inTable('paymentmodes').onUpdate('CASCADE');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('commission_payment_transactions');
     await knex.schema.dropTableIfExists('commission_tracking');
}
