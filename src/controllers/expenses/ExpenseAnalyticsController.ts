import { Request, Response } from 'express';
import { ExpenseAnalyticsQueries } from '../../models/Expenses/ExpenseAnalyticsQueries';
import { customError } from '../../hooks/helper';

export class ExpenseAnalyticsController {
     static async getDailyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getDailyExpenseAnalytics(startDate as string, endDate as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Daily expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getDailyExpenseAnalytics:', error);
               customError('Failed to retrieve daily expense analytics', 500, res);
          }
     }

     static async getExpenseComparisonByPeriod(req: Request, res: Response) {
          try {
               const { tenantId, currentStart, currentEnd, previousStart, previousEnd, branchid } = req.query;

               if (!tenantId || !currentStart || !currentEnd || !previousStart || !previousEnd) {
                    return customError('All date parameters and tenantId are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseComparisonByPeriod(
                    currentStart as string,
                    currentEnd as string,
                    previousStart as string,
                    previousEnd as string,
                    branchid ? parseInt(branchid as string) : undefined
               );

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense comparison analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseComparisonByPeriod:', error);
               customError('Failed to retrieve expense comparison analytics', 500, res);
          }
     }

     static async getExpenseTrendsByCategory(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseTrendsByCategory(startDate as string, endDate as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense trends by category retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseTrendsByCategory:', error);
               customError('Failed to retrieve expense trends by category', 500, res);
          }
     }

     static async getExpenseTrendsByEmployee(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate, branchid } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseTrendsByEmployee(startDate as string, endDate as string, branchid ? parseInt(branchid as string) : undefined);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense trends by employee retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseTrendsByEmployee:', error);
               customError('Failed to retrieve expense trends by employee', 500, res);
          }
     }

     static async getExpenseTrendsByMerchant(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate } = req.query;

               if ( !startDate || !endDate) {
                    return customError('startDate and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseTrendsByMerchant(startDate as string, endDate as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense trends by merchant retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseTrendsByMerchant:', error);
               customError('Failed to retrieve expense trends by merchant', 500, res);
          }
     }

     static async getHourlyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, date } = req.query;

               if (!tenantId || !date) {
                    return customError('tenantId and date are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getHourlyExpenseAnalytics(date as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Hourly expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getHourlyExpenseAnalytics:', error);
               customError('Failed to retrieve hourly expense analytics', 500, res);
          }
     }

     static async getMonthlyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, year } = req.query;

               if (!tenantId || !year) {
                    return customError('tenantId and year are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getMonthlyExpenseAnalytics(parseInt(year as string));

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Monthly expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getMonthlyExpenseAnalytics:', error);
               customError('Failed to retrieve monthly expense analytics', 500, res);
          }
     }

     static async getWeeklyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, year } = req.query;

               if (!tenantId || !year) {
                    return customError('tenantId and year are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getWeeklyExpenseAnalytics(parseInt(year as string));

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Weekly expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getWeeklyExpenseAnalytics:', error);
               customError('Failed to retrieve weekly expense analytics', 500, res);
          }
     }

     static async getQuarterlyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, year } = req.query;

               if (!tenantId || !year) {
                    return customError('tenantId and year are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getQuarterlyExpenseAnalytics(parseInt(year as string));

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Quarterly expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getQuarterlyExpenseAnalytics:', error);
               customError('Failed to retrieve quarterly expense analytics', 500, res);
          }
     }

     static async getYearlyExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, startYear, endYear } = req.query;

               if (!tenantId || !startYear || !endYear) {
                    return customError('tenantId, startYear, and endYear are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getYearlyExpenseAnalytics(
                    parseInt(startYear as string),
                    parseInt(endYear as string)
               );

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Yearly expense analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getYearlyExpenseAnalytics:', error);
               customError('Failed to retrieve yearly expense analytics', 500, res);
          }
     }

     static async getExpenseAnalyticsByBranch(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseAnalyticsByBranch(startDate as string, endDate as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense analytics by branch retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseAnalyticsByBranch:', error);
               customError('Failed to retrieve expense analytics by branch', 500, res);
          }
     }

     static async getTopExpenseCategories(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate, branchid } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getTopExpenseCategories(
                    startDate as string,
                    endDate as string,
                    branchid ? parseInt(branchid as string) : undefined
               );

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Top expense categories retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getTopExpenseCategories:', error);
               customError('Failed to retrieve top expense categories', 500, res);
          }
     }

     static async getExpensePaymentStatusAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpensePaymentStatusAnalytics(startDate as string, endDate as string);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense payment status analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpensePaymentStatusAnalytics:', error);
               customError('Failed to retrieve expense payment status analytics', 500, res);
          }
     }

     static async getExpenseBuckets(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate, branchid } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseBuckets(startDate as string, endDate as string, branchid ? parseInt(branchid as string) : undefined);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense buckets analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseBuckets:', error);
               customError('Failed to retrieve expense buckets analytics', 500, res);
          }
     }

     static async getExpenseGrowthRateAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, year, branchid } = req.query;

               if (!tenantId || !year) {
                    return customError('tenantId and year are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseGrowthRateAnalytics(parseInt(year as string), branchid ? parseInt(branchid as string) : undefined);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense growth rate analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseGrowthRateAnalytics:', error);
               customError('Failed to retrieve expense growth rate analytics', 500, res);
          }
     }

     static async getExpenseApprovalTimelineAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate, branchid } = req.query;

               if (!tenantId || !startDate || !endDate) {
                    return customError('tenantId, startDate, and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseApprovalTimelineAnalytics(startDate as string, endDate as string, branchid ? parseInt(branchid as string) : undefined);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense approval timeline analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.error('Error in getExpenseApprovalTimelineAnalytics:', error);
               customError('Failed to retrieve expense approval timeline analytics', 500, res);
          }
     }


     static async getRecurringExpenseAnalytics(req: Request, res: Response) {
          try {
               const { tenantId, startDate, endDate, branchid } = req.query;

               if (!startDate || !endDate) {
                    return customError('startDate and endDate are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getExpenseBreakdownWithPayments(startDate as string, endDate as string, branchid ? parseInt(branchid as string) : undefined);

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Expense approval timeline analytics retrieved successfully',
                    data: result[0]
               });
          } catch (error) {
               console.log(error)
               customError("Failed to retreve expense records ", 500, res)
          }

     }

     static async getPaymentsByMerchant(req: Request, res: Response) {
          try {
               const { tenantId, page, count } = req.query;
               const { merchantId } = req.params;

               if (!merchantId || !page || !count) {
                    return customError(' merchantId, page, and count are required', 400, res);
               }

               const analytics = new ExpenseAnalyticsQueries(parseInt(tenantId as string));
               const result = await analytics.getPaymentsByMerchant(
                    parseInt(merchantId as string),
                    parseInt(page as string),
                    parseInt(count as string)
               );

               res.status(200).json({
                    status: 'success',
                    statusCode: 200,
                    message: 'Payments by merchant retrieved successfully',
                    data: result.data,
                    pagination: {
                         totalRecords: result.total,
                         page: result.page,
                         pageSize: result.pageSize,
                         totalPages: result.totalPages
                    }
               });
          } catch (error) {
               customError('Failed to retrieve payments by merchant', 500, res);
          }
     }
}