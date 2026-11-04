import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import vm from 'vm';
import ts from 'typescript';
import { minorUnits } from '../../accountingModule/utils/money';
import { roleAllowed } from '../../middleware/roles';

// Writer financial/rollback/concurrency regressions now execute the production
// BillingRefundService against real isolated SQL in BillingRefundService.test.ts.
function load(file: string, mocks: any) {
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText, { exports, console, require: (name: string) => mocks[name] || {} });
    return exports;
}
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
        const req: any = { query: { tenantId: 1 }, authUser: { employeeid: 7, role: 'cashier', tenantId: 1, branch: 2 },
            body: { billingid: 1, serviceid: 11, employeeid: 99, selectedPaymentMode: 1, refundAmount: 40, request_key: 'refund-request-0001' } };
        const res: any = { code: 200, status(code: number) { this.code = code; return this; }, send(body: any) { this.body = body; return this; } };
        return { run: () => controller.requestForRefundCashIssueOut(req, res), req, res, issueOutCashOutOfRefund, dispatch };
    }
    it('uses the authenticated employee and branch instead of submitted identity', async () => {
        const h = handler(); await h.run();
        expect(h.issueOutCashOutOfRefund.mock.calls[0][1]).toMatchObject({ employeeid: 7, branchid: 2 });
        expect(h.res.body.status).toBe(true);
    });
    it('rejects the original negative-amount trigger before reaching persistence', async () => {
        const h = handler(); h.req.body.refundAmount = -10; await h.run();
        expect(h.res.code).toBe(400); expect(h.issueOutCashOutOfRefund).not.toHaveBeenCalled();
    });
    it('accepts the existing select control numeric-string payment mode as a canonical ID', async () => {
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
