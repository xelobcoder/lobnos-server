import type { Knex } from 'knex';
export async function ensureArkeselSchema(db: Knex) {
 const additions: Record<string, Record<string, (t: Knex.CreateTableBuilder) => void>> = {
  sms_provider_settings: {
   webhook_secret: t => t.text('webhook_secret').nullable(), require_signed_webhooks: t => t.boolean('require_signed_webhooks').notNullable().defaultTo(false),
   sandbox: t => t.boolean('sandbox').notNullable().defaultTo(false), paused_reason: t => t.string('paused_reason', 200).nullable(), low_credit_threshold: t => t.integer('low_credit_threshold').unsigned().notNullable().defaultTo(100),
  },
  sms_campaign_dispatch: {
   sandbox: t => t.boolean('sandbox').notNullable().defaultTo(false), event_key: t => t.string('event_key',64).nullable().unique(), block_reason: t => t.string('block_reason',200).nullable(),
  },
  primesmsjobrecipients: {
   provider_segments: t => t.integer('provider_segments').unsigned().nullable(), provider_status: t => t.string('provider_status',40).nullable(),
  },
 };
 for (const [table, columns] of Object.entries(additions)) {
  if (!(await db.schema.hasTable(table))) continue;
  for (const [column, add] of Object.entries(columns)) if (!(await db.schema.hasColumn(table,column))) await db.schema.alterTable(table, add);
 }
 if(await db.schema.hasTable('sms_provider_settings')) {
  const info:any=await db('sms_provider_settings').columnInfo('api_key');
  if(String(info.api_key?.type??info.type).includes('varchar')) await db.schema.alterTable('sms_provider_settings',t=>{t.text('api_key').notNullable().alter();});
 }
 if (!(await db.schema.hasTable('sms_webhook_events'))) await db.schema.createTable('sms_webhook_events', t => {
  t.string('event_id',128).primary(); t.string('payload_hash',64).notNullable(); t.integer('jobid').unsigned().notNullable(); t.dateTime('received_at').notNullable().defaultTo(db.fn.now());
 });
}
