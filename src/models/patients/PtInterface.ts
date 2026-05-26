import { PrimeLimsTablepatients_credentials } from "../../database/DatabaseTableSchema";
import { UpdateCredentialsRequest } from "./types";

export interface IPatient {
  getTransactionsByDate(tenantId:number, patientid: number, to?: string, from?: string): Promise<any>;

  updateCredentials(tenantId:number, data:UpdateCredentialsRequest): Promise<boolean>;

  updateNotificationSettings(tenantId:number, data): Promise<boolean>;

  transformDataset(list: any[], data: any[]): Promise<any>;

  getPatientNotificationSettings(tenantId:number,patientid: number): Promise<PrimeLimsTablepatients_credentials>;

  getParameters(data: any[]): Promise<any>;


}
