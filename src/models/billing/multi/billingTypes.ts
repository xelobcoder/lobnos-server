// Billing types and interfaces for billing module

export const BillingModuleCodes = {
     MODULE_DEBT: 'outstanding debt found',
     MODULE_NO_SESSION: 'no active sales session found',
     MODULE_NO_VALID_BILLING_ID: 'no valid billing ID provided',
     MODULE_NO_PATIENT_ID: 'no patient ID provided',
     BILLINGSOURCE_NOT_PROVIDED: 'billing source not provided',
     NO_PACKAGES_FOUND_FOR_ENTITY: 'no packages found for entity',
     NO_PACKAGE_ID_SPECIFIED: 'no package id specified',
     INVALID_PACKAGE_PROVIDED: 'invalid package provided',
     BRANCH_ID_NOT_PROVIDED: 'branch id not provided',
     MODULE_NO_VALID_BILLING: 'Invalid Billing ID provided',
} as const;



export interface CustomerInitResponse {
     testList: BillingTestItem[];
     previousRecords: any[];
     packageTestList: BillingTestItem[];
     previousRecordsSummary: any | null;
     refundList: any[];
     previousPaymentHistory?: any[];
     subtotal: number;
     totaldiscount: number;
     totalAmountIncurredDueTax: number;
     paid: number;
     balance: number;
     includeServices: boolean;
     promoCode?: string;
     billingid?: number;
     taxIncluded?: boolean;
     taxList?: any;
     billingSource?: number;
     servicesProvided: any[];
     branchid: number;
     cart: any[],
     packageid?: number;
     hasNightAdjustment?: boolean;
     nightAdjustmentValue?: number;
     nightAdjustmentMode?: string;
     totalServiceAmount: number;
     startTime?: string;
     endTime?: string;
     referalCode?: number;
     taxValue?: number;
     entityId?: number;
     entityType?: any;
     patientId: number;
     isPackageUsed?: boolean;
     totalcost: number;
     totalServiceAmountPayable: number;
     amountPayable: number;
     testPayableAmount?: number;
     outstanding?: number;
     isPromo?: boolean;
     promoValue?: number;
     promoMethod?: string;
     promoCodeId?: string;
}

export interface BillingTestItem {
     actualPrice: number;
     paidamount: number;
     status?: string;
     amountIncurredDueTax: number;
     concessionMode: "absolute" | "percentage" | string;
     concessionValue: number | string;
     discount: number;
     discountedValue: number;
     paymentstatus: 'pending' | 'partial' | 'paid' | string;
     hasNightAdjustment: boolean;
     id: number;
     outsourceprice?: number;
     isoutsourced: number;
     name: string;
     totalpayable: number;
     totalcost: number;
     nightAdjustmentEndTime: string;
     nightAdjustmentMode: "percentage" | "absolute" | string;
     nightAdjustmentStartTime: string;
     nightAdjustmentValue: number;
     originalPrice: number;
     price: number;
     pricingType: string;
     cost?: number;
     subtotal: number;
     testid: number;
     outsourceid?: number | null;
}
