"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAnalyticsWithDate = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class CommissionAnalyticsWithDate {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async getCommissionsByPeriod(query) {
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        let sqlQuery = connection('commission_batch_payments')
            .select(connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`), connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'), connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'), connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'), connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'), connection.raw('COUNT(*) as batch_count'), connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
            .groupByRaw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}')`);
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
    async getCommissionsByRecipient(query) {
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        const recipientType = query.recipientType || 'clinician';
        let sqlQuery = connection('commission_batch_payments')
            .select('recipient_id', 'recipient_type', connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`), connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'), connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'), connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'), connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'), connection.raw('COUNT(*) as batch_count'), connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
            .where('recipient_type', recipientType)
            .groupByRaw('recipient_id, DATE_FORMAT(COALESCE(payment_date, created_at), ?)', [periodFormat]);
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery
            .orderBy('recipient_id', 'asc')
            .orderBy('period', 'asc');
        return await sqlQuery;
    }
    async getRecipientCommissionsByPeriod(query) {
        if (!query.recipientType || !query.recipientId) {
            throw new Error('recipientType and recipientId are required');
        }
        const connection = await this.connection;
        const periodFormat = this.getPeriodFormat(query.period);
        let sqlQuery = connection('commission_batch_payments')
            .select(connection.raw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}') as period`), connection.raw('DATE(COALESCE(payment_date, created_at)) as period_start'), connection.raw('LAST_DAY(DATE(COALESCE(payment_date, created_at))) as period_end'), connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'), connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'), connection.raw('COUNT(*) as batch_count'), connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
            .where('recipient_type', query.recipientType)
            .where('recipient_id', query.recipientId)
            .groupByRaw(`DATE_FORMAT(COALESCE(payment_date, created_at), '${periodFormat}')`);
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery.orderBy('period', 'asc');
        return await sqlQuery;
    }
    async getPeriodStatistics(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_batch_payments')
            .select(connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'), connection.raw('CAST(MIN(payment_amount) AS DECIMAL(12,2)) as min_paid'), connection.raw('CAST(MAX(payment_amount) AS DECIMAL(12,2)) as max_paid'), connection.raw('COUNT(*) as batch_count'), connection.raw('COUNT(DISTINCT recipient_id) as unique_recipients'), connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'), connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate]);
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
    async getCommissionsByStatus(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_batch_payments')
            .select('status', connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('COUNT(*) as count'), connection.raw('CAST(AVG(payment_amount) AS DECIMAL(12,2)) as average_paid'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
            .groupBy('status');
        if (query.recipientType && query.recipientId) {
            sqlQuery = sqlQuery
                .where('recipient_type', query.recipientType)
                .where('recipient_id', query.recipientId);
        }
        sqlQuery = sqlQuery.orderBy('total_paid', 'desc');
        return await sqlQuery;
    }
    async getRecipientPaymentEfficiency(query) {
        const connection = await this.connection;
        let sqlQuery = connection('commission_batch_payments')
            .leftJoin('organization', function () {
            this.on('commission_batch_payments.recipient_id', '=', 'organization.id')
                .andOn('commission_batch_payments.recipient_type', '=', connection.raw('?', ['organization']));
        })
            .leftJoin('clinicianbasicinfo', function () {
            this.on('commission_batch_payments.recipient_id', '=', 'clinicianbasicinfo.id')
                .andOn('commission_batch_payments.recipient_type', '=', connection.raw('?', ['clinician']));
        })
            .select('recipient_id', 'recipient_type', connection.raw('COALESCE(organization.name, clinicianbasicinfo.name) as recipient_name'), connection.raw('CAST(SUM(payment_amount) AS DECIMAL(12,2)) as total_paid'), connection.raw('CAST(SUM(total_commission_amount) AS DECIMAL(12,2)) as total_due'), connection.raw('CAST(SUM(waived_amount) AS DECIMAL(12,2)) as total_waived'), connection.raw('COUNT(*) as payment_batches'), connection.raw('ROUND((SUM(payment_amount) / SUM(total_commission_amount)) * 100, 2) as payment_percentage'))
            .whereRaw('COALESCE(payment_date, created_at) BETWEEN ? AND ?', [query.startDate, query.endDate])
            .groupBy('recipient_id', 'recipient_type');
        if (query.recipientType) {
            sqlQuery = sqlQuery.where('recipient_type', query.recipientType);
        }
        if (query.status) {
            sqlQuery = sqlQuery.where('status', query.status);
        }
        sqlQuery = sqlQuery.orderBy('total_paid', 'desc');
        return await sqlQuery;
    }
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
