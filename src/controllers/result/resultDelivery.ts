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

     async getResultsUndelivered(startDate: string, endDate: string, page: number, count: number) {
          const connection = await this.connection;
          const query = connection('patient_result_delivery_preference')
               .innerJoin('result_delivery_log', 'patient_result_delivery_preference.ascension', 'result_delivery_log.ascensionid')
               .innerJoin('new_patients', 'patient_result_delivery_preference.patientid', 'new_patients.patientid')
               .where('delivered_at', null)
               .orWhere('delivered_mode', null)

          if (startDate && endDate) {
               query.andWhereBetween('created_at', [startDate, endDate])
          }

          const totalcountofUndeliveredResults = await query.clone().count('* as total').first();
          const totalcount = totalcountofUndeliveredResults?.total || 0;

          if (page && count) {
               const offset = (page - 1) * count;
               query.offset(offset).limit(count);
          }

          const dataset = await query.select('result_delivery_log.*',
               'new_patients.patientid',
               'new_patients.firstname', 'new_patients.lastname',
               'new_patients.age', 'new_patients.gender',
               'new_patients.ageType', 'new_patients.dob', 'new_patients.mobile_number as contact',
               'new_patients.fullpatientid', 'new_patients.designation',
               'patient_result_delivery_preference.*');
          return { totalcount, dataset };

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
