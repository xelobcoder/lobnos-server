import { PrimeLimsTablepatients_credentials } from "../../database/DatabaseTableSchema";

export interface IPatient {
  getTransactionsByDate(tenantId:number, patientid: number, to?: string, from?: string): Promise<any>;

  updateNotificationSettings(tenantId:number, data:any): Promise<boolean>;

  transformDataset(list: any[], data: any[]): Promise<any>;

  getPatientNotificationSettings(tenantId:number,patientid: number): Promise<PrimeLimsTablepatients_credentials>;

  getParameters(data: any[]): Promise<any>
}
