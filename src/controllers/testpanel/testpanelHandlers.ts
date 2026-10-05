import { Request, Response } from "express";
import Creator from "../../models/creator/creator";
import { getCategory, postCategory } from "../../testpanel/categories";
import { customError, promisifyQuery, responseError, rowAffected } from "../../hooks/helper";
import TestLiteratureSetup from "../../testpanel/literature";
import { testpanel } from "../../testpanel/testpanelList";
import TestCreationRulesRepository from "../../models/TestCreation/TestCreationRulesRepository";
import logger from "../../hooks/logger";
import MasterTestPanelRepository from "../../models/system-admin/MasterTestPanelRepository";
import KnexConnection from "../../database/KnexConnections";
import { applyTestPanelsAfterInsert } from "../../database/appLevelTriggers";
import { generateNextTestPanelId } from "../../testpanel/testPanelId";


// Category Handlers
export const getCategories = (req: Request, res: Response) => {
     getCategory(req, res);
};

export const postCategories = (req: Request, res: Response) => {
     postCategory(req, res);
};

// Test Panel Handlers
export const getTestPanelList = (req: Request<{}, {}, {}, { tenantId: number }>, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.getPanels(tenantId, req as any, res);
};

export const getBulkTestPanelList = async (req: Request<{}, {}, {}, {
     tenantId: number, grouping: 'master' | 'client',
     filtercategory: 'id' | 'name', searchstring: string
}>, response: Response) => {
     try {
          const tenantId = parseInt(req?.query?.tenantId.toString())
          const grouping = req.query.grouping as 'client' | 'master' || 'client';
          const filtercategory = req.query.filtercategory as 'id' | 'name'
          const searchstring = req.query.searchstring as string;
          const result = await testpanel.getpanelsbulk(tenantId, grouping, { filtercategory, searchstring });
          response.send({ message: "Success", statusCode: 200, status: "success", data: result });
     } catch (err) {
          logger.error(err);
          response.send({ message: (err as Error).message, statusCode: 500, status: "error" });
     }
};

export const postCreateCustomTestPanel = async (req: Request<{}, {}, { name: string | { name: string }[] }, { tenantId: number }>, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString());
          let { name } = req.body;
          if (!name) return customError("testname required", 404, res);

          if (Array.isArray(name)) {
               const results = [];
               for (const testName of name) {
                    if (!testName) {
                         results.push({ testName, status: "failed", reason: "Empty name" });
                         continue;
                    }
                    const isSuccess = await testpanel.createCustomTest(tenantId, testName.name);
                    if (isSuccess === "EXIST") {
                         results.push({ testName, status: "failed", reason: "test with same name is available" });
                    } else {
                         results.push({ testName, status: isSuccess ? "success" : "failed" });
                    }
               }
               return res.send({ results });
          } else {
               const isSuccess = await testpanel.createCustomTest(tenantId, name);
               console.log(isSuccess);
               if (isSuccess === "EXIST") {
                    return customError("test with same name is available", 404, res);
               }
               res.send({ status: isSuccess ? "success" : "failed" });
          }
     } catch (err) {
          console.error(err);
          responseError(res);
     }
};

export const putTestPanelUpdateProcedureManual = async (req: Request<{}, {}, { proceduremanual: string, employeeid: number, testid: number, title: string }, { tenantId: number }>, res: Response) => {
     try {
          const { proceduremanual, employeeid, testid, title } = req.body;
          const tenantId = parseInt(req.query.tenantId.toString())
          if (!proceduremanual || !employeeid || !testid) {
               return customError("employeeid, testid and proceduremanual are required", 404, res);
          }

          // testid exist 
          const testExistInManualQuery = `SELECT * FROM proceduremanual WHERE testid = ?`;

          const isExist = await promisifyQuery(tenantId, testExistInManualQuery, [parseInt(testid.toString(), 10)]);
          console.log(isExist)
          if (Array.isArray(isExist) && isExist.length === 0) {
               const insertProcedure = await promisifyQuery(tenantId, `INSERT INTO proceduremanual  (testid, proceduremanual,  createdby,  title) VALUES(?,?,?,?)`,
                    [parseInt(testid.toString(), 10), proceduremanual, parseInt(employeeid.toString(), 10), title]
               )
               return res.send({ status: rowAffected(insertProcedure) === true ? "success" : "failed" });
          }
          const isUpdated = await testpanel.updateProcedureManual(
               tenantId,
               proceduremanual,
               parseInt(testid.toString(), 10),
               parseInt(employeeid.toString(), 10),
               title
          )

          return res.send({ status: isUpdated ? "success" : "failed" });

     } catch (err) {
          console.log(err)
          responseError(res);
     }
};

export const getTestPanelEdit = async (req: Request<{}, {}, {}, { tenantId: number, departmentId?: number, id: number, withoutdepartment?: string }>, res: Response) => {
     try {
          const { id, withoutdepartment } = req.query;
          const tenantId = parseInt(req.query.tenantId.toString())
          if (!id) return customError("testid is required", 404, res);
          const isDepartment = withoutdepartment === "true" ? false : true;
          const result = await testpanel.getPanelEditSingle(tenantId, parseInt(id.toString()), isDepartment);
          res.send(result.length > 0 ? result[0] : {});
     } catch (err) {
          console.log(err)
          responseError(res);
     }
};

export const getProcedureManual = async (req: Request<{}, {}, {}, { tenantId: number, testid: number }>, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await testpanel.getProcedureManuel(tenantId, parseInt(testid.toString()));
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const getTestLiteratureReview = async (req: Request<{}, {}, {}, { tenantId: number, testid: number }>, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup('').getSetupLiterature(tenantId, parseInt(testid.toString()));
          if (result.length > 0) {
               res.send(result[0]);
          } else {
               res.send({});
          }
     } catch (err) {
          responseError(res);
     }
};

export const putTestLiteratureReview = async (req: Request<{}, {}, { testid: number, literature: any }, { tenantId: number }>, res: Response) => {
     try {
          const { testid, literature } = req.body;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const update = await new TestLiteratureSetup('').updateSetupLiterature(tenantId, literature, testid);
          res.send({ status: rowAffected(update) ? "success" : "failed" });
     } catch (err) {
          responseError(res);
     }
};

export const getLiteratureReviewResult = async (req: Request<{}, {}, {}, { tenantId: number, testid: number }>, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup('').getResultLiterature(tenantId, parseInt(testid.toString()));
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const postBulkTestPanelUpdate = (req: Request<{}, {}, {}, { tenantId: number }>, res: Response) => {
     testpanel.bulkTestUpdate(req as any, res);
};

export const postTestPanelCreate = (req: Request<{}, {}, {}, { tenantId: number }>, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.postPanel(tenantId, req as any, res);
};

export const putTestPanelUpdate = (req: Request<{}, {}, {}, { tenantId: number }>, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.putSingleTestPanel(tenantId, req as any, res);
};

export const putTestPanelQcRequirement = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(String(req.query.tenantId), 10);
          const body = req.body as { testid?: number; requiresQc?: boolean | number };
          const testId = Number(body.testid);
          const rawRequirement = body.requiresQc;
          if (!Number.isInteger(testId) || testId <= 0 || rawRequirement === undefined || ![true, false, 0, 1].includes(rawRequirement)) {
               return customError('testid and boolean requiresQc are required', 400, res);
          }

          const connection = await KnexConnection(tenantId);
          const existingTest = await connection('test_panels').select('id').where({ id: testId }).first();
          if (!existingTest) return customError('Test panel not found', 404, res);
          const updated = await connection('test_panels')
               .where({ id: testId })
               .update({ requires_qc: rawRequirement ? 1 : 0 });
          res.send({ status: 'success', testid: testId, requiresQc: Boolean(rawRequirement) });
     } catch (error) {
          responseError(res, error);
     }
};

export const deleteTestPanel = async (req: Request<{}, {}, {}, { tenantId: string; testid: string }>, res: Response) => {
     try {
          const { testid, tenantId } = req.query;
          if (!testid) return customError("testid is required", 400, res);
          if (!tenantId) return customError("tenantId is required", 400, res);

          const parsedTenantId = parseInt(tenantId.toString(), 10);
          if (Number.isNaN(parsedTenantId)) return customError("invalid tenantId", 400, res);

          const testIds = testid
               .toString()
               .split(',')
               .map((s) => s.trim())
               .filter(Boolean)
               .map((s) => parseInt(s, 10));

          if (testIds.length === 0 || testIds.some((n) => Number.isNaN(n))) {
               return customError("one or more testid values are invalid", 400, res);
          }

          const results: { testid: number; status: string }[] = [];
          for (const id of testIds) {
               try {
                    const result = await testpanel.dropPanelWithDependencies(parsedTenantId, id);
                    results.push({ testid: id, status: result === true ? 'deleted' : 'failed' });
               } catch {
                    results.push({ testid: id, status: 'failed' });
               }
          }

          const deleted = results.filter((r) => r.status === 'deleted');
          const failed = results.filter((r) => r.status === 'failed');

          res.send({
               status: 'success',
               statusCode: 200,
               message: `${deleted.length} deleted, ${failed.length} failed`,
               data: { deleted, failed },
          });
     } catch (err) {
          responseError(res);
     }
};

export const getTestPanelCreationRule = async (req: Request<{}, {}, {}, { testid: string, tenantId: number, grouping?: 'client' | "master" }>, res: Response) => {
     try {
          const { testid, grouping } = req.query;
          if (!testid) return customError("testid required", 404, res);
          const parsedTestId = parseInt(testid.toString());
          const tenantId = parseInt(req.query.tenantId.toString())

          const rule: any[] = grouping === 'master' ?
               await new MasterTestPanelRepository().getTestCreationRulesByTestId(parsedTestId) :
               await new TestCreationRulesRepository(tenantId).findByTestId(parsedTestId);
          res.send(rule);
     } catch (err) {
          console.log(err)
          responseError(res);
     }
};

export const getTestPanelData = async (req: Request<{}, {}, {}, { tenantId: number, csvid: string, ptid: string, target?: string }>, res: Response) => {
     try {
          const { csvid, ptid, target = "70,50" } = req.query;
          if (!csvid || !ptid) return customError("right query params missing", 400, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const outgoing_data = await new Creator(0).getResultEntryTest(tenantId, csvid as string, ptid as string, target);
          res.send(outgoing_data);
     } catch (err) {
          responseError(res);
     }
};

export const putTestPanelChangeName = async (req: Request<{}, {}, { name: string, testid: number }, { tenantId: number }>, res: Response) => {
     try {
          const { name, testid } = req.body;
          if (!name || !testid || typeof testid !== "number" || typeof name !== "string") {
               return customError("invalid request body provided", 404, res);
          }
          const tenantId = parseInt(req.query.tenantId.toString())
          const isTestNameChanged = await testpanel.changeTestName(tenantId,
               testid, name);
          res.send({ status: isTestNameChanged ? "success" : "failed" });
     } catch (error) {
          console.error(error);
          responseError(res);
     }
};

// Test Setup Handlers
export const getTestSetupLiterature = async (req: Request<{}, {}, {}, { tenantId: number, testid: number }>, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup('').getSetupLiterature(tenantId, parseInt(testid.toString()));
          if (result.length > 0) {
               res.send(result[0]);
          } else {
               res.send({});
          }
     } catch (err) {
          responseError(res);
     }
};

export const putTestSetupLiterature = async (req: Request<{}, {}, { testid: number, literature: any }, { tenantId: number }>, res: Response) => {
     try {
          const { testid, literature } = req.body;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const update = await new TestLiteratureSetup('').updateSetupLiterature(tenantId, literature, testid);
          res.send({ status: update ? "success" : "failed" });
     } catch (err) {
          responseError(res);
     }
};

export const getTestSetupResultLiterature = async (req: Request<{}, {}, {}, { tenantId: number, testid: number }>, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup('').getResultLiterature(tenantId, parseInt(testid.toString()));
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const putBulkTestPricingUpdate = async (req: Request<{}, {}, { tests: { testid: number, price: number, cost: number }[] }, { tenantId: number }>, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString());
          const { tests } = req.body;

          if (!Array.isArray(tests) || tests.length === 0) {
               return customError("Tests array is required and must not be empty", 400, res);
          }

          const connection = await KnexConnection(tenantId);
          const trx = await connection.transaction();

          try {
               for (const test of tests) {
                    const { testid, price, cost } = test;
                    if (!testid || price === undefined || cost === undefined) {
                         await trx.rollback();
                         return customError("Each test must have testid, price, and cost", 400, res);
                    }

                    await trx('test_panels')
                         .where({ id: testid })
                         .update({
                              price
                         });


                    await trx("testdetails")
                         .where({ testid: testid })
                         .update({
                              testprice: price,
                              testcost: cost,
                              updatedon: trx.fn.now()
                         });
               }

               await trx.commit();
               res.send({ message: "Test pricing updated successfully", statusCode: 200, status: "success" });
          } catch (err) {
               console.log(err)
               await trx.rollback();
               logger.error(err);
               customError("Failed to update test pricing", 500, res);
          }
     } catch (err) {
          logger.error(err);
          customError("Something went wrong", 500, res);
     }
};

const DEADLOCK_MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ImportOneResult = {
     success: boolean;
     skipped: boolean;
     masterTestId: number;
     name: string;
     importedTestId?: number;
     error?: string;
};

async function importOneMasterTest(
     masterTestId: number,
     connection: any,
     masterRepo: MasterTestPanelRepository
): Promise<ImportOneResult> {
     const masterPanel = await masterRepo.getMasterPanelByTestId(masterTestId);
     if (!masterPanel) {
          return { success: false, skipped: false, masterTestId, name: String(masterTestId), error: 'master test not found' };
     }

     let attempt = 0;
     while (true) {
          const trx = await connection.transaction();
          try {
               const existingByName = await trx('test_panels')
                    .whereRaw('LOWER(name) = LOWER(?)', [masterPanel.name])
                    .first();

               if (existingByName) {
                    await trx.rollback();
                    return { success: false, skipped: true, masterTestId, name: masterPanel.name };
               }

               const firstRole = await trx('roles').select('employeeid').orderBy('employeeid', 'asc').first();
               if (!firstRole) {
                    await trx.rollback();
                    return { success: false, skipped: false, masterTestId, name: masterPanel.name, error: 'no employee found in roles table' };
               }

               const defaultEmployeeId = Number(firstRole.employeeid);
               const normalizedDepartmentName = (masterPanel.departmentName || '').toString().trim();
               let departmentCreated = false;

               let targetDepartment = normalizedDepartmentName
                    ? await trx('departments')
                         .whereRaw('LOWER(department) = LOWER(?)', [normalizedDepartmentName])
                         .first()
                    : null;

               if (!targetDepartment) {
                    const fallbackDepartmentName = normalizedDepartmentName || 'General';
                    try {
                         const insertedDepartment = await trx('departments').insert({
                              department: fallbackDepartmentName,
                              departmentManager: 'System Import',
                              employeeid: defaultEmployeeId,
                         });
                         const newDepartmentId = Array.isArray(insertedDepartment) ? insertedDepartment[0] : insertedDepartment;
                         targetDepartment = await trx('departments').where('id', newDepartmentId).first();
                         departmentCreated = true;
                    } catch (departmentInsertError: any) {
                         if (departmentInsertError?.code !== 'ER_DUP_ENTRY') {
                              throw departmentInsertError;
                         }
                         targetDepartment = await trx('departments')
                              .whereRaw('LOWER(department) = LOWER(?)', [fallbackDepartmentName])
                              .first();
                    }

                    if (!targetDepartment) {
                         throw new Error('failed to resolve department during import');
                    }
               }

               let targetSampleContainerId = Number(masterPanel.sample_container ?? 0);
               if (targetSampleContainerId > 0) {
                    const masterSampleContainer = await masterRepo.getMasterSampleContainerById(targetSampleContainerId);
                    if (masterSampleContainer) {
                         let tenantSampleContainer = await trx('samplecontainer')
                              .whereRaw('LOWER(name) = LOWER(?)', [masterSampleContainer.name])
                              .first();

                         if (!tenantSampleContainer) {
                              const insertedSampleContainer = await trx('samplecontainer').insert({
                                   name: masterSampleContainer.name,
                                   description: masterSampleContainer.description ?? null,
                                   volume_capacity: masterSampleContainer.volume_capacity ?? null,
                                   material: masterSampleContainer.material ?? null,
                                   color: masterSampleContainer.color ?? null,
                                   is_reusable: Number(masterSampleContainer.is_reusable ?? 0),
                              });
                              const newSampleContainerId = Array.isArray(insertedSampleContainer) ? insertedSampleContainer[0] : insertedSampleContainer;
                              tenantSampleContainer = await trx('samplecontainer').where('id', newSampleContainerId).first();
                         }

                         targetSampleContainerId = Number(tenantSampleContainer?.id ?? targetSampleContainerId);
                    }
               }

               const id = await generateNextTestPanelId(trx);
               const insertedPanel = await trx('test_panels').insert({
                    id,
                    name: masterPanel.name,
                    category: targetDepartment.id,
                    price: Number(masterPanel.price ?? 0),
                    sample: Number(masterPanel.sample ?? 0),
                    description: masterPanel.description ?? null,
                    sample_container: targetSampleContainerId,
                    unit: masterPanel.unit ?? '',
                    qty_required: masterPanel.qty_required ?? null,
                    shorttext: masterPanel.shorttext ?? null,
                    iscustom: Number(masterPanel.iscustom ?? 0),
               });

               const newPrimKey = Array.isArray(insertedPanel) ? insertedPanel[0] : insertedPanel;
               const newPanel = await trx('test_panels').where('prim_key', newPrimKey).first();
               if (!newPanel || !newPanel.id) {
                    await trx.rollback();
                    return { success: false, skipped: false, masterTestId, name: masterPanel.name, error: 'failed to resolve imported test id' };
               }

               const newTestId = Number(newPanel.id);
               await applyTestPanelsAfterInsert(trx, {
                    testid: newTestId,
                    price: Number(masterPanel.price ?? 0),
                    iscustom: Number(masterPanel.iscustom ?? 0),
               });
               const masterDetails = await masterRepo.getMasterTestDetailsByTestId(masterTestId);
               if (masterDetails) {
                    await trx('testdetails')
                         .where({ testid: newTestId })
                         .update({
                              testcost: masterDetails.testcost,
                              hasManual: masterDetails.hasManual,
                              procedureCode: masterDetails.procedureCode,
                              pre_Tat: masterDetails.pre_Tat,
                              tat: masterDetails.tat,
                              post_Tat: masterDetails.post_Tat,
                              tatCount: masterDetails.tatCount,
                              updatedon: trx.fn.now(),
                              updatedby: Number(masterDetails.updatedby ?? defaultEmployeeId),
                              isoutsourced: Number(masterDetails.isoutsourced ?? 0),
                              showtrend: Number(masterDetails.showtrend ?? 0),
                              testprice: masterDetails.testprice,
                              hasGenderVariation: Number(masterDetails.hasGenderVariation ?? 0),
                              hasChildrenLimit: Number(masterDetails.hasChildrenLimit ?? 0),
                              childrenlimit: masterDetails.childrenlimit ?? '',
                              useLiterature: Number(masterDetails.useLiterature ?? 0),
                              hasDrugs: Number(masterDetails.hasDrugs ?? 0),
                              outSourcingList: masterDetails.outSourcingList ?? null,
                              post_TatEvaluation: masterDetails.post_TatEvaluation ?? 'min',
                              pre_TatEvaluation: masterDetails.pre_TatEvaluation ?? 'min',
                              tatEvaluation: masterDetails.tatEvaluation ?? 'min',
                              deviceInterfaceMapping: masterDetails.deviceInterfaceMapping ?? null,
                              reportitle: masterDetails.reportitle ?? null,
                              method: masterDetails.method ?? null,
                              instrumentation: masterDetails.instrumentation ?? '',
                         });
               }

               const masterSetupLiterature = await masterRepo.getMasterSetupLiteratureByTestId(masterTestId);
               if (masterSetupLiterature) {
                    const existingSetupLiterature = await trx('setupliteraturereview')
                         .where({ testid: newTestId })
                         .first();

                    if (existingSetupLiterature) {
                         await trx('setupliteraturereview')
                              .where({ testid: newTestId })
                              .update({
                                   literature: masterSetupLiterature.literature ?? '',
                                   updated_on: trx.fn.now(),
                              });
                    } else {
                         await trx('setupliteraturereview').insert({
                              testid: newTestId,
                              literature: masterSetupLiterature.literature ?? '',
                         });
                    }
               }

               const categoryIdMap = new Map<number, number>();
               const masterCategories = await masterRepo.getMasterTestDetailCategoriesByTestId(masterTestId);
               for (const category of masterCategories) {
                    const existingCategory = await trx('testdetailcategory')
                         .where({ testid: newTestId, categoryname: category.categoryname })
                         .first();

                    if (existingCategory) {
                         categoryIdMap.set(Number(category.categoryid), Number(existingCategory.categoryid));
                         continue;
                    }

                    const insertedCategory = await trx('testdetailcategory').insert({
                         categoryname: category.categoryname,
                         testid: newTestId,
                         createdby: category.createdby ?? String(defaultEmployeeId),
                         updatedby: category.updatedby ?? null,
                         deleted: Number(category.deleted ?? 0),
                    });

                    const newCategoryId = Array.isArray(insertedCategory) ? insertedCategory[0] : insertedCategory;
                    categoryIdMap.set(Number(category.categoryid), Number(newCategoryId));
               }

               const masterRules = await masterRepo.getTestCreationRulesByTestId(masterTestId);
               for (const rule of masterRules) {
                    const mappedCategoryId = rule.categoryid ? categoryIdMap.get(Number(rule.categoryid)) : null;
                    await trx('testcreationrules').insert({
                         testid: newTestId,
                         name: rule.name,
                         field: rule.field,
                         value: rule.value,
                         hasunits: Number(rule.hasunits ?? 0),
                         units: rule.units,
                         plan: rule.plan,
                         plain: rule.plain,
                         ordering: rule.ordering,
                         isValueTracked: Number(rule.isValueTracked ?? 0),
                         textReference: rule.textReference,
                         upperlimit: rule.upperlimit,
                         lowerlimit: rule.lowerlimit,
                         category: rule.category,
                         options: rule.options,
                         undercategory: Number(rule.undercategory ?? 0),
                         categoryid: mappedCategoryId ?? null,
                         valueAlert: rule.valueAlert,
                         alert: rule.alert,
                         upperLimitFemale: rule.upperLimitFemale,
                         lowerLimitFemale: rule.lowerLimitFemale,
                         upperLimitMale: rule.upperLimitMale,
                         lowerLimitMale: rule.lowerLimitMale,
                         upperLimitChildren: rule.upperLimitChildren,
                         lowerLimitChildren: rule.lowerLimitChildren,
                         upperLimitNeonates: rule.upperLimitNeonates,
                         lowerLimitNeonates: rule.lowerLimitNeonates,
                    });
               }

               await trx.commit();
               return {
                    success: true,
                    skipped: false,
                    masterTestId,
                    name: masterPanel.name,
                    importedTestId: newTestId,
               };
          } catch (transactionError: any) {
               await trx.rollback();
               if (transactionError?.code === 'ER_LOCK_DEADLOCK' && attempt < DEADLOCK_MAX_RETRIES) {
                    attempt++;
                    const backoff = 50 + Math.floor(Math.random() * 150 * attempt);
                    await sleep(backoff);
                    continue;
               }
               return {
                    success: false,
                    skipped: false,
                    masterTestId,
                    name: masterPanel.name,
                    error: transactionError?.message ?? 'import failed',
               };
          }
          break;
     } // end while
}

export const importMasterTestPanelToClientList = async (
     req: Request<{}, {}, {}, { testid: string; tenantId: string }>,
     res: Response
) => {
     try {
          const { testid, tenantId } = req.query;
          if (!testid || !tenantId) {
               return customError("testid and tenantId are required", 400, res);
          }

          const parsedTenantId = parseInt(tenantId.toString(), 10);
          if (Number.isNaN(parsedTenantId)) {
               return customError("invalid tenantId", 400, res);
          }

          const parsedMasterTestIds = testid
               .toString()
               .split(',')
               .map((s) => s.trim())
               .filter(Boolean)
               .map((s) => parseInt(s, 10));

          if (parsedMasterTestIds.length === 0 || parsedMasterTestIds.some((n) => Number.isNaN(n))) {
               return customError("one or more testid values are invalid", 400, res);
          }

          const masterRepo = new MasterTestPanelRepository();
          const connection = await KnexConnection(parsedTenantId);

          const results: ImportOneResult[] = [];
          for (const masterTestId of parsedMasterTestIds) {
               const result = await importOneMasterTest(masterTestId, connection, masterRepo);
               results.push(result);
          }

          const imported = results.filter((r) => r.success);
          const skipped = results.filter((r) => r.skipped);
          const failed = results.filter((r) => !r.success && !r.skipped);

          return res.send({
               status: 'success',
               statusCode: 200,
               message: `${imported.length} imported, ${skipped.length} skipped, ${failed.length} failed`,
               data: {
                    imported: imported.map((r) => ({ masterTestId: r.masterTestId, importedTestId: r.importedTestId, name: r.name })),
                    skipped: skipped.map((r) => ({ masterTestId: r.masterTestId, name: r.name })),
                    failed: failed.map((r) => ({ masterTestId: r.masterTestId, name: r.name, error: r.error })),
               },
          });
     } catch (err) {
          logger.error(err);
          console.log(err);
          responseError(res);
     }
};
