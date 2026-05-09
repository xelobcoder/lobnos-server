"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAnalytics = void 0;
const CommissionAnalyticsWithDate_1 = require("../repositories/CommissionAnalyticsWithDate");
class CommissionAnalytics {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.analyticsWithDate = new CommissionAnalyticsWithDate_1.CommissionAnalyticsWithDate(tenantId);
    }
    async getCommissionsByPeriod(query) {
        const data = await this.analyticsWithDate.getCommissionsByPeriod(query);
        return {
            period: query.period,
            startDate: query.startDate,
            endDate: query.endDate,
            data: data,
        };
    }
    async getCommissionsByRecipient(query) {
        const data = await this.analyticsWithDate.getCommissionsByRecipient(query);
        return {
            period: query.period,
            startDate: query.startDate,
            endDate: query.endDate,
            recipientType: query.recipientType || 'clinician',
            data: data,
        };
    }
    async getRecipientCommissionsByPeriod(query) {
        if (!query.recipientType || !query.recipientId) {
            throw new Error('recipientType and recipientId are required for recipient-specific analytics');
        }
        const data = await this.analyticsWithDate.getRecipientCommissionsByPeriod(query);
        return {
            period: query.period,
            startDate: query.startDate,
            endDate: query.endDate,
            data: data,
        };
    }
    async getPaymentSummary(query) {
        const stats = await this.analyticsWithDate.getPeriodStatistics(query);
        const totalPaid = (stats === null || stats === void 0 ? void 0 : stats.total_paid) || 0;
        const totalDue = (stats === null || stats === void 0 ? void 0 : stats.total_due) || 0;
        const paymentPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100 * 100) / 100 : 0;
        return {
            totalPaid,
            totalDue,
            totalWaived: (stats === null || stats === void 0 ? void 0 : stats.total_waived) || 0,
            averagePaid: (stats === null || stats === void 0 ? void 0 : stats.average_paid) || 0,
            batchCount: (stats === null || stats === void 0 ? void 0 : stats.batch_count) || 0,
            uniqueRecipients: (stats === null || stats === void 0 ? void 0 : stats.unique_recipients) || 0,
            paymentPercentage,
            period: `${query.startDate.toISOString().split('T')[0]} to ${query.endDate.toISOString().split('T')[0]}`,
        };
    }
    async getPaymentsByStatus(query) {
        const data = await this.analyticsWithDate.getCommissionsByStatus(query);
        return data.map((item) => ({
            status: item.status,
            totalPaid: item.total_paid || 0,
            count: item.count || 0,
            averagePaid: item.average_paid || 0,
        }));
    }
    async getRecipientPaymentEfficiency(query) {
        const data = await this.analyticsWithDate.getRecipientPaymentEfficiency(query);
        return data.map((item) => ({
            recipientId: item.recipient_id,
            recipientType: item.recipient_type,
            totalPaid: item.total_paid || 0,
            totalDue: item.total_due || 0,
            totalWaived: item.total_waived || 0,
            paymentBatches: item.payment_batches || 0,
            paymentPercentage: item.payment_percentage || 0,
        }));
    }
    async getComprehensiveDashboard(query) {
        const [periodData, statusData, efficiencyData, summary] = await Promise.all([
            this.analyticsWithDate.getCommissionsByPeriod(query),
            this.analyticsWithDate.getCommissionsByStatus(query),
            this.analyticsWithDate.getRecipientPaymentEfficiency(query),
            this.analyticsWithDate.getPeriodStatistics(query),
        ]);
        const totalPaid = (summary === null || summary === void 0 ? void 0 : summary.total_paid) || 0;
        const totalDue = (summary === null || summary === void 0 ? void 0 : summary.total_due) || 0;
        const paymentPercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100 * 100) / 100 : 0;
        return {
            summary: {
                totalPaid,
                totalDue,
                totalWaived: (summary === null || summary === void 0 ? void 0 : summary.total_waived) || 0,
                averagePaid: (summary === null || summary === void 0 ? void 0 : summary.average_paid) || 0,
                batchCount: (summary === null || summary === void 0 ? void 0 : summary.batch_count) || 0,
                uniqueRecipients: (summary === null || summary === void 0 ? void 0 : summary.unique_recipients) || 0,
                paymentPercentage,
                period: `${query.startDate.toISOString().split('T')[0]} to ${query.endDate.toISOString().split('T')[0]}`,
            },
            byPeriod: {
                period: query.period,
                data: periodData,
            },
            byStatus: statusData.map((item) => ({
                status: item.status,
                totalPaid: item.total_paid || 0,
                count: item.count || 0,
                averagePaid: item.average_paid || 0,
            })),
            recipientEfficiency: efficiencyData.map((item) => ({
                recipientId: item.recipient_id,
                recipientType: item.recipient_type,
                totalPaid: item.total_paid || 0,
                totalDue: item.total_due || 0,
                paymentPercentage: item.payment_percentage || 0,
                paymentBatches: item.payment_batches || 0,
            })),
        };
    }
    formatDateRange(startDate, endDate) {
        const start = startDate.toISOString().split('T')[0];
        const end = endDate.toISOString().split('T')[0];
        return `${start} to ${end}`;
    }
}
exports.CommissionAnalytics = CommissionAnalytics;
