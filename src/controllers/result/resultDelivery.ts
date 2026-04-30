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


     async setResultDeliveryPreference(payload:any) {
          const connection = await this.connection;
          await connection('patient_result_delivery_preference')
               .insert({ ...payload, created_at: connection.fn.now() })
               .onConflict(['billingid'])
               .merge(payload as any);
          return true;
     }

     async getTestResultDeliveryPreference(testid: number) {
          const connection = await this.connection;
          return await connection('test_result_delivery_preference')
               .where({ billingid: this.billingid, testid })
               .first();
     }

     async getAllTestResultDeliveryPreferences() {
          const connection = await this.connection;
          return await connection('test_result_delivery_preference')
               .where({ billingid: this.billingid })
               .select('*');
     }

     async setTestResultDeliveryPreference(payload: {
          billingid: number;
          testid: number;
          patientid: number;
          requested_mode: string;
          requested_mode_detail?: string | null;
          updated_by_employeeid?: number | null;
     }) {
          const connection = await this.connection;
          await connection('test_result_delivery_preference')
               .insert({
                    ...payload,
                    created_at: connection.fn.now(),
                    updated_at: connection.fn.now()
               })
               .onConflict(['billingid', 'testid'])
               .merge({
                    requested_mode: payload.requested_mode,
                    requested_mode_detail: payload.requested_mode_detail,
                    updated_by_employeeid: payload.updated_by_employeeid,
                    updated_at: connection.fn.now()
               } as any);
          return true;
     }

     async setMultipleTestResultDeliveryPreferences(preferences: Array<{
          billingid: number;
          ascensionid: number;
          patientid: number;
          requested_mode: string;
          requested_mode_detail?: string | null;
          updated_by_employeeid?: number | null;
     }>) {
          const connection = await this.connection;
          const now = connection.fn.now();

          for (const pref of preferences) {
               await connection('patient_result_delivery_preference')
                    .insert({
                         ...pref,
                         created_at: now,
                         updated_at: now
                    })
                    .onConflict(['billingid', 'ascensionid'])
                    .merge({
                         requested_mode: pref.requested_mode,
                         requested_mode_detail: pref.requested_mode_detail,
                         updated_by_employeeid: pref.updated_by_employeeid,
                         updated_at: now
                    } as any);
          }
          return true;
     }
}