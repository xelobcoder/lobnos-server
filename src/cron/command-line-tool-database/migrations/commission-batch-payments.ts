import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create commission_batch_payments table
     if (!(await knex.schema.hasTable('commission_batch_payments'))) {
          await knex.schema.createTable('commission_batch_payments', (table) => {
               table.increments('id').primary().unsigned();
               table.string('batch_reference', 100).notNullable().unique();
               table.enum('recipient_type', ['clinician', 'organization']).notNullable();
               table.integer('recipient_id').notNullable().unsigned();
               table.date('start_date').notNullable();
               table.date('end_date').notNullable();
               table.decimal('total_commission_amount', 10, 2).notNullable();
               table.decimal('payment_amount', 10, 2).notNullable();
               table.decimal('waived_amount', 10, 2).notNullable().defaultTo(0);
               table.enum('status', ['pending', 'completed', 'cancelled']).notNullable().defaultTo('pending');
               table.date('payment_date').nullable();
               table.integer('created_by').notNullable().unsigned();
               table.text('notes').nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

               table.index(['recipient_type', 'recipient_id']);
               table.index('status');
               table.index('created_by');
               table.index(['start_date', 'end_date']);

               table.foreign('created_by').references('employeeid').inTable('roles').onUpdate('CASCADE');
          });
     }

     // Create commission_batch_payment_services table
     if (!(await knex.schema.hasTable('commission_batch_payment_services'))) {
          await knex.schema.createTable('commission_batch_payment_services', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('batch_payment_id').notNullable().unsigned();
               table.integer('serviceid').notNullable().unsigned();
               table.decimal('commission_due', 10, 2).notNullable();
               table.decimal('amount_allocated', 10, 2).notNullable();
               table.enum('status', ['paid', 'partial']).notNullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

               table.index('batch_payment_id');
               table.index('serviceid');
               table.unique(['batch_payment_id', 'serviceid']);

               table.foreign('batch_payment_id').references('id').inTable('commission_batch_payments').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }
}

export async function down(knex: Knex): Promise<void> {
     await knex.schema.dropTableIfExists('commission_batch_payment_services');
     await knex.schema.dropTableIfExists('commission_batch_payments');
}