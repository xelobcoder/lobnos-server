import express, { NextFunction, Request, Response } from 'express';
import { AuthUser, getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import logger from '../../hooks/logger';
import { OrganizationInvoiceService } from '../../models/organization/invoices/OrganizationInvoiceService';
import { OrganizationInvoiceError } from '../../models/organization/invoices/OrganizationInvoiceCalculations';

/**
 * Organizational credit invoices (accounts receivable owed by contracted organizations).
 * Authentication and tenancy come from the global checkTokenExists/ValidateTenancyAgreement
 * middleware; the acting employee is always taken from the session, never from the request body.
 */

/** Invoices carry patient names and amounts owed, so viewing is limited to billing/finance staff. */
export const INVOICE_READ_ROLES = ['admin', 'manager', 'accountant', 'cashier', 'front desk', 'frontdesk', 'customer service representative', 'billing'];
/** Creating an invoice or recording money received. */
export const INVOICE_WRITE_ROLES = ['admin', 'manager', 'accountant', 'cashier', 'billing'];
/** Voiding releases services for re-invoicing; restricted to finance owners. */
export const INVOICE_VOID_ROLES = ['admin', 'accountant'];

function requireRoles(allowed: string[], action: string) {
     return (request: Request, response: Response, next: NextFunction) => {
          const user = getAuthUser(request);
          if (!user) return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
          if (!roleAllowed(user.role, allowed)) {
               return response.status(403).json({ status: 'error', statusCode: 403, message: `You do not have permission to ${action}.` });
          }
          return next();
     };
}

type Handler = (service: OrganizationInvoiceService, user: AuthUser, request: Request) => Promise<{ statusCode?: number; message: string; result: unknown }>;

function handle(handler: Handler) {
     return async (request: Request, response: Response) => {
          const user = getAuthUser(request);
          const tenantId = Number(request.query.tenantId);
          if (!user || !Number.isSafeInteger(tenantId) || tenantId <= 0 || Number(user.tenantId) !== tenantId) {
               return response.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required.' });
          }
          try {
               const { statusCode = 200, message, result } = await handler(new OrganizationInvoiceService(tenantId), user, request);
               return response.status(statusCode).json({ status: 'success', statusCode, message, result });
          } catch (error: any) {
               if (error instanceof OrganizationInvoiceError) {
                    return response.status(error.statusCode).json({ status: 'error', statusCode: error.statusCode, message: error.message });
               }
               logger.error('Organization invoice request failed', { path: request.path, tenantId, error: error?.message || String(error) });
               return response.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to process the invoice request. Please try again.' });
          }
     };
}

const router = express.Router();
const BASE = '/api/v1/organization-invoices';
const canRead = requireRoles(INVOICE_READ_ROLES, 'view organization invoices');
const canWrite = requireRoles(INVOICE_WRITE_ROLES, 'create invoices or record payments');
const canVoid = requireRoles(INVOICE_VOID_ROLES, 'void invoices');

router.get(`${BASE}/eligible-bills`, canRead, handle(async (service, _user, request) => ({
     message: 'Uninvoiced organizational credit bills',
     result: await service.getEligibleBills(request.query.organizationId),
})));

router.get(`${BASE}/organizations`, canRead, handle(async service => ({
     message: 'Organizations with receivables',
     result: await service.getOrganizationsSummary(),
})));

router.get(`${BASE}/payment-modes`, canRead, handle(async service => ({
     message: 'Payment modes',
     result: await service.getPaymentModes(),
})));

router.get(`${BASE}/by-billing/:billingId(\\d+)`, canRead, handle(async (service, _user, request) => ({
     message: 'Invoices for bill',
     result: await service.getInvoicesForBilling(request.params.billingId),
})));

router.get(BASE, canRead, handle(async (service, _user, request) => ({
     message: 'Organization invoices',
     result: await service.listInvoices({
          organizationId: request.query.organizationId,
          status: request.query.status,
          search: request.query.search,
          page: request.query.page,
          count: request.query.count,
     }),
})));

router.post(BASE, canWrite, handle(async (service, user, request) => ({
     statusCode: 201,
     message: 'Invoice generated',
     result: await service.generateInvoice(user, request.body || {}),
})));

router.get(`${BASE}/:invoiceId(\\d+)`, canRead, handle(async (service, _user, request) => ({
     message: 'Invoice',
     result: await service.getInvoice(request.params.invoiceId),
})));

router.post(`${BASE}/:invoiceId(\\d+)/payments`, canWrite, handle(async (service, user, request) => {
     const outcome = await service.recordPayment(user, request.params.invoiceId, request.body || {});
     return {
          statusCode: outcome.duplicate ? 200 : 201,
          message: outcome.duplicate ? 'Payment was already recorded' : 'Payment recorded',
          result: outcome,
     };
}));

router.post(`${BASE}/:invoiceId(\\d+)/void`, canVoid, handle(async (service, user, request) => ({
     message: 'Invoice voided',
     result: await service.voidInvoice(user, request.params.invoiceId, (request.body || {}).reason),
})));

export default router;
