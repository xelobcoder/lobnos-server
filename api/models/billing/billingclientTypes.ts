const enum clientStatus {
  urgent = "urgent",
  moderate = "moderate",
  routine = "routine",
  normal = "normal",
}


export type TBillingData = {
  patientid: number;
  clinician: number;
  organization: number;
  test: number[];
  payable: number;
  testcost: number;
  paid: number;
  type: string;
  taxIncluded: boolean;
  taxValue: number;
  status: clientStatus;
  discount: number;
  branchid: number,
  paymentmode: number;
  samplingCenter: number;
  outstanding: number;
  cost: number;
  employeeid: number;
};

export enum billErrors {
  already = "client billed on same day. Kindly check the billing history to update billing",
  failed = "billing client failed",
  error = "error occured in processing  transaction",
  badparams = "Bad Request provided",
}

export type Pagination = {
  count: number;
  page: number;
};
export interface IBillNewClient {
  readonly patientid: number;
  updateBillingHistory(paymentmode: number, billingid: number, amount: number): any;
  billClient(data: TBillingData): any;
  getBranchDayBilledClients(branchid: number, pagination: Pagination): Promise<[]>;
}

export interface ISales {
  getDailySalesSummary(branchid: number | string);
  getYearlySalesSummary(branchid: number | string);
  getMonthlySalesSummary(branchid: number | string);
  getMonthDailySalesSummary(branchid: number | string);
}

export type AscensionParameter = {
  billingid: number;
  testidCollection: number[];
};

export type AddingTablePartion = {
  tableName: string;
  columns: string[];
  prefix: string;
  suffix: string;
};