"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../hooks/helper");
const queries_1 = require("./queries");
const TiifuWorkingClass_1 = require("./TiifuWorkingClass");
const databaseQueries = {
    checkDuplicate: async (tenantId, type = "billingid", table, id, columnName, date = "testResults.getTodayDateAndTime().date") => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_check_duplicate)(type, table, id, columnName, date), []);
        return result.length > 0;
    },
    del: async (tenantId, id, table, idResolver) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_delete_single)(id, table, idResolver), []);
        return result;
    },
    deleteMany: async (tenantId, deleteArray, table) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_delete_many)(deleteArray, table), []);
        return result;
    },
    getAll: async (tenantId, table, limit) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_get_all)(table, limit), []);
        return result;
    },
    getAllRoles: async (tenantId) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_get_all)("roles", 100), []);
        return result;
    },
    getSingleRole: async (tenantId, id) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_get_single_role)(id), []);
        return result;
    },
    newRole: async (tenantId, fullname, username, password, role) => {
        const values = [fullname, username, role, password];
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_new_role)(fullname, username, password, role), values);
        return { message: `${fullname} added as a ${role}`, status: "success" };
    },
    updateRole: async (tenantId, fullname, username, role, password, roleid) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_update_role)(fullname, username, role, password, roleid), []);
        return { message: "Information updated successfully", status: (0, helper_1.rowAffected)(result) };
    },
    deleteWithID: async (tenantId, id) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_delete_role)(id), []);
        return { message: "Information deleted successfully", status: (0, helper_1.rowAffected)(result) };
    },
    deleteAllRows: async (tenantId, tablename) => {
        const result = await (0, helper_1.promisifyQuery)(tenantId, (0, queries_1.q_truncate_table)(tablename), []);
        return result.fieldCount === 0;
    },
    getSingleId: async (tenantId, id, table, idResolver) => {
        const result = await new TiifuWorkingClass_1.TiifuWorkingClass(table).findOne(tenantId, idResolver, id);
        return result;
    }
};
exports.default = databaseQueries;
