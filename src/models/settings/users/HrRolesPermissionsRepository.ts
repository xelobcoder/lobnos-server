import KnexConnection from "../../../database/KnexConnections";
import { HrRolesPermissions } from "./HrEmployeeEmergencyContInterfaces";

export default class HrRolesPermissionsRepository {
    private connection;
    private tablename: string = 'hr_rolespermissions';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
    }

    async createRolePermission(data: Partial<HrRolesPermissions>): Promise<number> {
        const connection = await this.connection;
        const result = await connection(this.tablename).insert(data).returning('roleid');
        return result[0];
    }

    async getRolePermissionById(roleid: number): Promise<HrRolesPermissions | undefined> {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).first();
    }

    async getRolePermissionsByEmployee(employeeid: number): Promise<HrRolesPermissions[]> {
        const connection = await this.connection;
        return connection(this.tablename).where({ employeeid });
    }

    async updateRolePermission(roleid: number, data: Partial<HrRolesPermissions>): Promise<number> {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).update(data);
    }

    async deleteRolePermission(roleid: number): Promise<number> {
        const connection = await this.connection;
        return connection(this.tablename).where({ roleid }).del();
    }

    async getAllRolePermissions(): Promise<HrRolesPermissions[]> {
        const connection = await this.connection;
        return connection(this.tablename).select('*');
    }
    }