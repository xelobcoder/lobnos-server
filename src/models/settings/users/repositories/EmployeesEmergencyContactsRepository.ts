import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesEmergencyContactEntity } from '../entities/employees.entities';

export default class EmployeesEmergencyContactsRepository {
     private connection;
     private tableName = 'employees_emergency_contacts';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesEmergencyContactEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(emergencyContactId: number): Promise<EmployeesEmergencyContactEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ emergencyContactId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesEmergencyContactEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(emergencyContactId: number, data: Partial<EmployeesEmergencyContactEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ emergencyContactId }).update(data);
     }

     async delete(emergencyContactId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ emergencyContactId }).del();
     }
}
