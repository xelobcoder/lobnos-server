import { assertEncryptedPaths } from '../../../security/storageEncryption';
import { Readable } from 'node:stream';
import { encryptBackupStream, decryptBackupFile } from './backupCipher';
import KnexConnection from "../../../database/KnexConnections";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { bootstrapBackupSecuritySettings } from './BackupSecurityBootstrapper';

interface BackupSecuritySettings {
     id?: number;
     encryption_enabled: boolean;
     encryption_algorithm: string;
     encryption_password?: string | null;
     key_rotation_days: number;
     secure_deletion_enabled: boolean;
     deletion_passes: number;
     storage_path?: string;
     current_key_id?: string;
     key_last_rotated?: Date;
     is_active: boolean;
     created_at?: Date;
     updated_at?: Date;
}

interface EncryptionKey {
     id?: number;
     key_id: string;
     encrypted_key: string;
     algorithm: string;
     created_at?: Date;
     updated_at?: Date;
     expires_at?: Date;
     is_active: boolean;
     deactivated_at?: Date;
     created_by?: string;
}

export default class EncryptionManager {
     private static readonly SETTINGS_TABLE = 'backup_security_settings';
     private static readonly KEYS_TABLE = 'encryption_keys';
     private static masterKey(): string {
          const keyFile = process.env.BACKUP_MASTER_KEY_FILE;
          if (keyFile && !path.isAbsolute(keyFile)) throw new Error('BACKUP_MASTER_KEY_FILE must be an absolute path');
          const secret = keyFile ? fs.readFileSync(keyFile, 'utf8').trim() : process.env.BACKUP_MASTER_KEY;
          if (!secret) throw new Error('Configure BACKUP_MASTER_KEY_FILE or BACKUP_MASTER_KEY before encrypting backups');
          return secret;
     }

     static encryptionRequired(): boolean {
          return process.env.PLS_ENCRYPTION_REQUIRED === 'true' || process.env.BACKUP_ENCRYPTION_REQUIRED === 'true' || process.env.NODE_ENV === 'production';
     }

     static async getEffectiveStoragePath(tenantId: number): Promise<string> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          const storagePath = settings?.storage_path?.toString().trim();
          if (storagePath) {
               return storagePath;
          }
          throw new Error('No storage path configured. Please set a storage path in security settings.');
     }

     static async getSecuritySettings(tenantId: number): Promise<BackupSecuritySettings | null> {
          await bootstrapBackupSecuritySettings(tenantId);
          const connection = await KnexConnection(tenantId);
          const settings = await connection(this.SETTINGS_TABLE)
               .where('is_active', true)
               .orderBy('created_at', 'desc')
               .first();

          if (settings?.encryption_password?.startsWith('sealed:')) {
               return { ...settings, encryption_password: this.decryptWithMasterKey(settings.encryption_password.slice(7), `backup-password:${tenantId}`).toString('utf8') };
          }
          return settings || null;
     }

     static async shouldEncryptBackups(tenantId: number): Promise<boolean> {
          const settings = await this.getSecuritySettings(tenantId);
          return this.encryptionRequired() || !!settings?.encryption_enabled || !!settings?.encryption_password?.trim();
     }

     static async updateSecuritySettings(tenantId: number, updates: Partial<BackupSecuritySettings>): Promise<boolean> {
          await bootstrapBackupSecuritySettings(tenantId);
          const connection = await KnexConnection(tenantId);

          // Validate storage path if provided
          if (updates.storage_path) {
               const pathValidation = this.validateStoragePath(updates.storage_path);
               if (!pathValidation.valid) {
                    throw new Error(`Invalid storage path: ${pathValidation.error}`);
               }
          }

          // Check if settings exist
          const existingSettings = await connection(this.SETTINGS_TABLE)
               .where('is_active', true)
               .first();

          if (updates.encryption_password === '************') {
               if (!existingSettings?.encryption_password) throw new Error('Enter an encryption password');
               updates = { ...updates, encryption_password: undefined };
          }
          const password = updates.encryption_password?.toString().trim();
          const storedPassword = password ? `sealed:${this.encryptWithMasterKey(Buffer.from(password), `backup-password:${tenantId}`)}` : null;
          if (existingSettings) {
               // Update existing settings
               const updated = await connection(this.SETTINGS_TABLE)
                    .where('is_active', true)
                    .update({
                         ...updates,
                         encryption_algorithm: 'AES-256-GCM',
                         encryption_password: updates.encryption_password === undefined
                              ? existingSettings.encryption_password
                              : storedPassword,
                         updated_at: new Date()
                    });

               return updated > 0;
          } else {
               // Create new settings
               const newSettings = {
                    encryption_enabled: updates.encryption_enabled ?? false,
                    encryption_algorithm: 'AES-256-GCM',
                    encryption_password: storedPassword,
                    key_rotation_days: updates.key_rotation_days ?? 90,
                    secure_deletion_enabled: updates.secure_deletion_enabled ?? false,
                    deletion_passes: updates.deletion_passes ?? 1,
                    storage_path: updates.storage_path?.toString().trim() || '',
                    current_key_id: updates.current_key_id ?? null,
                    key_last_rotated: updates.key_last_rotated ?? null,
                    is_active: true,
                    created_at: new Date(),
                    updated_at: new Date()
               };

               await connection(this.SETTINGS_TABLE).insert(newSettings);
               return true;
          }
     }

     static async generateEncryptionKey(tenantId: number, createdBy?: string, userKey?: string, serverManaged = false): Promise<string> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          if (!settings && !serverManaged) {
               throw new Error('Backup security settings not found. Configure security settings first');
          }
          const effectivePassword = userKey || settings?.encryption_password || '';

          if (!effectivePassword.trim() && !serverManaged && !this.encryptionRequired()) {
               throw new Error('No encryption password configured in backup security settings');
          }
          if (userKey) {
               const validation = this.validateUserKey(userKey);
               if (!validation.valid) throw new Error(`Invalid encryption password: ${validation.error}`);
          }
          // A fresh random data key on every rotation, independent of tenant passwords.
          const key = crypto.randomBytes(32);
          const keyId = `KEY-${crypto.randomUUID()}`;

          const encryptedKey = this.encryptWithMasterKey(key, `backup-key:${tenantId}`);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (settings?.key_rotation_days || 90));

          const connection = await KnexConnection(tenantId);
          await connection(this.KEYS_TABLE).insert({
               key_id: keyId,
               encrypted_key: encryptedKey,
               algorithm: 'AES-256-GCM',
               expires_at: expiresAt,
               is_active: true,
               created_by: createdBy
          });

          await this.updateSecuritySettings(tenantId, {
               current_key_id: keyId,
               key_last_rotated: new Date()
          });

          return keyId;
     }

     static async getActiveEncryptionKey(tenantId: number): Promise<{ keyId: string; key: Buffer; authenticated: boolean } | null> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          if (!settings?.current_key_id) {
               return null;
          }

          const connection = await KnexConnection(tenantId);
          const keyRecord = await connection(this.KEYS_TABLE)
               .where('key_id', settings.current_key_id)
               .andWhere('is_active', true)
               .first();

          if (!keyRecord) {
               return null;
          }

          const decryptedKey = this.decryptWithMasterKey(keyRecord.encrypted_key, `backup-key:${tenantId}`);
          return {
               keyId: keyRecord.key_id,
               key: decryptedKey,
               authenticated: keyRecord.encrypted_key.startsWith('v2:'),
          };
     }

     static async prepareBackupEncryption(tenantId: number, serverManaged = false) {
          let keyInfo = await this.getActiveEncryptionKey(tenantId);
          if (!keyInfo || !keyInfo.authenticated || await this.isKeyRotationNeeded(tenantId)) {
               await this.generateEncryptionKey(tenantId, undefined, undefined, serverManaged);
               keyInfo = await this.getActiveEncryptionKey(tenantId);
          }
          if (!keyInfo) throw new Error('Failed to retrieve the backup encryption key');
          const { key, keyId } = keyInfo;
          return { keyId, encrypt: (input: Readable, output: string) => encryptBackupStream(input, output, key, tenantId, keyId) };
     }

     static async encryptStream(tenantId: number, input: Readable, outputPath: string): Promise<{ success: boolean; keyId?: string; error?: string }> {
          let sourceError: Error | undefined;
          const captureError = (error: Error) => { sourceError = error; };
          input.on('error', captureError);
          try {
               const encryption = await this.prepareBackupEncryption(tenantId);
               if (sourceError) throw sourceError;
               await encryption.encrypt(input, outputPath);
               return { success: true, keyId: encryption.keyId };
          } catch (error) {
               input.destroy();
               return { success: false, error: error instanceof Error ? error.message : 'Backup encryption failed' };
          } finally {
               input.off('error', captureError);
          }
     }

     static async encryptFile(tenantId: number, inputPath: string, outputPath: string): Promise<{ success: boolean; keyId?: string; error?: string }> {
          return this.encryptStream(tenantId, fs.createReadStream(inputPath), outputPath);
     }

     static async decryptFile(tenantId: number, inputPath: string, outputPath: string, keyId: string): Promise<{ success: boolean; error?: string }> {
          try {
               if (process.env.STORAGE_ENCRYPTION_REQUIRED === 'true') await assertEncryptedPaths([path.dirname(path.resolve(outputPath))]);
               const connection = await KnexConnection(tenantId);
               const record = await connection(this.KEYS_TABLE).where('key_id', keyId).first();
               if (!record) throw new Error('Encryption key not found');
               const key = this.decryptWithMasterKey(record.encrypted_key, `backup-key:${tenantId}`);
               await decryptBackupFile(inputPath, outputPath, key, tenantId, keyId, !record.encrypted_key.startsWith('v2:'));
               return { success: true };
          } catch (error) {
               return { success: false, error: error instanceof Error ? error.message : 'Backup decryption failed' };
          }
     }

     static async secureDeleteFile(filePath: string, passes: number = 3): Promise<{ success: boolean; error?: string }> {
          try {
               if (!fs.existsSync(filePath)) {
                    return { success: false, error: 'File does not exist' };
               }

               const stats = fs.statSync(filePath);
               const fileSize = stats.size;

               for (let pass = 0; pass < passes; pass++) {
                    const pattern = this.getOverwritePattern(pass);
                    const data = Buffer.alloc(fileSize, pattern);

                    fs.writeFileSync(filePath, data as any);
               }

               fs.unlinkSync(filePath);

               return { success: true };

          } catch (error) {
               return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Secure deletion failed'
               };
          }
     }

     static async isKeyRotationNeeded(tenantId: number): Promise<boolean> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          if (!settings?.key_last_rotated) {
               return true;
          }

          const lastRotated = new Date(settings.key_last_rotated);
          const now = new Date();
          const daysSinceRotation = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));

          return daysSinceRotation >= settings.key_rotation_days;
     }

     static async rotateKeyIfNeeded(tenantId: number, createdBy?: string, force: boolean = false, userKey?: string): Promise<{ rotated: boolean; newKeyId?: string; error?: string }> {
          const needsRotation = force || await this.isKeyRotationNeeded(tenantId);
          if (!needsRotation) return { rotated: false };
          try {
               const newKeyId = await this.generateEncryptionKey(tenantId, createdBy, userKey);
               return { rotated: true, newKeyId };
          } catch (error) {
               return {
                    rotated: false,
                    error: error instanceof Error ? error.message : 'Key rotation failed'
               };
          }
     }

     static async getAllEncryptionKeys(tenantId: number): Promise<EncryptionKey[]> {
          await bootstrapBackupSecuritySettings(tenantId);
          const connection = await KnexConnection(tenantId);
          return await connection(this.KEYS_TABLE)
               .select('id', 'key_id', 'algorithm', 'created_at', 'expires_at', 'is_active', 'deactivated_at', 'created_by')
               .orderBy('created_at', 'desc');
     }

     static async deactivateKey(tenantId: number, keyId: string): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.KEYS_TABLE)
               .where('key_id', keyId)
               .update({
                    is_active: false,
                    deactivated_at: new Date()
               });

          return updated > 0;
     }

     static encryptSecret(plaintext: string): string {
          return this.encryptWithMasterKey(Buffer.from(plaintext, 'utf8'));
     }

     static decryptSecret(encryptedHex: string): string {
          return this.decryptWithMasterKey(encryptedHex).toString('utf8');
     }

     private static encryptWithMasterKey(data: Buffer, context = ''): string {
          const salt = crypto.randomBytes(16);
          const key = crypto.scryptSync(this.masterKey(), salt, 32);
          const iv = crypto.randomBytes(12);
          const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
          cipher.setAAD(Buffer.from(context));
          const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
          return `v2:${Buffer.concat([salt, iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
     }

     private static decryptWithMasterKey(value: string, context = ''): Buffer {
          if (value.startsWith('v2:')) {
               const data = Buffer.from(value.slice(3), 'base64');
               if (data.length < 44) throw new Error('Invalid encrypted key');
               const key = crypto.scryptSync(this.masterKey(), data.subarray(0, 16), 32);
               const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(16, 28));
               decipher.setAAD(Buffer.from(context));
               decipher.setAuthTag(data.subarray(28, 44));
               return Buffer.concat([decipher.update(data.subarray(44)), decipher.final()]);
          }
          // Existing keys and secrets remain readable during the staged rollout.
          const key = crypto.scryptSync(this.masterKey(), 'salt', 32);
          const encrypted = Buffer.from(value, 'hex');
          const decipher = crypto.createDecipheriv('aes-256-cbc', key, encrypted.subarray(0, 16));
          return Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
     }

     private static getOverwritePattern(pass: number): number {
          const patterns = [0x00, 0xFF, 0x55, 0xAA];
          return patterns[pass % patterns.length];
     }

     static validateStoragePath(storagePath: string): { valid: boolean; error?: string } {
          try {
               // Check if path is absolute
               if (!path.isAbsolute(storagePath)) {
                    return { valid: false, error: 'Storage path must be an absolute path' };
               }

               // Check if directory exists, create if it doesn't
               if (!fs.existsSync(storagePath)) {
                    fs.mkdirSync(storagePath, { recursive: true });
               }

               // Check if it's actually a directory
               const stats = fs.statSync(storagePath);
               if (!stats.isDirectory()) {
                    return { valid: false, error: 'Storage path must be a directory' };
               }

               // Check if directory is writable
               try {
                    fs.accessSync(storagePath, fs.constants.W_OK);
               } catch {
                    return { valid: false, error: 'Storage path must be writable' };
               }

               // Additional security checks
               const normalizedPath = path.normalize(storagePath);

               // Prevent paths that go outside allowed directories (basic check)
               if (normalizedPath.includes('..') || normalizedPath.startsWith('/etc') || normalizedPath.startsWith('/bin')) {
                    return { valid: false, error: 'Storage path contains potentially unsafe directory traversal' };
               }

               return { valid: true };
          } catch (error: any) {
               return { valid: false, error: `Failed to validate storage path: ${error.message}` };
          }
     }

     static validateUserKey(userKey: string): { valid: boolean; error?: string } {
          // Check minimum length (at least 12 characters for good entropy)
          if (userKey.length < 12) {
               return { valid: false, error: 'Encryption key must be at least 12 characters long' };
          }

          // Check maximum length (prevent extremely long keys)
          if (userKey.length > 256) {
               return { valid: false, error: 'Encryption key must not exceed 256 characters' };
          }

          // Check for basic complexity requirements
          const hasUpperCase = /[A-Z]/.test(userKey);
          const hasLowerCase = /[a-z]/.test(userKey);
          const hasNumbers = /\d/.test(userKey);
          const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(userKey);

          const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(Boolean).length;

          if (complexityScore < 3) {
               return {
                    valid: false,
                    error: 'Encryption key must contain at least 3 of the following: uppercase letters, lowercase letters, numbers, special characters'
               };
          }

          // Check for common weak patterns
          const commonPatterns = [
               /^password/i,
               /^123456/,
               /^qwerty/i,
               /^admin/i,
               /^user/i
          ];

          for (const pattern of commonPatterns) {
               if (pattern.test(userKey)) {
                    return { valid: false, error: 'Encryption key contains common weak patterns' };
               }
          }

          return { valid: true };
     }
}
