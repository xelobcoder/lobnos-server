import KnexConnection from "../../../database/KnexConnections";
import { IFreeServicesService, CreateFreeServiceRequestDTO, ApproveFreeServiceRequestDTO, FreeServiceRequestStatus, RejectFreeServiceRequestDTO } from "../Interfaces/freeservices.interface";
import { FreeServicesRepo } from "../repositories/FreeServicesRepo";


export class FreeServicesService implements IFreeServicesService {
     private repo: FreeServicesRepo;
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.repo = new FreeServicesRepo(tenantId);
          this.connection = KnexConnection(tenantId);
     }

     async requestFreeService(request: CreateFreeServiceRequestDTO): Promise<number> {
          if (!request.requester_id || !request.reason) {
               throw new Error('Missing required fields: requester_id, reason');
          }

          if (!request.items || request.items.length === 0) {
               throw new Error('Service price must be greater than 0');
          }

          const conn = await this.connection;
          const trx = await conn.transaction();

          try {
               const requestId = await this.repo.createRequest(
                    request.requester_id,
                    request.requester_name,
                    request.reason,
                    trx
               );

               await this.repo.addRequestItems(requestId, request.items, trx);
               await trx.commit();
               return requestId;
          } catch (error) {
               await trx.rollback();
               throw error;
          }
     }

     async approveRequest(request: ApproveFreeServiceRequestDTO): Promise<void> {
          const freeServiceRequest = await this.repo.getRequestById(request.request_id);
          if (!freeServiceRequest) {
               throw new Error(`Free service request with ID ${request.request_id} not found`);
          }

          if (freeServiceRequest.status !== FreeServiceRequestStatus.PENDING) {
               throw new Error(
                    `Cannot approve request. Current status: ${freeServiceRequest.status}. ` +
                    'Only PENDING requests can be approved.'
               );
          }

          const items = await this.repo.getRequestItems(request.request_id);
          if (items.length === 0) {
               throw new Error('Request has no items to approve');
          }

          const conn = await this.connection;
          const trx = await conn.transaction();

          try {
               await this.repo.approveRequest(
                    request.request_id,
                    request.reviewer_id,
                    request.reviewer_name,
                    request.reviewer_notes,
                    trx
               );

               await trx.commit();
          } catch (error) {
               await trx.rollback();
               throw error;
          }
     }

     async rejectRequest(request: RejectFreeServiceRequestDTO): Promise<void> {
          if (!request.reviewer_notes || request.reviewer_notes.trim().length === 0) {
               throw new Error('Rejection notes are required');
          }

          const conn = await this.connection;
          const freeServiceRequest = await this.repo.getRequestById(request.request_id);
          if (!freeServiceRequest) {
               throw new Error(`Free service request with ID ${request.request_id} not found`);
          }

          if (freeServiceRequest.status !== FreeServiceRequestStatus.PENDING) {
               throw new Error(
                    `Cannot reject request. Current status: ${freeServiceRequest.status}. ` +
                    'Only PENDING requests can be rejected.'
               );
          }

          const trx = await conn.transaction();

          try {
               await this.repo.rejectRequest(
                    request.request_id,
                    request.reviewer_id,
                    request.reviewer_name,
                    request.reviewer_notes,
                    trx
               );

               await trx.commit();
          } catch (error) {
               await trx.rollback();
               throw error;
          }
     }

     async getRequestStatus(requestId: number): Promise<FreeServiceRequestStatus | null> {
          return await this.repo.getRequestStatus(requestId);
     }

     async getRequest(requestId: number): Promise<any> {
          const request = await this.repo.getRequestById(requestId);
          if (!request) {
               return null;
          }

          const items = await this.repo.getRequestItems(requestId);
          const totalAmount = items.reduce(
               (sum, item) => sum + parseFloat(item.original_price.toString()),
               0
          );

          return {
               ...request,
               items,
               totalFreeAmount: totalAmount
          };
     }

     async listRequests(
          page: number = 1,
          limit: number = 20,
          status?: FreeServiceRequestStatus
     ): Promise<any> {
          return await this.repo.listRequests(page, limit, status);
     }

     async getApprovalSummary(): Promise<any> {
          return await this.repo.getApprovalSummary();
     }

     async withdrawPendingRequest(requestId: number, requesterId: number): Promise<void> {
          const request = await this.repo.getRequestById(requestId);
          if (!request) {
               throw new Error(`Request with ID ${requestId} not found`);
          }

          if (request.requester_id !== requesterId) {
               throw new Error('Can only withdraw own requests');
          }

          if (request.status !== FreeServiceRequestStatus.PENDING) {
               throw new Error(`Cannot withdraw request in ${request.status} status`);
          }

          const conn = await this.connection;
          const trx = await conn.transaction();

          try {
               await this.repo.deletePendingRequest(requestId, trx);
               await trx.commit();
          } catch (error) {
               await trx.rollback();
               throw error;
          }
     }

     async getRequestsByBillingId(billingId: number): Promise<any[]> {
          const items = await this.repo.getItemsByBillingId(billingId);
          if (items.length === 0) {
               return [];
          }

          const requestIds = [...new Set(items.map(item => item.request_id))];
          const requests = [];
          for (const requestId of requestIds) {
               const request = await this.getRequest(requestId);
               if (request) {
                    requests.push(request);
               }
          }

          return requests;
     }
}