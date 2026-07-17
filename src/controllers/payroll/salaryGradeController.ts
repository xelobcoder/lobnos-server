import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { SalaryGradeRepository } from '../../models/payroll/SalaryGradeRepository';


/**
 * Create a new salary grade
 */
export const createSalaryGradeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { grade_name, grade_level, role_name, min_salary, max_salary, description, currency, is_active } = req.body;

          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const id = await repo.create({
               grade_name: grade_name || role_name,
               grade_level,
               role_name,
               min_salary,
               max_salary,
               description,
               currency: currency || 'GHS',
               is_active: is_active !== undefined ? is_active : true,
               created_by: (req as any).user?.id // Assuming user info is available
          });

          res.json({
               status: 'success',
               statusCode: 201,
               message: 'Salary grade created successfully',
               result: { id }
          });
     } catch (error) {
          return customError('Failed to create salary grade', 500, res);
     }
};

/**
 * Get salary grade by ID
 */
export const getSalaryGradeByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and Grade ID are required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const grade = await repo.getById(id);

          if (!grade) {
               return customError('Salary grade not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: grade
          });
     } catch (error) {
          return customError('Failed to retrieve salary grade', 500, res);
     }
};

/**
 * Get salary grade by name
 */
export const getSalaryGradeByNameHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const gradeName = req.params.name;

          if (!tenantId || !gradeName) {
               return customError('Tenant ID and Grade name are required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const grade = await repo.getByName(gradeName);

          if (!grade) {
               return customError('Salary grade not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: grade
          });
     } catch (error) {
          return customError('Failed to retrieve salary grade by name', 500, res);
     }
};

/**
 * Get all salary grades
 */
export const getAllSalaryGradesHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const activeOnly = req.query.activeOnly !== 'false'; // Default to true

          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const grades = await repo.getAll(activeOnly);

          res.json({
               status: 'success',
               statusCode: 200,
               result: grades
          });
     } catch (error) {
          return customError('Failed to retrieve salary grades', 500, res);
     }
};

/**
 * Update salary grade
 */
export const updateSalaryGradeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);
          const updateData = req.body;

          if (!tenantId || !id) {
               return customError('Tenant ID and Grade ID are required', 400, res);
          }

          // Add updated_by if user info is available
          if ((req as any).user?.id) {
               updateData.updated_by = (req as any).user.id;
          }

          const repo = new SalaryGradeRepository(tenantId);
          const success = await repo.update(id, updateData);

          if (!success) {
               return customError('Failed to update salary grade', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Salary grade updated successfully'
          });
     } catch (error) {
          return customError('Failed to update salary grade', 500, res);
     }
};

/**
 * Deactivate salary grade
 */
export const deactivateSalaryGradeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and Grade ID are required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const success = await repo.deactivate(id);

          if (!success) {
               return customError('Failed to deactivate salary grade', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Salary grade deactivated successfully'
          });
     } catch (error) {
          return customError('Failed to deactivate salary grade', 500, res);
     }
};

/**
 * Get salary grades within salary range
 */
export const getSalaryGradesInRangeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const minSalary = parseFloat(req.query.minSalary as string);
          const maxSalary = parseFloat(req.query.maxSalary as string);

          if (!tenantId || isNaN(minSalary) || isNaN(maxSalary)) {
               return customError('Tenant ID, minSalary, and maxSalary are required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const grades = await repo.getGradesInSalaryRange(minSalary, maxSalary);

          res.json({
               status: 'success',
               statusCode: 200,
               result: grades
          });
     } catch (error) {
          return customError('Failed to retrieve salary grades in range', 500, res);
     }
};

export const getSalaryGradeRolesHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);

          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new SalaryGradeRepository(tenantId);
          const roles = await repo.getAvailableRoles();

          res.json({
               status: 'success',
               statusCode: 200,
               result: roles
          });
     } catch (error) {
          return customError('Failed to retrieve salary grade roles', 500, res);
     }
};