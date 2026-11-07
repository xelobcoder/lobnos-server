import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { customError } from '../../hooks/helper';
import { getAuthUser } from '../../middleware/authority';
import { normalizeRole } from '../../middleware/roles';
import RolesAuditRepository from '../../models/settings/users/RolesAuditRepository';

const SCIENTIST_ROLES = new Set(['scientist', 'labscientist', 'headlaboratory']);

function isScientistRole(role: unknown): boolean {
    return SCIENTIST_ROLES.has(normalizeRole(role));
}

async function getStaffAssignments(db: any, staff: Array<{ employeeid: number; role: string; branch: number | null }>) {
    if (staff.length === 0) return new Map<number, Array<{ role: string; branch: number | null }>>();
    const assignments = await db('staff_role_access')
        .select('employeeid', 'role', 'branchid')
        .whereIn('employeeid', staff.map(employee => employee.employeeid));
    const byEmployee = new Map<number, Array<{ role: string; branch: number | null }>>();
    for (const assignment of assignments) {
        const current = byEmployee.get(Number(assignment.employeeid)) || [];
        current.push({ role: assignment.role, branch: assignment.branchid });
        byEmployee.set(Number(assignment.employeeid), current);
    }
    return byEmployee;
}

function readTestPanelPermissions(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string') {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }
    if (!value.trim()) return {};
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Stored staff permissions must be an object');
    }
    return parsed as Record<string, unknown>;
}

export async function getTestPanelStaffAccess(req: Request, res: Response) {
    try {
        const actor = getAuthUser(req);
        if (!actor) return res.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required' });
        const db = await KnexConnection(actor.tenantId);
        const staff = await db('roles')
            .select('employeeid', 'username', 'role', 'branch', 'permissions')
            .orderBy('username');
        const staffAssignments = await getStaffAssignments(db, staff);
        const canManageAllBranches = normalizeRole(actor.role) === 'admin' || normalizeRole(actor.role) === 'superadmin';
        const result = staff
            .flatMap((employee: { employeeid: number; username: string; role: string; branch: number | null; permissions: unknown }) => {
                const hasExplicitAssignments = staffAssignments.has(Number(employee.employeeid));
                const eligibleAssignments = hasExplicitAssignments
                    ? staffAssignments.get(Number(employee.employeeid))!.filter(assignment => isScientistRole(assignment.role))
                    : isScientistRole(employee.role) ? [{ role: employee.role, branch: employee.branch }] : [];
                const visibleAssignments = eligibleAssignments.filter(assignment =>
                    canManageAllBranches || (actor.branch != null && Number(assignment.branch) === Number(actor.branch)));
                if (visibleAssignments.length === 0) return [];
                const panel = readTestPanelPermissions(employee.permissions).testPanels;
                const grants = panel && typeof panel === 'object' && !Array.isArray(panel)
                    ? panel as Record<string, unknown>
                    : {};
                const manage = grants.manage === true;
                return [{
                    employeeid: employee.employeeid,
                    username: employee.username,
                    role: [...new Set(visibleAssignments.map(assignment => assignment.role))].join(', '),
                    branch: visibleAssignments[0].branch,
                    view: grants.view === true || manage,
                    manage,
                }];
            });
        return res.json({ status: 'success', statusCode: 200, result });
    } catch (error) {
        console.error('Unable to load scientist test-panel access:', error);
        return res.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to load scientist test-panel access' });
    }
}

export async function updateTestPanelStaffAccess(req: Request<{}, {}, { employeeid?: number | string; view?: boolean; manage?: boolean }>, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', statusCode: 401, message: 'Authentication required' });
    const employeeid = Number(req.body?.employeeid);
    const view = req.body?.view;
    const manage = req.body?.manage;
    if (!Number.isSafeInteger(employeeid) || employeeid <= 0) {
        return customError('A valid employee ID is required', 400, res);
    }
    if (typeof view !== 'boolean' || typeof manage !== 'boolean') {
        return customError('View and manage permissions must be booleans', 400, res);
    }
    if (manage && !view) {
        return customError('Managing test panels requires view access', 400, res);
    }

    try {
        const db = await KnexConnection(actor.tenantId);
        const updated = await db.transaction(async trx => {
            const target = await trx('roles').select('employeeid', 'username', 'role', 'branch', 'permissions')
                .where({ employeeid }).forUpdate().first();
            if (!target) return 'not-found';
            const assignments = await trx('staff_role_access').select('role', 'branchid').where({ employeeid });
            const scientistAssignments = assignments.length
                ? assignments.filter((assignment: { role: unknown }) => isScientistRole(assignment.role))
                : isScientistRole(target.role) ? [{ role: target.role, branchid: target.branch }] : [];
            if (scientistAssignments.length === 0) return 'not-found';
            const canManageAllBranches = normalizeRole(actor.role) === 'admin' || normalizeRole(actor.role) === 'superadmin';
            if (!canManageAllBranches && (actor.branch == null || !scientistAssignments.some(
                (assignment: { branchid: unknown }) => Number(assignment.branchid) === Number(actor.branch)
            ))) {
                return 'forbidden';
            }
            const permissions = readTestPanelPermissions(target.permissions);
            permissions.testPanels = { view, manage };
            await trx('roles').where({ employeeid }).update({ permissions: JSON.stringify(permissions) });
            const updatedTarget = await trx('roles').select(
                'employeeid', 'username', 'role', 'branch', 'permissions'
            ).where({ employeeid }).first();
            await RolesAuditRepository.insertAudit({
                tenantId: actor.tenantId,
                action: 'UPDATE',
                employeeid,
                actorEmployeeid: actor.employeeid,
                oldData: RolesAuditRepository.sanitizeRoleRow(target),
                newData: RolesAuditRepository.sanitizeRoleRow(updatedTarget),
                trx,
            });
            return 'updated';
        });
        if (updated === 'not-found') return customError('Scientist not found', 404, res);
        if (updated === 'forbidden') return customError('You can only delegate access to scientists in your branch', 403, res);
        return res.json({ status: 'success', statusCode: 200, message: 'Test-panel access updated' });
    } catch (error) {
        console.error('Unable to update scientist test-panel access:', error);
        return res.status(500).json({ status: 'error', statusCode: 500, message: 'Unable to update scientist test-panel access' });
    }
}
