import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesCertificationEntity } from '../entities/employees.entities';

export default class EmployeesCertificationsRepository {
     private connection;
     private tableName = 'employees_certifications';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesCertificationEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(certificationId: number): Promise<EmployeesCertificationEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ certificationId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesCertificationEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(certificationId: number, data: Partial<EmployeesCertificationEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ certificationId }).update(data);
     }

     async delete(certificationId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ certificationId }).del();
     }
}
