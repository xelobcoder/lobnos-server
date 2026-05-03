// ClientPLSLifecycle and ClientPlsServiceLifecycle (Go map[int]string equivalent)
export const ClientPLSLifecycle: { [key: number]: string } = {
     1: "billing done",
     2: "collection of sample Initiated",
     3: "collection of sample concluded",
     4: "sample validation in progress",
     5: "sample validation concluded",
     6: "sample in processing stage",
     7: "processing of sample done",
     8: " result entry initiated",
     9: "result entry concluded",
     10: "result validation concluded",
};

export const ClientPlsServiceLifecycle: { [key: number]: string } = {
     1: "DONE",
     2: "PROGRESSING",
     0: "UNINITIATED",
};

export type MultiTestServicesProvided = {
     billingid: number;
     paymentmode: number;
     employeeid: number;
     serviceCategory: number;
     branchid: number;
     clinicianId: number;
     insuranceId: number;
     organizationId: number;
     categoryTrackId: number;
     type: string | number;
     taxValue: number;
     keyid: number;
     amountIncurredDueTax: number;
     taxIncluded: number;
     taxList: any;
};

export type MultiTestBillingCartType = {
     concessionMode: string;
     discountedValue: number;
     price: number;
     testid: number;
     name: string;
};

export type PromoDetails = {
     id: number;
     code: string;
     description: string;
     campaign_id: number | null;
     discount_type: 'flat' | 'percentage';
     discount_value: string;
     max_uses: number;
     times_used: number;
     is_active: number;
     valid_from: string;
     valid_to: string;
     created_at: string;
     updated_at: string;
};

export type MultiTBillingDataShared = {
     patientid: number;
     hasNightAdjustment: boolean;
     test: number[];
     payable: number;
     cart: any[];
     isPackageUsed: boolean;
     nightAdjustmentMode: string;
     nightAdjustmentValue: number;
     clinicianId?: number;
     organizationId?: number;
     testcost: number;
     nhismembershipid?: number;
     result_delivery:any;
     claimscheckcode?: number;
     billingSource: number;
     paid: number;
     type: string;
     taxIncluded: boolean;
     taxValue: number;
     taxList: any;
     entitytype: EntityType;
     entityid: number;
     status: string;
     discount: number;
     branchid: number;
     paymentmode: any;
     servicesProvided: any[];
     billingid: number;
     amountIncurredDueTax: number;
     samplingCenter: number;
     outstanding: number;
     cost: number;
     employeeid: number;
     promocode?: string;
     promotype?: string;
     ispromo?: boolean;
     promovalue?: number;
     entityId?: number;
     isPromo?: boolean;
     isPromoValid?: boolean;
     promoMethod?: 'flat' | 'percentage';
     promoAmount?: number;
     promo?: PromoDetails;
};

export enum BillErrors {
     Already = "client billed on same day. Kindly check the billing history to update billing",
     Failed = "billing client failed",
     Error = "error occured in processing  transaction",
     BadParams = "Bad Request provided",
     UnableToUpdateBilling = "Error Updating Billing Information",
     UnableToLoadServices = "Error Loading Services Provided",
     UnableToLoadTestAscension = "Error Adding data to Test Ascension ",
     NoDebtToClear = "No debts found for the patient",
     NoBillingSession = "No active billing session found for the given date and sampling center",
}

export type CalculateBillingVariablesFinalResult = {
     payable: number;
     outstanding: number;
     totalDiscount: number;
     amountIncurredDueTax: number;
     totalCost: number;
};

export type PayableServiceResult = {
     payable: number;
     amountIncurredDueTax: number;
     totalDiscount: number;
     totalCost: number;
};


export type EntityType = 'general' | 'organization' | 'insurance' | 'clinician' | 'phis';

export interface MultiBillingFailuresType {
     notOrganizationSelected: string;
     notClinicianSelected: string;
     cartEmpty: string;
     serviceAndCartEmpty: string;
     fullPayment: string;
     requiredParametersMissed: string;
     wrongTaxCalculations: string;
     invalidBillingData: string;
}

