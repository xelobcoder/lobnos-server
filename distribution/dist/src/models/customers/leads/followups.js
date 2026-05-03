"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadFollowUpsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const types_1 = require("./dev/types");
class LeadFollowUpsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(followUp) {
        try {
            const connection = await this.connection;
            const validatedFollowUp = types_1.CreateLeadFollowUpSchema.parse(followUp);
            return await connection("lead_followups").insert(Object.assign(Object.assign({}, validatedFollowUp), { created_at: connection.raw('now()'), updated_at: connection.raw('now()') })).returning('*');
        }
        catch (error) {
            console.error('Follow-up creation error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const connection = await this.connection;
            return await connection("lead_followups").where({ id }).first();
        }
        catch (error) {
            console.error('Follow-up find error:', error);
            throw error;
        }
    }
    async findByLeadId(leadId) {
        try {
            const connection = await this.connection;
            return await connection("lead_followups")
                .select("lead_followups.*", "roles.username as created_by_username")
                .leftJoin("roles", "lead_followups.created_by", "roles.employeeid")
                .where({ lead_id: leadId })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            console.error('Follow-up find by lead ID error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const connection = await this.connection;
            const validatedUpdates = types_1.UpdateLeadFollowUpSchema.parse(updates);
            return await connection("lead_followups")
                .where({ id })
                .update(Object.assign(Object.assign({}, validatedUpdates), { updated_at: connection.raw('now()') }));
        }
        catch (error) {
            console.error('Follow-up update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const connection = await this.connection;
            return await connection("lead_followups").where({ id }).delete();
        }
        catch (error) {
            console.error('Follow-up delete error:', error);
            throw error;
        }
    }
    async findByStatus(status) {
        try {
            const connection = await this.connection;
            return await connection("lead_followups")
                .where({ status })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            console.error('Follow-up find by status error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, count = 10, sortby = "DESC", withlead = false) {
        try {
            const connection = await this.connection;
            const [total] = await connection("lead_followups").count('id as count');
            const offset = (page - 1) * count;
            let query = connection("lead_followups")
                .leftJoin("leads", "lead_followups.lead_id", "leads.id")
                .leftJoin("roles", "lead_followups.created_by", "roles.employeeid")
                .select("lead_followups.*", "leads.firstname", "leads.lastname", "leads.contact_email", "leads.contact_phone", "leads.company_name", "leads.industry_type", "leads.lead_source", "leads.status as lead_status", "leads.priority as lead_priority", "leads.location", "leads.assigned_to", "roles.username as created_by_username")
                .orderBy('lead_followups.created_at', sortby)
                .limit(count)
                .offset(offset);
            const data = await query;
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / count)
            };
        }
        catch (error) {
            console.error('Follow-up paginated find error:', error);
            throw error;
        }
    }
    async findPendingFollowups() {
        try {
            const connection = await this.connection;
            return await connection("lead_followups")
                .where({ status: 'pending' })
                .whereNotNull('next_followup_date')
                .where('next_followup_date', '<=', connection.raw('CURDATE()'))
                .orderBy('priority', 'desc')
                .orderBy('next_followup_date', 'asc');
        }
        catch (error) {
            console.error('Pending followups error:', error);
            throw error;
        }
    }
    async findByAssignedUser(userId) {
        try {
            const connection = await this.connection;
            return await connection("lead_followups")
                .where({ created_by: userId })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            console.error('Follow-up find by assigned user error:', error);
            throw error;
        }
    }
}
exports.LeadFollowUpsRepo = LeadFollowUpsRepo;
