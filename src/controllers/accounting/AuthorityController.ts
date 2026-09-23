import { Request, Response } from 'express';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { AuthorityPermission } from '../../accountingModule/interfaces/IAuthorityService';
import { getAuthUser } from '../../middleware/authority';
import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort, paginate } from '../../accountingModule/utils/pagination';
import { customError } from '../../hooks/helper';

const PERMISSIONS: AuthorityPermission[] = [
     'expense.create',
     'expense.view',
     'expense.edit',
     'expense.submit',
     'expense.approve',
     'expense.reject',
     'expense.pay',
     'expense.cancel',
     'expense.reverse',
     'expense.override_approval',
     'expense.override_sod',
     'expense.view_audit',
     'expense.configure',
     'payment_account.manage',
     'purchase_order.approve',
     'purchase_order.pay',
     'inventory.adjust',
     'accounting.journal.approve',
     'accounting.journal.post',
     'accounting.period.close',
     'accounting.daily_close.submit',
     'accounting.daily_close.manager_approve',
     'accounting.daily_close.finalize',
     'accounting.daily_close.view_audit',
     'accounting.financial_correction.execute',
     'billing.refund.approve',
];

function tenantOf(req: Request): number {
     return getAuthUser(req)?.tenantId || parseInt(req.query.tenantId as string) || 1;
}

function ok(response: Response, result: any, statusCode = 200) {
     return response.status(statusCode).json({ status: 'success', statusCode, result });
}

export class AuthorityController {
     static async permissions(_req: Request, res: Response) {
          return ok(res, PERMISSIONS);
     }

     /** Active staff who can receive a delegation. */
     static async employees(req: Request, res: Response) {
          try {
               const db = await KnexConnection(tenantOf(req));
               const rows = await db('roles')
                    .select('employeeid', 'username', 'role', 'branch', 'firstname', 'lastname')
                    .orderBy('username', 'asc');

               return ok(
                    res,
                    rows.map((row: any) => ({
                         employeeid: Number(row.employeeid),
                         username: row.username,
                         role: row.role,
                         branch: row.branch ?? null,
                         fullname: [row.firstname, row.lastname].filter(Boolean).join(' ') || row.username,
                    }))
               );
          } catch (error: any) {
               return customError(error?.message || 'Unable to load employees', 500, res);
          }
     }

     static async list(req: Request, res: Response) {
          try {
               const service = new AuthorityService(tenantOf(req));
               const rows = await service.list({
                    permission: req.query.permission as AuthorityPermission | undefined,
                    activeOnly: req.query.activeOnly !== 'false',
               });

               const paging = parsePaging(req.query, 25);
               const sort = parseSort(req.query, ['id', 'username', 'permission', 'max_amount', 'granted_at', 'expires_at'], {
                    column: 'id',
                    direction: 'desc',
               });

               return ok(res, paginate(rows, paging, sort));
          } catch (error: any) {
               return customError(error?.message || 'Unable to list delegations', 500, res);
          }
     }

     static async forEmployee(req: Request, res: Response) {
          try {
               const service = new AuthorityService(tenantOf(req));
               return ok(res, await service.listForEmployee(Number(req.params.employeeid)));
          } catch (error: any) {
               return customError(error?.message || 'Unable to list delegations', 500, res);
          }
     }

     /** What the signed-in user may do, so the UI can hide actions it would reject. */
     static async mine(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               if (!user) return customError('Authentication required', 401, res);

               const service = new AuthorityService(user.tenantId);
               const decisions = await Promise.all(
                    PERMISSIONS.map(async (permission) => {
                         const decision = await service.can(user.employeeid, permission);
                         return [permission, decision] as const;
                    })
               );

               return ok(res, {
                    employeeid: user.employeeid,
                    role: user.role,
                    permissions: Object.fromEntries(decisions),
               });
          } catch (error: any) {
               return customError(error?.message || 'Unable to resolve your authority', 500, res);
          }
     }

     static async grant(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               if (!user) return customError('Authentication required', 401, res);

               const { employeeid, permission, minAmount, maxAmount, branchid, expiresAt, notes } = req.body || {};
               if (!employeeid || !permission) return customError('employeeid and permission are required', 400, res);
               if (!PERMISSIONS.includes(permission)) return customError(`Unknown permission ${permission}`, 400, res);

               if (minAmount != null && maxAmount != null && Number(minAmount) > Number(maxAmount)) {
                    return customError('The lower limit cannot exceed the upper limit', 400, res);
               }

               const service = new AuthorityService(user.tenantId);
               const delegation = await service.grant({
                    employeeid: Number(employeeid),
                    permission,
                    minAmount: minAmount == null ? null : Number(minAmount),
                    maxAmount: maxAmount == null ? null : Number(maxAmount),
                    branchid: branchid == null ? null : Number(branchid),
                    expiresAt: expiresAt || null,
                    notes: notes || null,
                    grantedBy: user.employeeid,
               });

               return ok(res, delegation, 201);
          } catch (error: any) {
               return customError(error?.message || 'Unable to grant the delegation', 500, res);
          }
     }

     static async revoke(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               if (!user) return customError('Authentication required', 401, res);

               const service = new AuthorityService(user.tenantId);
               await service.revoke(Number(req.params.id), user.employeeid);
               return ok(res, { revoked: Number(req.params.id) });
          } catch (error: any) {
               return customError(error?.message || 'Unable to revoke the delegation', 500, res);
          }
     }

     static async revise(req: Request, res: Response) {
          try {
               const user = getAuthUser(req);
               if (!user) return customError('Authentication required', 401, res);
               const { minAmount, maxAmount, branchid, expiresAt, notes } = req.body || {};
               const service = new AuthorityService(user.tenantId);
               const delegation = await service.revise(Number(req.params.id), {
                    minAmount: minAmount == null ? null : Number(minAmount),
                    maxAmount: maxAmount == null ? null : Number(maxAmount),
                    branchid: branchid == null ? null : Number(branchid),
                    expiresAt: expiresAt || null,
                    notes: notes || null,
                    grantedBy: user.employeeid,
               });
               return ok(res, delegation);
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : 400;
               return customError(error?.message || 'Unable to revise the delegation', status, res);
          }
     }
}
