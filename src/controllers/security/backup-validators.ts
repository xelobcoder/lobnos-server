export interface ValidationResult {
     isValid: boolean;
     errors: string[];
}

export interface CreateBackupScheduleData {
     schedule_name: string;
     frequency: string;
     backup_time: string;
     retention_days: number;
     employeeid: number;
     backup_path: string;
     backup_type: string;
     is_active?: boolean;
     database_name?: string;
     source_path?: string;
}

export interface UpdateBackupScheduleData {
     schedule_name?: string;
     frequency?: string;
     backup_time?: string;
     retention_days?: number;
     employeeid?: number;
     backup_path?: string;
     backup_type?: string;
     is_active?: boolean;
     database_name?: string;
     source_path?: string;
}

export interface CreateDatabaseBackupData {
     backupName: string;
     backupPath: string;
     isFullBackup?: boolean;
     backupMode?: string;
     createdBy?: string;
}

export interface CreateFileBackupData {
     backupName: string;
     sourcePath: string;
     backupPath: string;
     backupMode?: string;
     createdBy?: string;
}

export class BackupValidators {
     private static readonly FREQUENCY_OPTIONS = ['hourly', 'daily', 'weekly', 'monthly'];
     private static readonly BACKUP_TYPE_OPTIONS = ['database', 'files', 'full_system'];
     private static readonly BACKUP_MODE_OPTIONS = ['automated', 'manual'];
     private static readonly TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
     private static readonly PATH_REGEX = /^\//;

     static validateCreateBackupSchedule(data: CreateBackupScheduleData): ValidationResult {
          const errors: string[] = [];

          // Required field validations
          if (!data.schedule_name || typeof data.schedule_name !== 'string' || data.schedule_name.trim().length === 0) {
               errors.push('schedule_name is required and must be a non-empty string');
          }

          if (!data.frequency || !this.FREQUENCY_OPTIONS.includes(data.frequency)) {
               errors.push(`frequency is required and must be one of: ${this.FREQUENCY_OPTIONS.join(', ')}`);
          }

          if (!data.backup_time || typeof data.backup_time !== 'string') {
               errors.push('backup_time is required and must be a string in HH:MM format');
          } else if (!this.TIME_REGEX.test(data.backup_time)) {
               errors.push('backup_time must be in HH:MM format (24-hour clock)');
          }

          if (!data.retention_days || typeof data.retention_days !== 'number' || data.retention_days < 1) {
               errors.push('retention_days is required and must be a positive integer');
          }

          if (!data.employeeid || typeof data.employeeid !== 'number' || data.employeeid < 1) {
               errors.push('employeeid is required and must be a positive integer');
          }

          if (!data.backup_path || typeof data.backup_path !== 'string' || !this.PATH_REGEX.test(data.backup_path)) {
               errors.push('backup_path is required and must be an absolute path starting with /');
          }

          if (!data.backup_type || !this.BACKUP_TYPE_OPTIONS.includes(data.backup_type)) {
               errors.push(`backup_type is required and must be one of: ${this.BACKUP_TYPE_OPTIONS.join(', ')}`);
          }

          // Conditional validations
          if (data.backup_type === 'database' && (!data.database_name || typeof data.database_name !== 'string')) {
               errors.push('database_name is required when backup_type is database');
          }

          if (data.backup_type === 'files' && (!data.source_path || typeof data.source_path !== 'string' || !this.PATH_REGEX.test(data.source_path))) {
               errors.push('source_path is required when backup_type is files and must be an absolute path starting with /');
          }

          // Optional field validations
          if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
               errors.push('is_active must be a boolean if provided');
          }

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     static validateUpdateBackupSchedule(data: UpdateBackupScheduleData): ValidationResult {
          const errors: string[] = [];

          // Optional field validations (only validate if provided)
          if (data.schedule_name !== undefined && (typeof data.schedule_name !== 'string' || data.schedule_name.trim().length === 0)) {
               errors.push('schedule_name must be a non-empty string if provided');
          }

          if (data.frequency !== undefined && !this.FREQUENCY_OPTIONS.includes(data.frequency)) {
               errors.push(`frequency must be one of: ${this.FREQUENCY_OPTIONS.join(', ')} if provided`);
          }

          if (data.backup_time !== undefined) {
               if (typeof data.backup_time !== 'string') {
                    errors.push('backup_time must be a string if provided');
               } else if (!this.TIME_REGEX.test(data.backup_time)) {
                    errors.push('backup_time must be in HH:MM format (24-hour clock)');
               }
          }

          if (data.retention_days !== undefined && (typeof data.retention_days !== 'number' || data.retention_days < 1)) {
               errors.push('retention_days must be a positive integer if provided');
          }

          if (data.employeeid !== undefined && (typeof data.employeeid !== 'number' || data.employeeid < 1)) {
               errors.push('employeeid must be a positive integer if provided');
          }

          if (data.backup_path !== undefined && (typeof data.backup_path !== 'string' || !this.PATH_REGEX.test(data.backup_path))) {
               errors.push('backup_path must be an absolute path starting with / if provided');
          }

          if (data.backup_type !== undefined && !this.BACKUP_TYPE_OPTIONS.includes(data.backup_type)) {
               errors.push(`backup_type must be one of: ${this.BACKUP_TYPE_OPTIONS.join(', ')} if provided`);
          }

          if (data.database_name !== undefined && typeof data.database_name !== 'string') {
               errors.push('database_name must be a string if provided');
          }

          if (data.source_path !== undefined && (typeof data.source_path !== 'string' || !this.PATH_REGEX.test(data.source_path))) {
               errors.push('source_path must be an absolute path starting with / if provided');
          }

          if (data.is_active !== undefined && typeof data.is_active !== 'boolean') {
               errors.push('is_active must be a boolean if provided');
          }

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     static validateCreateDatabaseBackup(data: CreateDatabaseBackupData): ValidationResult {
          const errors: string[] = [];

          if (!data.backupName || typeof data.backupName !== 'string' || data.backupName.trim().length === 0) {
               errors.push('backupName is required and must be a non-empty string');
          }

          if (!data.backupPath || typeof data.backupPath !== 'string' || !this.PATH_REGEX.test(data.backupPath)) {
               errors.push('backupPath is required and must be an absolute path starting with /');
          }

          if (data.isFullBackup !== undefined && typeof data.isFullBackup !== 'boolean') {
               errors.push('isFullBackup must be a boolean if provided');
          }

          if (data.backupMode !== undefined && !this.BACKUP_MODE_OPTIONS.includes(data.backupMode)) {
               errors.push(`backupMode must be one of: ${this.BACKUP_MODE_OPTIONS.join(', ')} if provided`);
          }

          if (data.createdBy !== undefined && typeof data.createdBy !== 'string') {
               errors.push('createdBy must be a string if provided');
          }

          return {
               isValid: errors.length === 0,
               errors
          };
     }

     static validateCreateFileBackup(data: CreateFileBackupData): ValidationResult {
          const errors: string[] = [];

          if (!data.backupName || typeof data.backupName !== 'string' || data.backupName.trim().length === 0) {
               errors.push('backupName is required and must be a non-empty string');
          }

          if (!data.sourcePath || typeof data.sourcePath !== 'string' || !this.PATH_REGEX.test(data.sourcePath)) {
               errors.push('sourcePath is required and must be an absolute path starting with /');
          }

          if (!data.backupPath || typeof data.backupPath !== 'string' || !this.PATH_REGEX.test(data.backupPath)) {
               errors.push('backupPath is required and must be an absolute path starting with /');
          }

          if (data.backupMode !== undefined && !this.BACKUP_MODE_OPTIONS.includes(data.backupMode)) {
               errors.push(`backupMode must be one of: ${this.BACKUP_MODE_OPTIONS.join(', ')} if provided`);
          }

          if (data.createdBy !== undefined && typeof data.createdBy !== 'string') {
               errors.push('createdBy must be a string if provided');
          }

          return {
               isValid: errors.length === 0,
               errors
          };
     }
}