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
          filters?: { testid?: number; ascensionid?: number; billingid?: number }
     ): Promise<{ data: LoggingCriticalValueAlert[]; total: number; page: number; pageSize: number }> {
          try {
               const conn = await this.connection;
               let baseQuery = conn(this.tableName)
                    .innerJoin('test_panels', `${this.tableName}.testid`, 'test_panels.id')
                    .select(`${this.tableName}.*`, 'test_panels.name as testname');

               if (filters) {
                    if (filters.testid !== undefined) baseQuery = baseQuery.where('testid', filters.testid);
                    if (filters.ascensionid !== undefined) baseQuery = baseQuery.where('ascensionid', filters.ascensionid);
                    if (filters.billingid !== undefined) baseQuery = baseQuery.where('billingid', filters.billingid);
               }
               // Add sorting by created date
               baseQuery = baseQuery.orderBy(`${this.tableName}.createdOn`, sortby);

               const totalResultRaw = await baseQuery.clone().count('* as count').first();
               const total = totalResultRaw ? Number((totalResultRaw as any).count) : 0;
               const data = await baseQuery
                    .clone()
                    .limit(pageSize)
                    .offset((page - 1) * pageSize);
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



