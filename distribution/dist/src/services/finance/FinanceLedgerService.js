"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceLedgerService = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const financeLedgerInit_1 = require("./financeLedgerInit");
class FinanceLedgerService {
    static mapPaymentModeToAccountRef(paymentMode) {
        if (paymentMode === null || typeof paymentMode === 'undefined') {
            return null;
        }
        return `payment-mode:${paymentMode}`;
    }
    static mapMethodToAccountRef(method) {
        if (!method) {
            return null;
        }
        return `method:${method.toLowerCase()}`;
    }
    static async recordEntry(input) {
        if (!input.amount || Number(input.amount) <= 0) {
            return null;
        }
        await (0, financeLedgerInit_1.ensureFinanceLedgerTables)(input.tenantId);
        const db = input.trx || await (0, KnexConnections_1.default)(input.tenantId);
        const payload = {
            occurred_at: input.occurredAt || new Date(),
            direction: input.direction,
            amount: Number(input.amount),
            account_ref: input.accountRef || null,
            source_module: input.sourceModule,
            source_table: input.sourceTable,
            source_pk: input.sourcePk,
            billingid: input.billingid || null,
            expense_id: input.expenseId || null,
            invoice_id: input.invoiceId || null,
            employeeid: input.employeeid || null,
            branchid: input.branchid || null,
            status: input.status || 'posted',
            reversal_of_ledger_id: input.reversalOfLedgerId || null,
            reversed_at: input.reversedAt || null,
            created_at: new Date()
        };
        await db('finance_ledger')
            .insert(payload)
            .onConflict(['source_module', 'source_table', 'source_pk', 'direction'])
            .ignore();
        const row = await db('finance_ledger')
            .select('id')
            .where({
            source_module: input.sourceModule,
            source_table: input.sourceTable,
            source_pk: input.sourcePk,
            direction: input.direction
        })
            .first();
        return (row === null || row === void 0 ? void 0 : row.id) || null;
    }
    static async findLedgerIdBySource(tenantId, sourceModule, sourceTable, sourcePk, direction, trx) {
        await (0, financeLedgerInit_1.ensureFinanceLedgerTables)(tenantId);
        const db = trx || await (0, KnexConnections_1.default)(tenantId);
        const query = db('finance_ledger')
            .select('id')
            .where({
            source_module: sourceModule,
            source_table: sourceTable,
            source_pk: sourcePk
        });
        if (direction) {
            query.andWhere({ direction });
        }
        const row = await query.orderBy('id', 'desc').first();
        return (row === null || row === void 0 ? void 0 : row.id) || null;
    }
    static async getSummary(tenantId, filters = {}) {
        await (0, financeLedgerInit_1.ensureFinanceLedgerTables)(tenantId);
        const db = await (0, KnexConnections_1.default)(tenantId);
        const baseQuery = db('finance_ledger').where({ status: 'posted' });
        if (filters.from) {
            baseQuery.andWhere('occurred_at', '>=', filters.from);
        }
        if (filters.to) {
            baseQuery.andWhere('occurred_at', '<=', filters.to);
        }
        if (filters.branchid) {
            baseQuery.andWhere('branchid', filters.branchid);
        }
        if (filters.sourceModule) {
            baseQuery.andWhere('source_module', filters.sourceModule);
        }
        if (filters.accountRef) {
            baseQuery.andWhere('account_ref', filters.accountRef);
        }
        const totals = await baseQuery
            .clone()
            .select(db.raw(`COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) AS total_credits`), db.raw(`COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) AS total_debits`))
            .first();
        const moduleBreakdown = await baseQuery
            .clone()
            .select('source_module', db.raw(`COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) AS total_credits`), db.raw(`COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0) AS total_debits`), db.raw(`COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS balance`))
            .groupBy('source_module')
            .orderBy('source_module', 'asc');
        const totalCredits = Number((totals === null || totals === void 0 ? void 0 : totals.total_credits) || 0);
        const totalDebits = Number((totals === null || totals === void 0 ? void 0 : totals.total_debits) || 0);
        return {
            totalCredits,
            totalDebits,
            amountInHand: totalCredits - totalDebits,
            moduleBreakdown: (moduleBreakdown || []).map((item) => ({
                source_module: item.source_module,
                total_credits: Number(item.total_credits || 0),
                total_debits: Number(item.total_debits || 0),
                balance: Number(item.balance || 0)
            }))
        };
    }
}
exports.FinanceLedgerService = FinanceLedgerService;
