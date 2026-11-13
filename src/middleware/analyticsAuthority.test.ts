import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { roleAllowed } from './roles';

// Execute the real middleware declaration without initializing unrelated login/database services.
function adminGuard() {
    const source = fs.readFileSync(path.resolve('src/middleware/validateTenancy.ts'), 'utf8');
    const parsed = ts.createSourceFile('validateTenancy.ts', source, ts.ScriptTarget.Latest, true);
    const statement = parsed.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(parsed) === 'isAuthorizedRoleAdmin'))!;
    const exports: any = {};
    vm.runInNewContext(ts.transpileModule(statement.getText(parsed), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, {
        exports, roleAllowed, OperationsFailures: {dontHaveAccessPermission: 'Denied'},
        customError: (message: string, code: number, response: any) => response.status(code).json({message})
    });
    return exports.isAuthorizedRoleAdmin;
}

describe('analytics administrator authority', () => {
    it.each(['cashier','scientist','clinician','patient'])('rejects forged administrator IDs for %s', async role => {
        const next = vi.fn(), response: any = {status: vi.fn().mockReturnThis(), json: vi.fn()};
        await adminGuard()({authUser:{employeeid:1,tenantId:2,role},query:{employeeid:'99'},body:{employeeid:99}}, response, next);
        expect(response.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
    it.each(['admin','super-admin'])('preserves audit target filters for %s', async role => {
        const request: any = {authUser:{employeeid:7,tenantId:2,role},query:{employeeid:'99'},body:{}};
        const next = vi.fn();
        await adminGuard()(request, {}, next);
        expect(next).toHaveBeenCalledOnce();
        expect(request.query.employeeid).toBe('99');
        expect(request.query.tenantId).toBe('2');
    });
});
