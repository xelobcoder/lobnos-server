import { CommissionBatchPaymentServicesRepo } from "../../models/commissions/CommissionBatchPaymentServicesRepo";
import { Request, Response } from "express";
import { customError } from "../../hooks/helper";
import logger from "../../hooks/logger";
import { CommissionBatchPaymentsRepo } from "../../models/commissions/CommissionBatchPaymentsRepo";
import { CommissionPaymentValidationError } from "../../models/commissions/CommissionPaymentAllocation";
import { getAuthUser } from '../../middleware/authority';
import { assertCommissionServiceBranch } from '../../middleware/commissionAuthority';
import KnexConnection from '../../database/KnexConnections';

interface ServiceBatchingRequestBody {
     startDate: string;
     endDate: string;
     commissionDue: number;
     amountPaid: number;
     paymentMethod: string;
     employeeid: number;
     branchid: number;
     services: Array<number>;
     recipientid: number | string;
     recipient_type: 'clinician' | 'organization'
}


export class CommissionBatchServicesController {
     batchServicesRepo: any;
     private tenantId: number;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
     }


     processServiceBatching = async (request: Request<{}, {}, ServiceBatchingRequestBody>, response: Response) => {
          try {
               const batchServicesRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const { startDate, endDate, commissionDue, amountPaid, paymentMethod, employeeid, branchid, recipientid, recipient_type, services } = request.body;
               const actor = getAuthUser(request);
               if (!actor || actor.branch == null) return customError('An authenticated operating branch is required', 403, response);
               const recipientId = typeof recipientid === 'number' ? recipientid
                    : typeof recipientid === 'string' && /^\d+$/.test(recipientid.trim()) ? Number(recipientid.trim()) : NaN;
               if (!Number.isSafeInteger(recipientId) || recipientId <= 0) return customError('Select a valid commission recipient ID', 400, response);
               if (!['clinician', 'organization'].includes(recipient_type)) return customError('Select a valid commission recipient type', 400, response);
               if (!Array.isArray(services) || !services.length || services.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(services).size !== services.length) {
                    return customError('Provide a nonempty list of unique positive service IDs', 400, response);
               }
               if (typeof startDate !== 'string' || typeof endDate !== 'string') return customError('Start and end dates are required', 400, response);

               const parseDate = (dateStr: string): Date => {
                    const parts = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    const iso = parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : dateStr.trim();
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(NaN);
                    const date = new Date(`${iso}T00:00:00Z`);
                    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? date : new Date(NaN);
               };

               const startDateObj = parseDate(startDate);
               const endDateObj = parseDate(endDate);
               if (!branchid || !employeeid || !recipientid || !recipient_type) {
                    return customError("Missing required fields: branchid, employeeid, recipientid, recipient_type", 400, response);
               }
               if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
                    return customError("Invalid date format", 400, response);
               }
               if (startDateObj > endDateObj) {
                    return customError("Start date cannot be after end date", 400, response);
               }

               for (const serviceId of services) await assertCommissionServiceBranch(actor, serviceId);

               const eligibleServices = await batchServicesRepo.getUnbatchedServicesFromList(services);

               if (eligibleServices.length === 0) {
                    return customError("No eligible services from the provided list", 400, response);
               }

               logger.info(`Processing batch payment for ${eligibleServices.length} eligible services: ${eligibleServices.join(', ')}`);

               const processPayment = await new CommissionBatchPaymentsRepo(this.tenantId).createBatchPaymentWithServices({
                    startDate: startDateObj,
                    endDate: endDateObj,
                    commissionDue,
                    amountPaid,
                    services: eligibleServices,
                    employeeid: actor.employeeid,
                    branchid: actor.branch,
                    actor,
                    settlementMode: (request.body as any).settlementMode,
                    waiverReason: (request.body as any).waiverReason,
                    paymentMethod,
                    recipientId,
                    recipientType: recipient_type
               });

               if (!processPayment) {
                    return customError("Failed to process service batching", 500, response);
               }

               return response.send({
                    status: true,
                    message: processPayment.requiresApproval ? 'Commission payment request submitted for expense approval' : 'Commission waiver recorded',
                    data: processPayment
               });

          } catch (error: any) {
               logger.error('Error processing service batching:', error);
               return customError(error instanceof CommissionPaymentValidationError ? error.message : 'Failed to process commission payment', error instanceof CommissionPaymentValidationError ? 400 : 500, response);
          }
     }


     async getBatchInformation(request: Request, response: Response) {
          try {
               const { batchid, recipient_id, recipient_type, startDate, endDate, page, count, sortby } = request.query;

               const batchPaymentsRepo = new CommissionBatchPaymentsRepo(this.tenantId);
               const batchInfo = await batchPaymentsRepo.getBatch
                    (
                         {
                              batchid: parseInt(batchid as string),
                              page: page ? parseInt(page as string) : 1,
                              count: count ? parseInt(count as string) : 10,
                              sortby: sortby === 'ASC' ? 'ASC' : 'DESC',
                              startDate: startDate ? new Date(startDate as string) : undefined,
                              endDate: endDate ? new Date(endDate as string) : undefined,
                              recipient_id: recipient_id ? parseInt(recipient_id as string) : undefined,
                              recipient_type: recipient_type ? recipient_type as 'clinician' | 'organization' : undefined
                              , branchId: getAuthUser(request)!.branch
                         }
                    )
               return response.send({
                    status: true,
                    message: "Batch information retrieved successfully",
                    data: batchInfo
               });
          }
          catch (error) {
               logger.error('Error fetching batch information:', error);
               return customError("Failed to fetch batch information", 500, response);
          }
     }


     async getServiceCommissionPaymentHistory(request: Request, response: Response) {
          try {
               const { serviceid } = request.params;
               await assertCommissionServiceBranch(getAuthUser(request)!, Number(serviceid));
               const commissionTrackingRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const paymentHistory = await commissionTrackingRepo.getsServicePaymentHistory(parseInt(serviceid.toString()));
               return response.send({
                    status: true,
                    message: "Service commission payment history retrieved successfully",
                    data: paymentHistory
               });
          }
          catch (error) {
               logger.error('Error fetching service commission payment history:', error);
               return customError("Failed to fetch service commission payment history", 500, response);
          }
     }


     getBatchBreakdown = async (request: Request, response: Response) => {
          try {
               const { batchid } = request.params;
               const db = await KnexConnection(getAuthUser(request)!.tenantId);
               const allocations = await db('commission_batch_payment_services').where({ batch_payment_id: Number(batchid) });
               if (!allocations.length) return customError('Batch not found', 404, response);
               for (const allocation of allocations) await assertCommissionServiceBranch(getAuthUser(request)!, Number(allocation.serviceid));
               const batchPaymentsRepo = new CommissionBatchPaymentServicesRepo(this.tenantId);
               const batchBreakdown = await batchPaymentsRepo.getBatchPaymentServices(parseInt(batchid.toString()));
               return response.send({
                    status: true,
                    message: "Batch breakdown retrieved successfully",
                    data: batchBreakdown
               });
          } catch (error) {
               logger.error('Error fetching batch breakdown:', error);
               return customError("Failed to fetch batch breakdown", 500, response);
          }
     }
}
