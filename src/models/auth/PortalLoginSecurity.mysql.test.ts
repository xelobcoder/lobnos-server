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
          for (let index = 0; index < 2; index++) {
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
     it('clears a legacy patient cooldown without reactivating the patient or revoking sessions', async () => {
          const db = databases[0].db;
          await db('patient_portal_accounts').where({patientid:7}).update({locked_until:new Date(now + 120000)});
          const res: any = {setHeader:vi.fn(),status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()};
          const actor = {employeeid:99,email:'training@example.invalid',role:'admin',tenantId:1,branch:null};
          await securityActivity({authUser:actor,method:'GET',query:{accountType:'patient',accountId:7}} as any,res);
          expect(res.json.mock.calls[0][0].data.cooldowns).toMatchObject([{account_type:'patient',account_id:7}]);
          const results = await Promise.all(Array.from({length:4},() => clearAccountCooldown(db,actor,'patient',7,'Verified patient identity')));
          expect(results.filter(result => result.cleared)).toHaveLength(1);
          expect(await db('patient_portal_accounts').where({patientid:7}).first()).toMatchObject({status:'disabled',session_version:3,locked_until:null,failed_attempts:0});
          expect(await new PatientPortalAccountService(1).authenticate(7,'Training123')).toMatchObject({ok:false,reason:'DISABLED'});
     });
});
