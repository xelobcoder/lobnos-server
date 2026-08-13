import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesContactEntity } from '../entities/employees.entities';

export default class EmployeesContactsRepository {
     private connection;
     private tableName = 'employees_contacts';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesContactEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(contactId: number): Promise<EmployeesContactEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ contactId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesContactEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).first();
     }

     async update(contactId: number, data: Partial<EmployeesContactEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ contactId }).update(data);
     }

     async delete(contactId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ contactId }).del();
     }
}
