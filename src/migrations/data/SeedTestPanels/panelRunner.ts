import KnexConnection from "../../../database/KnexConnections";
import { promisifyQuery } from "../../../hooks/helper";
import TestCreationRulesRepository, { TestCreationRule } from "../../../models/TestCreation/TestCreationRulesRepository";
import { testspanels } from "../test_creation_metadata";
import fs from 'fs/promises'
import path from 'path';

export async function PanelRunner(tenantId) {
     const connection = await KnexConnection(tenantId)
     await connection("testcreationrules").del()
     await connection("test_panels").del()
     
     for (const panel of testspanels) {
          const { name, filename } = panel;
          const query = `INSERT INTO test_panels (name, iscustom) VALUES (?, ?)`;
          const result = await promisifyQuery(tenantId, query, [name, 1]);

          const insertedId = result.insertId;
          const testidRow = await promisifyQuery(tenantId, `SELECT * FROM test_panels WHERE prim_key = ? LIMIT 1`, [insertedId]);
          const testid = testidRow[0]['id'];

          try {
              
               const filenamepath = path.join(__dirname, `../migrationseeds/${filename}`);
               const fileContent = await fs.readFile(filenamepath, 'utf-8');
               const parseddata = JSON.parse(fileContent);

               const formattedData = parseddata.testcreationrule.map(rule => ({
                    name: rule.name,
                    value: rule.value,
                    hasunits: rule.hasUnits,
                    units: rule.units,
                    plan: rule.plan,
                    plain: rule.plain,
                    ordering: rule.ordering,
                    textReference: rule.textReference,
                    upperlimit: rule.upperLimit,
                    lowerlimit: rule.lowerLimit,
                    undercategory: rule.underCategory,
                    categoryid: rule.categoryId,
                    options: rule.options
               }));

             await new TestCreationRulesRepository(tenantId).create(formattedData, testid);

          } catch (err) {
               console.log(err);
               await promisifyQuery(tenantId, `DELETE FROM test_panels WHERE id =? LIMIT 1`, [testid]);
               await promisifyQuery(tenantId, `DELETE FROM testcreationrules WHERE testid =? LIMIT 1`, [testid]);
          }
     }
}