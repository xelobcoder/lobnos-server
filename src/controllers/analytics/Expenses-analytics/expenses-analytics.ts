import { Request, Response } from "express";
import { customError } from "../../../hooks/helper";
import ExpensesAnalytics from "../../../models/analytics/ExpensesAnalytics/Expenses-Analytics";

interface ExpenseRequestQuery {
     startDate: string | null;
     endDate: string | null;
     expensesId: number | null;
     branchid: string;
     employeeid?: string;
     empId?: string;
     tenantId?: string;
     limitCount?: string;
     categoryId?: string;
     targetDate?: string;
     startYear?: string;
     endYear?: string;
     currentStartDate?: string;
     currentEndDate?: string;
     previousStartDate?: string;
     previousEndDate?: string;
}

export default class ExpensesAnalyticsController {
     evaluateQueryParams(query: ExpenseRequestQuery, response: Response) {
          const { branchid, employeeid, expensesId, startDate, endDate, tenantId } = query;
          if (!branchid) {
               return customError("Branch ID is required.", 400, response);
          }

          const pBranchId = parseInt(branchid);
          const pstartDate = startDate ? startDate : null;
          const pTenantId = tenantId ? parseInt(tenantId) : null;
          const pendDate = endDate ? endDate : null;
          const pexpensesId = expensesId ? parseInt(expensesId.toString()) : null;
          const pEmployeeId = employeeid ? parseInt(employeeid.toString()) : null;

          return new ExpensesAnalytics(
               pTenantId,
               pBranchId,
               pexpensesId,
               pstartDate,
               pendDate
          );
     }

     // Daily Expense Analytics Handler
     getDailyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const data = await expensesAnalytics.getDailyExpenseAnalytics();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching daily expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Hourly Expense Analytics Handler
     getHourlyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const { branchid } = req.query;
               if (!branchid) return customError("Branch ID is required.", 400, res);

               const targetDate = req.query.targetDate;
               if (!targetDate) return customError("Target date is required.", 400, res);

               const pBranchId = parseInt(branchid);
               const expensesAnalytics = new ExpensesAnalytics(null, pBranchId, null, null, null);
               const data = await expensesAnalytics.getHourlyExpenseAnalytics(targetDate);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching hourly expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Weekly Expense Analytics Handler
     getWeeklyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const data = await expensesAnalytics.getWeeklyExpenseAnalytics();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching weekly expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Monthly Expense Analytics Handler
     getMonthlyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const data = await expensesAnalytics.getMonthlyExpenseAnalytics();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching monthly expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Quarterly Expense Analytics Handler
     getQuarterlyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const data = await expensesAnalytics.getQuarterlyExpenseAnalytics();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching quarterly expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Yearly Expense Analytics Handler
     getYearlyExpenseAnalyticsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const startYear = req.query.startYear ? parseInt(req.query.startYear) : new Date().getFullYear() - 1;
               const endYear = req.query.endYear ? parseInt(req.query.endYear) : new Date().getFullYear();

               const data = await expensesAnalytics.getYearlyExpenseAnalytics(startYear, endYear);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching yearly expense analytics:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Top Expense Categories Handler
     getTopExpenseCategoriesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const data = await expensesAnalytics.getTopExpenseCategories();
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching top expense categories:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Top Expense Merchants Handler
     getTopExpenseMerchantsHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 10;
               const data = await expensesAnalytics.getTopExpenseMerchants(limitCount);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching top expense merchants:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Top Expense Employees Handler
     getTopExpenseEmployeesHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const limitCount = req.query.limitCount ? parseInt(req.query.limitCount) : 10;
               const data = await expensesAnalytics.getTopExpenseEmployees(limitCount);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching top expense employees:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Expense Trends by Category Handler
     getExpenseTrendsByCategoryHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
               const data = await expensesAnalytics.getExpenseTrendsByCategory(categoryId);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching expense trends by category:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }

     // Expense Comparison by Period Handler
     getExpenseComparisonByPeriodHandler = async (req: Request<{}, {}, {}, ExpenseRequestQuery>, res: Response) => {
          try {
               const expensesAnalytics = this.evaluateQueryParams(req.query, res);
               if (!expensesAnalytics) return;

               const { currentStartDate, currentEndDate, previousStartDate, previousEndDate } = req.query;
               if (!currentStartDate || !currentEndDate || !previousStartDate || !previousEndDate) {
                    return customError("All date parameters (currentStartDate, currentEndDate, previousStartDate, previousEndDate) are required.", 400, res);
               }

               const data = await expensesAnalytics.getExpenseComparisonByPeriod(currentStartDate, currentEndDate, previousStartDate, previousEndDate);
               res.status(200).json(data);
          } catch (error) {
               console.error("Error fetching expense comparison by period:", error);
               res.status(500).json({ error: "Internal Server Error" });
          }
     }
}