import { Request, Response } from 'express';
import { responseError } from '../../hooks/helper';
import { CalculationFormulaService } from '../../models/creator/calculations/CalculationFormulaService';
import { getAuthUser } from '../../middleware/authority';
import { evaluateFormula, validateFormula } from '../../models/creator/calculations/FormulaEngine';
import { z } from 'zod';

const service = new CalculationFormulaService();

export async function getCalculationFormulas(req: Request, res: Response): Promise<void> {
     try {
          const tenantId = getAuthUser(req)!.tenantId;
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
          const tenantId = getAuthUser(req)!.tenantId;
          const employeeId = getAuthUser(req)!.employeeid;
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

export async function previewCalculationFormula(req: Request, res: Response): Promise<void> {
     try {
          const input = z.object({ expression: z.string().min(1).max(1000), variables: z.record(z.number().finite()), decimalPrecision: z.number().int().min(0).max(12), conditions: z.array(z.object({ inputToken: z.string(), operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']), value: z.number().finite() })).max(100).default([]) }).parse(req.body);
          validateFormula(input.expression, Object.keys(input.variables));
          for (const condition of input.conditions) {
               const value = input.variables[condition.inputToken];
               if (value == null) throw new Error(`Missing condition input ${condition.inputToken}`);
               const met = { eq: value === condition.value, neq: value !== condition.value, gt: value > condition.value, gte: value >= condition.value, lt: value < condition.value, lte: value <= condition.value }[condition.operator];
               if (!met) throw new Error(`Sample inputs do not meet the condition for ${condition.inputToken}`);
          }
          res.json({ status: 'success', value: evaluateFormula(input.expression, input.variables).toFixed(input.decimalPrecision) });
     } catch (error: any) { res.status(400).json({ status: 'error', message: error?.message || 'Unable to preview formula' }); }
}
