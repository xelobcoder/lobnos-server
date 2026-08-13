import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesPerformanceReviewEntity } from '../entities/employees.entities';

export default class EmployeesPerformanceReviewsRepository {
     private connection;
     private tableName = 'employees_performance_reviews';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesPerformanceReviewEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(reviewId: number): Promise<EmployeesPerformanceReviewEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ reviewId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesPerformanceReviewEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(reviewId: number, data: Partial<EmployeesPerformanceReviewEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ reviewId }).update(data);
     }

     async delete(reviewId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ reviewId }).del();
     }
}
