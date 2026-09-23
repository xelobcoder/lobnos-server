import { Request, Response } from 'express';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { FinancialDayCloseStatus } from '../../accountingModule/interfaces/IFinancialDayCloseService';
import { FinancialDayCloseService } from '../../accountingModule/services/FinancialDayCloseService';
import { FinancialPinError } from '../../accountingModule/services/FinancialPinVerificationService';
import { getAuthUser } from '../../middleware/authority';
import { customError } from '../../hooks/helper';

export class FinancialDayCloseController {
     static async list(request: Request, response: Response) {
          try {
               const actor = getAuthUser(request)!;
               const result = await new FinancialDayCloseService(actor.tenantId).list({
                    branchId: request.query.branchId ? Number(request.query.branchId) : actor.branch || undefined,
                    from: request.query.from as string | undefined,
                    to: request.query.to as string | undefined,
                    status: request.query.status as FinancialDayCloseStatus | undefined,
                    page: Number(request.query.page) || 1,
                    count: Number(request.query.count) || 25,
               });
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error: any) { return FinancialDayCloseController.handle(error, response); }
     }

     static async detail(request: Request, response: Response) {
          try {
               const actor = getAuthUser(request)!;
               const result = await new FinancialDayCloseService(actor.tenantId).detail(actor, Number(request.params.id));
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error: any) { return FinancialDayCloseController.handle(error, response); }
     }

     static async submit(request: Request, response: Response) {
          try {
               const actor = getAuthUser(request)!;
               const result = await new FinancialDayCloseService(actor.tenantId).submit(actor, Number(request.body?.branchId ?? actor.branch), String(request.params.financialDate), FinancialDayCloseController.input(request));
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error: any) { return FinancialDayCloseController.handle(error, response); }
     }

     static async managerDecision(request: Request, response: Response) {
          try {
               const actor = getAuthUser(request)!;
               const result = await new FinancialDayCloseService(actor.tenantId).managerDecision(actor, Number(request.params.id), {
                    ...FinancialDayCloseController.input(request),
                    decision: request.body?.decision,
                    reason: request.body?.reason,
               });
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error: any) { return FinancialDayCloseController.handle(error, response); }
     }

     static async finalize(request: Request, response: Response) {
          try {
               const actor = getAuthUser(request)!;
               const result = await new FinancialDayCloseService(actor.tenantId).finalize(actor, Number(request.params.id), FinancialDayCloseController.input(request));
               return response.json({ status: 'success', statusCode: 200, result });
          } catch (error: any) { return FinancialDayCloseController.handle(error, response); }
     }

     private static input(request: Request) {
          return {
               pin: String(request.body?.pin || ''),
               expectedVersion: request.body?.expectedVersion === undefined ? undefined : Number(request.body.expectedVersion),
               notes: request.body?.notes,
               timezone: request.body?.timezone,
               requestContext: {
                    ipAddress: request.ip || null,
                    userAgent: request.get('user-agent') || null,
                    requestId: request.get('x-request-id') || null,
               },
          };
     }

     private static handle(error: any, response: Response) {
          if (error instanceof AccountingError) return response.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, code: error.code, message: error.message });
          if (error instanceof FinancialPinError) {
               const statusCode = error.code === 'PIN_RATE_LIMITED' ? 429 : error.code === 'INVALID_PIN' ? 401 : 500;
               return response.status(statusCode).json({ status: 'error', statusCode, code: error.code, message: error.message });
          }
          return customError(error?.message || 'Financial day close request failed', 500, response);
     }
}
