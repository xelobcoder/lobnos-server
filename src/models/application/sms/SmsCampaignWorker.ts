import { randomUUID, timingSafeEqual } from 'crypto';
import KnexConnection from '../../../database/KnexConnections';
import logger from '../../../hooks/logger';
import { SmsService } from '../integrations/Arkesel';
import { isSmsActive } from './SmsActivation';
import { smsProviderState } from './SmsMessageMetrics';

import { verifyArkeselWebhook, callbackPayloadHash } from './ArkeselWebhook';
import { decryptSmsSecret } from './SmsSecretCipher';
import { normalizeSmsPhone } from './SmsMessageMetrics';

const LEASE_MS = 120_000;
export function deliveryCallbackUrl(tenantId: number, jobid: number, token: string): string | undefined {
    const base = process.env.SMS_CALLBACK_BASE_URL || process.env.APPHOST_PRODUCTION;
    if (!base) return undefined;
    try {
        const url = new URL(base.includes('://') ? base : 'https://' + base);
        if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) return undefined;
        url.pathname = `/api/v1/sms-delivery/${tenantId}/${jobid}/${token}`; url.search = ''; url.hash = '';
        return url.toString();
    } catch { return undefined; }
}
export async function refreshCampaignState(db: any, jobid: number) {
    const rows = await db('primesmsjobrecipients').where({ jobid }).select('deliverystatus');
    const states = rows.map((r: any) => r.deliverystatus);
    let status = !states.length ? 'failed' : states.every((s: string) => s === 'delivered') ? 'delivered' :
        states.includes('unknown') || states.includes('submitting') || states.includes('retrying') ? 'unknown' :
        states.every((s: string) => s === 'failed') ? 'failed' : states.includes('failed') ? 'partialfailed' :
        states.includes('queued') ? 'pending' : states.every((s: string) => s === 'cancelled') ? 'cancelled' : 'submitted';
    const dispatch = await db('sms_campaign_dispatch').where({ jobid }).first();
    if (dispatch?.state === 'cancelled') status = 'cancelled';
    else if (dispatch?.state === 'blocked') status = 'blocked';
    else if (dispatch?.sandbox && !states.includes('queued') && !states.includes('submitting')) status = 'sandbox';
    else if (states.includes('queued') && dispatch?.state === 'processing') status = 'processing';
    else if (states.includes('queued') && dispatch?.available_at && new Date(dispatch.available_at).getTime() > Date.now()) status = 'scheduled';
    await db('primesmsjobs').where({ jobid }).update({ status });
    return status;
}
export async function applyDeliveryReceipts(db: any, jobid?: number) {
    let query = db('sms_delivery_receipts');
    if (jobid) query = query.where({ jobid });
    const receipts = await query.orderBy('id', 'asc').limit(500);
    for (const receipt of receipts) {
        const state = smsProviderState(receipt.provider_status);
        // A late SUBMITTED/QUEUED callback cannot undo confirmed delivery/failure.
        let update = db('primesmsjobrecipients').where({ jobid: receipt.jobid, messageid: receipt.messageid });
        if (state !== 'delivered') update = update.whereNotIn('deliverystatus', ['delivered', 'failed', 'cancelled']);
        const changed = await update.update({ deliverystatus: state,
            provider_status:String(receipt.provider_status).slice(0,40), errorcode: state === 'failed' || state === 'unknown' ? String(receipt.provider_status).slice(0, 100) : null });
        const known = changed || await db('primesmsjobrecipients').where({ jobid: receipt.jobid, messageid: receipt.messageid }).first('recid');
        if (known) {
            await db('sms_delivery_receipts').where({ id: receipt.id }).del();
            await refreshCampaignState(db, receipt.jobid);
        }
    }
}
export async function recordSmsDelivery(tenantId: number, jobid: number, token: string, messageid: unknown, status: unknown, context?: {query:Record<string,unknown>;headers:Record<string,unknown>}) {
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || !Number.isSafeInteger(jobid) || jobid <= 0 ||
        !/^[a-f0-9]{64}$/.test(token) || typeof messageid !== 'string' || !/^[\w-]{1,64}$/.test(messageid) ||
        typeof status !== 'string' || !/^[A-Z_]{1,40}$/i.test(status)) return false;
    const db = await KnexConnection(tenantId);
    const dispatch = await db('sms_campaign_dispatch').where({ jobid }).first();
    if (!/^[a-f0-9]{64}$/.test(dispatch?.callback_token || '') || !timingSafeEqual(Buffer.from(token), Buffer.from(dispatch.callback_token))) return false;
    if (dispatch.sandbox) return false;
    const settings=await db('sms_provider_settings').where({id:1}).first();
    const headers=context?.headers||{}, query=context?.query||{sms_id:messageid,status};
    const signed=Object.keys(headers).some(key=>key.startsWith('x-arkesel-webhook-'));
    if (settings?.require_signed_webhooks || signed) {
        if (query.sms_id!==messageid || query.status!==status) return false;
        const secret=settings?.webhook_secret ? decryptSmsSecret(settings.webhook_secret) : '';
        if (!verifyArkeselWebhook(query,headers,secret)) return false;
        const eventid=headers['x-arkesel-webhook-id'];
        if(typeof eventid!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(eventid))return false;
        const hash=callbackPayloadHash(query), existing=await db('sms_webhook_events').where({event_id:eventid}).first();
        if(existing && (existing.payload_hash!==hash || Number(existing.jobid)!==jobid))return false;
        if(!existing)await db('sms_webhook_events').insert({event_id:eventid,payload_hash:hash,jobid}).onConflict('event_id').ignore();
        const saved=await db('sms_webhook_events').where({event_id:eventid}).first();
        if(saved?.payload_hash!==hash || Number(saved?.jobid)!==jobid)return false;
    }
    // Save first: delivery callbacks can arrive before the send response commits its message ID.
    await db('sms_delivery_receipts').insert({ jobid, messageid, provider_status: status.toUpperCase() })
        .onConflict(['jobid', 'messageid', 'provider_status']).ignore();
    await applyDeliveryReceipts(db, jobid);
    return true;
}
export async function claimSmsDispatch(db: any, now = new Date()) {
    return db.transaction(async (trx: any) => {
        const candidate = await trx('sms_campaign_dispatch').where('available_at', '<=', now).where(function(this: any) {
            this.where({ state: 'queued' }).orWhere(function(this: any) { this.where({ state: 'processing' }).where('lease_until', '<', now); });
        }).orderBy('available_at').first();
        if (!candidate) return null;
        // Match edit/cancel/retry lock order: parent campaign, then dispatch.
        const parent = await trx('primesmsjobs').where({ jobid: candidate.jobid }).forUpdate().skipLocked().first();
        if (!parent) return null;
        const row = await trx('sms_campaign_dispatch').where({ jobid: candidate.jobid }).forUpdate().first();
        if (!row || new Date(row.available_at).getTime() > now.getTime() ||
            (row.state !== 'queued' && !(row.state === 'processing' && new Date(row.lease_until).getTime() < now.getTime()))) return null;
        if (row.state === 'processing') {
            // Crash after claim may mean the provider accepted it. Never automatically resend.
            await trx('primesmsjobrecipients').where({ jobid: row.jobid }).whereIn('deliverystatus', ['submitting', 'retrying'])
                .update({ deliverystatus: 'unknown', errorcode: 'Interrupted submission; check provider before retrying' });
        }
        const lease = randomUUID();
        await trx('sms_campaign_dispatch').where({ jobid: row.jobid }).update({ state: 'processing', lease_token: lease,
            lease_until: new Date(now.getTime() + LEASE_MS), updated_at: now });
        await trx('primesmsjobs').where({ jobid: row.jobid }).update({ status: 'processing' });
        return { ...row, lease_token: lease };
    });
}
export async function processSmsDispatch(tenantId: number, db: any, dispatch: any, send?: (phone: string, body: string, callback?: string) => Promise<any>) {
    const callback=deliveryCallbackUrl(tenantId,dispatch.jobid,dispatch.callback_token), provider=send?null:new SmsService(tenantId);
    let configuredKey:string|undefined;
    async function block(reason:string, account=false) {
        await db('sms_campaign_dispatch').where({jobid:dispatch.jobid,state:'processing',lease_token:dispatch.lease_token}).update({state:'blocked',block_reason:reason,lease_token:null,lease_until:null});
        if(account)await db.transaction(async(trx:any)=>{const current=await trx('sms_provider_settings').where({id:1}).forUpdate().first();if(current&&(!configuredKey||decryptSmsSecret(current.api_key)===configuredKey))await trx('sms_provider_settings').where({id:1}).update({paused_reason:reason});});
        await refreshCampaignState(db,dispatch.jobid);
    }
    if(provider){try{const config=await provider.getConfiguration();configuredKey=config.apiKey;if(config.pausedReason){await block(config.pausedReason);return;}if(!!config.sandbox!==!!dispatch.sandbox&&!dispatch.sandbox){await block('Provider is in sandbox mode. Restore live mode or cancel and review this campaign.');return;}}catch{await block('SMS provider is unavailable or disabled. Review provider settings before resuming.');return;}}
    const recipients=await db('primesmsjobrecipients').where({jobid:dispatch.jobid,deliverystatus:'queued'}).orderBy('recid').limit(100);
    const pending=[...recipients], started=Date.now();
    while(pending.length&&Date.now()-started<20000){
        if(provider){const current=await db('sms_provider_settings').where({id:1}).first();if(current&&(!current.is_active||current.paused_reason||!dispatch.sandbox&&current.sandbox||decryptSmsSecret(current.api_key)!==configuredKey)){await block('Provider settings changed. Review account settings and resume the queue.');return;}}

        const first=pending.shift(), batch=[first];
        if(!send)for(let i=0;i<pending.length&&batch.length<50;){if(!dispatch.sandbox || pending[i].personalizedbody===first.personalizedbody)batch.push(pending.splice(i,1)[0]);else i++;}
        const claimed=await db.transaction(async(trx:any)=>{
            const lease=await trx('sms_campaign_dispatch').where({jobid:dispatch.jobid}).forUpdate().first();
            if(lease?.state!=='processing'||lease.lease_token!==dispatch.lease_token)return false;
            await trx('sms_campaign_dispatch').where({jobid:dispatch.jobid}).update({lease_until:new Date(Date.now()+LEASE_MS),updated_at:new Date()});
            for(const row of batch)if(!await trx('primesmsjobrecipients').where({recid:row.recid,deliverystatus:'queued'}).update({deliverystatus:'submitting'}))throw new Error('Recipient claim changed');
            return true;
        });
        if(!claimed)break;
        let result:any;
        try{result=send?await send(first.phonee164,first.personalizedbody,callback):batch.some(row=>row.personalizedbody!==first.personalizedbody)?await provider!.sendTemplateSms('<%content%>',Object.fromEntries(batch.map(row=>[row.phonee164,{content:row.personalizedbody}])),{callbackUrl:callback}):await provider!.sendSms(batch.map(row=>row.phonee164),first.personalizedbody,{callbackUrl:callback,sandbox:!!dispatch.sandbox});}catch{result={status:'error',uncertain:true};}
        if([401,402,403,429].includes(Number(result?.code))&&!result?.uncertain){
            await db('primesmsjobrecipients').whereIn('recid',batch.map(row=>row.recid)).where({deliverystatus:'submitting'}).update({deliverystatus:'queued'});
            await block(result.message||'Arkesel account requires attention before sending',true);return;
        }
        const accepted=result?.status==='success'&&Array.isArray(result.data)?result.data:[];
        for(const recipient of batch){
            const match=accepted.find((row:any)=>normalizeSmsPhone(row.recipient)===normalizeSmsPhone(recipient.phonee164)) || (batch.length===1&&accepted.length===1&&!accepted[0].recipient?accepted[0]:null);
            const id=typeof match?.id==='string'&&/^[\w-]{1,64}$/.test(match.id)&&accepted.filter((row:any)=>row.id===match.id).length===1?match.id:null;
            const state=id?(dispatch.sandbox?'sandbox':'submitted'):result?.uncertain||result?.status==='success'?'unknown':'failed';
            await db('primesmsjobrecipients').where({recid:recipient.recid}).whereIn('deliverystatus',['submitting','unknown']).update({deliverystatus:state,messageid:id,sentat:id?new Date():null,errorcode:state==='unknown'?'Provider acceptance is uncertain; check before retrying':state==='failed'?String(result?.message||'Provider rejected the message').slice(0,100):null});
        }
        if(result?.uncertain)break;
    }
    await applyDeliveryReceipts(db,dispatch.jobid);
    const remaining=await db('primesmsjobrecipients').where({jobid:dispatch.jobid,deliverystatus:'queued'}).first('recid');
    await db('sms_campaign_dispatch').where({jobid:dispatch.jobid,state:'processing',lease_token:dispatch.lease_token}).update({state:remaining?'queued':'completed',lease_token:null,lease_until:null,updated_at:new Date()});
    await refreshCampaignState(db,dispatch.jobid);
}
export async function sweepSmsCampaigns(tenantId: number) {
    const db = await KnexConnection(tenantId);
    await applyDeliveryReceipts(db);
    if (!(await isSmsActive(tenantId, db))) return;
    const settings=await db('sms_provider_settings').where({id:1}).first('paused_reason');
    if(settings?.paused_reason)return;
    const dispatch = await claimSmsDispatch(db);
    if (dispatch) await processSmsDispatch(tenantId, db, dispatch);
    await reconcileSmsMessages(tenantId, db);
}
export async function reconcileSmsMessages(tenantId: number, db: any, jobid?: number, recid?: number, suppliedId?: string) {
    let query = db('primesmsjobrecipients').where(function(this:any){this.whereIn('deliverystatus',['submitted','sent','unknown']).orWhere(function(this:any){this.where({deliverystatus:'delivered'}).whereNull('provider_segments');});});
    if (jobid) query = query.where({ jobid });
    if (recid) query = query.where({ recid });
    else query = query.whereNotNull('messageid').where(function(this: any) {
        this.whereNull('last_checked_at').orWhere('last_checked_at', '<', new Date(Date.now() - 300_000));
    });
    const recipients = await query.orderBy('last_checked_at', 'asc').limit(1000);
    let checked = 0;
    const provider = new SmsService(tenantId);
    const ids=[...new Set(recipients.map((row:any)=>row.messageid).filter(Boolean))] as string[];
    let reports:any=null;
    if(ids.length){const response=await provider.getMessageReports(ids);if(response.status==='success'&&response.data&&typeof response.data==='object')reports=response.data;}
    for (const recipient of recipients) {
        const dispatch=await db('sms_campaign_dispatch').where({jobid:recipient.jobid}).first('sandbox');if(dispatch?.sandbox)continue;
        const id = recipient.messageid || suppliedId;
        if (!id) continue;
        await db('primesmsjobrecipients').where({ recid: recipient.recid }).update({ last_checked_at: new Date() });
        const report = recipient.messageid ? (reports?.[id] ? {status:'success',data:reports[id]} : {status:'error',data:null}) : await provider.getMessageReport(id);
        if (report.status !== 'success' || !report.data?.status) continue;
        if (!recipient.messageid) {
            const { normalizeSmsPhone } = await import('./SmsMessageMetrics');
            if (normalizeSmsPhone(report.data.recipient) !== normalizeSmsPhone(recipient.phonee164) || report.data.message !== recipient.personalizedbody) continue;
        }
        const state = recipient.deliverystatus==='delivered'?'delivered':smsProviderState(report.data.status);
        await db('primesmsjobrecipients').where({ recid: recipient.recid }).whereIn('deliverystatus', ['submitted', 'sent', 'unknown','delivered'])
            .update({ messageid: id, deliverystatus: state, provider_status:String(report.data.status).slice(0,40), ...(Number.isSafeInteger(Number(report.data.message_count)) && Number(report.data.message_count)>=0 ? {provider_segments:Number(report.data.message_count)} : {}), errorcode: state === 'failed' || state === 'unknown' ? String(report.data.status).slice(0,100) : null });
        await refreshCampaignState(db, recipient.jobid); checked++;
    }
    return checked;
}
let timer: NodeJS.Timeout | null = null;
export function startSmsCampaignWorker(tenantIds: number[], interval = 10_000) {
    if (timer || !tenantIds.length || process.env.NODE_ENV === 'test') return;
    let running = false;
    const sweep = async () => {
        if (running) return; running = true;
        try { for (const tenantId of tenantIds) {
            try { await sweepSmsCampaigns(tenantId); }
            catch (error) { logger.error('[SMS] Campaign sweep failed',{tenantId,code:(error as any)?.code||'UNKNOWN'}); }
        } } finally { running = false; }
    };
    timer = setInterval(() => { void sweep(); }, interval); timer.unref?.();
    setTimeout(() => { void sweep(); }, 5000).unref?.();
}
