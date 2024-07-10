export const enum OperationsFailures {
  notready = "billingid  not ready for result entry",
}



export type resultQuery = {
  from: string;
  to: string;
  patientid: number;
  fullname?: string;
  billingid: number;
  sortingwise: number;
  count: number;
  page: number;
};




export type ProcessedScan = {
  search: string,
  from: string,
  count: number,
  page:number,
  to:string
}



export interface OperationsFilterResultEntry {
  fullname?: string;
  count?: number;
  page?: number;
  departmentid?: number| string;
  testid?: number;
  status?: string;
  from?: string;
  to?: string;
}
