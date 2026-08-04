import KnexConnection from "../../../database/KnexConnections";
import { TiifuWorkingClass } from "../../../database/TiifuWorkingClass";
import { ICreateNewPatient } from "../interfaces";

export default class NewPatientsRepo {
     private connection: any;
     private tableName: string;
     private tenantId: number;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
          this.tableName = "new_patients";
          this.tenantId = tenantId;
     }



     create = async (newPatient: ICreateNewPatient): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection(this.tableName).insert(newPatient);
          } catch (error) {
               console.error("Error creating new patient:", error);
               throw new Error("Error creating new patient");
          }
     }


     get = async (patientid: number): Promise<ICreateNewPatient | null> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .first();
               return result || null;
          } catch (error) {
               console.error("Error fetching new patient:", error);
               throw new Error("Error fetching new patient");
          }
     }

     update = async (patientid: number, newPatient: Partial<ICreateNewPatient>): Promise<boolean> => {
          try {
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .update(newPatient);
               return result > 0;
          } catch (error) {
               console.error("Error updating new patient:", error);
               throw new Error("Error updating new patient");
          }

     }


     delete = async (patientid: number): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection(this.tableName)
                    .where({ patientid })
                    .del();
          } catch (error) {
               console.error("Error deleting new patient:", error);
               throw new Error("Error deleting new patient");
          }
     }


     softDelete = async (patientid: number): Promise<boolean> => {
          try {
               await new TiifuWorkingClass(this.tableName).createColumnIfNotExists(this.tenantId, "is_deleted", "BOOLEAN DEFAULT FALSE");
               const connection = await this.connection;
               const result = await connection(this.tableName)
                    .where({ patientid })
                    .update({ is_deleted: true });
               return result > 0;
          }
          catch (error) {
               console.error("Error soft deleting new patient:", error);
               throw new Error("Error soft deleting new patient");
          }
     }
}