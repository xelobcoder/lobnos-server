import * as cron from 'node-cron';
import BackupManager from '../models/security/database-backup/backup';
import EncryptionManager from '../models/security/database-backup/encryption';
import { configuration } from '../hooks/configuration';
import KnexConnection from '../database/KnexConnections';


class BackupScheduler {
     private cronJob: cron.ScheduledTask | null = null;
     private isRunning = false;
     private checkInterval = 60 * 1000;

     async start() {
          if (this.isRunning) return;
          this.isRunning = true;
          await this.createStartupBackup();
          await this.checkAndExecuteScheduledBackups();
          this.cronJob = cron.schedule('* * * * *', async () => {
               await this.checkAndExecuteScheduledBackups();
          });
     }

     async stop() {
          const shutdownTimeout = setTimeout(() => {
               console.error('Shutdown backup timed out after 30 seconds');
          }, 30000);

          try {
               await Promise.race([
                    this.createShutdownBackup(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown backup timeout')), 25000))
               ]);
          } catch (error) {
               console.error('Shutdown backup failed or timed out:', error);
          }

          try {
               await this.checkAndExecuteScheduledBackups();
          } catch (error) {
               console.error('Final scheduled backup check failed:', error);
          }

          if (this.cronJob) {
               this.cronJob.stop();
               this.cronJob = null;
          }
          this.isRunning = false;

          clearTimeout(shutdownTimeout);
     }

     getStatus() {
          return {
               isRunning: this.isRunning,
               checkInterval: this.checkInterval
          };
     }

     private async createStartupBackup() {
          try {
               const tenantId = configuration.isMultiTenant ? null : 3;
               if (!tenantId) return;

               const today = new Date();
               today.setHours(0, 0, 0, 0);
               const tomorrow = new Date(today);
               tomorrow.setDate(tomorrow.getDate() + 1);

               const connection = await KnexConnection(tenantId);
               const todaysBackups = await connection('backup_logs')
                    .where('backup_date', '>=', today)
                    .andWhere('backup_date', '<', tomorrow)
                    .andWhere('is_successful', true)
                    .orderBy('backup_date', 'desc')
                    .limit(1);

               if (todaysBackups.length > 0) {
                    const lastBackup = todaysBackups[0];
                    const lastBackupTime = new Date(lastBackup.backup_date);
                    const hoursSinceLastBackup = (Date.now() - lastBackupTime.getTime()) / (1000 * 60 * 60);

                    if (hoursSinceLastBackup < 4) {
                         return;
                    }
               }

               const result = await BackupManager.performDatabaseBackup(
                    tenantId,
                    `startup_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
                    await EncryptionManager.getEffectiveStoragePath(tenantId),
                    true,
                    'automated',
                    'system',
                    undefined,
                    true // Always encrypt startup backups
               );
          } catch (error) {
          }
     }

     private async createShutdownBackup() {
          try {
               const tenantId = configuration.isMultiTenant ? null : 3;
               if (!tenantId) return;

               console.log('Creating shutdown backup...');
               const result = await BackupManager.performDatabaseBackup(
                    tenantId,
                    `shutdown_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
                    await EncryptionManager.getEffectiveStoragePath(tenantId),
                    true,
                    'automated',
                    'system',
                    undefined,
                    true // Always encrypt shutdown backups
               );

               if (result.success) {
                    console.log('Shutdown backup completed successfully');
               } else {
                    console.error('Shutdown backup failed:', result.error);
               }
          } catch (error) {
               console.error('Error creating shutdown backup:', error);
          }
     }
     private async checkAndExecuteScheduledBackups() {
          try {
               const tenantId = configuration.isMultiTenant ? null : 3;

               if (!tenantId) {
                    return;
               }

               const result = await BackupManager.runScheduledBackups(tenantId, "automated");
          } catch (error) {
          }
     }
}

export const backupScheduler = new BackupScheduler();
