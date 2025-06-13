import KnexConnection from "../../../database/KnexConnections";
import { OperationsFailures } from "../../operations/types";

interface SalesSession {
     sessionid: number;
     sessiondate: Date;
     session_started_by: number;
     sessionendedon: Date | null;
     openingamount: number;
     amountreceivedby: number;
     validatedby:number;
     handingoveramount:number;
     branchid: number;
}

interface PaginatedResponse<T> {
     data: T[];
     total: number;
     page: number;
     totalPages: number;
}

export class SalesSessionRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async canCreateSession(date: Date, branchId: number): Promise<boolean> {
          try {
              const conn = await this.connection;
              const result = await conn('salessessionmanager')
                  .where(conn.raw('DATE(sessiondate) = DATE (?)', [date]))
                  .andWhere('branchid', branchId)
                  .andWhere('sessionendedon', null)
                  .first();

              return !result;
          } catch (error) {
              console.error('Check can create session error:', error);
              throw error;
          }
      }

     async create(sessionData: Omit<SalesSession, 'sessionid'>):Promise<boolean|string> {
          try {
               const { sessiondate, branchid } = sessionData;
               const canCreate = await this.canCreateSession(sessiondate, branchid);
 
               if (!canCreate) {
                   return OperationsFailures.cannotCreateSessionForDate;
               }
 
               const conn = await this.connection;
               const result = await conn('salessessionmanager').insert(sessionData);
               return result[0] ? true : false;
          } catch (error) {
               console.error('Sales session creation error:', error);
               throw error;
          }
     }

     async update(sessionId: number, updates: Partial<SalesSession>) {
          try {
               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({ sessionid: sessionId })
                    .update(updates);
          } catch (error) {
               console.error('Sales session update error:', error);
               throw error;
          }
     }

     async findById(sessionId: number) {
          try {
               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({ sessionid: sessionId })
                    .first();
          } catch (error) {
               console.error('Sales session find error:', error);
               throw error;
          }
     }

     async findActiveSession(userId: number, branchId: number) {
          try {
               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({
                         session_started_by: userId,
                         branchid: branchId,
                         sessionendedon: null
                    })
                    .first();
          } catch (error) {
               console.error('Active session find error:', error);
               throw error;
          }
     }

     async findSessionsByDateRange(startDate: Date, endDate: Date, branchId?: number): Promise<SalesSession[]> {
          try {
               const conn = await this.connection;
               console.log(startDate, endDate, branchId);

               let query = conn('salessessionmanager')
                    .where(conn.raw('DATE(sessiondate)'), '>=', startDate.toISOString().split('T')[0])
                    .where(conn.raw('DATE(sessiondate)'), '<=', endDate.toISOString().split('T')[0])
                    .orderBy('sessiondate', 'desc');

               if (branchId !== undefined) {
                    query = query.andWhere('branchid', branchId);
               }

               return await query;
          } catch (error) {
               console.error('Sessions find by date range error:', error);
               throw error;
          }
     }

     async findSessionsPaginated(
          page: number = 1,
          limit: number = 20,
          branchId?: number
      ): Promise<PaginatedResponse<SalesSession & { 
          started_by_username: string, 
          received_by_username: string,
          validated_by_username: string,
          branchname: string 
      }>> {
          try {
              const conn = await this.connection;
              const offset = (page - 1) * limit;
      
              let countQuery = conn('salessessionmanager').count('sessionid as count');
              if (branchId !== undefined) {
                  countQuery = countQuery.where('branchid', branchId);
              }
              const [total] = await countQuery;
      
              let dataQuery = conn('salessessionmanager as s')
                  .leftJoin('roles as r1', 's.session_started_by', 'r1.employeeid')
                  .leftJoin('roles as r2', 's.amountreceivedby', 'r2.employeeid')
                  .leftJoin('roles as r3', 's.validatedby', 'r3.employeeid')
                  .leftJoin('branch as b', 's.branchid', 'b.branchid')
                  .select(
                      's.*',
                      'r1.username as started_by_username',
                      'r2.username as received_by_username',
                      'r3.username as validated_by_username',
                      'b.name as branchname'
                  )
                  .orderBy('s.sessiondate', 'desc')
                  .limit(limit)
                  .offset(offset);
      
              if (branchId !== undefined) {
                  dataQuery = dataQuery.where('s.branchid', branchId);
              }
      
              const data = await dataQuery;
      
              return {
                  data,
                  total: Number(total.count),
                  page,
                  totalPages: Math.ceil(Number(total.count) / limit)
              };
          } catch (error) {
              console.error('Find sessions paginated error:', error);
              throw error;
          }
      }
      
      

     async endSession(sessionId: number,validatedby:number, handingoveramount:number) {
          try {
               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({ sessionid: sessionId })
                    .update({
                         sessionendedon: conn.fn.now(),
                         validatedby,
                         handingoveramount
                    });
          } catch (error) {
               console.error('End session error:', error);
               throw error;
          }
     }

     async delete(sessionId: number) {
          try {
               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({ sessionid: sessionId })
                    .delete();
          } catch (error) {
               console.error('Sales session delete error:', error);
               throw error;
          }
     }

     async hasActiveSessionForDate(date: string, branchId: number) {
          try {
               const conn = await this.connection;
               const [result] = await conn.raw(`
                    SELECT sessionid 
                    FROM salessessionmanager 
                    WHERE DATE(sessiondate) >= DATE(?)
                    AND branchid = ? 
                    AND sessionendedon IS NULL 
                    LIMIT 1
               `, [date, branchId]);

               return result.length > 0;
          } catch (error) {
               console.error('Check active session for date error:', error);
               throw error;
          }
     }
}
