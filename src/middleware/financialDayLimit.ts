import type { NextFunction, Request, Response } from 'express';
import logger from '../hooks/logger';
import { getAuthUser } from './authority';
import { AccountingError } from '../accountingModule/errors/AccountingErrors';
import { FinancialDayLimitService } from '../accountingModule/services/FinancialDayLimitService';

export function financialTransactionLedger(method: string, path: string): 'facility' | 'pharmacy' | null {
     if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return null;
     path = path.toLowerCase().replace(/\/+$/, '');
     if (path.startsWith('/api/v1/pharmacy/')) {
          const route = path.slice('/api/v1/pharmacy'.length);
          if (/^\/receiving\/(?:policy|prices\/preview)$/.test(route) || /^\/accounting\/expenses\/[^/]+\/attachments$/.test(route)) return null;
          if (/^\/(?:sales(?:\/[^/]+\/reverse|\/held\/[^/]+\/complete)?|counter\/invoices(?:\/[^/]+\/(?:pay|collect|recover|cancel))?|credit\/invoices\/[^/]+\/payment|management\/(?:open-day|reopen-day|expenses|supplier-payments|journals|import-stock)|items\/[^/]+\/(?:stock-up|write-off)|shifts\/open)$/.test(route) ||
               /^\/(?:receiving|purchasing)(?:\/|$)/.test(route) ||
               /^\/enterprise\/(?:stock-counts|quarantine|transfers|supplier-returns|invoice-match|purchase-requests|nhis-claims)(?:\/|$)/.test(route) ||
               /^\/(?:orders|nhis\/claims)(?:\/|$)/.test(route) ||
               /^\/accounting\/(?:journals|expenses|expense-refunds|settlements|supplier-payments|receivables|payables|payments|adjustments|opening-balances|reversals)(?:\/|$)/.test(route))
               return 'pharmacy';
          return null;
     }
     if (path === '/api/v1/billing' ||
          /^\/api\/v1\/billing\/(?:multi(?:\/submit)?|pending\/remove\/service|suspended\/[^/]+\/finalize|refund-all|write-off\/transaction|sales\/session\/create|management\/void\/[^/]+|multi-service\/payment|payment\/update)$/.test(path) ||
          /^\/api\/v1\/billing\/previous\/(?:request\/refund|refund\/update)(?:\/|$)/.test(path) ||
          /^\/api\/v1\/(?:expenses(?:\/invoice(?:\/create-with-expenses)?|\/payment(?:\/reverse)?)?|expense\/record\/single|outsourced\/cases\/mark-expense|supplier-payments\/mark-expense|organization\/update\/payment|clinicians\/payments\/[^/]+|entityorders\/[^/]+\/convert|appointments\/[^/]+\/convert|accounting\/opening-balances)$/.test(path) ||
          /^\/api\/v1\/organization-invoices(?:\/|$)/.test(path) ||
          /^\/api\/v1\/inventory\/supplier-payments\/(?:payments|allocations)(?:\/|$)/.test(path) ||
          /^\/api\/v1\/inventory\/(?:orders(?:\/[^/]+(?:\/receive|\/cancel)?)?|transactions\/create)$/.test(path) ||
          /^\/api\/v1\/accounting\/manual-journals\/[^/]+\/(?:post|reverse)$/.test(path))
          return 'facility';
     return null;
}

function failure(response: Response, error: unknown, tenantId: number) {
     if (error instanceof AccountingError) return response.status(error.statusCode).json({
          status: 'error', statusCode: error.statusCode, code: error.code, message: error.message,
     });
     logger.error('Financial day limit verification failed', { tenantId, message: error instanceof Error ? error.message : String(error), code: error && typeof error === 'object' && 'code' in error ? error.code : undefined });
     return response.status(503).json({
          status: 'error', statusCode: 503, code: 'FINANCIAL_DAY_CHECK_FAILED',
          message: 'Unable to verify the financial day. No transaction was started. Please try again or contact your administrator.',
     });
}

export async function financialDayLimit(request: Request, response: Response, next: NextFunction) {
     const ledger = financialTransactionLedger(request.method, request.path);
     if (!ledger) return next();
     const actor = getAuthUser(request);
     if (!actor) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
     try {
          const branchId = Number(actor.branch);
          const service = new FinancialDayLimitService(actor.tenantId);
          const status = await service.transactionStatus(branchId, ledger === 'pharmacy');
          if (status.blocked) {
               const message = `Transactions are blocked: financial day ${status.oldestFinancialDate} has reached the 48-hour closing limit. ${ledger === 'pharmacy' && status.closeUrl === '/pharmacy/finance' ? 'Close the pharmacy financial day' : 'Finalize the laboratory financial day'} before starting another transaction.`;
               return response.status(409).json({
                    status: 'error', success: false, statusCode: 409, code: 'FINANCIAL_DAY_OVERDUE', message,
                    error: { code: 'FINANCIAL_DAY_OVERDUE', message }, result: status,
               });
          }
          return next();
     } catch (error) {
          return failure(response, error, actor.tenantId);
     }
}

export async function financialDayReadinessHandler(request: Request, response: Response) {
     response.setHeader('Cache-Control', 'private, no-store');
     const actor = getAuthUser(request);
     if (!actor) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
     try {
          const status = await new FinancialDayLimitService(actor.tenantId).transactionStatus(Number(actor.branch), request.query.ledger === 'pharmacy');
          return response.json({ status: 'success', statusCode: 200, result: status });
     } catch (error) {
          return failure(response, error, actor.tenantId);
     }
}
