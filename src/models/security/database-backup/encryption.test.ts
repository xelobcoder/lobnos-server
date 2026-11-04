import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mocks = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('./BackupSecurityBootstrapper', () => ({ bootstrapBackupSecuritySettings: vi.fn().mockResolvedValue(undefined) }));
import EncryptionManager from './encryption';
import { EncryptionController } from '../../../controllers/security/encryption-controller';

const master = 'fixture-master-key-with-at-least-32-characters';
let directory: string;
let tenants: Map<number, Record<string, any[]>>;
beforeEach(async () => {
     directory = await fs.mkdtemp(path.join(tmpdir(), 'pls-encryption-test-'));
     tenants = new Map();
     vi.stubEnv('BACKUP_MASTER_KEY', master); vi.stubEnv('BACKUP_MASTER_KEY_FILE', undefined);
     vi.stubEnv('PLS_ENCRYPTION_REQUIRED', 'true'); vi.stubEnv('BACKUP_ENCRYPTION_REQUIRED', undefined);
     mocks.connect.mockImplementation(async id => {
          if (!tenants.has(id)) tenants.set(id, { backup_security_settings: [{ encryption_enabled: true, is_active: true, key_rotation_days: 90 }], encryption_keys: [] });
          return (table: string) => {
               const rows = tenants.get(id)![table];
               const filters: ((row: any) => boolean)[] = [];
               const query: any = {
                    where: (field: any, value: any) => { filters.push(row => typeof field === 'object' ? Object.entries(field).every(([key, expected]) => row[key] === expected) : row[field] === value); return query; },
                    andWhere: (field: string, value: any) => query.where(field, value),
                    orderBy: () => query,
                    first: async () => rows.find(row => filters.every(test => test(row))),
                    insert: async (row: any) => { rows.push({ ...row }); return [rows.length]; },
                    update: async (updates: any) => { const selected = rows.filter(row => filters.every(test => test(row))); selected.forEach(row => Object.assign(row, updates)); return selected.length; },
               };
               return query;
          };
     });
});
afterEach(async () => { vi.unstubAllEnvs(); vi.restoreAllMocks(); await fs.rm(directory, { recursive: true, force: true }); });
function legacyWrap(data: Buffer) {
     const iv = randomBytes(16); const cipher = createCipheriv('aes-256-cbc', scryptSync(master, 'salt', 32), iv);
     return Buffer.concat([iv, cipher.update(data), cipher.final()]).toString('hex');
}

describe('tenant backup key lifecycle', () => {
     it('creates random tenant-bound keys and restores after rotating without deleting historical keys', async () => {
          const first = await EncryptionManager.generateEncryptionKey(7);
          const info = await EncryptionManager.getActiveEncryptionKey(7);
          expect(info!.authenticated).toBe(true);
          const input = path.join(directory, 'backup');
          expect((await EncryptionManager.encryptStream(7, Readable.from(['fixture only']), input)).success).toBe(true);
          const second = await EncryptionManager.generateEncryptionKey(7);
          expect(second).not.toBe(first);
          expect((await EncryptionManager.getActiveEncryptionKey(7))!.key).not.toEqual(info!.key);
          expect((await EncryptionManager.decryptFile(7, input, path.join(directory, 'restored'), first)).success).toBe(true);
          expect(await fs.readFile(path.join(directory, 'restored'), 'utf8')).toBe('fixture only');
          expect(tenants.get(7)!.encryption_keys).toHaveLength(2);
     });
     it('rejects even a copied key record in another tenant database', async () => {
          const id = await EncryptionManager.generateEncryptionKey(7);
          await EncryptionManager.getSecuritySettings(8);
          tenants.get(8)!.encryption_keys.push({ ...tenants.get(7)!.encryption_keys[0] });
          tenants.get(8)!.backup_security_settings[0].current_key_id = id;
          await expect(EncryptionManager.getActiveEncryptionKey(8)).rejects.toThrow();
     });
     it('seals settings passwords and returns a reusable mask without exposing the saved value', async () => {
          await EncryptionManager.updateSecuritySettings(7, { encryption_password: 'fixture-settings-password' });
          const stored = tenants.get(7)!.backup_security_settings[0].encryption_password;
          expect(stored).toMatch(/^sealed:v2:/); expect(stored).not.toContain('fixture-settings-password');
          expect((await EncryptionManager.getSecuritySettings(7))!.encryption_password).toBe('fixture-settings-password');
          const response: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
          await EncryptionController.getSecuritySettings({ query: { tenantId: '7' } } as any, response);
          expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ encryption_password: '************', encryption_required: true }) }));
          await EncryptionManager.updateSecuritySettings(7, { encryption_password: '************', key_rotation_days: 60 });
          expect(tenants.get(7)!.backup_security_settings[0].encryption_password).toBe(stored);
     });
     it('reads legacy wrapped keys and legacy CBC backup files', async () => {
          await EncryptionManager.getSecuritySettings(7);
          const key = randomBytes(32);
          tenants.get(7)!.encryption_keys.push({ key_id: 'legacy', encrypted_key: legacyWrap(key), is_active: true });
          const iv = randomBytes(16); const cipher = createCipheriv('aes-256-cbc', key, iv);
          const input = path.join(directory, 'legacy');
          await fs.writeFile(input, Buffer.concat([iv, cipher.update('old fixture'), cipher.final()]));
          expect((await EncryptionManager.decryptFile(7, input, path.join(directory, 'restored'), 'legacy')).success).toBe(true);
          expect(await fs.readFile(path.join(directory, 'restored'), 'utf8')).toBe('old fixture');
     });
     it('supports the external key file and fails closed if the recovery secret is wrong', async () => {
          const keyFile = path.join(directory, 'external-key'); await fs.writeFile(keyFile, master);
          vi.stubEnv('BACKUP_MASTER_KEY', undefined); vi.stubEnv('BACKUP_MASTER_KEY_FILE', keyFile);
          await EncryptionManager.generateEncryptionKey(7);
          await fs.writeFile(keyFile, 'different-fixture-master-key-with-32-characters');
          await expect(EncryptionManager.getActiveEncryptionKey(7)).rejects.toThrow();
     });
     it('requires encryption in production and fails without master-key material', async () => {
          vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PLS_ENCRYPTION_REQUIRED', undefined); vi.stubEnv('BACKUP_MASTER_KEY', undefined);
          expect(await EncryptionManager.shouldEncryptBackups(7)).toBe(true);
          const result = await EncryptionManager.encryptStream(7, Readable.from(['fixture']), path.join(directory, 'backup'));
          expect(result.success).toBe(false); expect(result.error).toContain('BACKUP_MASTER_KEY');
          expect(await fs.readdir(directory)).toEqual([]);
     });
     it('authenticates new secret envelopes while preserving old secret values', () => {
          const encrypted = EncryptionManager.encryptSecret('fixture secret');
          expect(EncryptionManager.decryptSecret(encrypted)).toBe('fixture secret');
          expect(EncryptionManager.decryptSecret(legacyWrap(Buffer.from('old secret')))).toBe('old secret');
          const bytes = Buffer.from(encrypted.slice(3), 'base64'); bytes[bytes.length - 1] ^= 1;
          expect(() => EncryptionManager.decryptSecret(`v2:${bytes.toString('base64')}`)).toThrow();
     });
});
