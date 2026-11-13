import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
     getCommissionsByPeriod: vi.fn(),
     getCommissionsByStatus: vi.fn(),
     getRecipientPaymentEfficiency: vi.fn(),
     getPeriodStatistics: vi.fn(),
}));
vi.mock('../repositories/CommissionAnalyticsWithDate', () => ({ CommissionAnalyticsWithDate: class {
     getCommissionsByPeriod = repository.getCommissionsByPeriod;
     getCommissionsByStatus = repository.getCommissionsByStatus;
     getRecipientPaymentEfficiency = repository.getRecipientPaymentEfficiency;
     getPeriodStatistics = repository.getPeriodStatistics;
} }));
import { CommissionAnalytics } from './CommissionAnalytics';

beforeEach(() => {
     vi.clearAllMocks();
     repository.getCommissionsByPeriod.mockResolvedValue([]);
     repository.getCommissionsByStatus.mockResolvedValue([]);
     repository.getRecipientPaymentEfficiency.mockResolvedValue([]);
});

describe('commission dashboard outstanding balance', () => {
     it.each(['clinician', 'organization'] as const)('includes earlier earnings and preserves the %s recipient filter', async recipientType => {
          repository.getPeriodStatistics.mockImplementation(async query => query.startDate.getUTCFullYear() === 1000
               ? { total_due: '87.50', total_paid: '56.50', total_waived: '0.00' }
               : { total_due: '5.00', total_paid: '0.00', total_waived: '0.00' });
          const query = { tenantId: 1, startDate: new Date('2026-11-01'), endDate: new Date('2026-11-13'), period: 'monthly' as const, recipientType, recipientId: 2 };
          const result = await new CommissionAnalytics(1).getComprehensiveDashboard(query);
          expect(result.summary).toMatchObject({ totalDue: '5.00', totalOutstanding: 31 });
          expect(repository.getPeriodStatistics).toHaveBeenCalledWith({ ...query, startDate: new Date('1000-01-01T00:00:00Z') });
     });

     it('deducts waived amounts from the cumulative balance', async () => {
          repository.getPeriodStatistics.mockResolvedValue({ total_due: '87.50', total_paid: '56.50', total_waived: '10.00' });
          const result = await new CommissionAnalytics(1).getComprehensiveDashboard({ tenantId: 1, startDate: new Date('2026-10-01'), endDate: new Date('2026-11-13'), period: 'monthly' });
          expect(result.summary.totalOutstanding).toBe(21);
     });

     it('returns zero for an empty report', async () => {
          repository.getPeriodStatistics.mockResolvedValue(undefined);
          const result = await new CommissionAnalytics(1).getComprehensiveDashboard({ tenantId: 1, startDate: new Date('2026-10-01'), endDate: new Date('2026-11-13'), period: 'monthly' });
          expect(result.summary.totalOutstanding).toBe(0);
     });
});
