import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from '../../../middleware/authority';
import { isSuperAdminRole, roleAllowed } from '../../../middleware/roles';
import { parseSalesReportFilters, SalesExpensesReportService, SalesReportError } from '../../../models/billing/sales/SalesExpensesReport';

export function requireSalesReportAccess(request: Request, response: Response, next: NextFunction) {
     const actor = getAuthUser(request);
     const deny = (code: number, message: string) => response.status(code).json({ status: 'error', statusCode: code, message });
     if (!actor) return deny(401, 'Authentication required');
     if (!roleAllowed(actor.role, ['admin', 'accountant', 'manager'])) return deny(403, 'Financial report access denied');
     // Never choose a connection or actor from employeeid/requesterEmployeeid/body fields.
     if (!Number.isSafeInteger(actor.tenantId) || actor.tenantId <= 0 ||
          (request.query.tenantId !== undefined && String(request.query.tenantId) !== String(actor.tenantId))) {
          return deny(403, 'This session does not belong to the requested organization');
     }
     try {
          const filters = parseSalesReportFilters(request.query);
          // Same financial branch restriction as FinancialDayCloseService: only super admin spans branches.
          if (!isSuperAdminRole(actor.role) && (actor.branch == null || Number(actor.branch) !== filters.branchid)) {
               return deny(403, 'Financial reports are restricted to your branch');
          }
          return next();
     } catch (error) {
          return deny(400, error instanceof SalesReportError ? error.message : 'Invalid report query');
     }
}

export async function handleSalesExpensesReport(request: Request, response: Response) {
     const actor = getAuthUser(request);
     if (!actor) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required' });
     try {
          const data = await new SalesExpensesReportService(actor.tenantId).generate(request.query);
          response.setHeader('Cache-Control', 'no-store');
          return response.status(200).json({ status: 'success', statusCode: 200, data });
     } catch (error) {
          const statusCode = error instanceof SalesReportError ? error.statusCode : 500;
          if (statusCode >= 500) {
               // Log only the database error code/message (no bindings or row data) so failures are diagnosable.
               const e = error as { code?: string; sqlMessage?: string; message?: string };
               console.error('[sales-report] generation failed', { tenantId: actor.tenantId, code: e?.code, message: e?.sqlMessage || e?.message });
          }
          // Do not leak SQL, patient data or provider errors in responses.
          return response.status(statusCode).json({
               status: 'error', statusCode,
               message: error instanceof SalesReportError ? error.message : 'Unable to generate sales and expenses report',
          });
     }
}
