import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('../../../../database/KnexConnections',()=>({default:mocks.connect}));
import {accountingSqlDatabase} from '../../../../testSupport/accountingSqlDatabase';
import {SmsProviderSettingsRepo} from './SmsProviderSettingsRepo';
import {ensureArkeselSchema} from '../ArkeselSchema';
let db:any;
beforeEach(async()=>{vi.stubEnv('SMS_SECRET_KEY','dedicated-test-secret-key-at-least-32-characters');({db}=accountingSqlDatabase());mocks.connect.mockResolvedValue(db);await db.schema.createTable('sms_provider_settings',(t:any)=>{t.integer('id').primary();t.string('provider_type');t.string('api_key',500).notNullable();t.string('sender_id');t.string('base_url');t.boolean('is_active');t.integer('updated_by');t.timestamps();});await ensureArkeselSchema(db);});
afterEach(async()=>{await db.destroy();vi.unstubAllEnvs();});
describe('tenant SMS credentials persistence',()=>{
 it('stores maximum-length API/signing keys encrypted and decrypts only for internal use',async()=>{const repo=new SmsProviderSettingsRepo(7),apiKey='k'.repeat(500);await repo.save({provider_type:'arkesel',api_key:apiKey,sender_id:'PrimeLab',base_url:'https://sms.arkesel.com',is_active:true,updated_by:8,webhook_secret:'signing-secret-value'});const raw=await db('sms_provider_settings').first();expect(raw.api_key).toMatch(/^sms:enc:v1:/);expect(raw.api_key.length).toBeGreaterThan(500);expect(raw.webhook_secret).not.toBe('signing-secret-value');expect(await repo.find()).toMatchObject({api_key:apiKey,webhook_secret:'signing-secret-value'});});
 it('continues to read existing plaintext keys before administrators resave configuration',async()=>{await db('sms_provider_settings').insert({id:1,api_key:'legacy-secret'});expect((await new SmsProviderSettingsRepo(7).find())?.api_key).toBe('legacy-secret');});
});
