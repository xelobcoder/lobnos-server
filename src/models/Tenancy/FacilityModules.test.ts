import { describe, expect, it } from 'vitest';
import { validateModuleConfiguration } from './FacilityModules';

export const moduleConfig = {
     branchMode: 'single', currency: 'GHS', modules: {
          pharmacy: { enabled: true, monthlyPrice: '10.01' },
          email: { enabled: true, monthlyPrice: '20.02' },
          sms: { enabled: false, monthlyPrice: '100.00' },
          inventory: { enabled: true, monthlyPrice: '0.00' },
          deviceInterfacing: { enabled: false, monthlyPrice: '0.00' },
     },
};
describe('facility module prices and selections', () => {
     it('sums only enabled modules in exact cents', () => {
          expect(validateModuleConfiguration(moduleConfig)).toMatchObject({ monthlyTotal: '30.03', branchMode: 'single', currency: 'GHS' });
          expect(validateModuleConfiguration({ ...moduleConfig, branchMode: 'multiple' })?.branchMode).toBe('multiple');
          expect(validateModuleConfiguration(undefined)).toBeNull();
     });
     it.each([null, {}, { ...moduleConfig, currency: 'ghs' }, { ...moduleConfig, branchMode: 'unlimited' },
          { ...moduleConfig, modules: { ...moduleConfig.modules, unknown: {} } },
          { ...moduleConfig, modules: { ...moduleConfig.modules, pharmacy: { enabled: 'true', monthlyPrice: '1' } } },
          { ...moduleConfig, modules: { ...moduleConfig.modules, pharmacy: { enabled: true, monthlyPrice: '-1' } } },
          { ...moduleConfig, modules: { ...moduleConfig.modules, pharmacy: { enabled: true, monthlyPrice: '0.001' } } },
          { ...moduleConfig, modules: { ...moduleConfig.modules, pharmacy: { enabled: true, monthlyPrice: 10 } } },
     ])('rejects invalid configuration %j', value => {
          expect(() => validateModuleConfiguration(value)).toThrow();
     });
     it('rejects combined prices above the DECIMAL(12,2) billing limit', () => {
          expect(() => validateModuleConfiguration({ ...moduleConfig, modules: {
               ...moduleConfig.modules, pharmacy: { enabled: true, monthlyPrice: '9999999999.99' },
          } })).toThrow(/Total module price/);
     });
});
