import { EmailLogsRepo } from '../repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../repositories/EmailTemplatesRepo';
import { EmailQueueService } from '../services/EmailQueueService';
import { ProviderFactory } from '../services/ProviderFactory';
import { TemplateRenderer } from '../services/TemplateRenderer';
import { listServedTenants } from '../../../Tenancy/TenantRegistry';

/** Set EMAIL_WORKER_TENANT_ID to dedicate this worker to one tenant; otherwise it serves every active tenant. */
const pinnedTenantId = Number(process.env.EMAIL_WORKER_TENANT_ID) > 0 ? Number(process.env.EMAIL_WORKER_TENANT_ID) : null;
const batchSize = Number(process.env.EMAIL_QUEUE_BATCH_SIZE || '20');
const intervalMs = Number(process.env.EMAIL_PROCESS_INTERVAL || '5000');

function buildService(currentTenantId: number) {
     const queueRepo = new EmailQueueRepo(currentTenantId);
     const logsRepo = new EmailLogsRepo(currentTenantId);
     const templatesRepo = new EmailTemplatesRepo(currentTenantId);
     const providersRepo = new EmailProvidersRepo(currentTenantId);
     const settingsRepo = new EmailSettingsRepo(currentTenantId);

     return new EmailQueueService(
          queueRepo,
          logsRepo,
          templatesRepo,
          providersRepo,
          settingsRepo,
          new ProviderFactory(),
          new TemplateRenderer(),
     );
}

async function loop() {
     const services = new Map<number, EmailQueueService>();
     let running = true;

     console.log(`[email-worker] started (tenant=${pinnedTenantId ?? 'all'}, batchSize=${batchSize}, intervalMs=${intervalMs})`);

     process.on('SIGINT', () => {
          running = false;
          process.exit(0);
     });

     process.on('SIGTERM', () => {
          running = false;
          process.exit(0);
     });

     while (running) {
          try {
               const tenantIds = pinnedTenantId ? [pinnedTenantId] : (await listServedTenants()).map((tenant) => tenant.tenantId);
               for (const tenantId of tenantIds) {
                    try {
                         if (!services.has(tenantId)) services.set(tenantId, buildService(tenantId));
                         const processed = await services.get(tenantId)!.processQueue(batchSize);
                         console.log(`[email-worker] tenant ${tenantId} cycle complete: processed=${processed.length}`);
                    } catch (error) {
                         // Worker should keep running even if one tenant's cycle fails.
                         const message = error instanceof Error ? error.message : String(error);
                         console.error(`[email-worker] tenant ${tenantId} cycle failed: ${message}`);
                    }
               }
          } catch (error) {
               const message = error instanceof Error ? error.message : String(error);
               console.error(`[email-worker] tenant registry unavailable: ${message}`);
          }

          await new Promise((resolve) => setTimeout(resolve, intervalMs));
     }
}

loop().catch((error) => {
     const message = error instanceof Error ? error.message : String(error);
     console.error(`[email-worker] fatal: ${message}`);
     process.exit(1);
});
