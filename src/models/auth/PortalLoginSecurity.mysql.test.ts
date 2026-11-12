import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import knex, { Knex } from "knex";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";
import { parse } from "dotenv";

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock("../../database/KnexConnections", () => ({ default: mocks.connection }));
vi.mock("../patient-portal/PatientPortalBootstrapper", () => ({ bootstrapPatientPortal: mocks.connection }));
vi.mock("../patient-portal/PatientPortalSettings", () => ({
     PatientPortalSettingsService: class {
          async get() {
               return { portal_enabled: true };
          }
     },
}));
import AuthenticationRepository from "../settings/users/AuthenticationRepository";
import { PatientPortalAccountService } from "../patient-portal/PatientPortalAccountService";
import { verifyPractitionerCredentials } from "./PractitionerLoginSecurity";
import { clearLoginAttempts, ensureLoginAttemptSecurity, LoginCooldownError } from "./LoginAttemptSecurity";
import { clearAccountCooldown } from './SecurityActivity';
import { securityActivity } from '../../controllers/security/SecurityActivityController';
import { NotificationTemplatesRepo } from '../application/notifications/repositories/NotificationTemplatesRepo';
import { EmailLogsRepo } from '../application/email/repositories/EmailLogsRepo';
import { EmailQueueRepo } from '../application/email/repositories/EmailQueueRepo';
import { NotificationQueueRepo } from '../application/notifications/repositories/NotificationQueueRepo';
import { EmailQueueService } from '../application/email/services/EmailQueueService';
import { EmailTemplatesRepo } from '../application/email/repositories/EmailTemplatesRepo';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { EmailSettingsRepo } from '../application/email/repositories/EmailSettingsRepo';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { TemplateRenderer } from '../application/email/services/TemplateRenderer';
import { EmailQueueController } from '../../controllers/email/EmailQueueController';
import { NotificationEventsRepo } from '../application/notifications/repositories/NotificationEventsRepo';
import { NOTIFICATION_EVENT_CATALOG } from '../application/notifications/context/providers/NotificationEventCatalog';
import { bootstrapNotificationDefinitions } from '../application/notifications/services/NotificationBootstrapService';
import { NotificationEventService } from '../application/notifications/services/NotificationEventService';
import { NotificationEventSettingsRepo } from '../application/notifications/repositories/NotificationEventSettingsRepo';
import { NotificationTemplateVariablesRepo } from '../application/notifications/repositories/NotificationTemplateVariablesRepo';
import { NotificationTemplateVersionsRepo } from '../application/notifications/repositories/NotificationTemplateVersionsRepo';
import { NotificationEventContextService } from '../application/notifications/services/NotificationEventContextService';

describe.runIf(process.env.LOGIN_MYSQL_TEST === "1")("real MySQL login cooldown and identity isolation", () => {
     let admin: mysql.Connection;
     const databases: Array<{ name: string; db: Knex }> = [];
     let now: number;
     beforeAll(async () => {
          const env = parse(readFileSync(".env"));
          if (!["localhost", "127.0.0.1", "::1"].includes(env.DB_HOST) || env.NODE_ENV === "production")
               throw new Error("Local non-production MySQL is required");
          const connection = {
               host: env.DB_HOST,
               port: Number(env.DB_PORT || 3306),
               user: env.DB_USERNAME,
               password: env.DB_PASSWORD,
          };
          admin = await mysql.createConnection(connection);
          const hash = await bcrypt.hash("Training123", 4);
          for (let index = 0; index < 3; index++) {
               const name = `codex_login_${Date.now()}_${randomBytes(4).toString("hex")}`;
               await admin.query("CREATE DATABASE ??", [name]);
               const db = knex({
                    client: "mysql2",
                    connection: { ...connection, database: name },
                    pool: { min: 0, max: 8 },
               });
               databases.push({ name, db });
               await db.schema.createTable("roles", (t) => {
                    t.integer("employeeid").primary();
                    t.string("password");
                    t.string('username');
                    t.string('login_username');
               });
               await db.schema.createTable("clinicianscredentials", (t) => {
                    t.integer("clinicianid").primary();
                    t.string("password");
                    t.string('login_username');
               });
               await db.schema.createTable('clinicianbasicinfo', t => { t.integer('id').primary(); t.string('name'); });
               await db.schema.createTable("patient_portal_accounts", (t) => {
                    t.integer("patientid").primary();
                    t.string("status");
                    t.integer("session_version");
                    t.integer("failed_attempts").defaultTo(0);
                    t.datetime("locked_until");
                    t.datetime("last_login_at");
                    t.datetime("updated_at");
               });
               await db.schema.createTable("patients_credentials", (t) => {
                    t.integer("patientid").primary();
                    t.string("password");
                    t.string('login_username');
               });
               await db.schema.createTable("new_patients", (t) => {
                    t.integer("patientid").primary();
                    t.string("firstname");
                    t.string("lastname");
                    t.string("email");
                    t.string("fullpatientid");
               });
               await ensureLoginAttemptSecurity(db);
               await db("roles").insert([
                    { employeeid: 7, password: hash, username: `Facility ${index + 1} Training Staff`, login_username: 'S0007' },
                    { employeeid: 99, password: hash, username: `Facility ${index + 1} Administrator`, login_username: 'S0099' },
               ]);
               await db("clinicianscredentials").insert({ clinicianid: 7, password: hash, login_username:'C0007' });
               await db('clinicianbasicinfo').insert({id:7,name:`Facility ${index + 1} Practitioner`});
               await db("patient_portal_accounts").insert({ patientid: 7, status: "active", session_version: 3 });
               await db("patients_credentials").insert({ patientid: 7, password: hash, login_username:'P0007' });
               await db("new_patients").insert({ patientid: 7, firstname: "Training" });
          }
          mocks.connection.mockImplementation(async (tenant: number) => databases[tenant - 1].db);
          now = Math.floor(Date.now() / 1000) * 1000;
          vi.spyOn(Date, "now").mockImplementation(() => now);
     });
     afterAll(async () => {
          vi.restoreAllMocks();
          for (const { name, db } of databases) {
               await db.destroy();
               if (!/^codex_login_\d+_[a-f0-9]{8}$/.test(name)) throw new Error("Unsafe fixture name");
               await admin.query("DROP DATABASE ??", [name]);
          }
          await admin?.end();
     });
     async function attempt(type: "staff" | "patient" | "clinician", tenant = 1, password = "wrong") {
          try {
               if (type === "staff")
                    return (await new AuthenticationRepository(tenant).validatePassword("s0007", password))
                         ? "ok"
                         : "invalid";
               if (type === "clinician")
                    return (await verifyPractitionerCredentials(databases[tenant - 1].db, 7, (row) =>
                         bcrypt.compare(password, row.password),
                    ))
                         ? "ok"
                         : "invalid";
               const result = await new PatientPortalAccountService(tenant).authenticate(7, password);
               return result.ok ? "ok" : result.reason === "LOCKED" ? result.retryAfter : "invalid";
          } catch (error) {
               if (error instanceof LoginCooldownError) return error.retryAfter;
               throw error;
          }
     }
     for (const type of ["staff", "patient", "clinician"] as const) {
          it(`${type} serializes concurrent failures across MySQL connections and escalates after expiry`, async () => {
               const raced = await Promise.all(Array.from({ length: 20 }, () => attempt(type)));
               expect(raced.filter((result) => result === "invalid")).toHaveLength(4);
               expect(raced.filter((result) => result === 60)).toHaveLength(16);
               expect(await attempt(type, 1, "Training123")).toBe(60);
               expect(await attempt(type, 2, "Training123")).toBe("ok");
               now += 60_000;
               for (const wait of [300, 900, 1800, 3600, 3600]) {
                    expect(await attempt(type)).toBe("invalid");
                    expect(await attempt(type)).toBe("invalid");
                    expect(await attempt(type)).toBe(wait);
                    expect(await attempt(type, 1, "Training123")).toBe(wait);
                    now += wait * 1000;
               }
               expect(await attempt(type, 1, "Training123")).toBe("ok");
          });
     }
     it("keeps patient, staff and practitioner counters separate and clears only the recovered identity", async () => {
          for (let i = 0; i < 5; i++) await attempt("patient");
          expect(await attempt("staff", 1, "Training123")).toBe("ok");
          expect(await attempt("clinician", 1, "Training123")).toBe("ok");
          await databases[0].db.transaction((trx) => clearLoginAttempts(trx, "patient", 7));
          expect(await attempt("patient", 1, "Training123")).toBe("ok");
     });
     it('clears each account type with an administrator audit trail and preserves other tenants and types', async () => {
          const actor = {employeeid: 99, email: 'training@example.invalid', role: 'admin', tenantId: 1, branch: null};
          for (const type of ['staff', 'patient', 'clinician'] as const) {
               for (let index = 0; index < 5; index++) await attempt(type);
          }
          for (let index = 0; index < 5; index++) await attempt('staff', 2);
          const before = await databases[0].db('security_activity').count({total:'*'}).first();
          await expect(clearAccountCooldown(databases[0].db, {...actor, role:'scientist'}, 'staff', 7, 'Verified by administrator')).rejects.toMatchObject({statusCode:403});
          await expect(clearAccountCooldown(databases[0].db, actor, 'staff', 7, ' ')).rejects.toMatchObject({statusCode:400});
          expect(Number((await databases[0].db('security_activity').count({total:'*'}).first())?.total)).toBe(Number(before?.total));
          for (const type of ['staff', 'patient', 'clinician'] as const) {
               expect(await clearAccountCooldown(databases[0].db, actor, type, 7, 'Identity verified by training administrator')).toEqual({cleared:true});
               expect(await attempt(type, 1, 'Training123')).toBe('ok');
          }
          expect(await attempt('staff', 2, 'Training123')).toBe(60);
          const unlocks = await databases[0].db('security_activity').where({action:'admin_unlock'});
          expect(unlocks).toHaveLength(3);
          expect(unlocks.every(row => row.actor_id === 99 && row.reason === 'Identity verified by training administrator' && Number(row.locked_until) > now)).toBe(true);
          expect(await clearAccountCooldown(databases[0].db, actor, 'staff', 7, 'Repeated request')).toEqual({cleared:false});
          expect(await databases[0].db('security_activity').where({action:'admin_unlock'})).toHaveLength(3);
     });
     it('serves tenant-scoped history and rejects unauthorized requests before connecting', async () => {
          const actor = {employeeid:99,email:'training@example.invalid',role:'admin',tenantId:1,branch:null};
          async function request(authUser: typeof actor | null, method = 'GET', query = {}, body = {}) {
               const res: any = {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()};
               await securityActivity({authUser,method,query,body} as any, res);
               return res;
          }
          mocks.connection.mockClear();
          expect((await request(null)).status).toHaveBeenCalledWith(401);
          expect((await request({...actor,role:'clinician'})).status).toHaveBeenCalledWith(403);
          expect(mocks.connection).not.toHaveBeenCalled();
          const res = await request(actor, 'GET', {tenantId:2, accountType:'staff',accountId:7});
          expect(mocks.connection).toHaveBeenLastCalledWith(1);
          expect(res.json.mock.calls[0][0]).toMatchObject({success:true,data:{activeTotal:0}});
          expect(res.json.mock.calls[0][0].data.events.every((event:any) => event.account_type==='staff' && event.account_id===7)).toBe(true);
          expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');
          expect((await request(actor,'GET',{page:-1})).status).toHaveBeenCalledWith(400);
          expect((await request(actor,'POST',{}, {accountType:'staff',accountId:7,reason:''})).status).toHaveBeenCalledWith(400);
          for (let index = 0; index < 5; index++) await attempt('staff');
          const cleared = await request(actor,'POST',{tenantId:2},{accountType:'staff',accountId:7,reason:'Verified caller',actor_id:12,tenantId:2});
          expect(cleared.json).toHaveBeenCalledWith({success:true,data:{cleared:true}});
          expect(await databases[0].db('security_activity').where({action:'admin_unlock'}).orderBy('id','desc').first()).toMatchObject({actor_id:99,reason:'Verified caller'});
          const history = await request(actor, 'GET', {action:'admin_unlock', tenantId:2});
          expect(history.json.mock.calls[0][0].data.events[0]).toMatchObject({
               account_name:'Facility 1 Training Staff', account_username:'S0007',
               actor_name:'Facility 1 Administrator', actor_username:'S0099',
          });
          const search = await request(actor, 'GET', {search:'S0007'});
          expect(search.json.mock.calls[0][0].data.events.length).toBeGreaterThan(0);
          expect(search.json.mock.calls[0][0].data.events.every((event:any) => event.account_type === 'staff' && event.account_id === 7)).toBe(true);
          for (const [username, type] of [['P0007', 'patient'], ['C0007', 'clinician']]) {
               const found = await request(actor, 'GET', {search:username});
               expect(found.json.mock.calls[0][0].data.events.length).toBeGreaterThan(0);
               expect(found.json.mock.calls[0][0].data.events.every((event:any) => event.account_type === type && event.account_username === username)).toBe(true);
          }
          const historyPage = await request(actor, 'GET', {page:2, cooldownPage:1,search:'S0007'});
          expect(historyPage.json.mock.calls[0][0].data.activeTotal).toBe(0);
          expect((await request(actor,'GET',{cooldownPage:'0'})).status).toHaveBeenCalledWith(400);
          const otherFacility = await request(actor, 'GET', {search:'Facility 2',tenantId:2});
          expect(otherFacility.json.mock.calls[0][0].data.events).toHaveLength(0);
          expect(await attempt('staff',2,'Training123')).toBe(60);
     });
     it('rolls back an unlock when its audit record cannot be stored', async () => {
          for (let index = 0; index < 5; index++) await attempt('staff');
          const db = databases[0].db;
          await db.raw("CREATE TRIGGER reject_security_unlock BEFORE INSERT ON security_activity FOR EACH ROW BEGIN IF NEW.action = 'admin_unlock' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Training audit failure'; END IF; END");
          try {
               await expect(clearAccountCooldown(db, {employeeid:99,email:'training@example.invalid',role:'super-admin',tenantId:1,branch:null}, 'staff', 7, 'Training rollback')).rejects.toThrow();
               expect(await attempt('staff', 1, 'Training123')).toBe(60);
          } finally {
               await db.raw('DROP TRIGGER reject_security_unlock');
               await db.transaction(trx => clearLoginAttempts(trx, 'staff', 7));
          }
     });
     it("honors pre-upgrade patient locks and account disablement", async () => {
          await databases[0]
               .db("patient_portal_accounts")
               .where({ patientid: 7 })
               .update({ locked_until: new Date(now + 120000) });
          expect(await attempt("patient", 1, "Training123")).toBe(120);
          await databases[0]
               .db("patient_portal_accounts")
               .where({ patientid: 7 })
               .update({ locked_until: null, status: "disabled" });
          expect(await new PatientPortalAccountService(1).authenticate(7, "Training123")).toMatchObject({
               ok: false,
               reason: "DISABLED",
          });
     });
     it('lists inactive templates only for management and reconciles tenant-local email metrics and notification logs', async () => {
          for (const [index, {db}] of databases.slice(0, 2).entries()) {
               await db.schema.createTable('notification_events', t => {
                    t.increments('id'); t.string('event_code').unique(); t.string('event_name'); t.text('description'); t.string('module'); t.boolean('is_system'); t.boolean('is_active');
               });
               await db.schema.createTable('notification_templates', t => {
                    t.increments('id'); t.integer('event_id'); t.boolean('is_system'); t.boolean('is_default'); t.boolean('is_active'); t.string('template_name'); t.dateTime('updated_at');
               });
               await db('notification_templates').insert([
                    {id:1,event_id:1,is_system:true,is_default:true,is_active:true,template_name:`Facility ${index+1} default`,updated_at:new Date()},
                    {id:2,event_id:1,is_system:false,is_default:false,is_active:false,template_name:'Archived',updated_at:new Date()},
               ]);
               await db.schema.createTable('email_queue', t => {t.increments('id'); t.string('status'); t.string('reference_type'); t.dateTime('created_at'); t.dateTime('sent_at');});
               await db.schema.createTable('email_providers', t => {t.increments('id');t.string('name');});
               await db.schema.createTable('email_logs', t => {
                    t.increments('id'); t.integer('queue_id'); t.integer('provider_id');t.string('status');t.string('subject');t.text('recipients_json');t.text('response_payload_json');t.string('failure_reason');t.integer('duration_ms');t.dateTime('created_at');
               });
               await db.schema.createTable('notification_queue', t => {t.increments('id');t.integer('email_queue_id');t.string('event_code');});
          }
          const db = databases[0].db;
          await db('notification_events').insert({event_code:'PATIENT_CREATED',event_name:'Facility-specific name',is_active:false});
          const events = new NotificationEventsRepo(1);
          await Promise.all([events.ensureCatalogEvents(),events.ensureCatalogEvents()]);
          expect(await events.findAll()).toHaveLength(NOTIFICATION_EVENT_CATALOG.length);
          expect(await events.findByCode('PATIENT_CREATED')).toMatchObject({event_name:'Facility-specific name',is_active:0});
          expect(await new NotificationEventsRepo(2).findAll()).toHaveLength(0);
          await db('email_queue').insert(['pending','scheduled','sent','failed'].map((status,index) => ({id:index+1,status,created_at:new Date()})));
          await db('email_providers').insert({id:1,name:'Training SMTP'});
          await db('email_logs').insert([
               {id:1,queue_id:3,provider_id:1,status:'sent',created_at:new Date(),duration_ms:20},
               {id:2,queue_id:4,provider_id:1,status:'failed',created_at:new Date(),duration_ms:30,failure_reason:'Training provider failure'},
          ]);
          await db('notification_queue').insert({email_queue_id:3,event_code:'TRAINING_EVENT'});
          const templates = new NotificationTemplatesRepo(1);
          expect(await templates.findAll()).toHaveLength(1);
          expect(await templates.findAll(undefined,undefined,true)).toHaveLength(2);
          expect(await templates.findActiveForEvent(1)).toMatchObject({id:1,is_active:1});
          expect(await new NotificationTemplatesRepo(2).findById(1)).toMatchObject({template_name:'Facility 2 default'});
          expect(await templates.findAll(undefined,undefined,true)).toHaveLength(2);
          const metrics = await new EmailQueueRepo(1).getQueueMetrics();
          expect(Number(metrics.total)).toBe(4);
          expect(Number(metrics.scheduled)).toBe(1);
          expect(Number(metrics.pending)+Number(metrics.scheduled)+Number(metrics.sent)+Number(metrics.failed)).toBe(4);
          const logs = new EmailLogsRepo(1);
          const overview = await logs.getOverview(30);
          expect(Number(overview?.total)).toBe(2);
          expect(Number(overview?.sent)+Number(overview?.failed)).toBe(2);
          expect((await logs.getDailyTrend(30)).reduce((sum,row)=>sum+Number(row.total),0)).toBe(2);
          expect((await logs.getProviderPerformance(30)).reduce((sum,row)=>sum+Number(row.total),0)).toBe(2);
          expect(await logs.getStatusBreakdown(30)).toEqual(expect.arrayContaining([expect.objectContaining({status:'sent',total:1}),expect.objectContaining({status:'failed',total:1})]));
          expect(await logs.getFailureReasons(30)).toMatchObject([{failure_reason:'Training provider failure',total:1}]);
          expect(await new EmailLogsRepo(2).getFailureReasons(30)).toHaveLength(0);
          expect(Number((await new EmailLogsRepo(2).getOverview(30))?.total)).toBe(0);
          expect(await new NotificationQueueRepo(1).findLogs()).toMatchObject([{id:1,queue_id:3,provider_id:1,event_code:'TRAINING_EVENT'}]);
          expect(await logs.getEventBreakdown(30)).toEqual(expect.arrayContaining([expect.objectContaining({event_code:'TRAINING_EVENT',total:1}),expect.objectContaining({event_code:'UNKNOWN',total:1})]));
          expect(await new NotificationQueueRepo(2).findLogs()).toHaveLength(0);
          const activationGuard = vi.fn().mockResolvedValue(undefined);
          const service = new EmailQueueService(new EmailQueueRepo(1), logs, new EmailTemplatesRepo(1), new EmailProvidersRepo(1), new EmailSettingsRepo(1), new ProviderFactory(), new TemplateRenderer(), activationGuard);
          const controller = new EmailQueueController(service);
          const response: any = {status:vi.fn().mockReturnThis(),send:vi.fn().mockReturnThis()};
          await controller.getAnalytics({query:{days:'30'}} as any,response);
          expect(activationGuard).toHaveBeenCalledWith(1);
          expect(response.send).toHaveBeenCalledWith(expect.objectContaining({status:'success',statusCode:200,result:expect.objectContaining({periodDays:30,failureReasons:[{failure_reason:'Training provider failure',total:1}]})}));
     });
     it('bootstraps the complete catalog and templates repeatedly without duplicate events or enabling disabled channels', async () => {
          const db = databases[2].db;
          const first = await bootstrapNotificationDefinitions(3);
          const expectedCount = NOTIFICATION_EVENT_CATALOG.length + 3;
          expect(first.seededEvents).toBe(expectedCount);
          expect(first.createdTemplates).toBe(expectedCount);
          const event = await db('notification_events').where({event_code:'PATIENT_CREATED'}).first();
          await db('notification_event_settings').where({event_id:event.id}).update({email_enabled:false});
          const systemTemplate = await db('notification_templates').where({event_id:event.id,is_system:true}).first();
          await db('notification_templates').where({id:systemTemplate.id}).update({subject:'Facility-edited subject',html_body:'<p>Facility-edited content</p>',plain_body:'Facility-edited plain text'});
          const preservedTemplate = await db('notification_templates').where({id:systemTemplate.id}).first();
          const second = await bootstrapNotificationDefinitions(3);
          expect(second.seededEvents).toBe(expectedCount);
          expect(second.createdTemplates).toBe(0);
          expect(Number((await db('notification_events').count({total:'*'}).first())?.total)).toBe(expectedCount);
          expect(Number((await db('notification_templates').count({total:'*'}).first())?.total)).toBe(expectedCount);
          expect(await db('notification_event_settings').where({event_id:event.id}).first()).toMatchObject({email_enabled:0});
          expect(await db('notification_templates').where({id:systemTemplate.id}).first()).toEqual(preservedTemplate);
          const events = new NotificationEventsRepo(3);
          const templates = new NotificationTemplatesRepo(3);
          const settings = new NotificationEventSettingsRepo(3);
          const variables = new NotificationTemplateVariablesRepo(3);
          const context = new NotificationEventContextService(events,templates,variables,new NotificationTemplateVersionsRepo(3),3);
          const service = new NotificationEventService(events,settings,variables,context,3);
          const customId = await templates.create({event_id:event.id,template_name:'Facility custom template',subject:'Custom subject',html_body:'<p>Custom</p>',plain_body:'Custom',is_system:false,is_default:false,is_active:true});
          expect(await service.updateEventSettings('PATIENT_CREATED',{emailEnabled:false,smsEnabled:true,defaultTemplateId:customId})).toMatchObject({email_enabled:0,sms_enabled:1,default_template_id:customId});
          expect(await service.getEventSettings('PATIENT_CREATED')).toMatchObject({email_enabled:0,sms_enabled:1,default_template_id:customId});
          const otherTemplate = await db('notification_templates').whereNot({event_id:event.id}).first();
          await expect(service.updateEventSettings('PATIENT_CREATED',{defaultTemplateId:otherTemplate.id})).rejects.toThrow('belonging to this event');
          await expect(service.updateEventSettings('PATIENT_CREATED',{defaultTemplateId:999999})).rejects.toThrow('belonging to this event');
          await Promise.all([settings.upsert(event.id,{whatsapp_enabled:false}),settings.upsert(event.id,{in_app_enabled:false})]);
          expect(await service.getEventSettings('PATIENT_CREATED')).toMatchObject({email_enabled:0,sms_enabled:1,whatsapp_enabled:0,in_app_enabled:0,default_template_id:customId});
          const sync = await service.syncEventCatalog();
          expect(sync).toHaveLength(expectedCount);
          expect(sync.every(row => !row.templateCreated && !row.templateBackfilled)).toBe(true);
          expect(await templates.findById(customId)).toMatchObject({subject:'Custom subject',html_body:'<p>Custom</p>'});
          expect(await service.getEventSettings('PATIENT_CREATED')).toMatchObject({email_enabled:0,default_template_id:customId});
          const catalog = await service.getEventCatalog() as Array<{event:{event_code:string};template:unknown}>;
          expect(catalog).toHaveLength(expectedCount);
          expect(catalog.every(item=>item.template)).toBe(true);
     }, 30000);
     it('clears a legacy patient cooldown without reactivating the patient or revoking sessions', async () => {
          const db = databases[0].db;
          await db('patient_portal_accounts').where({patientid:7}).update({locked_until:new Date(now + 120000)});
          const res: any = {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()};
          const actor = {employeeid:99,email:'training@example.invalid',role:'admin',tenantId:1,branch:null};
          await securityActivity({authUser:actor,method:'GET',query:{accountType:'patient',accountId:7}} as any,res);
          expect(res.json.mock.calls[0][0].data.cooldowns).toMatchObject([{account_type:'patient',account_id:7}]);
          const paged: any = {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()};
          await securityActivity({authUser:actor,method:'GET',query:{accountType:'patient',search:'P0007',page:2,cooldownPage:1}} as any,paged);
          expect(paged.json.mock.calls[0][0].data.cooldowns).toMatchObject([{account_type:'patient',account_id:7,account_username:'P0007'}]);

          const results = await Promise.all(Array.from({length:4},() => clearAccountCooldown(db,actor,'patient',7,'Verified patient identity')));
          expect(results.filter(result => result.cleared)).toHaveLength(1);
          expect(await db('patient_portal_accounts').where({patientid:7}).first()).toMatchObject({status:'disabled',session_version:3,locked_until:null,failed_attempts:0});
          expect(await new PatientPortalAccountService(1).authenticate(7,'Training123')).toMatchObject({ok:false,reason:'DISABLED'});
     });
});
