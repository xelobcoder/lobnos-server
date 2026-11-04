import type { Knex } from 'knex';

export async function ensureNhisAccountingSchema(db: Knex): Promise<void> {
     if (!await db.schema.hasTable('acc_nhis_events')) {
          await db.schema.createTable('acc_nhis_events', table => {
               table.increments('id').primary();
               table.string('request_key', 80).notNullable().unique();
               table.string('fingerprint', 64).notNullable();
               table.string('kind', 30).notNullable();
               table.string('reverses_kind', 30).nullable();
               table.integer('reversal_of_event_id').unsigned().nullable().unique();
               table.string('reference', 120).notNullable();
               table.string('reason', 1000).notNullable();
               table.date('event_date').notNullable();
               table.integer('branchid').unsigned().notNullable();
               table.decimal('amount', 14, 2).notNullable();
               table.string('payment_account_code', 20).nullable();
               table.integer('created_by').unsigned().notNullable();
               table.datetime('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['branchid', 'event_date']);
               table.unique(['branchid', 'kind', 'reference']);
          });
     }
     if (!await db.schema.hasTable('acc_nhis_allocations')) {
          await db.schema.createTable('acc_nhis_allocations', table => {
               table.increments('id').primary();
               table.integer('event_id').unsigned().notNullable().references('id').inTable('acc_nhis_events');
               table.integer('billingid').unsigned().notNullable();
               table.decimal('amount', 14, 2).notNullable();
               table.decimal('tax_amount', 14, 2).notNullable().defaultTo(0);
               table.unique(['event_id', 'billingid']);
               table.index('billingid');
          });
     }
     if (!await db.schema.hasTable('acc_nhis_period_settlements')) {
          await db.schema.createTable('acc_nhis_period_settlements', table => {
               table.increments('id').primary();
               table.string('request_key', 80).notNullable().unique();
               table.string('fingerprint', 64).notNullable();
               table.string('snapshot_token', 64).notNullable();
               table.integer('branchid').unsigned().notNullable();
               table.date('service_from').notNullable();
               table.date('service_to').notNullable();
               table.date('posting_date').notNullable();
               table.string('remaining_disposition', 20).notNullable();
               table.integer('receipt_event_id').unsigned().nullable().unique().references('id').inTable('acc_nhis_events');
               table.integer('adjustment_event_id').unsigned().nullable().unique().references('id').inTable('acc_nhis_events');
               table.text('metadata', 'longtext').notNullable();
               table.integer('created_by').unsigned().notNullable();
               table.datetime('created_at').notNullable().defaultTo(db.fn.now());
               table.index(['branchid', 'posting_date']);
          });
     }
     if (!await db.schema.hasTable('acc_nhis_openings')) await db.schema.createTable('acc_nhis_openings', table => {
          table.increments('id').primary();
          table.string('request_key', 80).notNullable().unique();
          table.string('fingerprint', 64).notNullable();
          table.string('snapshot_token', 64).notNullable();
          table.integer('branchid').unsigned().notNullable();
          table.date('opening_date').notNullable();
          table.date('service_from').notNullable(); table.date('service_to').notNullable();
          table.string('offset_account_code', 20).notNullable();
          table.decimal('amount', 14, 2).notNullable(); table.integer('bill_count').notNullable();
          table.string('reference', 120).notNullable(); table.string('reason', 1000).notNullable();
          table.integer('created_by').unsigned().notNullable(); table.datetime('created_at').notNullable().defaultTo(db.fn.now());
          table.unique(['branchid', 'reference']);
     });
     if (!await db.schema.hasTable('acc_nhis_opening_bills')) await db.schema.createTable('acc_nhis_opening_bills', table => {
          table.bigIncrements('id').primary();
          table.integer('billingid').unsigned().notNullable().index();
          table.integer('opening_id').unsigned().notNullable().references('id').inTable('acc_nhis_openings');
          table.integer('journal_entry_id').unsigned().notNullable().references('id').inTable('acc_journal_entries');
          table.decimal('amount', 14, 2).notNullable();
          table.unique(['opening_id', 'billingid']);
     });
     if (!await db.schema.hasTable('acc_nhis_opening_reversals')) await db.schema.createTable('acc_nhis_opening_reversals', table => {
          table.increments('id').primary(); table.integer('opening_id').unsigned().notNullable().unique().references('id').inTable('acc_nhis_openings');
          table.string('request_key', 80).notNullable().unique(); table.string('fingerprint', 64).notNullable();
          table.date('reversal_date').notNullable(); table.string('reference', 120).notNullable(); table.string('reason', 1000).notNullable();
          table.integer('created_by').unsigned().notNullable(); table.datetime('created_at').notNullable().defaultTo(db.fn.now());
     });
     if (String(db.client.config.client).includes('mysql')) {
          if (await db.schema.hasTable('billing')) {
               const index = await db('information_schema.STATISTICS').whereRaw('TABLE_SCHEMA = DATABASE()')
                    .where({ TABLE_NAME: 'billing', INDEX_NAME: 'idx_nhis_cohort_branch_date' }).first();
               if (!index) await db.schema.alterTable('billing', table => table.index(['branchid', 'billedon', 'billingid'], 'idx_nhis_cohort_branch_date'));
          }
          for (const table of ['acc_nhis_events', 'acc_nhis_allocations', 'acc_nhis_period_settlements', 'acc_nhis_openings', 'acc_nhis_opening_bills', 'acc_nhis_opening_reversals']) {
               for (const action of ['UPDATE', 'DELETE']) {
                    const name = `trg_${table}_${action.toLowerCase()}_immutable`;
                    const exists = await db('information_schema.TRIGGERS').whereRaw('TRIGGER_SCHEMA = DATABASE()').where({ TRIGGER_NAME: name }).first();
                    if (!exists) await db.raw(`CREATE TRIGGER ?? BEFORE ${action} ON ?? FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'NHIS accounting events are immutable; record a linked reversal'`, [name, table]);
               }
          }
     }
}
