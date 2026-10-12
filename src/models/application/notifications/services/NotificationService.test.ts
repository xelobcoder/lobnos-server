import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../email/helpers/emailModuleActivation', () => ({ isEmailModuleActivated: vi.fn(async () => true) }));
import { isEmailModuleActivated } from '../../email/helpers/emailModuleActivation';
import { NotificationService } from './NotificationService';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';
import { RecipientResolver } from './RecipientResolver';

describe('appointment email uses existing notification and delivery queues', () => {
     let service: NotificationService;
     let settings: any, templates: any, notifications: any, emails: any, processor: any, rules: any;
     const context = { appointment_id: 31, patient_email: 'patient@example.test' };
     beforeEach(() => {
          vi.mocked(isEmailModuleActivated).mockResolvedValue(true);
          settings = { findByEventId: vi.fn(async () => ({ email_enabled: true, default_template_id: 9 })) };
          const template = { id: 9, event_id: 2, is_active: true, subject: 'Appointment {{appointment_id}}', html_body: '<p>Appointment {{appointment_id}}</p>', plain_body: 'Appointment {{appointment_id}}' };
          templates = { findById: vi.fn(async () => template), findActiveForEvent: vi.fn(async () => template) };
          notifications = { create: vi.fn(async () => 51), update: vi.fn() };
          emails = { create: vi.fn(async () => 61) };
          processor = { processSingle: vi.fn(async () => ({ status: 'failed' })) };
          rules = { findByEventId: vi.fn(async () => []) };
          service = new NotificationService(
               { findByCode: vi.fn(async () => ({ id: 2, event_code: 'APPOINTMENT_CREATED', is_active: true })) } as any,
               templates, settings, rules, notifications, emails, processor,
               new NotificationTemplateRenderer(), new RecipientResolver(), {} as any, 7,
          );
     });
     const trigger = () => service.trigger({ eventCode: 'APPOINTMENT_CREATED', context, priority: 'normal', createdBy: 4 });

     it('renders the configured template, links both records, and leaves delivery success to the processor', async () => {
          expect(await trigger()).toMatchObject({ queued: true, notificationQueueId: 51, emailQueueId: 61 });
          expect(templates.findById).toHaveBeenCalledWith(9);
          expect(templates.findActiveForEvent).not.toHaveBeenCalled();
          expect(notifications.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
               event_id: 2, event_code: 'APPOINTMENT_CREATED', channel: 'email', status: 'pending', attempts: 0, max_attempts: 3,
          }));
          expect(emails.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
               subject: 'Appointment 31', recipients_json: '["patient@example.test"]',
               reference_type: 'notification_event', reference_id: '51', retry_count: 0, provider_id: null,
          }));
          expect(notifications.update).toHaveBeenCalledWith(51, { email_queue_id: 61 });
          expect(processor.processSingle).toHaveBeenCalledExactlyOnceWith(61);
     });

     it('retains queued success and both records when immediate processing throws', async () => {
          processor.processSingle.mockRejectedValue(new Error('provider unavailable'));
          expect(await trigger()).toMatchObject({ queued: true, notificationQueueId: 51, emailQueueId: 61 });
          expect(notifications.create).toHaveBeenCalledTimes(1);
          expect(emails.create).toHaveBeenCalledTimes(1);
     });

     it('respects module activation without creating records', async () => {
          vi.mocked(isEmailModuleActivated).mockResolvedValue(false);
          expect(await trigger()).toMatchObject({ queued: false });
          expect(notifications.create).not.toHaveBeenCalled();
          expect(emails.create).not.toHaveBeenCalled();
     });

     it('respects event email disabling', async () => {
          settings.findByEventId.mockResolvedValue({ email_enabled: false });
          expect(await trigger()).toMatchObject({ queued: false });
          expect(notifications.create).not.toHaveBeenCalled();
     });

     it('respects recipient rules including explicit opt-outs and deduplicates destinations', async () => {
          rules.findByEventId.mockResolvedValue([{ recipient_type: 'PATIENT', is_active: false }]);
          expect(await trigger()).toMatchObject({ queued: false, reason: 'No valid recipients found for event' });
          expect(emails.create).not.toHaveBeenCalled();
          rules.findByEventId.mockResolvedValue([
               { recipient_type: 'PATIENT', is_active: true }, { recipient_type: 'PATIENT', is_active: true },
          ]);
          await service.trigger({ eventCode: 'APPOINTMENT_CREATED', context, priority: 'normal', recipients: {
               to: ['patient@example.test'], cc: ['staff@example.test'], bcc: [],
          } });
          expect(emails.create.mock.calls[0][0].recipients_json).toBe('["patient@example.test"]');
          expect(emails.create.mock.calls[0][0].cc_json).toBe('["staff@example.test"]');
     });

     it.each([
          { id: 9, event_id: 2, is_active: false },
          { id: 9, event_id: 99, is_active: true },
          null,
     ])('refuses an invalid configured template rather than silently using another (%j)', async (template) => {
          templates.findById.mockResolvedValue(template);
          await expect(trigger()).rejects.toThrow();
          expect(notifications.create).not.toHaveBeenCalled();
          expect(emails.create).not.toHaveBeenCalled();
     });
});
