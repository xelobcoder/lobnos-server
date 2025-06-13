export type RefundRequestBodyParams = {
    categoryTrackId: number,
    billingid: number,
    serviceid: number,
    employeeid: number,
    trackId: number,
    taxIncluded: number,
    refundMessage: string
}

export type WitnessCategory = "firstWitness" | "secondWitness" | "thirdWitness"
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



export type updateRefundCashRequestBodyType = {
    serviceid: number;
    employeeid: number,
    name: string,
    selectedPaymentMode: number,
    trackId: number,
    billingid: number,
    refundAmount:number,
    cost: number
} 