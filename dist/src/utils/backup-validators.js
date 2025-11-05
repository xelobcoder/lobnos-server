"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupValidators = exports.UpdateBackupScheduleSchema = exports.CreateBackupScheduleSchema = exports.CreateFileBackupSchema = exports.CreateDatabaseBackupSchema = void 0;
// src/utils/backup-validators.ts
const zod_1 = require("zod");
// Zod schemas for backup validation
exports.CreateDatabaseBackupSchema = zod_1.z.object({
    backupName: zod_1.z.string().min(1, 'backupName is required and must be a non-empty string'),
    backupPath: zod_1.z.string().startsWith('/', 'backupPath is required and must be an absolute path starting with /'),
    isFullBackup: zod_1.z.boolean().optional(),
    backupMode: zod_1.z.enum(['automated', 'manual']).optional(),
    createdBy: zod_1.z.string().optional(),
});
exports.CreateFileBackupSchema = zod_1.z.object({
    backupName: zod_1.z.string().min(1, 'backupName is required and must be a non-empty string'),
    sourcePath: zod_1.z.string().startsWith('/', 'sourcePath is required and must be an absolute path starting with /'),
    backupPath: zod_1.z.string().startsWith('/', 'backupPath is required and must be an absolute path starting with /'),
    backupMode: zod_1.z.enum(['automated', 'manual']).optional(),
    createdBy: zod_1.z.string().optional(),
});
exports.CreateBackupScheduleSchema = zod_1.z.object({
    schedule_name: zod_1.z.string().min(1, 'schedule_name is required and must be a non-empty string'),
    frequency: zod_1.z.enum(['hourly', 'daily', 'weekly', 'monthly'], {
        errorMap: () => ({ message: 'frequency is required and must be one of: hourly, daily, weekly, monthly' })
    }),
    backup_time: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'backup_time must be in HH:MM format (24-hour clock)'),
    retention_days: zod_1.z.number().int().min(1, 'retention_days is required and must be a positive integer'),
    employeeid: zod_1.z.number().int().min(1, 'employeeid is required and must be a positive integer'),
    backup_path: zod_1.z.string().startsWith('/', 'backup_path must be an absolute path starting with / if provided').optional(),
    backup_type: zod_1.z.enum(['database', 'files', 'full_system'], {
        errorMap: () => ({ message: 'backup_type is required and must be one of: database, files, full_system' })
    }),
    database_name: zod_1.z.string().optional(),
    source_path: zod_1.z.string().startsWith('/').optional(),
    is_active: zod_1.z.boolean().optional(),
}).refine((data) => {
    if (data.backup_type === 'files' && !data.source_path) {
        return false;
    }
    return true;
}, {
    message: 'source_path is required when backup_type is files and must be an absolute path starting with /',
    path: ['source_path']
});
exports.UpdateBackupScheduleSchema = zod_1.z.object({
    schedule_name: zod_1.z.string().min(1, 'schedule_name must be a non-empty string if provided').optional(),
    frequency: zod_1.z.enum(['hourly', 'daily', 'weekly', 'monthly'], {
        errorMap: () => ({ message: 'frequency must be one of: hourly, daily, weekly, monthly if provided' })
    }).optional(),
    backup_time: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'backup_time must be in HH:MM format (24-hour clock)').optional(),
    retention_days: zod_1.z.number().int().min(1, 'retention_days must be a positive integer if provided').optional(),
    employeeid: zod_1.z.number().int().min(1, 'employeeid must be a positive integer if provided').optional(),
    backup_path: zod_1.z.string().startsWith('/', 'backup_path must be an absolute path starting with / if provided').optional(),
    backup_type: zod_1.z.enum(['database', 'files', 'full_system'], {
        errorMap: () => ({ message: 'backup_type must be one of: database, files, full_system if provided' })
    }).optional(),
    database_name: zod_1.z.string().optional(),
    source_path: zod_1.z.string().startsWith('/').optional(),
    is_active: zod_1.z.boolean().optional(),
});
// Validation functions
class BackupValidators {
    static validateCreateDatabaseBackup(data) {
        const result = exports.CreateDatabaseBackupSchema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return { success: false, error: result.error };
        }
    }
    static validateCreateFileBackup(data) {
        const result = exports.CreateFileBackupSchema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return { success: false, error: result.error };
        }
    }
    static validateCreateBackupSchedule(data) {
        const result = exports.CreateBackupScheduleSchema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return { success: false, error: result.error };
        }
    }
    static validateUpdateBackupSchedule(data) {
        const result = exports.UpdateBackupScheduleSchema.safeParse(data);
        if (result.success) {
            return { success: true, data: result.data };
        }
        else {
            return { success: false, error: result.error };
        }
    }
}
exports.BackupValidators = BackupValidators;
