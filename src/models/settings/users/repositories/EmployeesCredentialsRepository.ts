import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesCredentialEntity } from '../entities/employees.entities';

export default class EmployeesCredentialsRepository {
     private connection;
     private tableName = 'employees_credentials';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesCredentialEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(credentialId: number): Promise<EmployeesCredentialEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ credentialId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesCredentialEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).first();
     }

     async findByUsername(username: string): Promise<EmployeesCredentialEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ username }).first();
     }

     async update(credentialId: number, data: Partial<EmployeesCredentialEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ credentialId }).update(data);
     }

     async delete(credentialId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ credentialId }).del();
     }
}
