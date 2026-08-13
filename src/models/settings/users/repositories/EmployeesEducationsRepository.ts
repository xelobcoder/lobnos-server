import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesEducationEntity } from '../entities/employees.entities';

export default class EmployeesEducationsRepository {
     private connection;
     private tableName = 'employees_education';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesEducationEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(educationId: number): Promise<EmployeesEducationEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ educationId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesEducationEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(educationId: number, data: Partial<EmployeesEducationEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ educationId }).update(data);
     }

     async delete(educationId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ educationId }).del();
     }
}
