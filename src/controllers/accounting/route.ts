import { Router } from 'express';
import { AccountingReportController } from './AccountingReportController';
import { ManualJournalController } from './ManualJournalController';
import { AuthorityController } from './AuthorityController';
import { BankReconciliationController, parseBankExcelUpload } from './BankReconciliationController';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { requireAccountingRole, requireAuthority, requireOwnerRole } from '../../middleware/authority';

const accountingRouter = Router();

// the books are visible only to signed-in administrators and accountants
accountingRouter.use('/api/v1/accounting', checkTokenExists, requireAccountingRole);

accountingRouter.get('/api/v1/accounting/reports/trial-balance', AccountingReportController.trialBalance);
accountingRouter.get('/api/v1/accounting/reports/financial-overview', AccountingReportController.financialOverview);
accountingRouter.get('/api/v1/accounting/reports/general-ledger', AccountingReportController.generalLedger);
accountingRouter.get('/api/v1/accounting/reports/income-statement', AccountingReportController.incomeStatement);
accountingRouter.get('/api/v1/accounting/reports/balance-sheet', AccountingReportController.balanceSheet);
accountingRouter.get('/api/v1/accounting/reports/receivable-aging', AccountingReportController.receivableAging);
accountingRouter.get('/api/v1/accounting/reports/payable-aging', AccountingReportController.payableAging);
accountingRouter.get('/api/v1/accounting/accounts', AccountingReportController.accounts);
accountingRouter.get('/api/v1/accounting/reports/cash-flow', AccountingReportController.cashFlow);
accountingRouter.get('/api/v1/accounting/reports/revenue-analysis', AccountingReportController.revenueAnalysis);
accountingRouter.get('/api/v1/accounting/reports/expense-analysis', AccountingReportController.expenseAnalysis);
accountingRouter.get('/api/v1/accounting/reports/branch-performance', AccountingReportController.branchPerformance);
accountingRouter.get('/api/v1/accounting/reports/inventory-valuation', AccountingReportController.inventoryValuation);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/balances', AccountingReportController.subledgerBalances);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/reconcile', AccountingReportController.subledgerReconcile);
accountingRouter.get('/api/v1/accounting/subledger/:ledger/statement/:partyType/:partyId', AccountingReportController.subledgerStatement);

accountingRouter.get('/api/v1/accounting/periods', AccountingReportController.listPeriods);
accountingRouter.get('/api/v1/accounting/periods/:periodCode/totals', AccountingReportController.periodTotals);
accountingRouter.put('/api/v1/accounting/periods/:periodCode/status', requireAuthority('accounting.period.close'), AccountingReportController.setPeriodStatus);

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
