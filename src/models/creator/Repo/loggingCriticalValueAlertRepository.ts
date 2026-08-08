import KnexConnection from "../../../database/KnexConnections";
import logger from "../../../hooks/logger";

export default class LoggingCriticalValueAlertRepository {
     private tenantId: number;
     private tableName: string;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.tableName = 'loggingcriticalvaluealert';
          this.connection = KnexConnection(tenantId);
     }

     private normalizeSeenFilter(value?: number | string | boolean | null): 0 | 1 | undefined {
          if (value === undefined || value === null || value === '') return undefined;

          if (typeof value === 'number') {
               return value === 1 ? 1 : value === 0 ? 0 : undefined;
          }

          if (typeof value === 'boolean') {
               return value ? 1 : 0;
          }

          const normalized = String(value).trim().toLowerCase();
          if (['1', 'true', 'yes', 'seen'].includes(normalized)) return 1;
          if (['0', 'false', 'no', 'unseen'].includes(normalized)) return 0;

          return undefined;
     }

     private mapAlertsWithPatientInfo(rows: any[]): LoggingCriticalValueAlert[] {
          return (Array.isArray(rows) ? rows : []).map((row: any) => {
               const patientInfo = row.patientid || row.fullpatientid || row.patient_name || row.designation
                    ? {
                         patientid: row.patientid ?? null,
                         fullpatientid: row.fullpatientid ?? null,
                         patientName: row.patient_name ?? null,
                         designation: row.designation ?? null,
                    }
                    : null;

               const { patientid, fullpatientid, firstname, middlename, lastname, gender, mobile_number, dob, designation, patient_name, ...alertRow } = row;

               return {
                    ...alertRow,
                    ...(patientInfo ? { patientInfo } : {})
               } as LoggingCriticalValueAlert & { patientInfo?: any } as LoggingCriticalValueAlert;
          });
     }

     async findUnseenByBillingId(billingid: number): Promise<LoggingCriticalValueAlert[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .where({ billingid })
                    .andWhere('isSeen', 0);
          } catch (error) {
               logger.error('Find unseen LoggingCriticalValueAlert by billingid error:', error);
               throw error;
          }
     }

     async findUnseenPaginated(
          page: number = 1,
          pageSize: number = 10,
          sortby: 'ASC' | 'DESC' = 'DESC'
     ): Promise<{ data: LoggingCriticalValueAlert[]; total: number; page: number; pageSize: number }> {
          try {
               const conn = await this.connection;
               let baseQuery = conn(this.tableName)
                    .leftJoin('billing', 'billing.billingid', `${this.tableName}.billingid`)
                    .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
                    .where('isSeen', 0)
                    .andWhere(function (this: any) {
                         this.whereNotNull('billingid').orWhereNotNull('ascensionid');
                    })
                    .select(
                         `${this.tableName}.*`,
                         'new_patients.patientid',
                         'new_patients.fullpatientid',
                         conn.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) as patient_name"),
                         'new_patients.designation'
                    )
                    .orderBy(`${this.tableName}.createdOn`, sortby);

               const totalResultRaw = await baseQuery.clone().count('* as count').first();
               const total = totalResultRaw ? Number((totalResultRaw as any).count) : 0;
               const rows = await baseQuery.clone().limit(pageSize).offset((page - 1) * pageSize);
               const data = this.mapAlertsWithPatientInfo(rows);
               return {
                    data,
                    total,
                    page,
                    pageSize
               };
          } catch (error) {
               logger.error('Find unseen LoggingCriticalValueAlert paginated error:', error);
               throw error;
          }
     }

     async markAsSeen(crkeyId: number, employeeId: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .where({ crkeyId })
                    .update({
                         isSeen: 1,
                         isSeenBy: employeeId
                    });
          } catch (error) {
               logger.error('Error marking alert as seen:', error);
               throw error;
          }
     }

     async createAlert(alertData: Omit<LoggingCriticalValueAlert, 'crKeyId'>): Promise<number> {
          try {
               const conn = await this.connection;
               const [result] = await conn(this.tableName)
                    .insert({
                         billingid: alertData.billingid,
                         testid: alertData.testid,
                         statement: alertData.statement,
                         createdBy: alertData.createdBy,
                         isSeen: 0
                    });
               return result;
          } catch (error) {
               logger.error('Error creating critical value alert:', error);
               throw error;
          }
     }

     async findAllPaginated(
          page: number = 1,
          pageSize: number = 20,
          sortby: 'ASC' | 'DESC' = 'DESC',
          filters?: { testid?: number; ascensionid?: number; billingid?: number; isSeen?: number | string | boolean | null }
     ): Promise<{ data: LoggingCriticalValueAlert[]; total: number; page: number; pageSize: number }> {
          try {
               const conn = await this.connection;
               let baseQuery = conn(this.tableName)
                    .leftJoin('billing', 'billing.billingid', `${this.tableName}.billingid`)
                    .leftJoin('new_patients', 'new_patients.patientid', 'billing.patientid')
                    .innerJoin('test_panels', `${this.tableName}.testid`, 'test_panels.id')
                    .select(
                         `${this.tableName}.*`,
                         'test_panels.name as testname',
                         'new_patients.patientid',
                         'new_patients.fullpatientid',
                         conn.raw("CONCAT_WS(' ', new_patients.firstname, new_patients.middlename, new_patients.lastname) as patient_name"),
                         'new_patients.designation'
                    );

               if (filters) {
                    if (filters.testid !== undefined) baseQuery = baseQuery.where('testid', filters.testid);
                    if (filters.ascensionid !== undefined) baseQuery = baseQuery.where('ascensionid', filters.ascensionid);
                    if (filters.billingid !== undefined) baseQuery = baseQuery.where('billingid', filters.billingid);

                    const normalizedSeenFilter = this.normalizeSeenFilter(filters.isSeen);
                    if (normalizedSeenFilter !== undefined) {
                         baseQuery = baseQuery.where(`${this.tableName}.isSeen`, normalizedSeenFilter == 1 ? 1 : null);
                    }
               }
               baseQuery = baseQuery.orderBy(`${this.tableName}.createdOn`, sortby);

               const totalResultRaw = await baseQuery.clone().count('* as count').first();
               const total = totalResultRaw ? Number((totalResultRaw as any).count) : 0;
               const rows = await baseQuery
                    .clone()
                    .limit(pageSize)
                    .offset((page - 1) * pageSize);
               const data = this.mapAlertsWithPatientInfo(rows);
               return {
                    data,
                    total,
                    page,
                    pageSize
               };
          } catch (error) {
               logger.error('Find all LoggingCriticalValueAlert paginated error:', error);
               throw error;
          }
     }

     async findAll(): Promise<LoggingCriticalValueAlert[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName).select('*');
          } catch (error) {
               logger.error('Find all LoggingCriticalValueAlert error:', error);
               throw error;
          }
     }

     async findByTestId(testid: number): Promise<LoggingCriticalValueAlert[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .where({ testid })
                    .andWhere('isSeen', 0);
          } catch (error) {
               logger.error('Error finding alerts by testid:', error);
               throw error;
          }
     }


     async findById(crkeyId: number): Promise<LoggingCriticalValueAlert | null> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tableName)
                    .where({ crkeyId })
                    .first();
               return result || null;
          } catch (error) {
               logger.error('Error finding alert by crkeyId:', error);
               throw error;
          }
     }
     async update(crkeyId: number, updateData: Partial<LoggingCriticalValueAlert>): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .where({ crkeyId })
                    .update(updateData);
          } catch (error) {
               logger.error('Error updating alert:', error);
               throw error;
          }
     }

     async delete(crkeyId: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .where({ crkeyId })
                    .delete();
          } catch (error) {
               logger.error('Error deleting alert:', error);
               throw error;
          }
     }
}



