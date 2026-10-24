import { PharmacyPaymentMethod, PharmacySaleReceipt } from '../../pharmacy/interfaces/IPharmacySaleService';
import { PrescriptionItemStatus, PrescriptionStatus } from './IPrescriptionRepository';

export interface CreatePrescriptionItemInput {
     /** Pharmacy inventory item to dispense from; omit when the drug isn't stocked and will only ever be referred out. */
     inventoryItemId?: string | null;
     drugName: string;
     dosageInstructions?: string;
     dose?: string;
     frequency?: string;
     duration?: string;
     route?: string;
     /** Omit when pharmacy will confirm the supply quantity before dispensing. */
     quantityOrdered?: number;
}

export interface CreatePrescriptionInput {
     patientId: number;
     consultationId?: number | null;
     notes?: string;
     items: CreatePrescriptionItemInput[];
}

export interface PrescriptionItemDetail {
     id: string;
     inventoryItemId: string | null;
     drugName: string;
     dosageInstructions: string | null;
     dose: string | null;
     frequency: string | null;
     duration: string | null;
     route: string | null;
     quantityOrdered: number;
     quantityDispensed: number;
     status: PrescriptionItemStatus;
     saleId: string | null;
     availableStock?: number;
     salePrice?: number;
}

export interface PrescriptionDetail {
     id: string;
     patientId: number;
     patientName?: string;
     consultationId: number | null;
     clinicianId: number;
     status: PrescriptionStatus;
     notes: string | null;
     createdAt: Date;
     updatedAt: Date;
     items: PrescriptionItemDetail[];
}

export interface PrescriptionSummary {
     id: string;
     patientId: number;
     patientName: string;
     clinicianId: number;
     clinicianName: string;
     status: PrescriptionStatus;
     createdAt: Date;
}

export interface PrescriptionListRequest {
     page: number;
     count: number;
     statuses?: PrescriptionStatus[];
     patientId?: number;
     clinicianId?: number;
     consultationId?: number;
     search?: string;
     from?: string;
     to?: string;
}

export interface PrescriptionStatusSummary {
     total: number;
     byStatus: Partial<Record<PrescriptionStatus, number>>;
}

export interface PrescriptionList {
     prescriptions: PrescriptionSummary[];
     total: number;
     page: number;
     count: number;
     totalPages: number;
}

export interface FulfillPrescriptionLineInput {
     prescriptionItemId: string;
     quantityDispensed: number;
}

export interface FulfillPrescriptionInput {
     idempotencyKey: string;
     paymentAccountId?: number;
     amountTendered?: number;
     expectedTotal?: number;
     lines: FulfillPrescriptionLineInput[];
     paymentMethod: PharmacyPaymentMethod;
     customerName?: string;
     paymentReference?: string;
}

export interface FulfillPrescriptionResult {
     receipt: PharmacySaleReceipt;
     prescription: PrescriptionDetail;
}

export interface ReferralSlipItem {
     drugName: string;
     dosageInstructions: string | null;
     dose: string | null;
     frequency: string | null;
     duration: string | null;
     route: string | null;
     quantityRemaining: number;
}

export interface ReferralSlip {
     prescriptionId: string;
     patientId: number;
     clinicianId: number;
     referredAt: Date;
     items: ReferralSlipItem[];
}

export interface ReferRemainingResult {
     prescription: PrescriptionDetail;
     referralSlip: ReferralSlip;
}

export interface IPrescriptionService {
     /** Records a clinician's drug order so it appears in the pharmacy's fulfillment queue. */
     createPrescription(input: CreatePrescriptionInput, clinicianId: number): Promise<PrescriptionDetail>;
     getById(id: string): Promise<PrescriptionDetail>;
     list(request: PrescriptionListRequest): Promise<PrescriptionList>;
     summarize(request: Omit<PrescriptionListRequest, 'page' | 'count' | 'statuses'>): Promise<PrescriptionStatusSummary>;
     /** Dispenses the requested quantities via the normal pharmacy sale flow, tagging the sale with the prescription's patient. */
     fulfill(id: string, input: FulfillPrescriptionInput, cashierId: number): Promise<FulfillPrescriptionResult>;
     /** Marks whatever is still outstanding as referred out and returns printable referral-slip data for the patient to take elsewhere. */
     referRemaining(id: string, actorId: number): Promise<ReferRemainingResult>;
}

