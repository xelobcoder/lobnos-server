"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
class EncryptionManager {
    static async getSecuritySettings(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const settings = await connection(this.SETTINGS_TABLE)
            .where('is_active', true)
            .orderBy('created_at', 'desc')
            .first();
        return settings || null;
    }
    static async updateSecuritySettings(tenantId, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.SETTINGS_TABLE)
            .where('is_active', true)
            .update(Object.assign(Object.assign({}, updates), { updated_at: new Date() }));
        return updated > 0;
    }
    static async generateEncryptionKey(tenantId, createdBy) {
        const settings = await this.getSecuritySettings(tenantId);
        if (!(settings === null || settings === void 0 ? void 0 : settings.encryption_enabled)) {
            throw new Error('Encryption is not enabled');
        }
        const key = crypto.randomBytes(32);
        const keyId = `KEY-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        const encryptedKey = this.encryptWithMasterKey(key);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (settings.key_rotation_days || 90));
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
    static async getActiveEncryptionKey(tenantId) {
        const settings = await this.getSecuritySettings(tenantId);
        if (!(settings === null || settings === void 0 ? void 0 : settings.encryption_enabled) || !settings.current_key_id) {
            return null;
        }
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
    static async encryptFile(tenantId, inputPath, outputPath) {
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
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            const encrypted = Buffer.concat([
                iv,
                cipher.update(fileData),
                cipher.final()
            ]);
            fs.writeFileSync(outputPath, encrypted);
            return { success: true, keyId };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown encryption error'
            };
        }
    }
    static async decryptFile(tenantId, inputPath, outputPath, keyId) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
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
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            const decrypted = Buffer.concat([
                decipher.update(encryptedContent),
                decipher.final()
            ]);
            fs.writeFileSync(outputPath, decrypted);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown decryption error'
            };
        }
    }
    static async secureDeleteFile(filePath, passes = 3) {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'File does not exist' };
            }
            const stats = fs.statSync(filePath);
            const fileSize = stats.size;
            for (let pass = 0; pass < passes; pass++) {
                const pattern = this.getOverwritePattern(pass);
                const data = Buffer.alloc(fileSize, pattern);
                fs.writeFileSync(filePath, data);
            }
            fs.unlinkSync(filePath);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Secure deletion failed'
            };
        }
    }
    static async isKeyRotationNeeded(tenantId) {
        const settings = await this.getSecuritySettings(tenantId);
        if (!(settings === null || settings === void 0 ? void 0 : settings.encryption_enabled) || !settings.key_last_rotated) {
            return true;
        }
        const lastRotated = new Date(settings.key_last_rotated);
        const now = new Date();
        const daysSinceRotation = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceRotation >= settings.key_rotation_days;
    }
    static async rotateKeyIfNeeded(tenantId, createdBy) {
        const needsRotation = await this.isKeyRotationNeeded(tenantId);
        if (!needsRotation) {
            return { rotated: false };
        }
        try {
            const newKeyId = await this.generateEncryptionKey(tenantId, createdBy);
            return { rotated: true, newKeyId };
        }
        catch (error) {
            return {
                rotated: false,
                error: error instanceof Error ? error.message : 'Key rotation failed'
            };
        }
    }
    static async getAllEncryptionKeys(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.KEYS_TABLE)
            .orderBy('created_at', 'desc');
    }
    static async deactivateKey(tenantId, keyId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.KEYS_TABLE)
            .where('key_id', keyId)
            .update({
            is_active: false,
            deactivated_at: new Date()
        });
        return updated > 0;
    }
    static encryptWithMasterKey(data) {
        const key = crypto.scryptSync(this.MASTER_KEY, 'salt', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        const encrypted = Buffer.concat([
            iv,
            cipher.update(data),
            cipher.final()
        ]);
        return encrypted.toString('hex');
    }
    static decryptWithMasterKey(encryptedHex) {
        const key = crypto.scryptSync(this.MASTER_KEY, 'salt', 32);
        const encrypted = Buffer.from(encryptedHex, 'hex');
        const iv = encrypted.slice(0, 16);
        const encryptedData = encrypted.slice(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
        return decrypted;
    }
    static getOverwritePattern(pass) {
        const patterns = [0x00, 0xFF, 0x55, 0xAA];
        return patterns[pass % patterns.length];
    }
}
EncryptionManager.SETTINGS_TABLE = 'backup_security_settings';
EncryptionManager.KEYS_TABLE = 'encryption_keys';
EncryptionManager.MASTER_KEY = process.env.BACKUP_MASTER_KEY || 'default-master-key-change-in-production';
exports.default = EncryptionManager;
