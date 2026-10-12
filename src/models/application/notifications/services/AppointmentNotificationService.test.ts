import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentNotificationService } from './AppointmentNotificationService';

describe('appointment lifecycle routing', () => {
     let context: Record<string, unknown>;
     let settings: any;
     let events: any, settingsRepo: any, templates: any, contexts: any, email: any, sms: any, activated: any, inApp: any;
     let service: AppointmentNotificationService;

     beforeEach(() => {
          context = {
               appointment_id: 31, patient_id: 12, patient_name: 'Test Patient',
               patient_email: 'patient@example.test', patient_phone: '+233200000001',
               appointment_invite_method: 'both', appointment_preference: 'morning',
          };
          settings = { email_enabled: true, sms_enabled: true, in_app_enabled: true, default_template_id: 9 };
          events = { findByCode: vi.fn(async () => ({ id: 2, is_active: true })) };
          settingsRepo = { findByEventId: vi.fn(async () => settings) };
          templates = {
               findById: vi.fn(async () => ({ id: 9, event_id: 2, is_active: true, plain_body: '{{event_code}}: {{appointment_id}}' })),
               findActiveForEvent: vi.fn(),
          };
          contexts = { resolveEventContext: vi.fn(async () => context) };
          email = { trigger: vi.fn(async () => ({ queued: true, notificationQueueId: 51, emailQueueId: 61 })) };
          sms = { createJob: vi.fn(async () => 71) };
          activated = vi.fn(async () => true);
          inApp = vi.fn(async () => ({ success: true, eventCode: '', notificationId: 81 }));
          service = new AppointmentNotificationService(events, settingsRepo, templates, contexts, email, sms, 7, activated);
     });

     const lifecycle = ['APPOINTMENT_CREATED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_MISSED'];
     it.each(lifecycle)('routes %s once per enabled channel using tenant context', async (eventCode) => {
          const result = await service.dispatch(eventCode, { patientId: 12, appointmentId: 31 }, 4, undefined, inApp);
          expect(contexts.resolveEventContext).toHaveBeenCalledWith(eventCode, { patientId: 12, appointmentId: 31 });
          expect(email.trigger).toHaveBeenCalledExactlyOnceWith({
               eventCode, context: { ...context, event_code: eventCode }, createdBy: 4, priority: 'normal', recipients: undefined,
          });
          expect(sms.createJob).toHaveBeenCalledExactlyOnceWith({
               customBody: `${eventCode}: 31`, category: 'patient', recipientScope: 'single',
               targetIds: [{ id: 12, phone: '+233200000001' }], sendType: 'immediate', createdBy: 4,
          }, 7);
          expect(result).toMatchObject({ success: true, notificationQueueId: 51, emailQueueId: 61, smsJobId: 71, notificationId: 81 });
          expect(templates.findById).toHaveBeenCalledWith(9);
     });

     it.each([
          ['email', 'morning', 1, 0], ['sms', 'morning', 0, 1], ['none', 'morning', 0, 0],
          ['both', 'none', 0, 0], ['both', 'email', 1, 0], ['both', 'sms', 0, 1],
          ['phone', 'morning', 0, 0], [' EMAIL ', 'morning', 1, 0],
          [null, 'morning', 1, 1],
     ])('respects invite method %s and preference %s', async (method, preference, emails, texts) => {
          context.appointment_invite_method = method;
          context.appointment_preference = preference;
          await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(email.trigger).toHaveBeenCalledTimes(emails as number);
          expect(sms.createJob).toHaveBeenCalledTimes(texts as number);
     });

     it('does not route disabled channels or inactive events', async () => {
          settings.email_enabled = 0;
          settings.sms_enabled = 0;
          settings.in_app_enabled = 0;
          await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(email.trigger).not.toHaveBeenCalled();
          expect(sms.createJob).not.toHaveBeenCalled();
          expect(inApp).not.toHaveBeenCalled();
          events.findByCode.mockResolvedValue({ id: 2, is_active: false });
          expect(await service.dispatch('APPOINTMENT_CREATED', {}, 4, undefined, inApp)).toMatchObject({ success: false });
          expect(contexts.resolveEventContext).toHaveBeenCalledTimes(1);
     });

     it('does not allow overrides to bypass stored channel preferences or destinations', async () => {
          context.appointment_invite_method = 'sms';
          await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, {
               context: { appointment_invite_method: 'both', patient_phone: '+233200000002' },
               recipients: { to: ['override@example.test'] },
          }, inApp);
          expect(email.trigger).not.toHaveBeenCalled();
          expect(sms.createJob.mock.calls[0][0].targetIds[0].phone).toBe(context.patient_phone);
     });

     it.each(['', 'not-a-phone', null])('skips missing/malformed SMS recipients (%s)', async (phone) => {
          context.patient_phone = phone;
          const result = await service.dispatch('APPOINTMENT_REMINDER', { appointmentId: 31 }, undefined, undefined, inApp);
          expect(result.channels?.sms.status).toBe('skipped');
          expect(sms.createJob).not.toHaveBeenCalled();
          expect(email.trigger).toHaveBeenCalledTimes(1);
     });

     it('checks SMS facility activation independently of email', async () => {
          activated.mockResolvedValue(false);
          const result = await service.dispatch('APPOINTMENT_REMINDER', { appointmentId: 31 }, undefined, undefined, inApp);
          expect(result.channels?.sms).toMatchObject({ status: 'skipped' });
          expect(sms.createJob).not.toHaveBeenCalled();
          expect(email.trigger).toHaveBeenCalledTimes(1);
     });

     it('isolates channel failures and never returns sensitive error text', async () => {
          email.trigger.mockRejectedValue(new Error('secret provider token'));
          inApp.mockRejectedValue(new Error('sensitive patient details'));
          const result = await service.dispatch('APPOINTMENT_CANCELLED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(result.success).toBe(false);
          expect(result.channels?.email.status).toBe('failed');
          expect(result.channels?.inApp.status).toBe('failed');
          expect(result.channels?.sms.status).toBe('queued');
          expect(JSON.stringify(result)).not.toMatch(/secret|sensitive/);
     });

     it('reports no email recipients as a skip, not a delivery success', async () => {
          email.trigger.mockResolvedValue({ queued: false, reason: 'No valid recipients found for event' });
          const result = await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(result.channels?.email).toEqual({ status: 'skipped', reason: 'No valid recipients found for event' });
          expect(result.emailQueueId).toBeUndefined();
     });

     it('routes a lead-only appointment email to the CRM contact and skips patient-only SMS', async () => {
          context.patient_id = null;
          context.lead_email = 'lead@example.test';
          context.patient_phone = '+233200000001';
          const result = await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(email.trigger).toHaveBeenCalledWith(expect.objectContaining({
               recipients: { to: ['lead@example.test'] },
          }));
          expect(result.channels?.sms).toMatchObject({ status: 'skipped', reason: 'Valid patient reference is required for SMS' });
          expect(sms.createJob).not.toHaveBeenCalled();
     });

     it('routes a context-only cancellation snapshot without querying a deleted appointment', async () => {
          const recipients = { to: ['override@example.test'], cc: [], bcc: [] };
          await service.dispatch('APPOINTMENT_CANCELLED', {}, 4, { context, recipients }, inApp);
          expect(contexts.resolveEventContext).not.toHaveBeenCalled();
          expect(email.trigger.mock.calls[0][0].recipients).toBe(recipients);
          expect(sms.createJob).toHaveBeenCalledTimes(1);
     });

     it.each([{}, { appointmentId: 'bad' }, { appointmentId: -1 }])('rejects missing/malformed appointment context %j', async (refs) => {
          const result = await service.dispatch('APPOINTMENT_CREATED', refs, 4, undefined, inApp);
          expect(result.success).toBe(false);
          expect(email.trigger).not.toHaveBeenCalled();
          expect(sms.createJob).not.toHaveBeenCalled();
          expect(inApp).not.toHaveBeenCalled();
     });

     it('refuses an inactive or cross-event configured text template', async () => {
          templates.findById.mockResolvedValue({ id: 9, event_id: 99, is_active: true, plain_body: 'wrong' });
          const result = await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(result.channels?.sms.status).toBe('failed');
          expect(sms.createJob).not.toHaveBeenCalled();
     });
     it('continues email routing if SMS job creation fails', async () => {
          sms.createJob.mockRejectedValue(new Error('private destination'));
          const result = await service.dispatch('APPOINTMENT_REMINDER', { appointmentId: 31 }, 4, undefined, inApp);
          expect(result).toMatchObject({ success: false, emailQueueId: 61, channels: { sms: { status: 'failed' } } });
          expect(sms.createJob).toHaveBeenCalledTimes(1);
          expect(JSON.stringify(result)).not.toContain('private destination');
     });
     it('defaults to email and in-app only when no channel settings exist', async () => {
          settings = null;
          context.appointment_invite_method = null;
          const result = await service.dispatch('APPOINTMENT_CREATED', { appointmentId: 31 }, 4, undefined, inApp);
          expect(result.channels?.sms.status).toBe('skipped');
          expect(sms.createJob).not.toHaveBeenCalled();
          expect(email.trigger).toHaveBeenCalledTimes(1);
          expect(inApp).toHaveBeenCalledTimes(1);
     });
});
