"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionAssignmentRepository = void 0;
const CommissionAssignment_interface_1 = require("../interfaces/CommissionAssignment.interface");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const commissionConfigutationRepo_1 = require("../commissionConfigutationRepo");
class CommissionAssignmentRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async findById(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const record = await connection('commission_assignments').where('id', id).first();
            return record ? new CommissionAssignment_interface_1.CommissionAssignment(record) : null;
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find commission assignment by id ${id}`, error);
        }
    }
    async findByConfigId(configId) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const records = await connection('commission_assignments')
                .where('commission_config_id', configId)
                .orderBy('assigned_from', 'desc');
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find assignments for config ${configId}`, error);
        }
    }
    async findActive(onDate) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const records = await connection('commission_assignments')
                .where('is_active', true)
                .where('assigned_from', '<=', onDate)
                .where((builder) => {
                builder.whereNull('assigned_to').orWhere('assigned_to', '>=', onDate);
            })
                .orderBy('assigned_from', 'desc');
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find active commission assignments', error);
        }
    }
    async findApplicable(params) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            let query = connection('commission_assignments')
                .where('is_active', true)
                .where('assigned_from', '<=', params.date)
                .where((builder) => {
                builder.whereNull('assigned_to').orWhere('assigned_to', '>=', params.date);
            });
            // Scope matching: clinician, organization, or system
            if (params.scopeType === 'clinician' && params.scopeId) {
                query = query.where((builder) => {
                    builder.where('scope_type', 'clinician').where('scope_id', params.scopeId);
                });
            }
            else if (params.scopeType === 'organization' && params.scopeId) {
                query = query.where((builder) => {
                    builder.where('scope_type', 'organization').where('scope_id', params.scopeId);
                });
            }
            else {
                query = query.where('scope_type', 'system');
            }
            // Service matching: exact service_id OR category OR global
            if (params.serviceId) {
                query = query.where((builder) => {
                    builder.where('service_id', params.serviceId);
                });
            }
            else if (params.serviceCategory) {
                query = query.where((builder) => {
                    builder
                        .where('service_category', params.serviceCategory)
                        .orWhereNull('service_category');
                });
            }
            else {
                query = query.where((builder) => {
                    builder.whereNull('service_id').whereNull('service_category');
                });
            }
            const records = await query.orderBy('priority', 'desc').orderBy('assigned_from', 'desc');
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find applicable commission assignments', error);
        }
    }
    async create(assignment) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            const [id] = await connection('commission_assignments').insert(Object.assign(Object.assign({}, assignment), { created_at: new Date() }));
            const created = await this.findById(id);
            if (!created) {
                throw new commissionConfigutationRepo_1.DatabaseError(`Failed to retrieve created commission assignment with id ${id}`);
            }
            return created;
        }
        catch (error) {
            if (error instanceof commissionConfigutationRepo_1.DatabaseError)
                throw error;
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to create commission assignment', error);
        }
    }
    async softDelete(id) {
        try {
            const connection = await (0, KnexConnections_1.default)(this.tenantId);
            await connection('commission_assignments').where('id', id).update({
                is_active: false,
            });
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to soft delete commission assignment ${id}`, error);
        }
    }
    async getByIdOrThrow(id) {
        const assignment = await this.findById(id);
        if (!assignment) {
            throw new commissionConfigutationRepo_1.AssignmentNotFoundError(id);
        }
        return assignment;
    }
}
exports.CommissionAssignmentRepository = CommissionAssignmentRepository;
