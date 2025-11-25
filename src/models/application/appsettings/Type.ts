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
     fontsize: string;
     textcolor: string;
     BackgroundColor: string;
     DeactivateBilling24hrs: number;
     PaidBillsBeforeTransaction: number;
     completeFlow: number;
     approvalbeforeprinting: number;
     smsActivated: number;
     smsSettings: smsSettings;
     emailNotification: number;
     includeTax: number;
     patientIdPrefix: string | null;
     fontFamily: string | null;
     billingidPrefix: string | null;
     services: string | null;
     billingsettings: billingsettings;
     regioncode: number;
     districtcode: number;
     record_commission_payments_as_expense: boolean;
     recoord_outsourced_services_as_expense: boolean;
};



export type ApplicationBillSettings = {
     startTime: number,
     endTime: number,
     hasNightAdjustments: boolean,
     nightAdjustmentMode: boolean,
     nightAdjustmentValue: boolean
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