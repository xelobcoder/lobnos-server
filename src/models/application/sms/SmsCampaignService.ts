import { createHash, randomBytes } from 'crypto';
import KnexConnection from '../../../database/KnexConnections';
import { AuthUser } from '../../../middleware/authority';
import { roleAllowed } from '../../../middleware/roles';
import { CreateSmsJobDto, CreateSmsJobSchema } from './dtos/CreateSmsJobDto';
import { SmsMessageParser } from './PrimeSms/SmsMessageParser';
import { normalizeSmsPhone, smsMessageMetrics } from './SmsMessageMetrics';

const sources = { patient: { table: 'new_patients', id: 'patientid', phone: 'mobile_number' },
    clinician: { table: 'clinicianbasicinfo', id: 'id', phone: 'phone' }, organization: { table: 'organization', id: 'id', phone: 'mobile' } };
export function smsFailure(message: string, statusCode = 400): never { throw Object.assign(new Error(message), { statusCode }); }
export function scopeSmsCampaigns(query: any, actor: AuthUser, alias = 'j') {
    if (roleAllowed(actor.role, ['admin'])) return query;
    // Legacy records have no dispatch row; their creator's branch remains the fallback.
    if (actor.branch == null) return query.where(`${alias}.createdby`, actor.employeeid);
    return query.where(function(this: any) {
        this.where('d.branchid', actor.branch).orWhere(function(this: any) {
            this.whereNull('d.jobid').where('r.branch', actor.branch);
        });
    });
}
export function scopeSmsAudience(query: any, category: string, actor: AuthUser) {
    if (category !== 'patient' || roleAllowed(actor.role, ['admin'])) return query;
    if (actor.branch == null) return query.where('new_patients.registeredby', actor.employeeid);
    // Patients registered by this branch or billed here are available to its staff.
    return query.where(function(this: any) {
        this.whereExists(function(this: any) {
            this.select('staff.employeeid').from('roles as staff').whereRaw('staff.employeeid = new_patients.registeredby').where('staff.branch', actor.branch);
        }).orWhereExists(function(this: any) {
            this.select('b.billingid').from('billing as b').whereRaw('b.patientid = new_patients.patientid').where('b.branchid', actor.branch);
        });
    });
}
export class SmsCampaignService {
    constructor(private tenantId: number, private dbOverride?: any) {}
    private async db(actor?: AuthUser) {
        if (actor && Number(actor.tenantId) !== Number(this.tenantId)) smsFailure('SMS tenant mismatch', 403);
        return this.dbOverride || KnexConnection(this.tenantId);
    }
    async plan(input: unknown, actor: AuthUser) {
        if (Number(actor.tenantId) !== Number(this.tenantId)) smsFailure('SMS tenant mismatch', 403);
        const dto = CreateSmsJobSchema.parse({ ...(input as any), createdBy: actor.employeeid });
        const db = await this.db(actor), source = sources[dto.category];
        let body = dto.customBody;
        if (!body) {
            const template = await db('primesmstemplates').where({ templateid: dto.templateId }).first();
            if (!template || template.category !== dto.category) smsFailure('Choose a template for the selected recipient category');
            body = template.body;
        }
        const ids = [...new Set(dto.targetIds?.map(target => Number(target.id)) || [])];
        let query = scopeSmsAudience(db(source.table).select('*').orderBy(source.id, 'asc'), dto.category, actor);
        if (dto.recipientScope !== 'all') query = query.whereIn(source.id, ids);
        const rows: any[] = await query;
        if (dto.recipientScope !== 'all' && rows.length !== ids.length) smsFailure('Some selected recipients are no longer available. Review the audience again.');
        const recipients: Array<{ refid: number; phonee164: string; personalizedbody: string }> = [];
        const seen = new Set<string>(); let excluded = 0, duplicates = 0, segments = 0;
        for (const row of rows) {
            const phone = normalizeSmsPhone(row[source.phone]);
            if (!phone) { excluded++; continue; }
            if (seen.has(phone)) { duplicates++; continue; }
            const personalizedbody = dto.customBody ? body : SmsMessageParser.parse(body, row);
            if (!personalizedbody?.trim()) { excluded++; continue; }
            seen.add(phone); segments += smsMessageMetrics(personalizedbody).segments;
            recipients.push({ refid: Number(row[source.id]), phonee164: phone, personalizedbody });
        }
        const hash = createHash('sha256').update(JSON.stringify({ category: dto.category, scope: dto.recipientScope,
            sendType: dto.sendType, scheduledAt: dto.scheduledAt || null, recipients })).digest('hex');
        return { dto, recipients, fingerprint: hash, recipientCount: recipients.length, excluded, duplicates, segmentCount: segments,
            sample: recipients.slice(0, 3).map(row => ({ phone: '••••' + row.phonee164.slice(-4), message: row.personalizedbody,
                ...smsMessageMetrics(row.personalizedbody) })) };
    }
    async preview(input: unknown, actor: AuthUser) {
        const { dto, recipients, ...preview } = await this.plan(input, actor); return preview;
    }
    async enqueue(input: any, actor: AuthUser): Promise<number> {
        if (input.requestKey != null && (typeof input.requestKey !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestKey))) smsFailure('Invalid campaign request key');
        if (input.reviewFingerprint != null && !/^[a-f0-9]{64}$/.test(input.reviewFingerprint)) smsFailure('Invalid campaign review');
        const db = await this.db(actor);
        if (input.requestKey) {
            const existing = await db('sms_campaign_dispatch as d').join('primesmsjobs as j', 'j.jobid', 'd.jobid')
                .where('d.request_key', input.requestKey).select('j.*', 'd.review_hash').first();
            if (existing) {
                if (Number(existing.createdby) !== Number(actor.employeeid) || existing.review_hash !== input.reviewFingerprint) smsFailure('This request key belongs to another campaign', 409);
                return Number(existing.jobid);
            }
        }
        const plan = await this.plan(input, actor);
        if (!plan.recipientCount) smsFailure('No valid recipients remain. Correct their contact details before sending.');
        if (input.reviewFingerprint && input.reviewFingerprint !== plan.fingerprint) smsFailure('The message or audience changed. Review the latest campaign before sending.', 409);
        try {
            return await db.transaction(async (trx: any) => {
                const [id] = await trx('primesmsjobs').insert({ category: plan.dto.category, recipientscope: plan.dto.recipientScope,
                    custombody: plan.dto.customBody || null, templateid: plan.dto.customBody ? null : plan.dto.templateId,
                    sendtype: plan.dto.sendType, scheduledat: plan.dto.scheduledAt ? new Date(plan.dto.scheduledAt) : null,
                    createdby: actor.employeeid, status: plan.dto.sendType === 'scheduled' ? 'scheduled' : 'pending' });
                for (let offset = 0; offset < plan.recipients.length; offset += 200) {
                    await trx('primesmsjobrecipients').insert(plan.recipients.slice(offset, offset + 200).map(row => ({ ...row, jobid: id, deliverystatus: 'queued' })));
                }
                await trx('sms_campaign_dispatch').insert({ jobid: id, request_key: input.requestKey || null,
                    review_hash: plan.fingerprint, branchid: actor.branch, callback_token: randomBytes(32).toString('hex'),
                    state: 'queued', available_at: plan.dto.scheduledAt ? new Date(plan.dto.scheduledAt) : new Date() });
                return Number(id);
            });
        } catch (error: any) {
            if (error?.code === 'ER_DUP_ENTRY' && input.requestKey) {
                const existing = await db('sms_campaign_dispatch as d').join('primesmsjobs as j', 'j.jobid', 'd.jobid')
                    .where('d.request_key', input.requestKey).select('j.createdby', 'd.jobid', 'd.review_hash').first();
                if (existing && Number(existing.createdby) === actor.employeeid && existing.review_hash === plan.fingerprint) return Number(existing.jobid);
            }
            throw error;
        }
    }
    async find(id: number, actor: AuthUser) {
        const db = await this.db(actor);
        return scopeSmsCampaigns(db('primesmsjobs as j').leftJoin('sms_campaign_dispatch as d', 'd.jobid', 'j.jobid')
            .leftJoin('roles as r', 'r.employeeid', 'j.createdby').where('j.jobid', id).select('j.*', 'd.state as dispatchstate'), actor).first();
    }
    async list(actor: AuthUser, filters: any = {}) {
        const db = await this.db(actor), page = Math.max(1, Math.floor(Number(filters.page) || 1)), count = Math.min(100, Math.max(1, Math.floor(Number(filters.count) || 10)));
        const base = () => {
            let q = scopeSmsCampaigns(db('primesmsjobs as j').leftJoin('sms_campaign_dispatch as d', 'd.jobid', 'j.jobid')
                .leftJoin('roles as r', 'r.employeeid', 'j.createdby'), actor);
            if (filters.status) q = q.where('j.status', String(filters.status));
            if (filters.category && sources[filters.category]) q = q.where('j.category', filters.category);
            if (/^\d{4}-\d{2}-\d{2}$/.test(filters.from || '')) q = q.where('j.createdat', '>=', filters.from + ' 00:00:00');
            if (/^\d{4}-\d{2}-\d{2}$/.test(filters.to || '')) q = q.where('j.createdat', '<=', filters.to + ' 23:59:59.999');
            return q;
        };
        const total = await base().count('j.jobid as count').first();
        const jobs = await base().select('j.*', 'r.username as createdbyusername', 'd.state as dispatchstate')
            .orderBy('j.createdat', 'desc').orderBy('j.jobid', 'desc').limit(count).offset((page - 1) * count);
        const counts = jobs.length ? await db('primesmsjobrecipients').whereIn('jobid', jobs.map((job: any) => job.jobid))
            .select('jobid', 'deliverystatus').count('* as count').groupBy('jobid', 'deliverystatus') : [];
        for (const job of jobs) job.progress = Object.fromEntries(counts.filter((row: any) => Number(row.jobid) === Number(job.jobid)).map((row: any) => [row.deliverystatus, Number(row.count)]));
        return { jobs, total: Number(total?.count || 0), page, count };
    }
    async cancel(id: number, actor: AuthUser) {
        const db = await this.db(actor);
        if (!(await this.find(id, actor))) smsFailure('Campaign not found', 404);
        return db.transaction(async (trx: any) => {
            await trx('primesmsjobs').where({ jobid: id }).forUpdate().first();
            const dispatch = await trx('sms_campaign_dispatch').where({ jobid: id }).forUpdate().first();
            if (!dispatch || ['completed', 'cancelled'].includes(dispatch.state)) smsFailure('This campaign cannot be cancelled', 409);
            await trx('sms_campaign_dispatch').where({ jobid: id }).update({ state: 'cancelled', cancelled_by: actor.employeeid, updated_at: new Date() });
            await trx('primesmsjobrecipients').where({ jobid: id, deliverystatus: 'queued' }).update({ deliverystatus: 'cancelled' });
            await trx('primesmsjobs').where({ jobid: id }).update({ status: 'cancelled' });
            return true;
        });
    }
    async edit(id: number, patch: any, actor: AuthUser) {
        const db = await this.db(actor), job = await this.find(id, actor);
        if (!job) smsFailure('Campaign not found', 404);
        const recipients = await db('primesmsjobrecipients').where({ jobid: id }).select('refid', 'phonee164');
        const input = { templateId: job.templateid || undefined, customBody: job.custombody || undefined, category: job.category,
            recipientScope: job.recipientscope, sendType: job.sendtype, scheduledAt: job.scheduledat ? new Date(job.scheduledat).toISOString() : undefined,
            targetIds: recipients.map((row: any) => ({ id: row.refid, phone: row.phonee164 })), ...patch };
        if (patch.templateId) input.customBody = undefined;
        const plan = await this.plan(input, actor);
        if (!plan.recipientCount) smsFailure('No valid recipients remain');
        return db.transaction(async (trx: any) => {
            await trx('primesmsjobs').where({ jobid: id }).forUpdate().first();
            const dispatch = await trx('sms_campaign_dispatch').where({ jobid: id }).forUpdate().first();
            if (!dispatch || dispatch.state !== 'queued') smsFailure('Only campaigns awaiting processing can be edited', 409);
            await trx('primesmsjobrecipients').where({ jobid: id }).del();
            for (let offset = 0; offset < plan.recipients.length; offset += 200) await trx('primesmsjobrecipients')
                .insert(plan.recipients.slice(offset, offset + 200).map(row => ({ ...row, jobid: id, deliverystatus: 'queued' })));
            await trx('primesmsjobs').where({ jobid: id }).update({ category: plan.dto.category, recipientscope: plan.dto.recipientScope,
                templateid: plan.dto.customBody ? null : plan.dto.templateId, custombody: plan.dto.customBody || null,
                sendtype: plan.dto.sendType, scheduledat: plan.dto.scheduledAt ? new Date(plan.dto.scheduledAt) : null,
                status: plan.dto.sendType === 'scheduled' ? 'scheduled' : 'pending' });
            await trx('sms_campaign_dispatch').where({ jobid: id }).update({ review_hash: plan.fingerprint,
                available_at: plan.dto.scheduledAt ? new Date(plan.dto.scheduledAt) : new Date(), updated_at: new Date() });
        });
    }
    async retry(id: number, refid: number, actor: AuthUser) {
        const db = await this.db(actor);
        if (!(await this.find(id, actor))) smsFailure('Campaign not found', 404);
        return db.transaction(async (trx: any) => {
            // Lock the parent first so concurrent retries can safely adopt legacy jobs.
            await trx('primesmsjobs').where({ jobid: id }).forUpdate().first();
            let dispatch = await trx('sms_campaign_dispatch').where({ jobid: id }).forUpdate().first();
            if (!dispatch) {
                dispatch = { jobid: id, state: 'completed', available_at: new Date(), branchid: actor.branch, callback_token: randomBytes(32).toString('hex') };
                await trx('sms_campaign_dispatch').insert(dispatch);
            }
            if (['cancelled', 'processing'].includes(dispatch.state)) smsFailure('This campaign cannot be retried while cancelled or processing', 409);
            const record = await trx('primesmsjobrecipients').where({ jobid: id, refid }).forUpdate().first();
            if (!record || record.deliverystatus !== 'failed') smsFailure('Only confirmed failed messages can be retried. Reconcile unknown or submitted messages first.', 409);
            await trx('primesmsjobrecipients').where({ recid: record.recid, deliverystatus: 'failed' }).update({
                deliverystatus: 'queued', errorcode: null, messageid: null, sentat: null,
            });
            await trx('sms_campaign_dispatch').where({ jobid: id }).update({ state: 'queued', available_at: new Date(), updated_at: new Date() });
            await trx('primesmsjobs').where({ jobid: id }).update({ status: 'pending' });
            return { status: 'success', message: 'Retry queued for processing' };
        });
    }
}
