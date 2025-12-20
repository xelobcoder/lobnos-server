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
    async generateCode(entity_type) {
        try {
            const conn = await this.connection;
            const existingCodes = await conn('referralcoding')
                .where({ entity_type })
                .select('code');
            let prefix = 'A';
            if (entity_type === 'insurance')
                prefix = 'I';
            else if (entity_type === 'clinician')
                prefix = 'C';
            else if (entity_type === 'organization')
                prefix = 'O';
            let maxNum = 0;
            for (const row of existingCodes) {
                const match = new RegExp(`^${prefix}(\\d{3})$`).exec(row.code);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum)
                        maxNum = num;
                }
            }
            const nextNum = maxNum + 1;
            const code = `${prefix}${nextNum.toString().padStart(3, '0')}`;
            return code;
        }
        catch (error) {
            console.error('ReferralCoding generateCode error:', error);
            throw error;
        }
    }
    async getReferralStrategyFullList(limit = 20, offset = 0) {
        try {
            const conn = await this.connection;
            const results = await conn('referralcoding as r')
                .select('r.id as referral_id', 'r.entity_type as referral_type', 'r.code as referral_code', conn.raw('COALESCE(o.name, c.name) as name'), conn.raw('COALESCE(o.location, c.location) as location'), conn.raw('COALESCE(o.email, c.email) as email'))
                .leftJoin('organization as o', function () {
                this.on('r.entity_type', '=', conn.raw("'organization'"))
                    .andOn('r.entity_id', '=', 'o.id');
            })
                .leftJoin('clinicianbasicinfo as c', function () {
                this.on('r.entity_type', '=', conn.raw("'clinician'"))
                    .andOn('r.entity_id', '=', 'c.id');
            })
                .limit(limit)
                .offset(offset);
            return results;
        }
        catch (error) {
            console.error('ReferralCodingRepo.getReferralStrategyFullList error:', error);
            throw error;
        }
    }
    async getEnityInformation(entity_type, entity_id) {
        try {
            const conn = await this.connection;
            let result;
            if (entity_type === 'organization') {
                result = await conn('organization').where({ id: entity_id }).first();
            }
            else if (entity_type === 'clinician') {
                result = await conn('clinicianbasicinfo').where({ id: entity_id }).first();
            }
            else if (entity_type === "insurance") {
                throw new Error('Unsupported entity type');
            }
            return result;
        }
        catch (error) {
            console.error('ReferralCoding getEntityInformation error:', error);
            throw error;
        }
    }
    async create(data, trx) {
        try {
            const conn = trx || await this.connection;
            const code = await this.generateCode(data.entity_type);
            const insertData = Object.assign(Object.assign({}, data), { code });
            const [id] = await conn('referralcoding').insert(insertData);
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
