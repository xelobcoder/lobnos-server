import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import ApplicationSettings from "../application/appsettings/appset";
import { CommissionBatchPaymentServicesRepo } from "./CommissionBatchPaymentServicesRepo";
import { CommissionServiceFactory } from "./commission-configurations/services/CommissionServiceFactory";
import { CommissionInput } from "./commission-configurations/interfaces";
import { resolveCommissionRecipient } from "./commission-configurations/services/CommissionRecipientPolicy";
import { joinReferralClinicianOrganization, REFERRAL_CLINICIAN_ORGANIZATION_SQL } from "../referral/clinicianReferralOrganization";

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

     constructor(tenantId: number, private readonly branchId?: number) {
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
                    .whereNull('cbps.id');
               if (this.branchId != null) query.whereIn('ds.billingid', conn('billing').select('billingid').where({ branchid: this.branchId }));

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
                    categoryTrackId: number;
                    serviceCategory?: string | null;
                    serviceAddedOn?: Date | string | null;
               }> = await joinReferralClinicianOrganization(conn('dboservices')
                    .leftJoin('clinicianbasicinfo as commission_clinician', 'dboservices.clinicianId', 'commission_clinician.id'))
                    .whereIn('serviceid', servicesArray)
                    .select('dboservices.serviceid', 'totalpayable', 'clinicianId', 'organizationId', conn.raw(REFERRAL_CLINICIAN_ORGANIZATION_SQL), 'categoryTrackId', 'serviceCategory', 'serviceAddedOn');

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
                         billing_source: service.categoryTrackId,
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
               const trackedServiceIds = await conn('commission_tracking').select('service_id');

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
                         'dboservices.categoryTrackId',
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
                    .whereIn('dboservices.categoryTrackId', [1, 2, 3, 4, 6])
                    .andWhere((builder: any) => {
                         builder.where('dboservices.clinicianId', '>', 0).orWhere('dboservices.organizationId', '>', 0);
                    })
                    .whereNotIn('status', ['voided', 'cancelled', 'refunded', 'written-off']);
               if (this.branchId != null) query.whereIn('dboservices.billingid', conn('billing').select('billingid').where({ branchid: this.branchId }));

               const settings = await new ApplicationSettings().getAllAppSettings(this.tenantId);
               const policy = settings?.commissionRecipientPolicy === 'organization' ? 'organization' : 'clinician';
               if (recipientType === 'clinician' && recipientId !== undefined) {
                    query = query.andWhere('clinicianId', recipientId).whereNot('dboservices.categoryTrackId', 2);
                    if (policy === 'organization') {
                         query.andWhere((builder: any) => {
                              builder.where('dboservices.categoryTrackId', 6).orWhereNull('organizationId').orWhere('organizationId', 0);
                         });
                    }
               } else if (recipientType === 'organization' && recipientId !== undefined) {
                    query = query.andWhere('organizationId', recipientId).whereNot('dboservices.categoryTrackId', 6);
                    if (policy === 'clinician') {
                         query.andWhere((builder: any) => {
                              builder.where('dboservices.categoryTrackId', 2).orWhereNull('clinicianId').orWhere('clinicianId', 0);
                         });
                    }
               }

               if (startDate && endDate) {
                    query = query.andWhereBetween(conn.raw('DATE(serviceAddedOn)'), [startDate, endDate]);
               }

               if (page !== undefined && count !== undefined) {
                    const offset = (page - 1) * count;
                    query = query.offset(offset).limit(count);
               }

               const services = await query;
               return services.map(service => {
                    const recipient = resolveCommissionRecipient({
                         billing_source: Number(service.categoryTrackId),
                         clinician_id: service.clinicianId,
                         organization_id: service.organizationId || 0,
                    }, policy);
                    return {
                         ...service,
                         commission_recipient_type: recipient.recipientType,
                         commission_recipient_id: recipient.recipientId,
                         commission_recipient_name: recipient.recipientType === 'clinician' ? service.clinician_name : service.organization_name,
                    };
               });
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
               const service = await joinReferralClinicianOrganization(conn('dboservices')
                    .leftJoin('clinicianbasicinfo as commission_clinician', 'dboservices.clinicianId', 'commission_clinician.id'))
                    .where('serviceid', serviceId)
                    .select('dboservices.*', conn.raw(REFERRAL_CLINICIAN_ORGANIZATION_SQL))
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
                    billing_source: service.categoryTrackId,
                    clinician_id: service.clinicianId,
                    clinician_organization_id: service.clinicianOrganizationId,
                    organization_id: service.organizationId ?? 0,
                    completion_date: service.serviceAddedOn ? new Date(service.serviceAddedOn) : new Date(),
               };

               const settings = await new ApplicationSettings().getAllAppSettings(this.tenantId);
               const policy = settings?.commissionRecipientPolicy === 'organization' ? 'organization' : 'clinician';
               const recipient = resolveCommissionRecipient(input, policy);
               if (recipient.recipientType !== recipientType || recipient.recipientId !== recipientId) {
                    throw new Error('Selected recipient does not match the billing source and commission recipient setting');
               }

               const engine = CommissionServiceFactory.createEngine(this.tenantId);
               return await engine.executeCommissionCalculation(input);
          } catch (error) {
               logger.error('Error inserting untracked service:', error);
               throw error;
          }
     }
}
