"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollAnalytics = void 0;
const PayrollAnalyticsWithDate_1 = require("./PayrollAnalyticsWithDate");
/**
 * PayrollAnalytics - Aggregates and formats payroll analytics data
 */
class PayrollAnalytics {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    /**
     * Get comprehensive payroll analytics for date range
     */
    async getPayrollAnalytics(startDate, endDate, topEarnersLimit = 10) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        // Execute all queries in parallel for better performance
        const [financialKPIs, headcountAnalytics, periodComparison, payrollPeriodMetrics, compensationDistribution, paymentMethods, attendanceSummary, overtimeMetrics, leaveStatistics, allowanceBreakdown, bonusStatistics, statutoryDeductions, otherDeductions, transactionSummary, topEarners, costCenters, payrollTrend, compliance, earningsDistribution, attendanceCompliance, leaveUtilization, payrollProcessing] = await Promise.all([
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
            queryBuilder.getStatutoryDeductionSummary(startDate, endDate),
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
    parseFinancialKPIs(data) {
        if (!data)
            return null;
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
    parseHeadcountAnalytics(data) {
        return {
            active_employees_in_period: data.active_employees_in_period || 0,
            compensation_type_breakdown: data.compensation_type_breakdown || [],
            payment_frequency_breakdown: data.payment_frequency_breakdown || []
        };
    }
    /**
     * Parse attendance compliance
     */
    parseAttendanceCompliance(data) {
        if (!data)
            return null;
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
    parseLeaveUtilization(data) {
        if (!data)
            return null;
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
    parsePayrollProcessing(data) {
        if (!data)
            return null;
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
    async getPayrollPeriodAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const data = await queryBuilder.getPayrollPeriodMetrics(startDate, endDate);
        return this.parsePayrollPeriodMetrics(data);
    }
    async getCompensationAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const data = await queryBuilder.getCompensationTypeDistribution(startDate, endDate);
        return this.parseCompensationDistribution(data);
    }
    async getAttendanceAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const data = await queryBuilder.getAttendanceSummary(startDate, endDate);
        return this.parseAttendanceSummary(data);
    }
    async getLeaveAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const data = await queryBuilder.getLeaveStatistics(startDate, endDate);
        return this.parseLeaveStatistics(data);
    }
    async getAllowanceBonusAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const [allowances, bonuses] = await Promise.all([
            queryBuilder.getAllowanceBreakdown(startDate, endDate),
            queryBuilder.getBonusStatistics(startDate, endDate)
        ]);
        return {
            allowances: this.parseAllowanceBreakdown(allowances),
            bonuses: this.parseBonusStatistics(bonuses)
        };
    }
    async getDeductionAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const [statutory, other] = await Promise.all([
            queryBuilder.getStatutoryDeductionSummary(startDate, endDate),
            queryBuilder.getOtherDeductionsBreakdown(startDate, endDate)
        ]);
        return {
            statutory: this.parseStatutoryDeductions(statutory),
            other: this.parseOtherDeductions(other)
        };
    }
    async getPayrollTrendAnalytics(startDate, endDate) {
        const queryBuilder = new PayrollAnalyticsWithDate_1.PayrollAnalyticsWithDate(this.tenantId);
        const data = await queryBuilder.getPayrollTrend(startDate, endDate);
        return this.parsePayrollTrend(data);
    }
    // Private parsing methods
    parsePayrollPeriodMetrics(data) {
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
    parseCompensationDistribution(data) {
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
    parsePaymentMethods(data) {
        return data.map(row => ({
            payment_method: row.payment_method,
            employee_count: Number(row.employee_count) || 0,
            percentage: Number(row.percentage) || 0
        }));
    }
    parseAttendanceSummary(data) {
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
    parseOvertimeMetrics(data) {
        return data.map(row => ({
            overtime_approved: Boolean(row.overtime_approved),
            record_count: Number(row.record_count) || 0,
            total_overtime_hours: Number(row.total_overtime_hours) || 0,
            avg_overtime_hours: Number(row.avg_overtime_hours) || 0,
            employees_with_overtime: Number(row.employees_with_overtime) || 0
        }));
    }
    parseLeaveStatistics(data) {
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
    parseAllowanceBreakdown(data) {
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
    parseBonusStatistics(data) {
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
    parseStatutoryDeductions(data) {
        if (!data)
            return null;
        return {
            total_employees: Number(data.total_employees) || 0,
            ssnit_enrolled: Number(data.ssnit_enrolled) || 0,
            tier3_enrolled: Number(data.tier3_enrolled) || 0,
            tax_exempt_count: Number(data.tax_exempt_count) || 0,
            nhis_active_count: Number(data.nhis_active_count) || 0,
            avg_dependents: Number(data.avg_dependents) || 0
        };
    }
    parseOtherDeductions(data) {
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
    parseTransactionSummary(data) {
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
    parseTopEarners(data) {
        return data.map(row => ({
            employeeid: Number(row.employeeid),
            username: row.username,
            email: row.email,
            total_gross_salary: Number(row.total_gross_salary) || 0,
            total_net_salary: Number(row.total_net_salary) || 0,
            payroll_count: Number(row.payroll_count) || 0
        }));
    }
    parseCostCenters(data) {
        return data.map(row => ({
            cost_center_code: row.cost_center_code,
            cost_center_name: row.cost_center_name,
            department: row.department,
            employee_count: Number(row.employee_count) || 0,
            avg_allocation_percentage: Number(row.avg_allocation_percentage) || 0
        }));
    }
    parsePayrollTrend(data) {
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
    parseEarningsDistribution(data) {
        return data.map(row => ({
            salary_band: row.salary_band,
            employee_count: Number(row.employee_count) || 0,
            avg_gross_salary: Number(row.avg_gross_salary) || 0,
            avg_net_salary: Number(row.avg_net_salary) || 0
        }));
    }
}
exports.PayrollAnalytics = PayrollAnalytics;
