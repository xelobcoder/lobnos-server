const enum clientStatus {
  urgent = "urgent",
  moderate = "moderate",
  routine = "routine",
  normal = "normal",
}




export type servicesProvided = {
  createdBy?: number;
  keyid?: number;
  package_id?: number;
  serviceName: string;
  servicePrice: number;
  discount: number;
  originalValue: number;
  discountedValue: number;
  hasNightAdjustment: boolean;
  nightAdjustmentMode: "percentage" | "absolute" | "none";
  nightAdjustmentValue: number;
  username?: string;
  issystem?: number;
  label?: string;
};



export const serviceCategory : {[key: number]: string}= {
  1: 'GENERAL',
  2: 'ORGANIZATION',
  3: 'PHIS',
  4: 'NHIS',
  6: 'CLINICIAN_SPECIAL_BILLING',
  5: 'SERVICES'
}


export type BillingOutsourceOrganization = {
  outsourceid: number
}

export type TestCart = {
  discountedValue: number,
  testid: number,
  discount: number,
  originalValue?: number,
  id: number,
  package_id?: number,
  isoutsourced?: number;
  hasNightAdjustment?: boolean,
  nightAdjustmentMode?: 'percentage' | 'absolute',
  nightAdjustmentValue?: number
  organization?: BillingOutsourceOrganization,
  isOutsourced?: boolean;
  outsourceid?: number | null;
  amountIncurredDueTax?: number;
  totalcost?: number;
  payable?: number;
}

export type ServiceEntry = {
  billingid: any;
  trackId: number | any;
  cost: number;
  employeeid: number;
  serviceCategory: any | string;
  categoryTrackId: number;
  clinicianId: number;
  organizationId: number;
  registrationType: string;
  branchid: number;
  isoutsourced: boolean | number;
  outsourceid: number;
  nhismembershipid?: number;
  claimscheckcode?: number;
  serviceAddedOn: Date;
  taxList: any;
  taxValue: number;
  amountIncurredDueTax: number;
  taxIncluded: boolean;
  discount: number;
  totalcost: number;
  totalpayable: number;
  isNHIS: number;
  isPHIS: number;
  insuranceid: number;
  claimCode: any;
  hasNightAdjustment: number | boolean;
  nightAdjustmentMode: "percentage" | "absolute" | "none";
  nightAdjustmentValue: number;
  isPackageUsed: number;
  packageid: number | any;
};


export type testAscensionTableTypes = {
  collectionStartDate: Date,
  collectionEndDate: Date,
  processingStartDate: Date,
  processingEndDate: Date,
  resultEntryStart: Date,
  resultEntryEnd: Date,
  month: number,
  year: number,
  actionPlan: string | null,
  declineMessage: string | null,
  testid: number,
  servicedid: number,
  billingid: number,
  printcount: number,
  printtedOn: Date | null,
  approvalStatus: number | boolean
}

export const Client_PLS_Lifecycle = {
  1: 'billing done',
  2: 'collection of sample Initiated',
  3: 'collection of sample concluded',
  4: 'sample validation in progress',
  5: 'sample validation concluded',
  6: 'sample in processing stage',
  7: 'processing of sample done',
  8: ' result entry initiated',
  9: 'result entry concluded',
  10: 'result validation concluded'
}


export const ClientPlsServiceLifecycle = {
  1: "DONE",
  2: "PROGRESSING",
  0: "UNINITIATED"
}

export type testServicesProvided = {
  billingid: number,
  paymentmode: number,
  employeeid: number,
  serviceCategory: number,
  branchid: number,
  clinicianId: number,
  insuranceId: number,
  organizationId: number,
  categoryTrackId: number,
  type: string | number,
  taxValue: number,
  amountIncurredDueTax: number,
  taxIncluded: number,
  taxList: [] | string
}

export type testBillingCartType = {
  concessionMode: string,
  discountedValue: number,
  price: number,
  testid: number,
  name: string
}




export type TBillingData = {
  patientid: number;
  clinicianId: number;
  hasNightAdjustment: boolean,
  organizationId: number;
  test: number[];
  payable: number;
  cart: TestCart[],
  isPackageUsed: boolean,
  nightAdjustmentMode: 'percentage' | 'absolute',
  nightAdjustmentValue: number,
  insuranceId?: number,
  testcost: number;
  billingSource: number,
  paid: number;
  type: string;
  taxIncluded: boolean;
  taxValue: number;
  status: clientStatus;
  discount: number;
  branchid: number,
  paymentmode: number;
  servicesProvided: servicesProvided[];
  billingid: number,
  amountIncurredDueTax: number;
  samplingCenter: number;
  outstanding: number;
  cost: number;
  employeeid: number;
};

export enum ValidationError {
  CartAndServicesNotArrays = "Cart and servicesProvided must be arrays.",
  CartAndServicesEmpty = "Both cart and servicesProvided cannot be empty.",
  InvalidEmployeeId = "Invalid or missing employeeid.",
  InvalidBranchId = "Missing or invalid samplingCenter (branch id).",
  InvalidAmounts = "Amount payable and paid must be numbers.",
  InvalidPatientId = "Missing or invalid patientId.",
  PatientDoesNotExist = "Patient does not exist.",
  PromoCodeRequired = "Promo code is required when isPromo is true.",
  InvalidPaymentMode = "Invalid payment mode in payments array."
}


export enum billErrors {
  already = "client billed on same day. Kindly check the billing history to update billing",
  failed = "billing client failed",
  error = "error occured in processing  transaction",
  badparams = "Bad Request provided",
  unableToUpdateBilling = "Error Updating Billing Information",
  unableToLoadServices = "Error Loading Services Provided",
  unableToLoadTestAscension = "Error Adding data to Test Ascension ",
  noDebtToClear = "No debts found for the patient",
  NoValidBilling = "No valid billing ID provided",
}

export type Pagination = {
  count: number;
  page: number;
};
export interface IBillNewClient {
  readonly patientid: number;
  updateBillingHistory(paymentmode: number, billingid: number, amount: number): any;
  getBranchDayBilledClients(branchid: number, pagination: Pagination): Promise<[]>;
  getTransactionBillData(billingid: number): Promise<[]>;
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



export type BreakingPoint = {
  min: number;
  max: number;
};


export interface Partition {
  tablename: string,

}


/**
 * Represents the interface for managing billing operations.
 */
interface IPartitionManager {
  /**
   * Retrieves all billing partitions associated with a table.
   * @param tablename The name of the table to fetch partitions for.
   * @returns A list of partition names.
   */
  getTablePartitions(tablename: string): Promise<any[]>;

  /**
   * Adds a new partition to the managed table.
   * @param tablename The name of the table to add partitions to.
   * @param year The year for which to add partitions.
   * @returns A promise indicating the success of the operation.
   */
  addYearPartition(tablename: string, year: number): Promise<boolean>;

  /**
   * Drops all partitions from the managed table.
   * @param tablename The name of the table to drop partitions from.
   * @returns A promise indicating the success of the operation.
   */
  dropTablePartition(tablename: string): Promise<any>;

  /**
   * Drops a specific partition from the managed table.
   * @param tablename The name of the table to drop partitions from.
   * @param partitionName The name of the partition to drop.
   * @returns A promise indicating the success of the operation.
   */
  dropTableSpecificPartition(tablename: string, partitionName: string): Promise<any>;
}

export default IPartitionManager;


export const enum BillingValidationResult {
  INVALID_CART_OR_SERVICES = "InvalidCartOrServices",
  EMPTY_CART_AND_SERVICES = "EmptyCartAndServices",
  MISSING_ENTITYID = 'Entity Id not provided',
  INVALID_EMPLOYEE_ID = "InvalidEmployeeID",
  INVALID_PAYMENT_MODE = "InvalidPaymentMode",
  MISSING_BRANCH_ID = "MissingBranchID",
  INVALID_PAYABLE_OR_PAID = "InvalidPayableOrPaid: Field should be a valid number (payable, paid, or discount)",
  MISSING_PATIENT_ID = "MissingPatientID",
  INVALID_PATIENT_ID = "PatientId Invalid",
  INVALID_BILLING_ID = "InvalidBillingId",
  INVALID_MISSING_BILLING_SOURCE = "Billingsource missing or invalid",
  INVALID_BILLING_SOURCE_MATCH = "Provided Billing Source and Detail do not match",
  INVALID_PROMO_CODE = "InvalidPromoCode"
}




