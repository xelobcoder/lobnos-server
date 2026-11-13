import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import vm from 'vm';
import ts from 'typescript';
import { billingIntegrityDatabase } from '../../testSupport/billingIntegrityDatabase';
import { normalizeSubmissionPayments } from './submissionPayments';
import { authoritativeSubmission } from './authoritativeSubmission';
import * as identity from './BillingRequestIdentity';
import * as guard from './BillingFinancialGuard';
import { minorUnits } from '../../accountingModule/utils/money';

let db: any, Submit: any, checkout: any;
const request = (changes: any = {}) => ({ tenantId: 1, patientId: 7, branchid: 2, employeeid: 8, billingSource: 1,
    cart: [{ testid: 22, totalpayable: 1, totalcost: 1, paidamount: 100, paymentstatus: 'paid' }],
    servicesProvided: [], paid: 100, amountPayable: 100, payments: [{ mode: 1, amount: 100, employeeid: 999 }],
    paymentDetails: { mode: 'cash', amount: 100 }, billeddate: '2026-10-02', request_key: 'ordinary-submit-00001', ...changes });
beforeEach(async () => {
    ({ db } = await billingIntegrityDatabase(0));
    await db('billing').delete();
    for (const [name, type] of Object.entries({ totalTransactionCost: 'NUMERIC', discount: 'NUMERIC', clientstatus: 'TEXT',
        isPromo: 'INTEGER', promoValue: 'NUMERIC', surcharges: 'NUMERIC', promoMethod: 'TEXT', promoCodeId: 'TEXT',
        isAdjustment: 'INTEGER', adjustmentType: 'TEXT', adjustedBy: 'INTEGER', adjustmentdate: 'TEXT',
        adjustmentReason: 'TEXT', relatedBillingId: 'INTEGER', writeoff: 'NUMERIC' }))
        await db.raw(`ALTER TABLE billing ADD COLUMN ${name} ${type}`);
    checkout = vi.fn(async () => ({ success: true, data: { cart: [{ testid: 22, totalpayable: 100, totalcost: 100, actualPrice: 100, discountedValue: 100, amountIncurredDueTax: 0 }],
        servicesList: [], amountPayable: 100, totalcost: 100, totalServiceAmountPayable: 0, totalAmountIncurredDueTax: 0, totaldiscount: 0 } }));
    class Shared {
        static async generateBillingID(patientid: number, _tenant: number, branchid: number, _employee: number, trx: any) {
            const [id] = await trx('billing').insert({ patientid, branchid, billedon: '2026-10-02' }); return id;
        }
        static async checkValidityOfBillingID() { return true; }
        static async canAdjustBilling() { return { status: true }; }
        async mapAndInsertServices(_t: any, rows: any[], billingid: number, _p: any, _r: any, _d: any, trx: any) {
            for (const row of rows) await trx('dboservices').insert({ billingid, totalpayable: row.totalpayable, totalcost: row.totalcost,
                paidamount: row.paidamount, outstanding: row.outstanding, amountIncurredDueTax: row.amountIncurredDueTax, paymentstatus: row.paymentstatus });
            return [];
        }
        static async insertBillHistory(_t: any, trx: any, billingid: number, paymentmode: number, amount: number, employeeid: number, type: string) {
            await trx('billinghx').insert({ billingid, paymentmode, amount, employeeid, type });
        }
    }
    const mocks: any = {
        '../../database/KnexConnections': async () => db,
        './billing_shared': { BillingSharedRepo: Shared },
        './multi/customerBillingCheckout': { CustomerBillingCheckout: { checkoutCustomerBilling: checkout } },
        './submissionPayments': { normalizeSubmissionPayments }, './authoritativeSubmission': { authoritativeSubmission },
        './BillingRequestIdentity': identity, './BillingFinancialGuard': guard,
        '../../accountingModule/utils/money': { minorUnits },
        './LabCashierWorkflow': { labCheckoutMode: async () => 'direct', requiresCashierHandoff: () => false },
        '../../LobnosAuth/user': class { async getUserRole() { return 'admin'; } },
        '../../middleware/roles': { roleAllowed: () => true },
        './billingclientTypes': { serviceCategory: { 1: 'GENERAL', 5: 'SERVICES' } },
        '../operations/types': { OperationsFailures: { internalServerError: 'failed', notFound: 'missing' } },
        '../../accountingModule/integrations/BillingAccounting': { enqueueBillingReceivable: async () => {} },
        '../application/notifications/services/NotificationDispatcher': { NotificationDispatcher: { dispatch: async () => {} } },
        '../commissions/commission-configurations': { logger: { error() {} } },
    };
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/models/billing/billing-new-client-multi.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
    }).outputText, { exports, console, Date, require: (name: string) => mocks[name] || {} });
    Submit = exports.SubmitCustomerBilling;
    vi.spyOn(Submit, 'triggerCommissionCalculation').mockResolvedValue(undefined);
});
afterEach(async () => { await db.destroy(); });
describe('ordinary route SubmitCustomerBilling production writer with synthetic authoritative checkout', () => {
    it.each([1, 3])('triggers automatic commission calculation after source %i commits', async billingSource => {
        const result = await new Submit(request({ billingSource, clinicianId: 12, organizationId: 34 }), 1).submit();
        expect(result.status).toBe(true);
        expect(Submit.triggerCommissionCalculation).toHaveBeenCalledExactlyOnceWith(1, result.billingid);
        expect(await db('billing').where({ billingid: result.billingid }).first()).toBeDefined();
    });
    it('does not persist forged browser prices or paid flags and binds the receipt actor', async () => {
        await new Submit(request(), 1).submit();
        expect(await db('billing').first()).toMatchObject({ paid: 100, payable: 100, outstanding: 0, status: 'paid' });
        expect(await db('dboservices').first()).toMatchObject({ paidamount: 100, totalpayable: 100, paymentstatus: 'paid' });
        expect(await db('billinghx').first()).toMatchObject({ amount: 100, employeeid: 8 });
    });
    it('unpaid header cannot acquire a fabricated paid service or receipt', async () => {
        await new Submit(request({ paid: 0, payments: [], paymentDetails: { amount: 0 } }), 1).submit();
        expect(await db('dboservices').first()).toMatchObject({ paidamount: 0, outstanding: 100, paymentstatus: 'pending' });
        expect(await db('billinghx')).toHaveLength(0);
    });
    it('replays identical and concurrent submissions as one bill and one receipt', async () => {
        const [a, b] = await Promise.all([new Submit(request(), 1).submit(), new Submit(request(), 1).submit()]);
        expect(a.billingid).toBe(b.billingid);
        expect(await db('billing')).toHaveLength(1); expect(await db('billinghx')).toHaveLength(1);
        expect((await new Submit(request(), 1).submit()).billingid).toBe(a.billingid);
    });
    it('rejects key reuse with changed input and unknown receipt modes without writes', async () => {
        await new Submit(request(), 1).submit();
        await expect(new Submit(request({ paid: 0, payments: [] }), 1).submit()).rejects.toThrow();
        await expect(new Submit(request({ request_key: 'ordinary-submit-00002', payments: [{ mode: 99, amount: 100 }] }), 1).submit()).rejects.toThrow();
        expect(await db('billing')).toHaveLength(1); expect(await db('billinghx')).toHaveLength(1);
    });
    it('blocks new/backdated submissions and closed additions irrespective of submitted new date', async () => {
        await db('financial_day_closures').insert({ branchid: 2, financial_date: '2026-10-02', status: 'finalized' });
        await expect(new Submit(request(), 1).submit()).rejects.toThrow();
        await db('billing').insert({ billingid: 50, patientid: 7, branchid: 2, billedon: '2026-10-02', record_validated_and_signed_off: 1 });
        await expect(new Submit(request({ billingid: 50, billeddate: '2026-11-07', isAdjustment: true, adjustmentType: 'addition' }), 1).submit()).rejects.toThrow();
        expect(await db('dboservices')).toHaveLength(0);
    });
    it('serializes competing additions on an existing source bill without losing totals', async () => {
        const first = await new Submit(request(), 1).submit();
        const addition = { billingid: first.billingid, isAdjustment: true, adjustmentType: 'addition', billeddate: '2026-11-07' };
        await Promise.all([new Submit(request({ ...addition, request_key: 'ordinary-addition-0001' }), 1).submit(),
            new Submit(request({ ...addition, request_key: 'ordinary-addition-0002' }), 1).submit()]);
        expect(await db('billing').first()).toMatchObject({ paid: 300, payable: 300, billedon: '2026-10-02' });
        expect(await db('dboservices')).toHaveLength(3); expect(await db('billinghx')).toHaveLength(3);
    });
    it('does not remove pending services from a signed source sale', async () => {
        const first = await new Submit(request({ paid: 0, payments: [], paymentDetails: { amount: 0 } }), 1).submit();
        await db('billing').where({ billingid: first.billingid }).update({ record_validated_and_signed_off: 1 });
        const row = await db('dboservices').first();
        expect(await Submit.removePendingNonPaidServices({ tenantId: 1, billingid: first.billingid, serviceid: row.serviceid, employeeid: 8, branchid: 2 })).toBe('failed');
        expect(await db('dboservices').first()).toEqual(row);
        expect(await db('billing').first()).toMatchObject({ payable: 100, paid: 0 });
    });
});
