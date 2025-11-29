"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenancyRepository = void 0;
const connection_1 = require("../../database/connection");
class TenancyRepository {
    async createTenant(tenantInformation) {
        const [tenantid] = await connection_1.systemConfigConnection.raw(`INSERT INTO registeredclients (name, type, createdon, isActive, updatedOn, referedid, expirydate) 
       VALUES (?, ?, NOW(), ?, NOW(), ?, ?) RETURNING tenantid`, [
            tenantInformation.name,
            tenantInformation.isActive || 1,
            tenantInformation.referedid,
            tenantInformation.expirydate,
        ]);
        return tenantid;
    }
    async getTenantDetails(tenantid) {
        const [tenant] = await connection_1.systemConfigConnection.raw(`SELECT * FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return Array.isArray(tenant) && tenant.length > 0 ? tenant[0] : null;
    }
    async getAllTenants() {
        const [tenants] = await connection_1.systemConfigConnection.raw(`SELECT * FROM registeredclients`);
        return tenants;
    }
    async updateTenant(tenantid, tenantInformation) {
        const updated = await connection_1.systemConfigConnection.raw(`UPDATE registeredclients SET name = ?, type = ?, updatedOn = NOW(), referedid = ?, expirydate = ? 
       WHERE tenantid = ?`, [
            tenantInformation.name,
            tenantInformation.referedid,
            tenantInformation.expirydate,
            tenantid,
        ]);
        return updated.affectedRows > 0;
    }
    async deleteTenant(tenantid) {
        const deleted = await connection_1.systemConfigConnection.raw(`DELETE FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return deleted.affectedRows > 0;
    }
    async activateTenant(tenantid) {
        const updated = await connection_1.systemConfigConnection.raw(`UPDATE registeredclients SET isActive = 1, updatedOn = NOW() WHERE tenantid = ?`, [tenantid]);
        return updated.affectedRows > 0;
    }
    async deactivateTenant(tenantid) {
        const updated = await connection_1.systemConfigConnection.raw(`UPDATE registeredclients SET isActive = 0, updatedOn = NOW() WHERE tenantid = ?`, [tenantid]);
        return updated.affectedRows > 0;
    }
    async verifyTenantId(tenantid) {
        const [tenant] = await connection_1.systemConfigConnection.raw(`SELECT tenantid FROM registeredclients WHERE tenantid = ?`, [tenantid]);
        return !!tenant;
    }
    async createDatabase(dbName) {
        try {
            const status = await connection_1.systemConfigConnection.raw(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
            return status;
        }
        catch (err) {
            console.error(`Error creating database ${dbName}:`, err);
        }
    }
    async validateTenantReferedId(referedid) {
        const tenant = connection_1.systemConfigConnection.raw(`SELECT referedid FROM registeredclients WHERE  referedid = ? `);
        return tenant || !Array.isArray(tenant) || tenant.length == 0 ? false : tenant[0]['referedid'] == referedid.trim();
    }
    async validateTenantStanding(tenantId) {
        const tenant = await this.getTenantDetails(tenantId);
        return tenant && tenant['isActive'] == 1;
    }
}
exports.TenancyRepository = TenancyRepository;
