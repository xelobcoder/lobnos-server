import { systemConfigConnection as tenancyConnection } from "../../database/connection";

export class TenancyRepository {
     async createTenant(tenantInformation: Partial<PrimeLimsTenant>): Promise<number> {
          const [tenantid] = await tenancyConnection.raw(
               `INSERT INTO registeredclients (name, type, createdon, isActive, updatedOn, referedid, expirydate) 
       VALUES (?, ?, NOW(), ?, NOW(), ?, ?) RETURNING tenantid`,
               [
                    tenantInformation.name,
                    tenantInformation.isActive || 1,
                    tenantInformation.referedid,
                    tenantInformation.expirydate,
               ]
          );
          return tenantid;
     }

     async getTenantDetails(tenantid: number): Promise<PrimeLimsTenant | null> {
          const [tenant] = await tenancyConnection.raw(
               `SELECT * FROM registeredclients WHERE tenantid = ?`,
               [tenantid]
          );
          return Array.isArray(tenant) && tenant.length > 0 ? tenant[0] : null
     }

     async getAllTenants(): Promise<PrimeLimsTenant[]> {
          const [tenants] = await tenancyConnection.raw(`SELECT * FROM registeredclients`);
          return tenants;
     }

     async updateTenant(tenantid: number, tenantInformation: Partial<PrimeLimsTenant>): Promise<boolean> {
          const updated = await tenancyConnection.raw(
               `UPDATE registeredclients SET name = ?, type = ?, updatedOn = NOW(), referedid = ?, expirydate = ? 
       WHERE tenantid = ?`,
               [
                    tenantInformation.name,
                    tenantInformation.referedid,
                    tenantInformation.expirydate,
                    tenantid,
               ]
          );
          return updated.affectedRows > 0;
     }

     async deleteTenant(tenantid: number): Promise<boolean> {
          const deleted = await tenancyConnection.raw(
               `DELETE FROM registeredclients WHERE tenantid = ?`,
               [tenantid]
          );
          return deleted.affectedRows > 0;
     }

     async activateTenant(tenantid: number): Promise<boolean> {
          const updated = await tenancyConnection.raw(
               `UPDATE registeredclients SET isActive = 1, updatedOn = NOW() WHERE tenantid = ?`,
               [tenantid]
          );
          return updated.affectedRows > 0;
     }

     async deactivateTenant(tenantid: number): Promise<boolean> {
          const updated = await tenancyConnection.raw(
               `UPDATE registeredclients SET isActive = 0, updatedOn = NOW() WHERE tenantid = ?`,
               [tenantid]
          );
          return updated.affectedRows > 0;
     }

     async verifyTenantId(tenantid: number): Promise<boolean> {
          const [tenant] = await tenancyConnection.raw(
               `SELECT tenantid FROM registeredclients WHERE tenantid = ?`,
               [tenantid]
          );
          return !!tenant;
     }

     async createDatabase(dbName: string): Promise<void> {
          try {
               const status = await tenancyConnection.raw(
                    `CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
               return status
          } catch (err) {
               console.error(`Error creating database ${dbName}:`, err);
          }
     }

     async validateTenantReferedId(referedid: string): Promise<boolean> {
          const tenant = tenancyConnection.raw(`SELECT referedid FROM registeredclients WHERE  referedid = ? `);
          return tenant || !Array.isArray(tenant) || tenant.length == 0 ? false : tenant[0]['referedid'] == referedid.trim();
     }


     async validateTenantStanding(tenantId: number): Promise<boolean> {
          const tenant = await this.getTenantDetails(tenantId);
          return tenant && tenant['isActive'] == 1;
     }

}
