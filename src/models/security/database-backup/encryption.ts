import KnexConnection from "../../../database/KnexConnections";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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
     private static readonly MASTER_KEY = process.env.BACKUP_MASTER_KEY

     static async getEffectiveStoragePath(tenantId: number): Promise<string> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          const storagePath = settings?.storage_path?.toString().trim();
          if (storagePath) {
               return storagePath;
          }
          throw new Error('No storage path configured. Please set a storage path in security settings.');
     }

     static async getSecuritySettings(tenantId: number): Promise<BackupSecuritySettings | null> {
          const connection = await KnexConnection(tenantId);
          const settings = await connection(this.SETTINGS_TABLE)
               .where('is_active', true)
               .orderBy('created_at', 'desc')
               .first();

          return settings || null;
     }

     static async shouldEncryptBackups(tenantId: number): Promise<boolean> {
          const settings = await this.getSecuritySettings(tenantId);
          return !!settings?.encryption_password && settings.encryption_password.trim().length > 0;
     }

     static async updateSecuritySettings(tenantId: number, updates: Partial<BackupSecuritySettings>): Promise<boolean> {
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

          if (existingSettings) {
               // Update existing settings
               const updated = await connection(this.SETTINGS_TABLE)
                    .where('is_active', true)
                    .update({
                         ...updates,
                         encryption_password: updates.encryption_password === undefined
                              ? existingSettings.encryption_password
                              : (updates.encryption_password?.toString().trim() || null),
                         updated_at: new Date()
                    });

               return updated > 0;
          } else {
               // Create new settings
               const newSettings = {
                    encryption_enabled: updates.encryption_enabled ?? false,
                    encryption_algorithm: updates.encryption_algorithm ?? 'AES-256',
                    encryption_password: updates.encryption_password?.toString().trim() || null,
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

     static async generateEncryptionKey(tenantId: number, createdBy?: string, userKey?: string): Promise<string> {
          const settings = await EncryptionManager.getSecuritySettings(tenantId);
          if (!settings) {
               throw new Error('Backup security settings not found. Configure security settings first');
          }
          const effectivePassword = userKey || settings?.encryption_password || '';

          if (!effectivePassword.trim()) {
               throw new Error('No encryption password configured in backup security settings');
          }

          let key: Buffer;

          if (effectivePassword) {
               // Validate password used as key source
               const keyValidation = this.validateUserKey(effectivePassword);
               if (!keyValidation.valid) {
                    throw new Error(`Invalid encryption password: ${keyValidation.error}`);
               }

               // Derive a proper encryption key from password using scrypt.
               key = crypto.scryptSync(effectivePassword, 'encryption-salt', 32);
          } else {
               // Generate random key as before
               key = crypto.randomBytes(32);
          }

          const keyId = `KEY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

          const encryptedKey = this.encryptWithMasterKey(key);

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (settings.key_rotation_days || 90));

          const connection = await KnexConnection(tenantId);
          await connection(this.KEYS_TABLE).insert({
               key_id: keyId,
               encrypted_key: encryptedKey,
               algorithm: settings.encryption_algorithm,
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

     static async getActiveEncryptionKey(tenantId: number): Promise<{ keyId: string; key: Buffer } | null> {
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

          const decryptedKey = this.decryptWithMasterKey(keyRecord.encrypted_key);
          return {
               keyId: keyRecord.key_id,
               key: decryptedKey
          };
     }

     static async encryptFile(tenantId: number, inputPath: string, outputPath: string): Promise<{ success: boolean; keyId?: string; error?: string }> {
          try {
               const settings = await this.getSecuritySettings(tenantId);
               const configuredPassword = settings?.encryption_password?.trim();
               if (!configuredPassword) {
                    return { success: false, error: 'No encryption password configured' };
               }

               let keyInfo = await this.getActiveEncryptionKey(tenantId);
               if (!keyInfo) {
                    const newKeyId = await this.generateEncryptionKey(tenantId, undefined, configuredPassword);
                    keyInfo = await this.getActiveEncryptionKey(tenantId);
                    if (!keyInfo) {
                         return { success: false, error: 'Failed to generate or retrieve encryption key' };
                    }
               }

               const { key, keyId } = keyInfo;

               const fileData = fs.readFileSync(inputPath);

               const iv = crypto.randomBytes(16);

               const cipher = crypto.createCipheriv('aes-256-cbc', key as any, iv as any);
               const encrypted = Buffer.concat([
                    iv as any,
                    cipher.update(fileData as any) as any,
                    cipher.final() as any
               ]);

               fs.writeFileSync(outputPath, encrypted as any);

               return { success: true, keyId };

          } catch (error) {
               return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown encryption error'
               };
          }
     }

     static async decryptFile(tenantId: number, inputPath: string, outputPath: string, keyId: string): Promise<{ success: boolean; error?: string }> {
          try {
               console.log('Starting decryption for keyId:', keyId);
               console.log("MASTER_KEY is set:", !!this.MASTER_KEY, process.env.BACKUP_MASTER_KEY);

               const connection = await KnexConnection(tenantId);
               const keyRecord = await connection(this.KEYS_TABLE)
                    .where('key_id', keyId)
                    .first();

               if (!keyRecord) {
                    console.log('Encryption key not found in database');
                    return { success: false, error: 'Encryption key not found' };
               }

               console.log('Found key record, decrypting with master key...');
               const key = this.decryptWithMasterKey(keyRecord.encrypted_key);
               console.log('Master key decryption successful, key length:', key.length);

               console.log('Reading encrypted file:', inputPath);
               const encryptedData = fs.readFileSync(inputPath);
               console.log('Encrypted file size:', encryptedData.length);

               const iv = encryptedData.slice(0, 16);
               const encryptedContent = encryptedData.slice(16);
               console.log('IV length:', iv.length, 'Encrypted content length:', encryptedContent.length);

               console.log('Creating decipher...');
               const decipher = crypto.createDecipheriv('aes-256-cbc', key as any, iv as any);
               console.log('Decipher created, starting decryption...');

               const decrypted = Buffer.concat([
                    decipher.update(encryptedContent as any) as any,
                    decipher.final() as any
               ]);

               console.log('Decryption successful, decrypted size:', decrypted.length);
               console.log('First 200 bytes of decrypted data:', decrypted.slice(0, 200).toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
               console.log('Writing decrypted file to:', outputPath);
               fs.writeFileSync(outputPath, decrypted as any);

               console.log('Decryption completed successfully');
               return { success: true };

          } catch (error) {
               console.error('Decryption error:', error);
               return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown decryption error'
               };
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
          if (!settings?.encryption_enabled || !settings.key_last_rotated) {
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
          const connection = await KnexConnection(tenantId);
          return await connection(this.KEYS_TABLE)
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

     private static encryptWithMasterKey(data: Buffer): string {
          if (!this.MASTER_KEY) {
               throw new Error('BACKUP_MASTER_KEY environment variable is not set');
          }

          const key = crypto.scryptSync(this.MASTER_KEY, 'salt', 32);
          const iv = crypto.randomBytes(16);
          const cipher = crypto.createCipheriv('aes-256-cbc', key as any, iv as any);
          const encrypted = Buffer.concat([
               iv as any,
               cipher.update(data as any) as any,
               cipher.final() as any
          ]);
          return encrypted.toString('hex');
     }

     private static decryptWithMasterKey(encryptedHex: string): Buffer {
          if (!this.MASTER_KEY) {
               throw new Error('BACKUP_MASTER_KEY environment variable is not set');
          }

          const key = crypto.scryptSync(this.MASTER_KEY, 'salt', 32);
          const encrypted = Buffer.from(encryptedHex, 'hex');
          const iv = encrypted.slice(0, 16);
          const encryptedData = encrypted.slice(16);
          const decipher = crypto.createDecipheriv('aes-256-cbc', key as any, iv as any);
          const decrypted = Buffer.concat([
               decipher.update(encryptedData as any) as any,
               decipher.final() as any
          ]);
          return decrypted;
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
