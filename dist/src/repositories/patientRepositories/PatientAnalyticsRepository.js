"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatientAnalyticsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class PatientAnalyticsRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async getYearlyTransactionSummary(patientId, year) {
        try {
            if (!patientId || !year || isNaN(patientId) || isNaN(year)) {
                throw new Error('Invalid parameters: patientId and year are required');
            }
            const conn = await this.connection;
            return await conn('billing')
                .select(conn.raw('MONTH(billedon) as month'), conn.raw('COUNT(*) as total_transactions'), conn.raw('SUM(totalcost) as total_amount'), conn.raw('SUM(paid) as total_paid'), conn.raw('SUM(outstanding) as total_outstanding'))
                .where({
                patientid: patientId
            })
                .whereRaw('YEAR(billedon) = ?', [year])
                .groupBy('month')
                .orderBy('month', 'asc');
        }
        catch (error) {
            logger_1.default.error('Yearly transaction summary error:', error);
            throw error;
        }
    }
    async getMonthlyTransactionSummary(patientId, year, month) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .select('day', conn.raw('COUNT(*) as total_transactions'), conn.raw('SUM(payable) as total_amount'), conn.raw('SUM(paid) as total_paid'), conn.raw('SUM(outstanding) as total_outstanding'))
                .where({
                patientid: patientId,
                year: year,
                month: month
            })
                .groupBy('day')
                .orderBy('day');
        }
        catch (error) {
            logger_1.default.error('Monthly transaction summary error:', error);
            throw error;
        }
    }
    async getTransactionTrends(patientId, months = 6) {
        try {
            const conn = await this.connection;
            const currentDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - months);
            return await conn('billing')
                .select(conn.raw('DATE_FORMAT(billedon, "%Y-%m-01") as month'), conn.raw('COUNT(*) as total_transactions'), conn.raw('AVG(totalcost) as average_transaction_amount'), conn.raw('SUM(totalcost) as total_amount'))
                .where('patientid', patientId)
                .whereBetween('billedon', [startDate, currentDate])
                .groupBy(conn.raw('DATE_FORMAT(billedon, "%Y-%m-01")'))
                .orderBy('month', 'asc');
        }
        catch (error) {
            logger_1.default.error('Transaction trends error:', error);
            throw error;
        }
    }
    async getOutstandingBalance(patientId) {
        try {
            const conn = await this.connection;
            const [result] = await conn('billing')
                .select(conn.raw('SUM(outstanding) as total_outstanding'), conn.raw('COUNT(CASE WHEN outstanding > 0 THEN 1 END) as pending_payments'))
                .where('patientid', patientId);
            return result;
        }
        catch (error) {
            logger_1.default.error('Outstanding balance error:', error);
            throw error;
        }
    }
    async getLifetimeTransactionSummary(patientId) {
        try {
            const conn = await this.connection;
            const [result] = await conn('billing')
                .select(conn.raw('COUNT(*) as total_transactions'), conn.raw('COALESCE(SUM(totalcost), 0) as total_amount'), conn.raw('COALESCE(SUM(payable), 0) as total_payable'), conn.raw('COALESCE(SUM(paid), 0) as total_paid'), conn.raw('COALESCE(SUM(outstanding), 0) as total_outstanding'), conn.raw('COALESCE(SUM(discount), 0) as total_discount'), conn.raw('MIN(billedon) as first_transaction'), conn.raw('MAX(billedon) as last_transaction'))
                .where('patientid', patientId);
            return Object.assign(Object.assign({}, result), { duration: {
                    start: result.first_transaction || null,
                    end: result.last_transaction || null
                } });
        }
        catch (error) {
            logger_1.default.error('Lifetime transaction summary error:', error);
            throw error;
        }
    }
}
exports.PatientAnalyticsRepository = PatientAnalyticsRepository;
exports.default = PatientAnalyticsRepository;
