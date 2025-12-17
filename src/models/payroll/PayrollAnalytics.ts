import { PayrollAnalyticsWithDate } from './PayrollAnalyticsWithDate';

/**
 * Interfaces for analytics results
 */
export interface IPayrollPeriodAnalytics {
     status: string;
     period_count: number;
     total_gross: number;
     total_deductions: number;
     total_net: number;
     total_employees: number;
     avg_gross_per_period: number;
     avg_net_per_period: number;
}

export interface ICompensationAnalytics {
     compensation_type: string;
     payment_frequency: string;
     employee_count: number;
     avg_basic_salary: number;
     total_basic_salary: number;
     avg_hourly_rate: number;
     avg_commission_pct: number;
}

export interface IPaymentMethodAnalytics {
     payment_method: string;
     employee_count: number;
     percentage: number;
}

export interface IAttendanceAnalytics {
     status: string;
     shift_type: string;
     record_count: number;
     total_hours_worked: number;
     avg_hours_per_day: number;
     total_overtime: number;
     avg_late_minutes: number;
     unique_employees: number;
}

export interface IOvertimeAnalytics {
     overtime_approved: boolean;
     record_count: number;
     total_overtime_hours: number;
     avg_overtime_hours: number;
     employees_with_overtime: number;
}

export interface ILeaveAnalytics {
     leave_type: string;
     status: string;
     leave_count: number;
     total_days: number;
     avg_days_per_leave: number;
     unique_employees: number;
     unpaid_count: number;
}

export interface IAllowanceAnalytics {
     allowance_type: string;
     calculation_method: string;
     allowance_count: number;
     total_amount: number;
     avg_amount: number;
     employees_receiving: number;
     taxable_count: number;
}

export interface IBonusAnalytics {
     bonus_type: string;
     status: string;
     bonus_count: number;
     total_amount: number;
     avg_amount: number;
     unique_employees: number;
     avg_performance_rating: number;
}

export interface IStatutoryDeductionAnalytics {
     total_employees: number;
     ssnit_enrolled: number;
     tier3_enrolled: number;
     tax_exempt_count: number;
     nhis_active_count: number;
     avg_ssnit_rate: number;
     avg_tier3_employee_rate: number;
     avg_tier3_employer_rate: number;
     avg_nhis_rate: number;
     avg_dependents: number;
}

export interface IOtherDeductionAnalytics {
     deduction_type: string;
     deduction_count: number;
     total_amount: number;
     avg_amount: number;
     unique_employees: number;
     total_outstanding: number;
     recurring_count: number;
}

export interface ITransactionSummaryAnalytics {
     status: string;
     transaction_count: number;
     total_basic_salary: number;
     total_hourly_earnings: number;
     total_overtime_earnings: number;
     total_commission: number;
     total_allowances: number;
     total_bonuses: number;
     total_gross_salary: number;
     total_income_tax: number;
     total_employee_ssnit: number;
     total_employer_ssnit: number;
     total_employee_tier3: number;
     total_employer_tier3: number;
     total_nhis: number;
     total_other_deductions: number;
     total_deductions: number;
     total_net_salary: number;
     total_employer_cost: number;
     avg_days_worked: number;
     avg_hours_worked: number;
}

export interface ITopEarningEmployee {
     employeeid: number;
     username: string;
     email: string;
     total_gross_salary: number;
     total_net_salary: number;
     payroll_count: number;
}

export interface ICostCenterAnalytics {
     cost_center_code: string;
     cost_center_name: string;
     department: string;
     employee_count: number;
     avg_allocation_percentage: number;
}

export interface IPayrollTrendAnalytics {
     period_year: number;
     period_month: number;
     period_name: string;
     gross_salary: number;
     deductions: number;
     net_salary: number;
     employees: number;
     status: string;
}

export interface IComplianceAnalytics {
     total_employees: number;
     employees_with_statutory: number;
     compliance_percentage: number;
}

export interface IEarningsDistributionAnalytics {
     salary_band: string;
     employee_count: number;
     avg_gross_salary: number;
     avg_net_salary: number;
}

export interface IFinancialKPIs {
     total_employees: number;
     total_periods: number;
     total_gross_payroll: number;
     total_net_payroll: number;
     total_employer_cost: number;
     total_deductions: number;
     total_tax_liability: number;
     total_employer_contributions: number;
     total_employee_contributions: number;
     total_allowances: number;
     total_bonuses: number;
     total_overtime_cost: number;
     total_hours_worked: number;
     avg_gross_per_employee: number;
     avg_net_per_employee: number;
     avg_employer_cost_per_employee: number;
     avg_hours_per_employee: number;
     effective_tax_rate: number;
     employer_cost_burden_pct: number;
     deduction_rate_pct: number;
     overtime_pct_of_gross: number;
     cost_per_hour: number;
}

export interface IHeadcountAnalytics {
     active_employees_in_period: number;
     compensation_type_breakdown: { compensation_type: string; count: number }[];
     payment_frequency_breakdown: { payment_frequency: string; count: number }[];
}

export interface IPeriodComparisonMetrics {
     current_period: {
          start_date: string;
          end_date: string;
          employee_count: number;
          total_gross: number;
          total_net: number;
          total_employer_cost: number;
          total_allowances: number;
          total_overtime: number;
     };
     previous_period: {
          start_date: string;
          end_date: string;
          employee_count: number;
          total_gross: number;
          total_net: number;
          total_employer_cost: number;
          total_allowances: number;
          total_overtime: number;
     };
     changes: {
          employee_count_change: number;
          employee_count_change_pct: number;
          gross_payroll_change: number;
          gross_payroll_change_pct: number;
          net_payroll_change: number;
          net_payroll_change_pct: number;
          employer_cost_change: number;
          employer_cost_change_pct: number;
          allowances_change: number;
          allowances_change_pct: number;
          overtime_change: number;
          overtime_change_pct: number;
     };
}

export interface IAttendanceComplianceMetrics {
     total_records: number;
     unique_employees: number;
     present_count: number;
     absent_count: number;
     late_count: number;
     records_with_lateness: number;
     avg_late_minutes: number;
     total_late_minutes: number;
     records_with_overtime: number;
     approved_overtime_records: number;
     total_overtime_hours: number;
     total_hours_worked: number;
     avg_hours_per_day: number;
     attendance_rate: number;
     lateness_rate: number;
     overtime_pct_of_hours: number;
}

export interface ILeaveUtilizationMetrics {
     total_leave_requests: number;
     employees_on_leave: number;
     total_leave_days: number;
     avg_leave_duration: number;
     approved_count: number;
     pending_count: number;
     rejected_count: number;
     unpaid_leave_days: number;
     paid_leave_days: number;
     approval_rate: number;
     unpaid_leave_pct: number;
}

export interface IPayrollProcessingMetrics {
     total_periods: number;
     draft_count: number;
     pending_approval_count: number;
     approved_count: number;
     locked_count: number;
     paid_count: number;
     total_transactions_processed: number;
     avg_employees_per_period: number;
     completion_rate: number;
}

export interface IPayrollAnalytics {
     // Summary metrics
     financial_kpis: IFinancialKPIs | null;
     headcount_analytics: IHeadcountAnalytics;
     period_comparison: IPeriodComparisonMetrics;

     // Detailed breakdowns
     payroll_period_metrics: IPayrollPeriodAnalytics[];
     compensation_distribution: ICompensationAnalytics[];
     payment_methods: IPaymentMethodAnalytics[];
     attendance_summary: IAttendanceAnalytics[];
     overtime_metrics: IOvertimeAnalytics[];
     leave_statistics: ILeaveAnalytics[];
     allowance_breakdown: IAllowanceAnalytics[];
     bonus_statistics: IBonusAnalytics[];
     statutory_deductions: IStatutoryDeductionAnalytics | null;
     other_deductions: IOtherDeductionAnalytics[];
     transaction_summary: ITransactionSummaryAnalytics[];
     top_earners: ITopEarningEmployee[];
     cost_centers: ICostCenterAnalytics[];
     payroll_trend: IPayrollTrendAnalytics[];
     compliance: IComplianceAnalytics;
     earnings_distribution: IEarningsDistributionAnalytics[];

     // Operational metrics
     attendance_compliance: IAttendanceComplianceMetrics | null;
     leave_utilization: ILeaveUtilizationMetrics | null;
     payroll_processing: IPayrollProcessingMetrics | null;
}

/**
 * PayrollAnalytics - Aggregates and formats payroll analytics data
 */
export class PayrollAnalytics {
     constructor(private tenantId: number) { }

     /**
      * Get comprehensive payroll analytics for date range
      */
     async getPayrollAnalytics(startDate: string, endDate: string, topEarnersLimit: number = 10): Promise<IPayrollAnalytics> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);

          // Execute all queries in parallel for better performance
          const [
               financialKPIs,
               headcountAnalytics,
               periodComparison,
               payrollPeriodMetrics,
               compensationDistribution,
               paymentMethods,
               attendanceSummary,
               overtimeMetrics,
               leaveStatistics,
               allowanceBreakdown,
               bonusStatistics,
               statutoryDeductions,
               otherDeductions,
               transactionSummary,
               topEarners,
               costCenters,
               payrollTrend,
               compliance,
               earningsDistribution,
               attendanceCompliance,
               leaveUtilization,
               payrollProcessing
          ] = await Promise.all([
               queryBuilder.getFinancialKPIs(startDate, endDate),
               queryBuilder.getHeadcountAnalytics(startDate, endDate),
               queryBuilder.getPeriodComparisonMetrics(startDate, endDate),
               queryBuilder.getPayrollPeriodMetrics(startDate, endDate),
               queryBuilder.getCompensationTypeDistribution(startDate, endDate),
               queryBuilder.getPaymentMethodDistribution(),
               queryBuilder.getAttendanceSummary(startDate, endDate),
               queryBuilder.getOvertimeMetrics(startDate, endDate),
               queryBuilder.getLeaveStatistics(startDate, endDate),
               queryBuilder.getAllowanceBreakdown(startDate, endDate),
               queryBuilder.getBonusStatistics(startDate, endDate),
               queryBuilder.getStatutoryDeductionSummary(),
               queryBuilder.getOtherDeductionsBreakdown(startDate, endDate),
               queryBuilder.getPayrollTransactionSummary(startDate, endDate),
               queryBuilder.getTopEarningEmployees(startDate, endDate, topEarnersLimit),
               queryBuilder.getCostCenterAllocation(startDate, endDate),
               queryBuilder.getPayrollTrend(startDate, endDate),
               queryBuilder.getDeductionComplianceRate(),
               queryBuilder.getEarningsDistribution(startDate, endDate),
               queryBuilder.getAttendanceComplianceMetrics(startDate, endDate),
               queryBuilder.getLeaveUtilizationMetrics(startDate, endDate),
               queryBuilder.getPayrollProcessingMetrics(startDate, endDate)
          ]);

          return {
               // Summary KPIs
               financial_kpis: this.parseFinancialKPIs(financialKPIs),
               headcount_analytics: this.parseHeadcountAnalytics(headcountAnalytics),
               period_comparison: periodComparison,

               // Detailed breakdowns
               payroll_period_metrics: this.parsePayrollPeriodMetrics(payrollPeriodMetrics),
               compensation_distribution: this.parseCompensationDistribution(compensationDistribution),
               payment_methods: this.parsePaymentMethods(paymentMethods),
               attendance_summary: this.parseAttendanceSummary(attendanceSummary),
               overtime_metrics: this.parseOvertimeMetrics(overtimeMetrics),
               leave_statistics: this.parseLeaveStatistics(leaveStatistics),
               allowance_breakdown: this.parseAllowanceBreakdown(allowanceBreakdown),
               bonus_statistics: this.parseBonusStatistics(bonusStatistics),
               statutory_deductions: this.parseStatutoryDeductions(statutoryDeductions),
               other_deductions: this.parseOtherDeductions(otherDeductions),
               transaction_summary: this.parseTransactionSummary(transactionSummary),
               top_earners: this.parseTopEarners(topEarners),
               cost_centers: this.parseCostCenters(costCenters),
               payroll_trend: this.parsePayrollTrend(payrollTrend),
               compliance: compliance,
               earnings_distribution: this.parseEarningsDistribution(earningsDistribution),

               // Operational metrics
               attendance_compliance: this.parseAttendanceCompliance(attendanceCompliance),
               leave_utilization: this.parseLeaveUtilization(leaveUtilization),
               payroll_processing: this.parsePayrollProcessing(payrollProcessing)
          };
     }

     /**
      * Parse financial KPIs
      */
     private parseFinancialKPIs(data: any): IFinancialKPIs | null {
          if (!data) return null;
          return {
               total_employees: Number(data.total_employees) || 0,
               total_periods: Number(data.total_periods) || 0,
               total_gross_payroll: Number(data.total_gross_payroll) || 0,
               total_net_payroll: Number(data.total_net_payroll) || 0,
               total_employer_cost: Number(data.total_employer_cost) || 0,
               total_deductions: Number(data.total_deductions) || 0,
               total_tax_liability: Number(data.total_tax_liability) || 0,
               total_employer_contributions: Number(data.total_employer_contributions) || 0,
               total_employee_contributions: Number(data.total_employee_contributions) || 0,
               total_allowances: Number(data.total_allowances) || 0,
               total_bonuses: Number(data.total_bonuses) || 0,
               total_overtime_cost: Number(data.total_overtime_cost) || 0,
               total_hours_worked: Number(data.total_hours_worked) || 0,
               avg_gross_per_employee: Number(data.avg_gross_per_employee) || 0,
               avg_net_per_employee: Number(data.avg_net_per_employee) || 0,
               avg_employer_cost_per_employee: Number(data.avg_employer_cost_per_employee) || 0,
               avg_hours_per_employee: Number(data.avg_hours_per_employee) || 0,
               effective_tax_rate: Number(data.effective_tax_rate) || 0,
               employer_cost_burden_pct: Number(data.employer_cost_burden_pct) || 0,
               deduction_rate_pct: Number(data.deduction_rate_pct) || 0,
               overtime_pct_of_gross: Number(data.overtime_pct_of_gross) || 0,
               cost_per_hour: Number(data.cost_per_hour) || 0
          };
     }

     /**
      * Parse headcount analytics
      */
     private parseHeadcountAnalytics(data: any): IHeadcountAnalytics {
          return {
               active_employees_in_period: data.active_employees_in_period || 0,
               compensation_type_breakdown: data.compensation_type_breakdown || [],
               payment_frequency_breakdown: data.payment_frequency_breakdown || []
          };
     }

     /**
      * Parse attendance compliance
      */
     private parseAttendanceCompliance(data: any): IAttendanceComplianceMetrics | null {
          if (!data) return null;
          return {
               total_records: Number(data.total_records) || 0,
               unique_employees: Number(data.unique_employees) || 0,
               present_count: Number(data.present_count) || 0,
               absent_count: Number(data.absent_count) || 0,
               late_count: Number(data.late_count) || 0,
               records_with_lateness: Number(data.records_with_lateness) || 0,
               avg_late_minutes: Number(data.avg_late_minutes) || 0,
               total_late_minutes: Number(data.total_late_minutes) || 0,
               records_with_overtime: Number(data.records_with_overtime) || 0,
               approved_overtime_records: Number(data.approved_overtime_records) || 0,
               total_overtime_hours: Number(data.total_overtime_hours) || 0,
               total_hours_worked: Number(data.total_hours_worked) || 0,
               avg_hours_per_day: Number(data.avg_hours_per_day) || 0,
               attendance_rate: Number(data.attendance_rate) || 0,
               lateness_rate: Number(data.lateness_rate) || 0,
               overtime_pct_of_hours: Number(data.overtime_pct_of_hours) || 0
          };
     }

     /**
      * Parse leave utilization
      */
     private parseLeaveUtilization(data: any): ILeaveUtilizationMetrics | null {
          if (!data) return null;
          return {
               total_leave_requests: Number(data.total_leave_requests) || 0,
               employees_on_leave: Number(data.employees_on_leave) || 0,
               total_leave_days: Number(data.total_leave_days) || 0,
               avg_leave_duration: Number(data.avg_leave_duration) || 0,
               approved_count: Number(data.approved_count) || 0,
               pending_count: Number(data.pending_count) || 0,
               rejected_count: Number(data.rejected_count) || 0,
               unpaid_leave_days: Number(data.unpaid_leave_days) || 0,
               paid_leave_days: Number(data.paid_leave_days) || 0,
               approval_rate: Number(data.approval_rate) || 0,
               unpaid_leave_pct: Number(data.unpaid_leave_pct) || 0
          };
     }

     /**
      * Parse payroll processing metrics
      */
     private parsePayrollProcessing(data: any): IPayrollProcessingMetrics | null {
          if (!data) return null;
          return {
               total_periods: Number(data.total_periods) || 0,
               draft_count: Number(data.draft_count) || 0,
               pending_approval_count: Number(data.pending_approval_count) || 0,
               approved_count: Number(data.approved_count) || 0,
               locked_count: Number(data.locked_count) || 0,
               paid_count: Number(data.paid_count) || 0,
               total_transactions_processed: Number(data.total_transactions_processed) || 0,
               avg_employees_per_period: Number(data.avg_employees_per_period) || 0,
               completion_rate: Number(data.completion_rate) || 0
          };
     }

     /**
      * Get specific analytics section
      */
     async getPayrollPeriodAnalytics(startDate: string, endDate: string): Promise<IPayrollPeriodAnalytics[]> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const data = await queryBuilder.getPayrollPeriodMetrics(startDate, endDate);
          return this.parsePayrollPeriodMetrics(data);
     }

     async getCompensationAnalytics(startDate: string, endDate: string): Promise<ICompensationAnalytics[]> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const data = await queryBuilder.getCompensationTypeDistribution(startDate, endDate);
          return this.parseCompensationDistribution(data);
     }

     async getAttendanceAnalytics(startDate: string, endDate: string): Promise<IAttendanceAnalytics[]> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const data = await queryBuilder.getAttendanceSummary(startDate, endDate);
          return this.parseAttendanceSummary(data);
     }

     async getLeaveAnalytics(startDate: string, endDate: string): Promise<ILeaveAnalytics[]> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const data = await queryBuilder.getLeaveStatistics(startDate, endDate);
          return this.parseLeaveStatistics(data);
     }

     async getAllowanceBonusAnalytics(startDate: string, endDate: string) {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const [allowances, bonuses] = await Promise.all([
               queryBuilder.getAllowanceBreakdown(startDate, endDate),
               queryBuilder.getBonusStatistics(startDate, endDate)
          ]);

          return {
               allowances: this.parseAllowanceBreakdown(allowances),
               bonuses: this.parseBonusStatistics(bonuses)
          };
     }

     async getDeductionAnalytics(startDate: string, endDate: string) {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const [statutory, other] = await Promise.all([
               queryBuilder.getStatutoryDeductionSummary(),
               queryBuilder.getOtherDeductionsBreakdown(startDate, endDate)
          ]);

          return {
               statutory: this.parseStatutoryDeductions(statutory),
               other: this.parseOtherDeductions(other)
          };
     }

     async getPayrollTrendAnalytics(startDate: string, endDate: string): Promise<IPayrollTrendAnalytics[]> {
          const queryBuilder = new PayrollAnalyticsWithDate(this.tenantId);
          const data = await queryBuilder.getPayrollTrend(startDate, endDate);
          return this.parsePayrollTrend(data);
     }

     // Private parsing methods
     private parsePayrollPeriodMetrics(data: any[]): IPayrollPeriodAnalytics[] {
          return data.map(row => ({
               status: row.status,
               period_count: Number(row.period_count) || 0,
               total_gross: Number(row.total_gross) || 0,
               total_deductions: Number(row.total_deductions) || 0,
               total_net: Number(row.total_net) || 0,
               total_employees: Number(row.total_employees) || 0,
               avg_gross_per_period: Number(row.avg_gross_per_period) || 0,
               avg_net_per_period: Number(row.avg_net_per_period) || 0
          }));
     }

     private parseCompensationDistribution(data: any[]): ICompensationAnalytics[] {
          return data.map(row => ({
               compensation_type: row.compensation_type,
               payment_frequency: row.payment_frequency,
               employee_count: Number(row.employee_count) || 0,
               avg_basic_salary: Number(row.avg_basic_salary) || 0,
               total_basic_salary: Number(row.total_basic_salary) || 0,
               avg_hourly_rate: Number(row.avg_hourly_rate) || 0,
               avg_commission_pct: Number(row.avg_commission_pct) || 0
          }));
     }

     private parsePaymentMethods(data: any[]): IPaymentMethodAnalytics[] {
          return data.map(row => ({
               payment_method: row.payment_method,
               employee_count: Number(row.employee_count) || 0,
               percentage: Number(row.percentage) || 0
          }));
     }

     private parseAttendanceSummary(data: any[]): IAttendanceAnalytics[] {
          return data.map(row => ({
               status: row.status,
               shift_type: row.shift_type,
               record_count: Number(row.record_count) || 0,
               total_hours_worked: Number(row.total_hours_worked) || 0,
               avg_hours_per_day: Number(row.avg_hours_per_day) || 0,
               total_overtime: Number(row.total_overtime) || 0,
               avg_late_minutes: Number(row.avg_late_minutes) || 0,
               unique_employees: Number(row.unique_employees) || 0
          }));
     }

     private parseOvertimeMetrics(data: any[]): IOvertimeAnalytics[] {
          return data.map(row => ({
               overtime_approved: Boolean(row.overtime_approved),
               record_count: Number(row.record_count) || 0,
               total_overtime_hours: Number(row.total_overtime_hours) || 0,
               avg_overtime_hours: Number(row.avg_overtime_hours) || 0,
               employees_with_overtime: Number(row.employees_with_overtime) || 0
          }));
     }

     private parseLeaveStatistics(data: any[]): ILeaveAnalytics[] {
          return data.map(row => ({
               leave_type: row.leave_type,
               status: row.status,
               leave_count: Number(row.leave_count) || 0,
               total_days: Number(row.total_days) || 0,
               avg_days_per_leave: Number(row.avg_days_per_leave) || 0,
               unique_employees: Number(row.unique_employees) || 0,
               unpaid_count: Number(row.unpaid_count) || 0
          }));
     }

     private parseAllowanceBreakdown(data: any[]): IAllowanceAnalytics[] {
          return data.map(row => ({
               allowance_type: row.allowance_type,
               calculation_method: row.calculation_method,
               allowance_count: Number(row.allowance_count) || 0,
               total_amount: Number(row.total_amount) || 0,
               avg_amount: Number(row.avg_amount) || 0,
               employees_receiving: Number(row.employees_receiving) || 0,
               taxable_count: Number(row.taxable_count) || 0
          }));
     }

     private parseBonusStatistics(data: any[]): IBonusAnalytics[] {
          return data.map(row => ({
               bonus_type: row.bonus_type,
               status: row.status,
               bonus_count: Number(row.bonus_count) || 0,
               total_amount: Number(row.total_amount) || 0,
               avg_amount: Number(row.avg_amount) || 0,
               unique_employees: Number(row.unique_employees) || 0,
               avg_performance_rating: Number(row.avg_performance_rating) || 0
          }));
     }

     private parseStatutoryDeductions(data: any): IStatutoryDeductionAnalytics | null {
          if (!data) return null;

          return {
               total_employees: Number(data.total_employees) || 0,
               ssnit_enrolled: Number(data.ssnit_enrolled) || 0,
               tier3_enrolled: Number(data.tier3_enrolled) || 0,
               tax_exempt_count: Number(data.tax_exempt_count) || 0,
               nhis_active_count: Number(data.nhis_active_count) || 0,
               avg_ssnit_rate: Number(data.avg_ssnit_rate) || 0,
               avg_tier3_employee_rate: Number(data.avg_tier3_employee_rate) || 0,
               avg_tier3_employer_rate: Number(data.avg_tier3_employer_rate) || 0,
               avg_nhis_rate: Number(data.avg_nhis_rate) || 0,
               avg_dependents: Number(data.avg_dependents) || 0
          };
     }

     private parseOtherDeductions(data: any[]): IOtherDeductionAnalytics[] {
          return data.map(row => ({
               deduction_type: row.deduction_type,
               deduction_count: Number(row.deduction_count) || 0,
               total_amount: Number(row.total_amount) || 0,
               avg_amount: Number(row.avg_amount) || 0,
               unique_employees: Number(row.unique_employees) || 0,
               total_outstanding: Number(row.total_outstanding) || 0,
               recurring_count: Number(row.recurring_count) || 0
          }));
     }

     private parseTransactionSummary(data: any[]): ITransactionSummaryAnalytics[] {
          return data.map(row => ({
               status: row.status,
               transaction_count: Number(row.transaction_count) || 0,
               total_basic_salary: Number(row.total_basic_salary) || 0,
               total_hourly_earnings: Number(row.total_hourly_earnings) || 0,
               total_overtime_earnings: Number(row.total_overtime_earnings) || 0,
               total_commission: Number(row.total_commission) || 0,
               total_allowances: Number(row.total_allowances) || 0,
               total_bonuses: Number(row.total_bonuses) || 0,
               total_gross_salary: Number(row.total_gross_salary) || 0,
               total_income_tax: Number(row.total_income_tax) || 0,
               total_employee_ssnit: Number(row.total_employee_ssnit) || 0,
               total_employer_ssnit: Number(row.total_employer_ssnit) || 0,
               total_employee_tier3: Number(row.total_employee_tier3) || 0,
               total_employer_tier3: Number(row.total_employer_tier3) || 0,
               total_nhis: Number(row.total_nhis) || 0,
               total_other_deductions: Number(row.total_other_deductions) || 0,
               total_deductions: Number(row.total_deductions) || 0,
               total_net_salary: Number(row.total_net_salary) || 0,
               total_employer_cost: Number(row.total_employer_cost) || 0,
               avg_days_worked: Number(row.avg_days_worked) || 0,
               avg_hours_worked: Number(row.avg_hours_worked) || 0
          }));
     }

     private parseTopEarners(data: any[]): ITopEarningEmployee[] {
          return data.map(row => ({
               employeeid: Number(row.employeeid),
               username: row.username,
               email: row.email,
               total_gross_salary: Number(row.total_gross_salary) || 0,
               total_net_salary: Number(row.total_net_salary) || 0,
               payroll_count: Number(row.payroll_count) || 0
          }));
     }

     private parseCostCenters(data: any[]): ICostCenterAnalytics[] {
          return data.map(row => ({
               cost_center_code: row.cost_center_code,
               cost_center_name: row.cost_center_name,
               department: row.department,
               employee_count: Number(row.employee_count) || 0,
               avg_allocation_percentage: Number(row.avg_allocation_percentage) || 0
          }));
     }

     private parsePayrollTrend(data: any[]): IPayrollTrendAnalytics[] {
          return data.map(row => ({
               period_year: Number(row.period_year),
               period_month: Number(row.period_month),
               period_name: row.period_name,
               gross_salary: Number(row.gross_salary) || 0,
               deductions: Number(row.deductions) || 0,
               net_salary: Number(row.net_salary) || 0,
               employees: Number(row.employees) || 0,
               status: row.status
          }));
     }

     private parseEarningsDistribution(data: any[]): IEarningsDistributionAnalytics[] {
          return data.map(row => ({
               salary_band: row.salary_band,
               employee_count: Number(row.employee_count) || 0,
               avg_gross_salary: Number(row.avg_gross_salary) || 0,
               avg_net_salary: Number(row.avg_net_salary) || 0
          }));
     }
}
