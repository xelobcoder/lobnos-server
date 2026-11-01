import { afterEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';
import { accountingSqlDatabase } from '../testSupport/accountingSqlDatabase';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('./authority', () => ({ getAuthUser: (req: Request & { authUser?: unknown }) => req.authUser || null }));
import KnexConnection from '../database/KnexConnections';
import { AuthUser } from './authority';
import { canManageTestPanels, hasTestPanelPermission, requireTestPanelManagement } from './testPanelAuthority';

const actor: AuthUser = { employeeid: 7, role: 'scientist', branch: 1, tenantId: 2, email: 'fixture@example.test' };
const databases: ReturnType<typeof accountingSqlDatabase>['db'][] = [];
afterEach(async () => { vi.restoreAllMocks(); while (databases.length) await databases.pop()!.destroy(); });

async function setup() {
    const { db } = accountingSqlDatabase();
    databases.push(db);
    await db.schema.createTable('roles', table => {
        table.integer('employeeid');
        table.string('role');
        table.integer('branch');
        table.text('permissions');
    });
    await db('roles').insert({ employeeid: 7, role: 'scientist', branch: 1, permissions: JSON.stringify({ testPanels: { manage: true } }) });
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

    it('honors live revocation, current role and branch rather than a cached client flag', async () => {
        const db = await setup();
        expect(await canManageTestPanels(actor)).toBe(true);
        expect(await canManageTestPanels({ ...actor, branch: null })).toBe(false);
        await db('roles').update({ permissions: '{"testPanels":{"manage":false}}' });
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').update({ permissions: '{"testPanels":{"manage":true}}', branch: 9 });
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').update({ branch: 1, role: 'sonographer' });
        expect(await canManageTestPanels(actor)).toBe(false);
        await db('roles').delete();
        expect(await canManageTestPanels(actor)).toBe(false);
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
        for (const line of writes) expect(line).toMatch(/requireTestPanelManagement|requireOwnerRole/);
        for (const line of panelRoutes.filter(line => /router\.get.*list\/import/.test(line))) {
            expect(line).toContain('requireTestPanelManagement');
        }
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
