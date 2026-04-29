import KnexConnection from "../../database/KnexConnections";

export default class ResultDeliveryClass {
     private billingid: number;
     private tenantId: number;
     private connection: any
     constructor(billingid: number, tenantId: number) {
          this.billingid = billingid;
          this.tenantId = tenantId;
          this.connection = KnexConnection(this.tenantId);
     }


     async getResultDeliveryForTransaction() {
          const connection = await this.connection;
          return await connection('patient_result_delivery_preference').where({ billingid: this.billingid }).first();
     }


     async setResultDeliveryPreference(payload) {
          const connection = await this.connection;
          await connection('patient_result_delivery_preference')
               .insert({ ...payload, created_at: connection.fn.now() })
               .onConflict(['billingid'])
               .merge(payload as any);
          return true;
     }
}