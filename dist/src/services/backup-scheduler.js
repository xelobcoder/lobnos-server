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
const encryption_1 = __importDefault(require("../models/security/database-backup/encryption"));
const configuration_1 = require("../hooks/configuration");
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
class BackupScheduler {
    constructor() {
        this.cronJob = null;
        this.isRunning = false;
        this.checkInterval = 60 * 1000;
    }
    async start() {
        if (this.isRunning)
            return;
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
        }
        catch (error) {
            console.error('Shutdown backup failed or timed out:', error);
        }
        try {
            await this.checkAndExecuteScheduledBackups();
        }
        catch (error) {
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
    async createStartupBackup() {
        try {
            const tenantId = configuration_1.configuration.isMultiTenant ? null : 3;
            if (!tenantId)
                return;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const connection = await (0, KnexConnections_1.default)(tenantId);
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
            const result = await backup_1.default.performDatabaseBackup(tenantId, `startup_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`, await encryption_1.default.getEffectiveStoragePath(tenantId), true, 'automated', 'system', undefined, true // Always encrypt startup backups
            );
        }
        catch (error) {
        }
    }
    async createShutdownBackup() {
        try {
            const tenantId = configuration_1.configuration.isMultiTenant ? null : 3;
            if (!tenantId)
                return;
            console.log('Creating shutdown backup...');
            const result = await backup_1.default.performDatabaseBackup(tenantId, `shutdown_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`, await encryption_1.default.getEffectiveStoragePath(tenantId), true, 'automated', 'system', undefined, true // Always encrypt shutdown backups
            );
            if (result.success) {
                console.log('Shutdown backup completed successfully');
            }
            else {
                console.error('Shutdown backup failed:', result.error);
            }
        }
        catch (error) {
            console.error('Error creating shutdown backup:', error);
        }
    }
    async checkAndExecuteScheduledBackups() {
        try {
            const tenantId = configuration_1.configuration.isMultiTenant ? null : 3;
            if (!tenantId) {
                return;
            }
            const result = await backup_1.default.runScheduledBackups(tenantId, "automated");
        }
        catch (error) {
        }
    }
}
exports.backupScheduler = new BackupScheduler();
