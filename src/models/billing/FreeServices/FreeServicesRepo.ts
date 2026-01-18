import KnexConnection from '../../../database/KnexConnections';
import { FreeServiceRequestStatus, FreeServiceRequest, FreeServiceRequestItem } from './types';


export class FreeServicesRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async createRequest(
          requesterId: number,
          requesterName: string,
          reason: string,
          trx?: any
     ): Promise<number> {
          const conn = trx || (await this.connection);
          const [requestId] = await conn('free_service_requests').insert({
               requester_id: requesterId,
               requester_name: requesterName,
               reason: reason,
               status: FreeServiceRequestStatus.PENDING,
               created_at: new Date(),
               updated_at: new Date()
          });
          return requestId;
     }

     async addRequestItems(
          requestId: number,
          items: Array<{
               billing_id: number;
               service_id: number;
               service_name: string;
               original_price: number;
          }>,
          trx?: any
     ): Promise<void> {
          const conn = trx || (await this.connection);
          const itemsData = items.map((item) => ({
               request_id: requestId,
               billing_id: item.billing_id,
               service_id: item.service_id,
               service_name: item.service_name,
               original_price: item.original_price,
               created_at: new Date()
          }));
          await conn('free_service_request_items').insert(itemsData);
     }

     async getRequestById(requestId: number): Promise<FreeServiceRequest | null> {
          const conn = await this.connection;
          return conn('free_service_requests')
               .where({ id: requestId })
               .first();
     }

     async getRequestItems(requestId: number): Promise<FreeServiceRequestItem[]> {
          const conn = await this.connection;
          return conn('free_service_request_items')
               .where({ request_id: requestId })
               .orderBy('created_at', 'asc');
     }

     async getItemsByBillingId(billingId: number): Promise<FreeServiceRequestItem[]> {
          const conn = await this.connection;
          return conn('free_service_request_items')
               .where({ billing_id: billingId })
               .orderBy('created_at', 'asc');
     }

     async approveRequest(
          requestId: number,
          reviewerId: number,
          reviewerName: string,
          reviewerNotes: string | null,
          trx?: any
     ): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('free_service_requests')
               .where({ id: requestId })
               .update({
                    status: FreeServiceRequestStatus.APPROVED,
                    reviewer_id: reviewerId,
                    reviewer_name: reviewerName,
                    reviewer_notes: reviewerNotes || null,
                    approved_at: new Date(),
                    updated_at: new Date()
               });
     }

     async rejectRequest(
          requestId: number,
          reviewerId: number,
          reviewerName: string,
          reviewerNotes: string,
          trx?: any
     ): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('free_service_requests')
               .where({ id: requestId })
               .update({
                    status: FreeServiceRequestStatus.REJECTED,
                    reviewer_id: reviewerId,
                    reviewer_name: reviewerName,
                    reviewer_notes: reviewerNotes,
                    rejected_at: new Date(),
                    updated_at: new Date()
               });
     }

     async getRequestStatus(requestId: number): Promise<FreeServiceRequestStatus | null> {
          const conn = await this.connection;
          const result = await conn('free_service_requests')
               .where({ id: requestId })
               .select('status')
               .first();
          return result ? result.status : null;
     }

     async listRequests(
          page: number = 1,
          limit: number = 20,
          status?: FreeServiceRequestStatus
     ): Promise<{
          data: FreeServiceRequest[];
          total: number;
          page: number;
          totalPages: number;
     }> {
          const conn = await this.connection;
          let query = conn('free_service_requests');

          if (status) {
               query = query.where({ status });
          }

          const total = await query.clone().count('* as count').first();
          const totalCount = total.count;

          const data = await query
               .orderBy('created_at', 'desc')
               .limit(limit)
               .offset((page - 1) * limit);

          return {
               data,
               total: totalCount,
               page,
               totalPages: Math.ceil(totalCount / limit)
          };
     }

     async getApprovalSummary(): Promise<{
          pending: number;
          approved: number;
          rejected: number;
          total: number;
     }> {
          const conn = await this.connection;
          const result = await conn('free_service_requests')
               .select(
                    conn.raw(`
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected,
                    COUNT(*) as total
               `, [
                         FreeServiceRequestStatus.PENDING,
                         FreeServiceRequestStatus.APPROVED,
                         FreeServiceRequestStatus.REJECTED
                    ])
               )
               .first();

          return {
               pending: result.pending || 0,
               approved: result.approved || 0,
               rejected: result.rejected || 0,
               total: result.total || 0
          };
     }

     async deletePendingRequest(requestId: number, trx?: any): Promise<void> {
          const conn = trx || (await this.connection);
          await conn('free_service_requests')
               .where({ id: requestId })
               .where({ status: FreeServiceRequestStatus.PENDING })
               .delete();
     }

     async getTotalFreeAmountForRequest(requestId: number): Promise<number> {
          const conn = await this.connection;
          const result = await conn('free_service_request_items')
               .where({ request_id: requestId })
               .sum('original_price as total')
               .first();
          return result.total || 0;
     }

     async getTotalFreeAmountForBilling(billingId: number): Promise<number> {
          const conn = await this.connection;
          const result = await conn('free_service_request_items')
               .where({ billing_id: billingId })
               .sum('original_price as total')
               .first();
          return result.total || 0;
     }
}
