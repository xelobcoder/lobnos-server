import type { AuthUser } from '../../middleware/authority';
import { consultationDb, clinicalError } from '../consultation/ConsultationSchema';
import { ConsultationService } from '../consultation/ConsultationService';
export default class VitalSign {
    constructor(public patientid: number) { }
    private requireActor(tenantId: number, actor?: AuthUser) { if (!actor || actor.tenantId !== tenantId)
        clinicalError('Authenticated clinical access required', 403); return actor; }
    async createNewVitalSignChart(tenantId: number, formData: any, actor?: AuthUser) { const a = this.requireActor(tenantId, actor); await new ConsultationService(await consultationDb(tenantId)).recordVitals(a, this.patientid, formData); return true; }
    async updateVitalSignChart(tenantId: number, vitalSignId: number, formData: any, actor?: AuthUser) { const a = this.requireActor(tenantId, actor); await new ConsultationService(await consultationDb(tenantId)).recordVitals(a, this.patientid, formData, vitalSignId); return true; }
    async deleteVitalSignChart(_tenantId: number, _id: number) { clinicalError('Vital signs are retained in the clinical record. Use an audited correction.', 403); }
    async getPatientVitalSignList(tenantId: number, count: number, page: number, filterFrom: Date | null, filterTo: Date | null, actor?: AuthUser) { const a = this.requireActor(tenantId, actor); return (await new ConsultationService(await consultationDb(tenantId)).vitals(a, this.patientid, { count, page, filterFrom: filterFrom?.toISOString().slice(0, 10), filterTo: filterTo?.toISOString().slice(0, 10) })).data; }
}
