import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesLicenseEntity } from '../entities/employees.entities';

export default class EmployeesLicensesRepository {
     private connection;
     private tableName = 'employees_licenses';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesLicenseEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(licenseId: number): Promise<EmployeesLicenseEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ licenseId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesLicenseEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(licenseId: number, data: Partial<EmployeesLicenseEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ licenseId }).update(data);
     }

     async delete(licenseId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ licenseId }).del();
     }
}
