"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSmsJobRecipientsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
class PrimeSmsJobRecipientsRepo {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.tablename = "primesmsjobrecipients";
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(data) {
        const connection = await this.connection;
        const [id] = await connection(this.tablename).insert(data).returning('recid');
        return id;
    }
    async findById(recid) {
        const connection = await this.connection;
        const result = await connection(this.tablename).where({ recid }).first();
        return result || null;
    }
    async findAllByJob(jobid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ jobid }).select();
    }
    async update(recid, data) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ recid }).update(data);
    }
    async delete(recid) {
        const connection = await this.connection;
        return await connection(this.tablename).where({ recid }).del();
    }
    async bulkInsert(jobid, recipients, trx) {
        const connection = trx || await this.connection;
        const rows = recipients.map(r => (Object.assign(Object.assign({}, r), { jobid })));
        console.log('Inserting rows:', rows);
        const ids = await connection(this.tablename).insert(rows).returning('recid');
        // return Array.isArray(ids) ? ids.map((id: any) => (typeof id === 'object' ? id.recid : id)) : [];
        return ids;
    }
}
exports.PrimeSmsJobRecipientsRepo = PrimeSmsJobRecipientsRepo;
