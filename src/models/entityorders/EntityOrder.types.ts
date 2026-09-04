export type EntityOrderEntityType = 'clinician' | 'organization' | 'general';

export type EntityOrderStatus =
     | 'DRAFT'
     | 'PENDING'
     | 'ON_HOLD'
     | 'APPROVED'
     | 'REJECTED'
     | 'CONVERTED'
     | 'CANCELLED';

export type EntityOrderDecisionAction =
     | 'submit'
     | 'approve'
     | 'hold'
     | 'reject'
     | 'convert'
     | 'cancel'
     | 'edit';

export interface EntityOrderLineInput {
     testId: number;
     quantity?: number;
}

export interface CreateEntityOrderInput {
     patientId: number;
     consultationId?: number | null;
     orderedByEmployeeId: number;
     entityType?: EntityOrderEntityType;   // optional: derived from orderedByEmployeeId when omitted
     entityId?: number | null;             // optional: derived from orderedByEmployeeId when omitted
     branchId?: number | null;
     sampleLocation?: 'center' | 'referrer';
     notes?: string;
     lines: EntityOrderLineInput[];
}

export interface EntityOrderLineRow {
     id: number;
     order_id: number;
     test_id: number;
     test_name: string;
     unit_price: string | number;
     strategy_priced: number;
     quantity: number;
     created_at: string | Date;
}

export interface EntityOrderRow {
     id: number;
     patient_id: number;
     consultation_id: number | null;
     ordered_by_employee_id: number;
     entity_type: EntityOrderEntityType;
     entity_id: number | null;
     billing_source: number;
     strategy_id: number | null;
     status: EntityOrderStatus;
     revision: number;
     billing_id: number | null;
     decided_by: number | null;
     decided_at: string | Date | null;
     decision_reason: string | null;
     converted_by: number | null;
     converted_at: string | Date | null;
     sample_location: 'center' | 'referrer' | null;
     notes: string | null;
     branch_id: number | null;
     created_at: string | Date;
     updated_at: string | Date;
}
