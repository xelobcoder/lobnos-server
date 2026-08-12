"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupScheduler = void 0;
const cron = __importStar(require("node-cron"));
const backup_1 = __importDefault(require("../models/security/database-backup/backup"));
/**
 * Automatic backup runner.
 * Source of truth: backup_schedules only.
 *
 * Polls every minute and executes schedules that are currently due.
 */
class BackupScheduler {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.isChecking = false;
        this.pollCron = '* * * * *';
        this.checkIntervalMs = 60 * 1000;
    }
    /** Tenant used in single-tenant mode. Override with BACKUP_TENANT_ID. */
    resolveTenantId() {
        const fromEnv = parseInt(process.env.BACKUP_TENANT_ID || '', 10);
        if (!Number.isNaN(fromEnv) && fromEnv > 0) {
            return fromEnv;
        }
        return 1;
    }
    async start() {
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
    async stop() {
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
    async tick() {
        if (this.isChecking) {
            return;
        }
        this.isChecking = true;
        try {
            const tenantId = this.resolveTenantId();
            const runResult = await backup_1.default.runScheduledBackups(tenantId, 'automated');
            if (runResult.processed > 0) {
                console.log(`[BackupScheduler] processed=${runResult.processed} successful=${runResult.successful} failed=${runResult.failed}`);
            }
            if (runResult.failed > 0) {
                console.error('[BackupScheduler] some scheduled backups failed:', runResult.results);
            }
        }
        catch (error) {
            console.error('[BackupScheduler] tick failed:', error);
        }
        finally {
            this.isChecking = false;
        }
    }
}
exports.backupScheduler = new BackupScheduler();
