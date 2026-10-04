import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import ApplicationSettings from "../application/appsettings/appset";
import { CommissionBatchPaymentServicesRepo } from "./CommissionBatchPaymentServicesRepo";
import { CommissionServiceFactory } from "./commission-configurations/services/CommissionServiceFactory";
import { CommissionInput } from "./commission-configurations/interfaces";

interface CommissionTracking {
     id?: number;
     service_id: number;
     service_amount: number;
     commission_type: 'percentage' | 'fixed' | 'tiered' | 'hybrid';
     percentage_rate_applied?: number;
     fixed_amount_applied?: number;
     tier_id?: number;
     commission_due: number;
     min_cap_adjustment?: number;
     max_cap_adjustment?: number;
     period_cap_adjustment?: number;
     final_commission?: number;
     config_id?: number;
     assignment_id?: number;
     recipient_type: 'clinician' | 'organization';
     recipient_id: number;
     cap_period_reference?: string | Date;
     calculated_at?: Date;
     currency?: string;
     status?: string;
     created_at?: Date;
     updated_at?: Date;
}

interface ServiceInfo {
     serviceid: number;
     totalpayable: string | number;
     clinicianId: number | null;
     organizationId: number | null;
}

interface ClinicianCommission {
     clinicianid: number;
     commission: string;
}

interface OrgCommission {
     organizationid: number;
     commission: string;
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
               const applicationsettings = await new ApplicationSettings().getAllAppSettings(this.tenantId);
               let isPaidAmountUsed = false;

               if (applicationsettings) {
                    isPaidAmountUsed = applicationsettings['useamountpaidforcommissioncalculation'] ? parseInt((applicationsettings['useamountpaidforcommissioncalculation']).toString()) == 1 : false;
               }
               let query = conn('commission_tracking as ct')
                    .select(
                         'ct.*',
                         'ds.totalpayable',
                         "ds.paidamount",
                         'ds.serviceAddedOn',
                         'ct.*',
                         'ct.commission_type',
                         'ds.serviceCategory',
                         'tp.name as test_name',
                    )
                    .leftJoin('dboservices as ds', 'ct.service_id', 'ds.serviceid')
                    .leftJoin('test_panels as tp', 'ds.trackId', 'tp.id')
                    .leftJoin('commission_batch_payment_services as cbps', 'ct.service_id', 'cbps.serviceid')
                    .where(conn.raw("ds.serviceCategory IN ('CLINICIAN_SPECIAL_BILLING','ORGANIZATION')"))
                    .andWhere((builder: any) => {
                         builder.whereRaw('ds.clinicianId IS NOT NULL').orWhereRaw('ds.organizationId IS NOT NULL');
                    })
                    .whereNull('cbps.id');

               if (type === 'clinician') {
                    query = query
                         .leftJoin("clinicianbasicinfo as cbi", "ct.recipient_id", "cbi.id")
                         .select('cbi.name as recipient_name');
               } else if (type === 'organization') {
                    query = query
                         .leftJoin("organization as obi", "ct.recipient_id", "obi.id")
                         .select('obi.name as recipient_name');
               }


               if (recipient_id) {
                    query = query.andWhere('ct.recipient_id', recipient_id);
               }

               if (type) {
                    query = query.andWhere('ct.recipient_type', type);
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
               const { notes: _notes, ...safeUpdates } = updates as any;
               delete safeUpdates['commission_percentage'];
               delete safeUpdates['type'];
               return await conn('commission_tracking')
                    .where({ id })
                    .update(safeUpdates);
          } catch (error) {
               logger.error('Error updating commission tracking:', error);
               throw error;
          }
     }


     async validateServiceTrackedMultiple(servicesArray: number[]): Promise<number[]> {
          try {
               const conn = await this.connection;
               const results = await conn('commission_tracking')
                    .whereIn('service_id', servicesArray.map(id => parseInt(id.toString())))
                    .select('service_id');
               const trackedServiceIds = results.map((row: any) => row.service_id);
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
               const services: Array<{
                    serviceid: number;
                    totalpayable: string | number;
                    clinicianId: number | null;
                    organizationId: number | null;
                    clinicianOrganizationId: number | null;
                    serviceCategory?: string | null;
                    serviceAddedOn?: Date | string | null;
               }> = await conn('dboservices')
                    .leftJoin('clinicianbasicinfo as commission_clinician', 'dboservices.clinicianId', 'commission_clinician.id')
                    .whereIn('serviceid', servicesArray)
                    .select('dboservices.serviceid', 'totalpayable', 'clinicianId', 'organizationId', 'commission_clinician.organization as clinicianOrganizationId', 'serviceCategory', 'serviceAddedOn');

               if (services.length === 0) {
                    return 0;
               }

               const engine = CommissionServiceFactory.createEngine(this.tenantId);
               let insertedCount = 0;

               for (const service of services) {
                    const completionDate = service.serviceAddedOn
                         ? new Date(service.serviceAddedOn)
                         : new Date();

                    if (!service.clinicianId && !service.organizationId) {
                         continue;
                    }

                    const input: CommissionInput = {
                         service_id: service.serviceid,
                         service_amount: parseFloat(String(service.totalpayable)) || 0,
                         service_category: service.serviceCategory || 'CLINICIAN_SPECIAL_BILLING',
                         clinician_id: service.clinicianId ?? undefined,
                         clinician_organization_id: service.clinicianOrganizationId ?? undefined,
                         organization_id: service.organizationId ?? 0,
                         completion_date:
                              Number.isNaN(completionDate.getTime()) ? new Date() : completionDate,
                    };

                    const result = await engine.executeCommissionCalculation(input);
                    if (result.reason === 'SUCCESS' && result.tracking_id) {
                         insertedCount += 1;
                    }
               }

               return insertedCount;
          } catch (error) {
               logger.error('Error calculating commission due:', error);
               throw error;
          }
     }

     async getUntrackedServices(recipientType?: 'clinician' | 'organization', recipientId?: number, page?: number, count?: number, startDate?: Date, endDate?: Date, sortBy: 'ASC' | 'DESC' = 'ASC'): Promise<any[]> {
          try {
               const conn = await this.connection;
               let trackedServiceIds: any[] = [];

               if (recipientType && recipientId !== undefined) {
                    trackedServiceIds = await conn('commission_tracking')
                         .where('recipient_type', recipientType)
                         .andWhere('recipient_id', recipientId)
                         .select('service_id');
               } else {
                    trackedServiceIds = await conn('commission_tracking')
                         .select('service_id');
               }

               const trackedIds = trackedServiceIds.map((row: any) => row.service_id);

               let query = conn('dboservices')
                    .select(
                         'serviceid',
                         'totalpayable',
                         'paidamount',
                         'status',
                         'paymentstatus',
                         'serviceAddedOn',
                         'serviceCategory',
                         'clinicianId',
                         'organizationId',
                         'tp.name as test_name',
                         'cbi.name as clinician_name',
                         'org.name as organization_name'
                    )
                    .leftJoin('test_panels as tp', 'dboservices.trackId', 'tp.id')
                    .leftJoin('clinicianbasicinfo as cbi', 'dboservices.clinicianId', 'cbi.id')
                    .leftJoin('organization as org', 'dboservices.organizationId', 'org.id')
                    .whereNotIn('serviceid', trackedIds)
                    .andWhere(conn.raw("serviceCategory IN ('CLINICIAN_SPECIAL_BILLING','ORGANIZATION')"))
                    .whereNotIn('status', ['voided', 'cancelled', 'refunded', 'written-off']);

               if (recipientType === 'clinician' && recipientId !== undefined) {
                    query = query.andWhere('clinicianId', recipientId);
               } else if (recipientType === 'organization' && recipientId !== undefined) {
                    query = query.andWhere('organizationId', recipientId);
               }

               if (startDate && endDate) {
                    query = query.andWhereBetween(conn.raw('DATE(serviceAddedOn)'), [startDate, endDate]);
               }

               if (page !== undefined && count !== undefined) {
                    const offset = (page - 1) * count;
                    query = query.offset(offset).limit(count);
               }

               return await query;
          } catch (error) {
               logger.error('Error fetching untracked services:', error);
               throw error;
          }
     }

     async insertUntrackedService(
          serviceId: number,
          recipientType: 'clinician' | 'organization',
          recipientId: number
     ): Promise<any> {
          try {
               const conn = await this.connection;
               const service = await conn('dboservices')
                    .where('serviceid', serviceId)
                    .first();

               if (!service) {
                    throw new Error(`Service ${serviceId} not found`);
               }

               if (['voided', 'cancelled', 'refunded', 'written-off'].includes(service.status)) {
                    throw new Error('Cannot insert a service with invalid status');
               }

               const existingTracking = await conn('commission_tracking')
                    .where('service_id', serviceId)
                    .first();

               if (existingTracking) {
                    throw new Error('Service is already tracked for commission');
               }

               const input: CommissionInput = {
                    service_id: serviceId,
                    service_amount: parseFloat(String(service.totalpayable)) || 0,
                    service_category: service.serviceCategory || 'CLINICIAN_SPECIAL_BILLING',
                    clinician_id: recipientType === 'clinician' ? recipientId : undefined,
                    organization_id: recipientType === 'organization' ? recipientId : 0,
                    completion_date: service.serviceAddedOn ? new Date(service.serviceAddedOn) : new Date(),
               };

               const engine = CommissionServiceFactory.createEngine(this.tenantId);
               return await engine.executeCommissionCalculation(input);
          } catch (error) {
               logger.error('Error inserting untracked service:', error);
               throw error;
          }
     }
}
