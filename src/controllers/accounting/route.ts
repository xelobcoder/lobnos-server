import { Router } from 'express';
import { AccountingReportController } from './AccountingReportController';
import { ManualJournalController } from './ManualJournalController';

const accountingRouter = Router();

accountingRouter.get('/api/v1/accounting/reports/trial-balance', AccountingReportController.trialBalance);
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
accountingRouter.put('/api/v1/accounting/periods/:periodCode/status', AccountingReportController.setPeriodStatus);

accountingRouter.get('/api/v1/accounting/manual-journals', ManualJournalController.list);
accountingRouter.post('/api/v1/accounting/manual-journals', ManualJournalController.create);
accountingRouter.get('/api/v1/accounting/manual-journals/:id', ManualJournalController.findById);
accountingRouter.put('/api/v1/accounting/manual-journals/:id', ManualJournalController.update);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/submit', ManualJournalController.submit);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/approve', ManualJournalController.approve);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/post', ManualJournalController.post);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/reverse', ManualJournalController.reverse);
accountingRouter.put('/api/v1/accounting/manual-journals/:id/void', ManualJournalController.voidJournal);

accountingRouter.get('/api/v1/accounting/outbox', AccountingReportController.listOutbox);
accountingRouter.get('/api/v1/accounting/outbox/health', AccountingReportController.outboxHealth);
accountingRouter.put('/api/v1/accounting/outbox/:id/replay', AccountingReportController.replayOutbox);

accountingRouter.post('/api/v1/accounting/close/fiscal-year', AccountingReportController.closeFiscalYear);
accountingRouter.post('/api/v1/accounting/opening-balances', AccountingReportController.openingBalances);

export default accountingRouter;
