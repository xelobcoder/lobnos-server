"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomersLeads = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const types_1 = require("./dev/types");
class CustomersLeads {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(lead) {
        try {
            const connection = await this.connection;
            const validatedLead = types_1.CreateLeadSchema.parse(lead);
            return await connection("leads").insert(Object.assign(Object.assign({}, validatedLead), { created_at: connection.raw('now()'), updated_at: connection.raw('now()') })).returning('*');
        }
        catch (error) {
            console.error('Lead creation error:', error);
            if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
                throw new Error('A lead with this email address already exists');
            }
            throw error;
        }
    }
    async findById(id) {
        try {
            const connection = await this.connection;
            return await connection("leads").where({ id }).first();
        }
        catch (error) {
            console.error('Lead find error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const connection = await this.connection;
            const validatedUpdates = types_1.UpdateLeadSchema.parse(updates);
            return await connection("leads")
                .where({ id })
                .update(Object.assign(Object.assign({}, validatedUpdates), { updated_at: connection.raw('now()') }));
        }
        catch (error) {
            console.error('Lead update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const connection = await this.connection;
            return await connection("leads").where({ id }).delete();
        }
        catch (error) {
            console.error('Lead delete error:', error);
            throw error;
        }
    }
    async findByStatus(status) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where({ status })
                .orderBy('created_at', 'desc');
        }
        catch (error) {
            console.error('Lead find by status error:', error);
            throw error;
        }
    }
    async findAllPaginated(page = 1, count = 10) {
        try {
            const connection = await this.connection;
            const [total] = await connection("leads").count('id as count');
            const offset = (page - 1) * count;
            const data = await connection("leads")
                .orderBy('created_at', 'desc')
                .limit(count)
                .offset(offset);
            return {
                data,
                total: total.count,
                page,
                totalPages: Math.ceil(total.count / count)
            };
        }
        catch (error) {
            console.error('Lead paginated find error:', error);
            throw error;
        }
    }
    async searchByName(searchTerm) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where('firstname', 'like', `%${searchTerm}%`)
                .orWhere('lastname', 'like', `%${searchTerm}%`)
                .orderBy('firstname', 'asc');
        }
        catch (error) {
            console.error('Lead search by name error:', error);
            throw error;
        }
    }
    async findByAssignedUser(userId) {
        try {
            const connection = await this.connection;
            return await connection("leads")
                .where({ assigned_to: userId })
                .orderBy('priority', 'desc');
        }
        catch (error) {
            console.error('Lead find by assigned user error:', error);
            throw error;
        }
    }
}
exports.CustomersLeads = CustomersLeads;
