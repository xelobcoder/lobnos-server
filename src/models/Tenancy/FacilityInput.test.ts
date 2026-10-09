import { describe, expect, it } from 'vitest';
import { validateFacilityInput } from './FacilityInput';
import { hasPlatformFacilityAuthority } from '../../middleware/platformFacilityAuthority';

const input = {
     companyName: 'Example Lab', email: 'lab@example.test', phone: '0201234567', address: 'Example Street',
     countryId: 1, stateId: 2, districtId: 3, adminName: 'Administrator',
     adminEmail: 'admin@example.test', adminPassword: 'a-long-test-password',
};

describe('facility boundary validation', () => {
     it('keeps the supplied password and defaults the license to 365 days', () => {
          expect(validateFacilityInput(input)).toEqual({ ...input, licenseDays: 365 });
     });
     it.each([
          { companyName: '' }, { countryId: '1' }, { districtId: -1 }, { licenseDays: 1.5 },
          { adminPassword: 'short' }, { adminPassword: 'é'.repeat(37) }, { phone: '+233201234567' },
          { email: 'invalid' }, { address: 'x'.repeat(201) },
          { phone: '9999999999' },
     ])('rejects invalid input %j', (patch) => {
          expect(() => validateFacilityInput({ ...input, ...patch })).toThrow();
     });
});

describe('live platform facility authority', () => {
     const claims = { tid: 123456, employeeid: 9, email: 'control@example.test' };
     const row = { employeeid: 9, email: claims.email, role: 'super-admin', activation: 1 };
     it('accepts only the exact stored super-admin role in the control tenant', () => {
          expect(hasPlatformFacilityAuthority(claims, row, 123456)).toBe(true);
     });
     it.each(['admin', 'super_admin', 'Super-Admin', 'superadmin', 'manager'])('rejects %s', role => {
          expect(hasPlatformFacilityAuthority(claims, { ...row, role }, 123456)).toBe(false);
     });
     it('rejects tenant mismatches, disabled accounts and substituted identities', () => {
          expect(hasPlatformFacilityAuthority(claims, row, 654321)).toBe(false);
          expect(hasPlatformFacilityAuthority({ ...claims, tid: undefined }, row, 123456)).toBe(false);
          expect(hasPlatformFacilityAuthority(claims, { ...row, activation: 0 }, 123456)).toBe(false);
          expect(hasPlatformFacilityAuthority(claims, { ...row, employeeid: 8 }, 123456)).toBe(false);
     });
});
