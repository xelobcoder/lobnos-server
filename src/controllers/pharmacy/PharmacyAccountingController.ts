import { Request, Response, Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { actorOf, branchOf, roleOf, tenantOf } from './pharmacyContext';
import { pharmacyFinanceAccess } from './pharmacyAccess.middleware';
import { AccountingContext, PharmacyAccountingError, positiveId } from '../../models/pharmacy/accounting/PharmacyAccountingCore';
import { PharmacyAccountingCatalogue } from '../../models/pharmacy/accounting/PharmacyAccountingCatalogue';
import { PharmacyAccountingWorkflows } from '../../models/pharmacy/accounting/PharmacyAccountingWorkflows';
import { PharmacyAccountingRegisters } from '../../models/pharmacy/accounting/PharmacyAccountingRegisters';
import { PharmacyAccountingReconciliation } from '../../models/pharmacy/accounting/PharmacyAccountingReconciliation';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { Knex } from 'knex';
import { PharmacyAccountingSubledgers } from '../../models/pharmacy/accounting/PharmacyAccountingSubledgers';
import { PharmacyAccountingEvidence } from '../../models/pharmacy/accounting/PharmacyAccountingEvidence';
import { PharmacyAccountingReversals } from '../../models/pharmacy/accounting/PharmacyAccountingReversals';
import { PharmacyAccountingTaxCredits } from '../../models/pharmacy/accounting/PharmacyAccountingTaxCredits';
import { PharmacyAccountingSupplierAllocations } from '../../models/pharmacy/accounting/PharmacyAccountingSupplierAllocations';
import { PharmacyLocalAccounts } from '../../models/pharmacy/accounting/PharmacyLocalAccounts';

/**
 * Mounted under /pharmacy/accounting AFTER pharmacyAccess. Tenant/branch/user inputs
 * are never accepted from a payload or query string. Parent owns ledger/consolidation.
 */
export const pharmacyAccountingRouter = Router();
pharmacyAccountingRouter.use(pharmacyFinanceAccess);

export function pharmacyAccountingContext(req: Request): AccountingContext {
     return { tenantId: positiveId(tenantOf(req), 'authenticated tenant'), branch: positiveId(branchOf(req), 'authenticated branch'), actor: positiveId(actorOf(req), 'authenticated employee'), role: roleOf(req) };
}
export function pharmacyAccountingFailure(res: Response, error: any): any {
     if (error instanceof PharmacyAccountingError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
     if (error instanceof AccountingError && error.statusCode < 500) return res.status(error.statusCode).json({ success: false, error: { code: error.code, message: error.message } });
     if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_RECORD', message: 'A record with this reference already exists' } });
     if (/^(The pharmacy financial day|This pharmacy financial day|Select an operating branch|The configured pharmacy payment destination|Ask the pharmacy manager)/.test(error?.message || '')) return res.status(409).json({ success: false, error: { code: 'POSTING_BLOCKED', message: error.message } });
     // Never return SQL, connection strings or provider messages.
     return res.status(500).json({ success: false, error: { code: 'ACCOUNTING_OPERATION_FAILED', message: 'Accounting operation could not be completed; no changes were committed' } });
}
type Services = { catalogue: PharmacyAccountingCatalogue; localAccounts: PharmacyLocalAccounts; workflows: PharmacyAccountingWorkflows; registers: PharmacyAccountingRegisters; reconciliation: PharmacyAccountingReconciliation; subledgers: PharmacyAccountingSubledgers; evidence: PharmacyAccountingEvidence; reversals: PharmacyAccountingReversals; taxCredits: PharmacyAccountingTaxCredits; supplierAllocations: PharmacyAccountingSupplierAllocations };
const services = (db: Knex, context: AccountingContext): Services => ({
     catalogue: new PharmacyAccountingCatalogue(db, context), localAccounts: new PharmacyLocalAccounts(db, context), workflows: new PharmacyAccountingWorkflows(db, context),
     registers: new PharmacyAccountingRegisters(db, context), reconciliation: new PharmacyAccountingReconciliation(db, context),
     subledgers: new PharmacyAccountingSubledgers(db, context), evidence: new PharmacyAccountingEvidence(db, context),
     reversals: new PharmacyAccountingReversals(db, context), taxCredits: new PharmacyAccountingTaxCredits(db, context),
     supplierAllocations: new PharmacyAccountingSupplierAllocations(db, context),
});
const endpoint = (work: (s: Services, req: Request) => Promise<any>, created = false) => async (req: Request, res: Response) => {
     try {
          const context = pharmacyAccountingContext(req);
          const db = await KnexConnection(context.tenantId);
          const data = await work(services(db, context), req);
          res.status(created ? 201 : 200).json({ success: true, data });
     } catch (error) { pharmacyAccountingFailure(res, error); }
};
pharmacyAccountingRouter.get('/overview', endpoint(s => s.registers.overview()));
pharmacyAccountingRouter.get('/accounts', endpoint(s => s.catalogue.accounts()));
pharmacyAccountingRouter.post('/local-accounts', endpoint((s, r) => s.localAccounts.create(r.body), true));
pharmacyAccountingRouter.put('/local-accounts/:id', endpoint((s, r) => s.localAccounts.update(positiveId(r.params.id), r.body)));
pharmacyAccountingRouter.post('/local-accounts/:id/remove', endpoint((s, r) => s.localAccounts.remove(positiveId(r.params.id), r.body)));
pharmacyAccountingRouter.post('/accounts', endpoint((s, r) => s.catalogue.createAccount(r.body), true));
pharmacyAccountingRouter.post('/accounts/:id/remove', endpoint((s, r) => s.catalogue.removeOwnedAccount(positiveId(r.params.id), r.body)));
pharmacyAccountingRouter.put('/accounts/:id', endpoint((s, r) => s.catalogue.updateAccount(positiveId(r.params.id), r.body)));
pharmacyAccountingRouter.get('/settings', endpoint(s => s.catalogue.settings()));
pharmacyAccountingRouter.put('/settings', endpoint((s, r) => s.catalogue.saveSettings(r.body)));
pharmacyAccountingRouter.get('/journals', endpoint((s, r) => s.workflows.list('journal', r.query)));
pharmacyAccountingRouter.get('/journals/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'journal')));
pharmacyAccountingRouter.post('/journals', endpoint((s, r) => s.workflows.createJournal(r.body), true));
pharmacyAccountingRouter.post('/journals/:id/:action', endpoint((s, r) => s.workflows.journalAction(String(r.params.id), String(r.params.action), r.body)));
pharmacyAccountingRouter.get('/expenses', endpoint((s, r) => s.workflows.list('expense', r.query)));
pharmacyAccountingRouter.get('/expenses/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'expense')));
pharmacyAccountingRouter.post('/expenses', endpoint((s, r) => s.workflows.createExpense(r.body), true));
pharmacyAccountingRouter.post('/expenses/:id/:action(submit|approve|pay|reverse|void)', endpoint((s, r) => s.workflows.expenseAction(String(r.params.id), String(r.params.action), r.body)));
pharmacyAccountingRouter.get('/audit', endpoint((s, r) => s.registers.audit(r.query)));
pharmacyAccountingRouter.get('/periods', endpoint(s => s.registers.periods()));
pharmacyAccountingRouter.post('/periods/:period/:action', (_req, res) => {
     pharmacyAccountingFailure(res, new PharmacyAccountingError('Organization-wide periods must be closed or reopened through the authorized facility accounting workflow; pharmacy posting enforces those locks', 'ORGANIZATION_PERIOD_AUTHORITY_REQUIRED', 403));
});
pharmacyAccountingRouter.get('/receivables', endpoint((s, r) => s.registers.receivables(r.query)));
pharmacyAccountingRouter.get('/payables', endpoint((s, r) => s.registers.payables(r.query)));
pharmacyAccountingRouter.get('/payables/bills', endpoint((s, r) => s.subledgers.bills(r.query)));
pharmacyAccountingRouter.post('/payables/bills', endpoint((s, r) => s.subledgers.registerBill(r.body), true));
pharmacyAccountingRouter.put('/payables/bills/:id/due-date', endpoint((s, r) => s.subledgers.billDueDate(String(r.params.id), r.body)));
pharmacyAccountingRouter.get('/payables/aging', endpoint((s, r) => s.subledgers.payableAging(r.query)));
pharmacyAccountingRouter.get('/payables/settlements', endpoint((s, r) => s.workflows.list('ap_settlement', r.query)));
pharmacyAccountingRouter.get('/payables/settlements/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'ap_settlement')));
pharmacyAccountingRouter.post('/payables/settlements', endpoint((s, r) => s.subledgers.createSettlement(r.body), true));
pharmacyAccountingRouter.post('/payables/payments', endpoint((s, r) => s.subledgers.recordSupplierPayment(r.body), true));
pharmacyAccountingRouter.post('/payables/settlements/:id/:action(submit|approve|pay|void|record_payment)', endpoint((s, r) => s.subledgers.settlementAction(String(r.params.id), String(r.params.action), r.body)));
pharmacyAccountingRouter.post('/payables/settlements/:id/reversals', endpoint((s, r) => s.reversals.create(String(r.params.id), 'ap_reversal', r.body), true));
pharmacyAccountingRouter.get('/payables/settlement-reversals', endpoint((s, r) => s.workflows.list('ap_reversal', r.query)));
pharmacyAccountingRouter.get('/payables/settlement-reversals/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'ap_reversal')));
pharmacyAccountingRouter.post('/payables/settlement-reversals/:id/replacements', endpoint((s, r) => s.reversals.replace(String(r.params.id), 'ap_reversal', r.body), true));
pharmacyAccountingRouter.post('/payables/settlement-reversals/:id/:action(submit|approve|post|void)', endpoint((s, r) => s.reversals.action(String(r.params.id), 'ap_reversal', String(r.params.action), r.body)));
pharmacyAccountingRouter.get('/payables/allocation-sources/candidates', endpoint((s, r) => s.supplierAllocations.candidates(r.query)));
pharmacyAccountingRouter.get('/payables/allocation-sources', endpoint((s, r) => s.supplierAllocations.sources(r.query)));
pharmacyAccountingRouter.post('/payables/allocation-sources', endpoint((s, r) => s.supplierAllocations.register(r.body), true));
pharmacyAccountingRouter.get('/payables/allocations', endpoint((s, r) => s.workflows.list('supplier_allocate', r.query)));
pharmacyAccountingRouter.get('/payables/allocations/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'supplier_allocate')));
pharmacyAccountingRouter.post('/payables/allocations', endpoint((s, r) => s.supplierAllocations.create(r.body), true));
pharmacyAccountingRouter.post('/payables/allocations/:id/:action(submit|approve|post|void)', endpoint((s, r) => s.supplierAllocations.action(String(r.params.id), false, String(r.params.action), r.body)));
pharmacyAccountingRouter.post('/payables/allocations/:id/reversals', endpoint((s, r) => s.supplierAllocations.createRelease(String(r.params.id), r.body), true));
pharmacyAccountingRouter.get('/payables/allocation-reversals', endpoint((s, r) => s.workflows.list('supplier_unallocate', r.query)));
pharmacyAccountingRouter.get('/payables/allocation-reversals/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'supplier_unallocate')));
pharmacyAccountingRouter.post('/payables/allocation-reversals/:id/:action(submit|approve|post|void)', endpoint((s, r) => s.supplierAllocations.action(String(r.params.id), true, String(r.params.action), r.body)));
pharmacyAccountingRouter.put('/receivables/:id/due-date', endpoint((s, r) => s.subledgers.invoiceDueDate(String(r.params.id), r.body)));
pharmacyAccountingRouter.get('/receivables/aging', endpoint((s, r) => s.subledgers.receivableAging(r.query)));
pharmacyAccountingRouter.get('/receivables/adjustments', endpoint((s, r) => s.workflows.list('ar_adjustment', r.query)));
pharmacyAccountingRouter.get('/receivables/adjustments/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'ar_adjustment')));
pharmacyAccountingRouter.post('/receivables/adjustments', endpoint((s, r) => s.subledgers.createAdjustment(r.body), true));
pharmacyAccountingRouter.post('/receivables/adjustments/:id/:action(submit|approve|post|void)', endpoint((s, r) => s.subledgers.adjustmentAction(String(r.params.id), String(r.params.action), r.body)));
pharmacyAccountingRouter.post('/receivables/adjustments/:id/reversals', endpoint((s, r) => s.reversals.create(String(r.params.id), 'ar_reversal', r.body), true));
pharmacyAccountingRouter.get('/receivables/adjustment-reversals', endpoint((s, r) => s.workflows.list('ar_reversal', r.query)));
pharmacyAccountingRouter.get('/receivables/adjustment-reversals/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'ar_reversal')));
pharmacyAccountingRouter.post('/receivables/adjustment-reversals/:id/replacements', endpoint((s, r) => s.reversals.replace(String(r.params.id), 'ar_reversal', r.body), true));
pharmacyAccountingRouter.post('/receivables/adjustment-reversals/:id/:action(submit|approve|post|void)', endpoint((s, r) => s.reversals.action(String(r.params.id), 'ar_reversal', String(r.params.action), r.body)));
pharmacyAccountingRouter.get('/tax-credits', endpoint((s, r) => s.taxCredits.register(r.query)));
pharmacyAccountingRouter.post('/evidence/uploads', endpoint((s, r) => s.evidence.upload(r.body), true));
pharmacyAccountingRouter.get('/expenses/:id/attachments', endpoint((s, r) => s.evidence.attachments(String(r.params.id))));
pharmacyAccountingRouter.post('/expenses/:id/attachments', endpoint((s, r) => s.evidence.attach(String(r.params.id), r.body), true));
pharmacyAccountingRouter.get('/expenses/:id/attachments/:attachmentId/content', async (req, res) => {
     try {
          const context = pharmacyAccountingContext(req), db = await KnexConnection(context.tenantId);
          const file = await new PharmacyAccountingEvidence(db, context).content(String(req.params.id), String(req.params.attachmentId));
          res.setHeader('Content-Type', file.mimeType); res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`); res.setHeader('Cache-Control', 'private, no-store');
          res.send(file.content);
     } catch (error) { pharmacyAccountingFailure(res, error); }
});
pharmacyAccountingRouter.get('/expenses/:id/refunds', endpoint((s, r) => s.evidence.refunds(String(r.params.id))));
pharmacyAccountingRouter.post('/expenses/:id/refunds', endpoint((s, r) => s.evidence.createRefund(String(r.params.id), r.body), true));
pharmacyAccountingRouter.get('/expense-refunds/:id', endpoint((s, r) => s.workflows.detail(String(r.params.id), 'expense_refund')));
pharmacyAccountingRouter.post('/expense-refunds/:id/:action', endpoint((s, r) => s.evidence.refundAction(String(r.params.id), String(r.params.action), r.body)));
pharmacyAccountingRouter.get('/suppliers/:id/statement', endpoint((s, r) => s.registers.statement(String(r.params.id), 'supplier', r.query)));
pharmacyAccountingRouter.get('/receivables/:id/statement', endpoint((s, r) => s.registers.statement(String(r.params.id), 'customer', r.query)));
pharmacyAccountingRouter.get('/inventory', endpoint((s, r) => s.registers.inventory(r.query)));
pharmacyAccountingRouter.get('/revenue', endpoint((s, r) => s.registers.revenue(r.query)));
pharmacyAccountingRouter.get('/reconciliation', endpoint((s, r) => s.reconciliation.list(r.query)));
pharmacyAccountingRouter.post('/reconciliation/import', endpoint((s, r) => s.reconciliation.importStatement(r.body), true));
pharmacyAccountingRouter.post('/reconciliation/match', endpoint((s, r) => s.reconciliation.match(r.body)));
pharmacyAccountingRouter.post('/reconciliation/finalize', endpoint((s, r) => s.reconciliation.finalize(r.body)));
// Do not silently accept tax, write-off, allocation or attachment surfaces not implemented here.
pharmacyAccountingRouter.all('/tax', (_req, res) => pharmacyAccountingFailure(res, new PharmacyAccountingError('Pharmacy tax policy and filing workflows are not implemented', 'UNSUPPORTED', 501)));
