import { Request, Response } from 'express';
import { customError, responseError } from '../../hooks/helper';
import logger from '../../hooks/logger';
import { TestCatalogManagement, TestCatalogOperationError } from '../../testpanel/application/TestCatalogManagement';

export class TestCatalogController {
     constructor(private management: TestCatalogManagement) {}

     readonly updateQcRequirement = async (req: Request, res: Response) => {
          try {
               const tenantId = parseInt(String(req.query.tenantId), 10);
               const body = req.body as { testid?: number; requiresQc?: boolean | number };
               const testId = Number(body.testid);
               const rawRequirement = body.requiresQc;
               if (!Number.isInteger(testId) || testId <= 0 || rawRequirement === undefined || ![true, false, 0, 1].includes(rawRequirement)) {
                    return customError('testid and boolean requiresQc are required', 400, res);
               }

               const result = await this.management.updateQcRequirement(tenantId, testId, Boolean(rawRequirement));
               if (result === 'not-found') return customError('Test panel not found', 404, res);
               res.send({ status: 'success', testid: testId, requiresQc: Boolean(rawRequirement) });
          } catch (error) {
               responseError(res, error);
          }
     };

     readonly updateBulkPricing = async (req: Request, res: Response) => {
          try {
               const tenantId = parseInt(req.query.tenantId.toString(), 10);
               const body = req.body as { tests?: { testid: number; price: number; cost: number }[] };
               const result = await this.management.updateBulkPricing(tenantId, body.tests || []);
               if (result === 'empty') return customError('Tests array is required and must not be empty', 400, res);
               if (result === 'invalid') return customError('Each test must have testid, price, and cost', 400, res);
               res.send({ message: 'Test pricing updated successfully', statusCode: 200, status: 'success' });
          } catch (error) {
               logger.error(error instanceof TestCatalogOperationError ? error.originalError : error);
               customError('Failed to update test pricing', 500, res);
          }
     };

     readonly renameTest = async (req: Request, res: Response) => {
          try {
               const { name, testid } = req.body as { name?: string; testid?: number };
               if (!name || !testid || typeof testid !== 'number' || typeof name !== 'string') {
                    return customError('invalid request body provided', 404, res);
               }

               const result = await this.management.renameTest(parseInt(req.query.tenantId.toString(), 10), testid, name);
               res.send({ status: result === 'updated' ? 'success' : 'failed' });
          } catch (error) {
               responseError(res, error);
          }
     };
}
