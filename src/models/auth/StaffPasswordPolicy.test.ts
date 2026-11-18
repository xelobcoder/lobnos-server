import { describe, expect, it } from 'vitest';
import { isStaffPasswordExpired, STAFF_PASSWORD_MAX_AGE_MS, staffPasswordChangeRouteAllowed } from './StaffPasswordPolicy';

describe('staff password age policy', () => {
     const now = new Date('2026-11-18T12:00:00.000Z').getTime();

     it('expires a password at 30 days, not before', () => {
          expect(isStaffPasswordExpired(new Date(now - STAFF_PASSWORD_MAX_AGE_MS), now)).toBe(true);
          expect(isStaffPasswordExpired(new Date(now - STAFF_PASSWORD_MAX_AGE_MS + 1), now)).toBe(false);
     });

     it('leaves missing or invalid timestamps unexpired', () => {
          expect(isStaffPasswordExpired(null, now)).toBe(false);
          expect(isStaffPasswordExpired(undefined, now)).toBe(false);
          expect(isStaffPasswordExpired('not-a-date', now)).toBe(false);
     });

     it('allows only password update and token verification through for expired staff', () => {
          expect(staffPasswordChangeRouteAllowed('POST', '/api/v1/prime/change-password')).toBe(true);
          expect(staffPasswordChangeRouteAllowed('GET', '/api/v1/prime/validate-token')).toBe(true);
          expect(staffPasswordChangeRouteAllowed('POST', '/api/v1/prime/resetpassword')).toBe(false);
          expect(staffPasswordChangeRouteAllowed('GET', '/api/v1/result/printout')).toBe(false);
     });
});
