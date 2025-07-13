import { Request, Response } from "express";
import { customError } from "../../../hooks/helper";
import ExpensesAnalytics from "../../../models/analytics/ExpensesAnalytics/Expenses-Analytics";

interface ExpenseRequestQuery {
     startDate: string | null;
     endDate: string | null;
     expensesId: number | null;
     tenantId: string;
     branchid: string;
     employeeid?: string;
     empId?: string;
     limitCount?: string;
     categoryId?: string;
     targetDate?: string;
}

export default class ExpensesAnalyticsController {
     evaluateQueryParams(query: ExpenseRequestQuery, response: Response) {
          const { branchid, employeeid, tenantId, expensesId, startDate, endDate } = query;
          if (!branchid || !tenantId) {
               return customError("Branch ID and Tenant ID are required.", 400, response);
          }

          const pTenantId = parseInt(tenantId);
          const pBranchId = parseInt(branchid);
          const pstartDate = startDate ? startDate : null;
          const pendDate = endDate ? endDate : null;
          const pexpensesId = expensesId ? parseInt(expensesId.toString()) : null;
          const pEmployeeId = employeeid ? parseInt(employeeid.toString()) : null;



          return new ExpensesAnalytics(
               pBranchId,
               pTenantId,
               pexpensesId,
               pstartDate,
               pendDate
          );
     }

     getBranchMonthlyExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {

               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const monthlyExpenses = await expensesAnalytics.getBranchMonthlyExpenses();
               res.status(200).json(monthlyExpenses);
          } catch (error) {
               console.error("Error fetching monthly expenses:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getEmployeeCategoryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const empId = req.query.employeeid ? parseInt(req.query.employeeid) : null;
               if (!empId) return customError("Employee ID is required.", 400, res);
               const data = await expensesAnalytics.getEmployeeCategoryExpenses(empId);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching employee category expenses:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getApprovalStatusByBranchExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getApprovalStatusByBranchExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching approval status by branch:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getServiceLinkedExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getServiceLinkedExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching service linked expenses:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getExpenseDetailsExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const expenseId = req.query.expensesId ? parseInt(req.query.expensesId.toString()) : null;
               if (!expenseId) return customError("Expense ID is required.", 400, res);
               const data = await expensesAnalytics.getExpenseDetailsExpenses(expenseId);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching expense details:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getMonthlyExpenseSummaryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getMonthlyExpenseSummaryExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching monthly expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getTotalExpensesByCategoryHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getTotalExpensesByCategory();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching total expenses by category:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getDailyExpenseSummaryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               console.log("Expenses Analytics:", expensesAnalytics);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getDailyExpenseSummaryExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching daily expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getWeeklyExpenseSummaryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getWeeklyExpenseSummaryExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching weekly expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getYearlyExpenseSummaryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getYearlyExpenseSummaryExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching yearly expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getHourlyExpenseSummaryForDateExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const targetDate = req.query.targetDate;
               if (!targetDate) return customError("Target date is required.", 400, res);
               const data = await expensesAnalytics.getHourlyExpenseSummaryForDateExpenses(targetDate);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching hourly expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getTopExpenseCategoriesExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 5;
               const data = await expensesAnalytics.getTopExpenseCategoriesExpenses(limitCount);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching top expense categories:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getEmployeeTopExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 5;
               const data = await expensesAnalytics.getEmployeeTopExpenses(limitCount);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching employee top expenses:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getExpenseTrendByCategoryExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
               const startDate = req.query.startDate;
               const endDate = req.query.endDate;
               if (!categoryId || !startDate || !endDate) {
                    return customError("Category ID, start date, and end date are required.", 400, res);
               }
               const data = await expensesAnalytics.getExpenseTrendByCategoryExpenses(categoryId, startDate, endDate);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching expense trend by category:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getPendingExpensesListHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getPendingExpensesList();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching pending expenses list:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     getExpenseCountByStatusExpensesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getExpenseCountByStatusExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching expense count by status:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }
}