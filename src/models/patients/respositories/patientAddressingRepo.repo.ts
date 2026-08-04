import KnexConnection from "../../../database/KnexConnections";
import { IPatientAddressing } from "../interfaces";

export default class PatientAddressingRepo {
     private connection: any
     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }


     create = async (patientAddressing: IPatientAddressing): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection("patientsaddress").insert(patientAddressing);
          } catch (error) {
               console.error("Error creating patient addressing:", error);
               throw new Error("Error creating patient addressing");
          }
     };

     update = async (patientid: number, patientAddressing: Partial<IPatientAddressing>): Promise<boolean> => {
          try {
               const connection = await this.connection;
               const result = await connection("patientsaddress")
                    .where({ patientid })
                    .update(patientAddressing);
               return result > 0;

          } catch (error) {
               console.error("Error updating patient addressing:", error);
               throw new Error("Error updating patient addressing");
          }
     }

     get = async (patientid: number): Promise<IPatientAddressing | null> => {
          try {
               const connection = await this.connection;
               const result = await connection("patientsaddress")
                    .where({ patientid })
                    .first();
               return result || null;
          } catch (error) {
               console.error("Error fetching patient addressing:", error);
               throw new Error("Error fetching patient addressing");
          }
     }



     delete = async (patientid: number): Promise<void> => {
          try {
               const connection = await this.connection;
               await connection("patientsaddress")
                    .where({ patientid })
                    .del();
          } catch (error) {
               console.error("Error deleting patient addressing:", error);
               throw new Error("Error deleting patient addressing");
          }
     }
}