"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.CommissionLogger = void 0;
class CommissionLogger {
    static info(message, data) {
        console.log(`${this.prefix} INFO: ${message}`, data);
    }
    static warn(message, data) {
        console.warn(`${this.prefix} WARN: ${message}`, data);
    }
    static error(message, data) {
        console.error(`${this.prefix} ERROR: ${message}`, data);
    }
    static debug(message, data) {
        if (process.env.DEBUG === 'true') {
            console.log(`${this.prefix} DEBUG: ${message}`, data);
        }
    }
    static logCalculation(serviceId, trackingId, rawCommission, finalCommission, adjustments) {
        this.info(`Commission calculated for service ${serviceId}`, {
            tracking_id: trackingId,
            raw: rawCommission,
            final: finalCommission,
            adjustments,
        });
    }
    static logMissingConfig(serviceId, context) {
        this.warn(`No commission configuration found for service ${serviceId}`, context);
    }
    static logResolutionFailure(serviceId, reason) {
        this.error(`Commission resolution failed for service ${serviceId}`, { reason });
    }
}
exports.CommissionLogger = CommissionLogger;
CommissionLogger.prefix = '[Commission Engine]';
exports.logger = CommissionLogger;
