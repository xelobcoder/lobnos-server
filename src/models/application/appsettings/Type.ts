import { WorkspaceLayout } from './workspaceLayout';
import { BillingLayout } from './billingLayout';

type numberBoolean = 0 | 1;

export function jsonify<T>(value: string): T {
     return JSON.parse(value);
}
export type connectedServices = {
     isConnectedInventory: numberBoolean,
     isPhysicianOfficeConnected: numberBoolean,
     isSupplierConnected: numberBoolean,
     isDoctorPortalConnected: numberBoolean,
     isResultAnalysisConnected: numberBoolean,
     isPatientPortalConnected: numberBoolean,
     isSmsServicesConnected: numberBoolean,
     isEmailServicesConnected: numberBoolean,
}
export type smsSettings = {
     result: string;
     registration: string;
     sample: string;
     birthday: string;
};

export type billingsettings = {
     hasNightAdjustment: boolean;
     nightAdjustmentValue: string;
     nightAdjustmentMode: string;
     startTime: string;
     endTime: string;
};

export type ApplicationSettingsData = {
     keyid: number;
     bulkregistration: number;
     ageVariationLimits: string | null;
     fontsize: string;
     textcolor: string;
     BackgroundColor: string;
     headerColor?: string | null;
     sidebarColor?: string | null;
     pageBackgroundColor?: string | null;
     headerTextColor?: string | null;
     sidebarTextColor?: string | null;
     primaryColor?: string | null;
     secondaryColor?: string | null;
     workspaceLayout?: WorkspaceLayout;
     billingLayout?: BillingLayout;
      labCheckoutMode?: 'direct' | 'separate_cashier';
     DeactivateBilling24hrs: number;
     allowManagerToRefund: numberBoolean;
     makepdfprintingcompulsory: numberBoolean;
     allowCrmToPrintResult: numberBoolean;
     PaidBillsBeforeTransaction: number;
     completeFlow: number;
     approvalbeforeprinting: number;
     show_watermark: numberBoolean;
     pinOnResultValidation: number;
     withnessRefund: number;
     smsActivated: number;
     allowScientistToRegisterClient: numberBoolean;
     homeCollectionPromptEnabled?: numberBoolean;
     resultDeliveryPromptEnabled?: numberBoolean;
     pinOnResultEntry: number;
     patientIdGenerationMethod: string | null;
     automakesupplierpaymentsexpense: numberBoolean;
     smsSettings: smsSettings;
     emailNotification: number;
     emailModuleActivated?: numberBoolean;
     moduleConfiguration?: string | null;
     includeTax: number;
     AllowCrmToGiveDisocunt
     : numberBoolean;
     patientIdPrefix: string | null;
     fontFamily: string | null;
     billingidPrefix: string | null;
     services: string | null;
     billingsettings: billingsettings;
     regioncode: number;
     districtcode: number;
     country_code?: string | null;
     record_commission_payments_as_expense: boolean;
     recoord_outsourced_services_as_expense: boolean;
     allowValidationUpaid?: numberBoolean;
     allowPrintingUnpaid?: numberBoolean;
     allowResultEnteringUpaid?: numberBoolean;
     byPassCollection?: numberBoolean;
     byPassSampleValidation?: numberBoolean;
     byPassValidation?: numberBoolean;
     byPassProcessing?: numberBoolean;
     automakeemployeepayrollpaymentsexpense?: numberBoolean;
     automakeoutsourcepaymentsexpense?: numberBoolean;
     automakecommissionpaymentsexpense?: numberBoolean;
     useamountpaidforcommissioncalculation?: numberBoolean;
     allowManagerToApproveExpenses?: numberBoolean;
     allowManagerToProcessPayroll?: numberBoolean;
     allowManagerToProcessCommission?: numberBoolean;
     isCommissionEarnedOnClinicianBilling: numberBoolean;
     commissionRecipientPolicy?: 'clinician' | 'organization';
     isCommissionEarnedOnOrganizationalBilling: numberBoolean;
     isCommissionEarnedOnNHISBilling: numberBoolean;
     isCommissionEarnedOnPHISBilling: numberBoolean;
};



export type ApplicationBillSettings = {
     startTime: string,
     endTime: string,
     hasNightAdjustment: boolean,
     nightAdjustmentMode: string,
     nightAdjustmentValue: string
}


export type EmailPreference = {
     registration: string;
     result: string;
     rejection: string;
     approval: string;
     transactions: string;
     birthday: string;
     billing: string;
};

export type AppSetting = {
     includeTax: number;
     PaidBillsBeforeTransaction: number;
     taxValue?: number;
};

export const  enum AppError {
     failed = "operation failed",
     success = "success",
}



export type IupdateRegisFields = {
     fields: string;
     employeeid: number;
};
