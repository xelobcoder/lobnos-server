"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestTrends = getTestTrends;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const encryptionModels_1 = require("../../utils/encryptionModels");
async function getTestTrends(tenantId, patientid, testid, trendNumber = 10, limit) {
    const knex = await (0, KnexConnections_1.default)(tenantId);
    // Step 1: Get latest distinct ascensionids using raw SQL
    const ascensionSql = `
          SELECT DISTINCT ascensionid
          FROM test_results
          WHERE patientid = ? AND testid = ?
          ${trendNumber ? 'LIMIT ' + trendNumber : ''}
     `;
    const ascensionRows = await knex.raw(ascensionSql, [patientid, testid]);
    const ascensionids = Array.isArray(ascensionRows) && Array.isArray(ascensionRows[0])
        ? ascensionRows[0].map((r) => r.ascensionid)
        : ascensionRows.map((r) => r.ascensionid);
    if (!ascensionids.length)
        return [];
    // Step 2: Fetch results for those ascensionids using raw SQL
    // If ascensionids is empty, prevent invalid SQL
    if (!ascensionids.length)
        return [];
    // conver ids to string 
    const ascensionIdsString = ascensionids.map(id => parseInt(id)).join(',');
    console.log("ascensionIdsString", ascensionIdsString);
    const resultsSql = `
          SELECT 
               tr.ascensionid,
               tr.field,
               tr.value,
               tr.created_on,
               tcr.plan
          FROM test_results tr
          LEFT JOIN testcreationrules tcr ON tr.fieldid = tcr.id
          WHERE tr.ascensionid IN (${ascensionIdsString})
            AND tr.patientid = ?
            AND tr.testid = ?
          ORDER BY tr.created_on DESC, tr.ascensionid DESC
     `;
    const resultsRaw = await knex.raw(resultsSql, [patientid, testid]);
    const rows = Array.isArray(resultsRaw) && Array.isArray(resultsRaw[0]) ? resultsRaw[0] : resultsRaw;
    return rows.map((row) => (Object.assign(Object.assign({}, row), { value: row.value ? (0, encryptionModels_1.decrypt_value)(row.value) : row.value })));
}
