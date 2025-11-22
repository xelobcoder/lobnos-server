import { promisifyQuery } from "../../../hooks/helper";

export default class ExpensesAnalytics {
     private branchid: number;
     private tenantId: number;
     private expenseId: number | null;
     private startdate: string | null;
     private enddate: string | null;
     constructor(tenantId: number, branchid: number, expenseId: number | null, startdate: string | null, enddate: string | null) {
          this.branchid = branchid;
          this.tenantId = tenantId;
          this.expenseId = expenseId;
          this.startdate = startdate;
          this.enddate = enddate;
     }

     // Daily Expense Analytics
     public async getDailyExpenseAnalytics() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_DailyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Hourly Expense Analytics
     public async getHourlyExpenseAnalytics(targetDate: string) {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_HourlyExpenseAnalytics(?, ?)`, [this.branchid, targetDate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Weekly Expense Analytics
     public async getWeeklyExpenseAnalytics() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_WeeklyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Monthly Expense Analytics
     public async getMonthlyExpenseAnalytics() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_MonthlyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Quarterly Expense Analytics
     public async getQuarterlyExpenseAnalytics() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_QuarterlyExpenseAnalytics(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Yearly Expense Analytics
     public async getYearlyExpenseAnalytics(startYear: number, endYear: number) {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_YearlyExpenseAnalytics(?, ?, ?)`, [this.branchid, startYear, endYear]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Top Expense Categories
     public async getTopExpenseCategories() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_TopExpenseCategories(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Top Expense Merchants
     public async getTopExpenseMerchants() {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_TopExpenseMerchants(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Top Expense Employees
     public async getTopExpenseEmployees(limitCount: number = 10) {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_TopExpenseEmployees(?, ?, ?, ?)`, [this.branchid, this.startdate, this.enddate, limitCount]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Expense Trends by Category
     public async getExpenseTrendsByCategory(categoryId?: number) {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_ExpenseTrendsByCategory(?, ?, ?, ?)`, [categoryId || null, this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     // Expense Comparison by Period
     public async getExpenseComparisonByPeriod(currentStartDate: string, currentEndDate: string, previousStartDate: string, previousEndDate: string) {
          const result = await promisifyQuery(this.tenantId, `CALL lims_anal_exp_ExpenseComparisonByPeriod(?, ?, ?, ?, ?)`, [this.branchid, currentStartDate, currentEndDate, previousStartDate, previousEndDate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }
}