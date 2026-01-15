"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WriteOff = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const helper_1 = require("../../hooks/helper");
class WriteOff {
    static async writeOffTransaction(tenantId, billingid, employeeid, reason) {
        try {
            const billingQuery = `SELECT * FROM billing WHERE billingid = ?`;
            const billingResult = await (0, helper_1.promisifyQuery)(tenantId, billingQuery, [billingid]);
            if (!billingResult || billingResult.length === 0)
                return "Resource not found." /* OperationsFailures.notFound */;
            const { adjustmentType, isAdjustment, paid, payable, islocked } = billingResult[0];
            if (islocked == 1)
                return 'Transaction is locked. Cannot write off.';
            if (isAdjustment == 1 && adjustmentType === 'written-off')
                return 'Transaction already written off. No further adjustments allowed.';
            if (isAdjustment == 0 || isAdjustment == null) {
                if (payable > paid) {
                    const outstanding = 0;
                    const writeOffAmount = payable - paid;
                    const status = 'written-off';
                    const updateQuery = `UPDATE billing 
                         SET isAdjustment = 1,status = ?,
                          adjustmentReason = ?,
                          islocked =1,
                         adjustedBy = ?,
                          adjustmentdate = NOW(),
                          adjustmentType = 'written-off',  
                          writeoff = ?,
                          outstanding = ? WHERE billingid = ?`;
                    const result = await (0, helper_1.promisifyQuery)(tenantId, updateQuery, [status, reason, employeeid, writeOffAmount, outstanding, billingid]);
                    if ((0, helper_1.rowAffected)(result))
                        return true;
                    return "Resource not found." /* OperationsFailures.notFound */;
                }
                else {
                    return 'No outstanding amount to write off.';
                }
            }
            return false;
        }
        catch (err) {
            console.error('Error writing off transaction:', err);
            return "An internal server error occurred." /* OperationsFailures.internalServerError */;
        }
    }
    static async isTransactionWrittenOff(tenantId, billingid) {
        const query = `SELECT isWriteOff FROM billing WHERE billingid = ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [billingid]);
        return Array.isArray(result) && result.length > 0 && result[0].isWriteOff === 1;
    }
    static async refundCompletelyTransaction(tenantId, employeeid, billingid, paymentmode, message) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const trx = await connection.transaction();
        try {
            const services = await trx('dboservices as s')
                .leftJoin('dbobillingrefundtable as r', 's.serviceid', 'r.serviceid')
                .where('s.billingid', billingid)
                .select('s.*', 'r.*');
            if (!services || services.length === 0) {
                await trx.rollback();
                return false;
            }
            for (const service of services) {
                await trx('dboservices')
                    .where({ serviceid: service.serviceid })
                    .update({
                    totalpayable: 0,
                    amountIncurredDueTax: 0,
                    isLocked: 1,
                    isRefunded: 1,
                    discount: 0,
                });
                const comprehensiveMessage = message || `Transaction voided and refunded by admin (employeeid: ${employeeid}) on ${new Date().toISOString()}. All witnesses set to admin. Reason: Service fully refunded and voided.`;
                await trx('dbobillingrefundtable')
                    .where('serviceid', service.serviceid)
                    .update({
                    isRefundCompleted: 1,
                    isRefundInitiated: 1,
                    isRefundApproved: 1,
                    refundedBy: employeeid,
                    amountRefunded: service.totalpayable,
                    isRefundMatterClosed: 1,
                    firstWitness: employeeid,
                    secondWitness: employeeid,
                    thirdWitness: employeeid,
                    firstWitnessPurpose: comprehensiveMessage,
                    initiatedBy: employeeid,
                    approvalDate: null,
                    secondWitnessPurpose: comprehensiveMessage,
                    thirdWitnessPurpose: comprehensiveMessage,
                    firstWitnessDate: new Date(),
                    secondWitnessDate: new Date(),
                    thirdWitnessDate: new Date()
                });
            }
            const totalRefunded = await trx('billing').where({ billingid }).select('paid').first();
            await trx('billing')
                .where({ billingid })
                .update({
                status: 'voided',
                paid: 0.0,
                payable: 0.0,
                outstanding: 0.0,
                discount: 0,
                totalrefunded: totalRefunded.paid,
                balance: 0.0,
                amountIncurredDueTax: 0,
                islocked: 1,
                adjustedBy: employeeid,
                isAdjustment: 1,
                adjustmentType: 'voided',
                adjustmentReason: 'Transaction voided and refunded by admin.',
                adjustmentdate: new Date()
            });
            await trx.raw('INSERT INTO billinghx(billingid, paymentmode, amount, employeeid, type) VALUES (?, ?, ?, ?, ?)', [billingid, paymentmode, totalRefunded.paid, employeeid, 'debit']);
            await trx.commit();
            return true;
        }
        catch (err) {
            console.error('Error refunding transaction:', err);
            await trx.rollback();
            return false;
        }
    }
}
exports.WriteOff = WriteOff;
