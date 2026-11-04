import { randomUUID } from 'node:crypto';
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

async function backupFileAvailable(backup: { is_successful: boolean; backup_path?: string }): Promise<boolean> {
     if (!backup.is_successful || !backup.backup_path) return false;
     try {
          return (await fs.promises.stat(backup.backup_path)).isFile();
     } catch (error) {
          if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return false;
          throw error;
     }
}

export class BackupController {
     static async createDatabaseBackup(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const {
                    backupName,
                    isFullBackup = true,
                    backupMode,
                    createdBy
               } = req.body;
               let finalBackupMode = backupMode;
               if (!backupMode) {
                    finalBackupMode = 'manual';
               }

               const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
               const uniqueBackupName = `${backupName}_${timestamp}`;

               const configuredBackupPath = await EncryptionManager.getEffectiveStoragePath(tenantId);

               const validation = BackupValidators.validateCreateDatabaseBackup({
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
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               const encryptBackup = await EncryptionManager.shouldEncryptBackups(tenantId);
               const result = await BackupManager.performDatabaseBackup(
                    tenantId,
                    validation.data!.backupName,
                    validation.data!.backupPath,
                    validation.data!.isFullBackup ?? true,
                    finalBackupMode,
                    validation.data!.createdBy as any,
                    undefined,
                    encryptBackup
               );

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
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error,
                         duration: result.duration
                    });
               }
          } catch (error: any) {
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
               const data = await Promise.all(backups.map(async backup => ({
                    ...backup,
                    file_available: await backupFileAvailable(backup)
               })));

               res.json({
                    status: true,
                    data
               });
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupById(req: Request<{ id: string }>, res: Response) {
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
          } catch (error: any) {
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
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async downloadBackup(req: Request<{ id: string }>, res: Response) {
          let tempDecryptedFile: string | null = null;
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { id } = req.params;

               const backup = await BackupManager.findById(tenantId, parseInt(id));

               if (!backup) {
                    return res.status(404).json({
                         status: false,
                         code: 'BACKUP_NOT_FOUND',
                         error: 'Backup not found'
                    });
               }

               const backupPath = backup.backup_path;
               if (!backupPath || !await backupFileAvailable(backup)) {
                    return res.status(404).json({
                         status: false,
                         code: 'BACKUP_FILE_NOT_FOUND',
                         error: 'Backup file not found'
                    });
               }

               const isEncrypted = !!backup.encryption_key_id;
               let downloadPath = backupPath;
               let downloadName = path.basename(backupPath);

               if (req.query.decrypt === 'true' && isEncrypted && backup.encryption_key_id) {
                    const decryptedPath = `${backupPath}.${randomUUID()}.decrypted`;
                    const decryptResult = await EncryptionManager.decryptFile(tenantId, backupPath, decryptedPath, backup.encryption_key_id);

                    if (decryptResult.success) {
                         downloadPath = decryptedPath;
                         tempDecryptedFile = decryptedPath;
                         downloadName = downloadName.replace(/\.encrypted$/, '');
                    } else {
                         return res.status(500).json({
                              status: false,
                              error: `Failed to decrypt backup: ${decryptResult.error}`
                         });
                    }
               }

               if (backup.backup_type === 'database' && (!isEncrypted || tempDecryptedFile)) {
                    if (!downloadName.endsWith('.sql')) {
                         downloadName += '.sql';
                    }
               } else if (backup.backup_type === 'files' && (!isEncrypted || tempDecryptedFile)) {
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
               } else if (isEncrypted) {
                    res.setHeader('Content-Type', 'application/octet-stream');
               } else if (backup.backup_type === 'database') {
                    res.setHeader('Content-Type', 'application/sql');
               } else if (backup.backup_type === 'files') {
                    res.setHeader('Content-Type', 'application/gzip');
               } else {
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

               const cleanup = () => {
                    if (tempDecryptedFile && fs.existsSync(tempDecryptedFile)) {
                         try {
                              fs.unlinkSync(tempDecryptedFile);
                         } catch (cleanupError) {
                         }
                    }
               };
               fileStream.once('close', cleanup);
               res.once('close', () => { fileStream.destroy(); cleanup(); });

          } catch (error: any) {
               if (tempDecryptedFile) {
                    try { fs.unlinkSync(tempDecryptedFile); } catch {}
               }
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async createBackupSchedule(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const scheduleData = req.body;

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
          } catch (error: any) {
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
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async getBackupScheduleById(req: Request<{ id: string }>, res: Response) {
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
          } catch (error: any) {
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

               const validation = BackupValidators.validateUpdateBackupSchedule(updates);

               if (!validation.success) {
                    return res.status(400).json({
                         status: false,
                         error: 'Validation failed',
                         details: validation.error?.errors.map(e => e.message) || ['Unknown validation error']
                    });
               }

               const success = await BackupManager.updateBackupSchedule(tenantId, parseInt(id.toString()), validation.data! as UpdateBackupScheduleData);

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
          } catch (error: any) {
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

               const success = await BackupManager.deleteBackupSchedule(tenantId, parseInt(id.toString()));

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
          } catch (error: any) {
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

               const result = await BackupManager.executeScheduledBackup(tenantId, "manual", parseInt(id.toString()));

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
          } catch (error: any) {
               console.log(error)
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async runScheduledBackups(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const result = await BackupManager.runScheduledBackups(tenantId, "automated");

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
          } catch (error: any) {
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

               const result = await BackupManager.deleteBackupWithFile(tenantId, parseInt(id.toString()));

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
          } catch (error: any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }
}
