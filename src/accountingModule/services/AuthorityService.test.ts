import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ role: 'admin', delegations: [] as any[] }));

vi.mock('../../database/KnexConnections', () => ({
     default: vi.fn(async () => (table: string) => {
          if (table !== 'authority_delegations') throw new Error(`Unexpected table ${table}`);
          const builder: any = {
               where: () => builder,
               andWhere: () => builder,
               orderBy: () => builder,
               limit: async (count: number) => mocks.delegations.slice(0, count),
          };
          return builder;
     }),
}));

vi.mock('../../models/settings/users/RolesRepository', () => ({
     default: class RolesRepository {
          async getRoleById() { return { role: mocks.role }; }
     },
}));

import { AuthorityService } from './AuthorityService';

const grant = (overrides: Record<string, unknown> = {}) => ({
     id: 7,
     employeeid: 3,
     permission: 'expense.approve',
     min_amount: 0,
     max_amount: 2000,
     branchid: 4,
     is_active: true,
     expires_at: null,
     ...overrides,
});

describe('AuthorityService explicit delegation precedence', () => {
     it('enforces an explicit Admin approval ceiling before role fallback', async () => {
          mocks.role = 'admin';
          mocks.delegations = [grant()];

          const decision = await new AuthorityService(3).can(3, 'expense.approve', 5550, 4);

          expect(decision.allowed).toBe(false);
          expect(decision.reason).toContain('capped at 2000.00');
          expect(decision.delegationId).toBe(7);
     });

     it('allows Admin role fallback when no explicit approval grant exists', async () => {
          mocks.role = 'admin';
          mocks.delegations = [];

          await expect(new AuthorityService(3).can(3, 'expense.approve', 5550, 4)).resolves.toMatchObject({ allowed: true, source: 'role' });
     });

     it('fails closed when duplicate active grants exist', async () => {
          mocks.role = 'manager';
          mocks.delegations = [grant({ id: 8 }), grant({ id: 7 })];

          await expect(new AuthorityService(3).can(3, 'expense.approve', 100, 4)).resolves.toMatchObject({
               allowed: false,
               reason: expect.stringContaining('Duplicate active authority grants'),
          });
     });

     it('fails closed when a stored monetary limit is malformed', async () => {
          mocks.role = 'manager';
          mocks.delegations = [grant({ max_amount: 'invalid' })];

          await expect(new AuthorityService(3).can(3, 'expense.approve', 100, 4)).resolves.toMatchObject({
               allowed: false,
               reason: expect.stringContaining('invalid monetary limits'),
          });
     });
});
