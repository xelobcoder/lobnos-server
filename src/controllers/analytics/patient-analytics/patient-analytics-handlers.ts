import { Request, Response } from 'express';
import { PatientAnalytics } from '../../../models/analytics/patient-analytics/patients-analytics-class';

const analytics = new PatientAnalytics();

export const getAgeDistributionHandler = async (req: Request<{}, {}, {}, { tenantId: string | number, interval: number, min_age: number, max_age: number }>, res: Response): Promise<void> => {
     try {
          const { tenantId, interval, min_age, max_age } = req.query;
          const size = Number(interval ?? 10), minimum = Number(min_age ?? 0), maximum = Number(max_age ?? 120);
          if (!Number.isInteger(size) || size <= 0 || size > 120 || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || minimum > maximum) {
               res.status(400).json({message: 'Invalid age distribution limits'});
               return;
          }
          const result = await analytics.getAgeDistribution(
               parseInt(tenantId.toString()),
               parseInt(interval?.toString() || '10'),
               parseInt(min_age?.toString() || '0'),
               parseInt(max_age?.toString() || '120')
          );
          res.status(200).json(Array.isArray(result) ? result : []);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching age distribution data' });
     }
};

export const getGenderDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getGenderDistribution(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching gender distribution data' });
     }
};

export const getMaritalStatusHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getMaritalStatus(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching marital status data' });
     }
};

export const getPatientRegistrationOverTimeHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId, startdate, enddate } = req.query;
          if (!startdate || !enddate) {
               res.status(400).json({ error: 'Invalid date range' });
               return;
          }
          const result = await analytics.getPatientRegistrationOverTime(parseInt(tenantId.toString()), new Date(startdate.toString()), new Date(enddate.toString()));
          res.status(200).json(Array.isArray(result) ? result : []);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching patient registration over time data' });
     }
};

export const getActivationStatusHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getActivationStatus(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching activation status data' });
     }
};




export const getUniqueIdentifiersHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getUniqueIdentifiers(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching unique identifiers data' });
     }
};

export const getOccupationDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getOccupationDistribution(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching occupation distribution data' });
     }
};



export const getMissingDataAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getMissingDataAnalysis(parseInt(tenantId.toString()));
          res.status(200).json(Array.isArray(result) ? result[0] : []);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching missing data analysis' });
     }
};

export const getDuplicateRecordsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getDuplicateRecords(parseInt(tenantId.toString()));
          res.status(200).json(Array.isArray(result) ? result[0] : []);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching duplicate records data' });
     }
};

export const getDashboardsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getDashboards(parseInt(tenantId.toString()));
          res.status(200).json(Array.isArray(result) ? result : []);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching dashboards data' });
     }
};

export const getMonthlyPatientRegistrationTrendHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getMonthlyPatientRegistrationTrend(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
     }
};

export const getDayTotalRegisteredClientHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getDayTotalRegisteredClient(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
     }
};

export const getRegistrationByDayOfWeekHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getRegistrationByDayOfWeek(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching registration by day of week data' });
     }
};

export const getContactCompletenessHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getContactCompleteness(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching contact completeness data' });
     }
};

export const getStaffRegistrationPerformanceHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getStaffRegistrationPerformance(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching staff registration performance data' });
     }
};

export const getStaffRegistrationTrendsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId } = req.query;
          const result = await analytics.getStaffRegistrationTrends(parseInt(tenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching staff registration trends data' });
     }
};
