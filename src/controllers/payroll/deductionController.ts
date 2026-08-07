import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { PrimeSqlErrorHandler } from '../../hooks/utility';
import { DeductionDefinitionRepository, IDeductionDefinition } from '../../models/payroll/DeductionDefinitionRepository';
import { IOtherDeduction, OtherDeductionRepository } from '../../models/payroll/DeductionRepository';
import { NotificationDispatcher } from '../../models/application/notifications/services/NotificationDispatcher';

const hydrateDeductionFromDefinition = async (
     tenantId: number,
     payload: Partial<IOtherDeduction>
): Promise<Partial<IOtherDeduction>> => {
     if (!payload.deduction_definition_id) {
          return payload;
     }

     const definitionRepo = new DeductionDefinitionRepository(tenantId);
     const definition = await definitionRepo.getById(payload.deduction_definition_id);

     if (!definition || !definition.is_active) {
          throw new Error('Deduction definition not found or inactive');
     }

     return {
          ...payload,
          deduction_type: payload.deduction_type || definition.deduction_code,
          deduction_name: payload.deduction_name || definition.deduction_name
     };
};

export const createDeductionDefinitionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const definition: IDeductionDefinition = req.body;
          const repo = new DeductionDefinitionRepository(tenantId);
          const id = await repo.create(definition);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Deduction definition created successfully',
               result: { id }
          });
     } catch (error) {
          console.log(error)
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllDeductionDefinitionsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const activeOnly = req.query.activeOnly !== 'false';
          const repo = new DeductionDefinitionRepository(tenantId);
          const definitions = await repo.getAll(activeOnly);

          res.json({
               status: 'success',
               statusCode: 200,
               result: definitions
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getDeductionDefinitionByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and deduction definition ID are required', 400, res);
          }

          const repo = new DeductionDefinitionRepository(tenantId);
          const definition = await repo.getById(id);

          if (!definition) {
               return customError('Deduction definition not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: definition
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const updateDeductionDefinitionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!id) return customError('Deduction definition ID is required', 400, res);

          const repo = new DeductionDefinitionRepository(tenantId);
          const success = await repo.update(id, req.body);

          if (!success) {
               return customError('Failed to update deduction definition', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Deduction definition updated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const deactivateDeductionDefinitionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and deduction definition ID are required', 400, res);
          }

          const repo = new DeductionDefinitionRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate deduction definition', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Deduction definition deactivated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const createOtherDeductionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new OtherDeductionRepository(tenantId);
          const payload = await hydrateDeductionFromDefinition(tenantId, req.body);
          const id = await repo.create(payload as IOtherDeduction);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Other deduction created successfully',
               result: { id }
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getAllOtherDeductionsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const activeOnly = req.query.activeOnly !== 'false';
          const repo = new OtherDeductionRepository(tenantId);
          const deductions = await repo.getAll(activeOnly);

          res.json({
               status: 'success',
               statusCode: 200,
               result: deductions
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getOtherDeductionByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!id) return customError('Tenant ID and deduction ID are required', 400, res);
          const repo = new OtherDeductionRepository(tenantId);
          const deduction = await repo.getById(id);

          if (!deduction) {
               return customError('Other deduction not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: deduction
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getOtherDeductionLedgerHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and deduction ID are required', 400, res);
          }

          const repo = new OtherDeductionRepository(tenantId);
          const ledger = await repo.getLedgerByDeductionId(id);

          res.json({
               status: 'success',
               statusCode: 200,
               result: ledger
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getOtherDeductionsByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid.toString());

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and employee ID are required', 400, res);
          }

          const repo = new OtherDeductionRepository(tenantId);
          const deductions = await repo.getByEmployeeId(employeeid);

          res.json({
               status: 'success',
               statusCode: 200,
               result: deductions
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getActiveOtherDeductionsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new OtherDeductionRepository(tenantId);
          const deductions = await repo.getAll(true);

          res.json({
               status: 'success',
               statusCode: 200,
               result: deductions
          });
          return;
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const getPendingOtherDeductionApprovalsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new OtherDeductionRepository(tenantId);
          const deductions = await repo.getPendingApprovals();

          res.json({
               status: 'success',
               statusCode: 200,
               result: deductions
          });
          return;
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const updateOtherDeductionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) return customError('Tenant ID and deduction ID are required', 400, res);

          const repo = new OtherDeductionRepository(tenantId);
          const payload = await hydrateDeductionFromDefinition(tenantId, req.body);
          const success = await repo.update(id, payload);

          if (!success) return customError('Failed to update other deduction', 400, res);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Other deduction updated successfully'
          });
     } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);

          if (message.includes('repayment history') || message.includes('Balance-related fields cannot be edited directly')) {
               return customError(
                    'This loan already has repayment records. You cannot change amount or balance directly. Use a loan adjustment entry instead.',
                    409,
                    res
               );
          }

          if (message.includes('not found')) {
               return customError(message, 404, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const deactivateOtherDeductionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and deduction ID are required', 400, res);
          }

          const repo = new OtherDeductionRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate other deduction', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Other deduction deactivated successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const approveOtherDeductionHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());
          const approvedBy = parseInt(req.body.approved_by);

          if (!tenantId || !id || !approvedBy) {
               return customError('Tenant ID, deduction ID, and approved_by are required', 400, res);
          }

          const repo = new OtherDeductionRepository(tenantId);
          const success = await repo.approve(id, approvedBy);

          if (!success) {
               return customError('Failed to approve other deduction', 400, res);
          }

          NotificationDispatcher.dispatch(
               tenantId,
               'PAYROLL_ADJUSTMENT_APPROVED',
               { payrollId: id },
               approvedBy || undefined,
          ).catch(() => { });

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Other deduction approved successfully'
          });
     } catch (error) {
          PrimeSqlErrorHandler.handleError(error, res);
     }
};

export const createLoanAdjustmentHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id.toString());

          if (!tenantId || !id) {
               return customError('Tenant ID and deduction ID are required', 400, res);
          }

          const adjustment_amount = Number(req.body.adjustment_amount);
          const adjustment_action = String(req.body.adjustment_action || '').trim();
          const adjusted_by = Number(req.body.adjusted_by);
          const reason = String(req.body.reason || '').trim();

          const repo = new OtherDeductionRepository(tenantId);
          const result = await repo.applyLoanAdjustment(id, {
               adjustment_amount,
               adjustment_action: adjustment_action as 'increase_balance' | 'decrease_balance',
               adjusted_by,
               reason
          });

          NotificationDispatcher.dispatch(
               tenantId,
               'PAYROLL_ADJUSTMENT_CREATED',
               { payrollId: id },
               adjusted_by || undefined,
          ).catch(() => { });

          return res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Loan adjustment recorded successfully',
               result
          });
     } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          if (
               message.includes('adjustment_amount') ||
               message.includes('adjustment_action') ||
               message.includes('adjusted_by') ||
               message.includes('reason') ||
               message.includes('negative') ||
               message.includes('only allowed for deductions of type loan')
          ) {
               return customError(message, 400, res);
          }

          if (message.includes('not found')) {
               return customError(message, 404, res);
          }

          PrimeSqlErrorHandler.handleError(error, res);
     }
};