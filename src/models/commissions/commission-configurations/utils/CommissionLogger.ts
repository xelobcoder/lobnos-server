export class CommissionLogger {
     private static prefix = '[Commission Engine]';

     static info(message: string, data?: Record<string, any>) {
          console.log(`${this.prefix} INFO: ${message}`, data);
     }

     static warn(message: string, data?: Record<string, any>) {
          console.warn(`${this.prefix} WARN: ${message}`, data);
     }

     static error(message: string, data?: Record<string, any>) {
          console.error(`${this.prefix} ERROR: ${message}`, data);
     }

     static debug(message: string, data?: Record<string, any>) {
          if (process.env.DEBUG === 'true') {
               console.log(`${this.prefix} DEBUG: ${message}`, data);
          }
     }

     static logCalculation(
          serviceId: number,
          trackingId: number,
          rawCommission: number,
          finalCommission: number,
          adjustments: Record<string, any>
     ) {
          this.info(`Commission calculated for service ${serviceId}`, {
               tracking_id: trackingId,
               raw: rawCommission,
               final: finalCommission,
               adjustments,
          });
     }

     static logMissingConfig(serviceId: number, context: Record<string, any>) {
          this.warn(`No commission configuration found for service ${serviceId}`, context);
     }

     static logResolutionFailure(serviceId: number, reason: string) {
          this.error(`Commission resolution failed for service ${serviceId}`, { reason });
     }
}

export const logger = CommissionLogger;
