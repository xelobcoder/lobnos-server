from pathlib import Path
p=Path('src/models/payments/multi-payment.ts');s=p.read_text(encoding='utf-8');s=s.replace('import { enqueueBillingPayment }',"import { createHash } from 'crypto';\nimport { minorUnits, sumMinor } from '../../accountingModule/utils/money';\nimport { enqueueBillingWriteOff } from '../../accountingModule/integrations/BillingAccounting';\nimport { enqueueBillingPayment }",1);s=s.replace('     idempotencyKey?: string;', '     idempotencyKey?: string;\n     requestKey?: string;')
a=s.index('               const calculatedTotal =');b=s.index('               const trx = await connection.transaction();',a)
s=s[:a]+'''               if (!paymentData.service_payments?.length) throw new Error('Select at least one service');
               const serviceIds = paymentData.service_payments.map(p => p.service_id);
               if (new Set(serviceIds).size !== serviceIds.length) throw new Error('A service cannot appear twice');
               for (const payment of paymentData.service_payments) {
                    if (!Number.isSafeInteger(payment.service_id) || payment.service_id <= 0 || !Number.isSafeInteger(payment.billing_id) || payment.billing_id <= 0) throw new Error('Invalid service or bill');
                    const amount = minorUnits(payment.amount), waived = minorUnits(payment.waive_off ?? 0);
                    if (amount < 0 || waived < 0 || amount + waived <= 0 || minorUnits(payment.discount ?? 0) !== 0) throw new Error('Invalid payment or waiver amount');
                    if (amount > 0 && !(Number(payment.payment_mode_id) > 0)) throw new Error('Select a payment method');
               }
               if (sumMinor(paymentData.service_payments.map(p => p.amount)) !== minorUnits(paymentData.total_amount) ||
                    sumMinor(paymentData.service_payments.map(p => p.waive_off ?? 0)) !== minorUnits(paymentData.total_waive_off ?? 0)) throw new Error('Payment and waiver totals must exactly match the selected services');
               if (paymentData.requestKey && !/^[a-zA-Z0-9_-]{16,80}$/.test(paymentData.requestKey)) throw new Error('Invalid payment request key');

'''+s[b:]
needle='''               try {
                    if (paymentData.idempotencyKey)'''
s=s.replace(needle,'''               try {
                    if (paymentData.requestKey) {
                         const fingerprint = createHash('sha256').update(JSON.stringify({ employeeid: paymentData.employeeid, payments: [...paymentData.service_payments].sort((a,b) => a.service_id - b.service_id).map(p => [p.service_id, p.billing_id, minorUnits(p.amount), minorUnits(p.waive_off ?? 0), Number(p.payment_mode_id)]) })).digest('hex');
                         try { await trx('acc_collection_requests').insert({ request_key: paymentData.requestKey, fingerprint, created_at: new Date() }); }
                         catch (error: any) {
                              if (error?.code !== 'ER_DUP_ENTRY') throw error;
                              const existing = await trx('acc_collection_requests').where({ request_key: paymentData.requestKey }).forUpdate().first();
                              if (existing?.fingerprint !== fingerprint) throw new Error('This payment request key was used for different amounts');
                              await trx.rollback();
                              return { success: true, message: 'Payment was already applied', alreadyApplied: true };
                         }
                    }
                    // Consistent bill ordering serializes concurrent collectors and bill-level totals.
                    for (const billingid of [...new Set(paymentData.service_payments.map(p => p.billing_id))].sort((a,b) => a-b)) {
                         const bill = await trx(this.billingTable).where({ billingid }).forUpdate().first();
                         if (!bill) throw new Error('Billing record not found');
                    }
                    if (paymentData.idempotencyKey)''',1)
s=s.replace(".where({ [`${this.servicesTable}.serviceid`]: servicePayment.service_id })\n                              .first();", ".where({ [`${this.servicesTable}.serviceid`]: servicePayment.service_id })\n                              .forUpdate().first();",1)
s=s.replace('''                         if (service.outstanding <= 0) {''','''                         if (Number(service.billingid) !== servicePayment.billing_id) throw new Error('Service does not belong to the selected bill');
                         if (service.outstanding <= 0) {''',1)
s=s.replace('const newPaidAmount = currentPaid + servicePayment.amount;', 'const newPaidAmount = (minorUnits(currentPaid) + minorUnits(servicePayment.amount)) / 100;')
s=s.replace('const newOutstanding = Math.max(0, currentOutstanding - servicePayment.amount - waiveOffAmount);', '''const remaining = minorUnits(currentOutstanding) - minorUnits(servicePayment.amount) - minorUnits(waiveOffAmount);
                         if (remaining < 0) throw new Error('Payment and waiver exceed the latest outstanding balance. Reload and review the bill.');
                         const newOutstanding = remaining / 100;''')
s=s.replace(".leftJoin('dbobillingrefundtable', 'dboservices.serviceid', 'dbobillingrefundtable.serviceid')\n                              .select(\n                                   'dboservices.*',\n                                   'dbobillingrefundtable.amountRefunded'\n                              )", ".select('dboservices.*')")
# use minorunit sums and remove unused refund total
for field,col in [('totalPaid','paidamount'),('totalOutstanding','outstanding'),('totalPayable','totalpayable')]:
 import re
 s=re.sub(r'const '+field+r' = billingServices.reduce\([^\n]+;', 'const '+field+' = sumMinor(billingServices.map(service => service.'+col+' || 0)) / 100;', s)
s='\n'.join(line for line in s.split('\n') if 'const totalRefunded = billingServices.reduce' not in line)
s=s.replace('''                         const newWriteOff = existingWriteOff + currentWaiveOff;''','''                         const newWriteOff = (minorUnits(existingWriteOff) + minorUnits(currentWaiveOff)) / 100;
                         if (currentWaiveOff > 0) await enqueueBillingWriteOff(this.tenantId, billingId, currentWaiveOff, paymentData.employeeid, trx, paymentData.requestKey || paymentData.idempotencyKey || `collection-${Date.now()}-${billingId}`);''')
p.write_text(s,encoding='utf-8')
p=Path('src/accountingModule/integrations/BillingAccounting.ts');s=p.read_text(encoding='utf-8');a=s.index('export async function enqueueBillingWriteOff(');b=s.index('\nexport ',a+10);chunk=s[a:b];chunk=chunk.replace('trx?: any\n','trx?: any,\n     sourceRef = \'\'\n',1);chunk=chunk.replace("sourceTable: 'billing_writeoff',", "sourceTable: 'billing_writeoff',\n                    sourceRef,");chunk=chunk.replace('sourceRef: String(billingId),', 'sourceRef: sourceRef ? `${billingId}:${sourceRef}` : String(billingId),');s=s[:a]+chunk+s[b:];p.write_text(s,encoding='utf-8')
p=Path('src/controllers/printables/MultiPaymentHamdler.ts');s=p.read_text(encoding='utf-8');s=s.replace('''          const paymentData = {''','''          const requestKey = req.body.request_key;
          if (typeof requestKey !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey)) {
               res.status(400).json({ success: false, message: 'Reload Cash Collection before submitting this payment.' });
               return;
          }
          const paymentData = {
               requestKey,''',1);p.write_text(s,encoding='utf-8')
p=Path('src/accountingModule/init/accountingSchemaInit.ts');s=p.read_text(encoding='utf-8');needle="     if (!(await knex.schema.hasTable('acc_control_audit'))) {";s=s.replace(needle,"""     if (!(await knex.schema.hasTable('acc_collection_requests'))) {
          await knex.schema.createTable('acc_collection_requests', table => {
               table.string('request_key', 80).primary();
               table.string('fingerprint', 64).notNullable();
               table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
          });
     }

"""+needle,1);p.write_text(s,encoding='utf-8')
