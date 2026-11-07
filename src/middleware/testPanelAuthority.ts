import { NextFunction, Request, Response } from 'express';
import KnexConnection from '../database/KnexConnections';
import { getAuthUser, AuthUser } from './authority';
import { isSuperAdminRole, normalizeRole, roleAllowed } from './roles';

function testPanelSettings(permissions: unknown): { view: boolean; manage: boolean } {
    if (typeof permissions === 'string' && !permissions.trim()) return { view: false, manage: false };
    const parsed: unknown = typeof permissions === 'string' ? JSON.parse(permissions) : permissions;
    if (!parsed || typeof parsed !== 'object' || !('testPanels' in parsed)) return { view: false, manage: false };
    const panel = parsed.testPanels;
    if (!panel || typeof panel !== 'object') return { view: false, manage: false };
    return {
        view: 'view' in panel && panel.view === true,
        manage: 'manage' in panel && panel.manage === true,
    };
}

export function hasTestPanelPermission(role: unknown, permissions: unknown): boolean {
    if (roleAllowed(role, ['admin'])) return true;
    if (!roleAllowed(role, ['scientist', 'labscientist', 'head_of_laboratory', 'manager'])) return false;
    return testPanelSettings(permissions).manage;
}

export function hasTestPanelViewPermission(role: unknown, permissions: unknown): boolean {
    if (roleAllowed(role, ['admin'])) return true;
    if (!roleAllowed(role, ['scientist', 'labscientist', 'head_of_laboratory', 'manager'])) return false;
    const panel = testPanelSettings(permissions);
    return panel.view || panel.manage;
}

async function getCurrentStaff(actor: AuthUser) {
    if (!actor.branch) return null;
    const db = await KnexConnection(actor.tenantId);
    const staff = await db('roles').select('role', 'permissions', 'branch').where({ employeeid: actor.employeeid }).first();
    if (!staff || normalizeRole(staff.role) !== normalizeRole(actor.role) || Number(staff.branch) !== Number(actor.branch)) return null;
    return staff;
}

export async function canManageTestPanels(actor: AuthUser): Promise<boolean> {
    if (roleAllowed(actor.role, ['admin'])) return true;
    const staff = await getCurrentStaff(actor);
    return !!staff && hasTestPanelPermission(staff.role, staff.permissions);
}

export async function canViewTestPanels(actor: AuthUser): Promise<boolean> {
    if (roleAllowed(actor.role, ['admin'])) return true;
    const staff = await getCurrentStaff(actor);
    return !!staff && hasTestPanelViewPermission(staff.role, staff.permissions);
}

export async function canDelegateTestPanelAccess(actor: AuthUser): Promise<boolean> {
    const superAdmin = isSuperAdminRole(actor.role);
    if (!superAdmin && !roleAllowed(actor.role, ['admin', 'manager'])) return false;
    const db = await KnexConnection(actor.tenantId);
    const staff = await db('roles').select('role', 'branch').where({ employeeid: actor.employeeid }).first();
    if (!staff || normalizeRole(staff.role) !== normalizeRole(actor.role)) return false;
    if (superAdmin || roleAllowed(actor.role, ['admin'])) return true;
    return !!actor.branch && Number(staff.branch) === Number(actor.branch);
}

function requireFacilityContext(req: Request, res: Response, actor: AuthUser): boolean {
    if (Number(req.query.tenantId) === actor.tenantId) return true;
    res.status(403).json({ status: 'error', message: 'Authenticated facility context required', statusCode: 403 });
    return false;
}

export async function requireTestPanelDelegation(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required', statusCode: 401 });
    if (!requireFacilityContext(req, res, actor)) return;
    try {
        if (!await canDelegateTestPanelAccess(actor)) {
            return res.status(403).json({ status: 'error', message: 'Only administrators and managers may delegate test-panel access', statusCode: 403 });
        }
        return next();
    } catch (error) {
        console.error('Unable to verify test-panel delegation permission:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to verify test-panel delegation permission', statusCode: 500 });
    }
}

export async function requireTestPanelManagement(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required', statusCode: 401 });
    if (!requireFacilityContext(req, res, actor)) return;
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

export async function requireTestPanelView(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required', statusCode: 401 });
    if (!requireFacilityContext(req, res, actor)) return;
    try {
        if (!await canViewTestPanels(actor)) {
            return res.status(403).json({ status: 'error', message: 'Test-panel view permission is required', statusCode: 403 });
        }
        return next();
    } catch (error) {
        console.error('Unable to verify test-panel view permission:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to verify test-panel permissions', statusCode: 500 });
    }
}

export async function requireSuperAdminTestPanelDeletion(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required', statusCode: 401 });
    if (!requireFacilityContext(req, res, actor)) return;
    if (!isSuperAdminRole(actor.role)) {
        return res.status(403).json({ status: 'error', message: 'Only a super-admin can delete test panels', statusCode: 403 });
    }
    try {
        const db = await KnexConnection(actor.tenantId);
        const staff = await db('roles').select('role').where({ employeeid: actor.employeeid }).first();
        if (!staff || !isSuperAdminRole(staff.role)) {
            return res.status(403).json({ status: 'error', message: 'Only a super-admin can delete test panels', statusCode: 403 });
        }
        return next();
    } catch (error) {
        console.error('Unable to verify super-admin test-panel deletion permission:', error);
        return res.status(500).json({ status: 'error', message: 'Unable to verify test-panel deletion permission', statusCode: 500 });
    }
}
