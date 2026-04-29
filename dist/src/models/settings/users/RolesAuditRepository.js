"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class RolesAuditRepository {
    static sanitizeRoleRow(row) {
        if (!row)
            return null;
        const { password, refresh_token } = row, rest = __rest(row, ["password", "refresh_token"]);
        return rest;
    }
    static async insertAudit(opts) {
        const { tenantId, action, employeeid, actorEmployeeid, oldData, newData, trx } = opts;
        const conn = trx || (await (0, KnexConnections_1.default)(tenantId));
        await conn("roles_audit_log").insert({
            action,
            employeeid,
            actor_employeeid: actorEmployeeid !== null && actorEmployeeid !== void 0 ? actorEmployeeid : null,
            old_data: oldData == null ? null : JSON.stringify(oldData),
            new_data: newData == null ? null : JSON.stringify(newData),
            created_at: conn.fn.now(6)
        });
    }
}
exports.default = RolesAuditRepository;
