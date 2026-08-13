import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesDocumentEntity } from '../entities/employees.entities';

export default class EmployeesDocumentsRepository {
     private connection;
     private tableName = 'employees_documents';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesDocumentEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(documentId: number): Promise<EmployeesDocumentEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ documentId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesDocumentEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(documentId: number, data: Partial<EmployeesDocumentEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ documentId }).update(data);
     }

     async delete(documentId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ documentId }).del();
     }
}
