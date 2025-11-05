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
exports.BackupController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const backup_1 = __importDefault(require("../../models/security/database-backup/backup"));
const encryption_1 = __importDefault(require("../../models/security/database-backup/encryption"));
const backup_validators_1 = require("../../utils/backup-validators");
class BackupController {
    static async createDatabaseBackup(req, res) {
        var _a, _b, _c;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { backupName, backupPath, isFullBackup = true, backupMode = 'manual', createdBy } = req.body;
            // Generate unique backup name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const uniqueBackupName = `${backupName}_${timestamp}`;
            // Validation using Zod
            const validation = backup_validators_1.BackupValidators.validateCreateDatabaseBackup({
                backupName: uniqueBackupName,
                backupPath,
                isFullBackup,
                backupMode,
                createdBy
            });
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            // Check if encryption is enabled in security settings
            const securitySettings = await encryption_1.default.getSecuritySettings(tenantId);
            const encryptBackup = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.encryption_enabled) || false;
            const result = await backup_1.default.performDatabaseBackup(tenantId, validation.data.backupName, validation.data.backupPath, (_b = validation.data.isFullBackup) !== null && _b !== void 0 ? _b : true, (_c = validation.data.backupMode) !== null && _c !== void 0 ? _c : 'manual', validation.data.createdBy, undefined, // scheduleId
            encryptBackup);
            if (result.success) {
                res.json({
                    status: true,
                    message: 'Database backup completed successfully',
                    data: {
                        backupPath: result.backupPath,
                        size: result.size,
                        duration: result.duration,
                        encrypted: encryptBackup,
                        keyId: result.encryptionKeyId
                    }
                });
            }
            else {
                res.status(500).json({
                    status: false,
                    error: result.error,
                    duration: result.duration
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
    static async createFileBackup(req, res) {
        var _a, _b;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { backupName, sourcePath, backupPath, backupMode = 'manual', createdBy } = req.body;
            // Generate unique backup name with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const uniqueBackupName = `${backupName}_${timestamp}`;
            // Validation using Zod
            const validation = backup_validators_1.BackupValidators.validateCreateFileBackup({
                backupName: uniqueBackupName,
                sourcePath,
                backupPath,
                backupMode,
                createdBy
            });
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            // Check if encryption is enabled in security settings
            const securitySettings = await encryption_1.default.getSecuritySettings(tenantId);
            const encryptBackup = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.encryption_enabled) || false;
            const result = await backup_1.default.performFileBackup(tenantId, validation.data.backupName, validation.data.sourcePath, validation.data.backupPath, (_b = validation.data.backupMode) !== null && _b !== void 0 ? _b : 'manual', validation.data.createdBy, undefined, // scheduleId
            encryptBackup);
            if (result.success) {
                res.json({
                    status: true,
                    message: 'File backup completed successfully',
                    data: {
                        backupPath: result.backupPath,
                        size: result.size,
                        duration: result.duration,
                        encrypted: encryptBackup,
                        keyId: result.encryptionKeyId
                    }
                });
            }
            else {
                res.status(500).json({
                    status: false,
                    error: result.error,
                    duration: result.duration
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
    static async getBackupLogs(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { is_successful, backup_type, backup_mode, count = 10, page = 1, sortby = "DESC" } = req.query;
            const filters = {};
            if (is_successful !== undefined) {
                filters.is_successful = is_successful === 'true';
            }
            if (backup_type) {
                filters.backup_type = backup_type;
            }
            if (backup_mode) {
                filters.backup_mode = backup_mode;
            }
            filters.count = parseInt(count);
            filters.page = parseInt(page);
            filters.sortby = sortby;
            const backups = await backup_1.default.findAll(tenantId, filters);
            res.json({
                status: true,
                data: backups
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getBackupById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const backup = await backup_1.default.findById(tenantId, parseInt(id));
            if (backup) {
                res.json({
                    status: true,
                    data: backup
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Backup not found'
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
    static async getBackupStats(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const stats = await backup_1.default.getBackupStats(tenantId);
            res.json({
                status: true,
                data: stats
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async downloadBackup(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
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
            // Check if file is encrypted
            const isEncrypted = backup.backup_path.endsWith('.encrypted');
            let downloadPath = backup.backup_path;
            let downloadName = path.basename(backup.backup_path);
            if (isEncrypted) {
                // For encrypted files, suggest a .bin extension so Windows doesn't try to "open" it
                downloadName = downloadName.replace('.encrypted', '.bin');
            }
            else if (backup.backup_type === 'database') {
                // Ensure SQL files have .sql extension
                if (!downloadName.endsWith('.sql')) {
                    downloadName += '.sql';
                }
            }
            else if (backup.backup_type === 'files') {
                // Ensure file backups have .tar.gz extension
                if (!downloadName.endsWith('.tar.gz')) {
                    downloadName += '.tar.gz';
                }
            }
            // Set appropriate headers
            const fileStats = fs.statSync(backup.backup_path);
            res.setHeader('Content-Length', fileStats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
            // Set content type based on file type
            if (isEncrypted) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            else if (backup.backup_type === 'database') {
                res.setHeader('Content-Type', 'application/sql');
            }
            else if (backup.backup_type === 'files') {
                res.setHeader('Content-Type', 'application/gzip');
            }
            // Stream the file
            const fileStream = fs.createReadStream(backup.backup_path);
            fileStream.pipe(res);
            fileStream.on('error', (error) => {
                console.error('File stream error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        status: false,
                        error: 'Error streaming file'
                    });
                }
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    // Backup Schedule Management Endpoints
    static async createBackupSchedule(req, res) {
        var _a;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const scheduleData = req.body;
            // Validation using Zod
            const validation = backup_validators_1.BackupValidators.validateCreateBackupSchedule(scheduleData);
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            const scheduleId = await backup_1.default.createBackupSchedule(tenantId, validation.data);
            res.status(201).json({
                status: true,
                message: 'Backup schedule created successfully',
                data: { id: scheduleId }
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getBackupSchedules(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { employeeid, is_active, backup_type, count = 50, sortby = "ASC", page = 1 } = req.query;
            const filters = {};
            if (employeeid) {
                filters.employeeid = parseInt(employeeid);
            }
            if (is_active !== undefined) {
                filters.is_active = is_active === 'true';
            }
            if (backup_type) {
                filters.backup_type = backup_type;
            }
            filters.count = parseInt(count);
            filters.page = parseInt(page);
            filters.sortby = sortby;
            const schedules = await backup_1.default.findAllBackupSchedules(tenantId, filters);
            res.json({
                status: true,
                data: schedules
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async getBackupScheduleById(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const schedule = await backup_1.default.findBackupScheduleById(tenantId, parseInt(id));
            if (schedule) {
                res.json({
                    status: true,
                    data: schedule
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Backup schedule not found'
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
    static async updateBackupSchedule(req, res) {
        var _a;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const updates = req.body;
            // Validation using Zod
            const validation = backup_validators_1.BackupValidators.validateUpdateBackupSchedule(updates);
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            const success = await backup_1.default.updateBackupSchedule(tenantId, parseInt(id), validation.data);
            if (success) {
                res.json({
                    status: true,
                    message: 'Backup schedule updated successfully'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Backup schedule not found'
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
    static async deleteBackupSchedule(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const success = await backup_1.default.deleteBackupSchedule(tenantId, parseInt(id));
            if (success) {
                res.json({
                    status: true,
                    message: 'Backup schedule deleted successfully'
                });
            }
            else {
                res.status(404).json({
                    status: false,
                    error: 'Backup schedule not found'
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
    static async executeScheduledBackup(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const result = await backup_1.default.executeScheduledBackup(tenantId, parseInt(id));
            if (result.success) {
                res.json({
                    status: true,
                    message: 'Scheduled backup executed successfully',
                    data: {
                        backupPath: result.backupPath
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
    static async runScheduledBackups(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const result = await backup_1.default.runScheduledBackups(tenantId);
            res.json({
                status: true,
                message: 'Scheduled backups processed',
                data: {
                    processed: result.processed,
                    successful: result.successful,
                    failed: result.failed,
                    results: result.results
                }
            });
        }
        catch (error) {
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    // Encryption and Security Endpoints
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
            const { createdBy } = req.body;
            const result = await encryption_1.default.rotateKeyIfNeeded(tenantId, createdBy);
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
            // For now, we'll assume the key ID is stored in the backup record or we need to determine it
            // In a real implementation, you'd store the encryption key ID with the backup
            const keyId = 'KEY-2025-001'; // This should be retrieved from backup metadata
            const finalOutputPath = outputPath || backup.backup_path.replace('.encrypted', '_decrypted');
            const result = await encryption_1.default.decryptFile(tenantId, backup.backup_path, finalOutputPath, keyId);
            if (result.success) {
                res.json({
                    status: true,
                    message: 'Backup decrypted successfully',
                    data: {
                        outputPath: finalOutputPath
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
    static async deleteBackup(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const result = await backup_1.default.deleteBackupWithFile(tenantId, parseInt(id));
            if (result.success) {
                res.json({
                    status: true,
                    message: 'Backup deleted successfully'
                });
            }
            else {
                res.status(404).json({
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
exports.BackupController = BackupController;
