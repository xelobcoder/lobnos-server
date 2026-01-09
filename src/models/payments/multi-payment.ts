import { PrimeLimsTabledboservices } from "../../database/DatabaseTableSchema";
import KnexConnection from "../../database/KnexConnections";



type ServicePayment = {
     service_id: number;
     amount: number;
     payment_mode_id: number;
     billing_id: number;
}

type MultiServicePaymentRequest = {
     service_payments: ServicePayment[];
     total_amount: number;
     description: string;
     employeeid: number;
     tenantId: number;
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

     public async processPayment(paymentData: MultiServicePaymentRequest): Promise<{ success: boolean; message: string; transactionId?: string }> {
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

               const invalidServices = servicesCheck.filter(service => service.outstanding <= 0);
               if (invalidServices.length > 0) {
                    const invalidIds = invalidServices.map(s => s.serviceid).join(', ');
                    throw new Error(`Cannot process payment for services with no outstanding balance: ${invalidIds}. These services are already fully paid.`);
               }

               const trx = await connection.transaction();

               try {
                    for (const servicePayment of paymentData.service_payments) {
                         const service = await trx(this.servicesTable)
                              .select('*')
                              .where({ serviceid: servicePayment.service_id })
                              .first();

                         if (!service) {
                              throw new Error(`Service with ID ${servicePayment.service_id} not found`);
                         }

                         if (service.outstanding <= 0) {
                              throw new Error(`Service with ID ${servicePayment.service_id} has no outstanding balance`);
                         }

                         const currentPaid = parseFloat(service.paidamount as string) || 0;
                         const newPaidAmount = currentPaid + servicePayment.amount;
                         const totalPayable = parseFloat(service.totalpayable as string) || 0;
                         const newOutstanding = Math.max(0, totalPayable - newPaidAmount);

                         let newPaymentStatus = service.paymentstatus;
                         if (newOutstanding === 0) {
                              newPaymentStatus = 'Paid';
                         } else if (newPaidAmount > 0) {
                              newPaymentStatus = 'Partial';
                         }

                         await trx(this.servicesTable)
                              .where({ serviceid: servicePayment.service_id })
                              .update({
                                   paidamount: newPaidAmount,
                                   outstanding: newOutstanding,
                                   paymentstatus: newPaymentStatus,
                                   totalpayable: totalPayable
                              });

                         await trx(this.bhxTable).insert({
                              billingid: servicePayment.billing_id,
                              paymentmode: servicePayment.payment_mode_id,
                              amount: servicePayment.amount,
                              employeeid: paymentData.employeeid,
                              type: 'credit'
                         });
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

                         const totalPaid = billingServices.reduce((sum, service) => sum + (parseFloat(service.paidamount as string) || 0), 0);
                         const totalOutstanding = billingServices.reduce((sum, service) => sum + (parseFloat(service.outstanding as string) || 0), 0);
                         const totalPayable = billingServices.reduce((sum, service) => sum + (parseFloat(service.totalpayable as string) || 0), 0);
                         const totalRefunded = billingServices.reduce((sum, service) => sum + (parseFloat(service.amountRefunded as string) || 0), 0);


                         await trx(this.billingTable)
                              .where({ billingid: billingId })
                              .update({
                                   paid: totalPaid,
                                   outstanding: totalOutstanding,
                                   payable: totalPayable,
                                   clientstatus: totalOutstanding === 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Unpaid')
                              });
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
     public async getOutstandingPayments(patientid: number, status: "completed" | "all" | "pending" = "pending") {
          const connection = await this.connection;

          let query = connection(this.billingTable).where({ patientid });
          let records: any[] = [];

          if (status === "completed") {
               records = await query
                    .whereRaw('outstanding = 0')
                    .select("*")
                    .orderBy('billedon', 'desc')
                    .limit(10);

          } else if (status === "pending") {
               const result = await query
                    .whereRaw('outstanding > 0')
                    .sum('outstanding as totalOutstanding');
               const outstandingAmount = result[0]?.totalOutstanding || 0;

               if (outstandingAmount > 0) {
                    records = await connection(this.billingTable)
                         .where({ patientid })
                         .whereRaw('outstanding > 0')
                         .select("*")
                         .orderBy('billedon', 'asc');
               }

               if (Array.isArray(records) && records.length > 0) {
                    for (const record of records) {
                         const serviceDetails: PrimeLimsTabledboservices[] = await connection(`${this.servicesTable} as dbo`)
                              .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                              .leftJoin("test_panels", function () {
                                   this.on("dbo.trackId", "test_panels.id").andOn("dbo.categoryTrackId", "!=", 5);
                              })
                              .leftJoin("additionalservices", function () {
                                   this.on("dbo.trackId", "additionalservices.keyid").andOn("dbo.categoryTrackId", "=", 5);
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
               records = await query
                    .select("*")
                    .orderBy('billedon', 'desc')
                    .limit(50);

               if (Array.isArray(records) && records.length > 0) {
                    for (const record of records) {
                         const serviceDetails: PrimeLimsTabledboservices[] = await connection(`${this.servicesTable} as dbo`)
                              .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                              .leftJoin("test_panels", function () {
                                   this.on("dbo.trackId", "test_panels.id").andOn("dbo.categoryTrackId", "!=", 5);
                              })
                              .leftJoin("additionalservices", function () {
                                   this.on("dbo.trackId", "additionalservices.keyid").andOn("dbo.categoryTrackId", "=", 5);
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

               const outstandingResult = await connection(this.billingTable)
                    .where({ patientid })
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
               .innerJoin('paymentModes', `${this.bhxTable}.paymentmode`, 'paymentModes.KEYID')
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
               .leftJoin("test_panels", function () {
                    this.on("dbo.trackId", "test_panels.id").andOn("dbo.categoryTrackId", "!=", 5);
               })
               .leftJoin("testdetails", "test_panels.id", "testdetails.testid")
               .leftJoin("additionalservices", function () {
                    this.on("dbo.trackId", "additionalservices.keyid").andOn("dbo.categoryTrackId", "=", 5);
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
          const receiptData = {
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
          await connection('receipts').where({ id: receiptId }).update({ printed: true, printed_at: printed_at, printed_by: employeeid });
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