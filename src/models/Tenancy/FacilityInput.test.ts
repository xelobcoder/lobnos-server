import { describe, expect, it } from 'vitest';
import { validateFacilityInput } from './FacilityInput';

const input = {
     companyName: 'Example Lab', email: 'lab@example.test', phone: '0201234567', address: 'Example Street',
     countryId: 1, stateId: 2, districtId: 3, adminName: 'Administrator',
     adminEmail: 'admin@example.test', adminPassword: 'a-long-test-password',
};

describe('facility boundary validation', () => {
     it('keeps the supplied password and defaults the license to 365 days', () => {
          expect(validateFacilityInput(input)).toEqual({
               ...input, licenseDays: 365, street: '', gpsAddress: '', planCode: null, moduleConfiguration: null,
          });
     });
     it('accepts a plan code and ignores custom module prices when that plan is selected', () => {
          expect(validateFacilityInput({ ...input, planCode: 'professional', moduleConfiguration: { invalid: true } }))
               .toMatchObject({ planCode: 'professional', moduleConfiguration: null });
     });
     it('does not accept client-supplied plan labels inside custom module configuration', () => {
          const configured = validateFacilityInput({ ...input, moduleConfiguration: {
               branchMode: 'single', currency: 'GHS',
               modules: {
                    pharmacy: { enabled: false, monthlyPrice: '0.00' },
                    email: { enabled: false, monthlyPrice: '0.00' },
                    sms: { enabled: false, monthlyPrice: '0.00' },
                    inventory: { enabled: true, monthlyPrice: '0.00' },
                    deviceInterfacing: { enabled: false, monthlyPrice: '0.00' },
               },
               monthlyTotal: '100.00', plan: { code: 'enterprise', name: 'Enterprise' },
          } });
          expect(configured.moduleConfiguration?.plan).toBeUndefined();
          expect(configured.moduleConfiguration?.monthlyTotal).toBe('0.00');
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
