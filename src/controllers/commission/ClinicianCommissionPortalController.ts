import { Request, Response } from "express";
import {
     ClinicianCommissionPortalRepository,
     ClinicianCommissionScope,
     resolveSeriesPeriod,
} from "../../models/commissions/ClinicianCommissionPortalRepository";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = (value: string) => DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => `${today().slice(0, 8)}01`;

type ParsedRequest =
     | { error: { status: number; message: string } }
     | { scope: ClinicianCommissionScope; page: number; count: number; period?: string };

/**
 * Validates the portal request. Clinician-role sessions can only read their own commission;
 * patient sessions are refused; staff keep the same access as the facility commission screens.
 */
export function parseClinicianCommissionRequest(params: any, query: any, authUser: any): ParsedRequest {
     const clinicianId = Number(params?.clinicianId);
     if (!Number.isInteger(clinicianId) || clinicianId <= 0) {
          return { error: { status: 400, message: 'A valid clinicianId is required' } };
     }

     const role = String(authUser?.role || '').toLowerCase();
     if (role === 'clinician') {
          const ownId = Number(authUser?.clinicianid ?? authUser?.employeeid);
          if (ownId !== clinicianId) return { error: { status: 403, message: 'You can only view your own commission' } };
     } else if (!role || role === 'patient') {
          return { error: { status: 403, message: 'You are not authorized to view clinician commission' } };
     }

     const from = String(query?.startDate || query?.from || monthStart());
     const to = String(query?.endDate || query?.to || today());
     if (!isValidDate(from) || !isValidDate(to)) {
          return { error: { status: 400, message: 'startDate and endDate must be YYYY-MM-DD' } };
     }
     if (from > to) return { error: { status: 400, message: 'startDate must be on or before endDate' } };

     const page = Math.max(1, parseInt(query?.page, 10) || 1);
     const count = Math.min(200, Math.max(1, parseInt(query?.count, 10) || 20));
     return { scope: { clinicianId, from, to }, page, count, period: query?.period ? String(query.period) : undefined };
}

export async function getClinicianCommissionPortalHandler(req: Request, res: Response) {
     try {
          const authUser = (req as any).authUser;
          const parsed = parseClinicianCommissionRequest(req.params, req.query, authUser);
          if ('error' in parsed) {
               return res.status(parsed.error.status).json({ status: 'error', statusCode: parsed.error.status, message: parsed.error.message });
          }
          const tenantId = Number(authUser?.tenantId ?? req.query.tenantId);
          const repo = new ClinicianCommissionPortalRepository(tenantId);
          const period = resolveSeriesPeriod(parsed.scope.from, parsed.scope.to, parsed.period);
          const [totals, series, transactions] = await Promise.all([
               repo.getTotals(parsed.scope),
               repo.getSeries(parsed.scope, period),
               repo.getTransactions(parsed.scope, parsed.page, parsed.count),
          ]);
          return res.status(200).json({
               status: 'success',
               statusCode: 200,
               data: {
                    range: { from: parsed.scope.from, to: parsed.scope.to, period },
                    totals,
                    series,
                    transactions,
                    page: parsed.page,
                    count: parsed.count,
                    total: totals.transactions,
                    totalPages: Math.max(1, Math.ceil(totals.transactions / parsed.count)),
               },
          });
     } catch (error: any) {
          console.error('Clinician commission portal error:', error);
          return res.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to load commission information' });
     }
}
