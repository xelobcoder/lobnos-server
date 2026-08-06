"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateCorrectionalAdjustment = calculateCorrectionalAdjustment;
function calculateCorrectionalAdjustment(billingdata) {
    var _a;
    const previousPaid = Number(Number(((_a = billingdata.previousRecordsSummary) === null || _a === void 0 ? void 0 : _a.paid) || 0).toFixed(2));
    const currentPayable = Number(Number(billingdata.amountPayable || 0).toFixed(2));
    const newPayments = Array.isArray(billingdata.payments)
        ? Number(billingdata.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2))
        : 0;
    const totalPaid = Number((previousPaid + newPayments).toFixed(2));
    let outstandingToWriteOff = 0;
    let isExcess = false;
    if (totalPaid > currentPayable) {
        outstandingToWriteOff = Number((totalPaid - currentPayable).toFixed(2));
        isExcess = true;
    }
    else if (totalPaid < currentPayable) {
        outstandingToWriteOff = Number((currentPayable - totalPaid).toFixed(2));
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
