import KnexConnection from "../../../database/KnexConnections";
import ImagingResultAuditRepository from "../imaging/ImagingResultAuditRepository";


interface PatientClinicalHistoryUltrasound {
     id: number;
     ascensionid: number;
     clinical_history: string | null;
     created_at: Date;
     updated_at: Date;
}

export default class PatientClinicalHistoryUltrasoundRepository {
     private tablename: string = 'patient_clinical_history_ultrasound';
     private knexConnection: any
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.knexConnection = KnexConnection(tenantId);
     }

     /** Records a clinical-history change in the imaging audit trail inside the caller's transaction. */
     private async audit(trx: any, ascensionid: number, id: number | null, previous: string | null | undefined, next: string | null | undefined, action: 'CREATE' | 'UPDATE' | 'DELETE', actor?: number | null) {
          if (action === 'UPDATE' && (previous ?? '') === (next ?? '')) return;
          await ImagingResultAuditRepository.record(trx, [{
               ascensionid,
               entityType: 'CLINICAL_HISTORY',
               entityId: id,
               action,
               fieldName: 'clinical_history',
               oldValue: action === 'CREATE' ? null : previous ?? '',
               newValue: action === 'DELETE' ? null : next ?? '',
               employeeid: actor ?? null,
          }]);
     }

     async createHistory(historyData: Omit<PatientClinicalHistoryUltrasound, 'id' | 'created_at' | 'updated_at'>, actor?: number | null): Promise<boolean> {
          const connection = await this.knexConnection;
          await ImagingResultAuditRepository.ensureTable(this.tenantId);
          return await connection.transaction(async (trx: any) => {
               const existing = await trx(this.tablename).where({ ascensionid: historyData.ascensionid }).forUpdate().first();
               const result = await trx(this.tablename)
                    .insert(historyData)
                    .onConflict('ascensionid')
                    .merge()
                    .returning('id');
               await this.audit(trx, historyData.ascensionid, existing?.id ?? null, existing?.clinical_history, historyData.clinical_history, existing ? 'UPDATE' : 'CREATE', actor);
               return Array.isArray(result) && result.length > 0;
          });
     }
     async getHistoryById(id: number): Promise<PatientClinicalHistoryUltrasound | undefined> {
          const connection = await this.knexConnection
          return await connection(this.tablename)
               .where({ id })
               .first();
     }

     async getHistoryByAscensionId(ascensionid: number): Promise<PatientClinicalHistoryUltrasound | undefined> {
          const connection = await this.knexConnection
          return await connection(this.tablename)
               .where({ ascensionid })
               .first();
     }

     async updateHistory(id: number, updateData: Partial<Omit<PatientClinicalHistoryUltrasound, 'id' | 'ascensionid' | 'created_at'>>, actor?: number | null): Promise<number> {
          const connection = await this.knexConnection
          await ImagingResultAuditRepository.ensureTable(this.tenantId);
          return await connection.transaction(async (trx: any) => {
               const existing = await trx(this.tablename).where({ id }).forUpdate().first();
               if (!existing) return 0;
               const affected = await trx(this.tablename).where({ id }).update(updateData);
               if (affected > 0 && updateData.clinical_history !== undefined) {
                    await this.audit(trx, existing.ascensionid, id, existing.clinical_history, updateData.clinical_history, 'UPDATE', actor);
               }
               return affected;
          });
     }

     async deleteHistory(id: number, actor?: number | null): Promise<number> {
          const connection = await this.knexConnection
          await ImagingResultAuditRepository.ensureTable(this.tenantId);
          return await connection.transaction(async (trx: any) => {
               const existing = await trx(this.tablename).where({ id }).forUpdate().first();
               if (!existing) return 0;
               const affected = await trx(this.tablename).where({ id }).del();
               if (affected > 0) await this.audit(trx, existing.ascensionid, id, existing.clinical_history, null, 'DELETE', actor);
               return affected;
          });
     }

     async getAllHistories(): Promise<PatientClinicalHistoryUltrasound[]> {
          const connection = await this.knexConnection
          return await connection(this.tablename)
               .select('*');
     }

     async getHistoriesByAscensionIds(ascensionIds: number[]): Promise<PatientClinicalHistoryUltrasound[]> {
          if (ascensionIds && ascensionIds.length > 0) {
               const connection = await this.knexConnection
               return await connection(this.tablename)
                    .whereIn('ascensionid', ascensionIds);
          }
          return [];
     }

     async upsertHistory(ascensionid: number, clinical_history: string, actor?: number | null): Promise<number> {
          const connection = await this.knexConnection
          await ImagingResultAuditRepository.ensureTable(this.tenantId);
          return await connection.transaction(async (trx: any) => {
               const existing = await trx(this.tablename).where({ ascensionid }).forUpdate().first();
               const updatedCount = await trx(this.tablename)
                    .where({ ascensionid })
                    .update({ clinical_history, updated_at: trx.fn.now() });

               if (updatedCount === 0) {
                    const result = await trx(this.tablename)
                         .insert({ ascensionid, clinical_history })
                         .returning('id');
                    const insertedId = result[0]?.id ?? result[0];
                    await this.audit(trx, ascensionid, insertedId, null, clinical_history, 'CREATE', actor);
                    return insertedId;
               }
               await this.audit(trx, ascensionid, existing?.id ?? null, existing?.clinical_history, clinical_history, 'UPDATE', actor);
               return ascensionid;
          });
     }
}