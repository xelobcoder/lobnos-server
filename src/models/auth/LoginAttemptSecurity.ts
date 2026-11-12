import type { Knex } from 'knex';
import { ensureSecurityActivity, recordSecurityActivity } from './SecurityActivity';
export { clearLoginAttempts } from './SecurityActivity';

const waits = [60, 300, 900, 1800, 3600];

export class LoginCooldownError extends Error {
    readonly code = 'LOGIN_COOLDOWN';
    constructor(readonly retryAfter: number) {
        super(`Too many incorrect passwords. Please try again in ${retryAfter} seconds.`);
    }
}

export async function ensureLoginAttemptSecurity(db: Knex): Promise<void> {
    await ensurePortalLoginAttemptSecurity(db);
    if (await db.schema.hasTable('login_attempt_security')) return;
    try {
        await db.schema.createTable('login_attempt_security', table => {
            table.integer('employeeid').primary();
            table.integer('failures').notNullable().defaultTo(0);
            table.integer('level').notNullable().defaultTo(0);
            table.bigInteger('locked_until').notNullable().defaultTo(0);
        });
    } catch (error) {
        // A second server can provision the same tenant concurrently.
        if (!(await db.schema.hasTable('login_attempt_security'))) throw error;
    }
}

export async function ensurePortalLoginAttemptSecurity(db: Knex): Promise<void> {
    await ensureSecurityActivity(db);
    if (await db.schema.hasTable('portal_login_attempt_security')) return;
    try {
        await db.schema.createTable('portal_login_attempt_security', table => {
            table.string('account_type', 16).notNullable();
            table.integer('account_id').notNullable();
            table.primary(['account_type', 'account_id']);
            table.integer('failures').notNullable().defaultTo(0);
            table.integer('level').notNullable().defaultTo(0);
            table.bigInteger('locked_until').notNullable().defaultTo(0);
        });
    } catch (error) {
        if (!(await db.schema.hasTable('portal_login_attempt_security'))) throw error;
    }
}

export function nextFailedLogin(state: { failures: number; level: number }, now: number) {
    const failures = Number(state.failures) + 1;
    const level = Number(state.level);
    if (failures < (level === 0 ? 5 : 3)) return { failures, level, locked_until: 0 };
    return { failures: 0, level: Math.min(level + 1, waits.length), locked_until: now + waits[Math.min(level, waits.length - 1)] * 1000 };
}

/** Caller holds the account row lock so aliases and concurrent processes share one counter. */
export async function verifyStaffPassword(
    trx: Knex.Transaction, employeeid: number, verify: () => Promise<boolean>, now = Date.now(),
): Promise<{ matched: boolean; retryAfter?: number }> {
    return verifyPasswordAttempt(trx, 'login_attempt_security', { employeeid }, verify, now);
}

/** Caller locks the patient account or practitioner credentials before checking the counter. */
export async function verifyPortalPassword(
    trx: Knex.Transaction, accountType: 'patient' | 'clinician', accountId: number,
    verify: () => Promise<boolean>, now = Date.now(),
): Promise<{ matched: boolean; retryAfter?: number }> {
    return verifyPasswordAttempt(trx, 'portal_login_attempt_security', { account_type: accountType, account_id: accountId }, verify, now);
}

async function verifyPasswordAttempt(
    trx: Knex.Transaction, table: string, identity: Record<string, string | number>,
    verify: () => Promise<boolean>, now: number,
): Promise<{ matched: boolean; retryAfter?: number }> {
    const state = await trx(table).where(identity).first() || { failures: 0, level: 0, locked_until: 0 };
    const remaining = Number(state.locked_until) - now;
    const type = String(identity.account_type || 'staff');
    const id = Number(identity.account_id ?? identity.employeeid);
    if (remaining > 0) {
        await recordSecurityActivity(trx, type, id, 'login_blocked', Number(state.level), Number(state.locked_until));
        return { matched: false, retryAfter: Math.ceil(remaining / 1000) };
    }
    const matched = await verify();
    const next = matched ? { failures: 0, level: 0, locked_until: 0 } : nextFailedLogin(state, now);
    await trx(table).insert({ ...identity, ...next }).onConflict(Object.keys(identity)).merge(next);
    const action = matched ? 'login_success' : next.locked_until ? 'login_locked' : 'login_failed';
    await recordSecurityActivity(trx, type, id, action, next.level, Number(next.locked_until));
    const retryAfter = Number(next.locked_until) > now ? Math.ceil((Number(next.locked_until) - now) / 1000) : undefined;
    return { matched, retryAfter };
}
