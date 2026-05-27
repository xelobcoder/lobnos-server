"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTrackingRepository = void 0;
const CommissionTracking_interface_1 = require("../interfaces/CommissionTracking.interface");
const CommissionErrors_1 = require("../errors/CommissionErrors");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class CommissionTrackingRepository {
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.connection = trx ? trx : (0, KnexConnections_1.default)(this.tenantId);
    }
    async findById(id) {
        try {
            const connection = await this.connection;
            const record = await connection('commission_tracking').where('id', id).first();
            return record ? new CommissionTracking_interface_1.CommissionTracking(record) : null;
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find commission tracking by id ${id}`, error);
        }
    }
    async findByServiceId(serviceId) {
        try {
            const connection = await this.connection;
            const records = await connection('commission_tracking')
                .where('service_id', serviceId)
                .orderBy('calculated_at', 'desc');
            return records.map((record) => new CommissionTracking_interface_1.CommissionTracking(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find tracking for service ${serviceId}`, error);
        }
    }
    async findByRecipient(recipientType, recipientId, limit) {
        try {
            const connection = await this.connection;
            let query = connection('commission_tracking')
                .where('recipient_type', recipientType)
                .where('recipient_id', recipientId)
                .orderBy('calculated_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            const records = await query;
            return records.map((record) => new CommissionTracking_interface_1.CommissionTracking(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find tracking for ${recipientType} ${recipientId}`, error);
        }
    }
    async findByStatus(status, limit) {
        try {
            const connection = await this.connection;
            let query = connection('commission_tracking')
                .where('status', status)
                .orderBy('calculated_at', 'desc');
            if (limit) {
                query = query.limit(limit);
            }
            const records = await query;
            return records.map((record) => new CommissionTracking_interface_1.CommissionTracking(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find tracking with status ${status}`, error);
        }
    }
    async findUnpaid(recipientType, limit) {
        try {
            const connection = await this.connection;
            let query = connection('commission_tracking')
                .where('status', '!=', 'paid')
                .where('status', '!=', 'voided')
                .orderBy('calculated_at', 'desc');
            if (recipientType) {
                query = query.where('recipient_type', recipientType);
            }
            if (limit) {
                query = query.limit(limit);
            }
            const records = await query;
            return records.map((record) => new CommissionTracking_interface_1.CommissionTracking(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError('Failed to find unpaid commissions', error);
        }
    }
    async findByPeriod(recipientType, recipientId, periodRef, statuses) {
        try {
            const connection = await this.connection;
            const records = await connection('commission_tracking')
                .where('recipient_type', recipientType)
                .where('recipient_id', recipientId)
                .where('cap_period_reference', periodRef)
                .whereIn('status', statuses)
                .orderBy('calculated_at', 'asc');
            return records.map((record) => new CommissionTracking_interface_1.CommissionTracking(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find period commissions for ${recipientType} ${recipientId}`, error);
        }
    }
    async getPeriodTotal(recipientType, recipientId, periodRef, statuses) {
        try {
            const connection = await this.connection;
            const result = await connection('commission_tracking')
                .where('recipient_type', recipientType)
                .where('recipient_id', recipientId)
                .where('cap_period_reference', periodRef)
                .whereIn('status', statuses)
                .sum('final_commission as total')
                .first();
            return (result === null || result === void 0 ? void 0 : result.total) || 0;
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to calculate period total for ${recipientType} ${recipientId}`, error);
        }
    }
    async create(tracking) {
        try {
            const connection = await this.connection;
            console.log(tracking);
            const [id] = await connection('commission_tracking').insert(Object.assign(Object.assign({}, tracking), { created_at: new Date(), updated_at: new Date() }));
            const created = await this.findById(id);
            if (!created) {
                throw new CommissionErrors_1.DatabaseError(`Failed to retrieve created commission tracking with id ${id}`);
            }
            return created;
        }
        catch (error) {
            if (error instanceof CommissionErrors_1.DatabaseError)
                throw error;
            throw new CommissionErrors_1.DatabaseError('Failed to create commission tracking record', error);
        }
    }
    async updateStatus(id, status) {
        try {
            const connection = await this.connection;
            await connection('commission_tracking').where('id', id).update({
                status,
                updated_at: new Date(),
            });
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to update commission tracking status ${id}`, error);
        }
    }
    async getSummary(recipientType) {
        try {
            const connection = await this.connection;
            let query = connection('commission_tracking')
                .where('status', '!=', 'voided');
            if (recipientType) {
                query = query.where('recipient_type', recipientType);
            }
            const summary = await query
                .sum('commission_due as total_commission_due')
                .sum('final_commission as total_amount_paid')
                .count('* as payment_count')
                .first();
            return {
                total_commission_due: (summary === null || summary === void 0 ? void 0 : summary.total_commission_due) || 0,
                total_amount_paid: (summary === null || summary === void 0 ? void 0 : summary.total_amount_paid) || 0,
                total_outstanding: ((summary === null || summary === void 0 ? void 0 : summary.total_commission_due) || 0) - ((summary === null || summary === void 0 ? void 0 : summary.total_amount_paid) || 0),
                payment_count: (summary === null || summary === void 0 ? void 0 : summary.payment_count) || 0,
            };
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError('Failed to calculate commission summary', error);
        }
    }
}
exports.CommissionTrackingRepository = CommissionTrackingRepository;
