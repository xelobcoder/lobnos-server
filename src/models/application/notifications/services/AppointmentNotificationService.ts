import type { NotificationDispatchReferences, NotificationDispatchResult } from './NotificationDispatcher';
import type { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import type { NotificationEventSettingsRepo } from '../repositories/NotificationEventSettingsRepo';
import type { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import type { NotificationEventContextService } from './NotificationEventContextService';
import type { NotificationService } from './NotificationService';
import type { SmsJobsService } from '../../sms/services/SmsJobsService';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';

// inviteMethod is the delivery selection. Legacy free-text appointment preference
// is not an opt-in; only explicit channel selections or opt-outs narrow routing.
function selectedChannels(value: unknown): Set<string> | null {
     if (value === undefined || value === null || value === '') return null;
     if (typeof value !== 'string') return new Set();
     const normalized = value.trim().toLowerCase();
     if (['none', 'off', 'disabled', 'no', 'opt-out'].includes(normalized)) return new Set();
     if (['both', 'all', 'email and sms'].includes(normalized)) return new Set(['email', 'sms']);
     const tokens = normalized.split(/[,;/+|\s]+/).filter(Boolean);
     return new Set(tokens.filter((token) => token === 'email' || token === 'sms'));
}

export class AppointmentNotificationService {
     constructor(
          private events: NotificationEventsRepo,
          private settings: NotificationEventSettingsRepo,
          private templates: NotificationTemplatesRepo,
          private contextService: NotificationEventContextService,
          private email: NotificationService,
          private sms: SmsJobsService,
          private tenantId: number,
          private smsActivated: () => Promise<boolean>,
     ) { }

     async dispatch(
          eventCode: string,
          references: NotificationDispatchReferences,
          createdBy: number | undefined,
          overrides: { context?: Record<string, unknown>; recipients?: { to?: string[]; cc?: string[]; bcc?: string[] } } | undefined,
          publishInApp: () => Promise<NotificationDispatchResult>,
     ): Promise<NotificationDispatchResult> {
          const event = await this.events.findByCode(eventCode);
          if (!event?.is_active) return { success: false, eventCode, reason: 'Notification event not found or inactive' };
          const settings = await this.settings.findByEventId(event.id as number);
          const result: NotificationDispatchResult = { success: true, eventCode, channels: {} };
          if (references.appointmentId !== undefined
               && (!Number.isInteger(Number(references.appointmentId)) || Number(references.appointmentId) <= 0)) {
               return { success: false, eventCode, reason: 'Valid appointment reference is required' };
          }
          // A context-only dispatch is a snapshot supplied by the domain (e.g. before deletion).
          // Reference dispatch always loads tenant-owned data, including saved preferences.
          const context = references.appointmentId !== undefined
               ? await this.contextService.resolveEventContext(eventCode, references)
               : overrides?.context;
          if (!context?.appointment_id || !Number.isInteger(Number(context.appointment_id)) || Number(context.appointment_id) <= 0) {
               return { success: false, eventCode, reason: 'Valid appointment context is required' };
          }
          const method = selectedChannels(context.appointment_invite_method);
          const preferenceValue = context.appointment_preference;
          const preference = typeof preferenceValue === 'string'
               && /^(email|sms|both|all|none|off|disabled|no|opt-out|email and sms)$/i.test(preferenceValue.trim())
               ? selectedChannels(preferenceValue) : null;
          const allows = (channel: string) => (!method || method.has(channel)) && (!preference || preference.has(channel));
          const payload: Record<string, unknown> = { ...overrides?.context, ...context, event_code: eventCode };

          if (!settings || Boolean(settings.in_app_enabled)) {
               try {
                    const inApp = await publishInApp();
                    result.notificationId = inApp.notificationId;
                    result.channels!.inApp = { status: inApp.success ? 'queued' : 'failed' };
                    if (!inApp.success) result.success = false;
               } catch (_error) {
                    result.channels!.inApp = { status: 'failed', reason: 'In-app notification could not be created' };
                    result.success = false;
               }
          } else result.channels!.inApp = { status: 'skipped', reason: 'In-app channel disabled' };

          for (const channel of ['email', 'sms'] as const) {
               const enabled = channel === 'email' ? (settings ? Boolean(settings.email_enabled) : true) : Boolean(settings?.sms_enabled);
               if (!enabled || !allows(channel)) {
                    result.channels![channel] = { status: 'skipped', reason: 'Channel disabled or excluded by appointment preferences' };
                    continue;
               }
               try {
                    if (channel === 'email') {
                         const leadEmail = !context.patient_id && typeof context.lead_email === 'string'
                              ? context.lead_email.trim()
                              : '';
                         const queued = await this.email.trigger({
                              eventCode,
                              context: payload,
                              createdBy,
                              priority: 'normal',
                              recipients: overrides?.recipients ?? (leadEmail ? { to: [leadEmail] } : undefined),
                         });
                         result.notificationQueueId = queued.notificationQueueId;
                         result.emailQueueId = queued.emailQueueId;
                         result.channels!.email = { status: queued.queued ? 'queued' : 'skipped', reason: queued.reason };
                    } else {
                         if (!await this.smsActivated()) {
                              result.channels!.sms = { status: 'skipped', reason: 'SMS module is not activated' };
                              continue;
                         }
                         const phone = typeof payload.patient_phone === 'string' ? payload.patient_phone.trim() : '';
                         if (!/^\+?\d{7,15}$/.test(phone)) {
                              result.channels!.sms = { status: 'skipped', reason: 'No valid SMS recipient' };
                              continue;
                         }
                         if (!Number.isInteger(Number(context.patient_id)) || Number(context.patient_id) <= 0) {
                              result.channels!.sms = { status: 'skipped', reason: 'Valid patient reference is required for SMS' };
                              continue;
                         }
                         const template = settings?.default_template_id
                              ? await this.templates.findById(settings.default_template_id)
                              : await this.templates.findActiveForEvent(event.id as number);
                         if (!template?.is_active || template.event_id !== event.id || !template.plain_body) {
                              throw new Error('No active SMS text template');
                         }
                         const body = new NotificationTemplateRenderer().render('', '', template.plain_body, payload).plainBody;
                         if (!body.trim()) throw new Error('Empty SMS body');
                         result.smsJobId = await this.sms.createJob({
                              customBody: body, category: 'patient', recipientScope: 'single',
                              targetIds: [{ id: Number(context.patient_id), phone }],
                              sendType: 'immediate', createdBy: createdBy ?? 0,
                         }, this.tenantId);
                         result.channels!.sms = { status: 'queued' };
                    }
               } catch (_error) {
                    // Do not leak provider errors, patient destinations, or rendered bodies.
                    result.channels![channel] = { status: 'failed', reason: 'Notification could not be queued' };
                    result.success = false;
               }
          }
          return result;
     }
}
