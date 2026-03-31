"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
class ExpenseAuditLog {
    constructor(tenantId, expenseid) {
        this.expenseId = expenseid;
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(tenantId);
        this.tablename = `expensesrecord_audit_log`;
    }
    async getExpenseAuditLogInformation() {
        try {
            const conn = await this.connection;
            const result = await conn(this.tablename)
                .leftJoin('roles', 'roles.employeeid', `expensesrecord_audit_log.changed_by`)
                .select("expensesrecord_audit_log.*", 'roles.username')
                .where({ record_id: this.expenseId });
            if (result && Array.isArray(result) && result.length > 0) {
                const pResult = result.map((item, index) => {
                    if (TiifuWorkingClass_1.TiifuWorkingClass.isJson(item.old_data)) {
                        item.old_data = JSON.parse(item.old_data);
                    }
                    if (TiifuWorkingClass_1.TiifuWorkingClass.isJson(item.new_data)) {
                        item.new_data = JSON.parse(item.new_data);
                    }
                    delete item.table_name;
                    return item;
                });
                return pResult;
            }
            return [];
        }
        catch (err) {
            console.log(err);
        }
    }
}
exports.default = ExpenseAuditLog;
