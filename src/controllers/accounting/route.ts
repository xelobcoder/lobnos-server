import { accountingPlanningRouter } from './AccountingPlanningController';
import { Router } from 'express';
import { AccountingReportController } from './AccountingReportController';
import { ManualJournalController } from './ManualJournalController';
import { AuthorityController } from './AuthorityController';
import { BankReconciliationController, parseBankExcelUpload } from './BankReconciliationController';
import { FinancialDayCloseController } from './FinancialDayCloseController';
import { AccountingCoverageService } from '../../accountingModule/services/AccountingCoverageService';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireAccountingRole, requireAuthority, requireOwnerRole } from '../../middleware/authority';

const accountingRouter = Router();

// the books are visible only to signed-in administrators and accountants
accountingRouter.use('/api/v1/accounting', checkTokenExists, requireAccountingRole);
accountingRouter.use(accountingPlanningRouter);

accountingRouter.get('/api/v1/accounting/reports/trial-balance', AccountingReportController.trialBalance);
accountingRouter.get('/api/v1/accounting/reports/financial-overview', AccountingReportController.financialOverview);
accountingRouter.get('/api/v1/accounting/reports/general-ledger-summary', AccountingReportController.generalLedgerSummary);
accountingRouter.get('/api/v1/accounting/reports/general-ledger', AccountingReportController.generalLedger);
accountingRouter.get('/api/v1/accounting/reports/income-statement', AccountingReportController.incomeStatement);
accountingRouter.get('/api/v1/accounting/reports/balance-sheet', AccountingReportController.balanceSheet);
accountingRouter.get('/api/v1/accounting/reports/receivables', AccountingReportController.outstandingReceivables);
accountingRouter.get('/api/v1/accounting/reports/receivable-aging', AccountingReportController.receivableAging);
accountingRouter.get('/api/v1/accounting/reports/payable-aging', AccountingReportController.payableAging);
accountingRouter.get('/api/v1/accounting/accounts', AccountingReportController.accounts);
accountingRouter.post('/api/v1/accounting/reports/cash-flow/:journalEntryId/classification', requireAuthority('accounting.journal.post'), AccountingReportController.classifyCashFlow);
accountingRouter.get('/api/v1/accounting/reports/cash-flow', AccountingReportController.cashFlow);
accountingRouter.get('/api/v1/accounting/reports/revenue-analysis', AccountingReportController.revenueAnalysis);
accountingRouter.get('/api/v1/accounting/reports/expense-analysis', AccountingReportController.expenseAnalysis);
accountingRouter.get('/api/v1/accounting/reports/branch-performance', AccountingReportController.branchPerformance);
accountingRouter.get('/api/v1/accounting/reports/inventory-valuation', AccountingReportController.inventoryValuation);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/balances', AccountingReportController.subledgerBalances);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/reconcile', AccountingReportController.subledgerReconcile);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/statement/:partyType/:partyId', AccountingReportController.subledgerStatement);

accountingRouter.get('/api/v1/accounting/reconciliation/coverage', async (req, res) => {
     try {
          const report = await new AccountingCoverageService(Number(req.query.tenantId) || 1).report();
          res.send({ status: 'success', statusCode: 200, result: report });
     } catch (error: any) {
          res.status(500).send({ status: 'error', statusCode: 500, message: error?.message || 'Coverage failed' });
     }
});
accountingRouter.post('/api/v1/accounting/reconciliation/backfill', requireOwnerRole, async (req, res) => {
     try {
          const execute = req.body?.execute === true;
          const result = await new AccountingCoverageService(Number(req.query.tenantId) || 1).backfillBilling(execute);
          res.send({ status: 'success', statusCode: 200, result });
     } catch (error: any) {
          res.status(500).send({ status: 'error', statusCode: 500, message: error?.message || 'Backfill failed' });
     }
});

accountingRouter.get('/api/v1/accounting/control-history', AccountingReportController.controlHistory);
accountingRouter.get('/api/v1/accounting/periods', AccountingReportController.listPeriods);
accountingRouter.get('/api/v1/accounting/periods/:periodCode/totals', AccountingReportController.periodTotals);
accountingRouter.put('/api/v1/accounting/periods/:periodCode/status', requireAuthority('accounting.period.close'), AccountingReportController.setPeriodStatus);

accountingRouter.get('/api/v1/accounting/daily-closes', FinancialDayCloseController.list);
accountingRouter.get('/api/v1/accounting/daily-closes/:id', FinancialDayCloseController.detail);
accountingRouter.post('/api/v1/accounting/daily-closes/:financialDate/accountant-submit', FinancialDayCloseController.submit);
accountingRouter.post('/api/v1/accounting/daily-closes/:id/manager-decision', FinancialDayCloseController.managerDecision);
accountingRouter.post('/api/v1/accounting/daily-closes/:id/finalize', requireOwnerRole, FinancialDayCloseController.finalize);

accountingRouter.get('/api/v1/accounting/manual-journals', ManualJournalController.list);
accountingRouter.post('/api/v1/accounting/manual-journals', ManualJournalController.create);
accountingRouter.get('/api/v1/accounting/manual-journals/:id', ManualJournalController.findById);
accountingRouter.put('/api/v1/accounting/manual-journals/:id', ManualJournalController.update);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/submit', ManualJournalController.submit);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/approve', requireAuthority('accounting.journal.approve'), ManualJournalController.approve);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/post', requireAuthority('accounting.journal.post'), ManualJournalController.post);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/reverse', ManualJournalController.reverse);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/void', ManualJournalController.voidJournal);

accountingRouter.get('/api/v1/accounting/outbox', AccountingReportController.listOutbox);
accountingRouter.get('/api/v1/accounting/outbox/health', AccountingReportController.outboxHealth);
accountingRouter.put('/api/v1/accounting/outbox/:id/replay', AccountingReportController.replayOutbox);

accountingRouter.post('/api/v1/accounting/close/fiscal-year', AccountingReportController.closeFiscalYear);
accountingRouter.post('/api/v1/accounting/opening-balances', AccountingReportController.openingBalances);

accountingRouter.get('/api/v1/accounting/authority/permissions', AuthorityController.permissions);
accountingRouter.get('/api/v1/accounting/authority/mine', AuthorityController.mine);
accountingRouter.get('/api/v1/accounting/authority/employees', requireOwnerRole, AuthorityController.employees);
accountingRouter.get('/api/v1/accounting/authority/delegations', requireOwnerRole, AuthorityController.list);
accountingRouter.get('/api/v1/accounting/authority/delegations/:employeeid', requireOwnerRole, AuthorityController.forEmployee);
accountingRouter.post('/api/v1/accounting/authority/delegations', requireOwnerRole, AuthorityController.grant);
accountingRouter.put('/api/v1/accounting/authority/delegations/:id', requireOwnerRole, AuthorityController.revise);
accountingRouter.delete('/api/v1/accounting/authority/delegations/:id', requireOwnerRole, AuthorityController.revoke);

accountingRouter.get('/api/v1/accounting/bank/accounts', BankReconciliationController.listAccounts);
accountingRouter.post('/api/v1/accounting/bank/accounts', requireOwnerRole, BankReconciliationController.createAccount);
accountingRouter.put('/api/v1/accounting/bank/accounts/:id', requireOwnerRole, BankReconciliationController.updateAccount);
accountingRouter.post('/api/v1/accounting/bank/statement/import-excel', parseBankExcelUpload, BankReconciliationController.importExcel);
accountingRouter.get('/api/v1/accounting/bank/:bankAccountId/statement-lines', BankReconciliationController.statementLines);
accountingRouter.get('/api/v1/accounting/bank/:bankAccountId/unmatched-ledger', BankReconciliationController.unmatchedLedger);
accountingRouter.get('/api/v1/accounting/bank/:bankAccountId/suggestions', BankReconciliationController.suggestMatches);
accountingRouter.get('/api/v1/accounting/bank/:bankAccountId/summary', BankReconciliationController.summary);
accountingRouter.post('/api/v1/accounting/bank/match', BankReconciliationController.match);
accountingRouter.post('/api/v1/accounting/bank/match-many', BankReconciliationController.matchMany);
accountingRouter.put('/api/v1/accounting/bank/statement-lines/:id/unmatch', BankReconciliationController.unmatch);
accountingRouter.put('/api/v1/accounting/bank/statement-lines/:id/ignore', BankReconciliationController.ignore);

export default accountingRouter;
