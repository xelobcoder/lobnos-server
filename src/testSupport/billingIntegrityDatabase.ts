import { accountingSqlDatabase } from './accountingSqlDatabase';
import { ensureBillingIntegritySchema } from '../models/billing/BillingIntegritySchema';
import { ensureFinancialLockSchema } from '../accountingModule/init/financialLockSchema';
import { ensureNhisAccountingSchema } from '../accountingModule/init/nhisAccountingSchema';

/** Synthetic financial records only; no tenant connections. */
export async function billingIntegrityDatabase(count = 4, gross = 110, tax = 10) {
    const f = accountingSqlDatabase(), { db, native } = f;
    native.exec(`
    CREATE TABLE billing(billingid INTEGER PRIMARY KEY,patientid INTEGER,branchid INTEGER,billedon TEXT,
      record_validated_and_signed_off INTEGER DEFAULT 0,record_validated_and_signed_off_by INTEGER,
      islocked INTEGER DEFAULT 0,status TEXT,paid NUMERIC,payable NUMERIC,outstanding NUMERIC,balance NUMERIC,
      amountIncurredDueTax NUMERIC,totalcost NUMERIC,totalrefunded NUMERIC DEFAULT 0,lastupdatedby INTEGER,additionalinformation TEXT);
    CREATE TABLE dboservices(serviceid INTEGER PRIMARY KEY,billingid INTEGER,totalpayable NUMERIC,totalcost NUMERIC,
      paidamount NUMERIC,outstanding NUMERIC,amountIncurredDueTax NUMERIC,isDeleted INTEGER DEFAULT 0,isRefunded INTEGER DEFAULT 0,
      isLocked INTEGER DEFAULT 0,status TEXT,paymentstatus TEXT);
    CREATE TABLE dbobillingrefundtable(serviceid INTEGER PRIMARY KEY,isRefundApproved INTEGER,amountRefunded NUMERIC,
      isRefundCompleted INTEGER,isRefundMatterClosed INTEGER,refundedBy INTEGER);
    CREATE TABLE billinghx(KeyID INTEGER PRIMARY KEY AUTOINCREMENT,billingid INTEGER,paymentmode INTEGER,amount NUMERIC,
      employeeid INTEGER,type TEXT,Date TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE paymentmodes(KeyID INTEGER PRIMARY KEY);
    CREATE TABLE financial_day_closures(id INTEGER PRIMARY KEY,branchid INTEGER,financial_date TEXT,status TEXT,
      finalized_at TEXT,owner_employeeid INTEGER);
    CREATE TABLE financial_record_locks(id INTEGER PRIMARY KEY,source_table TEXT,source_ref TEXT,closure_id INTEGER,locked_at TEXT);
    CREATE TABLE test_postings(id INTEGER PRIMARY KEY,voided NUMERIC,cash NUMERIC,tax NUMERIC,historyid INTEGER);
    `);
    await ensureBillingIntegritySchema(db);
    await ensureFinancialLockSchema(db);
    await ensureNhisAccountingSchema(db);
    await db('paymentmodes').insert([{ KeyID: 1 }, { KeyID: 2 }]);
    await db('billing').insert({ billingid: 1, patientid: 7, branchid: 2, billedon: '2026-10-01', status: 'paid',
        paid: count * gross, payable: count * gross, outstanding: 0, balance: 0, amountIncurredDueTax: count * tax, totalcost: count * gross });
    for (let n = 1; n <= count; n++) {
        await db('dboservices').insert({ serviceid: n, billingid: 1, totalpayable: gross, totalcost: gross,
            paidamount: gross, outstanding: 0, amountIncurredDueTax: tax, status: 'active', paymentstatus: 'paid' });
        await db('dbobillingrefundtable').insert({ serviceid: n, isRefundApproved: 1, amountRefunded: 0 });
    }
    return f;
}
