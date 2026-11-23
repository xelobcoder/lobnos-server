import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { LabWorkbenchService } from './LabWorkbenchService';

const fixture = accountingSqlDatabase();
afterEach(async () => fixture.db.destroy());

describe('workbench instrument options', () => {
     it('includes held instruments for displaying existing assignments but marks them unavailable', async () => {
          fixture.native.exec(`
               CREATE TABLE roles(employeeid INTEGER, username TEXT, role TEXT, branch INTEGER);
               CREATE TABLE devices(id TEXT, deviceName TEXT, status TEXT);
               CREATE TABLE pls_instrument_maintenance_runs(id INTEGER, device_id TEXT, status TEXT);
               INSERT INTO devices VALUES ('a','Analyzer A','active'),('b','Analyzer B','active');
               INSERT INTO pls_instrument_maintenance_runs VALUES (1,'a','awaiting_corrective_action');
          `);
          vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
          const options = await new LabWorkbenchService(1).options({ employeeid: 1, tenantId: 1, branch: 1, role: 'scientist', email: '' });
          expect(options.devices).toEqual([
               expect.objectContaining({ id: 'a', maintenance_blocked: 1 }),
               expect.objectContaining({ id: 'b', maintenance_blocked: 0 }),
          ]);
     });
});
