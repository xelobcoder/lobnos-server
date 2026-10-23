import KnexConnection from "../../database/KnexConnections";

export default class ResultDeliveryClass {
     private billingid: number;
     private tenantId: number;
     private connection: any
     constructor(billingid: number, tenantId: number, private branchid?: number | null) {
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
          const query = connection('test_ascension as test')
               .join('billing as bill', 'bill.billingid', 'test.billingid')
               .join('dbotestresultapproval as approval', 'approval.ascensionid', 'test.id')
               .join('new_patients', 'new_patients.patientid', 'bill.patientid')
               .leftJoin('patient_result_delivery_preference as preference', 'preference.ascension', 'test.id')
               .leftJoin('result_delivery_log as delivery', 'delivery.ascensionid', 'test.id')
               .where('approval.isapproved', 1).whereNotNull('test.resultEntryEnd')
               .where(function () { this.whereNull('delivery.delivered_mode').orWhere('delivery.delivered_mode', 'not_delivered'); });
          if (this.branchid != null) query.where('bill.branchid', this.branchid);
          if (startDate) query.whereRaw('DATE(test.resultEntryEnd) >= ?', [startDate]);
          if (endDate) query.whereRaw('DATE(test.resultEntryEnd) <= ?', [endDate]);
          const total = await query.clone().countDistinct('test.id as total').first();
          const safeCount = Math.min(100, Math.max(1, Number(count) || 20));
          const safePage = Math.max(1, Number(page) || 1);
          const dataset = await query.select('new_patients.*', 'preference.requested_mode', 'preference.requested_mode_detail',
               'delivery.delivered_mode', 'delivery.delivered_at', 'delivery.delivered_by_employeeid', 'delivery.failurenotes',
               'test.id as ascensionid', 'test.billingid', 'test.testid')
               .orderBy('test.resultEntryEnd').orderBy('test.id').limit(safeCount).offset((safePage - 1) * safeCount);
          return { totalcount: Number(total?.total || 0), dataset };
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
                    if (entry.delivered_mode && !entry.failurenotes && (!test.resultEntryEnd || Number(approval?.isapproved) !== 1 || Number(approval?.requires_revalidation) === 1)) {
                         if (entry.ascensionid == null) continue;
                         throw Object.assign(new Error('Only finalized results can be marked delivered'), { statusCode: 409 });
                    }
                    const now = new Date();
                    await trx('result_delivery_attempts').insert({ billingid: entry.billingid, ascensionid: test.id,
                         delivered_mode: entry.failurenotes ? null : entry.delivered_mode, employeeid: entry.delivered_by_employeeid,
                         notes: entry.notes || null, failure_notes: entry.failurenotes || null, created_at: now });
                    const existing = await trx('result_delivery_log').where({ ascensionid: test.id }).first();
                    // A failed retry must not erase an earlier successful delivery.
                    const values: any = { ascensionid: test.id,
                         notes: entry.notes?.slice(0, 255) || null, failurenotes: entry.failurenotes || null };
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
               const bill = await connection('billing').where({ billingid: this.billingid }).first('branchid');
               if (!bill || (this.branchid != null && Number(bill.branchid) !== Number(this.branchid))) throw Object.assign(new Error('Billing access denied'), { statusCode: 403 });
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



               const attempts = await connection('result_delivery_attempts as attempt').leftJoin('roles as operator', 'operator.employeeid', 'attempt.employeeid')
                    .where('attempt.billingid', this.billingid).select('attempt.*', 'operator.username').orderBy('attempt.id', 'asc');
               return { status: true, billingid: this.billingid, handovers, deliveries, attempts }
          } catch (err: any) {
               console.log(err)
               if (err.statusCode) throw err;
               throw new Error("Error fetching result delivery chain")
          }
     }
}
