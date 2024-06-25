"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeActivationStatus = void 0;
const helper_js_1 = require("./../../../helper.js");
let q_query = "UPDATE new_patients SET activation_status = ?";
async function changeActivationStatus(data) {
    const { patientid, action, isbulk = false } = data;
    if (!patientid || !action) {
        throw new Error("patientid and action event required");
    }
    if (["TRUE", "FALSE"].includes(action) === false) {
        throw new Error("FALSE || TRUE required");
    }
    if (!isbulk && typeof isbulk == "boolean") {
        q_query += " WHERE patientid = ?";
    }
    return (0, helper_js_1.rowAffected)(await (0, helper_js_1.promisifyQuery)(q_query, [action, patientid]));
}
exports.changeActivationStatus = changeActivationStatus;
