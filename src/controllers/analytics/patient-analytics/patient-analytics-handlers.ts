import { Request, Response } from 'express';
import { PatientAnalytics } from '../../../models/analytics/patient-analytics/patients-analytics-class';

const analytics = new PatientAnalytics();

export const getAgeDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getAgeDistribution(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching age distribution data' });
     }
};

export const getGenderDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getGenderDistribution(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching gender distribution data' });
     }
};

export const getMaritalStatusHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getMaritalStatus(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching marital status data' });
     }
};

export const getPatientRegistrationOverTimeHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getPatientRegistrationOverTime(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching patient registration over time data' });
     }
};

export const getActivationStatusHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getActivationStatus(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching activation status data' });
     }
};

export const getPreferredContactMethodHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getPreferredContactMethod(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching preferred contact method data' });
     }
};

export const getWhatsappUsageHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getWhatsappUsage(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching WhatsApp usage data' });
     }
};

export const getOrganizationAffiliationHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getOrganizationAffiliation(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching organization affiliation data' });
     }
};

export const getDesignationHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getDesignation(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching designation data' });
     }
};

export const getNamePatternsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getNamePatterns(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching name patterns data' });
     }
};

export const getUniqueIdentifiersHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getUniqueIdentifiers(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching unique identifiers data' });
     }
};

export const getAgeTypeAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getAgeTypeAnalysis(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching age type analysis data' });
     }
};

export const getAgeGroupSegmentationHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getAgeGroupSegmentation(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching age group segmentation data' });
     }
};

export const getOccupationDistributionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getOccupationDistribution(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching occupation distribution data' });
     }
};

export const getOccupationVsAgeGenderHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getOccupationVsAgeGender(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching occupation vs age/gender data' });
     }
};

export const getMissingDataAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getMissingDataAnalysis(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching missing data analysis' });
     }
};

export const getDuplicateRecordsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getDuplicateRecords(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching duplicate records data' });
     }
};

export const getDateOfBirthAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getDateOfBirthAnalysis(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching date of birth analysis data' });
     }
};

export const getRegistrationDateVsActivationHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getRegistrationDateVsActivation(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching registration date vs activation data' });
     }
};

export const getCombinedAttributesHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getCombinedAttributes(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching combined attributes data' });
     }
};

export const getHighValuePatientsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getHighValuePatients(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching high value patients data' });
     }
};

export const getPatientChurnPredictionHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getPatientChurnPrediction(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching patient churn prediction data' });
     }
};

export const getAgeRelatedHealthRisksHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getAgeRelatedHealthRisks(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching age related health risks data' });
     }
};

export const getDashboardsHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getDashboards(parseInt(TenantId.toString())); 
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching dashboards data' });
     }
};

export const getMonthlyPatientRegistrationTrendHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getMonthlyPatientRegistrationTrend(parseInt(TenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
     }
};

export const getDayTotalRegisteredClientHandler = async (req: Request, res: Response): Promise<void> => {
     try {
          const { TenantId } = req.query;
          const result = await analytics.getDayTotalRegisteredClient(parseInt(TenantId.toString()));
          res.status(200).json(result);
     } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Error fetching monthly patient registration trend data' });
     }
};
