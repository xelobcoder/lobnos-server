import { Request, Response } from "express";
import { customError } from "../../../hooks/helper";
import ExpensesAnalytics from "../../../models/analytics/ExpensesAnalytics/Expenses-Analytics";

interface ExpenseRequestQuery {
     startDate: string | null;
     endDate: string | null;
     expensesId: number | null;
     tenantId: string;
     branchid: string;
     empId?: string;
     limitCount?: string;
     categoryId?: string;
     targetDate?: string;
}

export default class ExpensesAnalyticsController {
     evaluateQueryParams(query: ExpenseRequestQuery, response: Response) {
          const startDate = query.startDate ? new Date(query.startDate) : null;
          const endDate = query.endDate ? new Date(query.endDate) : null;
          const expensesId = query.expensesId ? parseInt(query.expensesId.toString()) : null;
          const tenantId = parseInt(query.tenantId);
          const branchid = query.branchid;

          if (!branchid || !tenantId) {
               return customError("Branch ID and Tenant ID are required.", 400, response);
          }

          return new ExpensesAnalytics(
               parseInt(branchid),
               tenantId,
               expensesId,
               startDate ? startDate.toISOString().split('T')[0] : null,
               endDate ? endDate.toISOString().split('T')[0] : null
          );
     }

     async getBranchMonthlyExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getEmployeeCategoryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const empId = req.query.empId ? parseInt(req.query.empId) : null;
               if (!empId) return customError("Employee ID is required.", 400, res);
               const data = await expensesAnalytics.getEmployeeCategoryExpenses(empId);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching employee category expenses:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     async getApprovalStatusByBranchExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getServiceLinkedExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getExpenseDetailsExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getMonthlyExpenseSummaryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getTotalExpensesByCategoryHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getDailyExpenseSummaryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;
               const data = await expensesAnalytics.getDailyExpenseSummaryExpenses();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching daily expense summary:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     async getWeeklyExpenseSummaryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getYearlyExpenseSummaryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getHourlyExpenseSummaryForDateExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getTopExpenseCategoriesExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getEmployeeTopExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getExpenseTrendByCategoryExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getPendingExpensesListHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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

     async getExpenseCountByStatusExpensesHandler(req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) {
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