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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class EncryptionManager {
    static async getEffectiveStoragePath(tenantId) {
        var _a;
        const settings = await EncryptionManager.getSecuritySettings(tenantId);
        const storagePath = (_a = settings === null || settings === void 0 ? void 0 : settings.storage_path) === null || _a === void 0 ? void 0 : _a.toString().trim();
        if (storagePath) {
            return storagePath;
        }
        throw new Error('No storage path configured. Please set a storage path in security settings.');
    }
    static async getSecuritySettings(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const settings = await connection(this.SETTINGS_TABLE)
            .where('is_active', true)
            .orderBy('created_at', 'desc')
            .first();
        return settings || null;
    }
    static async shouldEncryptBackups(tenantId) {
        const settings = await this.getSecuritySettings(tenantId);
        return !!(settings === null || settings === void 0 ? void 0 : settings.encryption_password) && settings.encryption_password.trim().length > 0;
    }
    static async updateSecuritySettings(tenantId, updates) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
                .update(Object.assign(Object.assign({}, updates), { encryption_password: updates.encryption_password === undefined
                    ? existingSettings.encryption_password
                    : (((_a = updates.encryption_password) === null || _a === void 0 ? void 0 : _a.toString().trim()) || null), updated_at: new Date() }));
            return updated > 0;
        }
        else {
            // Create new settings
            const newSettings = {
                encryption_enabled: (_b = updates.encryption_enabled) !== null && _b !== void 0 ? _b : false,
                encryption_algorithm: (_c = updates.encryption_algorithm) !== null && _c !== void 0 ? _c : 'AES-256',
                encryption_password: ((_d = updates.encryption_password) === null || _d === void 0 ? void 0 : _d.toString().trim()) || null,
                key_rotation_days: (_e = updates.key_rotation_days) !== null && _e !== void 0 ? _e : 90,
                secure_deletion_enabled: (_f = updates.secure_deletion_enabled) !== null && _f !== void 0 ? _f : false,
                deletion_passes: (_g = updates.deletion_passes) !== null && _g !== void 0 ? _g : 1,
                storage_path: ((_h = updates.storage_path) === null || _h === void 0 ? void 0 : _h.toString().trim()) || '',
                current_key_id: (_j = updates.current_key_id) !== null && _j !== void 0 ? _j : null,
                key_last_rotated: (_k = updates.key_last_rotated) !== null && _k !== void 0 ? _k : null,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            };
            await connection(this.SETTINGS_TABLE).insert(newSettings);
            return true;
        }
    }
    static async generateEncryptionKey(tenantId, createdBy, userKey) {
        const settings = await EncryptionManager.getSecuritySettings(tenantId);
        if (!settings) {
            throw new Error('Backup security settings not found. Configure security settings first');
        }
        const effectivePassword = userKey || (settings === null || settings === void 0 ? void 0 : settings.encryption_password) || '';
        if (!effectivePassword.trim()) {
            throw new Error('No encryption password configured in backup security settings');
        }
        let key;
        if (effectivePassword) {
            // Validate password used as key source
            const keyValidation = this.validateUserKey(effectivePassword);
            if (!keyValidation.valid) {
                throw new Error(`Invalid encryption password: ${keyValidation.error}`);
            }
            // Derive a proper encryption key from password using scrypt.
            key = crypto.scryptSync(effectivePassword, 'encryption-salt', 32);
        }
        else {
            // Generate random key as before
            key = crypto.randomBytes(32);
        }
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
        const settings = await EncryptionManager.getSecuritySettings(tenantId);
        if (!(settings === null || settings === void 0 ? void 0 : settings.current_key_id)) {
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
        var _a;
        try {
            const settings = await this.getSecuritySettings(tenantId);
            const configuredPassword = (_a = settings === null || settings === void 0 ? void 0 : settings.encryption_password) === null || _a === void 0 ? void 0 : _a.trim();
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
            console.log('Starting decryption for keyId:', keyId);
            console.log("MASTER_KEY is set:", !!this.MASTER_KEY, process.env.BACKUP_MASTER_KEY);
            const connection = await (0, KnexConnections_1.default)(tenantId);
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
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            console.log('Decipher created, starting decryption...');
            const decrypted = Buffer.concat([
                decipher.update(encryptedContent),
                decipher.final()
            ]);
            console.log('Decryption successful, decrypted size:', decrypted.length);
            console.log('First 200 bytes of decrypted data:', decrypted.slice(0, 200).toString('utf8').replace(/[^\x20-\x7E]/g, '.'));
            console.log('Writing decrypted file to:', outputPath);
            fs.writeFileSync(outputPath, decrypted);
            console.log('Decryption completed successfully');
            return { success: true };
        }
        catch (error) {
            console.error('Decryption error:', error);
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
        const settings = await EncryptionManager.getSecuritySettings(tenantId);
        if (!(settings === null || settings === void 0 ? void 0 : settings.encryption_enabled) || !settings.key_last_rotated) {
            return true;
        }
        const lastRotated = new Date(settings.key_last_rotated);
        const now = new Date();
        const daysSinceRotation = Math.floor((now.getTime() - lastRotated.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceRotation >= settings.key_rotation_days;
    }
    static async rotateKeyIfNeeded(tenantId, createdBy, force = false, userKey) {
        const needsRotation = force || await this.isKeyRotationNeeded(tenantId);
        if (!needsRotation)
            return { rotated: false };
        try {
            const newKeyId = await this.generateEncryptionKey(tenantId, createdBy, userKey);
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
    static encryptSecret(plaintext) {
        return this.encryptWithMasterKey(Buffer.from(plaintext, 'utf8'));
    }
    static decryptSecret(encryptedHex) {
        return this.decryptWithMasterKey(encryptedHex).toString('utf8');
    }
    static encryptWithMasterKey(data) {
        if (!this.MASTER_KEY) {
            throw new Error('BACKUP_MASTER_KEY environment variable is not set');
        }
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
        if (!this.MASTER_KEY) {
            throw new Error('BACKUP_MASTER_KEY environment variable is not set');
        }
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
    static validateStoragePath(storagePath) {
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
            }
            catch (_a) {
                return { valid: false, error: 'Storage path must be writable' };
            }
            // Additional security checks
            const normalizedPath = path.normalize(storagePath);
            // Prevent paths that go outside allowed directories (basic check)
            if (normalizedPath.includes('..') || normalizedPath.startsWith('/etc') || normalizedPath.startsWith('/bin')) {
                return { valid: false, error: 'Storage path contains potentially unsafe directory traversal' };
            }
            return { valid: true };
        }
        catch (error) {
            return { valid: false, error: `Failed to validate storage path: ${error.message}` };
        }
    }
    static validateUserKey(userKey) {
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
EncryptionManager.SETTINGS_TABLE = 'backup_security_settings';
EncryptionManager.KEYS_TABLE = 'encryption_keys';
EncryptionManager.MASTER_KEY = process.env.BACKUP_MASTER_KEY;
exports.default = EncryptionManager;
