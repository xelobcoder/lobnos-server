import express from 'express';
import { request as httpRequest, Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), config: vi.fn(), join: vi.fn(), list: vi.fn(), update: vi.fn(), settings: vi.fn(), saveSettings: vi.fn(), connection: vi.fn(), log: vi.fn(), license: vi.fn() }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: (req: any) => req.authUser || null }));
vi.mock('../../middleware/validateTenancy', () => ({ checkTokenExists: (_req: any, _res: any, next: any) => next() }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.log } }));
vi.mock('../../licensing/enforcement', () => ({ requireOperationalLicense: mocks.license }));
vi.mock('../../models/queue/WalkInQueueService', () => ({
     WalkInQueueError: class extends Error { constructor(message: string, public statusCode = 400) { super(message); } },
     resolveQueueFacility: mocks.resolve,
     WalkInQueueService: class {
          constructor(tenantId: number) { mocks.connection(tenantId); }
          publicConfig = mocks.config; join = mocks.join; list = mocks.list; update = mocks.update;
          getSettings = mocks.settings; updateSettings = mocks.saveSettings;
     },
}));

import { createQueueRateLimiter, publicWalkInQueueRouter, queuePublicBodyBoundary, walkInQueueRouter } from './WalkInQueueController';
import { WalkInQueueError } from '../../models/queue/WalkInQueueService';
import { LicenseError } from '../../licensing/certificate';

let server: Server | undefined;
async function application(actor: Record<string, unknown> | null = null) {
     const app = express();
     app.use((req, _res, next) => { (req as any).authUser = actor; next(); });
     app.use('/api/v1/public/queue', ...queuePublicBodyBoundary);
     // Mirror app.ts: the kiosk boundary precedes larger parsers and the public route mounting.
     app.use(express.json({ limit: '50mb' }));
     app.use(express.urlencoded({ limit: '50mb', extended: true }));
     app.use(publicWalkInQueueRouter);
     app.use('/api/v1/queue', walkInQueueRouter);
     app.use((_req, res) => res.status(418).json({ message: 'Private middleware reached' }));
     server = await new Promise<Server>(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
     const address = server.address();
     if (!address || typeof address === 'string') throw new Error('Test server unavailable');
     return `http://127.0.0.1:${address.port}`;
}
beforeEach(() => {
     vi.clearAllMocks();
     mocks.resolve.mockResolvedValue({ tenantId: 42, slug: 'facility-lab042', name: 'Test Laboratory' });
     mocks.license.mockResolvedValue(undefined);
     mocks.config.mockResolvedValue({ facility: { slug: 'facility-lab042', name: 'Test Laboratory' }, settings: { publicEnabled: true } });
     mocks.join.mockResolvedValue({ ticket: { ticketNumber: 'Q-001', status: 'waiting' } });
     mocks.list.mockResolvedValue({ tickets: [], summary: { total: 0 } });
     mocks.update.mockResolvedValue({ ticket: { id: 10, status: 'called', version: 2 } });
     mocks.settings.mockResolvedValue({ settings: { version: 1 } });
     mocks.saveSettings.mockResolvedValue({ settings: { version: 2 } });
});
afterEach(async () => {
     if (server) { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve())); server = undefined; }
});
const json = (method: string, body: unknown) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('public queue HTTP boundary', () => {
     it('allows unauthenticated check-in and display through the resolved facility', async () => {
          const base = await application();
          const config = await fetch(`${base}/api/v1/public/queue/facility-lab042/config`);
          expect(config.status).toBe(200);
          expect(config.headers.get('cache-control')).toBe('no-store');
          const body = { name: 'Synthetic Client', phone: '0245550000', idempotencyKey: 'browser-retry-1' };
          const created = await fetch(`${base}/api/v1/public/queue/facility-lab042/tickets`, json('POST', body));
          expect(created.status).toBe(200);
          expect(mocks.join).toHaveBeenCalledWith(body);
          const display = await fetch(`${base}/api/v1/public/queue/facility-lab042/display`);
          expect(display.status).toBe(200);
          expect(mocks.list).toHaveBeenCalledWith(undefined, false, { slug: 'facility-lab042', name: 'Test Laboratory' });
          expect(mocks.connection.mock.calls.every(call => call[0] === 42)).toBe(true);
          expect(mocks.license.mock.calls.every(call => call[0] === 42)).toBe(true);
     });
     it('rejects tenant overrides before resolving a facility or connecting', async () => {
          const base = await application();
          expect((await fetch(`${base}/api/v1/public/queue/facility-lab042/display?tenantId=99`)).status).toBe(400);
          expect(mocks.resolve).not.toHaveBeenCalled();
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('terminates unknown public endpoints before private tenant middleware', async () => {
          const base = await application();
          expect((await fetch(`${base}/api/v1/public/queue/facility-lab042/private`)).status).toBe(404);
          expect(mocks.resolve).not.toHaveBeenCalled();
     });
     it('rejects oversized and malformed JSON without issuing a ticket', async () => {
          const base = await application();
          const url = `${base}/api/v1/public/queue/facility-lab042/tickets`;
          expect((await fetch(url, json('POST', { name: 'a'.repeat(9000) }))).status).toBe(413);
          expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{broken' })).status).toBe(400);
          expect(mocks.join).not.toHaveBeenCalled();
     });
     it('rejects urlencoded check-ins before the larger general parser can consume them', async () => {
          const base = await application();
          const url = `${base}/api/v1/public/queue/facility-lab042/tickets`;
          const short = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Synthetic&phone=0245550000' });
          expect(short.status).toBe(415);
          expect((await short.json()).message).toBe('Check-in requests must use JSON');
          const oversized = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `name=${'a'.repeat(9000)}` });
          expect(oversized.status).toBe(413);
          expect((await oversized.json()).message).toBe('Check-in request is too large');
          expect(mocks.resolve).not.toHaveBeenCalled();
          expect(mocks.join).not.toHaveBeenCalled();
     });
     it('keeps the 8 KB JSON boundary and safe errors despite 50 MB parser fallbacks', async () => {
          const base = await application();
          const url = `${base}/api/v1/public/queue/facility-lab042/tickets`;
          const result = await fetch(url, json('POST', { name: 'a'.repeat(9000), phone: '0245550000', idempotencyKey: 'browser-retry-1' }));
          expect(result.status).toBe(413);
          expect(result.headers.get('cache-control')).toBe('no-store');
          expect(await result.json()).toEqual({ status: 'error', message: 'Check-in request is too large' });
          expect(mocks.resolve).not.toHaveBeenCalled();
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('bounds chunked JSON without trusting Content-Length', async () => {
          const base = await application();
          const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
               const request = httpRequest(`${base}/api/v1/public/queue/facility-lab042/tickets`, {
                    method: 'POST', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
               }, response => {
                    let body = ''; response.setEncoding('utf8');
                    response.on('data', chunk => { body += chunk; });
                    response.on('end', () => resolve({ status: response.statusCode!, body }));
               });
               request.on('error', reject);
               request.write('{"name":"'); request.write('a'.repeat(9000)); request.end('"}');
          });
          expect(result.status).toBe(413);
          expect(JSON.parse(result.body)).toEqual({ status: 'error', message: 'Check-in request is too large' });
          expect(mocks.join).not.toHaveBeenCalled();
          expect(mocks.resolve).not.toHaveBeenCalled();
     });
     it('returns closed-facility errors and hides database or provider details', async () => {
          const base = await application();
          mocks.join.mockRejectedValueOnce(new WalkInQueueError('Check-in is closed', 403));
          const closed = await fetch(`${base}/api/v1/public/queue/facility-lab042/tickets`, json('POST', {}));
          expect(closed.status).toBe(403);
          expect((await closed.json()).message).toBe('Check-in is closed');
          mocks.list.mockRejectedValueOnce(new Error('SELECT patientid FROM secret_table'));
          const result = await fetch(`${base}/api/v1/public/queue/facility-lab042/display`);
          expect(result.status).toBe(503);
          expect(await result.text()).not.toContain('secret_table');
          expect(mocks.log).toHaveBeenCalledWith('Walk-in queue operation unavailable');
     });
     it('checks the resolved facility license before constructing a queue service', async () => {
          const base = await application();
          mocks.license.mockRejectedValue(new LicenseError('LICENSE_EXPIRED', 403));
          const result = await fetch(`${base}/api/v1/public/queue/facility-lab042/display`);
          expect(result.status).toBe(403);
          expect((await result.json()).message).toBe('Facility check-in is currently unavailable. Please speak to reception.');
          expect(mocks.license).toHaveBeenCalledWith(42);
          expect(mocks.connection).not.toHaveBeenCalled();
          expect(mocks.list).not.toHaveBeenCalled();
     });
});

describe('authenticated staff queue HTTP boundary', () => {
     it.each([null, { tenantId: 42, employeeid: 7, role: 'patient' }, { tenantId: 42, employeeid: 7, role: 'clinician' }])('rejects absent or unsuitable actor %j', async actor => {
          const base = await application(actor);
          expect([401, 403]).toContain((await fetch(`${base}/api/v1/queue/tickets`)).status);
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('binds staff actions to the authenticated employee and tenant', async () => {
          const base = await application({ tenantId: 42, employeeid: 7, role: 'receptionist' });
          const result = await fetch(`${base}/api/v1/queue/tickets/10?tenantId=42`, json('PATCH', { expectedVersion: 1, status: 'called' }));
          expect(result.status).toBe(200);
          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(mocks.update).toHaveBeenCalledWith('10', { expectedVersion: 1, status: 'called' }, 7);
          const denied = await fetch(`${base}/api/v1/queue/tickets?tenantId=99`);
          expect(denied.status).toBe(401);
          expect(mocks.connection).toHaveBeenCalledTimes(1);
     });
     it.each(['receptionist', 'scientist', 'cashier'])('lets %s manage tickets but protects queue configuration', async role => {
          const base = await application({ tenantId: 42, employeeid: 7, role });
          expect((await fetch(`${base}/api/v1/queue/tickets`)).status).toBe(200);
          expect((await fetch(`${base}/api/v1/queue/settings`)).status).toBe(200);
          expect((await fetch(`${base}/api/v1/queue/settings`, json('PUT', { expectedVersion: 1 }))).status).toBe(403);
          expect(mocks.saveSettings).not.toHaveBeenCalled();
     });
     it.each(['admin', 'manager', 'super_admin'])('lets %s change versioned queue settings', async role => {
          const base = await application({ tenantId: 42, employeeid: 7, role });
          const body = { expectedVersion: 1, publicEnabled: true, displayEnabled: false, ticketPrefix: 'LAB' };
          expect((await fetch(`${base}/api/v1/queue/settings`, json('PUT', body))).status).toBe(200);
          expect(mocks.saveSettings).toHaveBeenCalledWith(body, 7);
     });
});

describe('queue request throttling', () => {
     it('groups rotating paths into a bounded IP bucket, and resets after the window', () => {
          vi.useFakeTimers();
          try {
               const limit = createQueueRateLimiter(2, 1000);
               const next = vi.fn();
               const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
               const req: any = { ip: '127.0.0.1', path: '/rotating-a' };
               limit(req, res, next); limit({ ...req, path: '/rotating-b' }, res, next); limit({ ...req, path: '/rotating-c' }, res, next);
               expect(next).toHaveBeenCalledTimes(2);
               expect(res.status).toHaveBeenCalledWith(429);
               expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '1');
               vi.advanceTimersByTime(1001); limit(req, res, next);
               expect(next).toHaveBeenCalledTimes(3);
          } finally { vi.useRealTimers(); }
     });
});
