import 'dotenv/config';

declare const process: {
     argv: string[];
     env: Record<string, string | undefined>;
     exitCode?: number;
};
declare function require(moduleName: string): any;

const { performance } = require('node:perf_hooks');
let KnexConnection: any;
let CustomerBillingInit: any;
let CustomerBillingCheckout: any;
let SubmitCustomerBilling: any;

interface Options {
     tenantId: number;
     patientId: number;
     branchId: number;
     employeeId: number;
     testId: number;
     count: number;
     confirmDatabase: string;
}

function parseOptions(args: string[]): Options {
     const values = new Map<string, string>();
     for (const arg of args) {
          const match = /^--([a-zA-Z]+)=(.*)$/.exec(arg);
          if (match) values.set(match[1], match[2]);
     }

     const required = ['tenantId', 'patientId', 'branchId', 'employeeId', 'testId', 'confirmDatabase'];
     const missing = required.filter((key) => !values.get(key));
     if (missing.length) {
          throw new Error(`Missing options: ${missing.map((key) => `--${key}=...`).join(', ')}`);
     }

     const numberOption = (key: string, fallback?: number) => {
          const value = values.get(key);
          const parsed = value === undefined ? fallback : Number(value);
          if (!Number.isSafeInteger(parsed) || Number(parsed) <= 0) throw new Error(`--${key} must be a positive integer`);
          return Number(parsed);
     };

     const count = numberOption('count', 10_000);
     if (count > 10_000) throw new Error('Maximum benchmark count is 10000');

     return {
          tenantId: numberOption('tenantId'),
          patientId: numberOption('patientId'),
          branchId: numberOption('branchId'),
          employeeId: numberOption('employeeId'),
          testId: numberOption('testId'),
          count,
          confirmDatabase: values.get('confirmDatabase')!,
     };
}

function percentile(sorted: number[], percent: number): number {
     if (!sorted.length) return 0;
     return sorted[Math.min(sorted.length - 1, Math.ceil(percent * sorted.length) - 1)];
}

async function validateTarget(options: Options): Promise<{ connection: any; paymentMode: number }> {
     const connection = await KnexConnection(options.tenantId);
     const databaseResult = await connection.raw('SELECT DATABASE() AS databaseName');
     const databaseRows = Array.isArray(databaseResult) && Array.isArray(databaseResult[0]) ? databaseResult[0] : databaseResult;
     const databaseName = databaseRows?.[0]?.databaseName;
     const databaseNameValue = String(databaseName || '');
     if (!databaseNameValue || databaseNameValue !== options.confirmDatabase) {
          throw new Error(`Connected database is "${databaseNameValue || 'unknown'}", not the explicitly confirmed database "${options.confirmDatabase}"`);
     }
     const hasDisposableMarker = /(^|[_-])(test|testing|bench|benchmark|qa|sandbox)([_-]|$)/i.test(databaseNameValue)
          || /testmig$/i.test(databaseNameValue);
     if (!hasDisposableMarker) {
          throw new Error('Refusing writes: database name must contain a distinct test, bench, qa, or sandbox marker');
     }

     const [patient, branch, employee, test, paymentMode] = await Promise.all([
          connection('new_patients').where({ patientid: options.patientId }).first('patientid'),
          connection('branch').where({ branchid: options.branchId }).first('branchid'),
          connection('roles').where({ employeeid: options.employeeId }).first('employeeid', 'branch', 'role'),
          connection('test_panels').where({ id: options.testId }).first('id', 'name', 'price'),
          connection('paymentmodes').select('KeyID').first(),
     ]);

     if (!patient) throw new Error(`Patient ${options.patientId} was not found`);
     if (!branch) throw new Error(`Branch ${options.branchId} was not found`);
     if (!employee) throw new Error(`Employee ${options.employeeId} was not found`);
     if (Number(employee.branch) !== options.branchId && !['admin', 'super-admin', 'super_admin'].includes(String(employee.role).toLowerCase())) {
          throw new Error('Benchmark employee must belong to the selected branch unless the employee is an administrator');
     }
     if (!test) throw new Error(`Test ${options.testId} was not found`);
     if (!(Number(test.price) > 0)) throw new Error(`Test ${options.testId} must have a positive catalog price`);
     if (!paymentMode?.KeyID) throw new Error('No payment mode is configured');

     return { connection, paymentMode: Number(paymentMode.KeyID) };
}

async function submitOne(options: Options, paymentMode: number, index: number, runId: string): Promise<number> {
     const init = await CustomerBillingInit.getInstance(options.tenantId).init({
          entityId: 0,
          entityType: 'general',
          patientId: options.patientId,
          branchid: options.branchId,
          billingSource: 1,
          referalCode: undefined,
          includeServices: false,
          isPackageUsed: false,
     });
     if (!init || typeof init !== 'object' || !Array.isArray((init as any).testList)) {
          throw new Error(`Billing initialization failed: ${typeof init === 'string' ? init : JSON.stringify(init)}`);
     }

     const testItem = (init as any).testList.find((item: any) => Number(item.testid) === options.testId);
     if (!testItem) throw new Error(`Test ${options.testId} is not available for General billing`);

     const checkout = await CustomerBillingCheckout.checkoutCustomerBilling({
          patientId: options.patientId,
          cart: [testItem],
          servicesList: [],
          paymentDetails: null,
          branchid: options.branchId,
          billingSource: 1,
          referalCode: '',
          promoCode: '',
          isPromo: false,
          isPackageUsed: false,
          entityid: 0,
          entitytype: 'general',
          employeeid: options.employeeId,
          tenantId: options.tenantId,
     });
     if (!checkout.success || !checkout.data) throw new Error(`Checkout failed: ${checkout.message}`);

     const data = checkout.data;
     const amount = Number(data.amountPayable);
     if (!Number.isFinite(amount) || amount <= 0) throw new Error('Checkout returned a non-positive amount');

     const submission = await new SubmitCustomerBilling({
          tenantId: options.tenantId,
          patientId: options.patientId,
          patientid: options.patientId,
          employeeid: options.employeeId,
          branchid: options.branchId,
          billingSource: 1,
          entitytype: 'general',
          entityId: 0,
          entityid: 0,
          cart: [testItem],
          servicesProvided: [],
          servicesList: [],
          isPackageUsed: false,
          paid: amount,
          amountPayable: amount,
          subtotal: Number(data.subtotal),
          totaldiscount: Number(data.totaldiscount),
          totalAmountIncurredDueTax: Number(data.totalAmountIncurredDueTax),
          totalServiceAmount: Number(data.totalServiceAmount),
          payments: [{ mode: paymentMode, amount, employeeid: options.employeeId }],
          status: 'paid',
          isAdjustment: 0,
          isPromo: false,
          result_delivery: { preferences: [] },
          additioninformation: `BENCHMARK:${runId}:${index + 1}`,
     }, options.tenantId).submit();

     if (!submission.status || !submission.billingid) {
          throw new Error(`Submission ${index + 1} failed: ${submission.message}`);
     }
     return Number(submission.billingid);
}

async function main() {
     const options = parseOptions(process.argv.slice(2));
     if (process.env.BILLING_BENCHMARK_ALLOW_WRITES !== '1') {
          throw new Error('Set BILLING_BENCHMARK_ALLOW_WRITES=1 only when the server is configured for a disposable benchmark database');
     }
     KnexConnection = require('../src/database/KnexConnections').default;
     CustomerBillingInit = require('../src/models/billing/multi/initCustomerBilling').CustomerBillingInit;
     CustomerBillingCheckout = require('../src/models/billing/multi/customerBillingCheckout').CustomerBillingCheckout;
     SubmitCustomerBilling = require('../src/models/billing/billing-new-client-multi').SubmitCustomerBilling;
     const { connection, paymentMode } = await validateTarget(options);
     const runId = `BILLING_BENCHMARK_${new Date().toISOString().replace(/[:.]/g, '-')}`;
     const durations: number[] = [];
     const failures: Array<{ index: number; message: string }> = [];
     let completed = 0;
     const startedAt = performance.now();

     console.log(JSON.stringify({
          event: 'benchmark-start',
          runId,
          database: options.confirmDatabase,
          tenantId: options.tenantId,
          patientId: options.patientId,
          branchId: options.branchId,
          employeeId: options.employeeId,
          testId: options.testId,
          count: options.count,
          concurrency: options.count,
          note: 'Creates real, fully-paid billing submissions and accounting outbox entries in this disposable database. Records are retained and tagged in billing.additionalinformation.',
     }));

     const submissions = Array.from({ length: options.count }, async (_, index) => {
          const transactionStartedAt = performance.now();
          try {
               await submitOne(options, paymentMode, index, runId);
               durations.push(performance.now() - transactionStartedAt);
          } catch (error: any) {
               failures.push({ index: index + 1, message: error?.message || String(error) });
          } finally {
               completed++;
               if (completed % 100 === 0 || completed === options.count) {
                    console.log(JSON.stringify({ event: 'benchmark-progress', completed, elapsedMs: Math.round(performance.now() - startedAt), failures: failures.length }));
               }
          }
     });

     await Promise.all(submissions);
     const elapsedMs = performance.now() - startedAt;
     const sorted = [...durations].sort((left, right) => left - right);
     const result = {
          event: 'benchmark-complete',
          runId,
          database: options.confirmDatabase,
          requested: options.count,
          completed: durations.length,
          failed: failures.length,
          elapsedMs: Math.round(elapsedMs),
          elapsedSeconds: Number((elapsedMs / 1000).toFixed(3)),
          averageSubmissionMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
          p50SubmissionMs: Math.round(percentile(sorted, 0.50)),
          p95SubmissionMs: Math.round(percentile(sorted, 0.95)),
          p99SubmissionMs: Math.round(percentile(sorted, 0.99)),
          transactionsPerSecond: Number((durations.length / (elapsedMs / 1000)).toFixed(2)),
          failures: failures.slice(0, 10),
          cleanup: `Find benchmark bills where billing.additionalinformation LIKE '${runId}:%'; review and remove related service/audit/accounting records only in this disposable database.`,
     };
     console.log(JSON.stringify(result, null, 2));

     if (failures.length) process.exitCode = 1;
}

main().catch((error: any) => {
     console.error(error?.stack || error?.message || String(error));
     process.exitCode = 1;
});
