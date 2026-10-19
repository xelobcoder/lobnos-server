import logger from '../hooks/logger';
import { PaymentGatewayService } from './PaymentGatewayService';

/** Periodically re-verifies open and paid-but-unfulfilled transactions so missed webhooks and outages self-heal. */
export function startPaymentReconciliationWorker(service: PaymentGatewayService, intervalMs = 5 * 60_000): NodeJS.Timeout {
     let running = false;
     const timer = setInterval(async () => {
          if (running) return;
          running = true;
          try {
               const summary = await service.reconcile();
               if (summary.checked || summary.errors) logger.info(`[payments] reconciliation checked=${summary.checked} unavailable=${summary.unavailable} errors=${summary.errors}`);
          } catch (error: any) {
               logger.error(`[payments] reconciliation failed: ${error?.code ?? error?.name ?? 'unknown'}`);
          } finally {
               running = false;
          }
     }, intervalMs);
     timer.unref();
     return timer;
}
