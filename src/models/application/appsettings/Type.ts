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
export type ApplicationSettingsData = {
     id: number;
     bulkregistration: string;
     fontsize: string;
     textcolor: string;
     BackgroundColor: string;
     DeactivateBilling24hrs: string;
     PaidBillsBeforeTransaction: number;
     completeFlow: string;
     approvalbeforeprinting: string;
     emailNotification: number;
     includeTax: number;
     services: string | null
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