import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import { CommissionBatchPaymentServicesRepo } from "./CommissionBatchPaymentServicesRepo";


interface CommissionTracking {
     id?: number;
     serviceid: number;
     commission_percentage: number;
     commission_due: number;
     type: 'clinician' | 'organization';
     recipient_id: number;
     calculated_at?: Date;
     created_at?: Date;
     updated_at?: Date;
}

interface ServiceInfo {
     serviceid: number;
     totalpayable: string | number;
     clinicianId: number | null;
     organizationId: number | null;
}

export class CommissionTrackingRepo {
     private tenantId: number;
     private connection: any;
     private batchRepo: CommissionBatchPaymentServicesRepo;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
          this.batchRepo = new CommissionBatchPaymentServicesRepo(tenantId);
     }

     async getCommissionTrackingById(id: number): Promise<CommissionTracking | undefined> {
          try {
               const conn = await this.connection;
               return await conn('commission_tracking')
                    .where({ id })
                    .first();
          } catch (error) {
               logger.error('Error fetching commission tracking:', error);
               throw error;
          }
     }

     async getCommissionTrackingByType(
          type: 'clinician' | 'organization',
          page: number | undefined,
          count?: number,
          recipient_id?: number,
          start_date?: string,
          end_date?: string
     ): Promise<any[]> {
          try {
               const conn = await this.connection;
               let query = conn('commission_tracking as ct')
                    .select(
                         'ct.*',
                         'ds.totalpayable',
                         "ds.paidamount",
                         'ds.serviceAddedOn',
                         'ds.serviceCategory',
                         'tp.name as test_name',
                         conn.raw(`CASE 
                              WHEN ct.type = 'clinician' THEN cbi.name
                              WHEN ct.type = 'organization' THEN obi.name
                              ELSE 'Unknown'
                         END as recipient_name`)
                    )
                    .leftJoin('dboservices as ds', 'ct.serviceid', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .leftJoin("clinicianbasicinfo as cbi", "ct.recipient_id", "cbi.id")
                    .leftJoin("organization as obi", "ct.recipient_id", "obi.id")
                    .where(conn.raw("ds.serviceCategory IN ('CLINICIAN_SPECIAL_BILLING','ORGANIZATION')"))
                    .andWhere(conn.raw("ds.clinicianId IS NOT NULL OR ds.organizationId IS NOT NULL"));


               if (recipient_id) {
                    query = query.andWhere('ct.recipient_id', recipient_id);
               }

               if (type) {
                    query = query.andWhere('ct.type', type);
               }

               if (start_date && end_date) {
                    query = query.andWhereBetween(conn.raw('DATE(ds.serviceAddedOn)'), [start_date, end_date]);
               }

               if (page !== undefined && count !== undefined) {
                    const offset = (page - 1) * count;
                    query = query.offset(offset).limit(count);
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching commission tracking by type:', error);
               throw error;
          }
     }

     async updateCommissionTracking(id: number, updates: Partial<CommissionTracking>): Promise<number> {
          try {
               const conn = await this.connection;
               return await conn('commission_tracking')
                    .where({ id })
                    .update(updates);
          } catch (error) {
               logger.error('Error updating commission tracking:', error);
               throw error;
          }
     }


     async validateServiceTrackedMultiple(servicesArray: number[]): Promise<number[]> {
          try {
               const conn = await this.connection;
               const results = await conn('commission_tracking')
                    .whereIn('serviceid', servicesArray.map(id => parseInt(id.toString())))
                    .select('serviceid');
               const trackedServiceIds = results.map((row: any) => row.serviceid);
               const untrackedServiceIds = servicesArray.filter(id => !trackedServiceIds.includes(id));
               return untrackedServiceIds;
          } catch (error) {
               logger.error('Error validating multiple tracked services:', error);
               throw error;
          }
     }


     async calculateCommissionDue(servicesArray: number[]): Promise<number> {
          try {
               const conn = await this.connection;
               const services: ServiceInfo[] = await conn('dboservices')
                    .whereIn('serviceid', servicesArray)
                    .select('serviceid', 'totalpayable', 'clinicianId', 'organizationId');

               const clinicianIds = [...new Set(services.map(s => s.clinicianId).filter(id => id))];
               const orgIds = [...new Set(services.map(s => s.organizationId).filter(id => id))];

               const clinicianInfos = clinicianIds.length > 0 ? await conn('clinicianpaymentinfo')
                    .whereIn('clinicianid', clinicianIds)
                    .select('clinicianid', 'commission') : [];


               const orgInfos = orgIds.length > 0 ? await conn('organizationaccountinformation')
                    .whereIn('organizationid', orgIds)
                    .select('organizationid', 'commission') : [];


               const clinicianMap = new Map<number, number>(clinicianInfos.map(c => [c.clinicianid, parseFloat(c.commission) || 0]));
               const orgMap = new Map<number, number>(orgInfos.map(o => [o.organizationid, parseFloat(o.commission) || 0]));
               const insertData = [];


               for (const service of services) {
                    let commission_percentage = 0;
                    let commission_type: 'clinician' | 'organization' | null = null;
                    let recipient_id: number | null = null;
                    if (service.clinicianId) {
                         commission_percentage = clinicianMap.get(service.clinicianId) || 0;
                         commission_type = 'clinician';
                         recipient_id = service.clinicianId;
                    } else if (service.organizationId) {
                         commission_percentage = orgMap.get(service.organizationId) || 0;
                         commission_type = 'organization';
                         recipient_id = service.organizationId;
                    }
                    if (recipient_id && commission_type) {
                         const commission_due = (parseFloat(String(service.totalpayable)) * commission_percentage) / 100;
                         insertData.push({
                              serviceid: service.serviceid,
                              commission_percentage,
                              commission_due,
                              type: commission_type,
                              recipient_id,
                              calculated_at: new Date(),
                              created_at: new Date(),
                              updated_at: new Date()
                         });
                    }
               }


               if (insertData.length > 0) {
                    await conn('commission_tracking').insert(insertData);
                    return insertData.length;
               }

               
               return 0;
          } catch (error) {
               logger.error('Error calculating commission due:', error);
               throw error;
          }
     }
}


/*
So, the approach is that we are going to have the commission deal and we are going to have the amount paid. There are going to be instances where the commission deal will be greater than the amount paid. That is always at the discretion of the company to decide how much to pay to the clinician for the commission end. Now, instances they'll pay the full commission, instances they'll pay the right amount or less. Let's establish that first.
*/