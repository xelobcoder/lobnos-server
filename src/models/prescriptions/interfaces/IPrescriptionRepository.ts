export type PrescriptionStatus = 'pending' | 'partially_fulfilled' | 'fulfilled' | 'referred' | 'cancelled';
export type PrescriptionItemStatus = 'pending' | 'dispensed' | 'referred' | 'cancelled';

export interface PrescriptionRow {
     id: string;
     patientId: number;
     consultationId: number | null;
     clinicianId: number;
     status: PrescriptionStatus;
     notes: string | null;
     createdAt: Date;
     updatedAt: Date;
}

export interface PrescriptionItemRow {
     id: string;
     prescriptionId: string;
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
}

/** A prescription row enriched with the patient/clinician names a queue listing needs to render. */
export interface PrescriptionSummaryRow extends PrescriptionRow {
     patientName: string;
     clinicianName: string;
}

export interface PrescriptionListFilters {
     page: number;
     count: number;
     statuses?: PrescriptionStatus[];
     patientId?: number;
     search?: string;
}

/** The per-item update applied once a fulfillment sale has been completed. */
export interface PrescriptionItemFulfillmentUpdate {
     id: string;
     quantityDispensed: number;
     status: PrescriptionItemStatus;
     saleId: string;
}

export interface IPrescriptionRepository {
     createPrescription(prescription: PrescriptionRow, items: PrescriptionItemRow[]): Promise<void>;
     findById(id: string): Promise<PrescriptionRow | null>;
     findItemsByPrescriptionId(prescriptionId: string): Promise<PrescriptionItemRow[]>;
     listPrescriptions(filters: PrescriptionListFilters): Promise<{ prescriptions: PrescriptionSummaryRow[]; total: number }>;
     /** Atomically writes the dispensed quantities/status for each fulfilled item and the prescription's new overall status. */
     applyFulfillment(prescriptionId: string, itemUpdates: PrescriptionItemFulfillmentUpdate[], prescriptionStatus: PrescriptionStatus, occurredAt: Date): Promise<void>;
     /** Atomically marks the given items as referred out and updates the prescription's overall status. */
     markItemsReferred(prescriptionId: string, itemIds: string[], prescriptionStatus: PrescriptionStatus, occurredAt: Date): Promise<void>;
}
