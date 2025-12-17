import { Request, Response } from 'express';
import { PayrollAnalytics } from '../../models/payroll/PayrollAnalytics';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { customError } from '../../hooks/helper';

/**
 * Get comprehensive payroll analytics for a date range
 */
export const getPayrollAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate, topEarnersLimit } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          // Format dates to YYYY-MM-DD
          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const limit = topEarnersLimit ? parseInt(topEarnersLimit as string) : 10;

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getPayrollAnalytics(formattedStartDate, formattedEndDate, limit);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get payroll period analytics
 */
export const getPayrollPeriodAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getPayrollPeriodAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get compensation analytics
 */
export const getCompensationAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getCompensationAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get attendance analytics
 */
export const getAttendanceAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getAttendanceAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get leave analytics
 */
export const getLeaveAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getLeaveAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get allowance and bonus analytics
 */
export const getAllowanceBonusAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getAllowanceBonusAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get deduction analytics (statutory and other)
 */
export const getDeductionAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getDeductionAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

/**
 * Get payroll trend over time
 */
export const getPayrollTrendAnalyticsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { startDate, endDate } = req.query;

          if (!tenantId || isNaN(tenantId)) {
               return customError('Valid tenant ID is required', 400, res);
          }

          if (!startDate || !endDate) {
               return customError('Start date and end date are required', 400, res);
          }

          const formattedStartDate = new Date(startDate as string).toISOString().split('T')[0];
          const formattedEndDate = new Date(endDate as string).toISOString().split('T')[0];

          const service = new PayrollAnalytics(tenantId);
          const analytics = await service.getPayrollTrendAnalytics(formattedStartDate, formattedEndDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: analytics
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};
