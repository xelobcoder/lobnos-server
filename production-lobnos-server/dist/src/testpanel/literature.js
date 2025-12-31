"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../hooks/helper");
const logger_1 = __importDefault(require("../hooks/logger"));
const queries_1 = require("./queries");
const setups = {};
class TestLiteratureSetup {
    constructor(testname) {
        this.testname = testname;
    }
    isValidTestname() {
        return this.testname in setups;
    }
    async getSetupLiterature(tenantId, testid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_literature_review_by_testid, [testid]);
    }
    async updateSetupLiterature(tenantId, literature, testid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_literature_review_by_testid, [literature, testid]);
    }
    async canUseLiterature(tenantId, testid) {
        const data = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_select_literature_review, [testid]);
        if (data.length === 0)
            return false;
        const { useLiterature } = data[0];
        return useLiterature === 1;
    }
    async getResultLiterature(tenantId, testid) {
        if (await this.canUseLiterature(tenantId, testid)) {
            const dataset = await this.getSetupLiterature(tenantId, testid);
            if (dataset.length > 0) {
                return { can: true, literature: dataset[0]['literature'] };
            }
        }
        return { can: false };
    }
    async createSetupLiterature(tenantId, literature, testid) {
        try {
            const isNameExist = await this.getSetupLiterature(tenantId, testid);
            if (isNameExist.length > 0) {
                return await this.updateSetupLiterature(tenantId, literature, testid);
            }
            else {
                return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_insert_literature_review, [testid, literature]);
            }
        }
        catch (err) {
            logger_1.default.error(err);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || 'Something went wrong');
        }
    }
    async getSetupRecords(tenantId) {
        try {
            return await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM ${setups[this.testname]}`);
        }
        catch (err) {
            logger_1.default.error(err);
            return [];
        }
    }
    async validateRecords(records) {
        if (Array.isArray(records) && records.length > 0) {
            const result = records.map((item) => {
                const values = Object.values(item.toString().trim());
                return (values.includes(undefined) || values.includes(null) || values.includes('') || values.length === 0) ? false : true;
            });
            return !result.includes(false);
        }
        return false;
    }
}
exports.default = TestLiteratureSetup;
