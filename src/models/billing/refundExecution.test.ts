import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import vm from 'vm';
import ts from 'typescript';
import { minorUnits } from '../../accountingModule/utils/money';
import { roleAllowed } from '../../middleware/roles';

function load(file: string, mocks: any) {
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText, { exports, console, require: (name: string) => mocks[name] || {} });
    return exports;
}

function writerHarness(options: { approved?: number; completed?: number; serviceBill?: number; failPosting?: boolean; failCommission?: boolean; finalized?: boolean; closedDate?: boolean } = {}) {
    let persisted: any = { paid: 100, payable: 100, totalcost: 100, totalrefunded: 0,
        totalTransactionCost: 100, discount: 0, amountIncurredDueTax: 0, history: 0, postings: 0,
        service: { billingid: options.serviceBill ?? 1, paidamount: 100, totalpayable: 100, totalcost: 100,
            discount: 0, amountIncurredDueTax: 0, amountRefunded: 0, isRefundApproved: options.approved ?? 1,
            isRefundCompleted: options.completed ?? 0, isRefundMatterClosed: 0 } };
    let rollbacks = 0, commits = 0, locks = 0;
    let tail = Promise.resolve();
    const connection: any = { transaction: async () => {
        const previous = tail;
        let release!: () => void;
        tail = new Promise<void>(resolve => { release = resolve; });
        await previous;
        const state = structuredClone(persisted);
        let completed = false;
        const trx: any = (table: string) => {
            const conditions: any = {};
            const query: any = {
                where(key: any, value?: any) { Object.assign(conditions, typeof key === 'object' ? key : { [key]: value }); return this; },
                join() { return this; }, select() { return this; }, forUpdate() { locks++; return this; },
                async first() {
                    if (table === 'billing') return conditions.billingid === 1 ? state : undefined;
                    if (table === 'dboservices as s') return conditions['s.billingid'] === state.service.billingid ? state.service : undefined;
                    if (table === 'dboservices') return state.service;
                    if (table === 'paymentmodes') return { KeyID: 1 };
                    throw new Error('Unexpected read: ' + table);
                },
                update(data: any) {
                    Object.assign(state.service, data);
                    return { where: async () => 1 };
                },
            };
            return query;
        };
        trx.raw = async (sql: string, values: any[]) => {
            if (sql === 'UPDATE_BILL') {
                [state.paid, state.payable, state.outstanding, state.discount, state.amountIncurredDueTax,
                    state.balance, state.totalrefunded, state.totalcost, state.totalTransactionCost] = values;
                return [1];
            }
            if (sql === 'INSERT_HISTORY') { state.history++; return [{ insertId: state.history }]; }
            throw new Error('Unexpected statement');
        };
        trx.post = () => { if (options.failPosting) throw new Error('posting failed'); state.postings++; };
        trx.isCompleted = () => completed;
        trx.commit = async () => { persisted = state; commits++; completed = true; release(); };
        trx.rollback = async () => { rollbacks++; completed = true; release(); };
        return trx;
    } };
    class Tracking {
        async findByServiceId() { return [{ id: 1, status: 'earned', final_commission: 10 }]; }
        async createAdjustment() { if (options.failCommission) throw new Error('commission failed'); }
    }
    const billing = load('obso/billing.ts', {
        '../src/database/KnexConnections': async () => connection,
        '../src/accountingModule/utils/money': { minorUnits },
        '../src/models/billing/queries': { q_update_Billing_Information: 'UPDATE_BILL', insertbillHistoryQuery: 'INSERT_HISTORY' },
        '../src/database/appLevelTriggers': { applyDboservicesAfterUpdate: async () => {} },
        '../src/accountingModule/integrations/BillingAccounting': { enqueueBillingRefund: async (...args: any[]) => args[5].post() },
        '../src/models/commissions/commission-configurations/repositories/CommissionTrackingRepository': { CommissionTrackingRepository: Tracking },
        '../src/accountingModule/services/FinancialFinalizationGuard': { FinancialFinalizationGuard: class {
            async assertRecordMutable() { if (options.finalized) throw new Error('finalized'); }
            async assertDateOpen() { if (options.closedDate) throw new Error('closed period'); }
        } },
    }).Billing;
    const execute = (changes = {}) => billing.updatePreviouslyBilledClientAfterRefundConcluded(1, {
        billingid: 1, serviceid: 11, employeeid: 7, selectedPaymentMode: 1, refundAmount: 40, ...changes,
    });
    return { execute, state: () => persisted, stats: () => ({ rollbacks, commits, locks }) };
}

describe('locked legacy refund execution', () => {
    it('commits a valid refund and its accounting history together', async () => {
        const h = writerHarness();
        expect(await h.execute()).toBe(true);
        expect(h.state()).toMatchObject({ paid: 60, payable: 60, totalrefunded: 40, history: 1, postings: 1 });
        expect(h.stats()).toEqual({ commits: 1, rollbacks: 0, locks: 2 });
    });
    it.each([-10, 0, Infinity, NaN, 0.001, '40', 101])('rejects invalid or excessive refund %s', async refundAmount => {
        const h = writerHarness();
        try { expect(await h.execute({ refundAmount })).not.toBe(true); } catch (error) { expect(error).toBeTruthy(); }
        expect(h.stats().commits).toBe(0);
        expect(h.state()).toMatchObject({ paid: 100, history: 0, postings: 0 });
    });
    it.each([{ serviceBill: 2 }, { approved: 0 }, { completed: 1 }])('rejects mismatched/unapproved/completed documents: %j', async options => {
        const h = writerHarness(options);
        expect(await h.execute()).toBe(false);
        expect(h.stats()).toMatchObject({ commits: 0, rollbacks: 1 });
    });
    it.each([{ failPosting: true }, { failCommission: true }, { finalized: true }, { closedDate: true }])('rolls back every financial write on dependency failure: %j', async options => {
        const h = writerHarness(options);
        await expect(h.execute()).rejects.toThrow();
        expect(h.state()).toMatchObject({ paid: 100, history: 0, postings: 0 });
        expect(h.stats()).toMatchObject({ commits: 0, rollbacks: 1 });
    });
    it('serializes competing requests and rejects the replay without another posting', async () => {
        const h = writerHarness();
        expect(await Promise.all([h.execute(), h.execute()])).toEqual([true, false]);
        expect(h.state()).toMatchObject({ history: 1, postings: 1 });
        expect(h.stats()).toMatchObject({ commits: 1, rollbacks: 1 });
    });
});

describe('refund HTTP handler contract', () => {
    function handler(result: unknown = true) {
        const issueOutCashOutOfRefund = vi.fn(async (_tenant: number, _records: any) => result);
        const dispatch = vi.fn(async () => {});
        const controller = load('src/controllers/billing/controllers.ts', {
            '../../models/billing/RefundClass': { Refund: { issueOutCashOutOfRefund } },
            '../../middleware/authority': { getAuthUser: (req: any) => req.authUser },
            '../../middleware/roles': { roleAllowed }, '../../accountingModule/utils/money': { minorUnits },
            '../../models/operations/types': { OperationsFailures: { invalidResponseBodyParams: 'Invalid request' } },
            '../../models/application/notifications/services/NotificationDispatcher': { NotificationDispatcher: { dispatch } },
            '../../hooks/helper': { customError: (message: string, code: number, res: any) => res.status(code).send({ message }),
                responseError: (res: any) => res.status(500).send({ status: false }) },
        });
        const req: any = { query: { tenantId: 1 }, authUser: { employeeid: 7, role: 'cashier', tenantId: 1 },
            body: { billingid: 1, serviceid: 11, employeeid: 99, selectedPaymentMode: 1, refundAmount: 40 } };
        const res: any = { code: 200, status(code: number) { this.code = code; return this; }, send(body: any) { this.body = body; return this; } };
        return { run: () => controller.requestForRefundCashIssueOut(req, res), req, res, issueOutCashOutOfRefund, dispatch };
    }
    it('uses the authenticated employee instead of the submitted employee', async () => {
        const h = handler(); await h.run();
        expect(h.issueOutCashOutOfRefund.mock.calls[0][1]).toMatchObject({ employeeid: 7 });
        expect(h.res.body.status).toBe(true);
    });
    it('rejects the original negative-amount trigger before reaching persistence', async () => {
        const h = handler(); h.req.body.refundAmount = -10; await h.run();
        expect(h.res.code).toBe(400); expect(h.issueOutCashOutOfRefund).not.toHaveBeenCalled();
    });
    it('accepts the existing select control’s numeric-string payment mode as a canonical ID', async () => {
        const h = handler(); h.req.body.selectedPaymentMode = '1'; await h.run();
        expect(h.res.body.status).toBe(true);
        expect(h.issueOutCashOutOfRefund.mock.calls[0][1].selectedPaymentMode).toBe(1);
    });
    it('does not report failure strings as successful refunds or send notifications', async () => {
        const h = handler('Refund not approved'); await h.run();
        expect(h.res.code).toBe(400); expect(h.res.body.status).toBe(false); expect(h.dispatch).not.toHaveBeenCalled();
    });
    it('denies non-payment roles', async () => {
        const h = handler(); h.req.authUser.role = 'scientist'; await h.run();
        expect(h.res.code).toBe(403); expect(h.issueOutCashOutOfRefund).not.toHaveBeenCalled();
    });
});
