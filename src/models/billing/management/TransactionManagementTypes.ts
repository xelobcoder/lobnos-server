import { PrimeLimsTablebilling, PrimeLimsTabledboservices, PrimeLimsTablebillinghx } from "../../../database/DatabaseTableSchema";

export interface IBillingUpdate {
    billingid: number;
    updates: Partial<PrimeLimsTablebilling>;
    employeeid: number;
}

export interface IServiceUpdate {
    serviceid: number;
    updates: Partial<PrimeLimsTabledboservices>;
    employeeid: number;
}

export interface IAuditEntry {
    timestamp: Date | string;
    action: string;
    actor: string;
    changes: Record<string, { from: any; to: any }>;
    entity_id: number;
    entity_type: 'billing' | 'service';
}

export interface IFullTransactionHistory {
    billing_history: IAuditEntry[];
    services_history: Record<number, IAuditEntry[]>;
}

export interface IFullTransactionDetails {
    billing: any;
    services: any[];
    payment_history: any[];
    audit_trail: IFullTransactionHistory;
}

export interface IPaymentHistoryUpdate {
    KeyID: number;
    Amount?: number;
    PaymentMode?: number;
    Date?: Date | string;
    employeeid: number;
    reason?: string;
}
