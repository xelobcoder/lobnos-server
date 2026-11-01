import { NextFunction, Request, Response } from 'express';
import KnexConnection from '../database/KnexConnections';
import { getAuthUser, AuthUser } from './authority';
import { normalizeRole, roleAllowed } from './roles';

export function hasTestPanelPermission(role: unknown, permissions: unknown): boolean {
    if (roleAllowed(role, ['admin'])) return true;
    if (!roleAllowed(role, ['scientist', 'labscientist', 'head_of_laboratory', 'manager'])) return false;
    if (typeof permissions === 'string' && !permissions.trim()) return false;
    const parsed: unknown = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    if (!parsed || typeof parsed !== 'object' || !('testPanels' in parsed)) return false;
    const panel = parsed.testPanels;
    return !!panel && typeof panel === 'object' && 'manage' in panel && panel.manage === true;
}

export async function canManageTestPanels(actor: AuthUser): Promise<boolean> {
    if (roleAllowed(actor.role, ['admin'])) return true;
    if (!actor.branch) return false;
    const db = await KnexConnection(actor.tenantId);
    const staff = await db('roles').select('role', 'permissions', 'branch').where({ employeeid: actor.employeeid }).first();
    return !!staff && normalizeRole(staff.role) === normalizeRole(actor.role) && Number(staff.branch) === Number(actor.branch)
        && hasTestPanelPermission(staff.role, staff.permissions);
}

export async function requireTestPanelManagement(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required', statusCode: 401 });
    if (Number(req.query.tenantId) !== actor.tenantId) {
        return res.status(403).json({ status: 'error', message: 'Authenticated facility context required', statusCode: 403 });
    }
    try {
        if (!await canManageTestPanels(actor)) {
            return res.status(403).json({ status: 'error', message: 'Test-panel management permission is required', statusCode: 403 });
        }
        // Legacy panel handlers record the editor supplied in the body.
        if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) req.body.employeeid = actor.employeeid;
        return next();
    } catch (error) {
        console.error('Unable to verify test-panel management permission:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to verify test-panel permissions', statusCode: 500 });
    }
}
