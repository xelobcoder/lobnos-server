import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../../../testSupport/accountingSqlDatabase';

vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../../accountingModule/integrations/BillingAccounting', () => ({
     enqueueStaffFocBenefit: vi.fn(),
     enqueueStaffFocBenefitReversal: vi.fn(),
}));

import KnexConnection from '../../../database/KnexConnections';
import { enqueueStaffFocBenefit, enqueueStaffFocBenefitReversal } from '../../../accountingModule/integrations/BillingAccounting';
import { StaffFocService } from './StaffFocService';

const databases: ReturnType<typeof accountingSqlDatabase>['db'][] = [];

async function createTenantDatabase() {
     const { db, native } = accountingSqlDatabase();
     native.function('CONCAT_WS', { varargs: true }, (separator: string, ...values: (string | null)[]) =>
          values.filter(value => value != null).join(separator));
     databases.push(db);
     await db.schema.createTable('roles', table => {
          table.integer('employeeid').primary();
          table.integer('activation');
          table.string('username');
          table.string('role');
          table.string('email');
          table.string('mobile');
     });
     await db.schema.createTable('staff_foc_policy', table => {
          table.increments('id');
          table.boolean('active');
          table.decimal('limit_amount');
     });
     await db.schema.createTable('staff_foc_account', table => {
          table.increments('id');
          table.integer('employeeid');
          table.integer('policy_id');
          table.integer('period_year');
          table.string('period_start');
          table.string('period_end');
          table.decimal('limit_amount');
          table.decimal('used_amount');
          table.decimal('remaining_amount');
          table.boolean('active');
          table.dateTime('updated_at');
     });
     return db;
}

async function createTransactionFixture() {
     const db = await createTenantDatabase();
     vi.mocked(KnexConnection).mockResolvedValue(db);
     await db.schema.createTable('new_patients', table => {
          table.integer('patientid').primary();
          table.string('firstname');
          table.string('middlename');
          table.string('lastname');
     });
     await db.schema.createTable('staff_foc_transaction', table => {
          table.increments('id');
          table.integer('foc_account_id');
          table.integer('employeeid');
          table.integer('patientid');
          table.integer('billingid');
          table.decimal('foc_amount');
          table.string('status');
          table.integer('requested_by');
          table.integer('approved_by');
          table.dateTime('approved_on');
          table.string('reversal_reason');
          table.integer('reversed_by');
          table.dateTime('reversed_at');
          table.dateTime('created_at');
     });
     await db.schema.createTable('dboservices', table => {
          table.integer('serviceid').primary();
          table.integer('billingid');
          table.integer('foc_transaction_id');
          table.decimal('totalpayable');
          table.decimal('paidamount');
          table.decimal('foc_amount');
          table.decimal('outstanding');
          table.string('paymentstatus');
     });
     await db.schema.createTable('billing', table => {
          table.integer('billingid').primary();
          table.decimal('paid');
          table.decimal('outstanding');
          table.decimal('balance');
          table.string('status');
          table.string('clientstatus');
     });
     await db('staff_foc_account').insert({
          id: 1, employeeid: 7, period_year: 2026, limit_amount: 250,
          used_amount: 0, remaining_amount: 250, active: 1,
     });
     await db('staff_foc_transaction').insert({
          id: 12, foc_account_id: 1, employeeid: 7, patientid: 4, billingid: 5,
          foc_amount: 100, status: 'pending', requested_by: 7, created_at: '2026-03-01',
     });
     await db('dboservices').insert([
          { serviceid: 1, billingid: 5, totalpayable: 80, paidamount: 20, foc_amount: 0, outstanding: 60, paymentstatus: 'partial' },
          { serviceid: 2, billingid: 5, totalpayable: 100, paidamount: 0, foc_amount: 0, outstanding: 100, paymentstatus: 'pending' },
     ]);
     await db('billing').insert({ billingid: 5, paid: 20, outstanding: 160, balance: 0, status: 'partial', clientstatus: 'partial' });
     return db;
}

beforeEach(() => vi.resetAllMocks());
afterEach(async () => {
     while (databases.length) await databases.pop()!.destroy();
});

describe('staff FOC approval and reversal', () => {
     it('allocates and reverses the benefit across billing services atomically', async () => {
          const db = await createTransactionFixture();
          const service = new StaffFocService();

          await expect(service.approveFocTransaction(3, 12, 9)).resolves.toBe(true);
          expect(await db('staff_foc_account').first()).toMatchObject({ used_amount: 100, remaining_amount: 150 });
          expect(await db('staff_foc_transaction').first()).toMatchObject({ status: 'approved', approved_by: 9 });
          expect(await db('dboservices').orderBy('serviceid')).toMatchObject([
               { serviceid: 1, foc_amount: 60, paidamount: 80, outstanding: 0, paymentstatus: 'Paid', foc_transaction_id: 12 },
               { serviceid: 2, foc_amount: 40, paidamount: 40, outstanding: 60, paymentstatus: 'partial', foc_transaction_id: 12 },
          ]);
          expect(await db('billing').first()).toMatchObject({ paid: 20, outstanding: 60, status: 'partial' });
          expect(enqueueStaffFocBenefit).toHaveBeenCalledWith(3, 12, expect.any(Function));

          await expect(service.reverseFocTransaction(3, 12, 10, 'Correction')).resolves.toBe(true);
          expect(await db('staff_foc_account').first()).toMatchObject({ used_amount: 0, remaining_amount: 250 });
          expect(await db('staff_foc_transaction').first()).toMatchObject({ status: 'reversed', reversed_by: 10, reversal_reason: 'Correction' });
          expect(await db('dboservices').orderBy('serviceid')).toMatchObject([
               { serviceid: 1, foc_amount: 0, paidamount: 20, outstanding: 60, paymentstatus: 'partial' },
               { serviceid: 2, foc_amount: 0, paidamount: 0, outstanding: 100, paymentstatus: 'pending' },
          ]);
          expect(await db('billing').first()).toMatchObject({ paid: 20, outstanding: 160, status: 'partial' });
          expect(enqueueStaffFocBenefitReversal).toHaveBeenCalledWith(3, 12, 'Correction', expect.any(Function));
     });

     it('rolls back approval when accounting enqueue fails', async () => {
          const db = await createTransactionFixture();
          vi.mocked(enqueueStaffFocBenefit).mockRejectedValueOnce(new Error('Outbox unavailable'));

          await expect(new StaffFocService().approveFocTransaction(3, 12, 9)).rejects.toThrow('Outbox unavailable');
          expect(await db('staff_foc_account').first()).toMatchObject({ used_amount: 0, remaining_amount: 250 });
          expect(await db('staff_foc_transaction').first()).toMatchObject({ status: 'pending', approved_by: null });
          expect(await db('dboservices').orderBy('serviceid')).toMatchObject([
               { paidamount: 20, foc_amount: 0 }, { paidamount: 0, foc_amount: 0 },
          ]);
     });

     it('rolls back earlier writes if a later service allocation fails', async () => {
          const db = await createTransactionFixture();
          await db.raw("CREATE TRIGGER reject_second_service BEFORE UPDATE ON dboservices WHEN NEW.serviceid = 2 BEGIN SELECT RAISE(ABORT, 'Service update failed'); END");

          await expect(new StaffFocService().approveFocTransaction(3, 12, 9)).rejects.toThrow('Service update failed');
          expect(await db('staff_foc_account').first()).toMatchObject({ used_amount: 0, remaining_amount: 250 });
          expect(await db('staff_foc_transaction').first()).toMatchObject({ status: 'pending', approved_by: null });
          expect(await db('dboservices').orderBy('serviceid')).toMatchObject([
               { paidamount: 20, foc_amount: 0 }, { paidamount: 0, foc_amount: 0 },
          ]);
          expect(await db('billing').first()).toMatchObject({ paid: 20, outstanding: 160, status: 'partial' });
     });

     it('rolls back reversal when accounting enqueue fails', async () => {
          const db = await createTransactionFixture();
          const service = new StaffFocService();
          await service.approveFocTransaction(3, 12, 9);
          vi.mocked(enqueueStaffFocBenefitReversal).mockRejectedValueOnce(new Error('Outbox unavailable'));

          await expect(service.reverseFocTransaction(3, 12, 10, 'Correction')).rejects.toThrow('Outbox unavailable');
          expect(await db('staff_foc_account').first()).toMatchObject({ used_amount: 100, remaining_amount: 150 });
          expect(await db('staff_foc_transaction').first()).toMatchObject({ status: 'approved', reversed_by: null });
          expect(await db('dboservices').orderBy('serviceid')).toMatchObject([
               { paidamount: 80, foc_amount: 60 }, { paidamount: 40, foc_amount: 40 },
          ]);
          expect(await db('billing').first()).toMatchObject({ paid: 20, outstanding: 60, status: 'partial' });
     });
});

describe('staff FOC account provisioning', () => {
     it('uses the requested tenant to provision an active staff account with its policy', async () => {
          const first = await createTenantDatabase();
          const second = await createTenantDatabase();
          await first('roles').insert({ employeeid: 7, activation: 0 });
          await second('roles').insert({ employeeid: 7, activation: 1 });
          await second('staff_foc_policy').insert({ active: 1, limit_amount: 250 });
          vi.mocked(KnexConnection).mockImplementation(async tenantId => {
               if (tenantId === 1) return first;
               if (tenantId === 2) return second;
               throw new Error('Unexpected tenant');
          });

          const service = new StaffFocService();
          expect(await service.getStaffAccount(1, 7, 2026)).toBeNull();
          expect(await service.getStaffAccount(2, 7, 2026)).toMatchObject({
               employeeid: 7, period_year: 2026, limit_amount: 250,
               used_amount: 0, remaining_amount: 250,
          });
          expect(await first('staff_foc_account')).toHaveLength(0);
          expect(await second('staff_foc_account')).toHaveLength(1);
          await second('roles').where({ employeeid: 7 }).update({ activation: 0 });
          expect(await service.getStaffAccount(2, 7, 2026)).toMatchObject({ employeeid: 7, limit_amount: 250 });
          expect(await second('staff_foc_account')).toHaveLength(1);
     });

     it('does not provision a missing staff member and retains the default limit without a policy', async () => {
          const db = await createTenantDatabase();
          vi.mocked(KnexConnection).mockResolvedValue(db);
          await db('roles').insert({ employeeid: 7, activation: 1 });
          const service = new StaffFocService();

          expect(await service.getStaffAccount(1, 8, 2026)).toBeNull();
          expect(await service.getStaffAccount(1, 7, 2026)).toMatchObject({
               employeeid: 7, limit_amount: 1000, remaining_amount: 1000,
          });
          expect(await db('staff_foc_account')).toHaveLength(1);
     });

     it('propagates active staff lookup failures instead of treating staff as inactive', async () => {
          const db = await createTenantDatabase();
          vi.mocked(KnexConnection)
               .mockResolvedValueOnce(db)
               .mockRejectedValueOnce(new Error('Database unavailable'));
          await expect(new StaffFocService().getStaffAccount(1, 7, 2026))
               .rejects.toThrow('Database unavailable');
     });
});
