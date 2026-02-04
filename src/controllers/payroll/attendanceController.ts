import { Request, Response } from 'express';
import { AttendanceRepository } from '../../models/payroll/AttendanceRepository';
import { customError } from '../../hooks/helper';

// Maximum duration in hours that a record can be edited after creation (24 hours = 1 day)
const EDIT_DURATION_HOURS = 24;

/**
 * Create attendance record
 */
export const createAttendanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const attendanceData = req.body;

          const repo = new AttendanceRepository(tenantId);
          const id = await repo.create(attendanceData);

          res.json({
               status: 'success',
               statusCode: 201,
               message: 'Attendance record created successfully',
               result: { id }
          });
     } catch (error) {
          const errorMessage = (error as Error).message.toString();
          console.log('Create attendance error:', errorMessage);
          return customError('Unable to create attendance record. Please check your input and try again.', 500, res);
     }
};

/**
 * Get attendance by ID
 */
export const getAttendanceByIdHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);

          if (!id) {
               return customError(' Attendance ID are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const attendance = await repo.getById(id);

          if (!attendance) {
               return customError('Attendance record not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: attendance
          });
     } catch (error) {
          return customError('Failed to retrieve attendance record', 500, res);
     }
};

/**
 * Get attendance by employee and date
 */
export const getAttendanceByEmployeeAndDateHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const attendance_date = req.params.date;

          if (!tenantId || !employeeid || !attendance_date) {
               return customError('Tenant ID, Employee ID, and Date are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const attendance = await repo.getByEmployeeAndDate(employeeid, attendance_date);

          if (!attendance) {
               return customError('Attendance record not found', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               result: attendance
          });
     } catch (error) {
          return customError('Failed to retrieve attendance record', 500, res);
     }
};

/**
 * Get employee attendance by date range
 */
export const getEmployeeAttendanceByDateRangeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const startDate = req.query.startDate as string;
          const endDate = req.query.endDate as string;

          if (!employeeid || !startDate || !endDate) {
               return customError('Tenant ID, Employee ID, Start Date, and End Date are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const attendance = await repo.getByEmployeeIdAndDateRange(employeeid, startDate, endDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: attendance
          });
     } catch (error) {
          return customError('Failed to retrieve attendance records', 500, res);
     }
};


export const updateAttendanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);
          const updateData = req.body;

          if (!tenantId || !id) {
               return customError('Tenant ID and Attendance ID are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const existingRecord = await repo.getById(id);

          if (!existingRecord) return customError('Attendance record not found', 404, res);

          if (existingRecord.created_at) {
               const createdTime = new Date(existingRecord.created_at).getTime();
               const currentTime = new Date().getTime();
               const elapsedHours = (currentTime - createdTime) / (1000 * 60 * 60);

               if (elapsedHours > EDIT_DURATION_HOURS) {
                    return customError(
                         `Record cannot be edited after ${EDIT_DURATION_HOURS} hours of creation. Elapsed time: ${Math.round(elapsedHours)} hours.`,
                         403,
                         res
                    );
               }
          }

          if (updateData['status'] && updateData['status'].toLowerCase() === 'absent') {
               updateData['clock_in'] = null;
               updateData['clock_out'] = null;
               updateData['total_hours'] = 0;
               updateData['overtime_hours'] = 0;
          }

          const success = await repo.update(id, updateData);
          if (!success) return customError('Failed to update attendance record', 400, res);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Attendance record updated successfully'
          });
     } catch (error) {
          console.log('Update attendance error:', error);
          return customError('Failed to update attendance record', 500, res);
     }
};


export const getAttendanceByDateRangeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const startDate = req.query.startDate as string;
          const endDate = req.query.endDate as string;

          if (!startDate || !endDate) {
               return customError('Start Date and End Date are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const attendance = await repo.getByDateRange(startDate, endDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: attendance
          });
     } catch (error) {
          return customError('Failed to retrieve attendance records', 500, res);
     }
};

/**
 * Get attendance summary for employee
 */
export const getAttendanceSummaryHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const employeeid = parseInt(req.params.employeeid);
          const startDate = req.query.startDate as string;
          const endDate = req.query.endDate as string;

          if (!tenantId || !employeeid || !startDate || !endDate) {
               return customError('Tenant ID, Employee ID, Start Date, and End Date are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const summary = await repo.getAttendanceSummary(employeeid, startDate, endDate);

          res.json({
               status: 'success',
               statusCode: 200,
               result: summary
          });
     } catch (error) {
          return customError('Failed to retrieve attendance summary', 500, res);
     }
};

/**
 * Clock in for employee
 */
export const clockInHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { employeeid, attendance_date, clock_in } = req.body;

          if (!tenantId || !employeeid || !attendance_date || !clock_in) {
               return customError('Tenant ID, Employee ID, Attendance Date, and Clock In time are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const id = await repo.clockIn(employeeid, attendance_date, clock_in);

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Clock in recorded successfully',
               result: { id }
          });
     } catch (error) {
          return customError('Failed to record clock in', 500, res);
     }
};

/**
 * Clock out for employee
 */
export const clockOutHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const { employeeid, attendance_date, clock_out, total_hours } = req.body;

          if (!tenantId || !employeeid || !attendance_date || !clock_out || total_hours === undefined) {
               return customError('Tenant ID, Employee ID, Attendance Date, Clock Out time, and Total Hours are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const success = await repo.clockOut(employeeid, attendance_date, clock_out, total_hours);

          if (!success) {
               return customError('No attendance record found for clock out', 404, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Clock out recorded successfully'
          });
     } catch (error) {
          return customError('Failed to record clock out', 500, res);
     }
};

/**
 * Get pending overtime approvals
 */
export const getPendingOvertimeApprovalsHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);

          if (!tenantId) {
               return customError('Tenant ID is required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const pendingApprovals = await repo.getPendingOvertimeApprovals();

          res.json({
               status: 'success',
               statusCode: 200,
               result: pendingApprovals
          });
     } catch (error) {
          return customError('Failed to retrieve pending overtime approvals', 500, res);
     }
};

/**
 * Approve overtime
 */
export const approveOvertimeHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const id = parseInt(req.params.id);
          const { approved_by } = req.body;

          if (!tenantId || !id || !approved_by) {
               return customError('Tenant ID, Attendance ID, and Approved By are required', 400, res);
          }

          const repo = new AttendanceRepository(tenantId);
          const success = await repo.approveOvertime(id, approved_by);

          if (!success) {
               return customError('Failed to approve overtime', 400, res);
          }

          res.json({
               status: 'success',
               statusCode: 200,
               message: 'Overtime approved successfully'
          });
     } catch (error) {
          return customError('Failed to approve overtime', 500, res);
     }
};

/**
 * Bulk create attendance records
 */
export const bulkCreateAttendanceHandler = async (req: Request, res: Response) => {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const attendanceRecords = req.body.attendance_records;

          if (!Array.isArray(attendanceRecords)) {
               return customError('Attendance Records array are required', 400, res);
          }
          if (attendanceRecords.length === 0) {
               return customError('Attendance Records array cannot be empty', 400, res);
          }

          const refinedRecords = attendanceRecords.map((record: any) => {
               if (record.status.toLowerCase() === 'absent') {
                    return {
                         ...record,
                         clock_in: null,
                         clock_out: null,
                         total_hours: 0,
                         overtime_hours: 0
                    };
               }
               return record;
          });

          const repo = new AttendanceRepository(tenantId);
          const ids = await repo.bulkCreate(refinedRecords);

          res.json({
               status: 'success',
               statusCode: 201,
               message: 'Attendance records created successfully',
               result: { ids, count: ids.length }
          });
     } catch (error) {
          console.log('Bulk create attendance error:', error);
          return customError('Failed to create attendance records', 500, res);
     }
};