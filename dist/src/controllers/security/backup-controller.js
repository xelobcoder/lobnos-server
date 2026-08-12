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
exports.BackupController = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const backup_1 = __importDefault(require("../../models/security/database-backup/backup"));
const encryption_1 = __importDefault(require("../../models/security/database-backup/encryption"));
const backup_validators_1 = require("../../utils/backup-validators");
class BackupController {
    static async createDatabaseBackup(req, res) {
        var _a, _b;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { backupName, isFullBackup = true, backupMode, createdBy } = req.body;
            let finalBackupMode = backupMode;
            if (!backupMode) {
                finalBackupMode = 'manual';
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const uniqueBackupName = `${backupName}_${timestamp}`;
            const configuredBackupPath = await encryption_1.default.getEffectiveStoragePath(tenantId);
            const validation = backup_validators_1.BackupValidators.validateCreateDatabaseBackup({
                backupName: uniqueBackupName,
                backupPath: configuredBackupPath,
                isFullBackup,
                backupMode: finalBackupMode,
                createdBy
            });
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            const encryptBackup = await encryption_1.default.shouldEncryptBackups(tenantId);
            const result = await backup_1.default.performDatabaseBackup(tenantId, validation.data.backupName, validation.data.backupPath, (_b = validation.data.isFullBackup) !== null && _b !== void 0 ? _b : true, finalBackupMode, validation.data.createdBy, undefined, encryptBackup);
            if (result.success) {
                res.json({
                    status: true,
                    message: encryptBackup
                        ? 'Database backup completed successfully (encrypted - downloads as .encrypted file)'
                        : 'Database backup completed successfully',
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
            const isEncrypted = !!backup.encryption_key_id;
            let downloadPath = backup.backup_path;
            let downloadName = path.basename(backup.backup_path);
            let tempDecryptedFile = null;
            if (req.query.decrypt === 'true' && isEncrypted && backup.encryption_key_id) {
                const decryptedPath = `${backup.backup_path}.decrypted`;
                const decryptResult = await encryption_1.default.decryptFile(tenantId, backup.backup_path, decryptedPath, backup.encryption_key_id);
                if (decryptResult.success) {
                    downloadPath = decryptedPath;
                    tempDecryptedFile = decryptedPath;
                    downloadName = downloadName.replace(/\.encrypted$/, '');
                }
                else {
                    return res.status(500).json({
                        status: false,
                        error: `Failed to decrypt backup: ${decryptResult.error}`
                    });
                }
            }
            if (backup.backup_type === 'database') {
                if (!downloadName.endsWith('.sql')) {
                    downloadName += '.sql';
                }
            }
            else if (backup.backup_type === 'files') {
                if (!downloadName.endsWith('.tar.gz')) {
                    downloadName += '.tar.gz';
                }
            }
            const fileStats = fs.statSync(downloadPath);
            res.setHeader('Content-Length', fileStats.size);
            const sanitizedName = downloadName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const contentDisposition = `attachment; filename="${sanitizedName}"`;
            res.setHeader('Content-Disposition', contentDisposition);
            res.setHeader('X-Filename', sanitizedName);
            res.setHeader('Access-Control-Expose-Headers', 'content-disposition, content-type');
            if (req.query.decrypt === 'true' && tempDecryptedFile) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            else if (isEncrypted) {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            else if (backup.backup_type === 'database') {
                res.setHeader('Content-Type', 'application/sql');
            }
            else if (backup.backup_type === 'files') {
                res.setHeader('Content-Type', 'application/gzip');
            }
            else {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            const fileStream = fs.createReadStream(downloadPath);
            fileStream.pipe(res);
            fileStream.on('error', (error) => {
                if (!res.headersSent) {
                    res.status(500).json({
                        status: false,
                        error: 'Error streaming file'
                    });
                }
            });
            fileStream.on('end', () => {
                if (tempDecryptedFile && fs.existsSync(tempDecryptedFile)) {
                    try {
                        fs.unlinkSync(tempDecryptedFile);
                    }
                    catch (cleanupError) {
                    }
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
    static async createBackupSchedule(req, res) {
        var _a;
        try {
            const tenantId = parseInt(req.query.tenantId);
            const scheduleData = req.body;
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
            const validation = backup_validators_1.BackupValidators.validateUpdateBackupSchedule(updates);
            if (!validation.success) {
                return res.status(400).json({
                    status: false,
                    error: 'Validation failed',
                    details: ((_a = validation.error) === null || _a === void 0 ? void 0 : _a.errors.map(e => e.message)) || ['Unknown validation error']
                });
            }
            const success = await backup_1.default.updateBackupSchedule(tenantId, parseInt(id.toString()), validation.data);
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
            const success = await backup_1.default.deleteBackupSchedule(tenantId, parseInt(id.toString()));
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
            const result = await backup_1.default.executeScheduledBackup(tenantId, "manual", parseInt(id.toString()));
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
            console.log(error);
            res.status(500).json({
                status: false,
                error: error.message
            });
        }
    }
    static async runScheduledBackups(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const result = await backup_1.default.runScheduledBackups(tenantId, "automated");
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
    static async deleteBackup(req, res) {
        try {
            const tenantId = parseInt(req.query.tenantId);
            const { id } = req.params;
            const result = await backup_1.default.deleteBackupWithFile(tenantId, parseInt(id.toString()));
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
