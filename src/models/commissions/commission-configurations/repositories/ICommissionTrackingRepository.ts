import { ICommissionTracking } from '../interfaces/CommissionTracking.interface';

export interface ICommissionTrackingRepository {
     findById(id: number): Promise<ICommissionTracking | null>;
     findByServiceId(serviceId: number): Promise<ICommissionTracking[]>;
     findByRecipient(
          recipientType: string,
          recipientId: number,
          limit?: number
     ): Promise<ICommissionTracking[]>;
     findByStatus(status: string, limit?: number): Promise<ICommissionTracking[]>;
     findUnpaid(recipientType?: string, limit?: number): Promise<ICommissionTracking[]>;
     findByPeriod(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<ICommissionTracking[]>;
     getPeriodTotal(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<number>;
     countPeriod(
          recipientType: string,
          recipientId: number,
          periodRef: Date,
          statuses: string[]
     ): Promise<number>;
     create(tracking: Omit<ICommissionTracking, 'id' | 'created_at' | 'updated_at'>): Promise<ICommissionTracking>;
     createAdjustment(originalId: number, amount: number, reason: string, kind: 'refund' | 'cancellation' | 'rejection' | 'credit' | 'reversal' | 'clawback'): Promise<ICommissionTracking>;
     updateStatus(id: number, status: string): Promise<void>;
     getSummary(recipientType?: string): Promise<Record<string, any>>;
}
