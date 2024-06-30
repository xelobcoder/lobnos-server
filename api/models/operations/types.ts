export const enum OperationsFailures {
  notready = "billingid  not ready for result entry",
}



export type resultQuery = {
  from: string;
  to: string;
  patientid: number;
  billingid: number;
  sortingwise: number;
  count: number;
  page: number;
};

export type OperationsFilterResultEntry = {
  count: number;
  page: number;
  department: number | string;
  status: string;
  testid: number;
  fullname: string;
  from: string;
  to: string;
};