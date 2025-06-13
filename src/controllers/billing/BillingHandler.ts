import { Request, Response } from 'express';
import { BillingRepo } from '../../models/billing/repositories/BillingRepo';
import { OperationsFailures } from '../../models/operations/types';

export interface TransactionQueryParams {
    patientid: number;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    tenantId: string;
}

export async function getPatientTransactions(
    req: Request<{}, {}, {}, TransactionQueryParams>,
    res: Response
) {
    try {
        const { patientid, page = 1, limit = 10, startDate, endDate, tenantId } = req.query;

        if (!patientid || isNaN(Number(patientid))) {
            return res.status(400).json({
                status: false,
                message: 'Valid patient ID is required'
            });
        }

        const tenantIdNumber = parseInt(tenantId);
        const billingRepo = new BillingRepo(tenantIdNumber);

        if (startDate && endDate) {
            const transactions = await billingRepo.findByPatientIdWithDateRange(
                Number(patientid),
                startDate,
                endDate
            );
            return res.status(200).json({
                status: true,
                data: transactions
            });
        }

        const paginatedTransactions = await billingRepo.findByPatientIdPaginated(
            Number(patientid),
            Number(page),
            Number(limit)
        );

        return res.status(200).json({
            status: true,
            ...paginatedTransactions
        });

    } catch (error) {
        console.error('Get patient transactions error:', error);
        return res.status(500).json({
            status: false,
            message: OperationsFailures.internalServerError
        });
    }
}

export async function getPatientTransactionDetails(
    req: Request<{ billingid: string }, {}, {}, { tenantId: string }>,
    res: Response
) {
    try {
        const { billingid } = req.params;
        const { tenantId } = req.query;

        if (!billingid || isNaN(Number(billingid))) {
            return res.status(400).json({
                status: false,
                message: 'Valid transaction ID is required'
            });
        }

        const tenantIdNumber = parseInt(tenantId);
        const billingRepo = new BillingRepo(tenantIdNumber);
        const transaction = await billingRepo.findById(Number(billingid));

        if (!billingid) {
            return res.status(404).json({
                status: false,
                message: 'Transaction not found'
            });
        }

        return res.status(200).json({
            status: true,
            data: transaction
        });

    } catch (error) {
        console.error('Get transaction details error:', error);
        return res.status(500).json({
            status: false,
            message: OperationsFailures.internalServerError
        });
    }
}