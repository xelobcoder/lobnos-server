import { describe, expect, it } from 'vitest';
import { payrollProcessingOutcome } from './PayrollProcessingOutcome';
import type { IPayrollProcessingResult } from './PayrollProcessingService';

const result: IPayrollProcessingResult = {
     payroll_period_id: 1, total_employees_processed: 0,
     total_gross_salary: 0, total_deductions: 0, total_net_salary: 0,
     period_status: 'draft', errors: [{ employeeid: 1, error: 'No compensation covers the full payroll period for employee 1.' }]
};
describe('payroll processing outcomes', () => {
     it('does not announce success or send completion notifications when nobody was processed', () => {
          expect(payrollProcessingOutcome(result)).toMatchObject({ complete: false, status: 'error' });
          expect(payrollProcessingOutcome(result).message).toContain('No employees');
     });
     it('distinguishes partial processing and keeps completion notifications suppressed', () => {
          expect(payrollProcessingOutcome({ ...result, total_employees_processed: 2 })).toMatchObject({ complete: false, status: 'partial' });
     });
     it('announces completion only for a calculated period with successful employees and no errors', () => {
          expect(payrollProcessingOutcome({ ...result, total_employees_processed: 2, period_status: 'calculated', errors: [] })).toMatchObject({ complete: true, status: 'success' });
          expect(payrollProcessingOutcome({ ...result, errors: [] }).complete).toBe(false);
     });
});
