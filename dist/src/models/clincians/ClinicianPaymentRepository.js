"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicianPaymentRepository = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ClinicianPaymentRepository {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
    async create(paymentData, trx) {
        try {
            const conn = trx || await this.connection;
            const [id] = await conn('clinicianpaymentinfo')
                .insert(paymentData);
            return id > 0;
        }
        catch (error) {
            console.error('Clinician payment creation error:', error);
            throw error;
        }
    }
    async findById(id) {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .where({ clinicianid: id })
                .first();
        }
        catch (error) {
            console.error('Clinician payment find error:', error);
            throw error;
        }
    }
    async findByClinicianId(clinicianId) {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .where({ clinicianid: clinicianId })
                .orderBy('created_on', 'desc');
        }
        catch (error) {
            console.error('Clinician payment find by clinician error:', error);
            throw error;
        }
    }
    async findByClinicianIdWithBasicInfo(clinicianId) {
        try {
            const conn = await this.connection;
            return await conn('clinicianpaymentinfo')
                .join('clinicianbasicinfo', 'clinicianpaymentinfo.clinicianid', '=', 'clinicianbasicinfo.id')
                .select('clinicianpaymentinfo.*', 'clinicianbasicinfo.name', 'clinicianbasicinfo.email', 'clinicianbasicinfo.phone')
                .where('clinicianpaymentinfo.clinicianid', clinicianId)
                .orderBy('clinicianpaymentinfo.created_on', 'desc');
        }
        catch (error) {
            console.error('Clinician payment find with basic info error:', error);
            throw error;
        }
    }
    async update(clinicianid, updates) {
        try {
            const conn = await this.connection;
            const existingRecord = await conn('clinicianpaymentinfo').where({ clinicianid })
                .first();
            if (!existingRecord) {
                const clinicianBasicInfo = await conn('clinicianbasicinfo').where({ id: clinicianid }).first();
                if (clinicianBasicInfo) {
                    const newPaymentData = {
                        clinicianid,
                        module: updates.module || 'default',
                        created_on: new Date(),
                        updated_on: new Date(),
                    };
                    const created = await this.create(newPaymentData, conn);
                    return created;
                }
                return false;
            }
            console.log('Existing record:', existingRecord);
            const result = await conn('clinicianpaymentinfo')
                .where({ clinicianid: updates.clinicianid })
                .update(updates);
            console.log('Update result:', result, updates);
            return result > 0;
        }
        catch (error) {
            console.error('Clinician payment update error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const conn = await this.connection;
            const result = await conn('clinicianpaymentinfo')
                .where({ id })
                .delete();
            return result > 0;
        }
        catch (error) {
            console.error('Clinician payment delete error:', error);
            throw error;
        }
    }
}
exports.ClinicianPaymentRepository = ClinicianPaymentRepository;
