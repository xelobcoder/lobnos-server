import KnexConnection from "../../../database/KnexConnections";
import { OperationsFailures } from "../../operations/types";

interface SalesSession {
     sessionid: number;
     sessiondate: Date;
     start_time?: string;
     end_time?: string;
     session_started_by: number;
     sessionendedon: Date | null;
     openingamount: number;
     amountreceivedby: number;
     validatedby: number;
     handingoveramount: number;
     branchid: number;
}

interface SalesSessionConfig {
     id: number;
     branchid: number;
     allow_multiple_sessions: boolean;
     session_count?: number;
     start_time?: string;
     end_time?: string;
     time_ranges?: { start: string; end: string }[];
     created_at: Date;
     updated_at: Date;
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

     async getSessionConfig(branchId: number): Promise<SalesSessionConfig | null> {
          try {
               const conn = await this.connection;
               const result = await conn('sales_session_config').where({ branchid: branchId }).first();
               if (result && result.time_ranges) {
                    result.time_ranges = JSON.parse(result.time_ranges);
               }
               return result;
          } catch (error) {
               console.error('Get session config error:', error);
               throw error;
          }
     }

     async setSessionConfig(config: Omit<SalesSessionConfig, 'id' | 'created_at' | 'updated_at'>): Promise<boolean> {
          try {
               const conn = await this.connection;
               const configToInsert = {
                    ...config,
                    time_ranges: config.time_ranges ? JSON.stringify(config.time_ranges) : null
               };
               const existing = await this.getSessionConfig(config.branchid);
               if (existing) {
                    await conn('sales_session_config').where({ branchid: config.branchid }).update({
                         ...configToInsert,
                         updated_at: conn.fn.now()
                    });
               } else {
                    await conn('sales_session_config').insert(configToInsert);
               }
               return true;
          } catch (error) {
               console.error('Set session config error:', error);
               throw error;
          }
     }

     async canCreateSession(date: Date, branchId: number, startTime?: string, endTime?: string): Promise<boolean> {
          try {
               const config = await this.getSessionConfig(branchId);
               const conn = await this.connection;

               const startOfDay = new Date(date);
               startOfDay.setHours(0, 0, 0, 0);
               const endOfDay = new Date(date);
               endOfDay.setHours(23, 59, 59, 999);


               // Also try with date string for comparison
               const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
               console.log('Date string:', dateString);

               if (!config || !config.allow_multiple_sessions) {
                    const result = await conn('salessessionmanager')
                         .where(conn.raw('DATE(sessiondate) = ?', [dateString]))
                         .andWhere('branchid', branchId)
                         .andWhere('sessionendedon', null)
                         .first();
                    return !result;
               } else {
                    if (!startTime || !endTime) return false; 

                    // Optional: Validate that provided times match configured ranges
                    if (config.time_ranges) {
                         const isValidRange = config.time_ranges.some(range =>
                              range.start === startTime && range.end === endTime
                         );
                         if (!isValidRange) return false; // Time range not in config
                    }

                    const result = await conn('salessessionmanager')
                         .where(conn.raw('DATE(sessiondate) = ?', [dateString]))
                         .andWhere('branchid', branchId)
                         .andWhere('sessionendedon', null)
                         .andWhere(conn.raw('(start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?)', [endTime, startTime, startTime, endTime]))
                         .first();
                    console.log('Overlap check result:', result);
                    return !result;
               }
          } catch (error) {
               console.error('Check can create session error:', error);
               throw error;
          }
     }

     async findConflictingSession(date: Date, branchId: number, startTime: string, endTime: string, excludeSessionId?: number): Promise<SalesSession | null> {
          try {
               const dateString = date.toISOString().split('T')[0];
               const conn = await this.connection;
               let query = conn('salessessionmanager')
                    .where(conn.raw('DATE(sessiondate) = ?', [dateString]))
                    .andWhere('branchid', branchId)
                    .andWhere('sessionendedon', null)
                    .andWhere(conn.raw('(start_time < ? AND end_time > ?) OR (start_time < ? AND end_time > ?)', [endTime, startTime, startTime, endTime]));

               if (excludeSessionId) {
                    query = query.andWhere('sessionid', '!=', excludeSessionId);
               }

               return await query.first();
          } catch (error) {
               console.error('Find conflicting session error:', error);
               throw error;
          }
     }

     async create(sessionData: any): Promise<boolean | string> {
          try {
               const { tenantId, ...cleanSessionData } = sessionData;
               const { sessiondate, branchid, start_time, end_time } = cleanSessionData;
               const sessionDate = new Date(sessiondate);
               const config = await this.getSessionConfig(branchid);

               if (!config?.allow_multiple_sessions) {
                    // Single session mode - always use full day (00:00 to 23:59)
                    const finalStartTime = "00:00";
                    const finalEndTime = "23:59";

                    const canCreate = await this.canCreateSession(sessionDate, branchid, finalStartTime, finalEndTime);

                    if (!canCreate) return OperationsFailures.cannotCreateSessionForDate;

                    // Use the final times in the session data
                    const sessionToCreate = {
                         ...cleanSessionData,
                         start_time: finalStartTime,
                         end_time: finalEndTime
                    };

                    const conn = await this.connection;
                    const result = await conn('salessessionmanager').insert(sessionToCreate);
                    return result[0] ? true : false;
               } else {
                    // Multiple sessions mode - create sessions for all configured time ranges
                    if (!config.time_ranges || config.time_ranges.length === 0) {
                         return "No time ranges configured for multiple sessions mode";
                    }

                    console.log('Creating multiple sessions for ranges:', config.time_ranges);

                    // Create sessions for each configured time range
                    const conn = await this.connection;
                    const createdSessions = [];

                    for (const range of config.time_ranges) {
                         console.log('Processing range:', range);

                         // Check if session already exists for this exact range
                         const existingSession = await conn('salessessionmanager')
                              .where(conn.raw('DATE(sessiondate) = ?', [sessionDate.toISOString().split('T')[0]]))
                              .andWhere('branchid', branchid)
                              .andWhere('start_time', range.start)
                              .andWhere('end_time', range.end)
                              .first();

                         if (existingSession) {
                              console.log('Session already exists for range:', range);
                              createdSessions.push(existingSession.sessionid);
                              continue;
                         }

                         // Check for conflicting sessions
                         const conflictingSession = await this.findConflictingSession(sessionDate, branchid, range.start, range.end);
                         if (conflictingSession) {
                              console.log('Found conflicting session:', conflictingSession.sessionid);
                              const hasActivity = await this.hasBillingActivity(conflictingSession.sessionid);
                              if (hasActivity) {
                                   console.log('Skipping range due to active billing in conflicting session:', range);
                                   continue;
                              } else {
                                   // End the conflicting session
                                   await this.endSession(conflictingSession.sessionid, 0, 0); // System ended
                                   console.log('Ended conflicting session:', conflictingSession.sessionid);
                              }
                         }

                         const sessionToCreate = {
                              ...cleanSessionData,
                              start_time: range.start,
                              end_time: range.end
                         };

                         try {
                              const result = await conn('salessessionmanager').insert(sessionToCreate);
                              console.log('Created session with result:', result);
                              if (result[0]) {
                                   createdSessions.push(result[0]);
                              }
                         } catch (error) {
                              // Continue with other ranges even if one fails
                              console.error(`Failed to create session for range ${range.start}-${range.end}:`, error);
                         }
                    }

                    console.log('Created sessions count:', createdSessions.length);
                    return createdSessions.length > 0 ? true : "Failed to create any sessions";
               }
          } catch (error) {
               console.error('Sales session creation error:', error);
               throw error;
          }
     }

     async createScheduledSessions(branchId: number): Promise<void> {
          const config = await this.getSessionConfig(branchId);
          if (!config || !config.allow_multiple_sessions || !config.time_ranges) return;

          const today = new Date().toISOString().split('T')[0];
          for (const range of config.time_ranges) {
               const sessionData = {
                    sessiondate: new Date(today),
                    start_time: range.start,
                    end_time: range.end,
                    session_started_by: 0,
                    sessionendedon: null,
                    openingamount: 0,
                    amountreceivedby: 0,
                    validatedby: 0,
                    handingoveramount: 0,
                    branchid: branchId
               };
               await this.create(sessionData);
          }
     }

     async update(sessionId: number, updates: Partial<SalesSession>) {
          try {
               // Validate session exists
               const existingSession = await this.findById(sessionId);
               if (!existingSession) {
                    throw new Error(`Session with ID ${sessionId} not found`);
               }

               // Validate update data
               const validationError = this.validateSessionUpdates(updates, existingSession);
               if (validationError) {
                    throw new Error(validationError);
               }

               // Check business rules
               const businessRuleError = await this.validateBusinessRules(sessionId, updates, existingSession);
               if (businessRuleError) {
                    throw new Error(businessRuleError);
               }

               const conn = await this.connection;
               return await conn('salessessionmanager')
                    .where({ sessionid: sessionId })
                    .update(updates);
          } catch (error) {
               console.error('Sales session update error:', error);
               throw error;
          }
     }

     private validateSessionUpdates(updates: Partial<SalesSession>, existingSession: SalesSession): string | null {
          // Validate sessiondate
          if (updates.sessiondate !== undefined) {
               const sessionDate = new Date(updates.sessiondate);
               if (isNaN(sessionDate.getTime())) {
                    return "Invalid session date format";
               }
               // Ensure date is not in the future (more than 1 day ahead)
               const tomorrow = new Date();
               tomorrow.setDate(tomorrow.getDate() + 1);
               if (sessionDate > tomorrow) {
                    return "Session date cannot be more than 1 day in the future";
               }
          }

          // Validate time formats
          if (updates.start_time !== undefined) {
               if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updates.start_time)) {
                    return "Invalid start_time format. Use HH:MM (24-hour format)";
               }
          }

          if (updates.end_time !== undefined) {
               if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updates.end_time)) {
                    return "Invalid end_time format. Use HH:MM (24-hour format)";
               }
          }

          // Validate time range logic
          if (updates.start_time && updates.end_time) {
               const startTime = updates.start_time;
               const endTime = updates.end_time;
               if (startTime >= endTime) {
                    return "Start time must be before end time";
               }
          } else if (updates.start_time && existingSession.end_time) {
               if (updates.start_time >= existingSession.end_time) {
                    return "Start time must be before existing end time";
               }
          } else if (updates.end_time && existingSession.start_time) {
               if (existingSession.start_time >= updates.end_time) {
                    return "End time must be after existing start time";
               }
          }

          // Validate amounts
          if (updates.openingamount !== undefined) {
               if (updates.openingamount < 0) {
                    return "Opening amount cannot be negative";
               }
          }

          if (updates.handingoveramount !== undefined) {
               if (updates.handingoveramount < 0) {
                    return "Handing over amount cannot be negative";
               }
          }

          // Validate employee IDs
          const employeeFields = ['session_started_by', 'amountreceivedby', 'validatedby'];
          for (const field of employeeFields) {
               if (updates[field] !== undefined) {
                    const value = updates[field];
                    if (typeof value !== 'number' || value < 0) {
                         return `${field} must be a valid employee ID (positive number)`;
                    }
               }
          }

          // Validate branchid
          if (updates.branchid !== undefined) {
               if (typeof updates.branchid !== 'number' || updates.branchid <= 0) {
                    return "Branch ID must be a positive number";
               }
          }

          return null; // No validation errors
     }

     private async validateBusinessRules(sessionId: number, updates: Partial<SalesSession>, existingSession: SalesSession): Promise<string | null> {
          // Check if session has billing activity
          const hasActivity = await this.hasBillingActivity(sessionId);

          // If session has billing activity, restrict certain updates
          if (hasActivity) {
               const restrictedFields = ['sessiondate', 'start_time', 'end_time', 'branchid', 'openingamount'];
               for (const field of restrictedFields) {
                    if (updates[field] !== undefined) {
                         return `Cannot update ${field} - session has associated billing transactions`;
                    }
               }
          }

          // If session is ended, restrict updates
          if (existingSession.sessionendedon) {
               const restrictedFields = ['sessiondate', 'start_time', 'end_time', 'openingamount'];
               for (const field of restrictedFields) {
                    if (updates[field] !== undefined) {
                         return `Cannot update ${field} - session is already ended`;
                    }
               }
          }

          // Check for time conflicts if updating times
          if (updates.start_time || updates.end_time || updates.sessiondate) {
               const checkDate = updates.sessiondate ? new Date(updates.sessiondate) : existingSession.sessiondate;
               const checkStart = updates.start_time || existingSession.start_time;
               const checkEnd = updates.end_time || existingSession.end_time;

               if (checkStart && checkEnd) {
                    const config = await this.getSessionConfig(existingSession.branchid);
                    const canCreate = await this.canCreateSession(checkDate, existingSession.branchid, checkStart, checkEnd);

                    // For updates, we need to exclude the current session from conflict check
                    if (!canCreate) {
                         // Check if the conflict is only with the current session
                         const conflictingSession = await this.findConflictingSession(checkDate, existingSession.branchid, checkStart, checkEnd, sessionId);
                         if (conflictingSession) {
                              return "Time range conflicts with another active session";
                         }
                    }
               }
          }

          return null; // No business rule violations
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

     async findActiveSession(userId: number, branchId: number, currentTime?: string): Promise<SalesSession | null> {
          try {
               const config = await this.getSessionConfig(branchId);
               const conn = await this.connection;
               let query = conn('salessessionmanager')
                    .where({
                         session_started_by: userId,
                         branchid: branchId,
                         sessionendedon: null
                    });

               if (config?.allow_multiple_sessions && currentTime) {
                    query = query.andWhere(conn.raw('start_time <= ? AND end_time > ?', [currentTime, currentTime]));
               }

               return await query.first();
          } catch (error) {
               console.error('Active session find error:', error);
               throw error;
          }
     }

     async findSessionsByDateRange(startDate: Date, endDate: Date, branchId?: number): Promise<SalesSession[]> {
          try {
               const conn = await this.connection;

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
          sortby: 'ASC' | 'DESC' = 'DESC',
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
                    .orderBy('s.sessiondate', sortby)
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



     async endSession(sessionId: number, validatedby: number, handingoveramount: number) {
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

     async hasBillingActivity(sessionId: number): Promise<boolean> {
          try {
               const session = await this.findById(sessionId);
               if (!session) return false;

               const conn = await this.connection;

               // Determine end date (same logic as financial summary)
               let endDate: Date;
               if (session.sessionendedon) {
                    endDate = new Date(session.sessionendedon);
               } else {
                    // Find next session
                    const nextSession = await conn('salessessionmanager')
                         .where('sessiondate', '>', session.sessiondate)
                         .orderBy('sessiondate', 'asc')
                         .first();
                    endDate = nextSession ? new Date(nextSession.sessiondate) : new Date();
               }

               // Check if any billing transactions exist for this session period
               const billingCount = await conn('billing')
                    .where('branchid', session.branchid)
                    .whereBetween('billedon', [session.sessiondate, endDate])
                    .count('billingid as count')
                    .first();

               return Number(billingCount?.count) > 0;
          } catch (error) {
               console.error('Check billing activity error:', error);
               throw error;
          }
     }

     async deleteUnusedSession(sessionId: number): Promise<boolean | string> {
          try {
               const hasActivity = await this.hasBillingActivity(sessionId);
               if (hasActivity) {
                    return "Cannot delete session - it has associated billing transactions";
               }

               const result = await this.delete(sessionId);
               return result > 0;
          } catch (error) {
               console.error('Delete unused session error:', error);
               throw error;
          }
     }

     async hasActiveSessionForDate(date: string, branchId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const config = await this.getSessionConfig(branchId);
               const [result] = await conn.raw(`
                    SELECT sessionid 
                    FROM salessessionmanager 
                    WHERE DATE(sessiondate) = DATE(?)
                    AND branchid = ? 
                    AND sessionendedon IS NULL 
                    LIMIT 1
               `, [date, branchId]);

               if (!result || result.length === 0) {
                    await this.createScheduledSessions(branchId);
                    return true;
               }
               return result.length > 0;
          } catch (error) {
               console.error('Check active session for date error:', error);
               throw error;
          }
     }

     async endExpiredSessions(): Promise<void> {
          try {
               const conn = await this.connection;
               const now = new Date().toTimeString().split(' ')[0];
               await conn('salessessionmanager')
                    .where('sessionendedon', null)
                    .andWhere(conn.raw('end_time <= ?', [now]))
                    .update({ sessionendedon: conn.fn.now() });
          } catch (error) {
               console.error('End expired sessions error:', error);
               throw error;
          }
     }
}
