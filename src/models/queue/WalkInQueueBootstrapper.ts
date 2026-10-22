import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

export const QUEUE_TICKETS = 'walk_in_queue_tickets';
export const QUEUE_SETTINGS = 'walk_in_queue_settings';
export const QUEUE_COUNTERS = 'walk_in_queue_counters';
export const QUEUE_EVENTS = 'walk_in_queue_events';
const pending = new WeakMap<Knex, Promise<void>>();

async function upgrade(db: Knex): Promise<void> {
     if (!await db.schema.hasTable(QUEUE_SETTINGS)) {
          await db.schema.createTable(QUEUE_SETTINGS, table => {
               table.integer('id').unsigned().primary();
               table.boolean('public_enabled').notNullable().defaultTo(true);
               table.boolean('display_enabled').notNullable().defaultTo(true);
               table.string('ticket_prefix', 6).notNullable().defaultTo('Q');
               table.integer('version').unsigned().notNullable().defaultTo(1);
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
          });
     }
     await db(QUEUE_SETTINGS).insert({ id: 1 }).onConflict('id').ignore();
     if (!await db.schema.hasTable(QUEUE_COUNTERS)) {
          await db.schema.createTable(QUEUE_COUNTERS, table => {
               table.date('queue_date').primary();
               table.integer('last_number').unsigned().notNullable().defaultTo(0);
          });
     }
     if (!await db.schema.hasTable(QUEUE_TICKETS)) {
          await db.schema.createTable(QUEUE_TICKETS, table => {
               table.bigIncrements('id');
               table.date('queue_date').notNullable();
               table.integer('sequence').unsigned().notNullable();
               table.string('ticket_number', 16).notNullable();
               table.string('name', 160).notNullable();
               table.string('phone', 30).notNullable();
               table.string('status', 20).notNullable().defaultTo('waiting');
               table.string('counter', 80).nullable();
               table.integer('patientid').unsigned().nullable();
               table.integer('billingid').unsigned().nullable();
               table.string('idempotency_key', 100).notNullable();
               table.string('request_hash', 64).notNullable();
               table.text('notes').nullable();
               table.integer('version').unsigned().notNullable().defaultTo(1);
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
               table.unique(['queue_date', 'sequence'], 'uq_walk_in_queue_sequence');
               table.unique(['queue_date', 'idempotency_key'], 'uq_walk_in_queue_request');
               table.index(['queue_date', 'status'], 'idx_walk_in_queue_status');
               table.index(['queue_date', 'phone'], 'idx_walk_in_queue_phone');
               table.index(['billingid'], 'idx_walk_in_queue_billing');
          });
     }
     if (!await db.schema.hasTable(QUEUE_EVENTS)) {
          await db.schema.createTable(QUEUE_EVENTS, table => {
               table.bigIncrements('id');
               table.bigInteger('ticket_id').unsigned().nullable();
               table.integer('actor_employeeid').unsigned().nullable();
               table.string('action', 40).notNullable();
               table.text('details_json').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['ticket_id', 'created_at'], 'idx_walk_in_queue_history');
          });
     }
}

/** Startup-only additive upgrade, using the tenant's own database. Public reads never run DDL. */
export async function bootstrapWalkInQueueTables(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     let work = pending.get(db);
     if (!work) {
          work = upgrade(db).finally(() => pending.delete(db));
          pending.set(db, work);
     }
     await work;
}
