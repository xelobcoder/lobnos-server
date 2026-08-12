import * as cron from 'node-cron';
import BackupManager from '../models/security/database-backup/backup';

/**
 * Automatic backup runner.
 * Source of truth: backup_schedules only.
 *
 * Polls every minute and executes schedules that are currently due.
 */
class BackupScheduler {
     private cronJob: cron.ScheduledTask | null = null;
     private isRunning = false;
     private isChecking = false;
     private readonly pollCron = '* * * * *';
     private readonly checkIntervalMs = 60 * 1000;

     /** Tenant used in single-tenant mode. Override with BACKUP_TENANT_ID. */
     private resolveTenantId(): number {
          const fromEnv = parseInt(process.env.BACKUP_TENANT_ID || '', 10);
          if (!Number.isNaN(fromEnv) && fromEnv > 0) {
               return fromEnv;
          }
          return 1;
     }

     async start(): Promise<void> {
          if (this.isRunning) {
               console.log('[BackupScheduler] already running');
               return;
          }

          this.isRunning = true;
          console.log(`[BackupScheduler] starting (tenantId=${this.resolveTenantId()}, poll=every minute, schedule-driven)`);

          await this.tick();
          this.cronJob = cron.schedule(this.pollCron, async () => {
               await this.tick();
          });
     }

     async stop(): Promise<void> {
          if (this.cronJob) {
               this.cronJob.stop();
               this.cronJob = null;
          }
          this.isRunning = false;
          console.log('[BackupScheduler] stopped');
     }

     getStatus() {
          return {
               isRunning: this.isRunning,
               isChecking: this.isChecking,
               checkInterval: this.checkIntervalMs,
               tenantId: this.resolveTenantId(),
               source: 'backup_schedules'
          };
     }

     private async tick(): Promise<void> {
          if (this.isChecking) {
               return;
          }

          this.isChecking = true;
          try {
               const tenantId = this.resolveTenantId();
               const runResult = await BackupManager.runScheduledBackups(tenantId, 'automated');

               if (runResult.processed > 0) {
                    console.log(
                         `[BackupScheduler] processed=${runResult.processed} successful=${runResult.successful} failed=${runResult.failed}`
                    );
               }

               if (runResult.failed > 0) {
                    console.error('[BackupScheduler] some scheduled backups failed:', runResult.results);
               }
          } catch (error) {
               console.error('[BackupScheduler] tick failed:', error);
          } finally {
               this.isChecking = false;
          }
     }
}

export const backupScheduler = new BackupScheduler();
