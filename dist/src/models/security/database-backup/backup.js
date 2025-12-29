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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const encryption_1 = __importDefault(require("./encryption"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class BackupManager {
    static async create(tenantId, backup) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [id] = await connection(this.TABLE_NAME).insert(backup);
        return id;
    }
    static async findById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.TABLE_NAME).where({ id }).first();
    }
    static async findAll(tenantId, filters) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let query = connection(this.TABLE_NAME);
        if (filters) {
            if (filters.is_successful !== undefined) {
                query = query.where('is_successful', filters.is_successful);
            }
            if (filters.backup_type) {
                query = query.where('backup_type', filters.backup_type);
            }
            if (filters.backup_mode) {
                query = query.where('backup_mode', filters.backup_mode);
            }
            if (filters.count && filters.page) {
                query = query.limit(filters.count).offset((filters.page - 1) * filters.count);
            }
            if (filters.sortby) {
                query = query.orderBy('backup_date', filters.sortby);
            }
            else {
                query = query.orderBy('backup_date', 'desc');
            }
        }
        else {
            query = query.orderBy('backup_date', 'desc');
        }
        return await query;
    }
    static async update(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.TABLE_NAME).where({ id }).update(updates);
        return updated > 0;
    }
    static async delete(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const deleted = await connection(this.TABLE_NAME).where({ id }).del();
        return deleted > 0;
    }
    static async deleteBackupWithFile(tenantId, id) {
        try {
            const backup = await this.findById(tenantId, id);
            if (!backup) {
                return { success: false, error: 'Backup not found' };
            }
            // Check if secure deletion is enabled
            const securitySettings = await encryption_1.default.getSecuritySettings(tenantId);
            const useSecureDeletion = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.secure_deletion_enabled) || false;
            const deletionPasses = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.deletion_passes) || 3;
            // Delete physical file if it exists
            if (backup.backup_path && fs.existsSync(backup.backup_path)) {
                if (useSecureDeletion) {
                    const result = await encryption_1.default.secureDeleteFile(backup.backup_path, deletionPasses);
                    if (!result.success) {
                        console.warn(`Secure deletion failed for backup ${id}:`, result.error);
                        // Continue with database deletion even if file deletion fails
                    }
                }
                else {
                    fs.unlinkSync(backup.backup_path);
                }
            }
            // Delete database record
            const deleted = await this.delete(tenantId, id);
            if (!deleted) {
                return { success: false, error: 'Failed to delete backup record' };
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    static async performDatabaseBackup(tenantId, backupName, backupPath, isFullBackup = true, backupMode = 'manual', createdBy, scheduleId, encryptBackup = false) {
        const startTime = Date.now();
        try {
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `${backupName}_${timestamp}.sql`;
            const fullPath = path.join(backupPath, filename);
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const config = connection.client.config;
            let command;
            if (config.client === 'mysql' || config.client === 'mysql2') {
                const host = config.connection.host;
                const port = config.connection.port;
                const user = config.connection.user;
                const password = config.connection.password;
                const database = config.connection.database;
                // Use full path to mysqldump in XAMPP
                const mysqldumpPath = '"C:\\xampp\\mysql\\bin\\mysqldump.exe"';
                command = `${mysqldumpPath} -h ${host} -P ${port} -u ${user} --password=${password} ${database} > "${fullPath}"`;
            }
            else if (config.client === 'postgresql') {
                const host = config.connection.host;
                const port = config.connection.port;
                const user = config.connection.user;
                const password = config.connection.password;
                const database = config.connection.database;
                const env = password ? Object.assign(Object.assign({}, process.env), { PGPASSWORD: password }) : process.env;
                command = `pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${fullPath}"`;
            }
            else {
                throw new Error(`Unsupported database client: ${config.client}`);
            }
            await execAsync(command);
            const stats = fs.statSync(fullPath);
            let size = stats.size;
            const duration = Math.floor((Date.now() - startTime) / 1000);
            let finalBackupPath = fullPath;
            let encryptionKeyId;
            // Encryption enabled - backups are stored encrypted
            if (encryptBackup) {
                const encryptedPath = `${fullPath}.encrypted`;
                const encryptionResult = await encryption_1.default.encryptFile(tenantId, fullPath, encryptedPath);
                if (encryptionResult.success) {
                    // Securely delete the unencrypted file
                    await encryption_1.default.secureDeleteFile(fullPath);
                    finalBackupPath = encryptedPath;
                    encryptionKeyId = encryptionResult.keyId;
                    // Update file size to encrypted size
                    const encryptedStats = fs.statSync(finalBackupPath);
                    size = encryptedStats.size;
                }
                else {
                    // Encryption failed - attempt to clean up unencrypted file and throw error
                    try {
                        await encryption_1.default.secureDeleteFile(fullPath);
                    }
                    catch (deleteError) {
                        console.error('Failed to delete unencrypted backup file after encryption failure:', deleteError);
                        // Continue with throwing the encryption error - unencrypted file may remain but backup will be marked as failed
                    }
                    throw new Error(`Backup encryption failed: ${encryptionResult.error}`);
                }
            }
            await this.create(tenantId, {
                backup_name: backupName,
                is_successful: true,
                is_full_backup: isFullBackup,
                backup_size_bytes: size,
                backup_type: 'database',
                backup_mode: backupMode,
                backup_date: new Date(),
                backup_path: finalBackupPath,
                duration_seconds: duration,
                created_by: createdBy,
                schedule_id: scheduleId,
                encryption_key_id: encryptionKeyId
            });
            return {
                success: true,
                backupPath: finalBackupPath,
                size: size,
                duration: duration,
                encryptionKeyId: encryptionKeyId
            };
        }
        catch (error) {
            const duration = Math.floor((Date.now() - startTime) / 1000);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.create(tenantId, {
                backup_name: backupName,
                is_successful: false,
                is_full_backup: isFullBackup,
                backup_type: 'database',
                backup_mode: backupMode,
                backup_date: new Date(),
                error_message: errorMessage,
                duration_seconds: duration,
                created_by: createdBy,
                schedule_id: scheduleId
            });
            return {
                success: false,
                error: errorMessage,
                duration: duration
            };
        }
    }
    static async performFileBackup(tenantId, backupName, sourcePath, backupPath, backupMode = 'manual', createdBy, scheduleId, encryptBackup = false) {
        const startTime = Date.now();
        try {
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `${backupName}_${timestamp}.tar.gz`;
            const fullPath = path.join(backupPath, filename);
            const command = `tar -czf "${fullPath}" -C "${sourcePath}" .`;
            await execAsync(command);
            const stats = fs.statSync(fullPath);
            let size = stats.size;
            const duration = Math.floor((Date.now() - startTime) / 1000);
            let finalBackupPath = fullPath;
            let encryptionKeyId;
            // Encryption enabled - backups are stored encrypted
            if (encryptBackup) {
                const encryptedPath = `${fullPath}.encrypted`;
                const encryptionResult = await encryption_1.default.encryptFile(tenantId, fullPath, encryptedPath);
                if (encryptionResult.success) {
                    // Securely delete the unencrypted file
                    await encryption_1.default.secureDeleteFile(fullPath);
                    finalBackupPath = encryptedPath;
                    encryptionKeyId = encryptionResult.keyId;
                    // Update file size to encrypted size
                    const encryptedStats = fs.statSync(finalBackupPath);
                    size = encryptedStats.size;
                }
                else {
                    // Encryption failed - attempt to clean up unencrypted file and throw error
                    try {
                        await encryption_1.default.secureDeleteFile(fullPath);
                    }
                    catch (deleteError) {
                        console.error('Failed to delete unencrypted backup file after encryption failure:', deleteError);
                        // Continue with throwing the encryption error - unencrypted file may remain but backup will be marked as failed
                    }
                    throw new Error(`Backup encryption failed: ${encryptionResult.error}`);
                }
            }
            await this.create(tenantId, {
                backup_name: backupName,
                is_successful: true,
                is_full_backup: false,
                backup_size_bytes: size,
                backup_type: 'files',
                backup_mode: backupMode,
                backup_date: new Date(),
                backup_path: finalBackupPath,
                duration_seconds: duration,
                created_by: createdBy,
                schedule_id: scheduleId,
                encryption_key_id: encryptionKeyId
            });
            return {
                success: true,
                backupPath: finalBackupPath,
                size: size,
                duration: duration,
                encryptionKeyId: encryptionKeyId
            };
        }
        catch (error) {
            const duration = Math.floor((Date.now() - startTime) / 1000);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.create(tenantId, {
                backup_name: backupName,
                is_successful: false,
                is_full_backup: false,
                backup_type: 'files',
                backup_mode: backupMode,
                backup_date: new Date(),
                error_message: errorMessage,
                duration_seconds: duration,
                created_by: createdBy,
                schedule_id: scheduleId
            });
            return {
                success: false,
                error: errorMessage,
                duration: duration
            };
        }
    }
    static async getBackupStats(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const stats = await connection(this.TABLE_NAME)
            .select(connection.raw('COUNT(*) as total_backups'), connection.raw('SUM(CASE WHEN is_successful = 1 THEN 1 ELSE 0 END) as successful_backups'), connection.raw('SUM(CASE WHEN is_successful = 0 THEN 1 ELSE 0 END) as failed_backups'), connection.raw('COALESCE(SUM(CASE WHEN is_successful = 1 THEN backup_size_bytes ELSE 0 END), 0) as total_size'), connection.raw('MAX(backup_date) as last_backup_date'))
            .first();
        return {
            total_backups: parseInt(stats.total_backups) || 0,
            successful_backups: parseInt(stats.successful_backups) || 0,
            failed_backups: parseInt(stats.failed_backups) || 0,
            total_size: parseInt(stats.total_size) || 0,
            last_backup_date: stats.last_backup_date ? new Date(stats.last_backup_date) : undefined
        };
    }
    // Backup Schedule Management
    static async createBackupSchedule(tenantId, schedule) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const [id] = await connection(this.SCHEDULES_TABLE_NAME).insert(schedule);
        return id;
    }
    static async findBackupScheduleById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(this.SCHEDULES_TABLE_NAME)
            .select([
            `${this.SCHEDULES_TABLE_NAME}.*`,
            'roles.username',
            'roles.email'
        ])
            .leftJoin('roles', `${this.SCHEDULES_TABLE_NAME}.employeeid`, 'roles.employeeid')
            .where({ [`${this.SCHEDULES_TABLE_NAME}.id`]: id })
            .first();
    }
    static async findAllBackupSchedules(tenantId, filters) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let query = connection(this.SCHEDULES_TABLE_NAME)
            .select([
            `${this.SCHEDULES_TABLE_NAME}.*`,
            'roles.username',
            'roles.email'
        ])
            .leftJoin('roles', `${this.SCHEDULES_TABLE_NAME}.employeeid`, 'roles.employeeid')
            .orderBy(`${this.SCHEDULES_TABLE_NAME}.created_at`, 'desc');
        if (filters) {
            if (filters.employeeid) {
                query = query.where(`${this.SCHEDULES_TABLE_NAME}.employeeid`, filters.employeeid);
            }
            if (filters.is_active !== undefined) {
                query = query.where(`${this.SCHEDULES_TABLE_NAME}.is_active`, filters.is_active);
            }
            if (filters.backup_type) {
                query = query.where(`${this.SCHEDULES_TABLE_NAME}.backup_type`, filters.backup_type);
            }
            if (filters.count && filters.page) {
                query = query.limit(filters.count).offset((filters.page - 1) * filters.count);
            }
            if (filters.sortby) {
                query = query.orderBy(`${this.SCHEDULES_TABLE_NAME}.created_at`, filters.sortby);
            }
        }
        return await query;
    }
    static async updateBackupSchedule(tenantId, id, updates) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const updated = await connection(this.SCHEDULES_TABLE_NAME).where({ id }).update(updates);
        return updated > 0;
    }
    static async deleteBackupSchedule(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const deleted = await connection(this.SCHEDULES_TABLE_NAME).where({ id }).del();
        return deleted > 0;
    }
    static async getDueSchedules(tenantId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentDate = now.getDate();
        // Get schedules that are due
        const schedules = await connection(this.SCHEDULES_TABLE_NAME)
            .where('is_active', true)
            .andWhere('backup_time', '<=', currentTime);
        // Filter based on frequency
        const dueSchedules = schedules.filter(schedule => {
            const lastRun = schedule.last_run ? new Date(schedule.last_run) : null;
            switch (schedule.frequency) {
                case 'hourly':
                    // Run if not run in the current hour
                    if (!lastRun)
                        return true;
                    const lastRunHour = lastRun.getHours();
                    const currentHour = now.getHours();
                    return lastRunHour !== currentHour;
                case 'daily':
                    // Run if not run today
                    if (!lastRun)
                        return true;
                    const lastRunDate = lastRun.toDateString();
                    const todayDate = now.toDateString();
                    return lastRunDate !== todayDate;
                case 'weekly':
                    // Run if not run this week (same day of week)
                    if (!lastRun)
                        return true;
                    const daysSinceLastRun = Math.floor((now.getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24));
                    return daysSinceLastRun >= 7 && lastRun.getDay() === currentDay;
                case 'monthly':
                    // Run if not run this month (same date)
                    if (!lastRun)
                        return true;
                    return lastRun.getMonth() !== now.getMonth() && lastRun.getDate() === currentDate;
                default:
                    return false;
            }
        });
        return dueSchedules;
    }
    static async executeScheduledBackup(tenantId, mode, scheduleId) {
        const schedule = await this.findBackupScheduleById(tenantId, scheduleId);
        if (!schedule) {
            return { success: false, error: 'Schedule not found' };
        }
        try {
            let result;
            const backupName = `${schedule.schedule_name}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
            const backupPath = await encryption_1.default.getEffectiveStoragePath(tenantId);
            const encryptBackup = true; // Encryption enabled
            result = await this.performDatabaseBackup(tenantId, backupName, backupPath, true, mode, `schedule_${scheduleId}`, scheduleId, encryptBackup);
            // Update last run time
            await this.updateBackupSchedule(tenantId, scheduleId, {
                last_run: new Date()
            });
            // Clean up old backups
            await this.cleanupOldBackups(tenantId, backupPath, schedule.retention_days);
            return {
                success: result.success,
                backupPath: result.backupPath,
                error: result.error
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    static async cleanupOldBackups(tenantId, backupPath, retentionDays) {
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            // Get old backup logs
            const oldBackups = await connection(this.TABLE_NAME)
                .where('backup_path', 'like', `${backupPath}%`)
                .andWhere('backup_date', '<', cutoffDate)
                .andWhere('is_successful', true);
            // Check if secure deletion is enabled
            const securitySettings = await encryption_1.default.getSecuritySettings(tenantId);
            const useSecureDeletion = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.secure_deletion_enabled) || false;
            const deletionPasses = (securitySettings === null || securitySettings === void 0 ? void 0 : securitySettings.deletion_passes) || 3;
            // Delete physical files and database records
            for (const backup of oldBackups) {
                try {
                    if (backup.backup_path && fs.existsSync(backup.backup_path)) {
                        if (useSecureDeletion) {
                            await encryption_1.default.secureDeleteFile(backup.backup_path, deletionPasses);
                        }
                        else {
                            fs.unlinkSync(backup.backup_path);
                        }
                    }
                    await this.delete(tenantId, backup.id);
                }
                catch (error) {
                    console.error(`Failed to cleanup backup ${backup.id}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Error during backup cleanup:', error);
        }
    }
    static async runScheduledBackups(tenantId, mode) {
        const dueSchedules = await this.getDueSchedules(tenantId);
        const results = [];
        let successful = 0;
        let failed = 0;
        for (const schedule of dueSchedules) {
            const result = await this.executeScheduledBackup(tenantId, mode, schedule.id);
            results.push({
                scheduleId: schedule.id,
                success: result.success,
                error: result.error
            });
            if (result.success) {
                successful++;
            }
            else {
                failed++;
            }
        }
        return {
            processed: dueSchedules.length,
            successful,
            failed,
            results
        };
    }
}
BackupManager.TABLE_NAME = 'backup_logs';
BackupManager.SCHEDULES_TABLE_NAME = 'backup_schedules';
exports.default = BackupManager;
