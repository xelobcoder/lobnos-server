"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAnalyticsWithDate = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
/**
 * Query builder for commission analytics
 * Fetches and groups commission data by various time periods
 */
class CommissionAnalyticsWithDate {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    /**
     * Get commission analytics grouped by period
     * Returns aggregated commission data for each period
     */
    async getCommissionsByPeriod(query) {
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        let sqlQuery = connection('commission_tracking')
            .select(connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`), connection.raw('DATE(calculated_at) as period_start'), connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'), connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'), connection.raw('COUNT(*) as commission_count'), connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total'))
            .whereBetween('calculated_at', [query.startDate, query.endDate])
            .groupByRaw(`DATE_FORMAT(calculated_at, '${periodFormat}')`);
        if (query.recipientType && query.recipientId) {
            sqlQuery = sqlQuery
                .where('recipient_type', query.recipientType)
                .where('recipient_id', query.recipientId);
        }
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery.orderBy('period', 'asc');
        return await sqlQuery;
    }
    /**
     * Get commission analytics by recipient for a period
     * Returns breakdown by clinician or organization
     */
    async getCommissionsByRecipient(query) {
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        const recipientType = query.recipientType || 'clinician';
        let sqlQuery = connection('commission_tracking')
            .select('recipient_id', 'recipient_type', connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`), connection.raw('DATE(calculated_at) as period_start'), connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'), connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'), connection.raw('COUNT(*) as commission_count'), connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total'))
            .whereBetween('calculated_at', [query.startDate, query.endDate])
            .where('recipient_type', recipientType)
            .groupByRaw('recipient_id, DATE_FORMAT(calculated_at, ?)', [periodFormat]);
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery
            .orderBy('recipient_id', 'asc')
            .orderBy('period', 'asc');
        return await sqlQuery;
    }
    /**
     * Get specific recipient analytics across periods
     * Returns commission breakdown for a specific clinician or organization across periods
     */
    async getRecipientCommissionsByPeriod(query) {
        if (!query.recipientType || !query.recipientId) {
            throw new Error('recipientType and recipientId are required');
        }
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        let sqlQuery = connection('commission_tracking')
            .select(connection.raw(`DATE_FORMAT(calculated_at, '${periodFormat}') as period`), connection.raw('DATE(calculated_at) as period_start'), connection.raw('LAST_DAY(DATE(calculated_at)) as period_end'), connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'), connection.raw('COUNT(*) as commission_count'), connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total'))
            .whereBetween('calculated_at', [query.startDate, query.endDate])
            .where('recipient_type', query.recipientType)
            .where('recipient_id', query.recipientId)
            .groupByRaw(`DATE_FORMAT(calculated_at, '${periodFormat}')`);
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery.orderBy('period', 'asc');
        return await sqlQuery;
    }
    /**
     * Get commission statistics for the entire period
     * Returns summary statistics
     */
    async getPeriodStatistics(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_tracking')
            .select(connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'), connection.raw('CAST(MIN(final_commission) AS DECIMAL(12,2)) as min_commission'), connection.raw('CAST(MAX(final_commission) AS DECIMAL(12,2)) as max_commission'), connection.raw('COUNT(*) as transaction_count'), connection.raw('COUNT(DISTINCT recipient_id) as unique_recipients'), connection.raw('CAST(SUM(service_amount) AS DECIMAL(12,2)) as service_amount_total'))
            .whereBetween('calculated_at', [query.startDate, query.endDate]);
        if (query.recipientType && query.recipientId) {
            sqlQuery = sqlQuery
                .where('recipient_type', query.recipientType)
                .where('recipient_id', query.recipientId);
        }
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        return await sqlQuery.first();
    }
    /**
     * Get commission by status breakdown
     */
    async getCommissionsByStatus(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_tracking')
            .select('status', connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('COUNT(*) as count'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'))
            .whereBetween('calculated_at', [query.startDate, query.endDate])
            .groupBy('status');
        if (query.recipientType && query.recipientId) {
            sqlQuery = sqlQuery
                .where('recipient_type', query.recipientType)
                .where('recipient_id', query.recipientId);
        }
        sqlQuery = sqlQuery.orderBy('total_commission', 'desc');
        return await sqlQuery;
    }
    /**
     * Get commission by type breakdown
     */
    async getCommissionsByType(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_tracking')
            .select('commission_type', connection.raw('CAST(SUM(final_commission) AS DECIMAL(12,2)) as total_commission'), connection.raw('COUNT(*) as count'), connection.raw('CAST(AVG(final_commission) AS DECIMAL(12,2)) as average_commission'))
            .whereBetween('calculated_at', [query.startDate, query.endDate])
            .groupBy('commission_type');
        if (query.recipientType && query.recipientId) {
            sqlQuery = sqlQuery
                .where('recipient_type', query.recipientType)
                .where('recipient_id', query.recipientId);
        }
        sqlQuery = sqlQuery.orderBy('total_commission', 'desc');
        return await sqlQuery;
    }
    /**
     * Helper to get SQL date format based on period type
     */
    getPeriodFormat(period) {
        const formats = {
            daily: '%Y-%m-%d',
            weekly: '%Y-W%u',
            monthly: '%Y-%m',
            quarterly: 'Q%q-%Y',
            yearly: '%Y',
        };
        return formats[period];
    }
}
exports.CommissionAnalyticsWithDate = CommissionAnalyticsWithDate;
