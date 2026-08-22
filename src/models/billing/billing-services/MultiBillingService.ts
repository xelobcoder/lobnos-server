import { MultiTBillingDataShared } from "../multi/billing_shared_types";

export default class MultiBillingService {
     private tenantId: number;
     private payload: MultiTBillingDataShared
     constructor(tenantId: number, payload: any) {
          this.tenantId = tenantId;
          this.payload = payload;
     }
}