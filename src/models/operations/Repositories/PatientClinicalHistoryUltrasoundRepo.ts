import KnexConnection from "../../../database/KnexConnections";


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
     constructor(tenantId: number) {
          this.knexConnection = KnexConnection(tenantId);
     }

     async createHistory(historyData: Omit<PatientClinicalHistoryUltrasound, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
          const connection = await this.knexConnection;
          const result = await connection(this.tablename)
               .insert(historyData)
               .onConflict('ascensionid')
               .merge()
               .returning('id');
          return Array.isArray(result) && result.length > 0
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

     async updateHistory(id: number, updateData: Partial<Omit<PatientClinicalHistoryUltrasound, 'id' | 'ascensionid' | 'created_at'>>): Promise<number> {
          const connection = await this.knexConnection
          return await connection(this.tablename)
               .where({ id })
               .update(updateData);
     }

     async deleteHistory(id: number): Promise<number> {
          const connection = await this.knexConnection
          return await connection(this.tablename)
               .where({ id })
               .del();
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

     async upsertHistory(ascensionid: number, clinical_history: string): Promise<number> {
          const connection = await this.knexConnection
          const updatedCount = await connection(this.tablename)
               .where({ ascensionid })
               .update({ clinical_history, updated_at: connection.fn.now() });

          if (updatedCount === 0) {
               const result = await connection(this.tablename)
                    .insert({ ascensionid, clinical_history })
                    .returning('id');
               return result[0].id;
          }
          return ascensionid;
     }
}