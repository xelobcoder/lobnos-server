import KnexConnection from "../../../database/KnexConnections";
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface BackupSecuritySettings {
     id?: number;
     encryption_enabled: boolean;
     encryption_algorithm: string;
     key_rotation_days: number;
     secure_deletion_enabled: boolean;
     deletion_passes: number;
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
     private static readonly MASTER_KEY = process.env.BACKUP_MASTER_KEY || 'default-master-key-change-in-production';

     static async getSecuritySettings(tenantId: number): Promise<BackupSecuritySettings | null> {
          const connection = await KnexConnection(tenantId);
          const settings = await connection(this.SETTINGS_TABLE)
               .where('is_active', true)
               .orderBy('created_at', 'desc')
               .first();

          return settings || null;
     }

     static async updateSecuritySettings(tenantId: number, updates: Partial<BackupSecuritySettings>): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection(this.SETTINGS_TABLE)
               .where('is_active', true)
               .update({
                    ...updates,
                    updated_at: new Date()
               });

          return updated > 0;
     }

     static async generateEncryptionKey(tenantId: number, createdBy?: string): Promise<string> {
          const settings = await this.getSecuritySettings(tenantId);
          if (!settings?.encryption_enabled) {
               throw new Error('Encryption is not enabled');
          }

          const key = crypto.randomBytes(32);
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
          const settings = await this.getSecuritySettings(tenantId);
          if (!settings?.encryption_enabled || !settings.current_key_id) {
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
               let keyInfo = await this.getActiveEncryptionKey(tenantId);

               // If no active key exists, generate one automatically
               if (!keyInfo) {
                    console.log('No active encryption key found, generating new key...');
                    const newKeyId = await this.generateEncryptionKey(tenantId, 'system');
                    console.log(`Generated new encryption key: ${newKeyId}`);

                    // Try to get the key again
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
               const connection = await KnexConnection(tenantId);
               const keyRecord = await connection(this.KEYS_TABLE)
                    .where('key_id', keyId)
                    .first();

               if (!keyRecord) {
                    return { success: false, error: 'Encryption key not found' };
               }

               const key = this.decryptWithMasterKey(keyRecord.encrypted_key);

               const encryptedData = fs.readFileSync(inputPath);

               const iv = encryptedData.slice(0, 16);
               const encryptedContent = encryptedData.slice(16);

               const decipher = crypto.createDecipheriv('aes-256-cbc', key as any, iv as any);
               const decrypted = Buffer.concat([
                    decipher.update(encryptedContent as any) as any,
                    decipher.final() as any
               ]);

               fs.writeFileSync(outputPath, decrypted as any);

               return { success: true };

          } catch (error) {
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
          const settings = await this.getSecuritySettings(tenantId);
          if (!settings?.encryption_enabled || !settings.key_last_rotated) {
               return true;
          }

          const lastRotated = new Date(settings.key_last_rotated);
          const now = new Date();
          const daysSinceRotation = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));

          return daysSinceRotation >= settings.key_rotation_days;
     }

     static async rotateKeyIfNeeded(tenantId: number, createdBy?: string): Promise<{ rotated: boolean; newKeyId?: string; error?: string }> {
          const needsRotation = await this.isKeyRotationNeeded(tenantId);
          if (!needsRotation) {
               return { rotated: false };
          }

          try {
               const newKeyId = await this.generateEncryptionKey(tenantId, createdBy);
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

     private static encryptWithMasterKey(data: Buffer): string {
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
}
