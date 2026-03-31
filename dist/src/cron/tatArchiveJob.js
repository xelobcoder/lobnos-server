"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTATArchiveJob = void 0;
const configuration_1 = require("../hooks/configuration");
const TurnAroundTime_1 = __importDefault(require("../models/operations/TurnAroundTime"));
const tenancyRepo_1 = require("../models/Tenancy/tenancyRepo");
async function runTATArchiveJob() {
    const isMultiTenant = configuration_1.configuration.isMultiTenant;
    if (!isMultiTenant)
        await TurnAroundTime_1.default.computeAndArchiveAllTATs(3);
    let totalArchived = 0;
    const tenants = await new tenancyRepo_1.TenancyRepository().getAllTenants();
    if (!tenants || tenants.length === 0)
        return console.log("[TAT Archive] No tenants found to archive ascensions.");
    for (const tenant of tenants) {
        try {
            const count = await TurnAroundTime_1.default.computeAndArchiveAllTATs(tenant.tenantid);
            totalArchived += count;
            console.log(`[TAT Archive] Tenant ${tenant.tenantid}: Archived ${count} ascensions.`);
        }
        catch (err) {
            console.error(`[TAT Archive] Error for tenant ${tenant.tenantid}:`, err);
        }
    }
    console.log(`[TAT Archive] Total archived ascensions: ${totalArchived}`);
    return totalArchived;
}
exports.runTATArchiveJob = runTATArchiveJob;
