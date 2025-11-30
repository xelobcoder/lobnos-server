import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";

interface CommissionPaymentTransaction {
     id?: number;
     batch_payment_service_id: number;
     amount_paid: number;
     trackid?: number;
     paymentmode?: number;
     paid_by?: number;
     notes?: string;
     created_at?: Date;
}

export class CommissionPaymentTransactionsRepo {
     private tenantId: number;
     private connection: any;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     // Add methods as needed, e.g., create, get, etc.
}