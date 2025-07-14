import { Request, Response } from 'express';
import { PatientAnalytics } from '../../../models/analytics/patient-analytics/patients-analytics-class';

const analytics = new PatientAnalytics();

export const getAgeDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { tenantId, interval } = req.query;
          const result = await analytics.getAgeDistribution(parseInt(tenantId.toString()), parseInt(interval.toString()));
          res.status(200).json(Array.isArray(result) ? result[0] : []);
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
          res.status(200).json(Array.isArray(result) ? result[0] : []);
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
          res.status(200).json(Array.isArray(result) ? result[0] : []);
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
