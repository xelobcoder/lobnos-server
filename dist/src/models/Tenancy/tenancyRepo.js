"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenancyRepository = void 0;
const tenancyConnection_1 = require("../../database/tenancyConnection");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
class TenancyRepository {
    async createTenant(tenantInformation) {
        const [tenantid] = await tenancyConnection_1.tenancyConnection.raw(`INSERT INTO registeredclients (name, type, createdon, isActive, updatedOn, referedid, expirydate) 
       VALUES (?, ?, NOW(), ?, NOW(), ?, ?) RETURNING tenantid`, [
            tenantInformation.name,
            tenantInformation.type,
            tenantInformation.isActive || 1,
            tenantInformation.referedid,
            tenantInformation.expirydate,
        ]);
        return tenantid;
    }
    async getTenantDetails(tenantid) {
        const [tenant] = await tenancyConnection_1.tenancyConnection.raw(`SELECT * FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return Array.isArray(tenant) && tenant.length > 0 ? tenant[0] : null;
    }
    async getAllTenants() {
        const [tenants] = await tenancyConnection_1.tenancyConnection.raw(`SELECT * FROM registeredclients`);
        return tenants;
    }
    async updateTenant(tenantid, tenantInformation) {
        const updated = await tenancyConnection_1.tenancyConnection.raw(`UPDATE registeredclients SET name = ?, type = ?, updatedOn = NOW(), referedid = ?, expirydate = ? 
       WHERE tenantid = ?`, [
            tenantInformation.name,
            tenantInformation.type,
            tenantInformation.referedid,
            tenantInformation.expirydate,
            tenantid,
        ]);
        return updated.affectedRows > 0;
    }
    async deleteTenant(tenantid) {
        const deleted = await tenancyConnection_1.tenancyConnection.raw(`DELETE FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return deleted.affectedRows > 0;
    }
    async activateTenant(tenantid) {
        const updated = await tenancyConnection_1.tenancyConnection.raw(`UPDATE registeredclients SET isActive = 1, updatedOn = NOW() WHERE tenantid = ?`, [tenantid]);
        return updated.affectedRows > 0;
    }
    async deactivateTenant(tenantid) {
        const updated = await tenancyConnection_1.tenancyConnection.raw(`UPDATE registeredclients SET isActive = 0, updatedOn = NOW() WHERE tenantid = ?`, [tenantid]);
        return updated.affectedRows > 0;
    }
    async verifyTenantId(tenantid) {
        const [tenant] = await tenancyConnection_1.tenancyConnection.raw(`SELECT tenantid FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return !!tenant;
    }
    async createDatabase(dbName) {
        try {
            const status = await tenancyConnection_1.tenancyConnection.raw(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
            return status;
        }
        catch (err) {
            console.error(`Error creating database ${dbName}:`, err);
        }
    }
    async validateTenantReferedId(referedid) {
        const tenant = tenancyConnection_1.tenancyConnection.raw(`SELECT referedid FROM registeredclients WHERE  referedid = ? `);
        return tenant || !Array.isArray(tenant) || tenant.length == 0 ? false : tenant[0]['referedid'] == referedid.trim();
    }
    async validateTenantStanding(tenantId) {
        const tenant = await this.getTenantDetails(tenantId);
        return tenant && tenant['isActive'] == 1;
    }
    async createTenancyFile() {
        const tenants = await this.getAllTenants();
        const dirPath = path_1.default.join(__dirname, "../../database/tenants");
        const filePath = path_1.default.join(dirPath, "tenants.json");
        const jsonifiedTenants = JSON.stringify(tenants, null, 2);
        try {
            await promises_1.default.mkdir(dirPath, { recursive: true });
            let shouldWrite = true;
            try {
                const existingContent = await promises_1.default.readFile(filePath, "utf-8");
                if (existingContent === jsonifiedTenants)
                    shouldWrite = false;
            }
            catch (err) {
                shouldWrite = true;
            }
            if (shouldWrite) {
                await promises_1.default.writeFile(filePath, jsonifiedTenants);
                console.log(`Tenants file written to ${filePath}`);
            }
            else {
                console.log(`Tenants file is already up-to-date at ${filePath}`);
            }
        }
        catch (err) {
            console.error("Error creating tenancy file:", err);
        }
    }
}
exports.TenancyRepository = TenancyRepository;
