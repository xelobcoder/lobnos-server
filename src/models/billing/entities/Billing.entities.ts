export interface BillingRecord {
     billingid: number;
     patientid?: number;
     branchid?: number;
     billedon?: Date | string;
     [key: string]: any;
}

export interface BillingServiceRecord {
     serviceid: number;
     billingid?: number;
     [key: string]: any;
}

export interface BillingPaymentHistoryRecord {
     KeyID: number;
     Billingid?: number;
     [key: string]: any;
}

export interface BillingRefundRecord {
     id?: number;
     serviceid: number;
     [key: string]: any;
}

export interface SalesSessionRecord {
     id: number;
     sessiondate: Date | string;
     sessionendedon?: Date | string | null;
     [key: string]: any;
}

export interface ExpenseRecord {
     [key: string]: any;
}
