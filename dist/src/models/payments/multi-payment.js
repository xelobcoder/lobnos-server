"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class MultiPayment {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
        this.bhxTable = "billinghx";
        this.billingTable = "billing";
        this.servicesTable = "dboservices";
    }
    async processPayment(paymentData) {
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
                    const currentPaid = parseFloat(service.paidamount) || 0;
                    const newPaidAmount = currentPaid + servicePayment.amount;
                    const totalPayable = parseFloat(service.totalpayable) || 0;
                    const newOutstanding = Math.max(0, totalPayable - newPaidAmount);
                    let newPaymentStatus = service.paymentstatus;
                    if (newOutstanding === 0) {
                        newPaymentStatus = 'Paid';
                    }
                    else if (newPaidAmount > 0) {
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
                        .select('dboservices.*', 'dbobillingrefundtable.amountRefunded')
                        .where({ 'dboservices.billingid': billingId });
                    const totalPaid = billingServices.reduce((sum, service) => sum + (parseFloat(service.paidamount) || 0), 0);
                    const totalOutstanding = billingServices.reduce((sum, service) => sum + (parseFloat(service.outstanding) || 0), 0);
                    const totalPayable = billingServices.reduce((sum, service) => sum + (parseFloat(service.totalpayable) || 0), 0);
                    const totalRefunded = billingServices.reduce((sum, service) => sum + (parseFloat(service.amountRefunded) || 0), 0);
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
            }
            catch (error) {
                await trx.rollback();
                throw error;
            }
        }
        catch (error) {
            console.error('Payment processing error:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : 'Payment processing failed'
            };
        }
    }
    async getOutstandingPayments(patientid, status = "pending") {
        var _a, _b;
        const connection = await this.connection;
        let query = connection(this.billingTable).where({ patientid });
        let records = [];
        if (status === "completed") {
            records = await query
                .whereRaw('outstanding = 0')
                .select("*")
                .orderBy('billedon', 'desc')
                .limit(10);
        }
        else if (status === "pending") {
            const result = await query
                .whereRaw('outstanding > 0')
                .sum('outstanding as totalOutstanding');
            const outstandingAmount = ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.totalOutstanding) || 0;
            if (outstandingAmount > 0) {
                records = await connection(this.billingTable)
                    .where({ patientid })
                    .whereRaw('outstanding > 0')
                    .select("*")
                    .orderBy('billedon', 'asc');
            }
            if (Array.isArray(records) && records.length > 0) {
                for (const record of records) {
                    const serviceDetails = await connection(`${this.servicesTable} as dbo`)
                        .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                        .leftJoin("test_panels", function () {
                        this.on("dbo.trackId", "test_panels.id").andOn("dbo.categoryTrackId", "!=", 5);
                    })
                        .leftJoin("additionalservices", function () {
                        this.on("dbo.serviceid", "additionalservices.serviceid").andOn("dbo.categoryTrackId", "=", 5);
                    })
                        .select("dbo.totalpayable", "dbo.totalcost", "dbobillingrefundtable.amountRefunded", "dbo.serviceid", "dbo.paymentstatus", "dbo.paidamount", "dbo.outstanding", "dbo.isRefunded", "dbobillingrefundtable.amountRefunded", "dbo.discount", "dbo.amountIncurredDueTax", connection.raw(`
                                        CASE 
                                             WHEN dbo.categoryTrackId != 5 THEN test_panels.name
                                             WHEN dbo.categoryTrackId = 5 THEN additionalservices.serviceName
                                             ELSE NULL
                                        END as service_name
                                   `))
                        .where({ billingid: record.billingid });
                    record.serviceDetails = serviceDetails || null;
                }
            }
            return { outstandingAmount, records };
        }
        else if (status === "all") {
            records = await query
                .select("*")
                .orderBy('billedon', 'desc')
                .limit(50);
            if (Array.isArray(records) && records.length > 0) {
                for (const record of records) {
                    const serviceDetails = await connection(`${this.servicesTable} as dbo`)
                        .leftJoin("dbobillingrefundtable", "dbo.serviceid", "dbobillingrefundtable.serviceid")
                        .leftJoin("test_panels", function () {
                        this.on("dbo.trackId", "test_panels.id").andOn("dbo.categoryTrackId", "!=", 5);
                    })
                        .leftJoin("additionalservices", function () {
                        this.on("dbo.serviceid", "additionalservices.keyid").andOn("dbo.categoryTrackId", "=", 5);
                    })
                        .select("dbo.totalpayable", "dbo.totalcost", "dbobillingrefundtable.amountRefunded", "dbo.serviceid", "dbo.paymentstatus", "dbo.paidamount", "dbo.outstanding", "dbo.isRefunded", "dbobillingrefundtable.amountRefunded", "dbo.discount", "dbo.amountIncurredDueTax", connection.raw(`
                                        CASE 
                                             WHEN dbo.categoryTrackId != 5 THEN test_panels.name
                                             WHEN dbo.categoryTrackId = 5 THEN additionalservices.serviceName
                                             ELSE NULL
                                        END as service_name
                                   `))
                        .where({ billingid: record.billingid });
                    record.serviceDetails = serviceDetails || null;
                }
            }
            const outstandingResult = await connection(this.billingTable)
                .where({ patientid })
                .whereRaw('outstanding > 0')
                .sum('outstanding as totalOutstanding');
            const outstandingAmount = ((_b = outstandingResult[0]) === null || _b === void 0 ? void 0 : _b.totalOutstanding) || 0;
            return { outstandingAmount, records };
        }
        return { outstandingAmount: 0, records: [] };
    }
}
exports.default = MultiPayment;
