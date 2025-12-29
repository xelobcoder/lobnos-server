// src/utils/backup-validators.ts
import { z } from 'zod';

// Zod schemas for backup validation
export const CreateDatabaseBackupSchema = z.object({
     backupName: z.string().min(1, 'backupName is required and must be a non-empty string'),
     backupPath: z.string().refine((path) => {
          // Allow Unix absolute paths (starting with /) or Windows absolute paths (like C:\ or D:\)
          return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path);
     }, 'backupPath is required and must be an absolute path (starting with / for Unix or drive letter for Windows)'),
     isFullBackup: z.boolean().optional(),
     backupMode: z.enum(['automated', 'manual']).optional(),
     createdBy: z.string().optional(),
});

export const CreateFileBackupSchema = z.object({
     backupName: z.string().min(1, 'backupName is required and must be a non-empty string'),
     sourcePath: z.string().startsWith('/', 'sourcePath is required and must be an absolute path starting with /'),
     backupPath: z.string().startsWith('/', 'backupPath is required and must be an absolute path starting with /'),
     backupMode: z.enum(['automated', 'manual']).optional(),
     createdBy: z.string().optional(),
});

export const CreateBackupScheduleSchema = z.object({
     schedule_name: z.string().min(1, 'schedule_name is required and must be a non-empty string'),
     frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly'], {
          errorMap: () => ({ message: 'frequency is required and must be one of: hourly, daily, weekly, monthly' })
     }),
     backup_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'backup_time must be in HH:MM format (24-hour clock)'),
     retention_days: z.number().int().min(1, 'retention_days is required and must be a positive integer'),
     employeeid: z.number().int().min(1, 'employeeid is required and must be a positive integer'),
     backup_path: z.string().startsWith('/', 'backup_path must be an absolute path starting with / if provided').optional(),
     backup_type: z.enum(['database', 'files', 'full_system'], {
          errorMap: () => ({ message: 'backup_type is required and must be one of: database, files, full_system' })
     }),
     database_name: z.string().optional(),
     source_path: z.string().startsWith('/').optional(),
     is_active: z.boolean().optional(),
}).refine((data) => {
     if (data.backup_type === 'files' && !data.source_path) {
          return false;
     }
     return true;
}, {
     message: 'source_path is required when backup_type is files and must be an absolute path starting with /',
     path: ['source_path']
});

export const UpdateBackupScheduleSchema = z.object({
     schedule_name: z.string().min(1, 'schedule_name must be a non-empty string if provided').optional(),
     frequency: z.enum(['hourly', 'daily', 'weekly', 'monthly'], {
          errorMap: () => ({ message: 'frequency must be one of: hourly, daily, weekly, monthly if provided' })
     }).optional(),
     backup_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'backup_time must be in HH:MM format (24-hour clock)').optional(),
     retention_days: z.number().int().min(1, 'retention_days must be a positive integer if provided').optional(),
     employeeid: z.number().int().min(1, 'employeeid must be a positive integer if provided').optional(),
     backup_path: z.string().startsWith('/', 'backup_path must be an absolute path starting with / if provided').optional(),
     backup_type: z.enum(['database', 'files', 'full_system'], {
          errorMap: () => ({ message: 'backup_type must be one of: database, files, full_system if provided' })
     }).optional(),
     database_name: z.string().optional(),
     source_path: z.string().startsWith('/').optional(),
     is_active: z.boolean().optional(),
});

// Type inference from schemas
export type CreateDatabaseBackupData = z.infer<typeof CreateDatabaseBackupSchema>;
export type CreateFileBackupData = z.infer<typeof CreateFileBackupSchema>;
export type CreateBackupScheduleData = z.infer<typeof CreateBackupScheduleSchema>;
export type UpdateBackupScheduleData = z.infer<typeof UpdateBackupScheduleSchema>;

// Explicit interface that matches BackupSchedule for creation (without id, created_at, updated_at)
export interface BackupScheduleCreateData {
     schedule_name: string;
     frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
     backup_time: string;
     retention_days: number;
     employeeid: number;
     backup_path?: string;
     backup_type: 'database' | 'files' | 'full_system';
     database_name?: string;
     source_path?: string;
     is_active: boolean;
}

// Validation functions
export class BackupValidators {
     static validateCreateDatabaseBackup(data: unknown): { success: boolean; data?: CreateDatabaseBackupData; error?: z.ZodError } {
          const result = CreateDatabaseBackupSchema.safeParse(data);
          if (result.success) {
               return { success: true, data: result.data };
          } else {
               return { success: false, error: result.error };
          }
     }

     static validateCreateFileBackup(data: unknown): { success: boolean; data?: CreateFileBackupData; error?: z.ZodError } {
          const result = CreateFileBackupSchema.safeParse(data);
          if (result.success) {
               return { success: true, data: result.data };
          } else {
               return { success: false, error: result.error };
          }
     }

     static validateCreateBackupSchedule(data: unknown): { success: boolean; data?: CreateBackupScheduleData; error?: z.ZodError } {
          const result = CreateBackupScheduleSchema.safeParse(data);
          if (result.success) {
               return { success: true, data: result.data };
          } else {
               return { success: false, error: result.error };
          }
     }

     static validateUpdateBackupSchedule(data: unknown): { success: boolean; data?: UpdateBackupScheduleData; error?: z.ZodError } {
          const result = UpdateBackupScheduleSchema.safeParse(data);
          if (result.success) {
               return { success: true, data: result.data };
          } else {
               return { success: false, error: result.error };
          }
     }
}