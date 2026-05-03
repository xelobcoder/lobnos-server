"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryPaymentAnalyticsModel = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class InventoryPaymentAnalyticsModel {
    constructor(tenantId) {
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async getMonthlyPayments(startDate, endDate) {
        var _a;
        const connection = await this.connection;
        const result = await connection.raw(`
               SELECT
                    DATE_FORMAT(payment_date, '%Y-%m') as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               ${startDate ? `AND payment_date >= '${startDate}'` : 'AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH)'}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
               LIMIT 24
          `);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.map((row) => ({
            period: row.period,
            payment_count: parseInt(row.payment_count) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            average_amount: parseFloat(row.average_amount) || 0,
            unique_suppliers: parseInt(row.unique_suppliers) || 0
        }))) || [];
    }
    async getYearlyPayments(startDate, endDate) {
        var _a;
        const connection = await this.connection;
        const result = await connection.raw(`
               SELECT
                    YEAR(payment_date) as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               ${startDate ? `AND payment_date >= '${startDate}'` : 'AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)'}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
               LIMIT 5
          `);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.map((row) => ({
            period: row.period.toString(),
            payment_count: parseInt(row.payment_count) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            average_amount: parseFloat(row.average_amount) || 0,
            unique_suppliers: parseInt(row.unique_suppliers) || 0
        }))) || [];
    }
    async getDailyPayments(startDate, endDate) {
        var _a;
        const connection = await this.connection;
        const result = await connection.raw(`
               SELECT
                    DATE(payment_date) as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
               ${startDate ? `AND payment_date >= '${startDate}'` : ''}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
          `);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.map((row) => ({
            period: row.period,
            payment_count: parseInt(row.payment_count) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            average_amount: parseFloat(row.average_amount) || 0,
            unique_suppliers: parseInt(row.unique_suppliers) || 0
        }))) || [];
    }
    async getHourlyPayments(startDate, endDate) {
        var _a;
        const connection = await this.connection;
        const result = await connection.raw(`
               SELECT
                    DATE_FORMAT(payment_date, '%Y-%m-%d %H:00') as period,
                    COUNT(*) as payment_count,
                    SUM(payment_amount) as total_amount,
                    AVG(payment_amount) as average_amount,
                    COUNT(DISTINCT supplier_id) as unique_suppliers
               FROM inv_supplier_payments
               WHERE payment_status = 'completed'
               AND payment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
               ${startDate ? `AND payment_date >= '${startDate}'` : ''}
               ${endDate ? `AND payment_date <= '${endDate}'` : ''}
               GROUP BY period
               ORDER BY period DESC
          `);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.map((row) => ({
            period: row.period,
            payment_count: parseInt(row.payment_count) || 0,
            total_amount: parseFloat(row.total_amount) || 0,
            average_amount: parseFloat(row.average_amount) || 0,
            unique_suppliers: parseInt(row.unique_suppliers) || 0
        }))) || [];
    }
    async getPaymentSummary(startDate, endDate) {
        const connection = await this.connection;
        let query = connection('inv_supplier_payments')
            .select(connection.raw('COUNT(*) as total_payments_all_time'), connection.raw('SUM(payment_amount) as total_amount_all_time'), connection.raw('AVG(payment_amount) as average_payment_amount'), connection.raw(`SUM(CASE WHEN payment_date >= ${startDate ? `'${startDate}'` : 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'} THEN 1 ELSE 0 END) as payments_in_range`), connection.raw(`SUM(CASE WHEN payment_date >= ${startDate ? `'${startDate}'` : 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'} AND payment_date <= ${endDate ? `'${endDate}'` : 'CURDATE()'} THEN payment_amount ELSE 0 END) as amount_in_range`))
            .where('payment_status', 'completed');
        const result = await query.first();
        return {
            total_payments_all_time: parseInt(result === null || result === void 0 ? void 0 : result.total_payments_all_time) || 0,
            total_amount_all_time: parseFloat(result === null || result === void 0 ? void 0 : result.total_amount_all_time) || 0,
            average_payment_amount: parseFloat(result === null || result === void 0 ? void 0 : result.average_payment_amount) || 0,
            payments_in_date_range: parseInt(result === null || result === void 0 ? void 0 : result.payments_in_range) || 0,
            amount_in_date_range: parseFloat(result === null || result === void 0 ? void 0 : result.amount_in_range) || 0
        };
    }
}
exports.InventoryPaymentAnalyticsModel = InventoryPaymentAnalyticsModel;
