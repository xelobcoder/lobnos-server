import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
     dispatch: vi.fn(), factory: vi.fn(), publish: vi.fn(), buildMessage: vi.fn(),
}));
vi.mock('./AppointmentNotificationServiceFactory', () => ({
     buildAppointmentNotificationService: mocks.factory,
}));
vi.mock('../../in-app-notifications/InAppNotificationService', () => ({
     InAppNotificationService: { publish: mocks.publish },
}));
vi.mock('../../in-app-notifications/InAppNotificationContextService', () => ({
     InAppNotificationContextService: class { buildMessage = mocks.buildMessage; },
}));
import { NotificationDispatcher } from './NotificationDispatcher';

describe('dispatcher appointment integration', () => {
     beforeEach(() => {
          vi.resetAllMocks();
          mocks.factory.mockReturnValue({ dispatch: mocks.dispatch });
          mocks.dispatch.mockResolvedValue({ success: true, eventCode: 'APPOINTMENT_CREATED', emailQueueId: 61 });
          mocks.publish.mockResolvedValue(81);
          mocks.buildMessage.mockResolvedValue('In-app message');
     });
     it.each(['APPOINTMENT_CREATED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_REMINDER'])(
          'uses the tenant routing service for %s', async (eventCode) => {
               const refs = { appointmentId: 31, patientId: 12 };
               await NotificationDispatcher.dispatch(7, eventCode, refs, 4);
               expect(mocks.factory).toHaveBeenCalledExactlyOnceWith(7);
               expect(mocks.dispatch).toHaveBeenCalledExactlyOnceWith(eventCode, refs, 4, undefined, expect.any(Function));
               expect(mocks.publish).not.toHaveBeenCalled();
               await mocks.dispatch.mock.calls[0][4]();
               expect(mocks.publish).toHaveBeenCalledWith(7, expect.objectContaining({ referenceType: 'appointment', referenceId: 31 }));
          },
     );
     it('forwards context snapshots and recipient overrides', async () => {
          const context = { appointment_id: 31, appointment_invite_method: 'email' };
          const recipients = { to: ['patient@example.test'] };
          await NotificationDispatcher.dispatchByContext(7, 'APPOINTMENT_CANCELLED', context, 4, recipients);
          expect(mocks.dispatch).toHaveBeenCalledWith('APPOINTMENT_CANCELLED', {}, 4, { context, recipients }, expect.any(Function));
          await mocks.dispatch.mock.calls[0][4]();
          expect(mocks.buildMessage).toHaveBeenCalledWith('APPOINTMENT_CANCELLED', 'Appointment Cancelled', { type: 'appointment', id: 31 }, 4);
     });
     it('contains routing failures without exposing error details', async () => {
          mocks.dispatch.mockRejectedValue(new Error('private provider details'));
          expect(await NotificationDispatcher.dispatch(7, 'APPOINTMENT_REMINDER', { appointmentId: 31 })).toEqual({
               success: false, eventCode: 'APPOINTMENT_REMINDER', reason: 'Appointment notification could not be queued',
          });
     });
     it.each([0, -1, NaN])('rejects invalid tenant %s before constructing repositories', async (tenantId) => {
          expect(await NotificationDispatcher.dispatch(tenantId, 'APPOINTMENT_CREATED', { appointmentId: 31 })).toMatchObject({ success: false });
          expect(mocks.factory).not.toHaveBeenCalled();
     });
     it('leaves other modules on their existing in-app path', async () => {
          expect(await NotificationDispatcher.dispatch(7, 'PATIENT_CREATED', { patientId: 12 }, 4)).toMatchObject({ success: true, notificationId: 81 });
          expect(mocks.factory).not.toHaveBeenCalled();
          expect(mocks.publish).toHaveBeenCalledTimes(1);
     });
});
