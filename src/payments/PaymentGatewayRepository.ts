import { Knex } from 'knex';
import { systemConfigConnection } from '../database/connection';
import {
     GatewayError, GatewayEvent, GatewayStatus, GatewayTransaction, IPaymentGatewayRepository, ListFilter, NewGatewayTransaction,
} from './types';

export const GATEWAY_TX_TABLE = 'payment_gateway_transactions';
export const GATEWAY_EVENTS_TABLE = 'payment_gateway_events';

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const hydrate = (row: any): GatewayTransaction => ({
     ...row,
     id: Number(row.id), tenant_id: Number(row.tenant_id), amount_minor: Number(row.amount_minor),
     subject_id: row.subject_id == null ? null : Number(row.subject_id),
     needs_review: !!row.needs_review, verify_attempts: Number(row.verify_attempts ?? 0),
});

/**
 * Master/control database only. Transactions for every purpose live here so the webhook, return and reconciliation
 * paths have one place to look; tenant credentials and applied-payment markers stay in the tenant's own database.
 */
export class PaymentGatewayRepository implements IPaymentGatewayRepository {
     private ready: Promise<void> | null = null;

     constructor(private db: Knex = systemConfigConnection) { }

     ensureSchema(): Promise<void> {
          if (!this.ready) {
               this.ready = this.createTables().catch(error => { this.ready = null; throw error; });
          }
          return this.ready;
     }

     private async createTables() {
          const db = this.db;
          try {
               if (!(await db.schema.hasTable(GATEWAY_TX_TABLE))) {
                    await db.schema.createTable(GATEWAY_TX_TABLE, table => {
                         table.bigIncrements('id');
                         table.string('reference', 64).notNullable().unique();
                         table.string('provider', 20).notNullable();
                         table.string('provider_reference', 120).nullable();
                         table.string('purpose', 40).notNullable();
                         table.bigInteger('tenant_id').notNullable();
                         table.string('period_start', 10).nullable();
                         table.bigInteger('subject_id').nullable();
                         table.string('open_key', 120).nullable().unique();
                         table.bigInteger('amount_minor').notNullable();
                         table.string('currency', 3).notNullable();
                         table.string('status', 20).notNullable();
                         table.boolean('needs_review').notNullable().defaultTo(false);
                         table.string('review_reason', 255).nullable();
                         table.text('checkout_url').nullable();
                         table.bigInteger('initiated_by_tenant_id').notNullable();
                         table.bigInteger('initiated_by_employee_id').notNullable();
                         table.timestamp('fulfilled_at').nullable();
                         table.string('fulfilment_ref', 120).nullable();
                         table.integer('verify_attempts').notNullable().defaultTo(0);
                         table.timestamp('last_verified_at').nullable();
                         table.timestamp('expires_at').notNullable();
                         table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
                         table.timestamp('updated_at').notNullable().defaultTo(db.fn.now());
                         table.unique(['provider', 'provider_reference'], { indexName: 'uq_pgt_provider_ref' });
                         table.index(['status', 'updated_at'], 'ix_pgt_status');
                         table.index(['tenant_id'], 'ix_pgt_tenant');
                    });
               }
               if (!(await db.schema.hasColumn(GATEWAY_TX_TABLE, 'subject_id'))) {
                    await db.schema.alterTable(GATEWAY_TX_TABLE, table => { table.bigInteger('subject_id').nullable(); });
               }
               if (!(await db.schema.hasTable(GATEWAY_EVENTS_TABLE))) {
                    await db.schema.createTable(GATEWAY_EVENTS_TABLE, table => {
                         table.bigIncrements('id');
                         table.bigInteger('transaction_id').notNullable();
                         table.string('source', 20).notNullable();
                         table.string('event_type', 60).notNullable();
                         table.string('event_hash', 64).nullable();
                         table.string('from_status', 20).nullable();
                         table.string('to_status', 20).nullable();
                         table.string('detail', 500).nullable();
                         table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
                         table.unique(['transaction_id', 'event_hash'], { indexName: 'uq_pge_dedupe' });
                         table.index(['transaction_id'], 'ix_pge_tx');
                    });
               }
          } catch (error: any) {
               if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
          }
     }

     async insert(values: NewGatewayTransaction): Promise<GatewayTransaction> {
          await this.ensureSchema();
          try {
               await this.db(GATEWAY_TX_TABLE).insert({ ...values, expires_at: toDate(values.expires_at) });
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') throw new GatewayError('A payment for this item is already in progress', 409);
               throw error;
          }
          return (await this.findByReference(values.reference))!;
     }

     async findByReference(reference: string) {
          await this.ensureSchema();
          const row = await this.db(GATEWAY_TX_TABLE).where({ reference }).first();
          return row ? hydrate(row) : null;
     }

     async findOpenByKey(openKey: string) {
          await this.ensureSchema();
          const row = await this.db(GATEWAY_TX_TABLE).where({ open_key: openKey }).first();
          return row ? hydrate(row) : null;
     }

     async transition(reference: string, from: GatewayStatus[], to: GatewayStatus, patch: Partial<GatewayTransaction> = {}) {
          await this.ensureSchema();
          const update: Record<string, unknown> = { ...patch, status: to, updated_at: this.db.fn.now() };
          // The open key is held only while a checkout can still complete, which is what blocks concurrent checkouts.
          if (to !== 'initiated' && to !== 'pending') update.open_key = null;
          const affected = await this.db(GATEWAY_TX_TABLE).where({ reference }).whereIn('status', from).update(update);
          return affected === 1;
     }

     async patch(reference: string, patch: Partial<GatewayTransaction>) {
          await this.ensureSchema();
          await this.db(GATEWAY_TX_TABLE).where({ reference }).update({ ...patch, updated_at: this.db.fn.now() });
     }

     async markFulfilled(reference: string, fulfilmentRef: string) {
          await this.ensureSchema();
          const affected = await this.db(GATEWAY_TX_TABLE).where({ reference }).whereNull('fulfilled_at')
               .update({ fulfilled_at: this.db.fn.now(), fulfilment_ref: fulfilmentRef, updated_at: this.db.fn.now() });
          return affected === 1;
     }

     async appendEvent(event: GatewayEvent) {
          await this.ensureSchema();
          await this.db(GATEWAY_EVENTS_TABLE).insert({
               transaction_id: event.transaction_id, source: event.source, event_type: event.event_type.slice(0, 60),
               event_hash: event.event_hash ?? null, from_status: event.from_status ?? null, to_status: event.to_status ?? null,
               detail: event.detail ? event.detail.slice(0, 500) : null,
          });
     }

     async recordWebhookEvent(transactionId: number, eventType: string, eventHash: string) {
          try {
               await this.appendEvent({ transaction_id: transactionId, source: 'webhook', event_type: eventType, event_hash: eventHash });
               return true;
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') return false;
               throw error;
          }
     }

     async listReconcilable(olderThan: Date, limit: number) {
          await this.ensureSchema();
          const rows = await this.db(GATEWAY_TX_TABLE)
               .where(builder => builder.whereIn('status', ['initiated', 'pending', 'expired'])
                    .orWhere(inner => inner.where('status', 'succeeded').whereNull('fulfilled_at').where('needs_review', false)))
               .where('needs_review', false)
               .where('updated_at', '<', olderThan)
               .where('created_at', '>', new Date(Date.now() - 14 * 24 * 3600 * 1000))
               .orderBy('updated_at', 'asc').limit(limit);
          return rows.map(hydrate);
     }

     async list(filter: ListFilter) {
          await this.ensureSchema();
          const base = this.db(GATEWAY_TX_TABLE).modify(query => {
               if (filter.status) query.where({ status: filter.status });
               if (filter.tenantId) query.where({ tenant_id: filter.tenantId });
               if (filter.purpose) query.where({ purpose: filter.purpose });
               if (filter.needsReview !== undefined) query.where({ needs_review: filter.needsReview });
          });
          const [{ total }] = await base.clone().count({ total: '*' });
          const rows = await base.clone().orderBy('id', 'desc').limit(filter.pageSize).offset((filter.page - 1) * filter.pageSize);
          return { rows: rows.map(hydrate), total: Number(total) };
     }

     async events(transactionId: number) {
          await this.ensureSchema();
          return this.db(GATEWAY_EVENTS_TABLE).where({ transaction_id: transactionId }).orderBy('id', 'asc');
     }
}
