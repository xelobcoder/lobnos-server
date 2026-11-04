import { NhisOpeningReceivablesService } from '../../accountingModule/services/NhisOpeningReceivablesService';
import { Router, Request, Response } from 'express';
import { getAuthUser, AuthUser } from '../../middleware/authority';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';
import { NhisReceivablesService, NhisReportFilters } from '../../accountingModule/services/NhisReceivablesService';
import logger from '../../hooks/logger';

export const nhisAccountingRouter = Router();

function actor(req: Request): AuthUser {
     const user = getAuthUser(req);
     if (!user) throw new AccountingError('Authentication required', 'AUTHENTICATION_REQUIRED', 401);
     if (req.query.tenantId !== undefined && Number(req.query.tenantId) !== user.tenantId) throw new AccountingError('Tenant does not match the authenticated session', 'TENANT_MISMATCH', 403);
     return user;
}

function filters(req: Request): NhisReportFilters {
     const scalar = (key: string): string | undefined => {
          const value = req.query[key];
          if (value === undefined) return undefined;
          if (typeof value !== 'string') throw new AccountingError(`Invalid ${key}`, 'INVALID_NHIS_FILTER', 400);
          return value;
     };
     return { from: scalar('from'), to: scalar('to'), page: Number(scalar('page')) || 1, count: Number(scalar('count')) || 25 };
}

function endpoint(run: (service: NhisReceivablesService, user: AuthUser, req: Request) => Promise<unknown>, created = false) {
     return async (req: Request, res: Response) => {
          try {
               const user = actor(req);
               const result = await run(new NhisReceivablesService(user.tenantId), user, req);
               return res.status(created ? 201 : 200).json({ status: 'success', statusCode: created ? 201 : 200, result });
          } catch (error) {
               if (error instanceof AccountingError) return res.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, code: error.code, message: error.message });
               logger.error('NHIS accounting request failed', { error: error instanceof Error ? error.message : String(error) });
               return res.status(500).json({ status: 'error', statusCode: 500, message: 'NHIS accounting request failed' });
          }
     };
}

nhisAccountingRouter.get('/api/v1/accounting/nhis/openings', endpoint((_service, user) => new NhisOpeningReceivablesService(user.tenantId).history(user)));
nhisAccountingRouter.post('/api/v1/accounting/nhis/openings/preview', endpoint((_service, user, req) => new NhisOpeningReceivablesService(user.tenantId).preview(user, req.body)));
nhisAccountingRouter.post('/api/v1/accounting/nhis/openings', endpoint((_service, user, req) => new NhisOpeningReceivablesService(user.tenantId).post(user, req.body), true));
nhisAccountingRouter.post('/api/v1/accounting/nhis/openings/:id/reversal', endpoint((_service, user, req) => new NhisOpeningReceivablesService(user.tenantId).reverse(user, Number(req.params.id), req.body), true));
nhisAccountingRouter.get('/api/v1/accounting/nhis/receivables', endpoint((service, user, req) => service.cohort(user, filters(req))));
nhisAccountingRouter.get('/api/v1/accounting/nhis/cash-receipts', endpoint((service, user, req) => service.cashReceipts(user, filters(req))));
nhisAccountingRouter.get('/api/v1/accounting/nhis/events', endpoint((service, user, req) => service.events(user, filters(req))));
nhisAccountingRouter.get('/api/v1/accounting/nhis/events/:id/allocations', endpoint((service, user, req) => {
     const { page, count } = filters(req);
     return service.eventAllocations(user, Number(req.params.id), { page, count });
}));
nhisAccountingRouter.post('/api/v1/accounting/nhis/period-settlements/preview', endpoint((service, user, req) => service.previewPeriod(user, req.body)));
nhisAccountingRouter.post('/api/v1/accounting/nhis/period-settlements', endpoint((service, user, req) => service.settlePeriod(user, req.body), true));
nhisAccountingRouter.post('/api/v1/accounting/nhis/period-settlements/:id/reversal', endpoint((service, user, req) => service.reversePeriod(user, Number(req.params.id), req.body), true));
nhisAccountingRouter.post('/api/v1/accounting/nhis/receipts', endpoint((service, user, req) => service.record(user, 'receipt', req.body), true));
nhisAccountingRouter.post('/api/v1/accounting/nhis/adjustments', endpoint((service, user, req) => {
     const { kind, ...input } = req.body || {};
     if (kind !== 'revenue_adjustment' && kind !== 'write_off') throw new AccountingError('Select revenue_adjustment or write_off explicitly', 'INVALID_NHIS_ADJUSTMENT', 400);
     return service.record(user, kind, input);
}, true));
nhisAccountingRouter.post('/api/v1/accounting/nhis/events/:id/reversal', endpoint((service, user, req) => service.reverse(user, Number(req.params.id), req.body), true));
