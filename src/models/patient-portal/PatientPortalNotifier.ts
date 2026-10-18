import { Knex } from 'knex';
import logger from '../../hooks/logger';
import { getAllCompanyProfiles } from '../settings/companyProfile';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { SmsService } from '../application/integrations/Arkesel';
import { bootstrapPatientPortal } from './PatientPortalBootstrapper';
import { PatientPortalSettings, PatientPortalSettingsService } from './PatientPortalSettings';
import { PatientPortalResultService } from './PatientPortalResultService';
import { InvitationAvailability, PortalInvitationDelivery, invitationPhone, patientInvitationAvailability } from './PortalInvitationDelivery';

export type PortalNotificationChannel = 'email' | 'sms';
const MAX_ATTEMPTS = 3;
const RESULT_WINDOW_DAYS = 14;

/** Patient-facing wording for home-collection statuses; shared with the portal API. */
export const HOME_COLLECTION_STATUS_LABELS: Record<string, string> = {
     Pending: 'Requested',
     Confirmed: 'Confirmed',
     Assigned: 'Collector assigned',
     EnRoute: 'Collector on the way',
     Collected: 'Sample collected',
     Received: 'Received at the laboratory',
     Completed: 'Completed',
     Cancelled: 'Cancelled',
};

export interface PortalMessage {
     subject: string;
     text: string;
     sms: string;
}

const escapeHtml = (value: string) =>
     value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

/**
 * Builds generic notification text from an event key. Messages never include test names, values or
 * addresses: they only tell the patient to sign in, so a lost phone or shared inbox reveals nothing clinical.
 */
export function portalMessageFor(eventKey: string, facility: string, portalUrl: string): PortalMessage | null {
     const signIn = portalUrl ? `${portalUrl}/patient-access/login` : 'the patient portal';
     const from = facility || 'your laboratory';
     if (eventKey.startsWith('results:')) {
          return {
               subject: 'New results are ready in your patient portal',
               text: `New laboratory results from ${from} are ready in your patient portal. Sign in to view them: ${signIn}`,
               sms: `${from}: new results are ready in your patient portal. Sign in at ${signIn}`,
          };
     }
     const match = eventKey.match(/^hc:(\d+):([A-Za-z]+)$/);
     if (match && HOME_COLLECTION_STATUS_LABELS[match[2]]) {
          const label = HOME_COLLECTION_STATUS_LABELS[match[2]];
          const reference = `HC-${match[1]}`;
          return {
               subject: `Home collection ${reference}: ${label}`,
               text: `Your home sample collection ${reference} with ${from} is now: ${label}. Track it in your patient portal: ${signIn}`,
               sms: `${from}: home collection ${reference} is now ${label}. Track it at ${signIn}`,
          };
     }
     return null;
}

export class PatientPortalNotifier {
     private baseAvailability: Promise<InvitationAvailability> | null = null;

     constructor(private readonly tenantId: number) { }

     private portalUrl(): string {
          const configured = process.env.PATIENT_PORTAL_URL || process.env.FRONTEND_URL;
          if (configured) return configured.replace(/\/$/, '');
          return process.env.NODE_ENV === 'development' ? 'http://localhost:2377' : '';
     }

     private async facilityName(): Promise<string> {
          try { return String((await getAllCompanyProfiles(this.tenantId))?.name || '').slice(0, 60); }
          catch { return ''; }
     }

     /** Channels the facility allows, the patient opted into and that can actually reach the patient. */
     async channelsFor(db: Knex, settings: PatientPortalSettings, account: any, patient: any): Promise<PortalNotificationChannel[]> {
          const wanted: PortalNotificationChannel[] = [];
          if (settings.email_notifications_enabled && Number(account?.notify_email) === 1) wanted.push('email');
          if (settings.sms_notifications_enabled && Number(account?.notify_sms) === 1) wanted.push('sms');
          if (!wanted.length) return [];
          this.baseAvailability ??= new PortalInvitationDelivery(this.tenantId).availability(db, null, this.portalUrl());
          const available = patientInvitationAvailability(await this.baseAvailability, patient);
          return wanted.filter(channel => available[channel].available);
     }

     private async deliver(channel: PortalNotificationChannel, patient: any, message: PortalMessage): Promise<void> {
          if (channel === 'email') {
               const provider = await new EmailProvidersRepo(this.tenantId).findDefault();
               if (!provider?.id) throw new Error('Unavailable');
               const result = await new ProviderFactory().create(provider).send({
                    queueId: 0, providerId: provider.id, fromEmail: provider.from_email, fromName: provider.from_name,
                    to: [String(patient.email).trim()], cc: [], bcc: [], subject: message.subject,
                    htmlBody: `<p>${escapeHtml(message.text)}</p>`, plainTextBody: message.text, attachments: [],
               });
               if (!result.success) throw new Error('Rejected');
               return;
          }
          const phone = invitationPhone(patient.mobile_number);
          if (!phone) throw new Error('Invalid recipient');
          const result = await new SmsService(this.tenantId).sendSms([phone], message.sms);
          if (result.status !== 'success') throw new Error('Rejected');
     }

     /** Claims a (event, channel) pair so concurrent sweeps or repeated staff actions never send twice. */
     private async claim(db: Knex, patientid: number, eventKey: string, channel: PortalNotificationChannel): Promise<number | null> {
          try {
               const [id] = await db('patient_portal_notifications')
                    .insert({ patientid, event_key: eventKey, channel, status: 'sending', attempts: 1, created_at: new Date() });
               return Number(id);
          } catch (error: any) {
               if (error?.code !== 'ER_DUP_ENTRY') throw error;
               const existing = await db('patient_portal_notifications').where({ event_key: eventKey, channel }).first();
               if (!existing || existing.status !== 'failed' || Number(existing.attempts) >= MAX_ATTEMPTS) return null;
               const claimed = await db('patient_portal_notifications')
                    .where({ id: existing.id, status: 'failed', attempts: existing.attempts })
                    .update({ status: 'sending', attempts: Number(existing.attempts) + 1 });
               return claimed ? Number(existing.id) : null;
          }
     }

     /** Sends one event to a patient on every eligible channel; failures are recorded for retry, never thrown. */
     async notify(patientid: number, eventKey: string): Promise<Array<{ channel: PortalNotificationChannel; status: 'sent' | 'failed' }>> {
          const db = await bootstrapPatientPortal(this.tenantId);
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.portal_enabled) return [];
          const account = await db('patient_portal_accounts').where({ patientid, status: 'active' }).first();
          if (!account) return [];
          const patient = await db('new_patients').select('patientid', 'email', 'mobile_number').where({ patientid }).first();
          if (!patient) return [];
          const message = portalMessageFor(eventKey, await this.facilityName(), this.portalUrl());
          if (!message) return [];
          const outcomes: Array<{ channel: PortalNotificationChannel; status: 'sent' | 'failed' }> = [];
          for (const channel of await this.channelsFor(db, settings, account, patient)) {
               const id = await this.claim(db, patientid, eventKey, channel);
               if (!id) continue;
               try {
                    await this.deliver(channel, patient, message);
                    await db('patient_portal_notifications').where({ id }).update({ status: 'sent', reason: null });
                    outcomes.push({ channel, status: 'sent' });
               } catch {
                    // Provider errors can contain destinations or credentials; store only a generic reason.
                    await db('patient_portal_notifications').where({ id }).update({ status: 'failed', reason: 'Provider did not accept the message' });
                    outcomes.push({ channel, status: 'failed' });
               }
          }
          return outcomes;
     }

     /**
      * Announces results that became patient-visible through any path (approval, payment, manual release).
      * Each released test is announced once; tests released together produce a single message.
      */
     async sweepResults(onlyPatientid?: number): Promise<number> {
          const settings = await new PatientPortalSettingsService(this.tenantId).get();
          if (!settings.portal_enabled || !settings.result_notifications_enabled ||
               (!settings.email_notifications_enabled && !settings.sms_notifications_enabled)) return 0;
          const db = await bootstrapPatientPortal(this.tenantId);
          const row = await db('patient_portal_settings').select('result_notifications_since').where({ keyid: 1 }).first();
          const windowStart = new Date(Date.now() - RESULT_WINDOW_DAYS * 86_400_000);
          const since = row?.result_notifications_since ? new Date(row.result_notifications_since) : new Date();
          const floor = since > windowStart ? since : windowStart;

          const query = db('test_ascension as ta')
               .join('billing as b', 'b.billingid', 'ta.billingid')
               .join('patient_portal_accounts as a', 'a.patientid', 'b.patientid')
               .leftJoin('patient_portal_result_notices as n', 'n.ascension_id', 'ta.id')
               .leftJoin('dbotestresultapproval as ap', 'ap.ascensionid', 'ta.id')
               .leftJoin('patient_portal_result_releases as r', 'r.ascension_id', 'ta.id')
               .select('ta.id as ascensionid', 'ta.billingid', 'b.patientid')
               .whereNull('n.id').whereNotNull('ta.resultEntryEnd')
               .where('a.status', 'active')
               .andWhere(q => q.where('a.notify_email', 1).orWhere('a.notify_sms', 1))
               .andWhere(q => q.where('ta.resultEntryEnd', '>=', floor).orWhere('ap.lastupdatedon', '>=', floor).orWhere('r.decided_at', '>=', floor))
               .orderBy('ta.id', 'asc').limit(300);
          if (onlyPatientid) query.andWhere('b.patientid', onlyPatientid);
          const candidates: any[] = await query;
          if (!candidates.length) return 0;

          const byPatient = new Map<number, Set<number>>();
          for (const candidate of candidates) {
               const patientid = Number(candidate.patientid);
               if (!byPatient.has(patientid)) byPatient.set(patientid, new Set());
               byPatient.get(patientid)!.add(Number(candidate.ascensionid));
          }
          const results = new PatientPortalResultService(this.tenantId);
          let announced = 0;
          for (const [patientid, ids] of byPatient) {
               const released = (await results.listTests(patientid)).filter(test => test.released && ids.has(test.ascensionid));
               const claimed: number[] = [];
               for (const test of released) {
                    try {
                         await db('patient_portal_result_notices').insert({ ascension_id: test.ascensionid, patientid, billingid: test.billingid, created_at: new Date() });
                         claimed.push(test.ascensionid);
                    } catch (error: any) {
                         if (error?.code !== 'ER_DUP_ENTRY') throw error;
                    }
               }
               if (!claimed.length) continue;
               await this.notify(patientid, `results:${Math.min(...claimed)}`);
               announced += claimed.length;
          }
          return announced;
     }

     /** Retries recent failed deliveries; the message is rebuilt from the event key so no content is stored. */
     async retryFailed(): Promise<void> {
          const db = await bootstrapPatientPortal(this.tenantId);
          const rows = await db('patient_portal_notifications').select('patientid', 'event_key')
               .where('status', 'failed').andWhere('attempts', '<', MAX_ATTEMPTS)
               .andWhere('created_at', '>=', new Date(Date.now() - 86_400_000))
               .groupBy('patientid', 'event_key').limit(50);
          for (const row of rows) await this.notify(Number(row.patientid), String(row.event_key));
     }
}

let workerTimer: NodeJS.Timeout | null = null;

/** Periodically announces newly released results for each ready facility. */
export function startPatientPortalWorkers(tenantIds: number[], intervalMs = 120_000): void {
     if (workerTimer || !tenantIds.length || process.env.NODE_ENV === 'test') return;
     let running = false;
     const sweep = async () => {
          if (running) return;
          running = true;
          try {
               for (const tenantId of tenantIds) {
                    const notifier = new PatientPortalNotifier(tenantId);
                    try {
                         await notifier.sweepResults();
                         await notifier.retryFailed();
                    } catch (error) {
                         logger.error(`[PatientPortal] notification sweep failed for tenant ${tenantId}`, (error as Error)?.message || error);
                    }
               }
          } finally {
               running = false;
          }
     };
     workerTimer = setInterval(() => { void sweep(); }, intervalMs);
     workerTimer.unref?.();
     setTimeout(() => { void sweep(); }, 30_000).unref?.();
}
