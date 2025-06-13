import { Request, Response } from 'express';
import PatientAnalyticsRepository from '../../../repositories/patientRepositories/PatientAnalyticsRepository';
import { customError } from '../../../hooks/helper';

export async function getPatientAnalytics(req: Request, res: Response) {
    try {
        const { patientid, year, month } = req.query;
        const tenantId = parseInt(req.query.tenantId as string);
        if( !patientid ||!year || isNaN(Number(patientid)) || isNaN(Number(year))){
            return customError("Invalid parameters: patientid and year are required", 400,res) 
        }
        const analyticsRepo = new PatientAnalyticsRepository(tenantId);
        const yearlyData = await analyticsRepo.getYearlyTransactionSummary(Number(patientid), Number(year));
        const trends = await analyticsRepo.getTransactionTrends(Number(patientid));
        const outstanding = await analyticsRepo.getOutstandingBalance(Number(patientid));

        res.json({ status: true, data: { yearly: yearlyData, trends, outstanding } });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch patient analytics' });
    }
}

export async function getYearlyAnalytics(req: Request, res: Response) {
    try {
        const { patientId, year } = req.query;
        const tenantId = parseInt(req.query.tenantId as string);

        if (!patientId || !year) {
            return res.status(400).json({
                status: false,
                message: 'Patient ID and year are required'
            });
        }

        const parsedPatientId = parseInt(patientId as string);
        const parsedYear = parseInt(year as string);

        if (isNaN(parsedPatientId) || isNaN(parsedYear)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid patient ID or year format'
            });
        }
        
        const analyticsRepo = new PatientAnalyticsRepository(tenantId);
        const yearlyData = await analyticsRepo.getYearlyTransactionSummary(parsedPatientId, parsedYear);

        res.json({ status: true, data: yearlyData });
    } catch (error) {
        console.error('Yearly analytics error:', error);
        res.status(500).json({ status: false, message: 'Failed to fetch yearly analytics' });
    }
}

export async function getMonthlyAnalytics(req: Request, res: Response) {
    try {
        const { patientid, year, month } = req.query;
        const tenantId = parseInt(req.query.tenantId as string);


        if(!patientid || !year || !month || isNaN(Number(patientid)) || isNaN(Number(year)) || isNaN(Number(month))){
            return res.status(400).json({
                status: false,
                message: 'Invalid parameters: patientid, year, and month are required'
            });
        }
        
        const analyticsRepo = new PatientAnalyticsRepository(tenantId);
        const monthlyData = await analyticsRepo.getMonthlyTransactionSummary(
            Number(patientid),
            Number(year),
            Number(month)
        );

        res.json({ status: true, data: monthlyData });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch monthly analytics' });
    }
}

export async function getTrendsAnalytics(req: Request, res: Response) {
    try {
        const { patientid, months } = req.query;
        const tenantId = parseInt(req.query.tenantId as string);
        
        const analyticsRepo = new PatientAnalyticsRepository(tenantId);
        if (!patientid || isNaN(Number(patientid)) || !months || isNaN(Number(months))) {
            return customError("Invalid parameters: patientid and months are required", 400,res)
        }
        const trends = await analyticsRepo.getTransactionTrends(Number(patientid), Number(months) || 6);

        res.json({ status: true, data: trends });
    } catch (error) {
        res.status(500).json({ status: false, message: 'Failed to fetch trends' });
    }
}

export async function getLifetimeTransactionSummary(req: Request, res: Response) {
    try {
        const { patientid } = req.query;
        const tenantId = parseInt(req.query.tenantId as string);

        if (!patientid) {
            return res.status(400).json({
                status: false,
                message: 'Patient ID is required'
            });
        }

        const parsedPatientid = parseInt(patientid as string);
        if (isNaN(parsedPatientid)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid patient ID format'
            });
        }

        const analyticsRepo = new PatientAnalyticsRepository(tenantId);
        const lifetimeSummary = await analyticsRepo.getLifetimeTransactionSummary(parsedPatientid);

        res.json({
            status: true,
            data: lifetimeSummary
        });
    } catch (error) {
        console.error('Lifetime transaction summary error:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to fetch lifetime transaction summary'
        });
    }
}
