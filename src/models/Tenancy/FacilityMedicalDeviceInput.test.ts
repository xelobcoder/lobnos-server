import { describe, expect, it } from 'vitest';
import { parseMedicalDeviceId, validateMedicalDeviceInput } from './FacilityMedicalDeviceInput';

const valid = { name: 'MindRay', ip: '192.168.1.20', dial_port: '5000', connection_mode: 'server', use_tls: 0, active: 1 };

describe('platform medical device configuration', () => {
     it('normalizes flags and serializes tenant-local test IDs for the existing device schema', () => {
          expect(validateMedicalDeviceInput({ ...valid, testid: [11, 12, 11], active: false })).toMatchObject({
               name: 'MindRay', testid: '11,12', active: 0, listen_port: '', device_info: '',
          });
     });
     it.each([
          { name: '' }, { ip: 'invalid' }, { dial_port: '0' }, { dial_port: '65536' },
          { listen_port: '-1' }, { use_tls: 'yes' }, { active: null }, { connection_mode: 'other' },
          { testid: '11,no' }, { testid: [0] }, { tenantId: 123456 }, { employeeid: 7 },
     ])('rejects invalid or caller-controlled fields: %j', patch => {
          expect(() => validateMedicalDeviceInput({ ...valid, ...patch })).toThrow();
     });
     it('validates device IDs independently of caller body values', () => {
          expect(parseMedicalDeviceId('12')).toBe(12);
          for (const id of ['0', '-1', '1x', '9007199254740992', null]) expect(() => parseMedicalDeviceId(id)).toThrow();
     });
});
