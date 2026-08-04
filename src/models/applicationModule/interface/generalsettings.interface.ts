type numberBoolean = 0 | 1;

export interface IAgeVariationLimits {
    enabled: boolean;
    limits: unknown[];
}

export interface IBillingSettings {
    hasNightAdjustment: boolean;
    nightAdjustmentValue: number;
    nightAdjustmentMode: "amount" | "percentage";
    startTime: string;
    endTime: string;
}

export interface IApplicationBillingSettings {
    startTime: string;
    endTime: string;
    hasNightAdjustment: boolean;
    nightAdjustmentMode: "amount" | "percentage";
    nightAdjustmentValue: number;
}

export interface ISmsSettings {
    result: string;
    registration: string;
    sample: string;
    birthday: string;
}

export interface IApplicationSettingsDataEntity {
    keyid: number;
    bulkregistration: numberBoolean;
    ageVariationLimits: IAgeVariationLimits | null;
    fontsize: string;
    textcolor: string;
    BackgroundColor: string;
    DeactivateBilling24hrs: numberBoolean;
    PaidBillsBeforeTransaction: numberBoolean;
    completeFlow: numberBoolean;
    approvalbeforeprinting: numberBoolean;
    show_watermark: numberBoolean;
    pinOnResultValidation: numberBoolean;
    pinOnResultEntry: numberBoolean;
    withnessRefund: numberBoolean;
    smsActivated: numberBoolean;
    allowScientistToRegisterClient: numberBoolean;
    allowManagerToRefund: numberBoolean;
    makepdfprintingcompulsory: numberBoolean;
    patientIdGenerationMethod: "prefix" | "region";
    patientIdPrefix: string | null;
    billingidPrefix: string | null;
    fontFamily: string | null;
    smsSettings: ISmsSettings;
    emailNotification: numberBoolean;
    includeTax: numberBoolean;
    AllowCrmToGiveDisocunt: numberBoolean;
    services: Record<string, unknown>[] | null;
    billingsettings: IBillingSettings | null;
    regioncode: number;
    districtcode: number;
    allowValidationUpaid: numberBoolean;
    allowPrintingUnpaid: numberBoolean;
    allowResultEnteringUpaid: numberBoolean;
    byPassCollection: numberBoolean;
    byPassSampleValidation: numberBoolean;
    byPassProcessing: numberBoolean;
    byPassValidation: numberBoolean;
    automakesupplierpaymentsexpense: numberBoolean;
    automakeemployeepayrollpaymentsexpense: numberBoolean;
    automakeoutsourcepaymentsexpense: numberBoolean;

    automakecommissionpaymentsexpense: numberBoolean;

    useamountpaidforcommissioncalculation: numberBoolean;

    allowManagerToApproveExpenses: numberBoolean;

    allowManagerToProcessPayroll: numberBoolean;

    allowManagerToProcessCommission: numberBoolean;

    isCommissionEarnedOnClinicianBilling: numberBoolean;

    isCommissionEarnedOnOrganizationalBilling: numberBoolean;

    isCommissionEarnedOnNHISBilling: numberBoolean;

    isCommissionEarnedOnPHISBilling: numberBoolean;
}