import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AuthUser } from '../../../middleware/authority';

const process = vi.hoisted(() => vi.fn());
vi.mock('./DeviceDataProcessing', () => ({
     default: { bioLabDeviceProcessor: process, MindRayDeviceBClassProcessor: process, AgileS20DeviceProcessor: process },
}));
vi.mock('../../../database/TiifuWorkingClass', () => ({ TiifuWorkingClass: class {} }));
vi.mock('../../../models/creator/creator', () => ({ default: class {} }));
vi.mock('../../../models/operations/ascension', () => ({ TestAscension: {} }));
vi.mock('../../../models/TestCreation/TestCreationRulesRepository', () => ({ default: class {} }));
vi.mock('../../../testpanel/testpanelList', () => ({ testpanel: {} }));
import { handleReceivedIntefacingDataProcessor } from './hl7SoftwareProcessing';

describe('device delivery acknowledgement', () => {
     const app = express();
     app.use(express.json());
     app.use((req, _res, next) => {
          Object.assign(req, { authUser: {
               employeeid: 7, email: 'staff@example.test', role: 'scientist', branch: 1, tenantId: 3,
          } satisfies AuthUser });
          next();
     });
     app.post('/receive', handleReceivedIntefacingDataProcessor);
     const server = createServer(app);
     let url: string;
     beforeAll(async () => {
          server.listen(0, '127.0.0.1');
          await once(server, 'listening');
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Missing test server address');
          url = `http://127.0.0.1:${address.port}/receive?tenantId=3`;
     });
     afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));

     it.each(['MindRay', 'AgileS20', 'BioeLab'])('sends an HTTP acknowledgement for %s', async name => {
          process.mockResolvedValueOnce({ status: 'success', message: 'Saved', ascensionInformation: { private: true } });
          const response = await fetch(url, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ name, payload: [] }), signal: AbortSignal.timeout(2000),
          });
          expect(response.status).toBe(200);
          expect(await response.json()).toEqual({ status: 'success', message: 'Saved' });
     });

     it('does not acknowledge failed saves as successful deliveries', async () => {
          process.mockResolvedValueOnce({ status: 'error', message: 'Data processed successfully' });
          const response = await fetch(url, {
               method: 'POST', headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ name: 'BioeLab', payload: {} }), signal: AbortSignal.timeout(2000),
          });
          expect(response.status).toBe(500);
          expect(await response.json()).toEqual({ status: 'error', message: 'Device result could not be saved' });
     });
});
