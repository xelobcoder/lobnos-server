"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsTemplatesRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsTemplatesRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmstemplates";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(data).returning('templateid');
        return id;
    }
    async findById(templateid) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ templateid }).first();
        return result || null;
    }
    async findAll() {
        const connection = await this.connection;
        return await connection(this.tablename).select();
    }
    async update(templateid, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ templateid }).update(data);
    }
    async delete(templateid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ templateid }).del();
    }
    async findAllPaginated(page, count) {
        const connection = await this.connection;
        const totalResult = await connection(this.tablename).count('* as count');
        const templates = await connection(this.tablename)
            .leftJoin('roles', 'primesmstemplates.createdby', 'roles.employeeid')
            .select("primesmstemplates.*", "roles.username as createdbyname")
            .offset((page - 1) * count)
            .limit(count);
        const total = Number((totalResult[0] && (totalResult[0].count || totalResult[0]['count'])) || 0);
        return { templates, total };
    }
}
exports.PrimeSmsTemplatesRepo = PrimeSmsTemplatesRepo;
