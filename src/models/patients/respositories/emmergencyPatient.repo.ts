import KnexConnection from "../../../database/KnexConnections";
import { ICreateEmergencyPatient } from "../interfaces";

export default class EmergencyPatientRepo {
     private connection: any;
     private tableName: string;
     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
          this.tableName = "patientemmergencycontactinformation";
     }

     create = async (emergencyPatient: ICreateEmergencyPatient): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection(this.tableName).insert(emergencyPatient);
          } catch (error) {
               console.error("Error creating emergency patient:", error);
               throw new Error("Error creating emergency patient");
          }
     }

     update = async (patientid: number, emergencyPatient: Partial<ICreateEmergencyPatient>): Promise<boolean> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .update(emergencyPatient);
               return result > 0;
          } catch (error) {
               console.error("Error updating emergency patient:", error);
               throw new Error("Error updating emergency patient");
          }

     }

     get = async (patientid: number): Promise<ICreateEmergencyPatient | null> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .first();
               return result || null;
          } catch (error) {
               console.error("Error fetching emergency patient:", error);
               throw new Error("Error fetching emergency patient");
          }
     }


     delete = async (patientid: number): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection(this.tableName)
                    .where({ patientid })
                    .del();
          }
          catch (error) {
               console.error("Error deleting emergency patient:", error);
               throw new Error("Error deleting emergency patient");
          }
     }



     findByPatientId = async (patientid: number): Promise<ICreateEmergencyPatient | null> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .first();
               return result || null;
          } catch (error) {
               console.error("Error finding emergency patient by patientid:", error);
               throw new Error("Error finding emergency patient by patientid");
          }
     }
}