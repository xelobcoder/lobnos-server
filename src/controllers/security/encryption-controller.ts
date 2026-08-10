import { Request, Response } from 'express';
import * as fs from 'fs';
import BackupManager from '../../models/security/database-backup/backup';
import EncryptionManager from '../../models/security/database-backup/encryption';

export class EncryptionController {
     static async getSecuritySettings(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);

               const settings = await EncryptionManager.getSecuritySettings(tenantId);

               res.json({
                    status: true,
                    data: settings
               });
          } catch (error:any) {
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
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async generateEncryptionKey(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { createdBy, userKey } = req.body;

               const keyId = await EncryptionManager.generateEncryptionKey(tenantId, createdBy, userKey);

               res.status(201).json({
                    status: true,
                    message: 'Encryption key generated successfully',
                    data: { keyId }
               });
          } catch (error:any) {
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
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }

     static async rotateEncryptionKey(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const { createdBy, force, userKey } = req.body;
               const result = await EncryptionManager.rotateKeyIfNeeded(tenantId, createdBy, force, userKey);
               res.json({
                    status: true,
                    data: result
               });
          } catch (error:any) {
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

               const backup = await BackupManager.findById(tenantId, parseInt(id.toString()));

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

               let keyId: string;

               // First try to get the key ID from the backup record (for backups created after this fix)
               if (backup.encryption_key_id) {
                    keyId = backup.encryption_key_id;
               } else {
                    // Fallback to current active key for older backups
                    const keyInfo = await EncryptionManager.getActiveEncryptionKey(tenantId);
                    if (!keyInfo) {
                         return res.status(500).json({
                              status: false,
                              error: 'No active encryption key found'
                         });
                    }
                    keyId = keyInfo.keyId;
               }

               const finalOutputPath = outputPath || backup.backup_path.replace('.encrypted', '_decrypted');

               const result = await EncryptionManager.decryptFile(tenantId, backup.backup_path, finalOutputPath, keyId);

               if (result.success) {
                    res.json({
                         status: true,
                         message: 'Backup decrypted successfully',
                         data: {
                              outputPath: finalOutputPath,
                              keyId: keyId
                         }
                    });
               } else {
                    res.status(500).json({
                         status: false,
                         error: result.error
                    });
               }
          } catch (error:any) {
               res.status(500).json({
                    status: false,
                    error: error.message
               });
          }
     }
}