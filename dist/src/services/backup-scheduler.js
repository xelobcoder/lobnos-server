"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupScheduler = void 0;
const KnexConnections_1 = __importDefault(require("../database/KnexConnections"));
const backup_1 = __importDefault(require("../models/security/database-backup/backup"));
class BackupSchedulerService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.CHECK_INTERVAL = 60 * 1000; // Check every 60 seconds
    }
    async start() {
        if (this.isRunning) {
            console.log('Backup scheduler is already running');
            return;
        }
        console.log('Starting backup scheduler service...');
        this.isRunning = true;
        // Run initial check
        await this.checkAndExecuteScheduledBackups();
        // Set up periodic checks
        this.intervalId = setInterval(async () => {
            try {
                await this.checkAndExecuteScheduledBackups();
            }
            catch (error) {
                console.error('Error in scheduled backup check:', error);
            }
        }, this.CHECK_INTERVAL);
        console.log(`Backup scheduler started - checking every ${this.CHECK_INTERVAL / 1000} seconds`);
    }
    async stop() {
        if (!this.isRunning) {
            console.log('Backup scheduler is not running');
            return;
        }
        console.log('Stopping backup scheduler service...');
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        console.log('Backup scheduler stopped');
    }
    async checkAndExecuteScheduledBackups() {
        try {
            // Get all tenant IDs from the database
            // This assumes you have a way to get all tenant databases
            const tenantIds = await this.getAllTenantIds();
            console.log(`Checking scheduled backups for ${tenantIds.length} tenants...`);
            for (const tenantId of tenantIds) {
                try {
                    const result = await backup_1.default.runScheduledBackups(tenantId, "automated");
                    if (result.processed > 0) {
                        console.log(`Tenant ${tenantId}: Processed ${result.processed} scheduled backups`);
                        console.log(`  - Successful: ${result.successful}`);
                        console.log(`  - Failed: ${result.failed}`);
                        // Log details of failed backups
                        if (result.failed > 0) {
                            result.results.forEach(r => {
                                if (!r.success) {
                                    console.error(`  - Schedule ${r.scheduleId} failed: ${r.error}`);
                                }
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`Error processing scheduled backups for tenant ${tenantId}:`, error);
                }
            }
        }
        catch (error) {
            console.error('Error in backup scheduler check:', error);
        }
    }
    async getAllTenantIds() {
        try {
            // This is a simplified approach - you might need to adjust based on your tenant structure
            // For now, we'll check common tenant IDs, but you should implement proper tenant discovery
            const tenantIds = [];
            const maxTenantId = 100; // Adjust based on your setup
            for (let i = 1; i <= maxTenantId; i++) {
                try {
                    // Try to connect to each tenant database
                    const connection = await (0, KnexConnections_1.default)(i);
                    await connection.raw('SELECT 1'); // Simple test query
                    tenantIds.push(i);
                }
                catch (error) {
                    // Skip tenants that don't exist or are inaccessible
                    continue;
                }
            }
            return tenantIds;
        }
        catch (error) {
            console.error('Error getting tenant IDs:', error);
            return [];
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.CHECK_INTERVAL
        };
    }
}
// Export singleton instance
exports.backupScheduler = new BackupSchedulerService();
exports.default = BackupSchedulerService;
