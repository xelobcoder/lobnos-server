"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralCodingRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ReferralCodingRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        try {
            const conn = await this.connection;
            const [id] = await conn('referralcoding').insert(data);
            return id;
        }
        catch (error) {
            console.error('ReferralCoding create error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('referralcoding').where({ id }).first();
        }
        catch (error) {
            console.error('ReferralCoding findById error:', error);
            throw error;
        }
    }
    async findByEntity(entity_id, entity_type) {
        try {
            const conn = await this.connection;
            return await conn('referralcoding').where({ entity_id, entity_type });
        }
        catch (error) {
            console.error('ReferralCoding findByEntity error:', error);
            throw error;
        }
    }
    async findByCode(code) {
        try {
            const conn = await this.connection;
            const result = await conn('referralcoding').where({ code });
            return result.length > 0 ? result[0] : null;
        }
        catch (error) {
            console.error('ReferralCoding findByCode error:', error);
            throw error;
        }
    }
    async update(id, updates) {
        try {
            const conn = await this.connection;
            return await conn('referralcoding').where({ id }).update(updates);
        }
        catch (error) {
            console.error('ReferralCoding update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            return await conn('referralcoding').where({ id }).delete();
        }
        catch (error) {
            console.error('ReferralCoding delete error:', error);
            throw error;
        }
    }
    async list(entity_type) {
        try {
            const conn = await this.connection;
            let query = conn('referralcoding');
            if (entity_type) {
                query = query.where({ entity_type });
            }
            return await query;
        }
        catch (error) {
            console.error('ReferralCoding list error:', error);
            throw error;
        }
    }
}
exports.ReferralCodingRepo = ReferralCodingRepo;
