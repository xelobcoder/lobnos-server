"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../../hooks/helper");
const appset_1 = __importDefault(require("../appsettings/appset"));
const queries_1 = require("./queries");
class Branch extends appset_1.default {
    static async addBranch(tenantId, name, address, email, contact, managerid) {
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_add_new_branch, [name, address, email, contact, managerid]));
    }
    static async getBranch(tenantId, count = 10, page = 1, branchid) {
        if (branchid) {
            return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_branches_get_all, [branchid]);
        }
        return await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_branches_get_single, [], tenantId);
    }
    static async editBranch(tenantId, branchid, name, contact, address, email, managerid) {
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_branches_update_single, [name, contact, address, email, managerid, branchid]));
    }
    static async deleteBranch(tenantId, branchid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_branches_delete_single, [branchid]);
    }
    static async activateDeactivateBranch(tenantId, id, status) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_activation, [status, id]);
        return (0, helper_1.rowAffected)(result);
    }
    static async find(tenantId, branchid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.g_get_branch, [branchid]);
        return Array.isArray(result) && result.length > 0 ? result[0] : undefined;
    }
}
exports.default = Branch;
