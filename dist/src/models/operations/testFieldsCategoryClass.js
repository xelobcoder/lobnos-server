"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestDetailCategory = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TableName = "testdetailcategory";
class TestDetailCategory {
    static async create(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName).insert(data);
    }
    static async getAll(tenantId, params) {
        const { limit = 10, offset = 0, createdby = null } = params;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        let query = connection(TableName)
            .where({ deleted: false })
            .select("*")
            .limit(limit)
            .offset(offset);
        if (createdby) {
            query = query.where({ createdby });
        }
        return await query;
    }
    static async getById(tenantId, categoryid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .where({ categoryid, deleted: false })
            .first();
    }
    static async getByTestId(tenantId, testid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .leftJoin("roles", "roles.employeeid", "=", "testdetailcategory.createdby")
            .where({ testid, deleted: false })
            .select("testdetailcategory.*", "roles.username as createdbyname");
    }
    static async update(tenantId, categoryid, data) {
        data.updated_at = new Date();
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .where({ categoryid, deleted: false })
            .update(data);
    }
    static async softDelete(tenantId, categoryid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .where({ categoryid })
            .update({ deleted: true, updated_at: new Date() });
    }
    static async restore(tenantId, categoryid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .where({ categoryid })
            .update({ deleted: false, updated_at: new Date() });
    }
    static async delete(tenantId, categoryid) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        return await connection(TableName)
            .where({ categoryid })
            .del();
    }
}
exports.TestDetailCategory = TestDetailCategory;
exports.default = TestDetailCategory;
