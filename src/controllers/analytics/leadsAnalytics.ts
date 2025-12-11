import { Request, Response } from 'express';
import { LeadsAnalytics } from '../../models/customers/leads/LeadsAnalytics';

export default class LeadsAnalyticsController {
     public static async getLeadsAnalytics(req: Request, res: Response): Promise<void> {
          try {
               const { startDate, endDate, tenantId } = req.query;

               if (!startDate || !endDate || !tenantId) {
                    res.status(400).json({
                         error: 'Missing required parameters: startDate, endDate, and tenantId',
                         code: 'MISSING_PARAMETERS'
                    });
                    return;
               }

               const tenantIdNum = parseInt(tenantId as string, 10);
               if (isNaN(tenantIdNum)) {
                    res.status(400).json({
                         error: 'Invalid tenantId format. Must be a number',
                         code: 'INVALID_TENANT_ID'
                    });
                    return;
               }

               // Validate date formats (basic check)
               const start = new Date(startDate as string);
               const end = new Date(endDate as string);

               if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    res.status(400).json({
                         error: 'Invalid date format. Use YYYY-MM-DD',
                         code: 'INVALID_DATE_FORMAT'
                    });
                    return;
               }

               const formattedStartDate = start.toISOString().split('T')[0];
               const formattedEndDate = end.toISOString().split('T')[0];

               const analyticsData = await LeadsAnalytics.getLeadsAnalytics(tenantIdNum, formattedStartDate, formattedEndDate);
               if (start > end) {
                    res.status(400).json({
                         error: 'startDate must be before or equal to endDate',
                         code: 'INVALID_DATE_RANGE'
                    });
                    return;
               }

               res.status(200).json(analyticsData);
          } catch (error) {
               console.error('Leads analytics error:', error);
               res.status(500).json({
                    error: 'Internal server error',
                    code: 'INTERNAL_ERROR'
               });
          }
     }
}