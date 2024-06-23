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
    async getBranchDayBilledClients(branchid, { count = 10, page = 1 }) {
        const currentDate = new Date();
        let currentYear = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const day = currentDate.getDate();
        const result = await (0, helper_js_1.promisifyQuery)(queries_1.currentDateBilledClients, [currentYear, month, day, branchid]);
        return result;
    }
    wrapperTryCatch(cb, errcb) {
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
    static async initPartitionBilling(prefix, year) {
        var query = `ALTER TABLE billing  PARTITION BY RANGE COLUMNS (year,month) 
    (`;
        let range = 1;
        while (range <= 12) {
            const month = `${range}`.padStart(2, "0");
            if (range == 12) {
                query += `PARTITION ${prefix}_${year}_${month} VALUES LESS THAN (${year + 1}, ${1})`;
            }
            else {
                query += `PARTITION ${prefix}_${year}_${month} VALUES LESS THAN (${year}, ${range + 1}),`;
            }
            range++;
        }
        query += ` )`;
        const result = await (0, helper_js_1.promisifyQuery)(query);
        return result.affectedRows;
    }
    static async getBillingTablePartions() {
        const packets = await (0, helper_js_1.promisifyQuery)(queries_1.q_getAllpartiton);
        return packets[0]["PARTITION_NAME"] != null ? packets : [];
    }
    static async partitionstoYearList(data) {
        const packets = data || (await this.getBillingTablePartions());
        return packets.length === 0 ? [] : packets.map((item, index) => item.PARTITION_NAME.split("_")[1]);
    }
    static async partitionsStrings(packets) {
        if (Array.isArray(packets) && packets.length > 0) {
            return packets.map((item, index) => item.PARTITION_NAME);
        }
        return [];
    }
    static async billingPartitionPrunner(startdate, enddate) {
        if (!startdate || !startdate)
            throw new Error("required startdate and enddate not provided");
        let partitions = await this.getBillingTablePartions();
        if (partitions.length == 0)
            return [];
        const startYear = new Date(startdate).getFullYear();
        const endYear = new Date(enddate).getFullYear();
        const stMonth = new Date(startdate).getMonth();
        const edMonth = new Date(enddate).getMonth();
        partitions = partitions.map((a, index) => a.PARTITION_NAME);
        partitions.filter((_part, index) => {
            const [_, year, month] = _part.split("_");
            return year == startYear || year == endYear || (endYear == year && stMonth == month) || (startYear == year && edMonth == month);
        });
        return partitions.length > 0 ? partitions.join(",") : [];
    }
    static async executeAddPartitionBilling(_partition_name, year, month) {
        return await (0, helper_js_1.promisifyQuery)(queries_1.q_addNewPartition, [_partition_name, year, month]);
    }
    async dropPartition(partitionName) {
        return await (0, helper_js_1.promisifyQuery)(`ALTER TABLE billing DROP PARTITION \`${partitionName}\``);
    }
    async AddYearPartition(year) {
        let currentYear = year || new Date().getFullYear();
        const partitions = await Billing.getBillingTablePartions();
        const _currentPartitions = await Billing.partitionstoYearList(partitions);
        if (_currentPartitions.length === 0) {
            return await Billing.initPartitionBilling("billing", currentYear);
        }
        let missingPartition = [];
        async function loop_create_partition(start, end, availablePartitions) {
            let range = start;
            while (range <= end && range > 0) {
                const _range = `${range}`.padStart(2, "0");
                const partitionName = `billing_${currentYear}_${_range}`;
                if (range != 12) {
                    await Billing.executeAddPartitionBilling(partitionName, currentYear, range + 1);
                }
                else {
                    await Billing.executeAddPartitionBilling(partitionName, currentYear + 1, 1);
                }
                console.log(`${partitionName} successfully added `);
                range++;
            }
        }
        if (!_currentPartitions.includes(currentYear)) {
            const availablePartitions = await Billing.partitionsStrings(partitions);
            let incremental = 1;
            while (incremental <= 12) {
                const month = `${incremental}`.padStart(2, "0");
                const name = `billing_${currentYear}_${month}`;
                if (!availablePartitions.includes(name)) {
                    missingPartition.push(incremental);
                }
                incremental++;
            }
        }
        if (missingPartition.length > 0) {
            const end = missingPartition[missingPartition.length - 1];
            loop_create_partition(missingPartition[0], end, missingPartition);
        }
        return true;
    }
    async insertNewBilling() { }
    async billClient(data) {
        try {
            const { patientid, clinician = 0, organization = 0, paid, payable, outstanding, discount, samplingCenter, taxIncluded, taxValue, status, testcost, employeeid, type, } = data;
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
                if (!isInserted)
                    throw new Error(billingclientTypes_1.billErrors.failed);
                insertionCount++;
                inserted.push(testid);
                if (!collected) {
                    await this.updateApprovalStatus(billingid, testid);
                }
            }
            return insertionCount === testidCollection.length;
        }
        catch (err) {
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
            if (strict) {
                canInitiateNewBill = await this.haveBeenBilledToday(this.patientid);
            }
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
// dropTablePartition("billing")
new Billing(5).AddYearPartition(2024);
