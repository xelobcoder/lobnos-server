import { ICommissionConfig } from './CommissionConfig.interface';
import { ICommissionAssignment } from './CommissionAssignment.interface';
import { ICommissionTier } from './CommissionTier.interface';

export interface CommissionInput {
     service_id: number;
     service_amount: number;
     outsourced_lab_cost?: number;
     volume_count?: number;
     quota_value?: number;
     performance_amount?: number;
     service_category: string;
     /** Persisted dboservices.categoryTrackId. Omitted only by legacy callers. */
     billing_source?: number;
     organization_id: number;
     clinician_id?: number | null;
     clinician_organization_id?: number | null;
     completion_date: Date;
}

export interface CommissionCalculationResult {
     final_commission: number;
     tracking_id?: number;
     reason: 'SUCCESS' | 'NO_CONFIG' | 'NO_ASSIGNMENT_REQUIRES_DEFAULT_CHECK' | 'ERROR';
     error?: string;
}

export interface ResolvedCommission {
     config: ICommissionConfig;
     assignment: ICommissionAssignment;
     rawCommission: number;
     adjustments: {
          minCapAdjustment: number;
          maxCapAdjustment: number;
          periodCapAdjustment: number;
     };
     finalCommission: number;
}

export interface CapAdjustments {
     minCapAdjustment: number;
     maxCapAdjustment: number;
     periodCapAdjustment: number;
     final: number;
}

export interface PeriodCapContext {
     periodReferenceDate: Date;
     periodTotal: number;
     adjustmentNeeded: number;
     final: number;
}

export interface CommissionValidationError {
     field: string;
     message: string;
     code: string;
}
