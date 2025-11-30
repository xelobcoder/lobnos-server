import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";

interface CommissionBatchPayment {
     id?: number;
     batch_reference: string;
     recipient_type: 'clinician' | 'organization';
     recipient_id: number;
     start_date: Date;
     end_date: Date;
     total_commission_amount: number;
     payment_amount: number;
     waived_amount: number;
     status: 'pending' | 'completed' | 'cancelled';
     payment_date?: Date;
     created_by: number;
     notes?: string;
     created_at?: Date;
     updated_at?: Date;
}

export class CommissionBatchPaymentsRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     createBatchPayment = async (batchPayment: CommissionBatchPayment): Promise<number> => {
          try {
               const conn = await this.connection;
               // validate required fields
               if (!batchPayment.batch_reference || !batchPayment.recipient_type || !batchPayment.recipient_id ||
                    !batchPayment.start_date || !batchPayment.end_date || batchPayment.total_commission_amount === undefined ||
                    batchPayment.payment_amount === undefined || !batchPayment.created_by) {
                    throw new Error('Missing required fields for creating batch payment');
               }
               const [id] = await conn('commission_batch_payments').insert(batchPayment);
               return id;
          } catch (error) {
               logger.error('Error creating batch payment:', error);
               throw error;
          }
     }
}