import type { Knex } from 'knex';
export async function ensureSmsContactGroupSchema(db:Knex){
 if(!await db.schema.hasTable('sms_contact_groups'))await db.schema.createTable('sms_contact_groups',t=>{
  t.increments('id');t.string('name',100).notNullable();t.string('category',24).notNullable();t.string('remote_name',100).notNullable().unique();t.string('provider_fingerprint',64).notNullable();
  t.boolean('remote_created').notNullable().defaultTo(false);t.integer('branch_id').nullable().index();t.integer('created_by').notNullable();t.timestamps(true,true);
 });
 if(!await db.schema.hasColumn('sms_contact_groups','provider_contact_mode'))await db.schema.alterTable('sms_contact_groups',t=>{t.string('provider_contact_mode',24).notNullable().defaultTo('v2');});
 if(!await db.schema.hasTable('sms_contact_group_members'))await db.schema.createTable('sms_contact_group_members',t=>{
  t.increments('id');t.integer('group_id').notNullable().index();t.string('phone_hash',64).notNullable();t.dateTime('synced_at').notNullable().defaultTo(db.fn.now());t.unique(['group_id','phone_hash']);
 });
 if(!await db.schema.hasTable('sms_contact_sync_runs'))await db.schema.createTable('sms_contact_sync_runs',t=>{
  t.increments('id');t.integer('group_id').notNullable().index();t.string('request_key',36).notNullable().unique();t.string('review_hash',64).notNullable();t.string('state',24).notNullable().defaultTo('queued');
  t.text('payload','longtext').notNullable();t.integer('total').notNullable();t.integer('position').notNullable().defaultTo(0);t.integer('attempt_count').notNullable().defaultTo(0);t.string('phase',16).nullable();
  t.string('lease_token',36).nullable();t.dateTime('lease_until').nullable();t.string('last_error',250).nullable();t.integer('created_by').notNullable();t.integer('authorized_by').notNullable();
  t.integer('resolved_by').nullable();t.dateTime('resolved_at').nullable();t.timestamps(true,true);t.index(['state','updated_at']);
 });
}
