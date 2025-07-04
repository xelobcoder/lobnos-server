"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCorrectionalAdjustment = void 0;
function calculateCorrectionalAdjustment(billingdata, writeOffOutstanding) {
    var _a;
    const previousPaid = Number((_a = billingdata.previousRecordsSummary) === null || _a === void 0 ? void 0 : _a.paid) || 0;
    const currentPayable = Number(billingdata.amountPayable) || 0;
    const newPayments = Array.isArray(billingdata.payments)
        ? billingdata.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
        : 0;
    const totalPaid = previousPaid + newPayments;
    let outstandingToWriteOff = 0;
    let isExcess = false;
    if (totalPaid > currentPayable) {
        outstandingToWriteOff = totalPaid - currentPayable;
        isExcess = true;
    }
    else if (totalPaid < currentPayable) {
        outstandingToWriteOff = currentPayable - totalPaid;
    }
    return {
        previousPaid,
        newPayments,
        totalPaid,
        currentPayable,
        outstandingToWriteOff,
        isExcess
    };
}
exports.calculateCorrectionalAdjustment = calculateCorrectionalAdjustment;
