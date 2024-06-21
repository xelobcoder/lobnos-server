"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Billing = void 0;
const billingclientTypes_1 = require("./billingclientTypes");
const helper_js_1 = require("./../../../helper.js");
const queries_1 = require("./queries");
class Billing {
    constructor(patientid) {
        this.updateApprovalStatus = async function (billingid, testid) {
            try {
                const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;
                const values = [billingid, testid];
                return (0, helper_js_1.promisifyQuery)(query, values);
            }
            catch (err) {
                throw new Error(err);
            }
        };
        this.patientid = patientid;
    }
    wrapperTryCatch(cb, errcb = null) {
        try {
            return cb();
        }
        catch (err) {
            if (errcb && typeof errcb == "function") {
                errcb(err);
            }
            else {
                console.error("Error uncaught in and unhandled", err);
            }
        }
    }
    insertNewBilling() { }
    async billClient(data) {
        try {
            const { patientid, clinician = 0, organization = 0, paid, payable, outstanding, discount, samplingCenter, paymentmode, taxIncluded, taxValue, status, testcost, employeeid, type, } = data;
            const values = [
                patientid,
                clinician,
                organization,
                paid,
                payable,
                type,
                outstanding,
                discount,
                samplingCenter,
                taxIncluded,
                taxValue,
                status,
                testcost,
                employeeid,
            ];
            const { affectedRows, insertId } = await (0, helper_js_1.promisifyQuery)(queries_1.insertBillQuery, values);
            if (affectedRows == 0)
                return false;
            return insertId;
        }
        catch (err) {
            console.error(err);
            throw new Error(billingclientTypes_1.billErrors.error);
        }
    }
    async isCompleteFlow() {
        const settings = await (0, helper_js_1.promisifyQuery)(`SELECT * FROM applicationsettings`);
        if (settings.length == 0)
            return false;
        return settings[0]["completeFlow"] == 1 ? true : false;
    }
    async updateBillingHistory(paymentmode, billingid, amount) {
        const values = [paymentmode, amount, billingid];
        return await (0, helper_js_1.promisifyQuery)(queries_1.updatebillHistoryQuery, values);
    }
    async deleteAscensionid(billingid, testid) {
        const result = await (0, helper_js_1.promisifyQuery)(queries_1.deleteAscensionidQuery, [billingid, testid]);
        return (0, helper_js_1.rowAffected)(result);
    }
    async haveBeenBilledToday(patientid) {
        const result = await (0, helper_js_1.promisifyQuery)(queries_1.patientBilledTodayQuery, patientid);
        return result[0]["count"] > 0 ? false : true;
    }
    async deleteAddedWithError(inserted, billingid) {
        let counter = 0;
        while (inserted.length > 0 && counter <= inserted.length) {
            const isDeleted = (0, helper_js_1.rowAffected)(await this.deleteAscensionid(billingid, inserted[counter]));
            if (isDeleted) {
                inserted = inserted.filter((a) => a != inserted[counter]);
            }
            counter++;
        }
    }
    async AddtoTestAscenstion(data) {
        const { billingid, testidCollection } = data;
        let insertionCount = 0;
        const inserted = [];
        try {
            if (testidCollection.length == 0)
                throw new Error("Bad Parameters, testCollection not added");
            const collected = (await this.isCompleteFlow()) ? "false" : "true";
            for (let i = 0; i < testidCollection.length; i++) {
                const testid = testidCollection[i];
                const isInserted = await (0, helper_js_1.promisifyQuery)(queries_1.AddtoTestAscenstionQuery, [testid, billingid, collected]);
                if ((0, helper_js_1.rowAffected)(isInserted)) {
                    insertionCount++;
                    inserted.push(testid);
                }
                if (!collected) {
                    await this.updateApprovalStatus(billingid, testid);
                }
            }
            return insertionCount === testidCollection.length;
        }
        catch (err) {
            console.log(err);
            await this.deleteAddedWithError(inserted, billingid);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || err);
        }
    }
    async deleteBillTransaction(billingid) {
        return await (0, helper_js_1.promisifyQuery)(queries_1.deleteBillTransactionQuery, [billingid]);
    }
    async cleanUpRecordedPaymentHx(billingid) {
        await (0, helper_js_1.promisifyQuery)(queries_1.deleteNewBillPaymentHx, billingid);
    }
    async insertionProcess(billingData, strict = true) {
        // strict can be replaced with database value for strict checking to be done
        let isHistoryAdded = false;
        let isAscAdded = false;
        let billingid = undefined;
        try {
            let canInitiateNewBill = true;
            // if (strict) {
            //   canInitiateNewBill = await this.haveBeenBilledToday(this.patientid);
            // }
            if (!canInitiateNewBill) {
                return billingclientTypes_1.billErrors.already;
            }
            billingid = await this.billClient(billingData);
            if (typeof billingid == "boolean" || !billingid)
                return billingclientTypes_1.billErrors.failed;
            isAscAdded = await this.AddtoTestAscenstion({ billingid, testidCollection: billingData.test });
            isHistoryAdded = (0, helper_js_1.rowAffected)(await this.updateBillingHistory(billingData.paymentmode, billingid, billingData.paid));
            if (isAscAdded && isHistoryAdded && billingid) {
                return true;
            }
            await this.deleteBillTransaction(billingid);
            return billingclientTypes_1.billErrors.failed;
        }
        catch (err) {
            if (billingid) {
                await this.deleteBillTransaction(billingid);
            }
            return billingclientTypes_1.billErrors.error;
        }
    }
}
exports.Billing = Billing;
