import { describe, expect, it } from 'vitest';
import { parseMasterOwnerInitArguments } from './masterOwnerInitArguments';

describe('master owner initialization arguments', () => {
     it('defaults to the plsmaster username and a hidden interactive password prompt', () => {
          expect(parseMasterOwnerInitArguments([])).toEqual({ username: 'plsmaster', mode: 'prompt' });
     });

     it('defaults the username for piped passwords and staff imports', () => {
          expect(parseMasterOwnerInitArguments(['--password-stdin']))
               .toEqual({ username: 'plsmaster', mode: 'password-stdin' });
          expect(parseMasterOwnerInitArguments(['--', '--password-stdin']))
               .toEqual({ username: 'plsmaster', mode: 'password-stdin' });
          expect(parseMasterOwnerInitArguments(['--import-staff', '123456', '7']))
               .toEqual({ username: 'plsmaster', mode: 'import-staff', tenantId: '123456', employeeId: '7' });
     });

     it('preserves explicit username syntax and normalizes it to lowercase', () => {
          expect(parseMasterOwnerInitArguments(['PLSMASTER', '--password-stdin']))
               .toEqual({ username: 'plsmaster', mode: 'password-stdin' });
          expect(parseMasterOwnerInitArguments(['platform-owner', '--import-staff', '123456', '7']))
               .toEqual({ username: 'platform-owner', mode: 'import-staff', tenantId: '123456', employeeId: '7' });
     });

     it('rejects malformed or incomplete arguments', () => {
          expect(() => parseMasterOwnerInitArguments(['--password-stdin', 'unexpected'])).toThrow('Usage:');
          expect(() => parseMasterOwnerInitArguments(['bad username', '--password-stdin'])).toThrow('Usage:');
     });
});
