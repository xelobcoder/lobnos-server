import KnexConnection from "../../../database/KnexConnections";
import { IPatientCredentials } from "../interfaces";
import bcrypt from "bcrypt";

export default class CredentialsPatientRepository {
     private connection: any;
     private tableName: string

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
          this.tableName = "patients_credentials";
     }

     create = async (credentials: IPatientCredentials): Promise<void> => {
          try {
               const connection = await this.connection;
               const hashedPassword = await bcrypt.hash(credentials.password, 10);
               await connection(this.tableName).insert({ ...credentials, password: hashedPassword });
          } catch (error) {
               console.error("Error creating patient credentials:", error);
               throw new Error("Error creating patient credentials");
          }
     }


     update = async (patientid: number, credentials: Partial<IPatientCredentials>): Promise<boolean> => {
          try {
               const connection = await this.connection;
               if (!credentials.username || !credentials.password) {
                    throw new Error("At least one of username or password must be provided for update");
               }
               const hashedPassword = await bcrypt.hash(credentials.password, 10)
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .update({ ...credentials, updated_on: new Date(), password: hashedPassword });
               return result > 0;
          } catch (error) {
               console.error("Error updating patient credentials:", error);
               throw new Error("Error updating patient credentials");
          }
     }

     get = async (patientid: number): Promise<{ username: string; password: string } | null> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .first();
               return result || null;
          } catch (error) {
               console.error("Error fetching patient credentials:", error);
               throw new Error("Error fetching patient credentials");
          }
     }


     delete = async (patientid: number): Promise<boolean> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .del();
               return result > 0;
          } catch (error) {
               console.error("Error deleting patient credentials:", error);
               throw new Error("Error deleting patient credentials");
          }
     }

}