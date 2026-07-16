import { Request, Response } from 'express';
import { customError } from '../../hooks/helper';
import { LeaveRepository } from '../../models/payroll/LeaveRepository';

export const createLeaveHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const repo = new LeaveRepository(tenantId);
          const id = await repo.createLeave(req.body);

          res.status(201).json({
               status: 'success',
               statusCode: 201,
               message: 'Leave request created successfully',
               result: { id }
          });
     } catch (error) {
          return customError((error as Error).message || 'Failed to create leave request', 500, res);
     }
};

export const getLeaveByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and Leave ID are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const leave = await repo.getLeaveById(id);
          if (!leave) {
               return customError('Leave record not found', 404, res);
          }

          res.json({ status: 'success', statusCode: 200, result: leave });
     } catch (error) {
          return customError('Failed to retrieve leave record', 500, res);
     }
};

export const getLeavesByEmployeeIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);

          if (!tenantId || !employeeid) {
               return customError('Tenant ID and Employee ID are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const leaves = await repo.getLeavesByEmployeeId(employeeid);
          res.json({ status: 'success', statusCode: 200, result: leaves });
     } catch (error) {
          return customError('Failed to retrieve employee leave records', 500, res);
     }
};

export const getLeavesByStatusHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { status } = req.params;

          if (!tenantId || !status) {
               return customError('Tenant ID and status are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const leaves = await repo.getLeavesByStatus(status);
          res.json({ status: 'success', statusCode: 200, result: leaves });
     } catch (error) {
          return customError('Failed to retrieve leave records by status', 500, res);
     }
};

export const getLeavesByDateRangeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const startDate = req.query.startDate as string;
          const endDate = req.query.endDate as string;

          if (!tenantId || !startDate || !endDate) {
               return customError('Tenant ID, startDate and endDate are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const leaves = await repo.getLeavesByDateRange(startDate, endDate);
          res.json({ status: 'success', statusCode: 200, result: leaves });
     } catch (error) {
          return customError('Failed to retrieve leave records by date range', 500, res);
     }
};

export const updateLeaveHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and Leave ID are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const updated = await repo.updateLeave(id, req.body);
          if (!updated) {
               return customError('Failed to update leave record', 400, res);
          }

          res.json({ status: 'success', statusCode: 200, message: 'Leave request updated successfully' });
     } catch (error) {
          return customError((error as Error).message || 'Failed to update leave record', 400, res);
     }
};

export const approveLeaveHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);
          const approved_by = parseInt(String(req.body.approved_by));

          if (!tenantId || !id || !approved_by) {
               return customError('Tenant ID, Leave ID and approved_by are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const approved = await repo.approveLeave(id, approved_by);
          if (!approved) {
               return customError('Failed to approve leave request', 400, res);
          }

          res.json({ status: 'success', statusCode: 200, message: 'Leave request approved successfully' });
     } catch (error) {
          return customError((error as Error).message || 'Failed to approve leave request', 500, res);
     }
};

export const rejectLeaveHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);
          const approved_by = parseInt(String(req.body.approved_by));

          if (!tenantId || !id || !approved_by) {
               return customError('Tenant ID, Leave ID and approved_by are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const rejected = await repo.rejectLeave(id, approved_by);
          if (!rejected) {
               return customError('Failed to reject leave request', 400, res);
          }

          res.json({ status: 'success', statusCode: 200, message: 'Leave request rejected successfully' });
     } catch (error) {
          return customError((error as Error).message || 'Failed to reject leave request', 500, res);
     }
};

export const cancelLeaveHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and Leave ID are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const cancelled = await repo.cancelLeave(id);
          if (!cancelled) {
               return customError('Failed to cancel leave request. Only approved leave can be cancelled.', 400, res);
          }

          res.json({ status: 'success', statusCode: 200, message: 'Leave request cancelled successfully' });
     } catch (error) {
          return customError((error as Error).message || 'Failed to cancel leave request', 500, res);
     }
};

export const getLeaveBalanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const year = parseInt(String(req.query.year));

          if (!tenantId || !employeeid || !year) {
               return customError('Tenant ID, employee ID and year are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const balance = await repo.getLeaveBalance(employeeid, year);
          if (!balance) {
               return customError('Leave balance record not found', 404, res);
          }

          res.json({ status: 'success', statusCode: 200, result: balance });
     } catch (error) {
          return customError('Failed to retrieve leave balance', 500, res);
     }
};

export const initializeLeaveBalanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(String(req.body.employeeid));
          const year = parseInt(String(req.body.year));

          if (!tenantId || !employeeid || !year) {
               return customError('Tenant ID, employee ID and year are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const id = await repo.initializeLeaveBalanceForYear(employeeid, year);
          res.status(201).json({ status: 'success', statusCode: 201, message: 'Leave balance initialized successfully', result: { id } });
     } catch (error) {
          return customError((error as Error).message || 'Failed to initialize leave balance', 500, res);
     }
};

export const updateLeaveBalanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!tenantId || !id) {
               return customError('Tenant ID and leave balance ID are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const updated = await repo.updateLeaveBalance(id, req.body);
          if (!updated) {
               return customError('Failed to update leave balance', 400, res);
          }

          res.json({ status: 'success', statusCode: 200, message: 'Leave balance updated successfully' });
     } catch (error) {
          return customError((error as Error).message || 'Failed to update leave balance', 500, res);
     }
};

export const getEmployeesOnLeaveByDateHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const date = req.query.date as string;

          if (!tenantId || !date) {
               return customError('Tenant ID and date are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const leaves = await repo.getEmployeesOnLeaveByDate(date);
          res.json({ status: 'success', statusCode: 200, result: leaves });
     } catch (error) {
          return customError('Failed to retrieve employees on leave', 500, res);
     }
};

export const getLeaveSummaryByEmployeeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const year = parseInt(String(req.query.year));

          if (!tenantId || !employeeid || !year) {
               return customError('Tenant ID, employee ID and year are required', 400, res);
          }

          const repo = new LeaveRepository(tenantId);
          const summary = await repo.getLeaveSummaryByEmployee(employeeid, year);
          res.json({ status: 'success', statusCode: 200, result: summary });
     } catch (error) {
          return customError('Failed to retrieve leave summary', 500, res);
     }
};