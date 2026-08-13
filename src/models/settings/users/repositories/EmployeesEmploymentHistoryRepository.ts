import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesEmploymentHistoryEntity } from '../entities/employees.entities';

export default class EmployeesEmploymentHistoryRepository {
     private connection;
     private tableName = 'employees_employment_history';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesEmploymentHistoryEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(historyId: number): Promise<EmployeesEmploymentHistoryEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ historyId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesEmploymentHistoryEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(historyId: number, data: Partial<EmployeesEmploymentHistoryEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ historyId }).update(data);
     }

     async delete(historyId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ historyId }).del();
     }
}
