import {describe,it,expect,afterEach} from 'vitest';
import {accountingSqlDatabase} from '../../../testSupport/accountingSqlDatabase';
import {ensureArkeselSchema} from './ArkeselSchema';
let db:any;afterEach(async()=>{if(db)await db.destroy();});
describe('Arkesel additive schema upgrade',()=>{
 it('upgrades existing queues/provider settings idempotently without altering stored messages or credentials',async()=>{
  ({db}=accountingSqlDatabase());
  await db.schema.createTable('sms_provider_settings',(t:any)=>{t.integer('id').primary();t.string('api_key',500).notNullable();});await db('sms_provider_settings').insert({id:1,api_key:'legacy-key'});
  await db.schema.createTable('sms_campaign_dispatch',(t:any)=>t.integer('jobid').primary());await db('sms_campaign_dispatch').insert({jobid:5});
  await db.schema.createTable('primesmsjobrecipients',(t:any)=>{t.integer('recid').primary();t.text('personalizedbody');});await db('primesmsjobrecipients').insert({recid:5,personalizedbody:'Retain this message'});
  await ensureArkeselSchema(db);await ensureArkeselSchema(db);
  expect((await db('sms_provider_settings').first()).api_key).toBe('legacy-key');expect((await db('sms_campaign_dispatch').first()).sandbox).toBe(0);expect((await db('primesmsjobrecipients').first()).personalizedbody).toBe('Retain this message');
  expect(await db.schema.hasColumn('sms_provider_settings','webhook_secret')).toBe(true);expect(await db.schema.hasTable('sms_webhook_events')).toBe(true);
 });
});
