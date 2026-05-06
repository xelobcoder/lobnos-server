"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionConfigRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionConfigRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async findById(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const record = await connection('commission_configs')
                .where('id', id).first();
            return record ? new commissionConfigutationRepo_1.CommissionConfig(record) : null;
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find commission config by id ${id}`, error);
        }
    }
    async findByName(name) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const record = await connection('commission_configs')
                .where('name', name).first();
            return record ? new commissionConfigutationRepo_1.CommissionConfig(record) : null;
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find commission config by name ${name}`, error);
        }
    }
    async findActive(onDate) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const records = await connection('commission_configs')
                .where('is_active', true)
                .where('effective_from', '<=', onDate)
                .where((builder) => {
                builder.whereNull('effective_to').orWhere('effective_to', '>=', onDate);
            })
                .orderBy('effective_from', 'desc');
            return records.map((record) => new commissionConfigutationRepo_1.CommissionConfig(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find active commission configs', error);
        }
    }
    async findAll() {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const records = await connection('commission_configs').orderBy('created_at', 'desc');
            return records.map((record) => new commissionConfigutationRepo_1.CommissionConfig(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find all commission configs', error);
        }
    }
    async create(config) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const [id] = await connection('commission_configs').insert(Object.assign(Object.assign({}, config), { created_at: new Date(), updated_at: new Date() }));
            const created = await this.findById(id);
            if (!created) {
                throw new commissionConfigutationRepo_1.DatabaseError(`Failed to retrieve created commission config with id ${id}`);
            }
            return created;
        }
        catch (error) {
            if (error instanceof commissionConfigutationRepo_1.DatabaseError)
                throw error;
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to create commission config', error);
        }
    }
    async softDelete(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            await connection('commission_configs').where('id', id).update({
                is_active: false,
                updated_at: new Date(),
            });
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to soft delete commission config ${id}`, error);
        }
    }
    async getByIdOrThrow(id) {
        const config = await this.findById(id);
        if (!config) {
            throw new commissionConfigutationRepo_1.ConfigNotFoundError(id);
        }
        return config;
    }
}
exports.CommissionConfigRepository = CommissionConfigRepository;
