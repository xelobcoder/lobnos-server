import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const mocks = vi.hoisted(() => ({ book: vi.fn(), availability: vi.fn(), audit: vi.fn(), logError: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.logError } }));
vi.mock('./route', () => ({
     requirePatientSession: (req: any, res: any, next: any) => req.authUser?.role === 'patient'
          ? next() : res.status(401).json({ status: 'error' }),
}));
vi.mock('../../models/public/PublicAppointmentBooking', () => ({
     PublicAppointmentBooking: class { book = mocks.book; availability = mocks.availability; },
}));
vi.mock('../../models/patient-portal/PatientPortalAudit', () => ({ recordPortalAudit: mocks.audit }));
import router from './publicAppointmentBooking';

describe('facility appointment HTTP boundary', () => {
     it('requires a patient session and passes authenticated identity, returning a pending reference', async () => {
          const app = express();
          app.use(express.json());
          app.use((req: any, _res, next) => {
               if (req.headers['pls-prime-tenant-session'] === 'test-token') req.authUser = { role: 'patient', tenantId: 7, patientid: 12 };
               next();
          });
          app.use(router);
          const server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
               const address: any = server.address();
               const url = `http://127.0.0.1:${address.port}/api/v1/patient-portal/facilities/example-lab/appointments?tenantId=7`;
               const body = { date: '2030-01-01', time: '10:00', type: 'laboratory', reason: 'Screening', itemIds: [4], consent: true };
               mocks.book.mockResolvedValue({ refid: 42 });
               const unsigned = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
               expect(unsigned.status).toBe(401);
               const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'pls-prime-tenant-session': 'test-token' }, body: JSON.stringify(body) });
               expect(response.status).toBe(201);
               expect(response.headers.get('cache-control')).toBe('private, no-store');
               expect(await response.json()).toMatchObject({ status: 'success', data: { refid: 42, status: 'pending', timeZone: expect.any(String) } });
               expect(mocks.book).toHaveBeenCalledWith('example-lab', 7, 12, body);
               expect(mocks.audit).toHaveBeenCalledWith(7, expect.objectContaining({ patientid: 12, resourceId: 42 }));
               mocks.availability.mockResolvedValue({ date: body.date, slots: [] });
               const availability = await fetch(`${url.replace('?', '/availability?')}&date=${body.date}`, {
                    headers: { 'pls-prime-tenant-session': 'test-token' },
               });
               expect(await availability.json()).toMatchObject({ data: { date: body.date, slots: [], timeZone: expect.any(String) } });
               mocks.availability.mockRejectedValueOnce(new Error('sensitive database detail'));
               const failure = await fetch(`${url.replace('?', '/availability?')}&date=${body.date}`, {
                    headers: { 'pls-prime-tenant-session': 'test-token' },
               });
               expect(failure.status).toBe(503);
               expect(await failure.text()).not.toContain('sensitive database detail');
               expect(mocks.logError).toHaveBeenCalledWith('[PublicAppointmentBooking] Unexpected appointment service failure');
          } finally { server.close(); }
     });
});
