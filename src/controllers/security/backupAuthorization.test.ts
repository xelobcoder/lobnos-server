import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { requireOwnerRole } from '../../middleware/authority';

describe('backup administration authorization', () => {
     it('guards the entire backup API before registering any backup operation', () => {
          const source = fs.readFileSync(path.join(__dirname, 'route.ts'), 'utf8');
          const boundary = source.indexOf("router.use('/api/v1/security-features/backup', requireOwnerRole)");
          expect(boundary).toBeGreaterThan(-1);
          expect(boundary).toBeLessThan(source.indexOf("router.post('/api/v1/security-features/backup/database'"));
     });
     it.each(['admin', 'super-admin'])('retains %s backup administration', role => {
          const next = vi.fn();
          requireOwnerRole({ authUser: { role, tenantId: 7, employeeid: 1 } } as any, {} as any, next);
          expect(next).toHaveBeenCalledTimes(1);
     });
     it.each(['scientist', 'cashier', 'accountant', 'clinician', 'patient'])('denies %s access despite a forged request role', role => {
          const next = vi.fn();
          const response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
          requireOwnerRole({ authUser: { role, tenantId: 7, employeeid: 1 }, body: { role: 'admin' } } as any, response, next);
          expect(response.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });
     it('rejects a missing authenticated identity', () => {
          const next = vi.fn();
          const response: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
          requireOwnerRole({} as any, response, next);
          expect(response.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
     });
});
