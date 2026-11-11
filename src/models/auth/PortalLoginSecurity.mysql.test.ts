import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import knex, { Knex } from 'knex';
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { parse } from 'dotenv';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../patient-portal/PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: mocks.connection }));
vi.mock('../patient-portal/PatientPortalSettings', () => ({ PatientPortalSettingsService: class { async get() { return { portal_enabled: true }; } } }));
import AuthenticationRepository from '../settings/users/AuthenticationRepository';
import { PatientPortalAccountService } from '../patient-portal/PatientPortalAccountService';
import { verifyPractitionerCredentials } from './PractitionerLoginSecurity';
import { clearLoginAttempts, ensureLoginAttemptSecurity, LoginCooldownError } from './LoginAttemptSecurity';

describe.runIf(process.env.LOGIN_MYSQL_TEST === '1')('real MySQL login cooldown and identity isolation', () => {
    let admin: mysql.Connection;
    const databases: Array<{ name: string; db: Knex }> = [];
    let now: number;
    beforeAll(async () => {
        const env = parse(readFileSync('.env'));
        if (!['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST) || env.NODE_ENV === 'production') throw new Error('Local non-production MySQL is required');
        const connection = { host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USERNAME, password: env.DB_PASSWORD };
        admin = await mysql.createConnection(connection);
        const hash = await bcrypt.hash('Training123', 4);
        for (let index = 0; index < 2; index++) {
            const name = `codex_login_${Date.now()}_${randomBytes(4).toString('hex')}`;
            await admin.query('CREATE DATABASE ??', [name]);
            const db = knex({ client: 'mysql2', connection: { ...connection, database: name }, pool: { min: 0, max: 8 } });
            databases.push({ name, db });
            await db.schema.createTable('roles', t => { t.integer('employeeid').primary(); t.string('password'); });
            await db.schema.createTable('clinicianscredentials', t => { t.integer('clinicianid').primary(); t.string('password'); });
            await db.schema.createTable('patient_portal_accounts', t => {
                t.integer('patientid').primary(); t.string('status'); t.integer('session_version'); t.integer('failed_attempts').defaultTo(0);
                t.datetime('locked_until'); t.datetime('last_login_at'); t.datetime('updated_at');
            });
            await db.schema.createTable('patients_credentials', t => { t.integer('patientid').primary(); t.string('password'); });
            await db.schema.createTable('new_patients', t => { t.integer('patientid').primary(); t.string('firstname'); t.string('lastname'); t.string('email'); t.string('fullpatientid'); });
            await ensureLoginAttemptSecurity(db);
            await db('roles').insert({ employeeid: 7, password: hash });
            await db('clinicianscredentials').insert({ clinicianid: 7, password: hash });
            await db('patient_portal_accounts').insert({ patientid: 7, status: 'active', session_version: 3 });
            await db('patients_credentials').insert({ patientid: 7, password: hash });
            await db('new_patients').insert({ patientid: 7, firstname: 'Training' });
        }
        mocks.connection.mockImplementation(async (tenant: number) => databases[tenant - 1].db);
        now = Date.now();
        vi.spyOn(Date, 'now').mockImplementation(() => now);
    });
    afterAll(async () => {
        vi.restoreAllMocks();
        for (const { name, db } of databases) {
            await db.destroy();
            if (!/^codex_login_\d+_[a-f0-9]{8}$/.test(name)) throw new Error('Unsafe fixture name');
            await admin.query('DROP DATABASE ??', [name]);
        }
        await admin?.end();
    });
    async function attempt(type: 'staff' | 'patient' | 'clinician', tenant = 1, password = 'wrong') {
        try {
            if (type === 'staff') return await new AuthenticationRepository(tenant).validatePassword('s0007', password) ? 'ok' : 'invalid';
            if (type === 'clinician') return await verifyPractitionerCredentials(databases[tenant - 1].db, 7, row => bcrypt.compare(password, row.password)) ? 'ok' : 'invalid';
            const result = await new PatientPortalAccountService(tenant).authenticate(7, password);
            return result.ok ? 'ok' : result.reason === 'LOCKED' ? result.retryAfter : 'invalid';
        } catch (error) { if (error instanceof LoginCooldownError) return error.retryAfter; throw error; }
    }
    for (const type of ['staff', 'patient', 'clinician'] as const) {
        it(`${type} serializes concurrent failures across MySQL connections and escalates after expiry`, async () => {
            const raced = await Promise.all(Array.from({ length: 20 }, () => attempt(type)));
            expect(raced.filter(result => result === 'invalid')).toHaveLength(4);
            expect(raced.filter(result => result === 60)).toHaveLength(16);
            expect(await attempt(type, 1, 'Training123')).toBe(60);
            expect(await attempt(type, 2, 'Training123')).toBe('ok');
            now += 60_000;
            for (const wait of [300, 900, 1800, 3600, 3600]) {
                expect(await attempt(type)).toBe('invalid');
                expect(await attempt(type)).toBe('invalid');
                expect(await attempt(type)).toBe(wait);
                expect(await attempt(type, 1, 'Training123')).toBe(wait);
                now += wait * 1000;
            }
            expect(await attempt(type, 1, 'Training123')).toBe('ok');
        });
    }
    it('keeps patient, staff and practitioner counters separate and clears only the recovered identity', async () => {
        for (let i = 0; i < 5; i++) await attempt('patient');
        expect(await attempt('staff', 1, 'Training123')).toBe('ok');
        expect(await attempt('clinician', 1, 'Training123')).toBe('ok');
        await databases[0].db.transaction(trx => clearLoginAttempts(trx, 'patient', 7));
        expect(await attempt('patient', 1, 'Training123')).toBe('ok');
    });
    it('honors pre-upgrade patient locks and account disablement', async () => {
        await databases[0].db('patient_portal_accounts').where({ patientid: 7 }).update({ locked_until: new Date(now + 120000) });
        expect(await attempt('patient', 1, 'Training123')).toBe(120);
        await databases[0].db('patient_portal_accounts').where({ patientid: 7 }).update({ locked_until: null, status: 'disabled' });
        expect(await new PatientPortalAccountService(1).authenticate(7, 'Training123')).toMatchObject({ ok: false, reason: 'DISABLED' });
    });
});
