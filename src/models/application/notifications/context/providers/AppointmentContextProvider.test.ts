import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ connection: vi.fn(), query: vi.fn() }));
vi.mock('../../../../../database/KnexConnections', () => ({ default: mocks.connection }));
import { AppointmentContextProvider } from './AppointmentContextProvider';

describe('appointment notification context', () => {
     it('loads saved delivery selections and destinations from the supplied tenant', async () => {
          const row = {
               appointment_id: 31, patient_id: 12, firstname: 'Test', lastname: 'Patient',
               appointment_invite_method: 'sms', appointment_preference: 'none',
               patient_email: 'patient@example.test', patient_phone: '+233200000001',
          };
          const builder: any = {
               leftJoin: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
               where: vi.fn().mockReturnThis(), first: vi.fn(async () => row),
          };
          mocks.query.mockReturnValue(builder);
          (mocks.query as any).schema = { hasTable: vi.fn(async () => false) };
          mocks.connection.mockResolvedValue(mocks.query);
          const provider = new AppointmentContextProvider(7);
          expect(await provider.getContext('31')).toMatchObject({
               appointment_id: 31, patient_id: 12, appointment_invite_method: 'sms',
               appointment_preference: 'none', patient_email: row.patient_email, patient_phone: row.patient_phone,
          });
          expect(mocks.connection).toHaveBeenCalledWith(7);
          expect(builder.select.mock.calls[0]).toEqual(expect.arrayContaining([
               'a.inviteMethod as appointment_invite_method',
               'a.preference as appointment_preference',
          ]));
          expect(builder.where).toHaveBeenCalledWith('a.refid', 31);
          for (const eventCode of ['APPOINTMENT_CREATED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_REMINDER']) {
               expect(provider.getEventDefinition(eventCode)?.requiredReferences).toEqual(['appointmentId']);
          }
     });

     it('resolves CRM contact details for a lead-only appointment', async () => {
          const row = {
               appointment_id: 32, patient_id: null, lead_id: 9, firstname: null, lastname: null,
               appointment_invite_method: 'email', appointment_preference: 'in person',
               lead_firstname: 'Ada', lead_lastname: 'Lovelace', lead_company: 'Analytical Engines',
               lead_contact_person: 'Ada Lovelace', lead_email: 'ada@example.test', lead_phone: '+233200000009',
          };
          const builder: any = {
               leftJoin: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
               where: vi.fn().mockReturnThis(), first: vi.fn(async () => row),
          };
          mocks.query.mockReturnValue(builder);
          (mocks.query as any).schema = { hasTable: vi.fn(async () => true) };
          mocks.connection.mockResolvedValue(mocks.query);

          const context = await new AppointmentContextProvider(7).getContext(32);

          expect(context).toMatchObject({
               appointment_id: 32,
               lead_id: 9,
               lead_name: 'Ada Lovelace',
               appointment_contact_name: 'Ada Lovelace',
               appointment_contact_email: 'ada@example.test',
               appointment_contact_phone: '+233200000009',
          });
          expect(builder.leftJoin).toHaveBeenCalledWith('leads as l', 'l.id', 'a.lead_id');
     });
});
