import {describe,it,expect,vi,afterEach} from 'vitest';
import {encryptSmsSecret,decryptSmsSecret} from './SmsSecretCipher';
afterEach(()=>vi.unstubAllEnvs());
describe('SMS credentials at rest',()=>{
 it('encrypts with authenticated encryption, preserves plaintext legacy reads and detects tampering',()=>{vi.stubEnv('SMS_SECRET_KEY','test-secret-key-that-is-longer-than-32-characters');const value=encryptSmsSecret('api-secret');expect(value).not.toContain('api-secret');expect(decryptSmsSecret(value)).toBe('api-secret');expect(decryptSmsSecret(encryptSmsSecret('sms:enc:v1:literal-api-key'))).toBe('sms:enc:v1:literal-api-key');expect(decryptSmsSecret('legacy-key')).toBe('legacy-key');expect(encryptSmsSecret('api-secret')).not.toBe(value);expect(()=>decryptSmsSecret(value.slice(0,-4)+'AAAA')).toThrow();});
 it('refuses new writes without a suitably strong configured encryption key',()=>{vi.stubEnv('SMS_SECRET_KEY','');vi.stubEnv('JWT_SECRET_KEY','short');expect(()=>encryptSmsSecret('secret')).toThrow('SMS_SECRET_KEY');});
});
