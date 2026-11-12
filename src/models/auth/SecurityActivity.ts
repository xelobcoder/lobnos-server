import type { Knex } from 'knex';
import type { AuthUser } from '../../middleware/authority';
import { normalizeRole } from '../../middleware/roles';

export async function ensureSecurityActivity(db: Knex): Promise<void> {
    if (await db.schema.hasTable('security_activity')) return;
    try {
        await db.schema.createTable('security_activity', table => {
            table.increments('id');
            table.string('account_type', 16).notNullable();
            table.integer('account_id').notNullable();
            table.string('action', 32).notNullable();
            table.integer('actor_id').nullable();
            table.string('reason', 1000).nullable();
            table.integer('level').notNullable();
            table.bigInteger('locked_until').notNullable();
            table.timestamp('created_at').defaultTo(db.fn.now());
            table.index(['account_type', 'account_id', 'id']);
        });
    } catch (error) { if (!(await db.schema.hasTable('security_activity'))) throw error; }
}

export async function recordSecurityActivity(
    db: Knex, type: string, id: number, action: string,
    level: number, until: number, actor?: number, reason?: string,
): Promise<void> {
    await db('security_activity').insert({
        account_type: type,
        account_id: id,
        action,
        level,
        locked_until: until,
        actor_id: actor ?? null,
        reason: reason ?? null,
    });
}

export function assertSecurityAdministrator(actor: AuthUser | null): asserts actor is AuthUser {
    if (!actor) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
    if (!Number.isSafeInteger(actor.tenantId) || actor.tenantId <= 0
        || !Number.isSafeInteger(actor.employeeid) || actor.employeeid <= 0
        || !['admin', 'superadmin'].includes(normalizeRole(actor.role))) {
        throw Object.assign(new Error('Administrator access required'), { statusCode: 403 });
    }
}

export async function clearLoginAttempts(
    trx: Knex.Transaction, accountType: 'staff' | 'patient' | 'clinician', accountId: number,
): Promise<void> {
    if (accountType === 'staff') {
        await trx('login_attempt_security').where({ employeeid: accountId }).del();
        return;
    }
    await trx('portal_login_attempt_security').where({ account_type: accountType, account_id: accountId }).del();
}

export async function clearAccountCooldown(
    db: Knex, actor: AuthUser, type: string, id: number, reason: string,
): Promise<{ cleared: boolean }> {
    assertSecurityAdministrator(actor);
    if (!['staff', 'patient', 'clinician'].includes(type)
        || !Number.isSafeInteger(id) || id <= 0
        || typeof reason !== 'string' || !reason.trim() || reason.length > 1000) {
        throw Object.assign(new Error('Select an account and provide an unlock reason'), { statusCode: 400 });
    }
    return db.transaction(async trx => {
        const table = type === 'staff' ? 'roles' : type === 'patient' ? 'patient_portal_accounts' : 'clinicianscredentials';
        const column = type === 'staff' ? 'employeeid' : type === 'patient' ? 'patientid' : 'clinicianid';
        // Match the login lock order so login and unlock operations serialize on the same identity.
        const account = await trx(table).where({ [column]: id }).forUpdate().first();
        if (!account) throw Object.assign(new Error('Account not found'), { statusCode: 404 });
        const stateTable = type === 'staff' ? 'login_attempt_security' : 'portal_login_attempt_security';
        const identity = type === 'staff' ? { employeeid: id } : { account_type: type, account_id: id };
        const state = await trx(stateTable).where(identity).first();
        const legacyUntil = type === 'patient' && account.locked_until ? new Date(account.locked_until).getTime() : 0;
        if (!Number(state?.failures) && !Number(state?.level) && !Number(state?.locked_until) && !legacyUntil) {
            return { cleared: false };
        }
        await recordSecurityActivity(
            trx, type, id, 'admin_unlock', Number(state?.level || 0),
            Math.max(Number(state?.locked_until || 0), legacyUntil), actor.employeeid, reason.trim(),
        );
        await clearLoginAttempts(trx, type as 'staff' | 'patient' | 'clinician', id);
        if (type === 'patient') {
            await trx(table).where({ patientid: id }).update({ locked_until: null, failed_attempts: 0 });
        }
        return { cleared: true };
    });
}
