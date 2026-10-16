import { NextFunction, Request, Response } from 'express';
import { AuthorityService, ACCOUNTING_ROLES, OWNER_ONLY_ROLES } from '../accountingModule/services/AuthorityService';
import { AuthorityPermission } from '../accountingModule/interfaces/IAuthorityService';
import { roleAllowed } from './roles';

export interface AuthUser {
     employeeid: number;
     email: string;
     role: string;
     branch: number | null;
     tenantId: number;
}

export function getAuthUser(request: Request): AuthUser | null {
     return (request as any).authUser || null;
}

function deny(response: Response, message: string, statusCode = 403) {
     return response.status(statusCode).json({ status: 'error', statusCode, message });
}

/** Restricts a route to the roles allowed to see or touch the books. */
export const requireAccountingRole = (request: Request, response: Response, next: NextFunction) => {
     const user = getAuthUser(request);
     if (!user) return deny(response, 'Authentication required', 401);

     if (!roleAllowed(user.role, ACCOUNTING_ROLES)) {
          return deny(response, 'Only administrators and accountants may access the accounting module');
     }

     return next();
};

/**
 * Restricts a route to the facility owner. Used for anything that hands out authority, because a
 * role that could grant itself a permission would make every other check meaningless.
 */
export const requireOwnerRole = (request: Request, response: Response, next: NextFunction) => {
     const user = getAuthUser(request);
     if (!user) return deny(response, 'Authentication required', 401);

     if (!roleAllowed(user.role, OWNER_ONLY_ROLES)) {
          return deny(response, 'Only an administrator may delegate or revoke authority');
     }

     return next();
};

/**
 * Checks a delegated authority, resolving the amount from the request when the permission is
 * amount-bound. The employee is taken from the session, never from the request body, so a caller
 * cannot approve as somebody else.
 */
export const requireAuthority = (
     permission: AuthorityPermission,
     amountFrom?: (request: Request) => number | null | undefined
) => {
     return async (request: Request, response: Response, next: NextFunction) => {
          const user = getAuthUser(request);
          if (!user) return deny(response, 'Authentication required', 401);

          try {
               const amount = amountFrom ? amountFrom(request) : null;
               const decision = await new AuthorityService(user.tenantId).can(user.employeeid, permission, amount, user.branch);

               if (!decision.allowed) return deny(response, decision.reason);

               (request as any).authorityDecision = decision;
               return next();
          } catch (error: any) {
               return deny(response, error?.message || 'Unable to verify your authority', 500);
          }
     };
};
