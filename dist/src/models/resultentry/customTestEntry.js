"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomTest = void 0;
const helper_1 = require("../../hooks/helper");
class CustomTest {
    constructor(billingid, testname) {
        this.billingid = billingid;
        this.testname = testname;
    }
    async getAllCustomTestList(tenantId) {
        const query = `SELECT * FROM test_panels WHERE iscustom = 1`;
        return await (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async loadTestWithDetails(tenantId) {
        const query = `SELECT * FROM test_panels AS tp INNER JOIN testdetails AS td ON  td.testid = tp.id`;
        return await (0, helper_1.promisifyQuery)(tenantId, query);
    }
    async isCustomTest(tenantId, testname) {
        if (!testname)
            throw new Error("testname required");
        const query = `SELECT * FROM test_panels WHERE name = ?`;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [testname]);
        if (result.length === 0)
            return null;
        return result[0]["iscustom"] == 1;
    }
}
exports.CustomTest = CustomTest;
