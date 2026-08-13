import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesRoleAssignmentEntity } from '../entities/employees.entities';

export default class EmployeesRoleAssignmentsRepository {
     private connection;
     private tableName = 'employees_role_assignments';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: EmployeesRoleAssignmentEntity): Promise<void> {
          const connection = await this.connection;
          await connection(this.tableName).insert(data);
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesRoleAssignmentEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async findByRoleId(roleId: number): Promise<EmployeesRoleAssignmentEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ roleId }).select('*');
     }

     async delete(employeeId: number, roleId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId, roleId }).del();
     }
}
