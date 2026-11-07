import { afterEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { accountingSqlDatabase } from '../testSupport/accountingSqlDatabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('./authority', () => ({ getAuthUser: (req: Request & { authUser?: unknown }) => req.authUser || null }));
import KnexConnection from '../database/KnexConnections';
import { AuthUser } from './authority';
import { canDelegateTestPanelAccess, canManageTestPanels, canViewTestPanels, hasTestPanelPermission, hasTestPanelViewPermission, requireSuperAdminTestPanelDeletion, requireTestPanelDelegation, requireTestPanelManagement, requireTestPanelView } from './testPanelAuthority';
import { getTestPanelStaffAccess, updateTestPanelStaffAccess } from '../controllers/testpanel/testPanelStaffAccess';
import RolesAuditRepository from '../models/settings/users/RolesAuditRepository';

const actor: AuthUser = { employeeid: 7, role: 'scientist', branch: 1, tenantId: 2, email: 'fixture@example.test' };
const databases: ReturnType<typeof accountingSqlDatabase>['db'][] = [];
afterEach(async () => { vi.restoreAllMocks(); while (databases.length) await databases.pop()!.destroy(); });

async function setup() {
    const { db } = accountingSqlDatabase();
    databases.push(db);
    await db.schema.createTable('roles', table => {
        table.integer('employeeid');
        table.string('username');
        table.string('role');
        table.integer('branch');
        table.text('permissions');
    });
    await db.schema.createTable('staff_role_access', table => {
        table.string('id');
        table.integer('employeeid');
        table.string('role');
        table.integer('branchid');
    });
    await db('roles').insert({ employeeid: 7, username: 'Current Scientist', role: 'scientist', branch: 1, permissions: JSON.stringify({ testPanels: { manage: true } }) });
    vi.mocked(KnexConnection).mockResolvedValue(db);
    return db;
}

describe('delegated test-panel management', () => {
    it('uses a strict, explicit grant, not broad settings or administration flags', () => {
        expect(hasTestPanelPermission('scientist', { administration: { update: true }, pageAccess: { settings: true } })).toBe(false);
        expect(hasTestPanelPermission('scientist', '')).toBe(false);
        for (const value of [false, 1, 'true', null, undefined]) {
            expect(hasTestPanelPermission('scientist', { testPanels: { manage: value } })).toBe(false);
        }
        for (const role of ['scientist', 'head_of_laboratory', 'manager']) {
            expect(hasTestPanelPermission(role, { testPanels: { manage: true } })).toBe(true);
        }
        for (const role of ['sonographer', 'cashier', 'patient', 'clinician', 'storekeeper']) {
            expect(hasTestPanelPermission(role, { testPanels: { manage: true } })).toBe(false);
        }
        expect(hasTestPanelPermission('admin', null)).toBe(true);
        expect(hasTestPanelPermission('super_admin', null)).toBe(true);
    });

    it('separates catalog visibility from management while management implies visibility', () => {
        expect(hasTestPanelViewPermission('scientist', { testPanels: { view: true, manage: false } })).toBe(true);
        expect(hasTestPanelViewPermission('scientist', { testPanels: { view: false, manage: true } })).toBe(true);
        expect(hasTestPanelViewPermission('scientist', { testPanels: { view: false, manage: false } })).toBe(false);
        expect(hasTestPanelPermission('scientist', { testPanels: { view: true, manage: false } })).toBe(false);
        expect(hasTestPanelViewPermission('sonographer', { testPanels: { view: true } })).toBe(false);
    });

    it('honors live revocation, current role and branch rather than a cached client flag', async () => {
        const db = await setup();
        expect(await canManageTestPanels(actor)).toBe(true);
        expect(await canViewTestPanels(actor)).toBe(true);
        expect(await canManageTestPanels({ ...actor, branch: null })).toBe(false);
        await db('roles').update({ permissions: '{"testPanels":{"manage":false}}' });
        expect(await canManageTestPanels(actor)).toBe(false);
        expect(await canViewTestPanels(actor)).toBe(false);
        await db('roles').update({ permissions: '{"testPanels":{"view":true,"manage":false}}' });
        expect(await canViewTestPanels(actor)).toBe(true);
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').update({ permissions: '{"testPanels":{"manage":true}}', branch: 9 });
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').update({ branch: 1, role: 'sonographer' });
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').delete();
        expect(await canManageTestPanels(actor)).toBe(false);
    });

    it('protects panel reads with the explicit view grant', async () => {
        const db = await setup();
        await db('roles').update({ permissions: '{"testPanels":{"view":true,"manage":false}}' });
        const status = vi.fn().mockReturnThis(), json = vi.fn().mockReturnThis(), next = vi.fn();
        const res = { status, json } as unknown as Response;
        const req = { authUser: actor, query: { tenantId: '2' } } as unknown as Request;
        await requireTestPanelView(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        next.mockClear();
        await db('roles').update({ permissions: '{}' });
        await requireTestPanelView(req, res, next);
        expect(status).toHaveBeenLastCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows test-panel deletion only to a currently assigned super-admin', async () => {
        const db = await setup();
        const status = vi.fn().mockReturnThis(), json = vi.fn().mockReturnThis(), next = vi.fn();
        const res = { status, json } as unknown as Response;
        const req = { authUser: { ...actor, role: 'super-admin' }, query: { tenantId: '2' } } as unknown as Request;
        await requireSuperAdminTestPanelDeletion(req, res, next);
        expect(status).toHaveBeenLastCalledWith(403);
        expect(next).not.toHaveBeenCalled();
        await db('roles').update({ role: 'Super Admin' });
        await requireSuperAdminTestPanelDeletion(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        req.query.tenantId = '3';
        await requireSuperAdminTestPanelDeletion(req, res, next);
        expect(status).toHaveBeenLastCalledWith(403);
    });

    it('lets current managers, administrators and super-admins delegate access but not scientists', async () => {
        const db = await setup();
        await db('roles').update({ role: 'manager' });
        const manager = { ...actor, role: 'manager' };
        expect(await canDelegateTestPanelAccess(manager)).toBe(true);
        expect(await canDelegateTestPanelAccess({ ...manager, branch: null })).toBe(false);
        await db('roles').update({ role: 'scientist' });
        expect(await canDelegateTestPanelAccess(actor)).toBe(false);
        await db('roles').update({ role: 'admin', branch: null });
        expect(await canDelegateTestPanelAccess({ ...actor, role: 'admin', branch: null })).toBe(true);
        await db('roles').update({ role: 'super_admin' });
        expect((await db('roles').first()).role).toBe('super_admin');
        expect(await canDelegateTestPanelAccess({ ...actor, role: 'super-admin' })).toBe(true);

        const status = vi.fn().mockReturnThis(), json = vi.fn().mockReturnThis(), next = vi.fn();
        const res = { status, json } as unknown as Response;
        await requireTestPanelDelegation(
            { authUser: { ...actor, role: 'super-admin' }, query: { tenantId: '2' } } as unknown as Request,
            res,
            next
        );
        expect(next).toHaveBeenCalledOnce();
    });

    it('lists only same-branch scientists and saves per-person view/manage grants without overwriting other permissions', async () => {
        const db = await setup();
        await db('roles').where({ employeeid: 7 }).update({ role: 'manager', username: 'Manager' });
        await db('roles').insert([
            { employeeid: 8, username: 'Scientist A', role: 'sonographer', branch: 1, permissions: JSON.stringify({ billing: { read: true }, testPanels: { view: false, manage: false } }) },
            { employeeid: 9, username: 'Scientist B', role: 'scientist', branch: 2, permissions: '{}' },
            { employeeid: 10, username: 'Cashier', role: 'cashier', branch: 1, permissions: '{}' },
        ]);
        await db('staff_role_access').insert([
            { id: 'scientist-a', employeeid: 8, role: 'scientist', branchid: 1 },
            { id: 'sonographer-a', employeeid: 8, role: 'sonographer', branchid: 1 },
        ]);
        vi.mocked(KnexConnection).mockResolvedValue(db);
        const manager = { ...actor, role: 'manager' };
        const audit = vi.spyOn(RolesAuditRepository, 'insertAudit').mockResolvedValue();
        const json = vi.fn();
        await getTestPanelStaffAccess({ authUser: manager } as unknown as Request, { json } as unknown as Response);
        expect(json).toHaveBeenCalledWith({
            status: 'success',
            statusCode: 200,
            result: [{ employeeid: 8, username: 'Scientist A', role: 'scientist', branch: 1, view: false, manage: false }],
        });

        const updateJson = vi.fn(), status = vi.fn().mockReturnThis();
        const updateResponse = { json: updateJson, status, send: vi.fn().mockReturnThis() } as unknown as Response;
        await updateTestPanelStaffAccess(
            { authUser: manager, body: { employeeid: 8, view: true, manage: true } } as unknown as Request,
            updateResponse
        );
        expect(updateJson).toHaveBeenCalledWith({ status: 'success', statusCode: 200, message: 'Test-panel access updated' });
        expect(JSON.parse((await db('roles').where({ employeeid: 8 }).first()).permissions)).toEqual({
            billing: { read: true },
            testPanels: { view: true, manage: true },
        });

        await updateTestPanelStaffAccess(
            { authUser: manager, body: { employeeid: 8, view: false, manage: false } } as unknown as Request,
            updateResponse
        );
        expect(JSON.parse((await db('roles').where({ employeeid: 8 }).first()).permissions).testPanels).toEqual({ view: false, manage: false });
        expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
            tenantId: 2,
            action: 'UPDATE',
            employeeid: 8,
            actorEmployeeid: 7,
            oldData: expect.objectContaining({ permissions: expect.stringContaining('"view":true') }),
            newData: expect.objectContaining({ permissions: expect.stringContaining('"view":false') }),
            trx: expect.anything(),
        }));

        status.mockClear();
        await updateTestPanelStaffAccess(
            { authUser: manager, body: { employeeid: 9, view: true, manage: true } } as unknown as Request,
            updateResponse
        );
        expect(status).toHaveBeenLastCalledWith(403);
    });

    it('rejects missing sessions, tenant mismatch and ungranted direct API requests', async () => {
        const db = await setup();
        const status = vi.fn().mockReturnThis(), json = vi.fn().mockReturnThis(), next = vi.fn();
        const res = { status, json } as unknown as Response;
        const req = { authUser: actor, query: { tenantId: '2' }, body: { employeeid: 999 } } as unknown as Request;
        await requireTestPanelManagement(req, res, next);
        expect(next).toHaveBeenCalledOnce();
        expect(req.body.employeeid).toBe(7);
        next.mockClear();
        req.query.tenantId = '3';
        await requireTestPanelManagement(req, res, next);
        expect(status).toHaveBeenLastCalledWith(403);
        req.query.tenantId = '2';
        await db('roles').update({ permissions: '{}' });
        await requireTestPanelManagement(req, res, next);
        expect(status).toHaveBeenLastCalledWith(403);
        await requireTestPanelManagement({ query: {} } as Request, res, next);
        expect(status).toHaveBeenLastCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    it('reports permission-storage failures instead of granting access', async () => {
        const db = await setup();
        await db('roles').update({ permissions: 'not-json' });
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        const status = vi.fn().mockReturnThis(), json = vi.fn(), next = vi.fn();
        await requireTestPanelManagement({ authUser: actor, query: { tenantId: '2' } } as unknown as Request, { status, json } as unknown as Response, next);
        expect(status).toHaveBeenCalledWith(500);
        expect(log).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    it('wires every panel mutation and mutating import alias through authority', () => {
        const panelRoutes = readFileSync(resolve('src/controllers/testpanel/routes.ts'), 'utf8').split('\n');
        const writes = panelRoutes.filter(line => /router\.(post|put|delete|patch)\(/.test(line));
        expect(writes.length).toBeGreaterThan(15);
        for (const line of writes) {
            if (/router\.delete\("\/api\/v1\/testpanel\/list"/.test(line)) {
                expect(line).toContain('requireSuperAdminTestPanelDeletion');
            } else if (/\/api\/v1\/testpanel\/staff-access/.test(line)) {
                expect(line).toContain('requireTestPanelDelegation');
            } else {
                expect(line).toMatch(/requireTestPanelManagement|requireOwnerRole/);
            }
        }
        expect(panelRoutes.find(line => /router\.get\('\/api\/v1\/testpanel\/staff-access'/.test(line))).toContain('requireTestPanelDelegation');
        for (const line of panelRoutes.filter(line => /router\.get.*list\/import/.test(line))) {
            expect(line).toContain('requireTestPanelManagement');
        }
        expect(panelRoutes.find(line => /router\.get\("\/api\/v1\/testpanel\/list"/.test(line))).toContain('requireTestPanelView');
        expect(panelRoutes.find(line => /router\.get\("\/api\/v1\/testpanel\/management\/list"/.test(line))).toContain('requireTestPanelView');
        expect(panelRoutes.find(line => /router\.get\("\/api\/v1\/testpanel\/list\/bulk"/.test(line))).not.toContain('requireTestPanelView');
        const operations = readFileSync(resolve('src/controllers/operations/route.ts'), 'utf8').split('\n');
        for (const line of operations.filter(line => /router\.(post|put|delete|patch).*\/(multi\/|test\/fields\/category)/.test(line))) {
            expect(line).toContain('requireTestPanelManagement');
        }
        expect(readFileSync(resolve('src/controllers/result/route.ts'), 'utf8')).toMatch(/router\.put\("\/api\/v1\/testpanel\/list\/customtestrule", requireTestPanelManagement/);
        const permissionRoutes = readFileSync(resolve('src/controllers/logins/route.ts'), 'utf8').split('\n');
        for (const line of permissionRoutes.filter(line => /router\.(get|put).*\/user\/permissions/.test(line))) {
            expect(line).toContain('requireOwnerRole');
        }
    });
});
