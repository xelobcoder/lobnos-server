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

     async getAllResultDeliveryPreferencesForTransaction() {
          const connection = await this.connection;
          return await connection('patient_result_delivery_preference')
               .where({ billingid: this.billingid })
               .select('*');
     }


     async setResultDeliveryPreference(payload: any) {
          const connection = await this.connection;
          await connection('patient_result_delivery_preference')
               .insert({ ...payload, created_at: connection.fn.now() })
               .onConflict(['billingid'])
               .merge(payload as any);
          return true;
     }

     async setMultipleTestResultDeliveryPreferences(preferences: {
          billingid: number;
          ascension: number;
          patientid: number;
          requested_mode: string;
          requested_mode_detail?: string | null;
          updated_by_employeeid?: number | null;
     }, trx?: any) {
          try {
               const connection = trx ? await trx : await this.connection;
               const now = connection.fn.now();
               await connection('patient_result_delivery_preference')
                    .insert({
                         ...preferences,
                         created_at: now,
                         updated_at: now
                    })


                    await connection('result_delivery_log')
                    .insert({
                         ascensionid: preferences.ascension
                    })
               return true;
          } catch (err: any) {
               console.log(err)
               trx.rollback();
               throw new Error("Error loading preferences")
          }
     }
}
