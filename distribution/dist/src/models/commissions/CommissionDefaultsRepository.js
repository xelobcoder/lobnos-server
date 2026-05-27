"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionDefaultsRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class CommissionDefaultsRepository {
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.connection = trx ? trx : (0, KnexConnections_1.default)(tenantId);
    }
    /**
     * Get all commission defaults
     */
    async getAll() {
        const connection = await this.connection;
        return connection('commission_defaults').select('*');
    }
    /**
     * Get commission defaults by target type
     */
    async getByTargetType(targetType) {
        const connection = await this.connection;
        return connection('commission_defaults')
            .where({ target_type: targetType })
            .first();
    }
    /**
     * Get commission defaults by ID
     */
    async getById(id) {
        const connection = await this.connection;
        return connection('commission_defaults')
            .where({ id })
            .first();
    }
    /**
     * Create a new commission default
     */
    async create(data) {
        const connection = await this.connection;
        const [id] = await connection('commission_defaults').insert({
            target_type: data.target_type,
            commission_type: data.commission_type,
            commission_value: data.commission_value,
            created_on: new Date(),
            updated_on: new Date(),
        });
        return id;
    }
    /**
     * Update commission defaults by ID
     */
    async updateById(id, data) {
        const connection = await this.connection;
        const updated = await connection('commission_defaults')
            .where({ id })
            .update(Object.assign(Object.assign({}, data), { updated_on: new Date() }));
        return updated > 0;
    }
    /**
     * Update commission defaults by target type
     */
    async updateByTargetType(targetType, data) {
        const connection = await this.connection;
        const updated = await connection('commission_defaults')
            .where({ target_type: targetType })
            .update(Object.assign(Object.assign({}, data), { updated_on: new Date() }));
        return updated > 0;
    }
    /**
     * Delete commission defaults by ID
     */
    async deleteById(id) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const deleted = await connection('commission_defaults')
            .where({ id })
            .del();
        return deleted > 0;
    }
    /**
     * Delete commission defaults by target type
     */
    async deleteByTargetType(targetType) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const deleted = await connection('commission_defaults')
            .where({ target_type: targetType })
            .del();
        return deleted > 0;
    }
    /**
     * Check if a target type exists
     */
    async exists(targetType) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const record = await connection('commission_defaults')
            .where({ target_type: targetType })
            .first();
        return !!record;
    }
    /**
     * Get commission value for a target type
     */
    async getCommissionValue(targetType) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const record = await connection('commission_defaults')
            .where({ target_type: targetType })
            .select('commission_value', 'commission_type')
            .first();
        if (!record)
            return null;
        return {
            value: record.commission_value,
            type: record.commission_type,
        };
    }
}
exports.CommissionDefaultsRepository = CommissionDefaultsRepository;
