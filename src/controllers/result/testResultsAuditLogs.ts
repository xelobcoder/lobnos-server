import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import { decrypt_value } from "../../utils/encryptionModels";

export interface TestResultsAuditLog {
     id?: number;
     field: string;
     ascensionid: number;
     billingid: number;
     patientid: number;
     testid: number;
     previous_value?: string;
     previous_originalvalue?: string;
     employeeid: number;
     fieldid: number;
     entrymode?: 'manual' | 'automatic';
     created_on?: string;
     action_type: 'UPDATE' | 'DELETE';
}

export default class TestResultsAuditLogRepository {
     private tenantId: number;
     private tableName: string;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.tableName = 'test_results_audit_log';
          this.connection = KnexConnection(tenantId);
     }

     async create(log: Omit<TestResultsAuditLog, 'id' | 'created_on'>): Promise<number> {
          try {
               const conn = await this.connection;
               const [id] = await conn(this.tableName).insert(log);
               return id;
          } catch (error) {
               logger.error('Error creating test results audit log:', error);
               throw error;
          }
     }

     async findById(id: number): Promise<TestResultsAuditLog | null> {
          try {
               const conn = await this.connection;
               const result = await conn(this.tableName).where({ id }).first();
               return result || null;
          } catch (error) {
               logger.error('Error finding test results audit log by id:', error);
               throw error;
          }
     }

     async findAllPaginated(
          page: number = 1,
          pageSize: number = 20,
          filters?: Partial<TestResultsAuditLog>
     ): Promise<{ data: TestResultsAuditLog[]; total: number; page: number; pageSize: number }> {
          try {
               const conn = await this.connection;
               let baseQuery = conn(this.tableName + ' as t')
                    .leftJoin('roles as r', 't.employeeid', 'r.employeeid')
                    .select(
                         't.*',
                         'r.username as employee_name',
                         'r.role as employee_role',
                         'r.email as employee_email'
                    );

               if (filters) {
                    Object.entries(filters).forEach(([key, value]) => {
                         if (value !== undefined) {
                              baseQuery = baseQuery.where(`t.${key}`, value);
                         }
                    });
               }

               const totalResultRaw = await baseQuery.clone().count('t.id as count').first();
               const total = totalResultRaw ? Number((totalResultRaw as any).count) : 0;

               let data = await baseQuery
                    .clone()
                    .orderBy('t.created_on', 'DESC')
                    .limit(pageSize)
                    .offset((page - 1) * pageSize);

               data = data.map((row: any) => {
                    if (row.previous_value) {
                         try {
                              row.previous_value = decrypt_value(row.previous_value);
                         } catch { }
                    }
                    if (row.previous_originalvalue) {
                         try {
                              row.previous_originalvalue = decrypt_value(row.previous_originalvalue);
                         } catch { }
                    }

                    if (row.new_value) {
                         try {
                              row.new_value = decrypt_value(row.new_value);
                         } catch { }
                    }

                    if (row.new_originalvalue) {
                         try {
                              row.new_originalvalue = decrypt_value(row.new_originalvalue);
                         } catch { }
                    }
                    return row;
               });


               return { data, total, page, pageSize };
          } catch (error) {
               logger.error('Error fetching paginated test results audit logs:', error);
               throw error;
          }
     }

     async findAll(): Promise<TestResultsAuditLog[]> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName).select('*');
          } catch (error) {
               logger.error('Error fetching all test results audit logs:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn(this.tableName).where({ id }).delete();
          } catch (error) {
               logger.error('Error deleting test results audit log:', error);
               throw error;
          }
     }
}