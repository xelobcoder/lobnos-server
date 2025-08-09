import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";

export interface ResultPrintingTracking {
     trackid?: number;
     ascensionid: number;
     employeeid: number;
     action: 'view' | 'printed';
     count?: number;
     actionon?: string;
}

export default class ResultPrintingTrackingRepository {
     private tenantId: number;
     private tableName: string;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.tableName = 'resultprintingtracking';
          this.connection = KnexConnection(tenantId);
     }

     async create(entry: Omit<ResultPrintingTracking, 'trackid' | 'actionon' | 'count'>): Promise<number> {
          try {
               if (entry.action !== 'view' && entry.action !== 'printed') {
                    throw new Error('Invalid action. Only "view" or "printed" are allowed.');
               }
               if (typeof entry.ascensionid !== 'number' || typeof entry.employeeid !== 'number') {
                    throw new Error('ascensionid and employeeid must be numbers.');
               }
               const conn = await this.connection;
               const filteredEntry = {
                    ascensionid: entry.ascensionid,
                    employeeid: entry.employeeid,
                    action: entry.action,
                    actionon: conn.fn.now()
               };
               const [id] = await conn(this.tableName).insert(filteredEntry);
               return id;
          } catch (error) {
               logger.error('Error creating result printing tracking entry:', error);
               throw error;
          }
     }

     async countByActionAndUser(ascensionid: number, employeeid: number, action: 'view' | 'printed'): Promise<number> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tableName)
                    .where({ ascensionid, employeeid, action })
                    .count('trackid as count');
               return result && result[0] ? Number((result[0] as any).count) : 0;
          } catch (error) {
               logger.error('Error counting result printing tracking entries:', error);
               throw error;
          }
     }


     async findAllByAscensionId(
          ascensionid: number,
          page: number = 1,
          count: number = 20,
          sortby: 'ASC' | 'DESC' = 'DESC'
     ): Promise<any[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                    .select(
                         `${this.tableName}.*`,
                         'roles.username as employee_name',
                         'roles.role as employee_role'
                    )
                    .where(`${this.tableName}.ascensionid`, ascensionid)
                    .orderBy(`${this.tableName}.actionon`, sortby)
                    .limit(count)
                    .offset((page - 1) * count);
          } catch (error) {
               logger.error('Error finding result printing tracking by ascensionid:', error);
               throw error;
          }
     }


     async findAll(
          page: number = 1,
          count: number = 20,
          sortby: 'ASC' | 'DESC' = 'DESC'
     ): Promise<any[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName)
                    .leftJoin('roles', `${this.tableName}.employeeid`, 'roles.employeeid')
                    .select(
                         `${this.tableName}.*`,
                         'roles.username as employee_name',
                         'roles.role as employee_role'
                    )
                    .orderBy(`${this.tableName}.actionon`, sortby)
                    .limit(count)
                    .offset((page - 1) * count);
          } catch (error) {
               logger.error('Error fetching all result printing tracking entries:', error);
               throw error;
          }
     }

     async delete(trackid: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName).where({ trackid }).delete();
          } catch (error) {
               logger.error('Error deleting result printing tracking entry:', error);
               throw error;
          }
     }
}
