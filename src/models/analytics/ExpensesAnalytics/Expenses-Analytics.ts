import { promisifyQuery } from "../../../hooks/helper";

export default class ExpensesAnalytics {
     private branchid: number;
     private tenantId: number;
     private expenseId: number | null;
     private startdate: string | null;
     private enddate: string | null;
     constructor(branchid: number, tenantId: number, expenseId: number | null, startdate: string | null, enddate: string | null) {
          this.branchid = branchid;
          this.tenantId = tenantId;
          this.expenseId = expenseId;
          this.startdate = startdate;
          this.enddate = enddate;
     }

     public async getBranchMonthlyExpenses() {
          const result = await promisifyQuery(this.tenantId, `CALL BranchMonthlyExpenses(?, ?, ?)`, [this.branchid, this.startdate, this.enddate]);
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getEmployeeCategoryExpenses(empId: number) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL EmployeeCategoryExpenses(?, ?, ?, ?)`,
               [empId, this.branchid, this.startdate, this.enddate]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getApprovalStatusByBranchExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL ApprovalStatusByBranchExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getServiceLinkedExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL ServiceLinkedExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getExpenseDetailsExpenses(expenseId: number) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL GetExpenseDetailsExpenses(?, ?)`,
               [expenseId, this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getMonthlyExpenseSummaryExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL MonthlyExpenseSummaryExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getTotalExpensesByCategory() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL TotalExpensesByCategory(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getDailyExpenseSummaryExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL DailyExpenseSummaryExpenses(?,?,?)`,
               [this.branchid, this.startdate, this.enddate]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getWeeklyExpenseSummaryExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL WeeklyExpenseSummaryExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getYearlyExpenseSummaryExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL YearlyExpenseSummaryExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getHourlyExpenseSummaryForDateExpenses(targetDate: string) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL HourlyExpenseSummaryForDateExpenses(?, ?)`,
               [this.branchid, targetDate]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getTopExpenseCategoriesExpenses(limitCount: number) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL TopExpenseCategoriesExpenses(?, ?)`,
               [this.branchid, limitCount]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getEmployeeTopExpenses(limitCount: number) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL EmployeeTopExpenses(?, ?)`,
               [this.branchid, limitCount]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getExpenseTrendByCategoryExpenses(categoryId: number, startDate: string, endDate: string) {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL ExpenseTrendByCategoryExpenses(?, ?, ?, ?)`,
               [this.branchid, categoryId, startDate, endDate]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getPendingExpensesList() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL PendingExpensesList(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }

     public async getExpenseCountByStatusExpenses() {
          const result = await promisifyQuery(
               this.tenantId,
               `CALL ExpenseCountByStatusExpenses(?)`,
               [this.branchid]
          );
          return Array.isArray(result) && result.length > 0 ? result[0] : [];
     }
}