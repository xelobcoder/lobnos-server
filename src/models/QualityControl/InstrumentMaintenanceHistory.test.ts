import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { InstrumentMaintenanceService } from './InstrumentMaintenanceService';

let fixture: ReturnType<typeof accountingSqlDatabase>;
beforeEach(() => {
     fixture = accountingSqlDatabase();
     fixture.native.exec(`
          CREATE TABLE devices(id TEXT PRIMARY KEY, deviceName TEXT, model TEXT);
          CREATE TABLE pls_instrument_maintenance_runs(id INTEGER PRIMARY KEY, device_id TEXT, status TEXT, performed_at TEXT);
          CREATE TABLE pls_instrument_maintenance_tasks(id INTEGER PRIMARY KEY, run_id INTEGER, plan_id INTEGER, status TEXT, snapshot TEXT, responses TEXT, draft TEXT, draft_by INTEGER, failure_reason TEXT);
          CREATE TABLE pls_instrument_maintenance_checks(id INTEGER PRIMARY KEY, run_id INTEGER, title_snapshot TEXT);
          CREATE TABLE pls_instrument_corrective_actions(id INTEGER PRIMARY KEY, run_id INTEGER, status TEXT);
          INSERT INTO devices VALUES ('a','Analyzer A','Model A'),('b','Analyzer B','Model B');
          INSERT INTO pls_instrument_maintenance_runs VALUES
               (1,'a','cleared','2026-01-01'),(2,'a','awaiting_corrective_action','2026-01-02'),(3,'b','cleared','2026-01-03');
          INSERT INTO pls_instrument_maintenance_tasks VALUES
               (1,2,7,'completed','{"title":"Weekly","activity_type":"Preventive","checklist":[]}','[]',NULL,NULL,'Out of range');
     `);
     vi.mocked(KnexConnection).mockResolvedValue(fixture.db);
});
afterEach(async () => fixture.db.destroy());

describe('maintenance history', () => {
     it('paginates, filters and identifies the activity using its saved snapshot', async () => {
          const service = new InstrumentMaintenanceService(1);
          const first = await service.history({ page: 1, count: 1, search: 'Analyzer A' });
          expect(first.total).toBe(2);
          expect(first.data[0]).toMatchObject({ id: 2, activity_title: 'Weekly', activity_type: 'Preventive' });
          expect((await service.history({ page: 2, count: 1, search: 'Analyzer A' })).data[0].id).toBe(1);
          expect((await service.history({ status: 'awaiting_corrective_action' })).total).toBe(1);
          expect((await service.history({ search: '3' })).data[0].id).toBe(3);
          await expect(service.history({ count: 101 })).rejects.toMatchObject({ statusCode: 400 });
          await expect(service.history({ status: 'unknown' })).rejects.toMatchObject({ statusCode: 400 });
     });
     it('returns the saved task and its failure details with the run', async () => {
          const run = await new InstrumentMaintenanceService(1).execution(2);
          expect(run.task).toMatchObject({ id: 1, plan_id: 7, failure_reason: 'Out of range', snapshot: { title: 'Weekly' } });
     });
});
