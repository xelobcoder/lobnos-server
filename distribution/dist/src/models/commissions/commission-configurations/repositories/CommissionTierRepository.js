"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionTierRepository = void 0;
const CommissionTier_interface_1 = require("../interfaces/CommissionTier.interface");
const CommissionErrors_1 = require("../errors/CommissionErrors");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class CommissionTierRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async findById(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const record = await connection('commission_tiers').where('id', id).first();
            return record ? new CommissionTier_interface_1.CommissionTier(record) : null;
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find commission tier by id ${id}`, error);
        }
    }
    async findByConfigId(configId) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const records = await connection('commission_tiers')
                .where('commission_config_id', configId)
                .orderBy('sort_order', 'asc');
            return records.map((record) => new CommissionTier_interface_1.CommissionTier(record));
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find tiers for config ${configId}`, error);
        }
    }
    async findMatchingTier(configId, amount) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const record = await connection('commission_tiers')
                .where('commission_config_id', configId)
                .where('min_amount_inclusive', '<=', amount)
                .where((builder) => {
                builder.whereNull('max_amount_exclusive').orWhere('max_amount_exclusive', '>', amount);
            })
                .orderBy('sort_order', 'asc')
                .first();
            return record ? new CommissionTier_interface_1.CommissionTier(record) : null;
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to find matching tier for config ${configId} with amount ${amount}`, error);
        }
    }
    async create(tier) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const [id] = await connection('commission_tiers').insert(Object.assign(Object.assign({}, tier), { created_at: new Date() }));
            const created = await this.findById(id);
            if (!created) {
                throw new CommissionErrors_1.DatabaseError(`Failed to retrieve created commission tier with id ${id}`);
            }
            return created;
        }
        catch (error) {
            if (error instanceof CommissionErrors_1.DatabaseError)
                throw error;
            throw new CommissionErrors_1.DatabaseError('Failed to create commission tier', error);
        }
    }
    async createMultiple(tiers, commission_config_id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const tiersWithTimestamp = tiers.map((tier) => (Object.assign(Object.assign({}, tier), { created_at: new Date(), commission_config_id })));
            const ids = await connection('commission_tiers').insert(tiersWithTimestamp);
            const created = await Promise.all(ids.map((id) => this.findById(id).then((t) => t)));
            return created;
        }
        catch (error) {
            console.log('Error creating multiple commission tiers:', error);
            if (error instanceof CommissionErrors_1.DatabaseError)
                throw error;
            throw new CommissionErrors_1.DatabaseError('Failed to create multiple commission tiers', error);
        }
    }
    async delete(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            await connection('commission_tiers').where('id', id).delete();
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to delete commission tier ${id}`, error);
        }
    }
    async deleteByConfigId(configId) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            await connection('commission_tiers').where('commission_config_id', configId).delete();
        }
        catch (error) {
            throw new CommissionErrors_1.DatabaseError(`Failed to delete tiers for config ${configId}`, error);
        }
    }
}
exports.CommissionTierRepository = CommissionTierRepository;
