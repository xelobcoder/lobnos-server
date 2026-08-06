"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changeActivationStatus = changeActivationStatus;
exports.changeActivationRouter = changeActivationRouter;
const helper_1 = require("../../hooks/helper");
async function changeActivationStatus(tenantId, data) {
    let q_query = "UPDATE new_patients SET activation_status = ?";
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
    return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, q_query, [action, patientid]));
}
async function changeActivationRouter(request, response) {
    const { tenantId } = request.query;
    try {
        const requestQuery = request.query;
        const status = await changeActivationStatus(parseInt(tenantId.toString()), requestQuery);
        response.send({ status });
    }
    catch (err) {
        response.send({ status: false });
    }
}
