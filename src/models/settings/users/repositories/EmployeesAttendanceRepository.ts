import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesAttendanceEntity } from '../entities/employees.entities';

export default class EmployeesAttendanceRepository {
     private connection;
     private tableName = 'employees_attendance';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesAttendanceEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(attendanceId: number): Promise<EmployeesAttendanceEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ attendanceId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesAttendanceEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(attendanceId: number, data: Partial<EmployeesAttendanceEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ attendanceId }).update(data);
     }

     async delete(attendanceId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ attendanceId }).del();
     }
}
