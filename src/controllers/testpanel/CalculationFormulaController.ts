import { Request, Response } from 'express';
import { responseError } from '../../hooks/helper';
import { CalculationFormulaService } from '../../models/creator/calculations/CalculationFormulaService';

const service = new CalculationFormulaService();

export async function getCalculationFormulas(req: Request, res: Response): Promise<void> {
     try {
          const tenantId = Number(req.query.tenantId);
          const testId = Number(req.query.testid);
          if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(testId) || testId <= 0) {
               res.status(400).send({ status: 'error', message: 'tenantId and testid are required' });
               return;
          }
          res.send(await service.getFormulas(tenantId, testId));
     } catch (error) {
          responseError(res, error);
     }
}

export async function putCalculationFormula(req: Request, res: Response): Promise<void> {
     try {
          const tenantId = Number(req.query.tenantId);
          const employeeId = Number(req.query.employeeid || req.body.employeeid);
          if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(employeeId) || employeeId <= 0) {
               res.status(400).send({ status: 'error', message: 'tenantId and employeeid are required' });
               return;
          }
          const formulaId = await service.saveFormula(tenantId, req.body, employeeId);
          res.status(201).send({ status: 'success', formulaId });
     } catch (error: any) {
          res.status(400).send({ status: 'error', message: error?.message || 'Unable to save formula' });
     }
}