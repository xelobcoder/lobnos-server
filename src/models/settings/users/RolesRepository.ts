import { PrimeLimsTableroles } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";

export default class RolesRepository {
    private connection;
    private tablename: string = 'roles';

    constructor(tenantId: number) {
        this.connection = KnexConnection(tenantId);
        this.tablename = "roles";
    }

    async createRole(roleData: any): Promise<number> {
        const connection = await this.connection
        const result = await connection(this.tablename).insert(roleData).returning('id')
        return result[0]
    }

    async getRoleById(employeeId: number): Promise<PrimeLimsTableroles> {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).first()
        return result
    }

    async getRoleByEmail(email: string): Promise<PrimeLimsTableroles> {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ email: email }).first()
        return result
    }

    async isRoleValid(expectedRole: string, employeeId: number): Promise<boolean> {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).first()
        return result && result.role === expectedRole
    }

    async updateRole(employeeId: number, roleData: any): Promise<number> {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).update(roleData)
        return result
    }

    async deleteRole(employeeId: number): Promise<number> {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ employeeid: employeeId }).del()
        return result
    }

    async getAllRoles(): Promise<any[]> {
        const connection = await this.connection;
        const result = await connection(this.tablename).select('*')
        return result
    }

    async getEmployeeRole(employeeId: number): Promise<string | undefined> {
        const employee = await this.getRoleById(employeeId);
        return employee && employee.role
    }

    async validatePin(employeeId: number, pin: number): Promise<boolean> {
        const employee = await this.getRoleById(employeeId);
        return employee && employee.pin && pin.toString().length == 4 && parseInt(employee.pin.toString()) == pin
    }


    async getEmployeesList(employeelist: number[]) {
        const stringedValues = Array.isArray(employeelist) && employeelist.length > 0 ;
        if (stringedValues) {
            const connection = await this.connection;
            const result = await connection(this.tablename).whereIn('employeeid',employeelist)
            return result
        }
    }

}