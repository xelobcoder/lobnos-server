export type RefundRequestBodyParams = {
    categoryTrackId: number,
    billingid: number,
    serviceid: number,
    employeeid: number,
    trackId: number,
    taxIncluded: number,
    refundMessage: string
}

export type WitnessCategory = "witness" | "firstWitness"
type Witness = {
    employeeid: number;
    message: string;
    name: string;
    witness: WitnessCategory
};

export type UpdatePreviousWitnessNoteBodyParams = {
    amountIncurredDueTax: number;
    billedby: string;
    canEdit: boolean;
    canwitness: boolean;
    cost: number;
    refundid: number;
    serviceCategory: string;
    witnesses: Witness[];
    serviceid: number
};



export type IDetermineStageOfRefund = {
    serviceid: number;
    employeeid: number;
    purpose: string;
    trackId: number;
    serviceCategory?: string;
    serviceCategoryName: string;
    billingid: number;
    categoryTrackId: number;
}


export type updateRefundCashRequestBodyType = {
    request_key?: string;
    branchid?: number;
    serviceid: number;
    employeeid: number,
    name: string,
    selectedPaymentMode: number,
    trackId: number,
    billingid: number,
    refundAmount: number,
    cost: number
}

interface MultiTestItem {
    id: number;
    testid: number;
    name: string;
    price: number;
    actualPrice: number;
    originalPrice: number;
    discountedValue: number;
    discount: number;
    isoutsourced: number;
    concessionMode: "absolute" | "percentage" | string;
    concessionValue: number;
    pricingType: "discount" | "concession" | string;
    hasNightAdjustment: boolean;
    nightAdjustmentMode: "none" | "percentage" | "absolute" | string;
    nightAdjustmentValue: number;
}
