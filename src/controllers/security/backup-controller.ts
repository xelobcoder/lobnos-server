import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import BackupManager from '../../models/security/database-backup/backup';
import EncryptionManager from '../../models/security/database-backup/encryption';
import { BackupValidators, UpdateBackupScheduleData, BackupScheduleCreateData } from '../../utils/backup-validators';

interface BackupScheduleQuery {
     tenantId: string;
     employeeid?: string;
     is_active?: string;
     backup_type?: string;
     count?: string;
     sortby?: "DESC" | "ASC";
     page?: string;
}

export class BackupController {
     static async createDatabaseBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const {
                    backupName,
                    backupPath,
                    isFullBackup = true,
                    backupMode = 'manual',
                    createdBy
               } = req.body;

               // Generate unique backup name with timestamp
               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
               const uniqueBackupName = `${backupName}_${timestamp}`;

               // Validation using Zod
               const validation = BackupValidators.validateCreateDatabaseBackup({
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
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               // Check if encryption is enabled in security settings
               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const encryptBackup = securitySettings?.encryption_enabled || false;

               const result = await BackupManager.performDatabaseBackup(
                    tenantId,
                    validation.data!.backupName,
                    validation.data!.backupPath,
                    validation.data!.isFullBackup ?? true,
                    validation.data!.backupMode ?? 'manual',
                    validation.data!.createdBy,
                    undefined, // scheduleId
                    encryptBackup
               );

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
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error,
                         duration: result.duration
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async createFileBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const {
                    backupName,
                    sourcePath,
                    backupPath,
                    backupMode = 'manual',
                    createdBy
               } = req.body;

               // Generate unique backup name with timestamp
               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
               const uniqueBackupName = `${backupName}_${timestamp}`;

               // Validation using Zod
               const validation = BackupValidators.validateCreateFileBackup({
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
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               // Check if encryption is enabled in security settings
               const securitySettings = await EncryptionManager.getSecuritySettings(tenantId);
               const encryptBackup = securitySettings?.encryption_enabled || false;

               const result = await BackupManager.performFileBackup(
                    tenantId,
                    validation.data!.backupName,
                    validation.data!.sourcePath,
                    validation.data!.backupPath,
                    validation.data!.backupMode ?? 'manual',
                    validation.data!.createdBy,
                    undefined, // scheduleId
                    encryptBackup
               );

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
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error,
                         duration: result.duration
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupLogs(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { is_successful, backup_type, backup_mode, count = 10, page = 1, sortby = "DESC" } = req.query;

               const filters: any = {};
               if (is_successful !== undefined) {
                    filters.is_successful = is_successful === 'true';
               }
               if (backup_type) {
                    filters.backup_type = backup_type;
               }
               if (backup_mode) {
                    filters.backup_mode = backup_mode;
               }
               filters.count = parseInt(count as string);
               filters.page = parseInt(page as string);
               filters.sortby = sortby;

               const backups = await BackupManager.findAll(tenantId, filters);

               res.json({
                    status: true,
                    data: backups
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupById(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const backup = await BackupManager.findById(tenantId, parseInt(id));

               if (backup) {
                    res.json({
                         status: true,
                         data: backup
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Backup not found'
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupStats(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const stats = await BackupManager.getBackupStats(tenantId);

               res.json({
                    status: true,
                    data: stats
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async downloadBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const backup = await BackupManager.findById(tenantId, parseInt(id));

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
               } else if (backup.backup_type === 'database') {
                    // Ensure SQL files have .sql extension
                    if (!downloadName.endsWith('.sql')) {
                         downloadName += '.sql';
                    }
               } else if (backup.backup_type === 'files') {
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
               } else if (backup.backup_type === 'database') {
                    res.setHeader('Content-Type', 'application/sql');
               } else if (backup.backup_type === 'files') {
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

          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     // Backup Schedule Management Endpoints
     static async createBackupSchedule(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const scheduleData = req.body;

               // Validation using Zod
               const validation = BackupValidators.validateCreateBackupSchedule(scheduleData);

               if (!validation.success) {
                    return res.status(400).json({
                         status: false,
                         error: 'Validation failed',
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               const scheduleId = await BackupManager.createBackupSchedule(tenantId, validation.data! as BackupScheduleCreateData);

               res.status(201).json({
                    status: true,
                    message: 'Backup schedule created successfully',
                    data: { id: scheduleId }
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupSchedules(req: Request<{}, {}, {}, BackupScheduleQuery>, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const {
                    employeeid,
                    is_active,
                    backup_type,
                    count = 50,
                    sortby = "ASC",
                    page = 1
               } = req.query;

               const filters: any = {};
               if (employeeid) {
                    filters.employeeid = parseInt(employeeid as string);
               }
               if (is_active !== undefined) {
                    filters.is_active = is_active === 'true';
               }
               if (backup_type) {
                    filters.backup_type = backup_type;
               }
               filters.count = parseInt(count as string);
               filters.page = parseInt(page as string);
               filters.sortby = sortby;

               const schedules = await BackupManager.findAllBackupSchedules(tenantId, filters);

               res.json({
                    status: true,
                    data: schedules
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupScheduleById(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const schedule = await BackupManager.findBackupScheduleById(tenantId, parseInt(id));

               if (schedule) {
                    res.json({
                         status: true,
                         data: schedule
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Backup schedule not found'
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async updateBackupSchedule(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;
               const updates = req.body;

               // Validation using Zod
               const validation = BackupValidators.validateUpdateBackupSchedule(updates);

               if (!validation.success) {
                    return res.status(400).json({
                         status: false,
                         error: 'Validation failed',
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               const success = await BackupManager.updateBackupSchedule(tenantId, parseInt(id), validation.data! as UpdateBackupScheduleData);

               if (success) {
                    res.json({
                         status: true,
                         message: 'Backup schedule updated successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Backup schedule not found'
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async deleteBackupSchedule(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const success = await BackupManager.deleteBackupSchedule(tenantId, parseInt(id));

               if (success) {
                    res.json({
                         status: true,
                         message: 'Backup schedule deleted successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Backup schedule not found'
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async executeScheduledBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const result = await BackupManager.executeScheduledBackup(tenantId, parseInt(id));

               if (result.success) {
                    res.json({
                         status: true,
                         message: 'Scheduled backup executed successfully',
                         data: {
                              backupPath: result.backupPath
                         }
                    });
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async runScheduledBackups(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const result = await BackupManager.runScheduledBackups(tenantId);

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
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     // Encryption and Security Endpoints
     static async getSecuritySettings(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const settings = await EncryptionManager.getSecuritySettings(tenantId);

               res.json({
                    status: true,
                    data: settings
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async updateSecuritySettings(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const updates = req.body;

               const success = await EncryptionManager.updateSecuritySettings(tenantId, updates);

               if (success) {
                    res.json({
                         status: true,
                         message: 'Security settings updated successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: 'Security settings not found'
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async generateEncryptionKey(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { createdBy } = req.body;

               const keyId = await EncryptionManager.generateEncryptionKey(tenantId, createdBy);

               res.status(201).json({
                    status: true,
                    message: 'Encryption key generated successfully',
                    data: { keyId }
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getEncryptionKeys(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const keys = await EncryptionManager.getAllEncryptionKeys(tenantId);

               res.json({
                    status: true,
                    data: keys
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async rotateEncryptionKey(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { createdBy } = req.body;

               const result = await EncryptionManager.rotateKeyIfNeeded(tenantId, createdBy);

               res.json({
                    status: true,
                    data: result
               });
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async decryptBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;
               const { outputPath } = req.body;

               const backup = await BackupManager.findById(tenantId, parseInt(id));

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

               const result = await EncryptionManager.decryptFile(tenantId, backup.backup_path, finalOutputPath, keyId);

               if (result.success) {
                    res.json({
                         status: true,
                         message: 'Backup decrypted successfully',
                         data: {
                              outputPath: finalOutputPath
                         }
                    });
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async deleteBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const result = await BackupManager.deleteBackupWithFile(tenantId, parseInt(id));

               if (result.success) {
                    res.json({
                         status: true,
                         message: 'Backup deleted successfully'
                    });
               } else {
                    res.status(404).json({
                         status: false,
                         error: result.error
                    });
               }
          } catch (error) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }
}