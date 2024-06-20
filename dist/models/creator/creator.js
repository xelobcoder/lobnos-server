"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../helper");
const list_1 = __importDefault(require("../../testpanel/list"));
class Creator {
    constructor(testid) {
        this.testid = testid;
    }
    async getTestCreationRule() {
        if (!this.testid)
            throw new Error("testid is required");
        const rule = await (0, helper_1.promisifyQuery)("SELECT creationrule FROM customtestcreation WHERE testid = ?", [this.testid]);
        if (rule.length > 0 && rule[0].creationrule !== "{}") {
            const result = JSON.parse(rule[0].creationrule);
            return result;
        }
        return [];
    }
    async getPreviousRecords(testname, billingid, patientid) {
        const tablename = `result${list_1.default.generateTableName(testname)}`;
        const previousRecords = await (0, helper_1.promisifyQuery)(`SELECT * FROM ${tablename} WHERE billingid = ? AND patientid = ?`, [
            billingid,
            patientid,
        ]);
        return previousRecords;
    }
    async getCustomPreviousRecords(testname, billingid, patientid) {
        try {
            const previousRecords = await this.getPreviousRecords(testname, billingid, patientid);
            if (previousRecords.length > 0 && previousRecords.some((item) => item.field === "ultrasound")) {
                return previousRecords[0];
            }
            let result = await this.getTestCreationRule();
            const hasGenderVariation = result.length > 0 && result.some((item) => item.hasGenderVariation === true);
            let clientGender = "";
            if (hasGenderVariation) {
                const packet = await (0, helper_1.promisifyQuery)("SELECT gender,age,agetype FROM new_patients WHERE patientid = ?", [patientid]);
                if (packet.length > 0)
                    clientGender = packet[0]["gender"];
            }
            if (previousRecords.length === 0)
                return result;
            result = result.map((item) => {
                const { name } = item;
                const matched = previousRecords.find((u) => u.field === name);
                return matched ? Object.assign(Object.assign({}, item), { value: matched.value }) : item;
            });
            if (hasGenderVariation && clientGender) {
                result = result.map((item) => {
                    const obj = Object.assign({}, item);
                    if (item[clientGender]) {
                        obj.upperlimit = item[clientGender].upperlimit;
                        obj.lowerlimit = item[clientGender].lowerlimit;
                        delete obj.female;
                        delete obj.male;
                    }
                    return obj;
                });
            }
            return result;
        }
        catch (err) {
            (0, helper_1.responseError)(Response);
        }
    }
    async getCustomCommentsRecords(billingid, testid) {
        if (!billingid || !testid) {
            throw new Error("testid and billingid required");
        }
        let comments = await (0, helper_1.promisifyQuery)("SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?", [billingid, testid]);
        return comments.length > 0 ? comments[0]["comments"] : "";
    }
    async updateTestCreationRule(data) {
        if (!this.testid || !data)
            throw new Error("testid and data is required");
        const stringdata = JSON.stringify(data);
        const query = "UPDATE customtestcreation SET creationrule = ? WHERE testid = ?";
        const isUpdated = await (0, helper_1.promisifyQuery)(query, [stringdata, this.testid]);
        return (0, helper_1.rowAffected)(isUpdated);
    }
}
exports.default = Creator;
