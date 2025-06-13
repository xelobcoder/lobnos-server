import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";

interface MonthlyTransactionSummary {
    month: number;
    year: number;
    total_transactions: number;
    total_amount: number;
    total_paid: number;
    total_outstanding: number;
}

interface DailyTransactionSummary {
    date: string;
    total_transactions: number;
    total_amount: number;
    total_paid: number;
    total_outstanding: number;
}

export class PatientAnalyticsRepository {
    private tenantId: number;
    private connection: any;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
        this.connection = KnexConnection(tenantId);
    }

    async getYearlyTransactionSummary(patientId: number, year: number) {
        try {
            if (!patientId || !year || isNaN(patientId) || isNaN(year)) {
                throw new Error('Invalid parameters: patientId and year are required');
            }

            const conn = await this.connection;
            return await conn('billing')
                .select(
                    conn.raw('MONTH(billedon) as month'),
                    conn.raw('COUNT(*) as total_transactions'),
                    conn.raw('SUM(totalcost) as total_amount'),
                    conn.raw('SUM(paid) as total_paid'),
                    conn.raw('SUM(outstanding) as total_outstanding')
                )
                .where({ 
                    patientid: patientId
                })
                .whereRaw('YEAR(billedon) = ?', [year])
                .groupBy('month')
                .orderBy('month', 'asc');
        } catch (error) {
            logger.error('Yearly transaction summary error:', error);
            throw error;
        }
    }

    async getMonthlyTransactionSummary(patientId: number, year: number, month: number) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .select(
                    'day',
                    conn.raw('COUNT(*) as total_transactions'),
                    conn.raw('SUM(payable) as total_amount'),
                    conn.raw('SUM(paid) as total_paid'),
                    conn.raw('SUM(outstanding) as total_outstanding')
                )
                .where({ 
                    patientid: patientId,
                    year: year,
                    month: month 
                })
                .groupBy('day')
                .orderBy('day');
        } catch (error) {
            logger.error('Monthly transaction summary error:', error);
            throw error;
        }
    }

    async getTransactionTrends(patientId: number, months: number = 6) {
        try {
            const conn = await this.connection;
            const currentDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - months);

            return await conn('billing')
                .select(
                    conn.raw('DATE_FORMAT(billedon, "%Y-%m-01") as month'),
                    conn.raw('COUNT(*) as total_transactions'),
                    conn.raw('AVG(totalcost) as average_transaction_amount'),
                    conn.raw('SUM(totalcost) as total_amount')
                )
                .where('patientid', patientId)
                .whereBetween('billedon', [startDate, currentDate])
                .groupBy(conn.raw('DATE_FORMAT(billedon, "%Y-%m-01")'))
                .orderBy('month', 'asc');
        } catch (error) {
            logger.error('Transaction trends error:', error);
            throw error;
        }
    }


    async getOutstandingBalance(patientId: number) {
        try {
            const conn = await this.connection;
            const [result] = await conn('billing')
                .select(
                    conn.raw('SUM(outstanding) as total_outstanding'),
                    conn.raw('COUNT(CASE WHEN outstanding > 0 THEN 1 END) as pending_payments')
                )
                .where('patientid', patientId);
            return result;
        } catch (error) {
            logger.error('Outstanding balance error:', error);
            throw error;
        }
    }

    async getLifetimeTransactionSummary(patientId: number) {
        try {
            const conn = await this.connection;
            const [result] = await conn('billing')
                .select(
                    conn.raw('COUNT(*) as total_transactions'),
                    conn.raw('COALESCE(SUM(totalcost), 0) as total_amount'),
                    conn.raw('COALESCE(SUM(payable), 0) as total_payable'),
                    conn.raw('COALESCE(SUM(paid), 0) as total_paid'),
                    conn.raw('COALESCE(SUM(outstanding), 0) as total_outstanding'),
                    conn.raw('COALESCE(SUM(discount), 0) as total_discount'),
                    conn.raw('MIN(billedon) as first_transaction'),
                    conn.raw('MAX(billedon) as last_transaction')
                )
                .where('patientid', patientId);

            return {
                ...result,
                duration: {
                    start: result.first_transaction || null,
                    end: result.last_transaction || null
                }
            };
        } catch (error) {
            logger.error('Lifetime transaction summary error:', error);
            throw error;
        }
    }
}

export default PatientAnalyticsRepository;