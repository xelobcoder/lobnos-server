import { PrimeLimsTablebilling } from "../../../database/DatabaseTableSchema";
import KnexConnection from "../../../database/KnexConnections";

interface PaginatedResponse<T> {
     data: T[];
     total: number;
     page: number;
     totalPages: number;
}

export class BillingRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async create(billingData: Omit<PrimeLimsTablebilling, 'billingid'>) {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .insert(billingData);
          } catch (error) {
               console.error('Billing creation error:', error);
               throw error;
          }
     }

     async update(billingId: number, updates: Partial<PrimeLimsTablebilling>) {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .where({ billingid: billingId })
                    .update(updates);
          } catch (error) {
               console.error('Billing update error:', error);
               throw error;
          }
     }

     async findById(billingId: number) {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .where({ billingid: billingId })
                    .first();
          } catch (error) {
               console.error('Billing find error:', error);
               throw error;
          }
     }

     async findByPatientId(patientId: number) {
          try {
               let conn = await this.connection;
               return await conn('billing')
                    .where({ patientid: patientId })
                    .orderBy('billedon', 'desc');
          } catch (error) {
               console.error('Billing find by patient error:', error);
               throw error;
          }
     }

     async findByPatientIdWithDateRange(patientId: number, startDate: string, endDate: string): Promise<PrimeLimsTablebilling[]> {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .where({ patientid: patientId })
                    .whereBetween('billedon', [startDate, endDate])
                    .orderBy('billedon', 'desc');
          } catch (error) {
               console.error('Billing find by patient with date range error:', error);
               throw error;
          }
     }

     async findByPatientIdPaginated(
          patientId: number,
          page: number = 1,
          limit: number = 10
     ): Promise<PaginatedResponse<PrimeLimsTablebilling>> {
          try {
               const conn = await this.connection;
               const offset = (page - 1) * limit;
               const [total] = await conn('billing')
                    .where({ patientid: patientId })
                    .count('billingid as count');

               const data = await conn('billing')
                    .where({ patientid: patientId })
                    .orderBy('billedon', 'desc')
                    .limit(limit)
                    .offset(offset);

               return {
                    data,
                    total: total.count,
                    page,
                    totalPages: Math.ceil(total.count / limit)
               };
          } catch (error) {
               console.error('Billing find by patient paginated error:', error);
               throw error;
          }
     }

     async findAllByPatientId(patientId: number) {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .select(
                         'billing.*',
                         'new_patients.firstname',
                         'new_patients.middlename',
                         'new_patients.lastname'
                    )
                    .leftJoin('new_patients', 'billing.patientid', 'new_patients.patientid')
                    .where('billing.patientid', patientId)
                    .orderBy('billing.billedon', 'desc');
          } catch (error) {
               console.error('Find all billing by patient error:', error);
               throw error;
          }
     }

     async delete(billingId: number) {
          try {
               const conn = await this.connection;
               return await conn('billing')
                    .where({ billingid: billingId })
                    .delete();
          } catch (error) {
               console.error('Billing delete error:', error);
               throw error;
          }
     }
}