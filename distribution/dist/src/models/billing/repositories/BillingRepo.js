"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class BillingRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(billingData) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .insert(billingData);
        }
        catch (error) {
            console.error('Billing creation error:', error);
            throw error;
        }
    }
    async update(billingId, updates) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .where({ billingid: billingId })
                .update(updates);
        }
        catch (error) {
            console.error('Billing update error:', error);
            throw error;
        }
    }
    async findById(billingId) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .where({ billingid: billingId })
                .first();
        }
        catch (error) {
            console.error('Billing find error:', error);
            throw error;
        }
    }
    async findByPatientId(patientId) {
        try {
            let conn = await this.connection;
            return await conn('billing')
                .where({ patientid: patientId })
                .orderBy('billedon', 'desc');
        }
        catch (error) {
            console.error('Billing find by patient error:', error);
            throw error;
        }
    }
    async findByPatientIdWithDateRange(patientId, startDate, endDate) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .where({ patientid: patientId })
                .whereBetween('billedon', [startDate, endDate])
                .orderBy('billedon', 'desc');
        }
        catch (error) {
            console.error('Billing find by patient with date range error:', error);
            throw error;
        }
    }
    async findByPatientIdPaginated(patientId, page = 1, limit = 10) {
        try {
            const conn = await this.connection;
            const offset = (page - 1) * limit;
            const [total] = await conn('billing')
                .where({ patientid: patientId })
                .count('billingid as count');
            const data = await conn('billing')
                .where({ patientid: patientId })
                .orderBy('billedon', 'desc')
                .limit(limit)
                .offset(offset);
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / limit)
            };
        }
        catch (error) {
            console.error('Billing find by patient paginated error:', error);
            throw error;
        }
    }
    async findAllByPatientId(patientId) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .select('billing.*', 'new_patients.firstname', 'new_patients.middlename', 'new_patients.lastname')
                .leftJoin('new_patients', 'billing.patientid', 'new_patients.patientid')
                .where('billing.patientid', patientId)
                .orderBy('billing.billedon', 'desc');
        }
        catch (error) {
            console.error('Find all billing by patient error:', error);
            throw error;
        }
    }
    async delete(billingId) {
        try {
            const conn = await this.connection;
            return await conn('billing')
                .where({ billingid: billingId })
                .delete();
        }
        catch (error) {
            console.error('Billing delete error:', error);
            throw error;
        }
    }
}
exports.BillingRepo = BillingRepo;
