import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { PharmacyManagement } from './PharmacyManagement';

afterEach(() => vi.useRealTimers());

describe('financial-day recovery with SQL queries', () => {
     it('finds and resolves old legacy handovers while preserving cash and branch isolation', async () => {
          vi.useFakeTimers();
          vi.setSystemTime(new Date('2026-11-03T10:00:00Z'));
          const { db, native } = accountingSqlDatabase();
          try {
               native.exec(`
                    CREATE TABLE pharmacy_financial_days(
                         id INTEGER PRIMARY KEY, branchid INTEGER, financial_date TEXT, status TEXT,
                         opened_by INTEGER, opened_at TEXT, opening_note TEXT, closed_by INTEGER, closed_at TEXT,
                         UNIQUE(branchid, financial_date)
                    );
                    CREATE TABLE pharmacy_financial_day_events(
                         id TEXT PRIMARY KEY, branchid INTEGER, financial_date TEXT, event_type TEXT,
                         reason TEXT, performed_by INTEGER, details TEXT, created_at TEXT
                    );
                    CREATE TABLE pharmacy_shifts(
                         id TEXT PRIMARY KEY, branchid INTEGER, cashier_id INTEGER, active_key TEXT,
                         financial_date TEXT, opening_float NUMERIC, opened_at TEXT, closed_at TEXT,
                         closed_by INTEGER, counted_cash NUMERIC, expected_cash NUMERIC, variance NUMERIC,
                         reviewed_by INTEGER, reviewed_at TEXT, review_note TEXT
                    );
                    CREATE TABLE pharmacy_collection_accounts(id INTEGER, branchid INTEGER, is_active INTEGER, name TEXT);
                    CREATE TABLE pharmacy_payment_routes(branchid INTEGER, method TEXT);
                    CREATE TABLE pharmacy_documents(id TEXT, branchid INTEGER, kind TEXT, amount NUMERIC, details TEXT, created_at TEXT);
                    CREATE TABLE pharmacy_sales(id TEXT, shift_id TEXT);
                    CREATE TABLE pharmacy_payments(sale_id TEXT, refund_shift_id TEXT, method TEXT, status TEXT, amount NUMERIC);
                    CREATE TABLE pharmacy_cash_events(branchid INTEGER, shift_id TEXT, method TEXT, event_type TEXT, amount NUMERIC);
                    CREATE TABLE pharmacy_journals(id TEXT, branchid INTEGER, financial_date TEXT);
                    CREATE TABLE pharmacy_journal_lines(journal_id TEXT, account_code TEXT, debit NUMERIC, credit NUMERIC);
               `);
               const oldDate = '2026-09-01', closedAt = '2026-09-01T22:00:00Z';
               await db('pharmacy_financial_days').insert([
                    { id: 1, branchid: 2, financial_date: oldDate, status: 'closed', opened_at: null, closed_at: closedAt },
                    { id: 2, branchid: 2, financial_date: '2026-11-02', status: 'open', opened_at: '2026-11-02T00:56:44Z' },
                    { id: 3, branchid: 3, financial_date: oldDate, status: 'closed', opened_at: null, closed_at: closedAt },
                    ...Array.from({ length: 40 }, (_, n) => ({
                         id: n + 4, branchid: 2, status: 'closed',
                         financial_date: new Date(Date.UTC(2026, 8, n + 2)).toISOString().slice(0, 10),
                    })),
               ]);
               await db('pharmacy_shifts').insert([
                    { id: 'legacy-open', branchid: 2, cashier_id: 3, active_key: '2:3', financial_date: null, opened_at: `${oldDate}T09:00:00Z`, opening_float: 10 },
                    { id: 'legacy-review', branchid: 2, cashier_id: 4, financial_date: oldDate, opened_at: `${oldDate}T10:00:00Z`, opening_float: 0, closed_at: `${oldDate}T20:00:00Z`, counted_cash: 7, expected_cash: 5, variance: 2 },
                    { id: 'other-branch', branchid: 3, cashier_id: 6, active_key: '3:6', financial_date: oldDate, opened_at: `${oldDate}T09:00:00Z`, opening_float: 0 },
               ]);
               const manager = new PharmacyManagement(db, 2, 5, 'pharmacy_manager');
               const before = await manager.reports();
               expect(before.days.find((day: any) => day.id === 1)).toMatchObject({ status: 'closed' });
               expect(before.shifts.map((shift: any) => shift.id)).not.toContain('other-branch');
               await expect(manager.closeDay({ date: '2026-11-02' })).rejects.toThrow('Close the cashier shifts');
               await expect(manager.closeShift({ shiftId: 'legacy-open', countedCash: 12 }, 3)).rejects.toThrow('financial day is closed');

               await manager.reopenDay({ date: oldDate, expectedClosedAt: closedAt, reason: 'Resolve the historical cashier handovers' });
               expect((await manager.setup()).previousDay).toMatchObject({ id: 1 });
               expect((await manager.reports()).days.find((day: any) => day.id === 1)).toMatchObject({ explicitly_reopened: true });
               await manager.closeShift({ shiftId: 'legacy-open', countedCash: 12 }, 3);
               await manager.reviewShift('legacy-open', { note: 'Physical count verified' });
               await manager.reviewShift('legacy-review', { note: 'Recorded variance verified' });
               await manager.closeDay({ date: oldDate });
               await manager.closeDay({ date: '2026-11-02' });
               await manager.openDay({ date: '2026-11-03' });

               expect(await db('pharmacy_shifts').where({ id: 'legacy-open' }).first()).toMatchObject({ active_key: null, counted_cash: 12, expected_cash: 10, variance: 2, reviewed_by: 5 });
               expect(await db('pharmacy_shifts').where({ id: 'legacy-review' }).first()).toMatchObject({ counted_cash: 7, expected_cash: 5, variance: 2, reviewed_by: 5 });
               expect(await db('pharmacy_shifts').where({ id: 'other-branch' }).first()).toMatchObject({ active_key: '3:6' });
               expect(await db('pharmacy_financial_days').where({ id: 3 }).first()).toMatchObject({ status: 'closed', closed_at: closedAt });
               expect((await db('pharmacy_financial_day_events').where({ branchid: 2 })).map((event: any) => event.event_type)).toEqual(['reopened', 'closed', 'closed']);
          } finally {
               await db.destroy();
          }
     });
});
