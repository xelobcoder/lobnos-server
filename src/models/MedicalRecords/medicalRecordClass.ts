import { TiifuWorkingClass } from '../../database/TiifuWorkingClass';
import { paginationQuery, promisifyQuery, rowAffected } from '../../hooks/helper';
import { OperationsFailures } from '../operations/types';
import {
    q_medical_records_create,
    q_medical_records_getById,
    q_medical_records_delete,
    q_medical_records_getAll
} from './queries';
import KnexConnection from '../../database/KnexConnections';

type RecordType = 'Old Record' | 'In-Process (Today)' | 'IPD Review' | 'OPD New Cases';

export interface MedicalRecord {
    complaints: string;
    consultationid?: number;
    associatedTransactionid: number | null;
    consulationby: number;
    hpc: string;
    patientid: number;
    pmh: string;
    sh: string;
    odq: string;
    dhx: string;
    se: string;
    fh: string;
    obsGynecHistory: string;
    oe: string;
    record_type: RecordType;
}

interface UpdateMedicalRecord extends Partial<MedicalRecord> { }

export default class PrimeMedicalRecords {
    async createRecord(tenantId: number, record: MedicalRecord): Promise<number> {
        const {
            complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, patientid, consulationby, record_type, associatedTransactionid = null
        } = record;

        const result = await promisifyQuery(tenantId, q_medical_records_create, [
            complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, record_type, patientid, consulationby, associatedTransactionid
        ]);

        return result.insertId;
    }

    static findTransactionAssociatedConsulation(tenantId: number, transactionid: number): Promise<MedicalRecord[] | []> {
        return new TiifuWorkingClass("medicalrecords").findMany(tenantId, "associatedTransactionid", transactionid);
    }

    async getRecordById(tenantId: number, id: number): Promise<MedicalRecord | null> {
        const rows: any[] = await promisifyQuery(tenantId, q_medical_records_getById, [id]);
        return rows[0] || null;
    }

    async isClinicianConsulation(tenantId: number, consulationid: number, clinicianid: number): Promise<boolean> {
        const consulation: MedicalRecord | null = await this.getRecordById(tenantId, consulationid);
        if (consulation) {
            const { consulationby } = consulation;
            return consulationby === clinicianid;
        }
        return false;
    }

    async updateRecord(tenantId: number, consultationid: number, updates: UpdateMedicalRecord): Promise<boolean | string> {
        const { consulationby } = updates;

        const isConsultant = await this.isClinicianConsulation(tenantId, consultationid, consulationby);

        if (isConsultant) {
            const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
            const values = Object.values(updates);

            const query = `UPDATE medicalrecords SET ${fields} WHERE id = ?`;

            return rowAffected(await promisifyQuery(tenantId, query, [...values, consultationid]));
        }
        return OperationsFailures.dontHavePermission;
    }


    async deleteRecord(tenantId: number, id: number): Promise<void> {
        await promisifyQuery(tenantId, q_medical_records_delete, [id]);
    }

    async getAllRecords(tenantId: number, page: number = 1, count: number = 10): Promise<MedicalRecord[]> {
        const rows = page && count ? await paginationQuery({ count, page }, q_medical_records_getAll, [], tenantId) : await promisifyQuery(tenantId, q_medical_records_getAll);
        return rows;
    }


    static async getPendingConsultationServices(tenantId: number, page = 1, pageSize = 10, sortby: 'ASC' | 'DESC') {
        const offset = (page - 1) * pageSize;
        const connection = await KnexConnection(tenantId)
        const result = await connection("dboservices")
            .join("roles", "roles.employeeid", "dboservices.employeeid")
            .join("billing", "billing.billingid", "dboservices.billingid")
            .join("new_patients", "new_patients.patientid", "billing.patientid")
            .select(
                "dboservices.serviceid",
                "dboservices.billingid",
                "dboservices.serviceAddedOn",
                "roles.username",
                "new_patients.*"
            )
            .where({
                serviceCategory: "SERVICES",
                categoryTrackId: 5,
                trackId: 1
            })
            .orderBy("dboservices.serviceid", sortby)
            .limit(pageSize)
            .offset(offset);
        return result;
    }



}

