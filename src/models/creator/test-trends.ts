
import KnexConnection from "../../database/KnexConnections";
import { decrypt_value } from "../../utils/encryptionModels";
import Registration from "../registration/registration";
import ApplicationSettings from "../application/appsettings/appset";
import { applyDemographicLimits, getAgeGroup } from "./demographic-limits";



export async function getTestTrends(
     tenantId: number,
     patientid: number,
     testid: number,
     trendNumber: number = 10,
     limit?: number
): Promise<any[]> {
     const knex = await KnexConnection(tenantId);
     const [patientBasicData, settings] = await Promise.all([
          new Registration().getPatientBasicData(tenantId, patientid),
          new ApplicationSettings().getAllAppSettings(tenantId)
     ]);

     const patientGender = (patientBasicData?.gender || "").toString();
     const ageType = (patientBasicData as any)?.ageType || (patientBasicData as any)?.agetype;
     const ageGroup = getAgeGroup(patientBasicData?.age, ageType, settings?.ageVariationLimits);

     // Step 1: Get latest distinct ascensionids using raw SQL
     const ascensionSql = `
          SELECT DISTINCT ascensionid
          FROM test_results
          WHERE patientid = ? AND testid = ?
          ${trendNumber ? 'LIMIT ' + trendNumber : ''}
     `;



     const ascensionRows = await knex.raw(ascensionSql, [patientid, testid]);
     const ascensionids = Array.isArray(ascensionRows) && Array.isArray(ascensionRows[0])
          ? ascensionRows[0].map((r: any) => r.ascensionid)
          : ascensionRows.map((r: any) => r.ascensionid);
     if (!ascensionids.length) return [];

     // Step 2: Fetch results for those ascensionids using raw SQL
     // Convert ids to string for IN clause after numeric cleanup.
     const ascensionIdsString = ascensionids.map((id: string) => parseInt(id)).join(',');

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
     return rows.map((row: any) => {
          const resolved = applyDemographicLimits(row, patientGender, ageGroup) as any;
          const {
               lowerLimitFemale,
               upperLimitFemale,
               lowerLimitMale,
               upperLimitMale,
               lowerLimitChildren,
               upperLimitChildren,
               upperLimitNeonates,
               lowerLimitNeonates,
               ...rest
          } = resolved;

          return {
               ...rest,
               value: row.value ? decrypt_value(row.value) : row.value
          };
     });
}