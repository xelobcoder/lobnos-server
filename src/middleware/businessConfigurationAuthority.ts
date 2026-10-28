import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';

/** Server-side policy for legacy configuration routes; body identities are not authority. */
export function requireBusinessConfigurationRole(roles: readonly string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        const actor = getAuthUser(req);
        if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
        if (Number(req.query.tenantId) !== Number(actor.tenantId) || !roleAllowed(actor.role, roles)) {
            return res.status(403).json({ status: false, message: 'You do not have permission for this configuration' });
        }
        if (req.body && typeof req.body === 'object') {
            // Employee ID may be a payroll subject: do not replace it here.
            for (const field of ['createdby', 'updatedby', 'createdBy', 'updatedBy', 'created_by', 'updated_by']) {
                if (field in req.body) req.body[field] = actor.employeeid;
            }
            for (const record of [req.body.newCompensation, ...(Array.isArray(req.body.parameters) ? req.body.parameters : [])]) {
                if (!record || typeof record !== 'object') continue;
                for (const field of ['createdby', 'updatedby', 'createdBy', 'updatedBy', 'created_by', 'updated_by']) {
                    if (field in record) record[field] = actor.employeeid;
                }
            }
        }
        next();
    };
}

export const requireOrganizationFinanceRole = requireBusinessConfigurationRole(['admin', 'manager', 'accountant']);
export const requirePayrollCompensationRole = requireBusinessConfigurationRole(['admin', 'accountant']);
export const requireQcConfigurationRole = requireBusinessConfigurationRole(['admin', 'manager', 'scientist']);
