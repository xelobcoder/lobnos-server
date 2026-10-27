import { PrimeLimsTabledboservices } from "../../database/DatabaseTableSchema";
import type { Knex } from 'knex';
import KnexConnection from "../../database/KnexConnections";
import AutomatedExpenseLifecycle from "../Expenses/AutomatedExpenseLifecycle";
import { enqueueBillingPayment } from "../../accountingModule/integrations/BillingAccounting";



type ServicePayment = {
     service_id: number;
     amount: number;
     discount: number;
     waive_off: number;
     payment_mode_id: number;
     billing_id: number;
}

type MultiServicePaymentRequest = {
     service_payments: ServicePayment[];
     total_amount: number;
     total_discount: number;
     total_waive_off: number;
     description: string;
     employeeid: number;
     tenantId: number;
     /** When set, the payment is recorded at most once for this key (a verified gateway reference). */
     idempotencyKey?: string;
}

type PaymentRequestBody = {
     tenantId: number,
     patientid: number,
     amount: number,
     pymode: string,
     employeeid: number,
     paymentRequestType: "service" | "transaction" | "debtClearance",
     billingid?: number,
     serviceid?: number
}

export default class MultiPayment {
     private connection: any;
     private tenantId: number;
     private bhxTable: string;
     private billingTable: string;
     private servicesTable: string;

     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(this.tenantId);
          this.bhxTable = "billinghx";
          this.billingTable = "billing";
          this.servicesTable = "dboservices";
     }

     public async processPayment(paymentData: MultiServicePaymentRequest): Promise<{ success: boolean; message: string; transactionId?: string; alreadyApplied?: boolean }> {
          const connection = await this.connection;

          try {
               const calculatedTotal = paymentData.service_payments.reduce((sum, payment) => sum + payment.amount, 0);
               if (Math.abs(calculatedTotal - paymentData.total_amount) > 0.01) {
                    return {
                         success: false,
                         message: `Total amount mismatch. Expected: ${calculatedTotal}, Received: ${paymentData.total_amount}`
                    };
               }

               const serviceIds = paymentData.service_payments.map(p => p.service_id);
               const servicesCheck = await connection(this.servicesTable)
                    .select('serviceid', 'outstanding')
                    .whereIn('serviceid', serviceIds);

               const invalidServices = servicesCheck.filter((service: any) => service.outstanding <= 0);
               if (invalidServices.length > 0) {
                    const invalidIds = invalidServices.map((s: any) => s.serviceid).join(', ');
                    throw new Error(`Cannot process payment for services with no outstanding balance: ${invalidIds}. These services are already fully paid.`);
               }

               const trx = await connection.transaction();

               try {
                    if (paymentData.idempotencyKey) {
                         try {
                              await trx('gateway_payment_applications').insert({
                                   reference: paymentData.idempotencyKey,
                                   billing_id: paymentData.service_payments[0].billing_id,
                                   amount_minor: Math.round(paymentData.total_amount * 100),
                              });
                         } catch (error: any) {
                              if (error?.code !== 'ER_DUP_ENTRY') throw error;
                              await trx.rollback();
                              return { success: true, message: 'Payment was already applied', alreadyApplied: true };
                         }
                    }
                    const waiveOffsPerBilling: Record<number, number> = {};

                    for (const servicePayment of paymentData.service_payments) {
                         const service = await trx(this.servicesTable)
                              .join(this.billingTable, `${this.servicesTable}.billingid`, `${this.billingTable}.billingid`)
                              .select(`${this.servicesTable}.*`, `${this.billingTable}.patientid`)
                              .where({ [`${this.servicesTable}.serviceid`]: servicePayment.service_id })
                              .first();

                         if (!service) {
                              throw new Error(`Service with ID ${servicePayment.service_id} not found`);
                         }

                         if (service.outstanding <= 0) {
                              throw new Error(`Service with ID ${servicePayment.service_id} has no outstanding balance`);
                         }

                         const currentPaid = parseFloat(service.paidamount as string) || 0;
                         const currentOutstanding = parseFloat(service.outstanding as string) || 0;

                         const newPaidAmount = currentPaid + servicePayment.amount;
                         const totalPayable = parseFloat(service.totalpayable as string) || 0;

                         // If there's a waive-off, it reduces the outstanding balance without increasing paid amount
                         const waiveOffAmount = servicePayment.waive_off || 0;
                         const newOutstanding = Math.max(0, currentOutstanding - servicePayment.amount - waiveOffAmount);

                         // Track waive-off per billing for billing table update
                         if (waiveOffAmount > 0) {
                              waiveOffsPerBilling[servicePayment.billing_id] = (waiveOffsPerBilling[servicePayment.billing_id] || 0) + waiveOffAmount;
                         }

                         let newPaymentStatus = service.paymentstatus;
                         let newServiceStatus = service.status;

                         if (newOutstanding === 0) {
                              newPaymentStatus = 'paid';
                              if (waiveOffAmount > 0 && servicePayment.amount === 0) {
                                   newServiceStatus = 'written-off';
                              }
                         } else if (newPaidAmount > 0 || waiveOffAmount > 0) {
                              newPaymentStatus = 'partial';
                         }

                         await trx(this.servicesTable)
                              .where({ serviceid: servicePayment.service_id })
                              .update({
                                   paidamount: newPaidAmount,
                                   outstanding: newOutstanding,
                                   paymentstatus: newPaymentStatus,
                                   status: newServiceStatus,
                                   totalpayable: totalPayable
                              });

                         if (servicePayment.amount > 0) {
                              const insertedHistory = await trx(this.bhxTable).insert({
                                   billingid: servicePayment.billing_id,
                                   paymentmode: servicePayment.payment_mode_id,
                                   amount: servicePayment.amount,
                                   employeeid: paymentData.employeeid,
                                   type: 'credit'
                              });
                              const historyId = Number(Array.isArray(insertedHistory) ? insertedHistory[0] : insertedHistory);
                              if (!historyId) throw new Error('Could not create payment history for accounting posting');
                              await enqueueBillingPayment(
                                   this.tenantId,
                                   historyId,
                                   servicePayment.billing_id,
                                   servicePayment.amount,
                                   paymentData.employeeid,
                                   trx
                              );
                         }

                         // If waive_off > 0, insert into expenses as bad debt with full lifecycle (Expense -> Approval -> Invoice -> Payment)
                         if (waiveOffAmount > 0) {
                              const lifecycle = new AutomatedExpenseLifecycle(this.tenantId);
                              await lifecycle.process({
                                   amount: waiveOffAmount,
                                   name: `Bad Debt Waive-off - Service ${servicePayment.service_id}`,
                                   description: `Automated bad debt entry for waived-off amount on service ${servicePayment.service_id}. Billing ID: ${servicePayment.billing_id}. Patient ID: ${service.patientid}`,
                                   categoryName: "Bad Debt",
                                   merchantName: "BAD DEBT",
                                   date: new Date(),
                                   branchid: service.branchid,
                                   employeeid: paymentData.employeeid,
                                   serviceid: servicePayment.service_id,
                                   isassociatedservice: 1,
                                   invoicePrefix: "BAD-DEBT"
                              }, trx);
                         }
                    }

                    const uniqueBillingIds = [...new Set(paymentData.service_payments.map(p => p.billing_id))];

                    for (const billingId of uniqueBillingIds) {
                         const billingServices = await trx(this.servicesTable)
                              .leftJoin('dbobillingrefundtable', 'dboservices.serviceid', 'dbobillingrefundtable.serviceid')
                              .select(
                                   'dboservices.*',
                                   'dbobillingrefundtable.amountRefunded'
                              )
                              .where({ 'dboservices.billingid': billingId });

                         const totalPaid = billingServices.reduce((sum: number, service) => sum + (parseFloat(service.paidamount as string) || 0), 0);
                         const totalOutstanding = billingServices.reduce((sum, service) => sum + (parseFloat(service.outstanding as string) || 0), 0);
                         const totalPayable = billingServices.reduce((sum, service) => sum + (parseFloat(service.totalpayable as string) || 0), 0);
                         const totalRefunded = billingServices.reduce((sum, service) => sum + (parseFloat(service.amountRefunded as string) || 0), 0);

                         const billingRecord = await trx(this.billingTable).where({ billingid: billingId }).first();
                         const existingWriteOff = parseFloat(billingRecord?.writeoff as string) || 0;
                         const currentWaiveOff = waiveOffsPerBilling[billingId] || 0;
                         const newWriteOff = existingWriteOff + currentWaiveOff;

                         let newStatus = totalOutstanding === 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'pending');

                         // If the entire outstanding was cleared via waive-off/write-off
                         if (totalOutstanding === 0 && currentWaiveOff > 0 && totalPaid === existingWriteOff) {
                              newStatus = 'written-off';
                         }

                         const updateData: any = {
                              paid: totalPaid,
                              outstanding: totalOutstanding,
                              payable: totalPayable,
                              status: newStatus,
                              clientstatus: newStatus,
                              writeoff: newWriteOff,
                              lastupdatedby: paymentData.employeeid
                         };

                         if (currentWaiveOff > 0) {
                              updateData.adjustmentType = 'written-off';
                              updateData.adjustmentamount = currentWaiveOff;
                              updateData.adjustmentReason = `Waived off amount during multi-payment process. Total waived: ${currentWaiveOff}`;
                              updateData.adjustedBy = paymentData.employeeid;
                              updateData.adjustmentdate = new Date();
                              updateData.isAdjustment = 1;
                         }

                         await trx(this.billingTable)
                              .where({ billingid: billingId })
                              .update(updateData);
                    }

                    await trx.commit();

                    return {
                         success: true,
                         message: `Successfully processed payment for ${paymentData.service_payments.length} service(s)`,
                         transactionId: `TXN_${Date.now()}_${paymentData.tenantId}`
                    };

               } catch (error) {
                    await trx.rollback();
                    throw error;
               }

          } catch (error) {
               console.error('Payment processing error:', error);
               return {
                    success: false,
                    message: error instanceof Error ? error.message : 'Payment processing failed'
               };
          }
     }

     public async listOutstandingBills({ startDate, endDate, search, page = 1, count = 25 }: { startDate?: string; endDate?: string; search?: string; page?: number; count?: number }) {
          const connection = await this.connection;
          const pageSize = Math.min(Math.max(count, 1), 100);
          const offset = (Math.max(page, 1) - 1) * pageSize;

          const base = () => {
               const q = connection(`${this.billingTable} as b`)
                    .leftJoin('new_patients as p', 'p.patientid', 'b.patientid')
                    .where('b.outstanding', '>', 0);
               if (startDate && endDate) q.whereRaw('DATE(b.billedon) BETWEEN ? AND ?', [startDate, endDate]);
               if (search) {
                    const like = `%${search}%`;
                    q.where((w: any) => w
                         .whereRaw("CONCAT_WS(' ', p.firstname, p.middlename, p.lastname) LIKE ?", [like])
                         .orWhere('p.fullpatientid', 'like', like)
                         .orWhere('p.mobile_number', 'like', like)
                         .orWhereRaw('CAST(b.billingid AS CHAR) LIKE ?', [like])
                         .orWhereRaw('CAST(b.patientid AS CHAR) = ?', [search]));
               }
               return q;
          };

          const [summary] = await base().select(
               connection.raw('COUNT(*) AS bills'),
               connection.raw('COUNT(DISTINCT b.patientid) AS patients'),
               connection.raw('COALESCE(SUM(b.outstanding), 0) AS totalOutstanding'),
               connection.raw('COALESCE(SUM(b.paid), 0) AS totalPaid'),
          );

          const records = await base()
               .select(
                    'b.billingid', 'b.patientid', 'b.billedon', 'b.payable', 'b.paid', 'b.outstanding',
                    'p.fullpatientid', 'p.mobile_number',
                    connection.raw("TRIM(CONCAT_WS(' ', p.firstname, p.middlename, p.lastname)) AS patient_name"),
                    connection.raw('DATEDIFF(CURDATE(), DATE(b.billedon)) AS age_days'),
               )
               .orderBy('b.billedon', 'asc')
               .limit(pageSize)
               .offset(offset);

          return {
               records,
               page: Math.max(page, 1),
               count: pageSize,
               summary: {
                    bills: Number(summary?.bills || 0),
                    patients: Number(summary?.patients || 0),
                    totalOutstanding: Number(summary?.totalOutstanding || 0),
                    totalPaid: Number(summary?.totalPaid || 0),
               },
          };
     }

     public async getOutstandingPayments({ patientid, status = "pending", billingid }: { patientid?: number, status?: "completed" | "all" | "pending", billingid?: number | number[] }) {
          const connection = await this.connection;

          if (!billingid && !patientid) {
               return { outstandingAmount: 0, records: [] };
          }

          let query = connection(this.billingTable);

          if (billingid) {
               if (Array.isArray(billingid)) {
                    query = query.whereIn('billingid', billingid);
               } else {
                    query = query.where({ billingid });
               }
          } else if (patientid) {
               query = query.where({ patientid });
          }
          let records: any[] = [];

          if (status === "completed") {
               records = await query.clone()
                    .whereRaw('outstanding = 0')
                    .select("*")
                    .orderBy('billedon', 'desc')
                    .limit(10);

          } else if (status === "pending") {
               const result = await query.clone()
                    .whereRaw('outstanding > 0')
                    .sum('outstanding as totalOutstanding');
               const outstandingAmount = result[0]?.totalOutstanding || 0;

               if (outstandingAmount > 0) {
                    records = await query.clone()
                         .whereRaw('outstanding > 0')
                         .select("*")
                         .orderBy('billedon', 'asc');
               }

               if (Array.isArray(records) && records.length > 0) {
                    for (const record of records) {
                         const serviceDetails: PrimeLimsTabledboservices[] = await connection(`${this.servicesTable} as dbo`)
                              .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                              .leftJoin("test_panels", function (this: Knex.JoinClause) {
                                   this.on("dbo.trackId", "test_panels.id").andOnVal("dbo.categoryTrackId", "!=", 5);
                              })
                              .leftJoin("additionalservices", function (this: Knex.JoinClause) {
                                   this.on("dbo.trackId", "additionalservices.keyid").andOnVal("dbo.categoryTrackId", "=", 5);
                              })
                              .select(
                                   "dbo.totalpayable",
                                   "dbo.totalcost",
                                   "dbobillingrefundtable.amountRefunded",
                                   "dbo.serviceid",
                                   "dbo.paymentstatus",
                                   "dbo.paidamount",
                                   "dbo.outstanding",
                                   "dbo.isRefunded",
                                   "dbobillingrefundtable.amountRefunded",
                                   "dbo.discount",
                                   "dbo.amountIncurredDueTax",
                                   connection.raw(`
                                        CASE 
                                             WHEN dbo.categoryTrackId != 5 THEN test_panels.name
                                             WHEN dbo.categoryTrackId = 5 THEN additionalservices.serviceName
                                             ELSE NULL
                                        END as service_name
                                   `)
                              )
                              .where({ billingid: record.billingid })
                         record.serviceDetails = serviceDetails || null;
                    }
               }

               return { outstandingAmount, records };

          } else if (status === "all") {
               records = await query.clone()
                    .select("*")
                    .orderBy('billedon', 'desc')
                    .limit(50);

               if (Array.isArray(records) && records.length > 0) {
                    for (const record of records) {
                         const serviceDetails: PrimeLimsTabledboservices[] = await connection(`${this.servicesTable} as dbo`)
                              .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                              .leftJoin("test_panels", function (this: Knex.JoinClause) {
                                   this.on("dbo.trackId", "test_panels.id").andOnVal("dbo.categoryTrackId", "!=", 5);
                              })
                              .leftJoin("additionalservices", function (this: Knex.JoinClause) {
                                   this.on("dbo.trackId", "additionalservices.keyid").andOnVal("dbo.categoryTrackId", "=", 5);
                              })
                              .select(
                                   "dbo.totalpayable",
                                   "dbo.totalcost",
                                   "dbobillingrefundtable.amountRefunded",
                                   "dbo.serviceid",
                                   "dbo.paymentstatus",
                                   "dbo.paidamount",
                                   "dbo.outstanding",
                                   "dbo.isRefunded",
                                   "dbobillingrefundtable.amountRefunded",
                                   "dbo.discount",
                                   "dbo.amountIncurredDueTax",
                                   connection.raw(`
                                        CASE 
                                             WHEN dbo.categoryTrackId != 5 THEN test_panels.name
                                             WHEN dbo.categoryTrackId = 5 THEN additionalservices.serviceName
                                             ELSE NULL
                                        END as service_name
                                   `)
                              )
                              .where({ billingid: record.billingid })
                         record.serviceDetails = serviceDetails || null;
                    }
               }

               const outstandingResult = await query.clone()
                    .whereRaw('outstanding > 0')
                    .sum('outstanding as totalOutstanding');
               const outstandingAmount = outstandingResult[0]?.totalOutstanding || 0;

               return { outstandingAmount, records };
          }

          return { outstandingAmount: 0, records: [] };
     }



     async generateTransactionReceipt(billingid: number, employeeid: number): Promise<any> {
          const connection = await this.connection;

          const billing = await connection(this.billingTable).where({ billingid }).first();
          if (!billing) {
               throw new Error('Billing not found');
          }
          const patient = await connection('new_patients').where({ patientid: billing.patientid }).first();
          const paymenthistory = await connection(this.bhxTable)
               .innerJoin('paymentmodes', `${this.bhxTable}.paymentmode`, 'paymentmodes.KEYID')
               .where({ billingid })

          const companyInfo = await connection('companyprofile').first();

          // Generate receipt number
          const now = new Date();
          const timestamp = now.getFullYear() +
               String(now.getMonth() + 1).padStart(2, '0') +
               String(now.getDate()).padStart(2, '0') +
               String(now.getHours()).padStart(2, '0') +
               String(now.getMinutes()).padStart(2, '0') +
               String(now.getSeconds()).padStart(2, '0');

          const companyAbbr = companyInfo.NAME ? companyInfo.NAME.split(' ').map(word => word.charAt(0).toUpperCase()).join('') : 'COMP';
          const receiptNumber = `${companyAbbr}-${billingid}-PLS-${timestamp}`;

          const services = await connection(`${this.servicesTable} as dbo`)
               .leftJoin("test_panels", function (this: Knex.JoinClause) {
                    this.on("dbo.trackId", "test_panels.id").andOnVal("dbo.categoryTrackId", "!=", 5);
               })
               .leftJoin("testdetails", "test_panels.id", "testdetails.testid")
               .leftJoin("additionalservices", function (this: Knex.JoinClause) {
                    this.on("dbo.trackId", "additionalservices.keyid").andOnVal("dbo.categoryTrackId", "=", 5);
               })
               .select(
                    "dbo.*",
                    "testdetails.reportitle AS test_report_title",
                    connection.raw(`
                         CASE 
                              WHEN dbo.categoryTrackId != 5 THEN test_panels.name
                              WHEN dbo.categoryTrackId = 5 THEN additionalservices.serviceName
                              ELSE NULL
                         END as service_name
                    `)
               )
               .where({ billingid });

          // Prepare receipt data
          // Older installations can print receipts before the cashier workflow migration is installed.
          const cashierTicket = await connection.schema.hasTable('lab_cashier_codes')
               ? await connection('lab_cashier_codes').where({billingid}).first() : null;
          const receiptData = {
               cashierCode: cashierTicket?.code || null,
               receiptNumber,
               billing,
               patient,
               services,
               generatedAt: new Date().toISOString(),
               tenantId: this.tenantId,
               paymenthistory,
               companyInfo
          };

          // Insert into receipts table for tracking
          const [receiptId] = await connection('receipts').insert({
               billingid,
               generated_by: employeeid,
               printed: false,
               generated_at: new Date(),
               generated_receipt_number: receiptNumber
          });

          return {
               receiptId,
               ...receiptData
          };
     }

     async updateReceiptPrinted(receiptId: number, employeeid: number, printed_at: string): Promise<void> {
          const connection = await this.connection;
          const extractedDate = new Date(printed_at);
          if (isNaN(extractedDate.getTime())) {
               throw new Error('Invalid printed_at date format. Expected a valid date string.');
          }
          await connection('receipts')
               .where({ id: receiptId })
               .update({ printed: true, printed_at: extractedDate, printed_by: employeeid });
     }

     async getReceipts(page: number = 1, count: number = 10, sortby: 'ASC' | 'DESC' = 'DESC'): Promise<{ receipts: any[]; total: number }> {
          const connection = await this.connection;
          const offset = (page - 1) * count;

          const total = await connection('receipts').count('id as count').first();
          const totalCount = total.count;

          const receipts = await connection('receipts as r')
               .leftJoin('roles as gen_emp', 'r.generated_by', 'gen_emp.employeeid')
               .leftJoin('roles as print_emp', 'r.printed_by', 'print_emp.employeeid')
               .select(
                    'r.id',
                    'r.billingid',
                    'r.generated_receipt_number',
                    'r.generated_at',
                    'r.printed_at',
                    'r.printed',
                    'gen_emp.username as generated_by_name',
                    'print_emp.username as printed_by_name'
               )
               .orderBy('r.generated_at', sortby)
               .orderBy('r.id', sortby)
               .limit(count)
               .offset(offset);

          return { receipts, total: totalCount };
     }

}
