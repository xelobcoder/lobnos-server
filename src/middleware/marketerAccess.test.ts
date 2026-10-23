import { describe, expect, it, vi } from 'vitest';
import { marketerRouteAllowed } from './marketerAccess';
import { requireCrmRole } from './crmAuthority';
describe('marketer data boundary', () => {
     it('allows CRM and session context but blocks patient records, clinical work and payouts', () => {
          expect(marketerRouteAllowed('GET', '/api/v1/crm/performance')).toBe(true);
          expect(marketerRouteAllowed('PATCH', '/api/v1/crm/prospects/1')).toBe(true);
          expect(marketerRouteAllowed('GET', '/api/v1/prime/validate-token')).toBe(true);
          for (const path of ['/api/v1/register/personalinformation', '/api/v1/commission/assignments', '/api/v1/operations/collection', '/api/v1/accounting/general-ledger']) expect(marketerRouteAllowed('GET', path)).toBe(false);
     });
     it('denies unrelated roles, missing branch and tenant mismatch', () => {
          for (const actor of [{ role: 'patient', tenantId: 1, branch: 4 }, { role: 'marketer', tenantId: 2, branch: 4 }, { role: 'marketer', tenantId: 1, branch: null }]) {
               const next = vi.fn(); const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
               requireCrmRole({ authUser: actor, query: { tenantId: '1' } } as any, res, next);
               expect(res.status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
          }
     });
});
