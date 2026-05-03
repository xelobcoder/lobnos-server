"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionBatchPaymentsRepo = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
class CommissionBatchPaymentsRepo {
    constructor(tenantId) {
        this.createBatchPaymentWithServices = async (data) => {
            try {
                const { startDate, endDate, commissionDue, amountPaid, services, employeeid, paymentMethod, recipientId, recipientType } = data;
                const commissionAmount = parseFloat(commissionDue.toString());
                const paid = parseFloat(amountPaid.toString());
                const waivedAmount = commissionAmount - paid;
                const isWaived = waivedAmount > 0;
                const formatDate = (date) => {
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    return `${year}${month}${day}`;
                };
                const commision_batch = `BATCH-${formatDate(startDate)}-${formatDate(endDate)}-${Date.now()}`;
                const waiverAmountPerService = isWaived ? parseFloat((waivedAmount / services.length).toFixed(2)) : 0;
                // create transacction connection 
                const conn = await this.connection;
                const trx = await conn.transaction();
                const batchID = await trx('commission_batch_payments')
                    .insert({
                    batch_reference: commision_batch,
                    recipient_type: recipientType,
                    recipient_id: recipientId,
                    start_date: startDate,
                    end_date: endDate,
                    total_commission_amount: commissionAmount,
                    payment_amount: paid,
                    waived_amount: waivedAmount,
                    status: isWaived ? 'partial' : 'completed',
                    created_by: employeeid,
                    payment_date: new Date(),
                    created_at: new Date(),
                    payment_method: paymentMethod,
                    updated_at: new Date()
                })
                    .returning('id');
                const batchPaymentId = batchID[0];
                // insert each service into commission_batch_payment_services
                for (const serviceId of services) {
                    const commissionDueForService = await conn('commission_tracking')
                        .where('serviceid', serviceId)
                        .first()
                        .then((row) => row ? parseFloat(row.commission_due) : 0);
                    const waivedForService = isWaived ? waiverAmountPerService : 0;
                    await trx('commission_batch_payment_services')
                        .insert({
                        batch_payment_id: batchID[0],
                        serviceid: serviceId,
                        commission_due: commissionDueForService,
                        amount_allocated: commissionDueForService - waivedForService,
                        waived_amount: waivedForService,
                        status: isWaived ? 'partial' : 'paid',
                        created_at: new Date()
                    });
                }
                await trx.commit();
                return { batchPaymentId };
            }
            catch (error) {
                logger_1.default.error('Error creating batch payment with services:', error);
                throw error;
            }
        };
        this.getBatch = async ({ batchid, recipient_id, recipient_type, startDate, endDate }) => {
            try {
                const conn = await this.connection;
                let batch = conn('commission_batch_payments')
                    .select('commission_batch_payments.*', 'roles.username as created_by_username', 'paymentmodes.PaymentMode as payment_mode')
                    .leftJoin("roles", "roles.employeeid", "commission_batch_payments.created_by")
                    .leftJoin("paymentmodes", "paymentmodes.keyID", "commission_batch_payments.payment_method");
                if (recipient_id && recipient_type == "organization") {
                    batch = batch.leftJoin("organization", "organization.id", "commission_batch_payments.recipient_id")
                        .select('organization.name as recipient_name');
                    batch = batch.where('recipient_type', recipient_type);
                }
                if (recipient_id && recipient_type == "clinician") {
                    batch = batch.leftJoin("clinicianbasicinfo", "clinicianbasicinfo.id", "commission_batch_payments.recipient_id")
                        .select('clinicianbasicinfo.name as recipient_name');
                    batch = batch.where('recipient_type', recipient_type);
                }
                if (!recipient_id && !recipient_type) {
                    batch = batch.leftJoin("organization", "organization.id", "commission_batch_payments.recipient_id")
                        .leftJoin("clinicianbasicinfo", "clinicianbasicinfo.id", "commission_batch_payments.recipient_id")
                        .select(conn.raw(`CASE 
                              WHEN commission_batch_payments.recipient_type = 'organization' THEN organization.name
                              WHEN commission_batch_payments.recipient_type = 'clinician' THEN clinicianbasicinfo.name
                              ELSE 'Unknown'
                         END as recipient_name`));
                }
                if (startDate && endDate) {
                    batch = batch.where('start_date', '>=', startDate).andWhere('end_date', '<=', endDate);
                }
                if (batchid) {
                    batch = batch.where('id', batchid);
                }
                if (recipient_id) {
                    batch = batch.where('recipient_id', recipient_id);
                }
                return await batch;
            }
            catch (error) {
                logger_1.default.error('Error fetching batch payment:', error);
                throw error;
            }
        };
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
    }
}
exports.CommissionBatchPaymentsRepo = CommissionBatchPaymentsRepo;
