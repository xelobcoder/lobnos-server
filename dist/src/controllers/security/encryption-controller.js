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
exports.EncryptionController = void 0;
const fs = __importStar(require("fs"));
const backup_1 = __importDefault(require("../../models/security/database-backup/backup"));
const encryption_1 = __importDefault(require("../../models/security/database-backup/encryption"));
class EncryptionController {
    static async getSecuritySettings(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const settings = await encryption_1.default.getSecuritySettings(tenantId);
            res.json({
                status: true,
                data: settings
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async updateSecuritySettings(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const updates = req.body;
            const success = await encryption_1.default.updateSecuritySettings(tenantId, updates);
            if (success) {
                res.json({
                    status: true,
                    message: 'Security settings updated successfully'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Security settings not found'
                });
            }
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async generateEncryptionKey(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { createdBy } = req.body;
            const keyId = await encryption_1.default.generateEncryptionKey(tenantId, createdBy);
            res.status(201).json({
                status: true,
                message: 'Encryption key generated successfully',
                data: { keyId }
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getEncryptionKeys(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const keys = await encryption_1.default.getAllEncryptionKeys(tenantId);
            res.json({
                status: true,
                data: keys
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async rotateEncryptionKey(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { createdBy, force } = req.body;
            const result = await encryption_1.default.rotateKeyIfNeeded(tenantId, createdBy, force);
            res.json({
                status: true,
                data: result
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async decryptBackup(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const { outputPath } = req.body;
            const backup = await backup_1.default.findById(tenantId, parseInt(id));
            if (!backup) {
                return res.status(404).json({
                    status: false,
                    error: 'Backup not found'
                });
            }
            if (!backup.backup_path || !fs.existsSync(backup.backup_path)) {
                return res.status(404).json({
                    status: false,
                    error: 'Backup file not found'
                });
            }
            // Check if the backup is encrypted
            const isEncrypted = backup.backup_path.endsWith('.encrypted');
            if (!isEncrypted) {
                return res.status(400).json({
                    status: false,
                    error: 'Backup is not encrypted'
                });
            }
            let keyId;
            // First try to get the key ID from the backup record (for backups created after this fix)
            if (backup.encryption_key_id) {
                keyId = backup.encryption_key_id;
            }
            else {
                // Fallback to current active key for older backups
                const keyInfo = await encryption_1.default.getActiveEncryptionKey(tenantId);
                if (!keyInfo) {
                    return res.status(500).json({
                        status: false,
                        error: 'No active encryption key found'
                    });
                }
                keyId = keyInfo.keyId;
            }
            const finalOutputPath = outputPath || backup.backup_path.replace('.encrypted', '_decrypted');
            const result = await encryption_1.default.decryptFile(tenantId, backup.backup_path, finalOutputPath, keyId);
            if (result.success) {
                res.json({
                    status: true,
                    message: 'Backup decrypted successfully',
                    data: {
                        outputPath: finalOutputPath,
                        keyId: keyId
                    }
                });
            }
            else {
                res.status(500).json({
                    status: false,
                    error: result.error
                });
            }
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
}
exports.EncryptionController = EncryptionController;
