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
    constructor(tenantId, trx) {
        this.tenantId = tenantId;
        this.connection = trx || (0, KnexConnections_1.default)(this.tenantId);
    }
    async getConnection() {
        return this.connection;
    }
    async findById(id) {
        try {
            const connection = await this.getConnection();
            const record = await connection('commission_assignments as ca')
                .select('ca.*', connection.raw(`
                              CASE 
                                   WHEN ca.scope_type = 'clinician' THEN cbi.name 
                                   WHEN ca.scope_type = 'organization' THEN org.name 
                                   ELSE 'System' 
                              END as recipient_name
                         `))
                .leftJoin('clinicianbasicinfo as cbi', function () {
                this.on('ca.scope_id', '=', 'cbi.id').andOn('ca.scope_type', '=', connection.raw("'clinician'"));
            })
                .leftJoin('organization as org', function () {
                this.on('ca.scope_id', '=', 'org.id').andOn('ca.scope_type', '=', connection.raw("'organization'"));
            })
                .where('ca.id', id)
                .first();
            return record ? new CommissionAssignment_interface_1.CommissionAssignment(record) : null;
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find commission assignment by id ${id}`, error);
        }
    }
    async findByConfigId(configId, page, count) {
        try {
            const connection = await this.getConnection();
            let query = connection('commission_assignments as ca')
                .select('ca.*', connection.raw(`
                              CASE 
                                   WHEN ca.scope_type = 'clinician' THEN cbi.name 
                                   WHEN ca.scope_type = 'organization' THEN org.name 
                                   ELSE 'System' 
                              END as recipient_name
                         `))
                .leftJoin('clinicianbasicinfo as cbi', function () {
                this.on('ca.scope_id', '=', 'cbi.id').andOn('ca.scope_type', '=', connection.raw("'clinician'"));
            })
                .leftJoin('organization as org', function () {
                this.on('ca.scope_id', '=', 'org.id').andOn('ca.scope_type', '=', connection.raw("'organization'"));
            })
                .where('ca.commission_config_id', configId)
                .orderBy('ca.assigned_from', 'desc');
            if (page !== undefined && count !== undefined) {
                const offset = (page - 1) * count;
                query = query.offset(offset).limit(count);
            }
            const records = await query;
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError(`Failed to find assignments for config ${configId}`, error);
        }
    }
    async findActive(params) {
        try {
            const connection = await this.getConnection();
            let query = connection('commission_assignments as ca')
                .select('ca.*', connection.raw(`
                              CASE 
                                   WHEN ca.scope_type = 'clinician' THEN cbi.name 
                                   WHEN ca.scope_type = 'organization' THEN org.name 
                                   ELSE 'System' 
                              END as recipient_name
                         `))
                .leftJoin('clinicianbasicinfo as cbi', function () {
                this.on('ca.scope_id', '=', 'cbi.id').andOn('ca.scope_type', '=', connection.raw("'clinician'"));
            })
                .leftJoin('organization as org', function () {
                this.on('ca.scope_id', '=', 'org.id').andOn('ca.scope_type', '=', connection.raw("'organization'"));
            });
            if ((params === null || params === void 0 ? void 0 : params.status) === 'active') {
                query.where('ca.is_active', true);
            }
            else if ((params === null || params === void 0 ? void 0 : params.status) === 'inactive') {
                query.where('ca.is_active', false);
            }
            // If status is not provided or set to 'all', we don't filter by is_active here,
            // but the original code had .where('ca.is_active', true) as default.
            // Let's make 'active' the default if no status is provided to maintain backward compatibility
            // unless specifically requested otherwise.
            else if (!(params === null || params === void 0 ? void 0 : params.status)) {
                query.where('ca.is_active', true);
            }
            if (params === null || params === void 0 ? void 0 : params.onDate) {
                query.where('ca.assigned_from', '<=', params.onDate)
                    .where((builder) => {
                    builder.whereNull('ca.assigned_to').orWhere('ca.assigned_to', '>=', params.onDate);
                });
            }
            if (params === null || params === void 0 ? void 0 : params.filterType) {
                query.where('ca.scope_type', params.filterType);
            }
            if (params === null || params === void 0 ? void 0 : params.filterName) {
                const searchName = `%${params.filterName}%`;
                query.where((builder) => {
                    builder.where('cbi.name', 'like', searchName)
                        .orWhere('org.name', 'like', searchName);
                });
            }
            query = query.orderBy('ca.assigned_from', 'desc');
            if ((params === null || params === void 0 ? void 0 : params.page) !== undefined && (params === null || params === void 0 ? void 0 : params.count) !== undefined) {
                const offset = (params.page - 1) * params.count;
                query = query.offset(offset).limit(params.count);
            }
            const records = await query;
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find active commission assignments', error);
        }
    }
    async findApplicable(params) {
        try {
            const connection = await this.getConnection();
            let query = connection('commission_assignments as ca')
                .select('ca.*', connection.raw(`
                              CASE 
                                   WHEN ca.scope_type = 'clinician' THEN cbi.name 
                                   WHEN ca.scope_type = 'organization' THEN org.name 
                                   ELSE 'System' 
                              END as recipient_name
                         `))
                .leftJoin('clinicianbasicinfo as cbi', function () {
                this.on('ca.scope_id', '=', 'cbi.id').andOn('ca.scope_type', '=', connection.raw("'clinician'"));
            })
                .leftJoin('organization as org', function () {
                this.on('ca.scope_id', '=', 'org.id').andOn('ca.scope_type', '=', connection.raw("'organization'"));
            })
                .where('ca.is_active', true)
                .where('ca.assigned_from', '<=', params.date)
                .where((builder) => {
                builder.whereNull('ca.assigned_to').orWhere('ca.assigned_to', '>=', params.date);
            });
            if (params.scopeType === 'clinician' && params.scopeId) {
                query = query.where('ca.scope_type', 'clinician').where('ca.scope_id', params.scopeId);
            }
            else if (params.scopeType === 'organization' && params.scopeId) {
                query = query.where('ca.scope_type', 'organization').where('ca.scope_id', params.scopeId);
            }
            else {
                query = query.where('ca.scope_type', 'system');
            }
            const records = await query.orderBy('ca.priority', 'desc').orderBy('ca.assigned_from', 'desc');
            return records.map((record) => new CommissionAssignment_interface_1.CommissionAssignment(record));
        }
        catch (error) {
            throw new commissionConfigutationRepo_1.DatabaseError('Failed to find applicable commission assignments', error);
        }
    }
    async create(assignment) {
        try {
            const connection = await this.getConnection();
            // Deactivate existing active assignments for this recipient to ensure "one assignment per recipient"
            await connection('commission_assignments')
                .where({
                scope_type: assignment.scope_type,
                scope_id: assignment.scope_id || null,
                is_active: true
            })
                .update({ is_active: false });
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
    async createMultiple(assignments) {
        const conn = await this.getConnection();
        const results = [];
        // Use a transaction for multiple creations
        return await conn.transaction(async (trx) => {
            const repository = new CommissionAssignmentRepository(this.tenantId, trx);
            for (const assignment of assignments) {
                const created = await repository.create(assignment);
                results.push(created);
            }
            return results;
        });
    }
    async softDelete(id) {
        try {
            const connection = await this.getConnection();
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
