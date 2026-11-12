import { Request, Response } from 'express';
import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { assertSecurityAdministrator, clearAccountCooldown } from '../../models/auth/SecurityActivity';
import { ensureLoginAttemptSecurity } from '../../models/auth/LoginAttemptSecurity';

export async function securityActivity(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
        const actor = getAuthUser(req);
        assertSecurityAdministrator(actor);
        // The authenticated tenant is the sole source of database identity.
        const db = await KnexConnection(actor.tenantId);
        await ensureLoginAttemptSecurity(db);
        if (req.method === 'POST') {
            const result = await clearAccountCooldown(db, actor, req.body?.accountType, req.body?.accountId, req.body?.reason);
            return res.json({ success: true, data: result });
        }
        const page = Number(req.query.page || 1);
        if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) {
            return res.status(400).json({ success: false, error: { message: 'Invalid page' } });
        }
        const sources = [
            { type: 'staff', table: 'roles', column: 'employeeid', nameFields: ['username'], loginField: 'login_username' },
            { type: 'patient', table: 'new_patients', column: 'patientid', nameFields: ['firstname', 'lastname'], loginField: '' },
            { type: 'clinician', table: 'clinicianbasicinfo', column: 'id', nameFields: ['name'], loginField: '' },
        ];
        const availableSources = [];
        for (const source of sources) {
            if (!await db.schema.hasTable(source.table)) continue;
            const fields: string[] = [];
            for (const field of [...source.nameFields, source.loginField].filter(Boolean)) {
                if (await db.schema.hasColumn(source.table, field)) fields.push(field);
            }
            if (fields.length) availableSources.push({ ...source, fields });
        }
        const query = db('security_activity');
        const search = String(req.query.search || '').trim();
        if (search.length > 100) return res.status(400).json({ success: false, error: { message: 'Search must be 100 characters or fewer' } });
        const matchAccount = (outerTable: string) => function (this: Knex.QueryBuilder) {
                this.whereRaw('1 = 0');
                for (const source of availableSources) {
                    this.orWhere(function () {
                        this.where('account_type', source.type).whereExists(
                            db(source.table).select(db.raw('1'))
                                .whereRaw('?? = ??', [`${source.table}.${source.column}`, `${outerTable}.account_id`])
                                .where(function () {
                                    for (const field of source.fields) this.orWhere(field, 'like', `%${search}%`);
                                }),
                        );
                    });
                }
        };
        if (search) query.where(matchAccount('security_activity'));
        if (req.query.action) {
            if (!['login_failed', 'login_locked', 'login_blocked', 'login_success', 'admin_unlock'].includes(String(req.query.action))) {
                return res.status(400).json({ success: false, error: { message: 'Invalid activity filter' } });
            }
            query.where('action', String(req.query.action));
        }
        if (req.query.accountType) {
            if (!['staff', 'patient', 'clinician'].includes(String(req.query.accountType))) {
                return res.status(400).json({ success: false, error: { message: 'Invalid account type' } });
            }
            query.where('account_type', String(req.query.accountType));
        }
        if (req.query.accountId) {
            const id = Number(req.query.accountId);
            if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false, error: { message: 'Invalid account ID' } });
            query.where('account_id', id);
        }
        const count = await query.clone().count({ total: '*' }).first();
        const events = await query.orderBy('id', 'desc').limit(50).offset((page - 1) * 50);
        const cooldownQuery = db('login_attempt_security')
            .select(db.raw("'staff' as account_type"), 'employeeid as account_id', 'locked_until', 'level')
            .where('locked_until', '>', Date.now())
            .unionAll(db('portal_login_attempt_security').select('account_type', 'account_id', 'locked_until', 'level').where('locked_until', '>', Date.now()));
        if (await db.schema.hasTable('patient_portal_accounts')) {
            cooldownQuery.unionAll(db('patient_portal_accounts')
                .select(db.raw("'patient' as account_type"), 'patientid as account_id', db.raw('UNIX_TIMESTAMP(locked_until) * 1000 as locked_until'), db.raw('0 as level'))
                .where('locked_until', '>', new Date(Date.now())));
        }
        const grouped = db.from(cooldownQuery.as('cooldowns')).select('account_type', 'account_id')
            .max({locked_until:'locked_until',level:'level'}).groupBy('account_type','account_id');
        const active = db.from(grouped.as('active_cooldowns'));
        if (req.query.accountType) active.where('account_type', String(req.query.accountType));
        if (req.query.accountId) active.where('account_id', Number(req.query.accountId));
        if (search) active.where(matchAccount('active_cooldowns'));
        const activeCount = await active.clone().count({ total: '*' }).first();
        const cooldowns = await active.select('*').orderBy('locked_until', 'desc').limit(50).offset((page - 1) * 50);
        const names = new Map<string, string>();
        const usernames = new Map<string, string>();
        for (const source of availableSources) {
            const ids = [...new Set([...events, ...cooldowns].filter(row => row.account_type === source.type).map(row => row.account_id))];
            if (source.type === 'staff') ids.push(...events.map(row => row.actor_id).filter((id): id is number => Number(id) > 0));
            if (!ids.length) continue;
            const people = await db(source.table).select(source.column, ...source.fields).whereIn(source.column, ids);
            for (const person of people) {
                const key = `${source.type}-${person[source.column]}`;
                names.set(key, source.nameFields.map(field => person[field] || '').join(' ').trim());
                usernames.set(key, person[source.loginField] || '');
            }
        }
        const display = (row: typeof events[number]) => ({
            ...row,
            account_name: names.get(`${row.account_type}-${row.account_id}`) || '',
            account_username: usernames.get(`${row.account_type}-${row.account_id}`) || '',
            actor_name: names.get(`staff-${row.actor_id}`) || '',
            actor_username: usernames.get(`staff-${row.actor_id}`) || '',
        });
        return res.json({ success: true, data: { events:events.map(display), cooldowns:cooldowns.map(display), activeTotal: Number(activeCount?.total || 0), total: Number(count?.total || 0), page } });
    } catch (error) {
        const status = Number((error as { statusCode?: number }).statusCode) || 500;
        return res.status(status).json({ success: false, error: { message: status < 500 && error instanceof Error ? error.message : 'Unable to load or update security activity' } });
    }
}
