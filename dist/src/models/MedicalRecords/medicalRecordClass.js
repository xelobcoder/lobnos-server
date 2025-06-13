"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class PrimeMedicalRecords {
    async createRecord(tenantId, record) {
        const { complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, patientid, consulationby, record_type, associatedTransactionid = null } = record;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_create, [
            complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, record_type, patientid, consulationby, associatedTransactionid
        ]);
        return result.insertId;
    }
    static findTransactionAssociatedConsulation(tenantId, transactionid) {
        return new TiifuWorkingClass_1.TiifuWorkingClass("medicalrecords").findMany(tenantId, "associatedTransactionid", transactionid);
    }
    async getRecordById(tenantId, id) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_getById, [id]);
        return rows[0] || null;
    }
    async isClinicianConsulation(tenantId, consulationid, clinicianid) {
        const consulation = await this.getRecordById(tenantId, consulationid);
        if (consulation) {
            const { consulationby } = consulation;
            return consulationby === clinicianid;
        }
        return false;
    }
    async updateRecord(tenantId, consultationid, updates) {
        const { consulationby } = updates;
        const isConsultant = await this.isClinicianConsulation(tenantId, consultationid, consulationby);
        if (isConsultant) {
            const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
            const values = Object.values(updates);
            const query = `UPDATE medicalrecords SET ${fields} WHERE id = ?`;
            return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, query, [...values, consultationid]));
        }
        return "You do not have permission to delete this resources" /* OperationsFailures.dontHavePermission */;
    }
    async deleteRecord(tenantId, id) {
        await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_delete, [id]);
    }
    async getAllRecords(tenantId, page = 1, count = 10) {
        const rows = page && count ? await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_medical_records_getAll, [], tenantId) : await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_getAll);
        return rows;
    }
    static async getPendingConsultationServices(tenantId, page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection("dboservices")
            .join("roles", "roles.employeeid", "dboservices.employeeid")
            .join("billing", "billing.billingid", "dboservices.billingid")
            .join("new_patients", "new_patients.patientid", "billing.patientid")
            .select("dboservices.serviceid", "dboservices.billingid", "roles.username", "new_patients.*")
            .where({
            serviceCategory: "SERVICES",
            categoryTrackId: 5,
            trackId: 1
        })
            .limit(pageSize)
            .offset(offset);
        return result;
    }
}
exports.default = PrimeMedicalRecords;
