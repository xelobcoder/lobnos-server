import type { RequestHandler } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';

const financePrefixes = ['/periods', '/analytics', '/tax-configurations', '/tax-reliefs', '/salary-grades',
     '/allowances', '/bonuses', '/deduction-definitions', '/other-deductions', '/deductions/other',
     '/history', '/reversals', '/reversal-errors'];
const lifecycleActors: Record<string, string> = { process: 'calculated_by', approve: 'approved_by', lock: 'locked_by',
     'mark-paid': 'paid_by', 'revert-status': 'reverted_by', reverse: 'reversed_by', 'recalculate-period': 'recalculated_by' };

/** Financial authority is separate from employee attendance, leave and self-history. */
export const payrollAuthority: RequestHandler = (req, res, next) => {
     const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
     const financial = financePrefixes.some(prefix => path === prefix || path.startsWith(prefix + '/'));
     const employeeReport = /^\/employee\/([^/]+)\/(history|ytd)$/.exec(path);
     if (!financial && !employeeReport) return next();
     const actor = getAuthUser(req);
     const deny = (message: string, code = 403) => res.status(code).json({ status: 'error', statusCode: code, message });
     if (!actor) { deny('Authentication required', 401); return; }
     if (Number(req.query.tenantId) !== Number(actor.tenantId)) { deny('Authenticated facility context required'); return; }
     const finance = roleAllowed(actor.role, ['admin', 'accountant']);
     if (financial && !finance) { deny('Only administrators and accountants may manage payroll finances'); return; }
     if (employeeReport) {
          let subject: string;
          try { subject = decodeURIComponent(employeeReport[1]); } catch { deny('Invalid employee reference', 400); return; }
          if (subject === 'all' && finance && employeeReport[2] === 'history') return next();
          if (!/^\d+$/.test(subject) || !Number.isSafeInteger(Number(subject)) || Number(subject) <= 0) { deny('Invalid employee reference', 400); return; }
          if (!finance && Number(subject) !== Number(actor.employeeid)) { deny('Only your own payroll history is available'); return; }
     }
     const action = /^\/periods\/[^/]+\/([^/]+)$/.exec(path)?.[1];
     if (req.method === 'POST' && action && (lifecycleActors[action] || action === 'recalculate')) {
          if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body))) { deny('A payroll action object is required', 400); return; }
          req.body = req.body || {};
          for (const field of Object.values(lifecycleActors)) if (field in req.body) req.body[field] = actor.employeeid;
          if (lifecycleActors[action]) req.body[lifecycleActors[action]] = actor.employeeid;
          // Here employeeid is the expense/payment actor; on recalculate it is the salary subject.
          if (action === 'mark-paid') req.body.employeeid = actor.employeeid;
     }
     next();
};
