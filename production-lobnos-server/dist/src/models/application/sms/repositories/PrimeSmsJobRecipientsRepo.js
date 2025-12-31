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
    async findByJobAndRefids(jobid, refids) {
        if (!refids || refids.length === 0)
            return [];
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ jobid })
            .whereIn('refid', refids)
            .select();
    }
    async findOneByJobRefid(jobid, refid) {
        const connection = await this.connection;
        const result = await connection(this.tablename)
            .where({ jobid, refid })
            .first();
        return result || null;
    }
    async create(data) {
        const connection = await this.connection;
        await connection(this.tablename).insert(data);
        return null;
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
    async findAllByJobPaginated(jobid, page = 1, count = 20) {
        const connection = await this.connection;
        return await connection(this.tablename)
            .where({ jobid })
            .limit(count)
            .offset((page - 1) * count)
            .select();
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
        const connection = await trx || this.connection;
        const rows = recipients.map(r => {
            return Object.assign(Object.assign({}, r), { jobid });
        });
        await connection(this.tablename).insert(rows);
        return [];
    }
    async updateDeliveryStatusByPhone(jobid, phonee164, status, arkeselId) {
        const connection = await this.connection;
        const updateData = {
            deliverystatus: status,
            sentat: new Date(),
        };
        if (arkeselId)
            updateData.messageid = arkeselId;
        return await connection(this.tablename)
            .where({ jobid, phonee164 })
            .update(updateData);
    }
}
exports.PrimeSmsJobRecipientsRepo = PrimeSmsJobRecipientsRepo;
