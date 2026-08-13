import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesDesignationEntity } from '../entities/employees.entities';

export default class EmployeesDesignationsRepository {
     private connection;
     private tableName = 'employees_designations';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesDesignationEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(designationId: number): Promise<EmployeesDesignationEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ designationId }).first();
     }

     async findAll(): Promise<EmployeesDesignationEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).select('*');
     }

     async update(designationId: number, data: Partial<EmployeesDesignationEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ designationId }).update(data);
     }

     async delete(designationId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ designationId }).del();
     }
}
