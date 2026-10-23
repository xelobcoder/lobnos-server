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
               .leftJoin('result_delivery_log', 'patient_result_delivery_preference.ascension', 'result_delivery_log.ascensionid')
               .innerJoin('new_patients', 'patient_result_delivery_preference.patientid', 'new_patients.patientid')
               .where(function (this: any) {
                    this.whereNull('result_delivery_log.delivered_mode')
                         .orWhere('result_delivery_log.delivered_mode', 'not_delivered');
               });

          if (startDate && endDate) {
               query.andWhereRaw(
                    'DATE(patient_result_delivery_preference.created_at) BETWEEN ? AND ?',
                    [startDate, endDate]
               );
          }

          const totalcountofUndeliveredResults = await query.clone().count('* as total').first();
          const totalcount = totalcountofUndeliveredResults?.total || 0;

          if (page && count) {
               const offset = (page - 1) * count;
               query.offset(offset).limit(count);
          }

          const dataset = await query.select('result_delivery_log.*',
               'patient_result_delivery_preference.ascension as ascensionid',
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
               if (trx) {
                    await trx.rollback();
               }
               throw new Error("Error loading preferences")
          }
     }

     async updateResultDeliveryLog(entry: {
          ascensionid: number | null;
          billingid: number;
          delivered_mode: string | null;
          delivered_by_employeeid: number;
          notes?: string | null;
          failurenotes?: string | null;
     }) {
          const db = await this.connection;
          return db.transaction(async trx => {
               const bill = await trx('billing').where({ billingid: entry.billingid }).forUpdate().first();
               if (!bill) throw Object.assign(new Error('Billing record not found'), { statusCode: 404 });
               let tests = trx('test_ascension').where({ billingid: entry.billingid });
               if (entry.ascensionid != null) tests = tests.where('id', entry.ascensionid);
               const ascensions = await tests.orderBy('id').forUpdate();
               if (!ascensions.length) throw Object.assign(new Error('Ordered test does not belong to this bill'), { statusCode: 404 });
               let affected = 0;
               for (const test of ascensions) {
                    const approval = await trx('dbotestresultapproval').where({ ascensionid: test.id }).first();
                    if (entry.delivered_mode && !entry.failurenotes && (!test.resultEntryEnd || Number(approval?.isapproved) !== 1)) {
                         if (entry.ascensionid == null) continue;
                         throw Object.assign(new Error('Only finalized results can be marked delivered'), { statusCode: 409 });
                    }
                    const now = new Date();
                    await trx('result_delivery_attempts').insert({ billingid: entry.billingid, ascensionid: test.id,
                         delivered_mode: entry.failurenotes ? null : entry.delivered_mode, employeeid: entry.delivered_by_employeeid,
                         notes: entry.notes || null, failure_notes: entry.failurenotes || null, created_at: now });
                    const existing = await trx('result_delivery_log').where({ ascensionid: test.id }).first();
                    // A failed retry must not erase an earlier successful delivery.
                    const values: any = { billingid: entry.billingid, ascensionid: test.id,
                         notes: entry.notes || null, failurenotes: entry.failurenotes || null };
                    if (!entry.failurenotes) Object.assign(values, { delivered_mode: entry.delivered_mode, delivered_by_employeeid: entry.delivered_by_employeeid, delivered_at: now });
                    if (existing) await trx('result_delivery_log').where({ ascensionid: test.id }).update(values);
                    else await trx('result_delivery_log').insert(values);
                    affected++;
               }
               if (!affected) throw Object.assign(new Error('No finalized results are available for delivery'), { statusCode: 409 });
               return affected;
          });
     }

     async getResultDeliveryChain(): Promise<{ status: boolean, billingid: number, handovers: any[], deliveries: any[]; attempts?: any[] }> {
          try {
               const connection = await this.connection;
               const handovers = await connection('result_handover_log')
                    .leftJoin('roles as r_from', 'result_handover_log.from_employeeid', 'r_from.employeeid')
                    .leftJoin('roles as r_to', 'result_handover_log.to_employeeid', 'r_to.employeeid')
                    .select(
                         'result_handover_log.*',
                         'r_from.username as from_username',
                         'r_from.role as from_role',
                         'r_to.username as to_username',
                         'r_to.role as to_role'
                    )
                    .where('result_handover_log.billingid', this.billingid)
                    .orderBy('result_handover_log.created_at', 'asc');

               const deliveries = await connection('result_delivery_log')
                    .join('test_ascension as test', 'test.id', 'result_delivery_log.ascensionid')
                    .leftJoin('roles as r_deliver', 'result_delivery_log.delivered_by_employeeid', 'r_deliver.employeeid')
                    .select(
                         'result_delivery_log.*',
                         'r_deliver.username as delivered_by_username',
                         'r_deliver.role as delivered_by_role'
                    )
                    .where('test.billingid', this.billingid)
                    .orderBy('result_delivery_log.delivered_at', 'asc');



               const attempts = await connection('result_delivery_attempts').where({ billingid: this.billingid }).orderBy('id', 'asc');
               return { status: true, billingid: this.billingid, handovers, deliveries, attempts }
          } catch (err: any) {
               console.log(err)
               throw new Error("Error fetching result delivery chain")
          }
     }
}
