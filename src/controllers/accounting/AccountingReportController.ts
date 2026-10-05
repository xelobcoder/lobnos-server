import { Request, Response } from 'express';
import { AccountingReportService } from '../../accountingModule/services/AccountingReportService';
import { AccountingPeriodService } from '../../accountingModule/services/AccountingPeriodService';
import { getOutboxHealth, listOutbox, replayOutboxRow } from '../../accountingModule/services/AccountingOutboxService';
import { AccountingCloseService } from '../../accountingModule/services/AccountingCloseService';
import { SubledgerService } from '../../accountingModule/services/SubledgerService';
import { OutstandingReceivablesService } from '../../accountingModule/services/OutstandingReceivablesService';
import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort, paginate } from '../../accountingModule/utils/pagination';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { customError } from '../../hooks/helper';

function getTenantId(req: Request): number {
     return parseInt(req.query.tenantId as string) || 1;
}

function handle(error: any, response: Response) {
     if (error instanceof AccountingError) {
          return response.status(error.statusCode).json({
               status: 'error',
               statusCode: error.statusCode,
               message: error.message,
               code: error.code,
          });
     }
     return customError(error?.message || 'Accounting request failed', 500, response);
}

function ok(response: Response, result: any, statusCode = 200) {
     return response.status(statusCode).json({ status: 'success', statusCode, result });
}

export class AccountingReportController {
     static async outstandingReceivables(req: Request, res: Response) {
          const tenantId = Number(req.query.tenantId);
          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) return customError('A valid tenantId is required', 400, res);
          const filters = {
               from: req.query.from ? String(req.query.from) : undefined,
               to: req.query.to ? String(req.query.to) : undefined,
               search: req.query.search ? String(req.query.search) : undefined,
               page: Number(req.query.page) || 1,
               count: Number(req.query.count) || 25,
               sortby: req.query.sortby ? String(req.query.sortby) : undefined,
          };
          try {
               return ok(res, await new OutstandingReceivablesService(tenantId).list(filters));
          } catch (error: any) {
               if (error?.message === 'Dates must be valid YYYY-MM-DD values' || error?.message === 'From date must not exceed to date') {
                    return customError(error.message, 400, res);
               }
               return handle(error, res);
          }
     }

     static async financialOverview(req: Request, res: Response) {
          try {
               const asOf = (req.query.asOf as string) || new Date().toISOString().split('T')[0];
               const service = new AccountingReportService(getTenantId(req));
               return ok(res, await service.financialOverview(asOf, {
                    branchId: req.query.branchId ? Number(req.query.branchId) : undefined,
               }));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async trialBalance(req: Request, res: Response) {
          try {
               const service = new AccountingReportService(getTenantId(req));
               const result = await service.trialBalance(
                    req.query.from as string,
                    req.query.to as string,
                    req.query.branchId ? Number(req.query.branchId) : undefined
               );
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async generalLedger(req: Request, res: Response) {
          try {
               const service = new AccountingReportService(getTenantId(req));
               const result = await service.generalLedger({
                    from: req.query.from as string,
                    to: req.query.to as string,
                    accountCode: req.query.accountCode as string,
                    sourceModule: req.query.sourceModule as string,
                    branchId: req.query.branchId ? Number(req.query.branchId) : undefined,
                    page: Number(req.query.page) || 1,
                    count: Number(req.query.count) || 50,
                    sortby: req.query.sortby as string | undefined,
               });
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async incomeStatement(req: Request, res: Response) {
          try {
               const from = req.query.from as string;
               const to = req.query.to as string;
               if (!from || !to) return customError('from and to are required', 400, res);

               const service = new AccountingReportService(getTenantId(req));
               const result = await service.incomeStatement(
                    from,
                    to,
                    req.query.branchId ? Number(req.query.branchId) : undefined
               );
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async balanceSheet(req: Request, res: Response) {
          try {
               const asOf = (req.query.asOf as string) || new Date().toISOString().split('T')[0];
               const service = new AccountingReportService(getTenantId(req));
               const result = await service.balanceSheet(
                    asOf,
                    req.query.branchId ? Number(req.query.branchId) : undefined
               );
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async receivableAging(req: Request, res: Response) {
          try {
               const service = new SubledgerService(getTenantId(req));
               return ok(res, await service.aging('AR', req.query.asOf as string | undefined, req.query));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async payableAging(req: Request, res: Response) {
          try {
               const service = new SubledgerService(getTenantId(req));
               return ok(res, await service.aging('AP', req.query.asOf as string | undefined, req.query));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async accounts(req: Request, res: Response) {
          try {
               const tenantId = getTenantId(req);
               const db = await KnexConnection(tenantId);
               const rows = await db('acc_accounts')
                    .select('account_code', 'name', 'type', 'normal_balance', 'is_active')
                    .orderBy('account_code', 'asc');

               // the chart is small and the journal editor needs it whole, so paging is opt-in
               if (!req.query.page && !req.query.count) return ok(res, rows);

               const paging = parsePaging(req.query, 50);
               const sort = parseSort(req.query, ['account_code', 'name', 'type', 'normal_balance'], {
                    column: 'account_code',
                    direction: 'asc',
               });

               return ok(res, paginate(rows, paging, sort));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async subledgerBalances(req: Request, res: Response) {
          try {
               const ledger = String(req.params.ledger).toUpperCase();
               if (ledger !== 'AR' && ledger !== 'AP') return customError('ledger must be AR or AP', 400, res);

               const service = new SubledgerService(getTenantId(req));
               return ok(res, await service.balances(ledger, req.query.asOf as string | undefined, req.query));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async subledgerStatement(req: Request, res: Response) {
          try {
               const ledger = String(req.params.ledger).toUpperCase();
               if (ledger !== 'AR' && ledger !== 'AP') return customError('ledger must be AR or AP', 400, res);

               const service = new SubledgerService(getTenantId(req));
               return ok(
                    res,
                    await service.statement(
                         ledger,
                         String(req.params.partyType),
                         Number(req.params.partyId),
                         req.query.from as string | undefined,
                         req.query.to as string | undefined,
                         req.query
                    )
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async subledgerReconcile(req: Request, res: Response) {
          try {
               const ledger = String(req.params.ledger).toUpperCase();
               if (ledger !== 'AR' && ledger !== 'AP') return customError('ledger must be AR or AP', 400, res);

               const service = new SubledgerService(getTenantId(req));
               return ok(res, await service.reconcile(ledger, req.query.asOf as string | undefined));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async cashFlow(req: Request, res: Response) {
          try {
               const from = req.query.from as string;
               const to = req.query.to as string;
               if (!from || !to) return customError('from and to are required', 400, res);

               const service = new AccountingReportService(getTenantId(req));
               return ok(res, await service.cashFlow(from, to));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async revenueAnalysis(req: Request, res: Response) {
          try {
               const from = req.query.from as string;
               const to = req.query.to as string;
               if (!from || !to) return customError('from and to are required', 400, res);

               const service = new AccountingReportService(getTenantId(req));
               return ok(
                    res,
                    await service.periodBreakdown('revenue', from, to, req.query.branchId ? Number(req.query.branchId) : undefined)
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async expenseAnalysis(req: Request, res: Response) {
          try {
               const from = req.query.from as string;
               const to = req.query.to as string;
               if (!from || !to) return customError('from and to are required', 400, res);

               const service = new AccountingReportService(getTenantId(req));
               return ok(
                    res,
                    await service.periodBreakdown('expense', from, to, req.query.branchId ? Number(req.query.branchId) : undefined)
               );
          } catch (error) {
               return handle(error, res);
          }
     }

     static async branchPerformance(req: Request, res: Response) {
          try {
               const from = req.query.from as string;
               const to = req.query.to as string;
               if (!from || !to) return customError('from and to are required', 400, res);

               const service = new AccountingReportService(getTenantId(req));
               return ok(res, await service.branchPerformance(from, to));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async inventoryValuation(req: Request, res: Response) {
          try {
               const service = new AccountingReportService(getTenantId(req));
               return ok(res, await service.inventoryValuation(req.query.asOf as string | undefined, req.query));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async listPeriods(req: Request, res: Response) {
          try {
               const service = new AccountingPeriodService(getTenantId(req));
               return ok(res, await service.list(req.query.from as string | undefined, req.query.to as string | undefined));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async periodTotals(req: Request, res: Response) {
          try {
               const service = new AccountingPeriodService(getTenantId(req));
               return ok(res, await service.getPeriodTotals(String(req.params.periodCode)));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async setPeriodStatus(req: Request, res: Response) {
          try {
               const { status, employeeid, notes } = req.body || {};
               const allowed = ['open', 'soft_closed', 'closed', 'locked'];
               if (!allowed.includes(status)) {
                    return customError(`status must be one of ${allowed.join(', ')}`, 400, res);
               }

               const service = new AccountingPeriodService(getTenantId(req));
               const result = await service.setStatus(String(req.params.periodCode), status, employeeid, notes);
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async listOutbox(req: Request, res: Response) {
          try {
               const result = await listOutbox(getTenantId(req), {
                    status: req.query.status as string | undefined,
                    sourceModule: req.query.sourceModule as string | undefined,
                    page: Number(req.query.page) || 1,
                    count: Number(req.query.count) || 25,
                    sortby: req.query.sortby as string | undefined,
               });
               return ok(res, result);
          } catch (error) {
               return handle(error, res);
          }
     }

     static async outboxHealth(req: Request, res: Response) {
          try {
               return ok(res, await getOutboxHealth(getTenantId(req)));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async replayOutbox(req: Request, res: Response) {
          try {
               await replayOutboxRow(getTenantId(req), Number(req.params.id));
               return ok(res, { replayed: Number(req.params.id) });
          } catch (error) {
               return handle(error, res);
          }
     }

     static async closeFiscalYear(req: Request, res: Response) {
          try {
               const fiscalYear = Number(req.body?.fiscalYear);
               if (!fiscalYear) return customError('fiscalYear is required', 400, res);

               const service = new AccountingCloseService(getTenantId(req));
               return ok(res, await service.closeFiscalYear(fiscalYear, req.body?.employeeid));
          } catch (error) {
               return handle(error, res);
          }
     }

     static async openingBalances(req: Request, res: Response) {
          try {
               const { asOf, lines, employeeid } = req.body || {};
               if (!asOf || !Array.isArray(lines)) {
                    return customError('asOf and lines are required', 400, res);
               }

               const service = new AccountingCloseService(getTenantId(req));
               return ok(res, await service.postOpeningBalances(asOf, lines, employeeid), 201);
          } catch (error) {
               return handle(error, res);
          }
     }
}
