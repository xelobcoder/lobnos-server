"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsJobsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsJobsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmsjobs";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data, trx) {
        const connection = await trx || this.connection;
        const [id] = await connection(this.tablename).insert(data).returning('jobid');
        return id;
    }
    async findById(jobid) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ jobid }).first();
        return result || null;
    }
    async findAll() {
        const connection = await this.connection;
        return await connection(this.tablename).select();
    }
    async update(jobid, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ jobid }).update(data);
    }
    async delete(jobid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ jobid }).del();
    }
    async findAllPaginated(page, count) {
        const connection = await this.connection;
        const totalResult = await connection(this.tablename).count('* as count');
        const jobs = await connection(this.tablename)
            .select()
            .offset((page - 1) * count)
            .limit(count);
        const total = Number((totalResult[0] && (totalResult[0].count || totalResult[0]['count'])) || 0);
        return { jobs, total };
    }
}
exports.PrimeSmsJobsRepo = PrimeSmsJobsRepo;
