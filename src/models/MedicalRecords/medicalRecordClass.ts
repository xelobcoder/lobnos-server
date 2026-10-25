import type { AuthUser } from '../../middleware/authority';
import { consultationDb, clinicalError } from '../consultation/ConsultationSchema';
import { ConsultationService } from '../consultation/ConsultationService';
import { TiifuWorkingClass } from '../../database/TiifuWorkingClass';
import { customError, paginationQuery, promisifyQuery, rowAffected } from '../../hooks/helper';
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
    id?: number;
    progress_report: string;
    record_type: RecordType;
    created_at?: string;
    consulationby: number;
    patientid: number;
    associatedTransactionid: number | null;
}

interface UpdateMedicalRecord extends Partial<MedicalRecord> { }

export default class PrimeMedicalRecords {
    async createRecord(tenantId: number, record: MedicalRecord): Promise<number> {
        const {
            progress_report, patientid, consulationby, record_type, associatedTransactionid = null
        } = record;

        const result = await promisifyQuery(tenantId, q_medical_records_create, [
            progress_report, record_type, consulationby, patientid, associatedTransactionid
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

    async updateRecord(tenantId:number,consultationid:number,updates:any,actor?:AuthUser){if(!actor||actor.tenantId!==tenantId)clinicalError('An authenticated clinical actor is required',403);await new ConsultationService(await consultationDb(tenantId)).save(actor,consultationid,updates);return true;}
    async deleteRecord(tenantId:number,id:number,actor?:AuthUser,revision?:number):Promise<void>{if(!actor||actor.tenantId!==tenantId)clinicalError('An authenticated clinical actor is required',403);await new ConsultationService(await consultationDb(tenantId)).remove(actor,id,revision!);}

    async getAllRecords(tenantId: number, page: number = 1, patientid?: number, count: number = 10, search?: number | string): Promise<MedicalRecord[]> {
        const connection = await KnexConnection(tenantId);
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



        return await query;
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

