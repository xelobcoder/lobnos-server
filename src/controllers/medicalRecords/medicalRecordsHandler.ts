import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { clinicalRun } from '../consultation/routes';
import { ConsultationService } from '../../models/consultation/ConsultationService';
import { practitioner, patientScope, manager } from '../../models/consultation/ConsultationPolicy';
import { clinicalError } from '../../models/consultation/ConsultationSchema';
const adapt = (operation: any, shape: any) => (req: any, res: any) => clinicalRun(async (db, a, r) => operation(new ConsultationService(db), db, a, r))(req, { setHeader: (...args: any[]) => res.setHeader(...args), status: (code: number) => res.status(code), json: (body: any) => body.success ? res.json(shape(body.data)) : res.json(body) });
export const createAConsultationRecord = adapt(async (s: any, _db: any, a: any, r: any) => { const row = await s.start(a, { patientid: Number(r.body.patientid), requestKey: r.body.requestKey, associatedTransactionid: r.body.associatedTransactionid }); return row; }, (row: any) => ({ status: true, recordId: row.id, message: 'Draft created' }));
export const getConsultationRecordById = adapt((s: any, _db: any, a: any, r: any) => s.detail(a, Number(r.query.consultationid)), (row: any) => row);
export const updateAConsultationRecord = adapt((s: any, _db: any, a: any, r: any) => s.save(a, Number(r.query.consultationid), r.body), (row: any) => ({ status: true, data: row }));
export const deleteAConsultationRecord = adapt((s: any, _db: any, a: any, r: any) => s.remove(a, Number(r.query.consultationid), Number(r.body.revision)), () => ({ status: true }));
export const getAllConsultationRecords = adapt((s: any, _db: any, a: any, r: any) => s.list(a, r.query), (result: any) => result.data);
export const getAllPendingConsultationRecords = adapt(async (_s: any, db: any, a: any, r: any) => { const access = manager(a) ? null : await practitioner(db, a); let q = db('dboservices as ds').join('billing as b', 'b.billingid', 'ds.billingid').join('new_patients as np', 'np.patientid', 'b.patientid').where({ 'ds.serviceCategory': 'SERVICES', 'ds.categoryTrackId': 5, 'ds.trackId': 1 }).whereRaw('COALESCE(ds.isDeleted,0)=0').whereNotExists(function (this: any) { this.select('mr.id').from('medicalrecords as mr').whereRaw('mr.associatedTransactionid=ds.serviceid').where('mr.encounter_status', 'signed').whereNull('mr.deleted_at'); }); if (a.branch != null)
    q.where('b.branchid', a.branch); if (access)
    q = patientScope(q, db, a, access); const page = Math.max(1, Number(r.query.page) || 1), count = Math.min(100, Math.max(1, Number(r.query.count) || 20)); return q.select('ds.serviceid', 'b.billingid', 'np.patientid', 'np.firstname', 'np.lastname', 'np.fullpatientid').orderBy('ds.serviceid', 'desc').limit(count).offset((page - 1) * count); }, (rows: any) => rows);
