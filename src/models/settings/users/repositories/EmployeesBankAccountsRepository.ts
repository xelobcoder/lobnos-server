import KnexConnection from '../../../../database/KnexConnections';
import { EmployeesBankAccountEntity } from '../entities/employees.entities';

export default class EmployeesBankAccountsRepository {
     private connection;
     private tableName = 'employees_bank_accounts';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async create(data: Partial<EmployeesBankAccountEntity>): Promise<number> {
          const connection = await this.connection;
          const [result] = await connection(this.tableName).insert(data);
          return Number(result);
     }

     async findById(bankAccountId: number): Promise<EmployeesBankAccountEntity | undefined> {
          const connection = await this.connection;
          return connection(this.tableName).where({ bankAccountId }).first();
     }

     async findByEmployeeId(employeeId: number): Promise<EmployeesBankAccountEntity[]> {
          const connection = await this.connection;
          return connection(this.tableName).where({ employeeId }).select('*');
     }

     async update(bankAccountId: number, data: Partial<EmployeesBankAccountEntity>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ bankAccountId }).update(data);
     }

     async delete(bankAccountId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tableName).where({ bankAccountId }).del();
     }
}
