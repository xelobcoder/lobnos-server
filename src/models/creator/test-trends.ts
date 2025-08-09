
import KnexConnection from "../../database/KnexConnections";
import { decrypt_value } from "../../utils/encryptionModels";



export async function getTestTrends(
     tenantId: number,
     patientid: number,
     testid: number,
     trendNumber: number = 10,
     limit?: number
): Promise<any[]> {
     const knex = await KnexConnection(tenantId);

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
     // If ascensionids is empty, prevent invalid SQL
     if (!ascensionids.length) return [];
       
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

     console.log("resultsSql", resultsSql);
     const resultsRaw = await knex.raw(resultsSql, [patientid, testid]);
     const rows = Array.isArray(resultsRaw) && Array.isArray(resultsRaw[0]) ? resultsRaw[0] : resultsRaw;
     return rows.map((row: any) => ({
          ...row,
          value: row.value ? decrypt_value(row.value) : row.value
     }));
}