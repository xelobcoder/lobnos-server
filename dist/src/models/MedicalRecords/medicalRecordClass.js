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
        const { progress_report, patientid, consulationby, record_type, associatedTransactionid = null } = record;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_create, [
            progress_report, record_type, consulationby, patientid, associatedTransactionid
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
        try {
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
        catch (err) {
            console.error("Error updating record:", err);
            return "The type of request body is invalid" /* OperationsFailures.invalidRequestBodyType */;
        }
    }
    async deleteRecord(tenantId, id) {
        await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_medical_records_delete, [id]);
    }
    async getAllRecords(tenantId, page = 1, patientid, count = 10, search) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const offset = (page - 1) * count;
        let query = connection('medicalrecords as mr')
            .leftJoin('roles as rr', 'rr.employeeid', 'mr.consulationby')
            .leftJoin('new_patients as np', 'np.patientid', 'mr.patientid')
            .select('mr.*', 'np.*', 'rr.username as consultationby', 'rr.employeeid');
        if (patientid) {
            query = query.where('np.patientid', patientid);
        }
        if (search) {
            query = query.where(function () {
                this.where('mr.progress_report', 'like', `%${search}%`)
                    .orWhere('np.firstname', 'like', `%${search}%`)
                    .orWhere('np.lastname', 'like', `%${search}%`);
            });
        }
        // Apply pagination
        if (page && count) {
            query = query.limit(count).offset(offset);
        }
        console.log("Generated SQL Query:", query.toString()); // Debugging line to check the generated SQL query
        return await query;
    }
    static async getPendingConsultationServices(tenantId, page = 1, pageSize = 10, sortby) {
        const offset = (page - 1) * pageSize;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection("dboservices")
            .join("roles", "roles.employeeid", "dboservices.employeeid")
            .join("billing", "billing.billingid", "dboservices.billingid")
            .join("new_patients", "new_patients.patientid", "billing.patientid")
            .select("dboservices.serviceid", "dboservices.billingid", "dboservices.serviceAddedOn", "roles.username", "new_patients.*")
            .where({
            serviceCategory: "SERVICES",
            categoryTrackId: 5,
            trackId: 1
        })
            .whereNotExists(function () {
            this.select(connection.raw('1'))
                .from('medicalrecords as mr')
                .whereRaw('mr.associatedTransactionid = dboservices.serviceid');
        })
            .orderBy("dboservices.serviceid", sortby)
            .limit(pageSize)
            .offset(offset);
        return result;
    }
}
exports.default = PrimeMedicalRecords;
