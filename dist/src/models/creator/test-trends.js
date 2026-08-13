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
exports.getTestTrends = getTestTrends;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const encryptionModels_1 = require("../../utils/encryptionModels");
const registration_1 = __importDefault(require("../registration/registration"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
const demographic_limits_1 = require("./demographic-limits");
async function getTestTrends(tenantId, patientid, testid, trendNumber = 10, limit) {
    const knex = await (0, KnexConnections_1.default)(tenantId);
    const [patientBasicData, settings] = await Promise.all([
        new registration_1.default().getPatientBasicData(tenantId, patientid),
        new appset_1.default().getAllAppSettings(tenantId)
    ]);
    const patientGender = ((patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.gender) || "").toString();
    const ageType = (patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.ageType) || (patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.agetype);
    const ageGroup = (0, demographic_limits_1.getAgeGroup)(patientBasicData === null || patientBasicData === void 0 ? void 0 : patientBasicData.age, ageType, settings === null || settings === void 0 ? void 0 : settings.ageVariationLimits);
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
    // Convert ids to string for IN clause after numeric cleanup.
    const ascensionIdsString = ascensionids.map((id) => parseInt(id)).join(',');
    const resultsSql = `
          SELECT 
               tr.ascensionid,
               tr.field,
               tr.value,
               tr.created_on,
               tcr.upperlimit,
               tcr.lowerlimit,
               tcr.lowerLimitFemale,
               tcr.upperLimitFemale,
               tcr.lowerLimitMale,
               tcr.units,
               tcr.upperLimitMale,
               tcr.lowerLimitChildren,
               tcr.upperLimitChildren,
               tcr.upperLimitNeonates,
               tcr.lowerLimitNeonates,
               tcr.textReference,
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
    return rows.map((row) => {
        const resolved = (0, demographic_limits_1.applyDemographicLimits)(row, patientGender, ageGroup);
        const { lowerLimitFemale, upperLimitFemale, lowerLimitMale, upperLimitMale, lowerLimitChildren, upperLimitChildren, upperLimitNeonates, lowerLimitNeonates } = resolved, rest = __rest(resolved, ["lowerLimitFemale", "upperLimitFemale", "lowerLimitMale", "upperLimitMale", "lowerLimitChildren", "upperLimitChildren", "upperLimitNeonates", "lowerLimitNeonates"]);
        return Object.assign(Object.assign({}, rest), { value: row.value ? (0, encryptionModels_1.decrypt_value)(row.value) : row.value });
    });
}
