import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesRolePermissionEntity } from '../entities/employees.entities';

export default class EmployeesRolePermissionsRepository {
     private connection;
     private tableName = 'employees_role_permissions';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: EmployeesRolePermissionEntity): Promise<void> {
          const connection = await this.connection;
          await connection(this.tableName).insert(data);
     }

     async findByRoleId(roleId: number): Promise<EmployeesRolePermissionEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ roleId }).select('*');
     }

     async findByPermissionId(permissionId: number): Promise<EmployeesRolePermissionEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ permissionId }).select('*');
     }

     async delete(roleId: number, permissionId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ roleId, permissionId }).del();
     }
}
