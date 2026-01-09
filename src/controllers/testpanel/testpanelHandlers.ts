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


// Category Handlers
export const getCategories = (req: Request, res: Response) => {
     getCategory(req, res);
};

export const postCategories = (req: Request, res: Response) => {
     postCategory(req, res);
};

// Test Panel Handlers
export const getTestPanelList = (req: Request, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.getPanels(tenantId, req, res);
};

export const getBulkTestPanelList = async (req: Request, response: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId.toString())
          const grouping = req.query.grouping as 'client' | 'master' || 'client';
          const result = await testpanel.getpanelsbulk(tenantId, grouping);
          response.send({ message: "Success", statusCode: 200, status: "success", data: result });
     } catch (err) {
          logger.error(err);
          response.send({ message: (err as Error).message, statusCode: 500, status: "error" });
     }
};

export const postCreateCustomTestPanel = async (req: Request, res: Response) => {
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

export const putTestPanelUpdateProcedureManual = async (req: Request, res: Response) => {
     try {
          const { proceduremanual, employeeid, testid, title } = req.body;
          const tenantId = parseInt(req.query.tenantId.toString())
          if (!proceduremanual || !employeeid || !testid) {
               return customError("employeeid, testid and proceduremanual are required", 404, res);
          }

          // testid exist 
          const testExistInManualQuery = `SELECT * FROM proceduremanual WHERE testid = ?`;

          const isExist = await promisifyQuery(tenantId, testExistInManualQuery, [parseInt(testid, 10)]);
          console.log(isExist)
          if (Array.isArray(isExist) && isExist.length === 0) {
               const insertProcedure = await promisifyQuery(tenantId, `INSERT INTO proceduremanual  (testid, proceduremanual,  createdby,  title) VALUES(?,?,?,?)`,
                    [parseInt(testid, 10), proceduremanual, parseInt(employeeid, 10), title]
               )
               return res.send({ status: rowAffected(insertProcedure) === true ? "success" : "failed" });
          }
          const isUpdated = await testpanel.updateProcedureManual(
               tenantId,
               proceduremanual,
               parseInt(testid, 10),
               parseInt(employeeid, 10),
               title
          )

          return res.send({ status: isUpdated ? "success" : "failed" });

     } catch (err) {
          console.log(err)
          responseError(res);
     }
};

export const getTestPanelEdit = async (req: Request, res: Response) => {
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

export const getProcedureManual = async (req: Request, res: Response) => {
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

export const getTestLiteratureReview = async (req: Request, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup(null).getSetupLiterature(tenantId, parseInt(testid.toString()));
          if (result.length > 0) {
               res.send(result[0]);
          } else {
               res.send({});
          }
     } catch (err) {
          responseError(res);
     }
};

export const putTestLiteratureReview = async (req: Request, res: Response) => {
     try {
          const { testid, literature } = req.body;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const update = await new TestLiteratureSetup(null).updateSetupLiterature(tenantId, literature, testid);
          res.send({ status: rowAffected(update) ? "success" : "failed" });
     } catch (err) {
          responseError(res);
     }
};

export const getLiteratureReviewResult = async (req: Request, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup(null).getResultLiterature(tenantId, parseInt(testid.toString()));
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const postBulkTestPanelUpdate = (req: Request, res: Response) => {
     testpanel.bulkTestUpdate(req, res);
};

export const postTestPanelCreate = (req: Request, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.postPanel(tenantId, req, res);
};

export const putTestPanelUpdate = (req: Request, res: Response) => {
     const tenantId = parseInt(req.query.tenantId.toString())
     testpanel.putSingleTestPanel(tenantId, req, res);
};

export const deleteTestPanel = async (req: Request, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await testpanel.dropPanelWithDependencies(tenantId, parseInt(testid.toString()));
          res.send({ status: result === true ? "success" : "failed" });
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

export const getTestPanelData = async (req: Request, res: Response) => {
     try {
          const { csvid, ptid, target = "70,50" } = req.query;
          if (!csvid || !ptid) return customError("right query params missing", 400, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const outgoing_data = await new Creator(null).getResultEntryTest(tenantId, csvid as string, ptid as string, target);
          res.send(outgoing_data);
     } catch (err) {
          responseError(res);
     }
};

export const putTestPanelChangeName = async (req: Request, res: Response) => {
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
export const getTestSetupLiterature = async (req: Request, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup(null).getSetupLiterature(tenantId, parseInt(testid.toString()));
          if (result.length > 0) {
               res.send(result[0]);
          } else {
               res.send({});
          }
     } catch (err) {
          responseError(res);
     }
};

export const putTestSetupLiterature = async (req: Request, res: Response) => {
     try {
          const { testid, literature } = req.body;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const update = await new TestLiteratureSetup(null).updateSetupLiterature(tenantId, literature, testid);
          res.send({ status: update ? "success" : "failed" });
     } catch (err) {
          responseError(res);
     }
};

export const getTestSetupResultLiterature = async (req: Request, res: Response) => {
     try {
          const { testid } = req.query;
          if (!testid) return customError("testid is required", 404, res);
          const tenantId = parseInt(req.query.tenantId.toString())
          const result = await new TestLiteratureSetup(null).getResultLiterature(tenantId, parseInt(testid.toString()));
          res.send(result);
     } catch (err) {
          responseError(res);
     }
};

export const putBulkTestPricingUpdate = async (req: Request, res: Response) => {
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
