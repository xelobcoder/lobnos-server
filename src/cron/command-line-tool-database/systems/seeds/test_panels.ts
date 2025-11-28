import * as fs from 'fs';
import * as path from 'path';

exports.seed = async function (knex) {

     await knex.raw('SET FOREIGN_KEY_CHECKS = 0;');
     await knex('testcreationrules').del();
     await knex('testdetails').del();
     await knex('test_panels').del();

     await knex.raw('SET FOREIGN_KEY_CHECKS = 1;');
     await knex.raw('ALTER TABLE test_panels AUTO_INCREMENT = 1;');
     await knex.raw('ALTER TABLE testdetails AUTO_INCREMENT = 1;');
     await knex.raw('ALTER TABLE testcreationrules AUTO_INCREMENT = 1;');

     const currentDate = new Date();

     const creationRulesPath = path.join(__dirname, '../..', 'laboratory-test-panels', 'creationrules');
     console.log(`Reading test panel files from: ${creationRulesPath}`);

     const files = fs.readdirSync(creationRulesPath).filter(file => file.endsWith('.json'));

     console.log(`Found ${files.length} JSON files to process`);

     const seenNames = new Set();
     let processedCount = 0;

     for (const file of files) {
          try {
               const filePath = path.join(creationRulesPath, file);
               const fileContent = fs.readFileSync(filePath, 'utf8');
               const jsonData = JSON.parse(fileContent);

               if (Array.isArray(jsonData) && jsonData.length > 0) {
                    const testPanel = jsonData[0];
                    const normalizedName = testPanel.name.toLowerCase().trim();

                    if (seenNames.has(normalizedName)) {
                         console.log(`Skipping duplicate test name: ${testPanel.name} (${file})`);
                         continue;
                    }

                    seenNames.add(normalizedName);

                    await knex.transaction(async (trx) => {
                         const panelData = {
                              name: testPanel.name,
                              category: testPanel.category,
                              price: testPanel.price || 0,
                              sample: testPanel.sample,
                              description: testPanel.description,
                              sample_container: testPanel.sample_container,
                              unit: testPanel.unit,
                              qty_required: testPanel.qty_required,
                              shorttext: testPanel.shorttext,
                              iscustom: testPanel.iscustom || 0,
                              created_on: currentDate
                         };

                         await trx('test_panels').insert(panelData);

                         const insertedPanel = await trx('test_panels')
                              .where('name', testPanel.name)
                              .orderBy('id', 'desc')
                              .first();

                         if (!insertedPanel) {
                              throw new Error(`Failed to retrieve inserted test panel: ${testPanel.name}`);
                         }

                         const panelId = insertedPanel.id;
                         console.log(`Created test panel: ${testPanel.name} (ID: ${panelId})`);

                         console.log("Creating testPanel.testdetails:", panelId);


                         if (testPanel.testdetails) {
                              await trx('testdetails')
                                   .where('testid', panelId)
                                   .update({
                                        testcost: testPanel.testdetails.testcost || testPanel.price || 0,
                                        hasManual: testPanel.testdetails.hasManual || 0,
                                        procedureCode: testPanel.testdetails.procedureCode || null,
                                        pre_Tat: testPanel.testdetails.pre_Tat || null,
                                        tat: testPanel.testdetails.tat || null,
                                        post_Tat: testPanel.testdetails.post_Tat || null,
                                        tatCount: testPanel.testdetails.tatCount || null,
                                        updatedon: currentDate,
                                        updatedby: testPanel.testdetails.updatedby || 1,
                                        isoutsourced: testPanel.testdetails.isoutsourced || 0,
                                        showtrend: testPanel.testdetails.showtrend || 1,
                                        testprice: testPanel.testdetails.testprice || testPanel.price || 0,
                                        hasGenderVariation: testPanel.testdetails.hasGenderVariation || 0,
                                        hasChildrenLimit: testPanel.testdetails.hasChildrenLimit || 0,
                                        childrenlimit: testPanel.testdetails.childrenlimit || '',
                                        useLiterature: testPanel.testdetails.useLiterature || testPanel.testdetails.uselimiterature || 0,
                                        hasDrugs: testPanel.testdetails.hasDrugs || 0,
                                        outSourcingList: testPanel.testdetails.outSourcingList || testPanel.testdetails.outsourcingList || null,
                                        post_TatEvaluation: testPanel.testdetails.post_TatEvaluation || '',
                                        pre_TatEvaluation: testPanel.testdetails.pre_TatEvaluation || '',
                                        tatEvaluation: testPanel.testdetails.tatEvaluation || '',
                                        reportitle: testPanel.testdetails.reportitle || null,
                                        method: testPanel.testdetails.method || null,
                                        deviceInterfaceMapping: testPanel.testdetails.deviceInterfaceMapping || null,
                                        instrumentation: testPanel.testdetails.instrumentation || null
                                   });
                              console.log(`Updated testdetails for: ${testPanel.name}`);
                         }

                         if (testPanel.testcreationrules && Array.isArray(testPanel.testcreationrules)) {
                              const rulesData = testPanel.testcreationrules.map((rule: any, index: number) => ({
                                   testid: panelId,
                                   name: rule.name,
                                   hasunits: rule.hasunits || false,
                                   units: rule.units || '',
                                   plan: rule.plan,
                                   upperlimit: rule.upperlimit?.toString() || '',
                                   lowerlimit: rule.lowerlimit?.toString() || '',
                                   categoryid: null,
                                   alert: rule.alert || null,
                                   ordering: rule.ordering || index + 1,
                                   undercategory: rule.undercategory || 0,
                                   valueAlert: rule.valueAlert || null,
                                   isValueTracked: rule.isValueTracked || 0,
                                   options: rule.options || null,
                                   plain: rule.plain || null,
                                   textReference: rule.textReference || null,
                                   field: rule.field || null,
                                   value: rule.value || null
                              }));

                              if (rulesData.length > 0) {
                                   await trx('testcreationrules').insert(rulesData);
                                   console.log(`Created ${rulesData.length} rules for: ${testPanel.name}`);
                              }
                         }
                    });

                    processedCount++;
               }
          } catch (error) {
               console.error(`Error processing file ${file}:`, error);
          }
     }

     console.log(`\nSeeding completed successfully!`);
     console.log(`Processed ${processedCount} unique test panels`);
     console.log(`Skipped ${files.length - processedCount} duplicate tests`);
};

