import { CompensationRepository, ICompensation } from '../../models/payroll/CompensationRepository';
import { AttendanceRepository } from '../../models/payroll/AttendanceRepository';
import { AllowanceRepository, BonusRepository } from '../../models/payroll/AllowanceBonusRepository';
import { OtherDeductionRepository } from '../../models/payroll/DeductionRepository';
import { TaxCalculationService } from './TaxCalculationService';
import { StatutoryDeductionService } from './StatutoryDeductionService';

export interface IPayrollCalculationInput {
     employeeid: number;
     payroll_period_id: number;
     period_start_date: string;
     period_end_date: string;
}

export interface IPayrollCalculationResult {
     employeeid: number;
     payroll_period_id: number;

     // Earnings
     basic_salary: number;
     hourly_earnings: number;
     overtime_earnings: number;
     commission_earnings: number;
     total_allowances: number;
     total_bonuses: number;
     gross_salary: number;

     // Deductions
     income_tax: number;
     employee_ssnit: number;
     employer_ssnit: number;
     employee_tier3: number;
     employer_tier3: number;
     nhis: number;
     total_other_deductions: number;
     total_deductions: number;

     // Final amounts
     net_salary: number;
     employer_cost: number;

     // Attendance summary
     days_worked: number;
     hours_worked: number;
     overtime_hours: number;
     days_absent: number;
     days_leave: number;

     // Detailed breakdowns (JSON)
     allowances_detail: any;
     bonuses_detail: any;
     other_deductions_detail: any;
}

export class PayrollCalculationService {
     private compensationRepo: CompensationRepository;
     private attendanceRepo: AttendanceRepository;
     private allowanceRepo: AllowanceRepository;
     private bonusRepo: BonusRepository;
     private deductionRepo: OtherDeductionRepository;
     private taxService: TaxCalculationService;
     private statutoryService: StatutoryDeductionService;

     constructor(private tenantId: number) {
          this.compensationRepo = new CompensationRepository(tenantId);
          this.attendanceRepo = new AttendanceRepository(tenantId);
          this.allowanceRepo = new AllowanceRepository(tenantId);
          this.bonusRepo = new BonusRepository(tenantId);
          this.deductionRepo = new OtherDeductionRepository(tenantId);
          this.taxService = new TaxCalculationService(tenantId);
          this.statutoryService = new StatutoryDeductionService(tenantId);
     }

     /**
      * Calculate full payroll for an employee for a given period
      */
     async calculateEmployeePayroll(input: IPayrollCalculationInput): Promise<IPayrollCalculationResult> {
          const { employeeid, payroll_period_id, period_start_date, period_end_date } = input;

          // Get employee compensation configuration
          const compensation = await this.compensationRepo.getActiveByEmployeeId(employeeid);
          if (!compensation) {
               throw new Error(`No active compensation found for employee ${employeeid}`);
          }

          // Get attendance summary
          const attendanceSummary = await this.attendanceRepo.getAttendanceSummary(
               employeeid,
               period_start_date,
               period_end_date
          );

          // Calculate earnings based on compensation type
          const earnings = await this.calculateEarnings(
               compensation,
               attendanceSummary.total_hours,
               attendanceSummary.overtime_hours,
               employeeid,
               payroll_period_id
          );

          // Calculate allowances
          const allowanceResult = await this.calculateAllowances(employeeid, earnings.basic_salary);

          // Calculate bonuses
          const bonusResult = await this.calculateBonuses(employeeid, payroll_period_id);

          // Calculate gross salary
          const grossSalary =
               earnings.basic_salary +
               earnings.hourly_earnings +
               earnings.overtime_earnings +
               earnings.commission_earnings +
               allowanceResult.total_allowances +
               bonusResult.total_bonuses;

          // Calculate statutory deductions
          const statutory = await this.statutoryService.calculateStatutoryDeductions(
               employeeid,
               earnings.basic_salary
          );

          // Calculate income tax
          const dependents = await this.statutoryService.getDependentsCount(employeeid);
          const isTaxExempt = await this.statutoryService.isTaxExempt(employeeid);

          const incomeTax = isTaxExempt
               ? 0
               : await this.taxService.calculateMonthlyTax(grossSalary, dependents);

          // Calculate other deductions
          const otherDeductionResult = await this.calculateOtherDeductions(employeeid);

          // Calculate total deductions
          const totalDeductions =
               incomeTax +
               statutory.employee_ssnit +
               statutory.employee_tier3 +
               statutory.nhis +
               otherDeductionResult.total_other_deductions;

          // Calculate net salary
          const netSalary = grossSalary - totalDeductions;

          // Calculate employer cost
          const employerCost = grossSalary + statutory.employer_ssnit + statutory.employer_tier3;

          return {
               employeeid,
               payroll_period_id,
               basic_salary: earnings.basic_salary,
               hourly_earnings: earnings.hourly_earnings,
               overtime_earnings: earnings.overtime_earnings,
               commission_earnings: earnings.commission_earnings,
               total_allowances: allowanceResult.total_allowances,
               total_bonuses: bonusResult.total_bonuses,
               gross_salary: Math.round(grossSalary * 100) / 100,
               income_tax: Math.round(incomeTax * 100) / 100,
               employee_ssnit: statutory.employee_ssnit,
               employer_ssnit: statutory.employer_ssnit,
               employee_tier3: statutory.employee_tier3,
               employer_tier3: statutory.employer_tier3,
               nhis: statutory.nhis,
               total_other_deductions: otherDeductionResult.total_other_deductions,
               total_deductions: Math.round(totalDeductions * 100) / 100,
               net_salary: Math.round(netSalary * 100) / 100,
               employer_cost: Math.round(employerCost * 100) / 100,
               days_worked: attendanceSummary.present_days,
               hours_worked: attendanceSummary.total_hours,
               overtime_hours: attendanceSummary.overtime_hours,
               days_absent: attendanceSummary.absent_days,
               days_leave: 0, // TODO: Get from leave repository
               allowances_detail: allowanceResult.allowances_detail,
               bonuses_detail: bonusResult.bonuses_detail,
               other_deductions_detail: otherDeductionResult.other_deductions_detail
          };
     }

     /**
      * Calculate earnings based on compensation type
      */
     private async calculateEarnings(
          compensation: ICompensation,
          hoursWorked: number,
          overtimeHours: number,
          employeeid: number,
          payroll_period_id: number
     ): Promise<{
          basic_salary: number;
          hourly_earnings: number;
          overtime_earnings: number;
          commission_earnings: number;
     }> {
          let basicSalary = 0;
          let hourlyEarnings = 0;
          let overtimeEarnings = 0;
          let commissionEarnings = 0;

          switch (compensation.compensation_type) {
               case 'salary':
                    basicSalary = compensation.basic_salary || 0;

                    // Calculate overtime if applicable
                    if (overtimeHours > 0 && compensation.hourly_rate) {
                         const overtimeRate = compensation.hourly_rate * (compensation.overtime_rate_multiplier || 1.5);
                         overtimeEarnings = overtimeHours * overtimeRate;
                    }
                    break;

               case 'hourly':
                    const hourlyRate = compensation.hourly_rate || 0;
                    hourlyEarnings = hoursWorked * hourlyRate;

                    // Calculate overtime
                    if (overtimeHours > 0) {
                         const overtimeRate = hourlyRate * (compensation.overtime_rate_multiplier || 1.5);
                         overtimeEarnings = overtimeHours * overtimeRate;
                    }
                    break;

               case 'commission':
                    // TODO: Calculate commission based on sales/performance
                    // This would need integration with sales/billing data
                    commissionEarnings = 0;
                    break;

               case 'hybrid':
                    // Combination of salary and commission
                    basicSalary = compensation.basic_salary || 0;
                    // TODO: Add commission calculation
                    commissionEarnings = 0;
                    break;
          }

          return {
               basic_salary: Math.round(basicSalary * 100) / 100,
               hourly_earnings: Math.round(hourlyEarnings * 100) / 100,
               overtime_earnings: Math.round(overtimeEarnings * 100) / 100,
               commission_earnings: Math.round(commissionEarnings * 100) / 100
          };
     }

     /**
      * Calculate total allowances for employee
      */
     private async calculateAllowances(
          employeeid: number,
          basicSalary: number
     ): Promise<{
          total_allowances: number;
          allowances_detail: any[];
     }> {
          const allowances = await this.allowanceRepo.getActiveByEmployeeId(employeeid);

          let totalAllowances = 0;
          const allowancesDetail = [];

          for (const allowance of allowances) {
               let amount = 0;

               if (allowance.calculation_method === 'fixed') {
                    amount = allowance.amount;
               } else if (allowance.calculation_method === 'percentage_of_basic') {
                    amount = (basicSalary * (allowance.percentage || 0)) / 100;
               } else if (allowance.calculation_method === 'variable') {
                    // Variable allowances use the amount field directly
                    amount = allowance.amount;
               }

               totalAllowances += amount;
               allowancesDetail.push({
                    type: allowance.allowance_type,
                    amount: Math.round(amount * 100) / 100,
                    is_taxable: allowance.is_taxable
               });
          }

          return {
               total_allowances: Math.round(totalAllowances * 100) / 100,
               allowances_detail: allowancesDetail
          };
     }

     /**
      * Calculate bonuses for payroll period
      */
     private async calculateBonuses(
          employeeid: number,
          payroll_period_id: number
     ): Promise<{
          total_bonuses: number;
          bonuses_detail: any[];
     }> {
          const bonuses = await this.bonusRepo.getApprovedForPayrollPeriod(payroll_period_id);
          const employeeBonuses = bonuses.filter(b => b.employeeid === employeeid);

          let totalBonuses = 0;
          const bonusesDetail = [];

          for (const bonus of employeeBonuses) {
               totalBonuses += bonus.amount;
               bonusesDetail.push({
                    type: bonus.bonus_type,
                    amount: bonus.amount,
                    is_taxable: bonus.is_taxable
               });
          }

          return {
               total_bonuses: Math.round(totalBonuses * 100) / 100,
               bonuses_detail: bonusesDetail
          };
     }

     /**
      * Calculate other deductions
      */
     private async calculateOtherDeductions(
          employeeid: number
     ): Promise<{
          total_other_deductions: number;
          other_deductions_detail: any[];
     }> {
          const deductions = await this.deductionRepo.getActiveByEmployeeId(employeeid);

          let totalDeductions = 0;
          const deductionsDetail = [];

          for (const deduction of deductions) {
               totalDeductions += deduction.amount;
               deductionsDetail.push({
                    type: deduction.deduction_type,
                    name: deduction.deduction_name,
                    amount: deduction.amount,
                    priority: deduction.deduction_priority,
                    remaining_balance: deduction.remaining_balance
               });
          }

          return {
               total_other_deductions: Math.round(totalDeductions * 100) / 100,
               other_deductions_detail: deductionsDetail
          };
     }

     /**
      * Calculate payroll for multiple employees
      */
     async calculateBulkPayroll(inputs: IPayrollCalculationInput[]): Promise<IPayrollCalculationResult[]> {
          const results: IPayrollCalculationResult[] = [];

          for (const input of inputs) {
               try {
                    const result = await this.calculateEmployeePayroll(input);
                    results.push(result);
               } catch (error) {
                    console.error(`Error calculating payroll for employee ${input.employeeid}:`, error);
                    // Continue with other employees
               }
          }

          return results;
     }
}
