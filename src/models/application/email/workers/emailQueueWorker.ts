import { EmailLogsRepo } from '../repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../repositories/EmailTemplatesRepo';
import { EmailQueueService } from '../services/EmailQueueService';
import { ProviderFactory } from '../services/ProviderFactory';
import { TemplateRenderer } from '../services/TemplateRenderer';

const tenantId = Number(process.env.EMAIL_WORKER_TENANT_ID || '1');
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
     const service = buildService(tenantId);
     let running = true;

     console.log(`[email-worker] started (tenant=${tenantId}, batchSize=${batchSize}, intervalMs=${intervalMs})`);

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
               const processed = await service.processQueue(batchSize);
               console.log(`[email-worker] cycle complete: processed=${processed.length}`);
          } catch (error) {
               // Worker should keep running even if one cycle fails.
               const message = error instanceof Error ? error.message : String(error);
               console.error(`[email-worker] cycle failed: ${message}`);
          }

          await new Promise((resolve) => setTimeout(resolve, intervalMs));
     }
}

loop().catch((error) => {
     const message = error instanceof Error ? error.message : String(error);
     console.error(`[email-worker] fatal: ${message}`);
     process.exit(1);
});
