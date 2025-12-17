import KnexConnection from '../../database/KnexConnections';
import { Knex } from 'knex';

/**
 * PayrollAnalyticsWithDate - Query builder for payroll analytics
 * Returns raw database results for aggregation by PayrollAnalytics service
 */
export class PayrollAnalyticsWithDate {
     constructor(private tenantId: number) { }

     private get connection(): Promise<Knex> {
          return KnexConnection(this.tenantId);
     }

     /**
      * Get payroll period summary metrics within date range
      */
     async getPayrollPeriodMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_periods')
               .select(
                    connection.raw('status'),
                    connection.raw('COUNT(*) as period_count'),
                    connection.raw('SUM(total_gross_salary) as total_gross'),
                    connection.raw('SUM(total_deductions) as total_deductions'),
                    connection.raw('SUM(total_net_salary) as total_net'),
                    connection.raw('SUM(employee_count) as total_employees'),
                    connection.raw('AVG(total_gross_salary) as avg_gross_per_period'),
                    connection.raw('AVG(total_net_salary) as avg_net_per_period')
               )
               .where('period_start_date', '<=', endDate)
               .where('period_end_date', '>=', startDate)
               .groupBy('status');
     }

     /**
      * Get compensation type distribution
      */
     async getCompensationTypeDistribution(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_compensation')
               .select(
                    connection.raw('compensation_type'),
                    connection.raw('payment_frequency'),
                    connection.raw('COUNT(*) as employee_count'),
                    connection.raw('AVG(basic_salary) as avg_basic_salary'),
                    connection.raw('SUM(basic_salary) as total_basic_salary'),
                    connection.raw('AVG(hourly_rate) as avg_hourly_rate'),
                    connection.raw('AVG(commission_percentage) as avg_commission_pct')
               )
               .where('is_active', true)
               .groupBy('compensation_type', 'payment_frequency');
     }

     /**
      * Get payment method breakdown
      */
     async getPaymentMethodDistribution() {
          const connection = await this.connection;
          return connection('payroll_employee_compensation')
               .select(
                    connection.raw('payment_method'),
                    connection.raw('COUNT(*) as employee_count'),
                    connection.raw('ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM payroll_employee_compensation WHERE is_active = 1)), 1) as percentage')
               )
               .where('is_active', true)
               .groupBy('payment_method');
     }

     /**
      * Get attendance summary by status within date range
      */
     async getAttendanceSummary(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_attendance')
               .select(
                    connection.raw('status'),
                    connection.raw('shift_type'),
                    connection.raw('COUNT(*) as record_count'),
                    connection.raw('SUM(total_hours) as total_hours_worked'),
                    connection.raw('AVG(total_hours) as avg_hours_per_day'),
                    connection.raw('SUM(overtime_hours) as total_overtime'),
                    connection.raw('AVG(late_minutes) as avg_late_minutes'),
                    connection.raw('COUNT(DISTINCT employeeid) as unique_employees')
               )
               .whereRaw('DATE(attendance_date) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('status', 'shift_type');
     }

     /**
      * Get overtime approval metrics
      */
     async getOvertimeMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_attendance')
               .select(
                    connection.raw('overtime_approved'),
                    connection.raw('COUNT(*) as record_count'),
                    connection.raw('SUM(overtime_hours) as total_overtime_hours'),
                    connection.raw('AVG(overtime_hours) as avg_overtime_hours'),
                    connection.raw('COUNT(DISTINCT employeeid) as employees_with_overtime')
               )
               .whereRaw('DATE(attendance_date) BETWEEN ? AND ?', [startDate, endDate])
               .where('overtime_hours', '>', 0)
               .groupBy('overtime_approved');
     }

     /**
      * Get leave statistics by type within date range
      */
     async getLeaveStatistics(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_leave')
               .select(
                    connection.raw('leave_type'),
                    connection.raw('status'),
                    connection.raw('COUNT(*) as leave_count'),
                    connection.raw('SUM(total_days) as total_days'),
                    connection.raw('AVG(total_days) as avg_days_per_leave'),
                    connection.raw('COUNT(DISTINCT employeeid) as unique_employees'),
                    connection.raw('SUM(CASE WHEN affects_salary = 1 THEN 1 ELSE 0 END) as unpaid_count')
               )
               .whereRaw('DATE(start_date) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('leave_type', 'status');
     }

     /**
      * Get allowance distribution by type
      */
     async getAllowanceBreakdown(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_allowances')
               .select(
                    connection.raw('allowance_type'),
                    connection.raw('calculation_method'),
                    connection.raw('COUNT(*) as allowance_count'),
                    connection.raw('SUM(amount) as total_amount'),
                    connection.raw('AVG(amount) as avg_amount'),
                    connection.raw('COUNT(DISTINCT employeeid) as employees_receiving'),
                    connection.raw('SUM(CASE WHEN is_taxable = 1 THEN 1 ELSE 0 END) as taxable_count')
               )
               .where('is_active', true)
               .whereRaw('DATE(effective_from) <= ?', [endDate])
               .where(function () {
                    this.whereNull('effective_to')
                         .orWhereRaw('DATE(effective_to) >= ?', [startDate]);
               })
               .groupBy('allowance_type', 'calculation_method');
     }

     /**
      * Get bonus statistics by type and status
      */
     async getBonusStatistics(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_bonuses')
               .select(
                    connection.raw('bonus_type'),
                    connection.raw('status'),
                    connection.raw('COUNT(*) as bonus_count'),
                    connection.raw('SUM(amount) as total_amount'),
                    connection.raw('AVG(amount) as avg_amount'),
                    connection.raw('COUNT(DISTINCT employeeid) as unique_employees'),
                    connection.raw('AVG(performance_rating) as avg_performance_rating')
               )
               .whereRaw('DATE(created_at) BETWEEN ? AND ?', [startDate, endDate])
               .groupBy('bonus_type', 'status');
     }

     /**
      * Get statutory deduction summary
      */
     async getStatutoryDeductionSummary() {
          const connection = await this.connection;
          return connection('payroll_employee_statutory_deductions')
               .select(
                    connection.raw('COUNT(*) as total_employees'),
                    connection.raw('SUM(CASE WHEN ssnit_active = 1 THEN 1 ELSE 0 END) as ssnit_enrolled'),
                    connection.raw('SUM(CASE WHEN tier3_enrolled = 1 THEN 1 ELSE 0 END) as tier3_enrolled'),
                    connection.raw('SUM(CASE WHEN tax_exempt = 1 THEN 1 ELSE 0 END) as tax_exempt_count'),
                    connection.raw('SUM(CASE WHEN nhis_active = 1 THEN 1 ELSE 0 END) as nhis_active_count'),
                    connection.raw('AVG(ssnit_employee_rate) as avg_ssnit_rate'),
                    connection.raw('AVG(tier3_employee_rate) as avg_tier3_employee_rate'),
                    connection.raw('AVG(tier3_employer_rate) as avg_tier3_employer_rate'),
                    connection.raw('AVG(nhis_rate) as avg_nhis_rate'),
                    connection.raw('AVG(dependents_count) as avg_dependents')
               );
     }

     /**
      * Get other deductions by type
      */
     async getOtherDeductionsBreakdown(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_employee_other_deductions')
               .select(
                    connection.raw('deduction_type'),
                    connection.raw('COUNT(*) as deduction_count'),
                    connection.raw('SUM(amount) as total_amount'),
                    connection.raw('AVG(amount) as avg_amount'),
                    connection.raw('COUNT(DISTINCT employeeid) as unique_employees'),
                    connection.raw('SUM(remaining_balance) as total_outstanding'),
                    connection.raw('SUM(CASE WHEN is_recurring = 1 THEN 1 ELSE 0 END) as recurring_count')
               )
               .where('is_active', true)
               .whereRaw('DATE(start_date) <= ?', [endDate])
               .where(function () {
                    this.whereNull('end_date')
                         .orWhereRaw('DATE(end_date) >= ?', [startDate]);
               })
               .groupBy('deduction_type');
     }

     /**
      * Get payroll transaction summary by period
      */
     async getPayrollTransactionSummary(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .select(
                    connection.raw('pt.status'),
                    connection.raw('COUNT(*) as transaction_count'),
                    connection.raw('SUM(pt.basic_salary) as total_basic_salary'),
                    connection.raw('SUM(pt.hourly_earnings) as total_hourly_earnings'),
                    connection.raw('SUM(pt.overtime_earnings) as total_overtime_earnings'),
                    connection.raw('SUM(pt.commission_earnings) as total_commission'),
                    connection.raw('SUM(pt.total_allowances) as total_allowances'),
                    connection.raw('SUM(pt.total_bonuses) as total_bonuses'),
                    connection.raw('SUM(pt.gross_salary) as total_gross_salary'),
                    connection.raw('SUM(pt.income_tax) as total_income_tax'),
                    connection.raw('SUM(pt.employee_ssnit) as total_employee_ssnit'),
                    connection.raw('SUM(pt.employer_ssnit) as total_employer_ssnit'),
                    connection.raw('SUM(pt.employee_tier3) as total_employee_tier3'),
                    connection.raw('SUM(pt.employer_tier3) as total_employer_tier3'),
                    connection.raw('SUM(pt.nhis) as total_nhis'),
                    connection.raw('SUM(pt.total_other_deductions) as total_other_deductions'),
                    connection.raw('SUM(pt.total_deductions) as total_deductions'),
                    connection.raw('SUM(pt.net_salary) as total_net_salary'),
                    connection.raw('SUM(pt.employer_cost) as total_employer_cost'),
                    connection.raw('AVG(pt.days_worked) as avg_days_worked'),
                    connection.raw('AVG(pt.hours_worked) as avg_hours_worked')
               )
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .groupBy('pt.status');
     }

     /**
      * Get top earning employees in period
      */
     async getTopEarningEmployees(startDate: string, endDate: string, limit: number = 10) {
          const connection = await this.connection;
          return connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .join('roles as r', 'pt.employeeid', 'r.employeeid')
               .select(
                    'pt.employeeid',
                    connection.raw('r.username'),
                    connection.raw('r.email'),
                    connection.raw('SUM(pt.gross_salary) as total_gross_salary'),
                    connection.raw('SUM(pt.net_salary) as total_net_salary'),
                    connection.raw('COUNT(pt.id) as payroll_count')
               )
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .groupBy('pt.employeeid', 'r.username', 'r.email')
               .orderBy('total_gross_salary', 'desc')
               .limit(limit);
     }

     /**
      * Get cost center allocation summary
      */
     async getCostCenterAllocation(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_cost_centers as pcc')
               .leftJoin('payroll_employee_cost_center_allocation as pecca', function () {
                    this.on('pcc.id', '=', 'pecca.cost_center_id')
                         .andOn('pecca.is_active', '=', connection.raw('?', [true]));
               })
               .select(
                    'pcc.cost_center_code',
                    'pcc.cost_center_name',
                    'pcc.department',
                    connection.raw('COUNT(DISTINCT pecca.employeeid) as employee_count'),
                    connection.raw('AVG(pecca.allocation_percentage) as avg_allocation_percentage')
               )
               .where('pcc.is_active', true)
               .groupBy('pcc.id', 'pcc.cost_center_code', 'pcc.cost_center_name', 'pcc.department');
     }

     /**
      * Get payroll trend over time (monthly)
      */
     async getPayrollTrend(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_periods')
               .select(
                    connection.raw('period_year'),
                    connection.raw('period_month'),
                    connection.raw('period_name'),
                    connection.raw('SUM(total_gross_salary) as gross_salary'),
                    connection.raw('SUM(total_deductions) as deductions'),
                    connection.raw('SUM(total_net_salary) as net_salary'),
                    connection.raw('SUM(employee_count) as employees'),
                    connection.raw('status')
               )
               .whereRaw('DATE(period_start_date) >= ?', [startDate])
               .whereRaw('DATE(period_end_date) <= ?', [endDate])
               .groupBy('period_year', 'period_month', 'period_name', 'status')
               .orderBy('period_year', 'asc')
               .orderBy('period_month', 'asc');
     }

     /**
      * Get deduction compliance rate
      */
     async getDeductionComplianceRate() {
          const connection = await this.connection;
          const totalEmployees = await connection('roles')
               .where('role', 'employee')
               .count('employeeid as count')
               .first();

          const statutory = await connection('payroll_employee_statutory_deductions')
               .countDistinct('employeeid as employees_with_statutory')
               .first();

          const totalCount = Number(totalEmployees?.count || 0);
          const statutoryCount = Number(statutory?.employees_with_statutory || 0);

          return {
               total_employees: totalCount,
               employees_with_statutory: statutoryCount,
               compliance_percentage: totalCount > 0 ?
                    Math.round((statutoryCount / totalCount) * 100) : 0
          };
     }

     /**
      * Get employee earnings distribution (salary bands)
      */
     async getEarningsDistribution(startDate: string, endDate: string) {
          const connection = await this.connection;
          return connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .select(
                    connection.raw(`
                         CASE 
                              WHEN pt.gross_salary < 1000 THEN 'Below 1000'
                              WHEN pt.gross_salary >= 1000 AND pt.gross_salary < 2000 THEN '1000-2000'
                              WHEN pt.gross_salary >= 2000 AND pt.gross_salary < 5000 THEN '2000-5000'
                              WHEN pt.gross_salary >= 5000 AND pt.gross_salary < 10000 THEN '5000-10000'
                              ELSE 'Above 10000'
                         END as salary_band
                    `),
                    connection.raw('COUNT(*) as employee_count'),
                    connection.raw('ROUND(AVG(pt.gross_salary), 2) as avg_gross_salary'),
                    connection.raw('ROUND(AVG(pt.net_salary), 2) as avg_net_salary')
               )
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .groupByRaw(`
                    CASE 
                         WHEN pt.gross_salary < 1000 THEN 'Below 1000'
                         WHEN pt.gross_salary >= 1000 AND pt.gross_salary < 2000 THEN '1000-2000'
                         WHEN pt.gross_salary >= 2000 AND pt.gross_salary < 5000 THEN '2000-5000'
                         WHEN pt.gross_salary >= 5000 AND pt.gross_salary < 10000 THEN '5000-10000'
                         ELSE 'Above 10000'
                    END
               `)
               .orderByRaw(`
                    CASE 
                         WHEN pt.gross_salary < 1000 THEN 1
                         WHEN pt.gross_salary >= 1000 AND pt.gross_salary < 2000 THEN 2
                         WHEN pt.gross_salary >= 2000 AND pt.gross_salary < 5000 THEN 3
                         WHEN pt.gross_salary >= 5000 AND pt.gross_salary < 10000 THEN 4
                         ELSE 5
                    END
               `);
     }

     /**
      * Get comprehensive financial KPIs
      */
     async getFinancialKPIs(startDate: string, endDate: string) {
          const connection = await this.connection;

          // Try to get detailed transaction-level data first
          const transactionKpis = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .select(
                    connection.raw('COUNT(DISTINCT pt.employeeid) as total_employees'),
                    connection.raw('COUNT(DISTINCT pp.id) as total_periods'),
                    connection.raw('SUM(pt.gross_salary) as total_gross_payroll'),
                    connection.raw('SUM(pt.net_salary) as total_net_payroll'),
                    connection.raw('SUM(pt.employer_cost) as total_employer_cost'),
                    connection.raw('SUM(pt.total_deductions) as total_deductions'),
                    connection.raw('SUM(pt.income_tax) as total_tax_liability'),
                    connection.raw('SUM(pt.employer_ssnit + pt.employer_tier3) as total_employer_contributions'),
                    connection.raw('SUM(pt.employee_ssnit + pt.employee_tier3) as total_employee_contributions'),
                    connection.raw('SUM(pt.total_allowances) as total_allowances'),
                    connection.raw('SUM(pt.total_bonuses) as total_bonuses'),
                    connection.raw('SUM(pt.overtime_earnings) as total_overtime_cost'),
                    connection.raw('SUM(pt.hours_worked) as total_hours_worked'),
                    connection.raw('AVG(pt.gross_salary) as avg_gross_per_employee'),
                    connection.raw('AVG(pt.net_salary) as avg_net_per_employee'),
                    connection.raw('AVG(pt.employer_cost) as avg_employer_cost_per_employee'),
                    connection.raw('AVG(pt.hours_worked) as avg_hours_per_employee'),
                    // Calculate effective tax rate
                    connection.raw('ROUND((SUM(pt.income_tax) / NULLIF(SUM(pt.gross_salary), 0)) * 100, 2) as effective_tax_rate'),
                    // Calculate employer cost burden (employer cost as % of gross)
                    connection.raw('ROUND((SUM(pt.employer_cost) / NULLIF(SUM(pt.gross_salary), 0)) * 100, 2) as employer_cost_burden_pct'),
                    // Calculate deduction rate
                    connection.raw('ROUND((SUM(pt.total_deductions) / NULLIF(SUM(pt.gross_salary), 0)) * 100, 2) as deduction_rate_pct'),
                    // Calculate overtime as percentage of total earnings
                    connection.raw('ROUND((SUM(pt.overtime_earnings) / NULLIF(SUM(pt.gross_salary), 0)) * 100, 2) as overtime_pct_of_gross'),
                    // Calculate cost per working hour
                    connection.raw('ROUND(SUM(pt.employer_cost) / NULLIF(SUM(pt.hours_worked), 0), 2) as cost_per_hour')
               )
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .first();

          // If no transactions exist, fall back to period-level aggregates
          if (!transactionKpis || Number((transactionKpis as any).total_gross_payroll) === 0) {
               const periodKpis: any = await connection('payroll_periods as pp')
                    .select(
                         connection.raw('COUNT(DISTINCT pp.id) as total_periods'),
                         connection.raw('SUM(pp.employee_count) as total_employees'),
                         connection.raw('SUM(pp.total_gross_salary) as total_gross_payroll'),
                         connection.raw('SUM(pp.total_net_salary) as total_net_payroll'),
                         connection.raw('SUM(pp.total_deductions) as total_deductions'),
                         connection.raw('AVG(pp.total_gross_salary) as avg_gross_per_period'),
                         connection.raw('AVG(pp.total_net_salary) as avg_net_per_period'),
                         connection.raw('AVG(pp.total_gross_salary / NULLIF(pp.employee_count, 0)) as avg_gross_per_employee'),
                         connection.raw('AVG(pp.total_net_salary / NULLIF(pp.employee_count, 0)) as avg_net_per_employee'),
                         connection.raw('ROUND((SUM(pp.total_deductions) / NULLIF(SUM(pp.total_gross_salary), 0)) * 100, 2) as deduction_rate_pct')
                    )
                    .where('pp.period_start_date', '<=', endDate)
                    .where('pp.period_end_date', '>=', startDate)
                    .first();

               return {
                    total_employees: Number(periodKpis?.total_employees) || 0,
                    total_periods: Number(periodKpis?.total_periods) || 0,
                    total_gross_payroll: Number(periodKpis?.total_gross_payroll) || 0,
                    total_net_payroll: Number(periodKpis?.total_net_payroll) || 0,
                    total_employer_cost: Number(periodKpis?.total_gross_payroll) || 0, // Estimate as gross
                    total_deductions: Number(periodKpis?.total_deductions) || 0,
                    total_tax_liability: 0,
                    total_employer_contributions: 0,
                    total_employee_contributions: 0,
                    total_allowances: 0,
                    total_bonuses: 0,
                    total_overtime_cost: 0,
                    total_hours_worked: 0,
                    avg_gross_per_employee: Number(periodKpis?.avg_gross_per_employee) || 0,
                    avg_net_per_employee: Number(periodKpis?.avg_net_per_employee) || 0,
                    avg_employer_cost_per_employee: Number(periodKpis?.avg_gross_per_employee) || 0,
                    avg_hours_per_employee: 0,
                    effective_tax_rate: 0,
                    employer_cost_burden_pct: 100, // If using period totals, assume 100% as estimate
                    deduction_rate_pct: Number(periodKpis?.deduction_rate_pct) || 0,
                    overtime_pct_of_gross: 0,
                    cost_per_hour: 0
               };
          }

          return transactionKpis as any;
     }

     /**
      * Get headcount analytics
      */
     async getHeadcountAnalytics(startDate: string, endDate: string) {
          const connection = await this.connection;

          // Active employees in the period
          const activeEmployees = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .countDistinct('pt.employeeid as count')
               .first();

          // Compensation type breakdown
          const compTypeBreakdown = await connection('payroll_employee_compensation')
               .select(
                    'compensation_type',
                    connection.raw('COUNT(*) as count')
               )
               .where('is_active', true)
               .groupBy('compensation_type');

          // Payment frequency breakdown
          const payFrequencyBreakdown = await connection('payroll_employee_compensation')
               .select(
                    'payment_frequency',
                    connection.raw('COUNT(*) as count')
               )
               .where('is_active', true)
               .groupBy('payment_frequency');

          return {
               active_employees_in_period: Number(activeEmployees?.count || 0),
               compensation_type_breakdown: compTypeBreakdown,
               payment_frequency_breakdown: payFrequencyBreakdown
          };
     }

     /**
      * Get period comparison metrics (compares current period with previous)
      */
     async getPeriodComparisonMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;

          // Calculate the date range for the previous period (same duration)
          const startDateObj = new Date(startDate);
          const endDateObj = new Date(endDate);
          const durationDays = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));

          const previousStartDate = new Date(startDateObj);
          previousStartDate.setDate(previousStartDate.getDate() - durationDays);
          const previousEndDate = new Date(startDateObj);
          previousEndDate.setDate(previousEndDate.getDate() - 1);

          const prevStart = previousStartDate.toISOString().split('T')[0];
          const prevEnd = previousEndDate.toISOString().split('T')[0];

          // Current period metrics
          const currentMetrics: any = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .select(
                    connection.raw('COUNT(DISTINCT pt.employeeid) as employee_count'),
                    connection.raw('SUM(pt.gross_salary) as total_gross'),
                    connection.raw('SUM(pt.net_salary) as total_net'),
                    connection.raw('SUM(pt.employer_cost) as total_employer_cost'),
                    connection.raw('SUM(pt.total_allowances) as total_allowances'),
                    connection.raw('SUM(pt.overtime_earnings) as total_overtime')
               )
               .where('pp.period_start_date', '<=', endDate)
               .where('pp.period_end_date', '>=', startDate)
               .first();

          // Previous period metrics
          const previousMetrics: any = await connection('payroll_transactions as pt')
               .join('payroll_periods as pp', 'pt.payroll_period_id', 'pp.id')
               .select(
                    connection.raw('COUNT(DISTINCT pt.employeeid) as employee_count'),
                    connection.raw('SUM(pt.gross_salary) as total_gross'),
                    connection.raw('SUM(pt.net_salary) as total_net'),
                    connection.raw('SUM(pt.employer_cost) as total_employer_cost'),
                    connection.raw('SUM(pt.total_allowances) as total_allowances'),
                    connection.raw('SUM(pt.overtime_earnings) as total_overtime')
               )
               .where('pp.period_start_date', '<=', prevEnd)
               .where('pp.period_end_date', '>=', prevStart)
               .first();

          // Calculate percentage changes
          const calculateChange = (current: number, previous: number) => {
               if (previous === 0) return current > 0 ? 100 : 0;
               return Math.round(((current - previous) / previous) * 100 * 100) / 100;
          };

          const curr = {
               employee_count: Number(currentMetrics?.employee_count || 0),
               total_gross: Number(currentMetrics?.total_gross || 0),
               total_net: Number(currentMetrics?.total_net || 0),
               total_employer_cost: Number(currentMetrics?.total_employer_cost || 0),
               total_allowances: Number(currentMetrics?.total_allowances || 0),
               total_overtime: Number(currentMetrics?.total_overtime || 0)
          };

          const prev = {
               employee_count: Number(previousMetrics?.employee_count || 0),
               total_gross: Number(previousMetrics?.total_gross || 0),
               total_net: Number(previousMetrics?.total_net || 0),
               total_employer_cost: Number(previousMetrics?.total_employer_cost || 0),
               total_allowances: Number(previousMetrics?.total_allowances || 0),
               total_overtime: Number(previousMetrics?.total_overtime || 0)
          };

          return {
               current_period: {
                    start_date: startDate,
                    end_date: endDate,
                    ...curr
               },
               previous_period: {
                    start_date: prevStart,
                    end_date: prevEnd,
                    ...prev
               },
               changes: {
                    employee_count_change: curr.employee_count - prev.employee_count,
                    employee_count_change_pct: calculateChange(curr.employee_count, prev.employee_count),
                    gross_payroll_change: curr.total_gross - prev.total_gross,
                    gross_payroll_change_pct: calculateChange(curr.total_gross, prev.total_gross),
                    net_payroll_change: curr.total_net - prev.total_net,
                    net_payroll_change_pct: calculateChange(curr.total_net, prev.total_net),
                    employer_cost_change: curr.total_employer_cost - prev.total_employer_cost,
                    employer_cost_change_pct: calculateChange(curr.total_employer_cost, prev.total_employer_cost),
                    allowances_change: curr.total_allowances - prev.total_allowances,
                    allowances_change_pct: calculateChange(curr.total_allowances, prev.total_allowances),
                    overtime_change: curr.total_overtime - prev.total_overtime,
                    overtime_change_pct: calculateChange(curr.total_overtime, prev.total_overtime)
               }
          };
     }

     /**
      * Get attendance compliance metrics
      */
     async getAttendanceComplianceMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;

          return connection('payroll_employee_attendance')
               .select(
                    connection.raw('COUNT(*) as total_records'),
                    connection.raw('COUNT(DISTINCT employeeid) as unique_employees'),
                    connection.raw('SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) as present_count'),
                    connection.raw('SUM(CASE WHEN status = "absent" THEN 1 ELSE 0 END) as absent_count'),
                    connection.raw('SUM(CASE WHEN status = "late" THEN 1 ELSE 0 END) as late_count'),
                    connection.raw('SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) as records_with_lateness'),
                    connection.raw('AVG(late_minutes) as avg_late_minutes'),
                    connection.raw('SUM(late_minutes) as total_late_minutes'),
                    connection.raw('SUM(CASE WHEN overtime_hours > 0 THEN 1 ELSE 0 END) as records_with_overtime'),
                    connection.raw('SUM(CASE WHEN overtime_approved = 1 AND overtime_hours > 0 THEN 1 ELSE 0 END) as approved_overtime_records'),
                    connection.raw('SUM(overtime_hours) as total_overtime_hours'),
                    connection.raw('SUM(total_hours) as total_hours_worked'),
                    connection.raw('AVG(total_hours) as avg_hours_per_day'),
                    connection.raw('ROUND((SUM(CASE WHEN status = "present" THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) as attendance_rate'),
                    connection.raw('ROUND((SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) as lateness_rate'),
                    connection.raw('ROUND((SUM(overtime_hours) / NULLIF(SUM(total_hours), 0)) * 100, 2) as overtime_pct_of_hours')
               )
               .whereRaw('DATE(attendance_date) BETWEEN ? AND ?', [startDate, endDate])
               .first();
     }

     /**
      * Get leave utilization metrics
      */
     async getLeaveUtilizationMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;

          return connection('payroll_employee_leave')
               .select(
                    connection.raw('COUNT(*) as total_leave_requests'),
                    connection.raw('COUNT(DISTINCT employeeid) as employees_on_leave'),
                    connection.raw('SUM(total_days) as total_leave_days'),
                    connection.raw('AVG(total_days) as avg_leave_duration'),
                    connection.raw('SUM(CASE WHEN status = "approved" THEN 1 ELSE 0 END) as approved_count'),
                    connection.raw('SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending_count'),
                    connection.raw('SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as rejected_count'),
                    connection.raw('SUM(CASE WHEN affects_salary = 1 THEN total_days ELSE 0 END) as unpaid_leave_days'),
                    connection.raw('SUM(CASE WHEN affects_salary = 0 THEN total_days ELSE 0 END) as paid_leave_days'),
                    connection.raw('ROUND((SUM(CASE WHEN status = "approved" THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) as approval_rate'),
                    connection.raw('ROUND((SUM(CASE WHEN affects_salary = 1 THEN total_days ELSE 0 END) / NULLIF(SUM(total_days), 0)) * 100, 2) as unpaid_leave_pct')
               )
               .whereRaw('DATE(start_date) BETWEEN ? AND ?', [startDate, endDate])
               .first();
     }

     /**
      * Get payroll processing efficiency metrics
      */
     async getPayrollProcessingMetrics(startDate: string, endDate: string) {
          const connection = await this.connection;

          return connection('payroll_periods')
               .select(
                    connection.raw('COUNT(*) as total_periods'),
                    connection.raw('SUM(CASE WHEN status = "draft" THEN 1 ELSE 0 END) as draft_count'),
                    connection.raw('SUM(CASE WHEN status = "pending_approval" THEN 1 ELSE 0 END) as pending_approval_count'),
                    connection.raw('SUM(CASE WHEN status = "approved" THEN 1 ELSE 0 END) as approved_count'),
                    connection.raw('SUM(CASE WHEN status = "locked" THEN 1 ELSE 0 END) as locked_count'),
                    connection.raw('SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) as paid_count'),
                    connection.raw('SUM(employee_count) as total_transactions_processed'),
                    connection.raw('AVG(employee_count) as avg_employees_per_period'),
                    connection.raw('ROUND((SUM(CASE WHEN status IN ("approved", "locked", "paid") THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0)) * 100, 2) as completion_rate')
               )
               .where('period_start_date', '<=', endDate)
               .where('period_end_date', '>=', startDate)
               .first();
     }
}
