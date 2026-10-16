import { describe, expect, it, vi } from 'vitest';
import { decryptSecret, encryptSecret, isEncryptedSecret } from './emailSecretCipher';
import { getEnvEmailProvider } from './envEmailProvider';
import { EmailProvidersService, toPublicProvider } from '../services/EmailProvidersService';

const record = {
     id: 4, name: 'Lab SMTP', provider_type: 'smtp' as const, host: 'smtp.example.com', port: 587, secure: false,
     username: 'lab', password: 'app-password-1', from_email: 'lab@example.com', from_name: 'Lab',
     is_default: true, is_active: true,
};

describe('emailSecretCipher', () => {
     it('round-trips and never stores plaintext', () => {
          const stored = encryptSecret('app-password-1');
          expect(stored).not.toContain('app-password-1');
          expect(isEncryptedSecret(stored)).toBe(true);
          expect(decryptSecret(stored)).toBe('app-password-1');
     });

     it('uses a fresh IV, is idempotent on encrypted input and passes legacy plaintext through', () => {
          expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
          const stored = encryptSecret('x');
          expect(encryptSecret(stored)).toBe(stored);
          expect(decryptSecret('legacy-plain')).toBe('legacy-plain');
     });

     it('rejects tampered ciphertext', () => {
          const [iv, tag] = encryptSecret('secret').slice('enc:v1:'.length).split('.');
          const tampered = `enc:v1:${iv}.${tag}.${Buffer.from('zzzzzz').toString('base64')}`;
          expect(() => decryptSecret(tampered)).toThrow();
     });
});

describe('toPublicProvider / EmailProvidersService', () => {
     it('masks the password and reports hasPassword', () => {
          const result: any = toPublicProvider(record);
          expect(result.password).toBeUndefined();
          expect(result.hasPassword).toBe(true);
          expect(JSON.stringify(result)).not.toContain('app-password-1');
     });

     it('getAll never leaks passwords', async () => {
          const repo = { findAll: vi.fn().mockResolvedValue([record]) };
          const service = new EmailProvidersService(repo as any, {} as any);
          expect(JSON.stringify(await service.getAll())).not.toContain('app-password-1');
     });

     it('update keeps the stored password when none is supplied', async () => {
          const repo = { update: vi.fn().mockResolvedValue(1) };
          const service = new EmailProvidersService(repo as any, {} as any);
          await service.update(4, { host: 'smtp.new.com', password: '' });
          expect(repo.update).toHaveBeenCalledWith(4, { host: 'smtp.new.com' });
     });

     it('sendTestEmail sends via the facility provider and reports failures without throwing', async () => {
          const send = vi.fn().mockResolvedValue({ success: false, failureReason: 'auth failed' });
          const repo = { findById: vi.fn().mockResolvedValue(record) };
          const service = new EmailProvidersService(repo as any, { create: () => ({ send }) } as any);
          const result = await service.sendTestEmail(4, 'me@example.com');
          expect(result).toEqual({ delivered: false, message: 'auth failed' });
          expect(send.mock.calls[0][0]).toMatchObject({ to: ['me@example.com'], fromEmail: 'lab@example.com' });
     });

     it('sendTestEmail rejects an unknown provider', async () => {
          const service = new EmailProvidersService({ findById: async () => null } as any, {} as any);
          await expect(service.sendTestEmail(9, 'a@b.com')).rejects.toThrow('Provider not found');
     });
});

describe('getEnvEmailProvider', () => {
     it('returns null when the environment is not configured', () => {
          expect(getEnvEmailProvider({} as any)).toBeNull();
     });

     it('builds a fallback sender from env', () => {
          const p = getEnvEmailProvider({ PROD_PLS_EMAIL_USER: 'a@b.com', PROD_PLS_EMAIL_PASSWORD: 'pw', PROD_PLS_EMAIL_PROVIDER: 'gmail', PROD_PLS_EMAIL_COMPANY: 'Acme' } as any);
          expect(p).toMatchObject({ host: 'gmail', port: 587, from_email: 'a@b.com', from_name: 'Acme', is_active: true });
     });
});
