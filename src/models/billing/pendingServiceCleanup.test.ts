import { describe, expect, it } from 'vitest';
import fs from 'fs';
import vm from 'vm';
import ts from 'typescript';

// Execute the production method with a connection double: no tenant database.
function loadBilling(connection: any) {
    const exports: any = {};
    const source = fs.readFileSync('src/models/billing/billing-new-client-multi.ts', 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText, { exports, console, require: (name: string) => {
        if (name === '../../database/KnexConnections') return async () => connection;
        if (name === './BillingFinancialGuard') return { lockMutableBill: async () => ({ billingid: 1 }) };
        if (name === '../operations/types') return { OperationsFailures: {
            notFound: 'missing', serviceAlreadyDeleted: 'deleted', internalServerError: 'failed',
        } };
        return {};
    } });
    return exports.SubmitCustomerBilling;
}

describe('pending-service transaction cleanup', () => {
    it.each([undefined, { paymentstatus: 'pending', isDeleted: 1 }])(
        'rolls back validation exits and releases their connection: %j', async service => {
            let rollbacks = 0;
            let completed = false;
            const trx: any = () => ({ where() { return this; }, forUpdate() { return this; }, first: async () => service });
            trx.isCompleted = () => completed;
            trx.rollback = async () => { rollbacks++; completed = true; };
            trx.commit = async () => { throw new Error('Invalid service must not commit'); };
            const connection: any = () => ({ where() { return this; }, first: async () => ({ billingid: 1 }) });
            connection.transaction = async () => trx;
            const result = await loadBilling(connection).removePendingNonPaidServices({
                tenantId: 1, billingid: 1, serviceid: 404, employeeid: 7,
            });
            expect(result).toBe(service ? 'deleted' : 'missing');
            expect(completed).toBe(true);
            expect(rollbacks).toBe(1);
        },
    );
});
