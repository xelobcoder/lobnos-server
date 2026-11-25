import { PrimeLimsTablebilling } from "../../../interfaces/database";
import KnexConnection from "../../../database/KnexConnections";
import { lockMutableBill, withBillingClosure } from '../BillingFinancialGuard';

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
               return await conn.transaction(async trx => {
                    await lockMutableBill(trx, this.tenantId, billingId);
                    if (Object.keys(updates).some(k => k !== 'additionalinformation')) throw new Error('Use validated billing financial workflows');
                    return trx('billing').where({ billingid: billingId }).update(updates);
               });
          } catch (error) {
               console.error('Billing update error:', error);
               throw error;
          }
     }

     async findById(billingId: number) {
          try {
               const conn = await this.connection;
               const bill = await conn('billing')
                    .where({ billingid: billingId })
                    .first();
               return bill ? (await withBillingClosure(conn, [bill]))[0] : bill;
          } catch (error) {
               console.error('Billing find error:', error);
               throw error;
          }
     }

     async findNotificationContext(billingId: number): Promise<{ patientName: string | null } | undefined> {
          const conn = await this.connection;
          const result = await conn('billing as billing')
               .leftJoin('new_patients as patient', 'patient.patientid', 'billing.patientid')
               .select(conn.raw("TRIM(CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname)) as patientName"))
               .where('billing.billingid', billingId)
               .first();
          return result;
     }

     async findRefundNotificationContext(serviceId: number): Promise<{ patientName: string | null; amountRefunded: string | number | null } | undefined> {
          const conn = await this.connection;
          const result = await conn('dboservices as service')
               .innerJoin('billing as billing', 'billing.billingid', 'service.billingid')
               .leftJoin('new_patients as patient', 'patient.patientid', 'billing.patientid')
               .leftJoin('dbobillingrefundtable as refund', 'refund.serviceid', 'service.serviceid')
               .select(
                    'refund.amountRefunded',
                    conn.raw("TRIM(CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname)) as patientName"),
               )
               .where('service.serviceid', serviceId)
               .first();
          return result;
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
               const bills = await conn('billing')
                    .where({ patientid: patientId })
                    .whereBetween('billedon', [startDate, endDate])
                    .orderBy('billedon', 'desc');
               return withBillingClosure(conn, bills);
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
                    data: await withBillingClosure(conn, data),
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