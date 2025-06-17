import KnexConnection from "../../../database/KnexConnections";
import { HrEmployeeLoginCredentials } from "./HrEmployeeEmergencyContInterfaces";


export default class HrEmployeeLoginCredentialsRepository {
     private connection;
     private tablename: string = 'hr_employeelogincredentials';

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async createCredentials(credentialsData: Partial<HrEmployeeLoginCredentials>): Promise<number> {
          const connection = await this.connection;
          const result = await connection(this.tablename).insert(credentialsData).returning('credentialid');
          return result[0];
     }

     async getCredentialsById(credentialId: number): Promise<HrEmployeeLoginCredentials | undefined> {
          const connection = await this.connection;
          return connection(this.tablename).where({ credentialid: credentialId }).first();
     }

     async getCredentialsByEmployee(employeeId: number): Promise<HrEmployeeLoginCredentials | undefined> {
          const connection = await this.connection;
          return connection(this.tablename).where({ employeeid: employeeId }).first();
     }

     async updateCredentials(credentialId: number, credentialsData: Partial<HrEmployeeLoginCredentials>): Promise<number> {
          const connection = await this.connection;
          return connection(this.tablename).where({ credentialid: credentialId }).update(credentialsData);
     }

     async deleteCredentials(credentialId: number): Promise<number> {
          const connection = await this.connection;
          return connection(this.tablename).where({ credentialid: credentialId }).del();
     }

     async getAllCredentials(): Promise<HrEmployeeLoginCredentials[]> {
          const connection = await this.connection;
          return connection(this.tablename).select('*');
     }
}