import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';

const mocks = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.log } }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: () => ({ employeeid: 8, tenantId: 1, role: 'admin', branch: 1 }) }));
import { FinancialDayCloseController } from './FinancialDayCloseController';
import { FinancialDayCloseService } from '../../accountingModule/services/FinancialDayCloseService';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';

async function requestClose(body: Record<string, unknown> = { pin: '1234' }) {
     const app = express();
     app.use(express.json());
     app.post('/daily-closes/:id/finalize', FinancialDayCloseController.finalize);
     const server = createServer(app);
     try {
          await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Test server did not start');
          const response = await fetch(`http://127.0.0.1:${address.port}/daily-closes/7/finalize`, {
               method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          });
          return { status: response.status, body: await response.json() };
     } finally {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     }
}
beforeEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
describe('daily close client-safe failures', () => {
     it('never returns SQL, table names or driver details for unexpected database errors', async () => {
          vi.spyOn(FinancialDayCloseService.prototype, 'finalize').mockRejectedValue(Object.assign(new Error("update `billing` set `islocked` = 1 where DATE(billedon) = '2026-10-18' - database error"), { code: 'ER_NO_SUCH_TABLE', sqlState: '42S02', errno: 1146 }));
          const c = await requestClose();
          expect(c.status).toBe(500);
          expect(c.body).toMatchObject({ status: 'error', code: 'DAILY_CLOSE_FAILED' });
          expect(JSON.stringify(c.body)).not.toMatch(/update|`billing`|DATE\(|ER_NO_SUCH_TABLE|42S02|2026-10-18/);
          expect(mocks.log).toHaveBeenCalledWith('[Daily close] Request failed', expect.objectContaining({ code: 'ER_NO_SUCH_TABLE' }));
     });
     it('translates immutable-record trigger rejection into a readable conflict', async () => {
          vi.spyOn(FinancialDayCloseService.prototype, 'finalize').mockRejectedValue(Object.assign(new Error('update `billing` ... FINANCIAL_RECORD_FINALIZED'), { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'FINANCIAL_RECORD_FINALIZED', errno: 1644 }));
          const c = await requestClose();
          expect(c.status).toBe(409);
          expect(c.body).toMatchObject({ code: 'FINANCIAL_DAY_FINALIZED', message: expect.stringContaining('Refresh the close history') });
          expect(JSON.stringify(c.body)).not.toContain('update `billing`');
     });
     it('preserves actionable domain errors without exposing driver details', async () => {
          vi.spyOn(FinancialDayCloseService.prototype, 'finalize').mockRejectedValue(new AccountingError('The reviewed totals changed. Reload this day.', 'FINANCIAL_DAY_SNAPSHOT_CHANGED', 409));
          const c = await requestClose();
          expect(c.status).toBe(409);
          expect(c.body.message).toBe('The reviewed totals changed. Reload this day.');
     });
     it('forwards explicit administrator audit intent from the authenticated request', async () => {
          const finalize = vi.spyOn(FinancialDayCloseService.prototype, 'finalize').mockResolvedValue({ closure: { id: 7 } });
          await requestClose({ pin: '1234', overrideSegregationOfDuties: true, overrideReason: 'No independent reviewer is available today.', expectedVersion: 2 });
          expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ employeeid: 8 }), 7, expect.objectContaining({
               overrideSegregationOfDuties: true, overrideReason: 'No independent reviewer is available today.', expectedVersion: 2,
          }));
     });
});
